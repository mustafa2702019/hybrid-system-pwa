// Hybrid System Scoring Engine
import type { Stage } from '@/types';
import { 
  STAGE_1_WEIGHTS, 
  STAGE_2_WEIGHTS, 
  STAGE_3_WEIGHTS,
  STAGE_CONFIG,
  ALL_TASKS
} from '@/constants';
import { db } from '@/db';

// ==================== WEEKLY SCORE CALCULATION ====================

interface WeeklyMetrics {
  wakeTime: number;
  training: number;
  observationDaily: number;
  observationWeekly: number;
  journaling: number;
  phoneBoundary: number;
  microSkill: number;
  predictionAccuracy: number;
  emotionalControl: number;
  influenceDaily: number;
  influenceReflection: number;
  influenceTheme: number;
  physical: number;
  learning: number;
  failureCycles: number;
  chaosAdaptation: number;
  mission: number;
  influenceAdoption: number;
  systemLog: number;
}

export async function calculateWeeklyScore(
  weekNumber: number,
  stage: Stage
): Promise<{ score: number; passed: boolean; metrics: Partial<WeeklyMetrics> }> {
  const weekStart = getWeekStartDate(weekNumber);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  
  let score = 0;
  const metrics: Partial<WeeklyMetrics> = {};
  
  switch (stage) {
    case 1: {
      const stage1Result = await calculateStage1Score(weekStart, weekEnd);
      score = stage1Result.score;
      Object.assign(metrics, stage1Result.metrics);
      break;
    }
    case 2: {
      const stage2Result = await calculateStage2Score(weekStart, weekEnd);
      score = stage2Result.score;
      Object.assign(metrics, stage2Result.metrics);
      break;
    }
    case 3: {
      const stage3Result = await calculateStage3Score(weekStart, weekEnd);
      score = stage3Result.score;
      Object.assign(metrics, stage3Result.metrics);
      break;
    }
  }
  
  const passThreshold = STAGE_CONFIG[stage].passThreshold;
  const passed = score >= passThreshold;
  
  return { score: Math.round(score), passed, metrics };
}

export interface StageGateCondition {
  key: string;
  label: string;
  passed: boolean;
  value: string;
}

export interface StageGateReport {
  stage: Stage;
  eligibleNow: boolean;
  requiresConsecutiveWeeks: boolean;
  conditions: StageGateCondition[];
}

// ==================== STAGE 1 SCORING ====================

async function calculateStage1Score(weekStart: Date, weekEnd: Date) {
  const metrics: Partial<WeeklyMetrics> = {};
  
  // Get all task completions for the week
  const completions = await db.getCompletionsForDateRange(weekStart, weekEnd);
  
  // Calculate wake time compliance (7 days)
  const wakeCompletions = completions.filter(c => {
    const task = getTaskById(c.taskId);
    return task?.category === 'wake' && c.completed;
  });
  metrics.wakeTime = (wakeCompletions.length / 7) * 100;
  
  // Calculate training compliance (Sunday-Thursday = 5 days)
  const trainingDays = getSundayThursdayCount(weekStart, weekEnd);
  const trainingCompletions = completions.filter(c => {
    const task = getTaskById(c.taskId);
    return task?.category === 'training' && c.completed;
  });
  metrics.training = (trainingCompletions.length / trainingDays) * 100;
  
  // Calculate observation daily compliance (7 days)
  const obsDailyCompletions = completions.filter(c => {
    const task = getTaskById(c.taskId);
    return task?.id === 'observation-daily' && c.completed;
  });
  metrics.observationDaily = (obsDailyCompletions.length / 7) * 100;
  
  // Weekly deep observation accuracy (separate from daily observation compliance)
  const weekNumber = getWeekNumberFromDate(weekStart);
  const deepDrills = await db.deepObservations.where('weekNumber').equals(weekNumber).toArray();
  metrics.observationWeekly = deepDrills.length > 0
    ? deepDrills.reduce((sum, item) => sum + item.accuracy, 0) / deepDrills.length
    : 0;
  
  // Calculate journaling compliance (7 days)
  const journalCompletions = completions.filter(c => {
    const task = getTaskById(c.taskId);
    return task?.category === 'journaling' && c.completed;
  });
  metrics.journaling = (journalCompletions.length / 7) * 100;
  
  // Calculate phone boundary compliance
  const phoneCompletions = completions.filter(c => {
    const task = getTaskById(c.taskId);
    return task?.category === 'phone' && c.completed;
  });
  metrics.phoneBoundary = (phoneCompletions.length / 7) * 100;
  
  // Calculate micro-skill compliance
  const microCompletions = completions.filter(c => {
    const task = getTaskById(c.taskId);
    return task?.category === 'microskill' && c.completed;
  });
  metrics.microSkill = (microCompletions.length / 7) * 100;
  
  // Apply weights
  const score = 
    (metrics.wakeTime * STAGE_1_WEIGHTS.wakeTime) +
    (metrics.training * STAGE_1_WEIGHTS.training) +
    (metrics.observationDaily * STAGE_1_WEIGHTS.observationDaily) +
    (metrics.observationWeekly * STAGE_1_WEIGHTS.observationWeekly) +
    (metrics.journaling * STAGE_1_WEIGHTS.journaling) +
    (metrics.phoneBoundary * STAGE_1_WEIGHTS.phoneBoundary) +
    (metrics.microSkill * STAGE_1_WEIGHTS.microSkill);
  
  return { score, metrics };
}

