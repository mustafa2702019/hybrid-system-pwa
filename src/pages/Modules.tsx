import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { db } from '@/db';
import { useAppStore } from '@/store';
import { Missions } from '@/pages/Missions';
import type { InfluenceTactic } from '@/types';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts';

type ModuleTab = 'workout' | 'observation' | 'prediction' | 'influence' | 'failure' | 'journal' | 'missions' | 'settings';

const tabs: Array<{ id: ModuleTab; label: string }> = [
  { id: 'workout', label: 'Workout' },
  { id: 'observation', label: 'Observation' },
  { id: 'prediction', label: 'Prediction' },
  { id: 'influence', label: 'Influence' },
  { id: 'failure', label: 'Failure' },
  { id: 'journal', label: 'Journal' },
  { id: 'missions', label: 'Missions' },
  { id: 'settings', label: 'Settings' },
];

export function Modules() {
  const [tab, setTab] = useState<ModuleTab>('missions');
  const { addXP, updateAttributes, profile, setTheme, exportData, importData, resetProgress } = useAppStore();
  const currentStage = profile?.currentStage || 1;
  const isUnlocked = useCallback((tabId: ModuleTab) => {
    if (tabId === 'prediction' || tabId === 'influence') return currentStage >= 2;
    if (tabId === 'failure' || tabId === 'missions') return currentStage >= 3;
    return true;
  }, [currentStage]);

  const content = useMemo(() => {
    if (!isUnlocked(tab)) {
      return (
        <motion.div className="glass rounded-xl p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <p className="text-sm text-[var(--text-muted)]">
            This module is locked. Reach Stage {tab === 'prediction' || tab === 'influence' ? 2 : 3} first.
          </p>
        </motion.div>
      );
    }
    if (tab === 'missions') return <Missions />;
    if (tab === 'workout') return <WorkoutPanel onReward={async () => { await addXP(25); await updateAttributes(); }} />;
    if (tab === 'observation') return <ObservationPanel onReward={async () => { await addXP(15); await updateAttributes(); }} />;
    if (tab === 'prediction') return <PredictionPanel onReward={async () => { await addXP(20); await updateAttributes(); }} />;
    if (tab === 'influence') return <InfluencePanel onReward={async () => { await addXP(15); await updateAttributes(); }} />;
    if (tab === 'failure') return <FailurePanel onReward={async () => { await addXP(20); await updateAttributes(); }} />;
    if (tab === 'journal') return <JournalPanel onReward={async () => { await addXP(10); await updateAttributes(); }} />;
    return (
      <SettingsPanel
        currentTheme={profile?.theme || 'hybrid'}
        onTheme={setTheme}
        onExport={exportData}
        onImport={importData}
        onReset={resetProgress}
      />
    );
  }, [tab, addXP, updateAttributes, profile?.theme, setTheme, exportData, importData, resetProgress, currentStage, isUnlocked]);

  return (
    <div className="min-h-screen p-4 pb-24">
      <h1 className="text-2xl font-bold mb-3" style={{ fontFamily: 'var(--font-heading)' }}>
        <span className="text-[var(--primary)]">SYSTEM</span> <span className="text-[var(--text)]">MODULES</span>
      </h1>
      <div className="grid grid-cols-4 gap-2 mb-4">
        {tabs.map((t) => {
          const unlocked = isUnlocked(t.id);
          return (
          <button
            key={t.id}
            onClick={() => unlocked && setTab(t.id)}
            disabled={!unlocked}
            className={`text-xs rounded-lg p-2 border ${tab === t.id ? 'border-[var(--primary)] text-[var(--primary)] bg-[var(--primary)]/10' : 'border-[var(--border)] text-[var(--text-muted)]'} ${!unlocked ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            {t.label}{!unlocked ? ' (Locked)' : ''}
          </button>
        )})}
      </div>
      {content}
    </div>
  );
}

function WorkoutPanel({ onReward }: { onReward: () => Promise<void> }) {
  const [notes, setNotes] = useState('');
  const [timer, setTimer] = useState(0);
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<Array<{ id: string; date: Date; totalDuration: number; notes?: string }>>([]);

  const loadHistory = useCallback(async () => {
    const rows = await db.workoutSessions.orderBy('date').reverse().limit(10).toArray();
    setHistory(rows.map((r) => ({ id: r.id, date: r.date, totalDuration: r.totalDuration, notes: r.notes })));
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setTimer((prev) => prev + 1), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  return (
    <motion.div className="glass rounded-xl p-4 space-y-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <p className="text-sm text-[var(--text-muted)]">Weekly schedule: Sunday-Thursday active, Friday/Saturday recovery.</p>
      <div className="grid grid-cols-3 gap-2">
        <button className="px-3 py-2 rounded-lg bg-[var(--primary)]/20 text-[var(--primary)] text-xs" onClick={() => setRunning(true)}>Start Workout</button>
        <button className="px-3 py-2 rounded-lg bg-[var(--secondary)]/20 text-[var(--secondary)] text-xs" onClick={() => setRunning(false)}>Rest Timer</button>
        <button className="px-3 py-2 rounded-lg bg-black/20 text-[var(--text)] text-xs" onClick={() => { setRunning(false); setTimer(0); }}>Reset</button>
      </div>
      <p className="text-xs text-[var(--text-muted)] font-mono">Elapsed: {Math.floor(timer / 60)}:{String(timer % 60).padStart(2, '0')}</p>
      <textarea className="w-full" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Sets / reps / timing..." />
      <button className="px-4 py-2 rounded-lg bg-[var(--primary)]/20 text-[var(--primary)]" onClick={async () => {
        await db.workoutSessions.add({ id: crypto.randomUUID(), date: new Date(), dayOfWeek: new Date().toLocaleDateString('en-US', { weekday: 'long' }), exercises: [], totalDuration: Math.max(1, Math.round(timer / 60)), xpEarned: 25, notes });
        await onReward();
        setNotes('');
        setTimer(0);
        setRunning(false);
        await loadHistory();
      }}>Finish Workout (+25 XP)</button>
      <div className="space-y-2 max-h-36 overflow-y-auto">
        {history.map((item) => (
          <div key={item.id} className="rounded-lg p-2 bg-black/20">
            <p className="text-[10px] text-[var(--text-muted)]">{new Date(item.date).toLocaleDateString()} • {item.totalDuration}m</p>
            <p className="text-xs text-[var(--text)]">{item.notes || 'No notes'}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function ObservationPanel({ onReward }: { onReward: () => Promise<void> }) {
  const [environment, setEnvironment] = useState('');
  const [objectiveFacts, setObjectiveFacts] = useState('');
  const [microBehaviors, setMicroBehaviors] = useState('');
  const [inference, setInference] = useState('');
  const [confidence, setConfidence] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [verificationResult, setVerificationResult] = useState<'correct' | 'wrong' | 'unknown'>('unknown');
  const [deepMaskLeakage, setDeepMaskLeakage] = useState('');
  const [deepSummary, setDeepSummary] = useState('');
  const [deepAccuracy, setDeepAccuracy] = useState(80);
  const [trend, setTrend] = useState<Array<{ day: string; accuracy: number }>>([]);

  const loadTrend = useCallback(async () => {
    const logs = await db.observationLogs.orderBy('date').reverse().limit(14).toArray();
    const rows = logs
      .filter((l) => !l.isDeepDrill && l.verificationResult)
      .map((l) => ({
        day: new Date(l.date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
        accuracy: l.verificationResult === 'correct' ? 100 : l.verificationResult === 'wrong' ? 0 : 50
      }))
      .reverse();
    setTrend(rows);
  }, []);

  useEffect(() => {
    void loadTrend();
  }, [loadTrend]);

  return (
    <motion.div className="glass rounded-xl p-4 space-y-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <input className="w-full" value={environment} onChange={(e) => setEnvironment(e.target.value)} placeholder="Environment / location" />
      <textarea className="w-full" rows={2} value={objectiveFacts} onChange={(e) => setObjectiveFacts(e.target.value)} placeholder="Objective facts (30 sec)" />
      <textarea className="w-full" rows={2} value={microBehaviors} onChange={(e) => setMicroBehaviors(e.target.value)} placeholder="Micro-behaviors (30 sec)" />
      <textarea className="w-full" rows={2} value={inference} onChange={(e) => setInference(e.target.value)} placeholder="Inference (20 sec)" />
      <div className="grid grid-cols-2 gap-2">
        <select className="w-full" value={confidence} onChange={(e) => setConfidence(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)}>
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Confidence {n}</option>)}
        </select>
        <select className="w-full" value={verificationResult} onChange={(e) => setVerificationResult(e.target.value as 'correct' | 'wrong' | 'unknown')}>
          <option value="correct">Correct</option>
          <option value="wrong">Wrong</option>
          <option value="unknown">Unknown</option>
        </select>
      </div>
      <button className="px-4 py-2 rounded-lg bg-[var(--primary)]/20 text-[var(--primary)]" onClick={async () => {
        await db.observationLogs.add({ id: crypto.randomUUID(), date: new Date(), environment, objectiveFacts, microBehaviors, inference, confidence, verificationResult, isDeepDrill: false, duration: 60 });
        await onReward();
        setEnvironment('');
        setObjectiveFacts('');
        setMicroBehaviors('');
        setInference('');
        await loadTrend();
      }}>Save Observation (+15 XP)</button>

      <div className="pt-2 border-t border-[var(--border)] space-y-2">
        <p className="text-[11px] text-[var(--text-muted)]">This is separate from Daily Observation and is required once per week.</p>
        <p className="text-xs text-[var(--text-muted)]">Weekly Deep Observation Drill</p>
        <textarea className="w-full" rows={2} value={deepMaskLeakage} onChange={(e) => setDeepMaskLeakage(e.target.value)} placeholder="Mask vs leakage notes" />
        <textarea className="w-full" rows={2} value={deepSummary} onChange={(e) => setDeepSummary(e.target.value)} placeholder="Conversation verification summary" />
        <input className="w-full" type="number" min={0} max={100} value={deepAccuracy} onChange={(e) => setDeepAccuracy(Number(e.target.value) || 0)} placeholder="Deep drill accuracy %" />
        <button className="px-4 py-2 rounded-lg bg-[var(--secondary)]/20 text-[var(--secondary)]" onClick={async () => {
          const weekNumber = Math.min(52, Math.max(1, Math.ceil((Date.now() - new Date('2024-01-01').getTime()) / (1000 * 60 * 60 * 24 * 7))));
          await db.deepObservations.add({
            id: crypto.randomUUID(),
            weekNumber,
            date: new Date(),
            maskVsLeakage: deepMaskLeakage,
            conversationSummary: deepSummary,
            accuracy: deepAccuracy,
            notes: ''
          });
          await onReward();
          setDeepMaskLeakage('');
          setDeepSummary('');
        }}>Save Deep Drill (+15 XP)</button>
      </div>

      {trend.length > 1 && (
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="day" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} domain={[0, 100]} />
              <Tooltip />
              <Line type="monotone" dataKey="accuracy" stroke="var(--primary)" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.div>
  );
}

function PredictionPanel({ onReward }: { onReward: () => Promise<void> }) {
  const [statement, setStatement] = useState('');
  const [predictions, setPredictions] = useState<Array<{ id: string; statement: string; expectedOutcomeDate: Date; result?: 'correct' | 'wrong' | 'partial' }>>([]);
  const [accuracy, setAccuracy] = useState({ weekly: 0, total: 0 });

  const loadPredictions = async () => {
    const rows = await db.predictions.orderBy('createdAt').reverse().limit(6).toArray();
    setPredictions(rows.map((p) => ({ id: p.id, statement: p.statement, expectedOutcomeDate: p.expectedOutcomeDate, result: p.result })));
    const all = await db.predictions.toArray();
    const resolved = all.filter((p) => p.result);
    const correct = resolved.filter((p) => p.result === 'correct');
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weeklyResolved = resolved.filter((p) => new Date(p.createdAt) >= weekAgo);
    const weeklyCorrect = weeklyResolved.filter((p) => p.result === 'correct');
    setAccuracy({
      weekly: weeklyResolved.length ? Math.round((weeklyCorrect.length / weeklyResolved.length) * 100) : 0,
      total: resolved.length ? Math.round((correct.length / resolved.length) * 100) : 0
    });
  };

  useEffect(() => {
    void loadPredictions();
  }, []);

  return (
    <motion.div className="glass rounded-xl p-4 space-y-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <textarea className="w-full" rows={3} value={statement} onChange={(e) => setStatement(e.target.value)} placeholder="Prediction statement..." />
      <button className="px-4 py-2 rounded-lg bg-[var(--primary)]/20 text-[var(--primary)]" onClick={async () => {
        const expected = new Date();
        expected.setDate(expected.getDate() + 3);
        await db.predictions.add({ id: crypto.randomUUID(), createdAt: new Date(), statement, expectedOutcomeDate: expected, confidence: 3, isLocked: true });
        await onReward();
        setStatement('');
        await loadPredictions();
      }}>Log Prediction (+20 XP)</button>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg p-2 bg-black/20 text-xs text-[var(--text-muted)]">Weekly Accuracy: <span className="text-[var(--primary)]">{accuracy.weekly}%</span></div>
        <div className="rounded-lg p-2 bg-black/20 text-xs text-[var(--text-muted)]">Total Accuracy: <span className="text-[var(--primary)]">{accuracy.total}%</span></div>
      </div>
      <div className="space-y-2">
        {predictions.map((p) => {
          const locked = !p.result && new Date() < new Date(p.expectedOutcomeDate);
          return (
            <div key={p.id} className="p-2 rounded-lg bg-black/20">
              <p className="text-xs text-[var(--text)]">{p.statement}</p>
              <p className="text-[10px] text-[var(--text-muted)]">Due: {new Date(p.expectedOutcomeDate).toLocaleDateString()}</p>
              {locked ? (
                <p className="text-[10px] text-amber-400">Forecast Locked</p>
              ) : p.result ? (
                <p className="text-[10px] text-emerald-400">Result: {p.result}</p>
              ) : (
                <div className="flex gap-2 mt-1">
                  {(['correct', 'partial', 'wrong'] as const).map((r) => (
                    <button
                      key={r}
                      className="text-[10px] px-2 py-1 rounded bg-[var(--primary)]/20 text-[var(--primary)]"
                      onClick={async () => {
                        await db.predictions.update(p.id, { result: r, resolvedAt: new Date(), isLocked: false });
                        await onReward();
                        await loadPredictions();
                      }}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function InfluencePanel({ onReward }: { onReward: () => Promise<void> }) {
  const [target, setTarget] = useState('');
  const [tactic, setTactic] = useState<InfluenceTactic>('framing');
  const [reflection, setReflection] = useState('');
  const [themeProgress, setThemeProgress] = useState(0);
  const [idea, setIdea] = useState('');
  const [adopted, setAdopted] = useState(false);
  return (
    <motion.div className="glass rounded-xl p-4 space-y-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <input className="w-full" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Target category" />
      <select className="w-full" value={tactic} onChange={(e) => setTactic(e.target.value as InfluenceTactic)}>
        <option value="framing">Framing</option>
        <option value="mirroring">Mirroring</option>
        <option value="seeding">Seeding</option>
        <option value="leadership">Leadership</option>
      </select>
      <button className="px-4 py-2 rounded-lg bg-[var(--primary)]/20 text-[var(--primary)]" onClick={async () => {
        await db.influenceAttempts.add({ id: crypto.randomUUID(), date: new Date(), targetCategory: target, tactic, result: 'partial' });
        await onReward();
        setTarget('');
      }}>Log Influence Attempt (+15 XP)</button>
      <textarea className="w-full" rows={2} value={reflection} onChange={(e) => setReflection(e.target.value)} placeholder="Weekly influence reflection" />
      <button className="px-4 py-2 rounded-lg bg-[var(--secondary)]/20 text-[var(--secondary)]" onClick={async () => {
        const weekNumber = Math.min(52, Math.max(1, Math.ceil((Date.now() - new Date('2024-01-01').getTime()) / (1000 * 60 * 60 * 24 * 7))));
        await db.influenceReflections.add({ id: crypto.randomUUID(), weekNumber, date: new Date(), summary: reflection, lessonsLearned: reflection, successRate: 0 });
        await onReward();
        setReflection('');
      }}>Save Weekly Reflection</button>
      <div className="grid grid-cols-2 gap-2">
        <input className="w-full" type="number" min={0} max={100} value={themeProgress} onChange={(e) => setThemeProgress(Number(e.target.value) || 0)} placeholder="Theme progress %" />
        <button className="px-3 py-2 rounded-lg bg-[var(--primary)]/20 text-[var(--primary)] text-xs" onClick={async () => {
          await db.themeProgress.add({ id: crypto.randomUUID(), month: new Date().getMonth() + 1, theme: tactic, completionPercent: themeProgress, drillsCompleted: Math.round(themeProgress / 20) });
          await onReward();
        }}>Save Theme</button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <input className="col-span-2 w-full" value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="Idea adoption tracker" />
        <button className="px-3 py-2 rounded-lg bg-[var(--primary)]/20 text-[var(--primary)] text-xs" onClick={async () => {
          await db.ideaAdoptions.add({ id: crypto.randomUUID(), date: new Date(), idea, adopted, adoptionDate: adopted ? new Date() : undefined });
          await onReward();
          setIdea('');
        }}>{adopted ? 'Adopted' : 'Attempt'}</button>
      </div>
      <label className="text-xs text-[var(--text-muted)] flex items-center gap-2">
        <input type="checkbox" checked={adopted} onChange={(e) => setAdopted(e.target.checked)} />
        Mark as adopted
      </label>
    </motion.div>
  );
}

function FailurePanel({ onReward }: { onReward: () => Promise<void> }) {
  const [challenge, setChallenge] = useState('');
  const [patch, setPatch] = useState('');
  const [calmMaintained, setCalmMaintained] = useState(false);
  const [bounceTrend, setBounceTrend] = useState<Array<{ idx: string; hours: number }>>([]);

  const loadTrend = useCallback(async () => {
    const rows = await db.failureCycles.orderBy('attemptDate').reverse().limit(10).toArray();
    setBounceTrend(rows.reverse().map((r, i) => ({ idx: `#${i + 1}`, hours: r.bounceBackHours || 0 })));
  }, []);

  useEffect(() => {
    void loadTrend();
  }, [loadTrend]);

  return (
    <motion.div className="glass rounded-xl p-4 space-y-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <input className="w-full" value={challenge} onChange={(e) => setChallenge(e.target.value)} placeholder="Challenge chosen" />
      <textarea className="w-full" rows={3} value={patch} onChange={(e) => setPatch(e.target.value)} placeholder="Patch plan..." />
      <button className="px-4 py-2 rounded-lg bg-[var(--primary)]/20 text-[var(--primary)]" onClick={async () => {
        await db.failureCycles.add({ id: crypto.randomUUID(), challenge, attemptDate: new Date(), attemptResult: 'failed', postMortem: '', patchPlan: patch, bounceBackHours: 24 });
        await onReward();
        setChallenge('');
        setPatch('');
        await loadTrend();
      }}>Save Failure Cycle (+20 XP)</button>
      <label className="text-xs text-[var(--text-muted)] flex items-center gap-2">
        <input type="checkbox" checked={calmMaintained} onChange={(e) => setCalmMaintained(e.target.checked)} />
        Chaos adaptation session calm maintained
      </label>
      <button className="px-4 py-2 rounded-lg bg-[var(--secondary)]/20 text-[var(--secondary)]" onClick={async () => {
        await db.chaosExposures.add({ id: crypto.randomUUID(), date: new Date(), environment: 'dynamic', actorsMapped: '', alliancesIdentified: '', calmMaintained, notes: '' });
        await onReward();
      }}>Log Chaos Session</button>
      {bounceTrend.length > 1 && (
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={bounceTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="idx" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="hours" stroke="var(--accent)" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.div>
  );
}

function JournalPanel({ onReward }: { onReward: () => Promise<void> }) {
  const [entry, setEntry] = useState('');
  const [whatChanged, setWhatChanged] = useState('');
  const [oneImprovement, setOneImprovement] = useState('');
  const [mood, setMood] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [stress, setStress] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [search, setSearch] = useState('');
  const [history, setHistory] = useState<Array<{ id: string; date: Date; whatIDid: string }>>([]);

  const loadHistory = useCallback(async () => {
    const rows = await db.journalEntries.orderBy('date').reverse().limit(20).toArray();
    setHistory(rows.map((r) => ({ id: r.id, date: r.date, whatIDid: r.whatIDid })));
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  return (
    <motion.div className="glass rounded-xl p-4 space-y-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <textarea className="w-full" rows={3} value={entry} onChange={(e) => setEntry(e.target.value)} placeholder="What I did today" />
      <textarea className="w-full" rows={2} value={whatChanged} onChange={(e) => setWhatChanged(e.target.value)} placeholder="What changed" />
      <textarea className="w-full" rows={2} value={oneImprovement} onChange={(e) => setOneImprovement(e.target.value)} placeholder="1 improvement" />
      <div className="grid grid-cols-2 gap-2">
        <select className="w-full" value={mood} onChange={(e) => setMood(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)}>
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Mood {n}</option>)}
        </select>
        <select className="w-full" value={stress} onChange={(e) => setStress(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)}>
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Stress {n}</option>)}
        </select>
      </div>
      <button className="px-4 py-2 rounded-lg bg-[var(--primary)]/20 text-[var(--primary)]" onClick={async () => {
        await db.journalEntries.add({ id: crypto.randomUUID(), date: new Date(), whatIDid: entry, whatChanged, oneImprovement, mood, stress, linkedTasks: [] });
        await onReward();
        setEntry('');
        setWhatChanged('');
        setOneImprovement('');
        await loadHistory();
      }}>Save Journal (+10 XP)</button>
      <input className="w-full" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search old logs..." />
      <div className="max-h-40 overflow-y-auto space-y-2">
        {history
          .filter((h) => h.whatIDid.toLowerCase().includes(search.toLowerCase()))
          .map((h) => (
            <div key={h.id} className="p-2 rounded-lg bg-black/20">
              <p className="text-[10px] text-[var(--text-muted)]">{new Date(h.date).toLocaleDateString()}</p>
              <p className="text-xs text-[var(--text)]">{h.whatIDid}</p>
            </div>
          ))}
      </div>
    </motion.div>
  );
}

function SettingsPanel(props: {
  currentTheme: 'cote' | 'solo-leveling' | 'hybrid';
  onTheme: (theme: 'cote' | 'solo-leveling' | 'hybrid') => Promise<void>;
  onExport: () => Promise<string>;
  onImport: (jsonData: string) => Promise<void>;
  onReset: () => Promise<void>;
}) {
  return (
    <motion.div className="glass rounded-xl p-4 space-y-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="flex gap-2">
        {(['cote', 'solo-leveling', 'hybrid'] as const).map((t) => (
          <button key={t} className={`px-3 py-2 rounded-lg ${props.currentTheme === t ? 'bg-[var(--primary)]/20 text-[var(--primary)]' : 'bg-black/20 text-[var(--text-muted)]'}`} onClick={() => void props.onTheme(t)}>{t}</button>
        ))}
      </div>
      <button className="px-4 py-2 rounded-lg bg-[var(--primary)]/20 text-[var(--primary)]" onClick={async () => {
        const json = await props.onExport();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'hybrid-system-backup.json';
        a.click();
        URL.revokeObjectURL(url);
      }}>Export Backup</button>
      <label className="px-4 py-2 rounded-lg bg-black/20 text-[var(--text)] inline-block cursor-pointer">
        Import Backup
        <input type="file" accept="application/json" className="hidden" onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const text = await file.text();
          await props.onImport(text);
        }} />
      </label>
      <button className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400" onClick={() => void props.onReset()}>Reset Progress</button>
    </motion.div>
  );
}