// ==================== STAGE 2 SCORING ====================

async function calculateStage2Score(weekStart: Date, weekEnd: Date) {
  const metrics: Partial<WeeklyMetrics> = {};
  
  // Get predictions for accuracy
  const predictions = await db.getPredictionsForWeek(weekStart);
  const resolvedPredictions = predictions.filter(p => p.result !== undefined);
  const correctPredictions = resolvedPredictions.filter(p => p.result === 'correct');
  metrics.predictionAccuracy = resolvedPredictions.length > 0
    ? (correctPredictions.length / resolvedPredictions.length) * 100
    : 0;
  
  // Emotional control - from task completions
  const completions = await db.getCompletionsForDateRange(weekStart, weekEnd);
  const emotionalCompletions = completions.filter(c => {
    const task = getTaskById(c.taskId);
    return task?.category === 'emotional' && c.completed;
  });
  metrics.emotionalControl = (emotionalCompletions.length / 5) * 100; // 5×/week target
  
  // Influence daily success
  const influenceAttempts = await db.getInfluenceAttemptsForWeek(weekStart);
  const successfulInfluence = influenceAttempts.filter(a => a.result === 'success');
  metrics.influenceDaily = influenceAttempts.length > 0
    ? (successfulInfluence.length / influenceAttempts.length) * 100
    : 0;
  
  // Influence reflection (weekly)
  const reflectionCompletions = completions.filter(c => {
    const task = getTaskById(c.taskId);
    return task?.id === 'influence-reflection' && c.completed;
  });
  metrics.influenceReflection = reflectionCompletions.length > 0 ? 100 : 0;
  
  // Influence theme progress (monthly - simplified)
  const themeProgress = await db.themeProgress.toArray();
  const currentMonthProgress = themeProgress.filter(p => p.month === new Date().getMonth() + 1);
  metrics.influenceTheme = currentMonthProgress.length > 0
    ? currentMonthProgress.reduce((sum, p) => sum + p.completionPercent, 0) / currentMonthProgress.length
    : 0;
  
  // Physical continuation (4-5×/week)
  const physicalCompletions = completions.filter(c => {
    const task = getTaskById(c.taskId);
    return task?.category === 'training' && c.completed;
  });
  metrics.physical = (physicalCompletions.length / 5) * 100;
  
  // Systematic learning (weekly)
  const learningCompletions = completions.filter(c => {
    const task = getTaskById(c.taskId);
    return task?.id === 'systematic-learning' && c.completed;
  });
  metrics.learning = learningCompletions.length > 0 ? 100 : 0;
  
  // Journaling (5×/week)
  const journalCompletions = completions.filter(c => {
    const task = getTaskById(c.taskId);
    return task?.category === 'journaling' && c.completed;
  });
  metrics.journaling = (journalCompletions.length / 5) * 100;
  
  // Apply weights
  const score =
    (metrics.predictionAccuracy * STAGE_2_WEIGHTS.predictionAccuracy) +
    (metrics.emotionalControl * STAGE_2_WEIGHTS.emotionalControl) +
    (metrics.influenceDaily * STAGE_2_WEIGHTS.influenceDaily) +
    (metrics.influenceReflection * STAGE_2_WEIGHTS.influenceReflection) +
    (metrics.influenceTheme * STAGE_2_WEIGHTS.influenceTheme) +
    (metrics.physical * STAGE_2_WEIGHTS.physical) +
    (metrics.learning * STAGE_2_WEIGHTS.learning) +
    (metrics.journaling * STAGE_2_WEIGHTS.journaling);
  
  return { score, metrics };
}

// ==================== STAGE 3 SCORING ====================

async function calculateStage3Score(weekStart: Date, weekEnd: Date) {
  const metrics: Partial<WeeklyMetrics> = {};
  
  // Failure cycles (weekly)
  const failureCycles = await db.failureCycles
    .where('attemptDate')
    .between(weekStart, weekEnd)
    .toArray();
  metrics.failureCycles = failureCycles.length > 0 ? 100 : 0;
  
  // Chaos adaptation (2×/week)
  const chaosExposures = await db.chaosExposures
    .where('date')
    .between(weekStart, weekEnd)
    .toArray();
  const calmExposures = chaosExposures.filter(e => e.calmMaintained);
  metrics.chaosAdaptation = chaosExposures.length > 0
    ? (calmExposures.length / chaosExposures.length) * 100
    : 0;
  
  // Mission score (use latest mission)
  const missions = await db.missions
    .where('executedDate')
    .between(weekStart, weekEnd)
    .toArray();
  const latestMission = missions.sort((a, b) => 
    (b.executedDate?.getTime() || 0) - (a.executedDate?.getTime() || 0)
  )[0];
  metrics.mission = latestMission?.totalScore || 0;
  
  // Influence adoption rate
  const ideaAdoptions = await db.ideaAdoptions
    .where('date')
    .between(weekStart, weekEnd)
    .toArray();
  const adopted = ideaAdoptions.filter(a => a.adopted);
  metrics.influenceAdoption = ideaAdoptions.length > 0
    ? (adopted.length / ideaAdoptions.length) * 100
    : 0;
  
  // Physical maintenance (5×/week)
  const completions = await db.getCompletionsForDateRange(weekStart, weekEnd);
  const physicalCompletions = completions.filter(c => {
    const task = getTaskById(c.taskId);
    return task?.category === 'training' && c.completed;
  });
  metrics.physical = (physicalCompletions.length / 5) * 100;
  
  // System log (5×/week)
  const journalEntries = await db.journalEntries
    .where('date')
    .between(weekStart, weekEnd)
    .toArray();
  metrics.systemLog = (journalEntries.length / 5) * 100;
  
  // Apply weights
  const score =
    (metrics.failureCycles * STAGE_3_WEIGHTS.failureCycles) +
    (metrics.chaosAdaptation * STAGE_3_WEIGHTS.chaosAdaptation) +
    (metrics.mission * STAGE_3_WEIGHTS.mission) +
    (metrics.influenceAdoption * STAGE_3_WEIGHTS.influenceAdoption) +
    (metrics.physical * STAGE_3_WEIGHTS.physical) +
    (metrics.systemLog * STAGE_3_WEIGHTS.systemLog);
  
  return { score, metrics };
}

// ==================== HELPER FUNCTIONS ====================

function getWeekStartDate(weekNumber: number): Date {
  // Assuming program starts on a specific date
  const programStart = new Date('2024-01-01'); // This should come from profile
  const weekStart = new Date(programStart);
  weekStart.setDate(weekStart.getDate() + (weekNumber - 1) * 7);
  return weekStart;
}

function getSundayThursdayCount(weekStart: Date, weekEnd: Date): number {
  let count = 0;
  const current = new Date(weekStart);
  while (current < weekEnd) {
    const day = current.getDay();
    if (day >= 0 && day <= 4) count++; // Sun-Thu
    current.setDate(current.getDate() + 1);
  }
  return count;
}

function getWeekNumberFromDate(date: Date): number {
  const programStart = new Date('2024-01-01');
  const diff = date.getTime() - programStart.getTime();
  return Math.min(52, Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24 * 7)) + 1));
}

function getTaskById(taskId: string) {
  return ALL_TASKS.find((t) => t.id === taskId);
}

// ==================== DAILY COMPLETION ====================

export async function calculateDailyCompletion(date: Date, stage: Stage): Promise<number> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  const completions = await db.getCompletionsForDateRange(startOfDay, endOfDay);
  const dayMode = await db.getDayModeForDate(date);
  
  // Get tasks for current stage and day mode
  const stageTasks = ALL_TASKS.filter((t) => 
    t.stage === stage && 
    t.frequency === 'daily' &&
    t.dayModeAvailability.includes(dayMode?.mode || 'green')
  );
  
  if (stageTasks.length === 0) return 0;
  
  const completedCount = stageTasks.filter((task) =>
    completions.some(c => c.taskId === task.id && c.completed)
  ).length;
  
  return Math.round((completedCount / stageTasks.length) * 100);
}

// ==================== STAGE PROGRESS ====================

export function calculateStageProgress(currentWeek: number, stage: Stage): number {
  const config = STAGE_CONFIG[stage];
  const stageWeeks = config.weeks.end - config.weeks.start + 1;
  const weeksInStage = Math.max(0, currentWeek - config.weeks.start + 1);
  return Math.min(100, Math.round((weeksInStage / stageWeeks) * 100));
}

// ==================== MISSION RANK ====================

export function calculateMissionRank(score: number): { rank: string; color: string } {
  if (score >= 91) return { rank: 'S', color: '#ef4444' };
  if (score >= 81) return { rank: 'A', color: '#f59e0b' };
  if (score >= 71) return { rank: 'B', color: '#8b5cf6' };
  if (score >= 56) return { rank: 'C', color: '#3b82f6' };
  if (score >= 41) return { rank: 'D', color: '#22c55e' };
  return { rank: 'E', color: '#6b7280' };
}

// ==================== ATTRIBUTE CALCULATION ====================

export async function calculateAttributes() {
  const [
    workoutCount,
    observationCount,
    predictionCount,
    influenceCount,
    missionCount,
    xpData
  ] = await Promise.all([
    db.workoutSessions.count(),
    db.observationLogs.count(),
    db.predictions.count(),
    db.influenceAttempts.count(),
    db.missions.count(),
    db.xpData.toArray()
  ]);
  
  const level = xpData[0]?.level || 1;
  
  return {
    strength: Math.min(100, 10 + Math.floor(workoutCount * 0.5) + level),
    perception: Math.min(100, 10 + Math.floor(observationCount * 0.3) + Math.floor(level * 0.5)),
    intelligence: Math.min(100, 10 + Math.floor(predictionCount * 0.5) + Math.floor(level * 0.5)),
    charisma: Math.min(100, 10 + Math.floor(influenceCount * 0.4) + Math.floor(level * 0.5)),
    discipline: Math.min(100, 10 + level * 2 + Math.floor(workoutCount * 0.2)),
    adaptability: Math.min(100, 10 + Math.floor(missionCount * 2) + Math.floor(level * 0.5))
  };
}

export async function getStageGateReport(stage: Stage, currentWeek: number): Promise<StageGateReport> {
  const week1 = await db.getWeeklyStats(currentWeek - 1);
  const week2 = await db.getWeeklyStats(currentWeek - 2);
  const conditions: StageGateCondition[] = [];
  if (!week1 || !week2) {
    return {
      stage,
      eligibleNow: false,
      requiresConsecutiveWeeks: true,
      conditions: [{
        key: 'insufficient-data',
        label: 'Need at least two completed weekly reports',
        passed: false,
        value: 'missing'
      }]
    };
  }

  const twoWeekPass = week1.passed && week2.passed;
  conditions.push({
    key: 'two-week-pass',
    label: 'Two consecutive passing weeks',
    passed: twoWeekPass,
    value: `${week2.weekNumber}/${week1.weekNumber}`
  });

  if (stage === 1) {
    const scoreOk = week1.stageScore >= 85 && week2.stageScore >= 85;
    const trainOk = (week1.metrics.training || 0) >= 90 && (week2.metrics.training || 0) >= 90;
    const journalOk = (week1.metrics.journaling || 0) >= 90 && (week2.metrics.journaling || 0) >= 90;
    const wakeOk = (week1.metrics.wakeTime || 0) >= 70 && (week2.metrics.wakeTime || 0) >= 70;
    const phoneMicroOk =
      ((week1.metrics.phoneBoundary || 0) >= 80 && (week2.metrics.phoneBoundary || 0) >= 80) &&
      ((week1.metrics.microSkill || 0) >= 80 && (week2.metrics.microSkill || 0) >= 80);

    const getDailyObsAccuracy = async (weekNumber: number) => {
      const start = getWeekStartDate(weekNumber);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      const logs = await db.getObservationLogsForDateRange(start, end);
      const verified = logs.filter((log) => !log.isDeepDrill && log.verificationResult !== undefined);
      const correct = verified.filter((log) => log.verificationResult === 'correct');
      return verified.length ? (correct.length / verified.length) * 100 : 0;
    };
    const [d1, d2] = await Promise.all([getDailyObsAccuracy(week1.weekNumber), getDailyObsAccuracy(week2.weekNumber)]);
    const dailyObsOk = d1 >= 80 && d2 >= 80;

    const deep1 = await db.deepObservations.where('weekNumber').equals(week1.weekNumber).toArray();
    const deep2 = await db.deepObservations.where('weekNumber').equals(week2.weekNumber).toArray();
    const deepAvg1 = deep1.length ? deep1.reduce((s, item) => s + item.accuracy, 0) / deep1.length : 0;
    const deepAvg2 = deep2.length ? deep2.reduce((s, item) => s + item.accuracy, 0) / deep2.length : 0;
    const deepOk = deepAvg1 >= 80 && deepAvg2 >= 80;

    const w1start = getWeekStartDate(1);
    const w5end = getWeekStartDate(6);
    const logs = await db.getObservationLogsForDateRange(w1start, w5end);
    const envCount = new Set(logs.map((l) => (l.environment || '').trim().toLowerCase()).filter(Boolean)).size;
    const varietyOk = envCount >= 2;
    const dayModes = await db.dayModes.where('date').between(w1start, w5end).toArray();
    const redDays = dayModes.filter((d) => d.mode === 'red');
    let recoveryOk = false;
    for (const red of redDays) {
      const next = new Date(red.date);
      next.setDate(next.getDate() + 1);
      const s = new Date(next); s.setHours(0, 0, 0, 0);
      const e = new Date(next); e.setHours(23, 59, 59, 999);
      const comps = await db.getCompletionsForDateRange(s, e);
      if (comps.some((c) => c.completed)) {
        recoveryOk = true;
        break;
      }
    }

    conditions.push(
      { key: 'score', label: 'Stage score >= 85% (2 weeks)', passed: scoreOk, value: `${Math.round(week2.stageScore)} / ${Math.round(week1.stageScore)}` },
      { key: 'daily-observation-accuracy', label: 'Daily observation accuracy >= 80%', passed: dailyObsOk, value: `${Math.round(d2)} / ${Math.round(d1)}` },
      { key: 'deep-drill-accuracy', label: 'Deep drill accuracy >= 80%', passed: deepOk, value: `${Math.round(deepAvg2)} / ${Math.round(deepAvg1)}` },
      { key: 'training', label: 'Training >= 90%', passed: trainOk, value: `${Math.round(week2.metrics.training || 0)} / ${Math.round(week1.metrics.training || 0)}` },
      { key: 'journaling', label: 'Journaling >= 90%', passed: journalOk, value: `${Math.round(week2.metrics.journaling || 0)} / ${Math.round(week1.metrics.journaling || 0)}` },
      { key: 'phone-micro', label: 'Phone boundary + micro-skill >= 80%', passed: phoneMicroOk, value: `${Math.round(week2.metrics.phoneBoundary || 0)}&${Math.round(week2.metrics.microSkill || 0)}` },
      { key: 'wake', label: 'Wake adherence >= 70%', passed: wakeOk, value: `${Math.round(week2.metrics.wakeTime || 0)} / ${Math.round(week1.metrics.wakeTime || 0)}` },
      { key: 'variety-environments', label: '2+ observation environments (Weeks 1-5)', passed: varietyOk, value: `${envCount}` },
      { key: 'offday-recovery', label: 'Off-day with next-day recovery', passed: recoveryOk, value: recoveryOk ? 'met' : 'missing' }
    );
    const earlyWindow = currentWeek >= 5;
    return {
      stage,
      eligibleNow: earlyWindow && conditions.every((c) => c.passed),
      requiresConsecutiveWeeks: true,
      conditions
    };
  }

  if (stage === 2) {
    const scoreOk = week1.stageScore >= 80 && week2.stageScore >= 80;
    const influenceOk = (week1.metrics.influenceDaily || 0) >= 60 && (week2.metrics.influenceDaily || 0) >= 60;
    const predictionOk = (week1.metrics.predictionAccuracy || 0) >= 70 && (week2.metrics.predictionAccuracy || 0) >= 70;
    const emotionalOk = (week1.metrics.emotionalControl || 0) >= 85 && (week2.metrics.emotionalControl || 0) >= 85;
    conditions.push(
      { key: 'score', label: 'Stage score >= 80%', passed: scoreOk, value: `${Math.round(week2.stageScore)} / ${Math.round(week1.stageScore)}` },
      { key: 'influence', label: 'Influence daily success >= 60%', passed: influenceOk, value: `${Math.round(week2.metrics.influenceDaily || 0)} / ${Math.round(week1.metrics.influenceDaily || 0)}` },
      { key: 'prediction', label: 'Prediction accuracy >= 70%', passed: predictionOk, value: `${Math.round(week2.metrics.predictionAccuracy || 0)} / ${Math.round(week1.metrics.predictionAccuracy || 0)}` },
      { key: 'emotional', label: 'Emotional control >= 85%', passed: emotionalOk, value: `${Math.round(week2.metrics.emotionalControl || 0)} / ${Math.round(week1.metrics.emotionalControl || 0)}` }
    );
    return {
      stage,
      eligibleNow: conditions.every((c) => c.passed),
      requiresConsecutiveWeeks: true,
      conditions
    };
  }

  const scoreOk = week1.stageScore >= 75 && week2.stageScore >= 75;
  const missionOk = (week1.metrics.mission || 0) >= 80 && (week2.metrics.mission || 0) >= 80;
  const chaosOk = (week1.metrics.chaosAdaptation || 0) >= 80 && (week2.metrics.chaosAdaptation || 0) >= 80;
  const adoptionOk = (week1.metrics.influenceAdoption || 0) >= 60 && (week2.metrics.influenceAdoption || 0) >= 60;
  conditions.push(
    { key: 'score', label: 'Stage score >= 75%', passed: scoreOk, value: `${Math.round(week2.stageScore)} / ${Math.round(week1.stageScore)}` },
    { key: 'mission', label: 'Latest mission >= 80%', passed: missionOk, value: `${Math.round(week2.metrics.mission || 0)} / ${Math.round(week1.metrics.mission || 0)}` },
    { key: 'chaos', label: 'Chaos calm >= 80%', passed: chaosOk, value: `${Math.round(week2.metrics.chaosAdaptation || 0)} / ${Math.round(week1.metrics.chaosAdaptation || 0)}` },
    { key: 'adoption', label: 'Influence adoption >= 60%', passed: adoptionOk, value: `${Math.round(week2.metrics.influenceAdoption || 0)} / ${Math.round(week1.metrics.influenceAdoption || 0)}` }
  );
  return {
    stage,
    eligibleNow: conditions.every((c) => c.passed),
    requiresConsecutiveWeeks: true,
    conditions
  };
}
