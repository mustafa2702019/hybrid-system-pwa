import { useEffect, useState } from 'react';
import { useAppStore } from '@/store';
import type { ThemeType } from '@/types';
import { setCharacterAsset } from '@/lib/characterAssets';
import { sendSystemNotification } from '@/utils/notifications';
import { STAGE_CONFIG } from '@/constants';
import { db } from '@/db';

export function SettingsPage() {
  const [message, setMessage] = useState('');
  const {
    profile,
    xpData,
    forceStage,
    forceWeek,
    advanceWeek,
    calculateWeeklyStats,
    updateProfileSettings,
    setTheme,
    exportData,
    importData,
    resetProgress,
  } = useAppStore();
  const [spentCoins, setSpentCoins] = useState<number>(() => {
    const raw = localStorage.getItem('hybrid-shop-spent');
    return raw ? Number(raw) || 0 : 0;
  });
  const [unlockMap, setUnlockMap] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem('hybrid-shop-unlocks');
      return raw ? JSON.parse(raw) as Record<string, boolean> : {};
    } catch {
      return {};
    }
  });
  const [equippedMap, setEquippedMap] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem('hybrid-shop-equipped');
      return raw ? JSON.parse(raw) as Record<string, boolean> : {};
    } catch {
      return {};
    }
  });
  const [notificationRows, setNotificationRows] = useState<Array<{ id: string; type: string; enabled: boolean; time: string }>>([]);
  const [now, setNow] = useState(new Date());
  const [notifPermission, setNotifPermission] = useState<string>('unsupported');

  useEffect(() => {
    const load = async () => {
      const rows = await db.notifications.toArray();
      setNotificationRows(rows.map((r) => ({ id: r.id, type: r.type, enabled: r.enabled, time: r.time })));
    };
    void load();
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    if ('Notification' in window) {
      setNotifPermission(Notification.permission);
    }
    return () => window.clearInterval(id);
  }, []);

  if (!profile) {
    return (
      <div className="min-h-screen p-4 pb-24">
        <p className="text-sm text-[var(--text-muted)]">Settings unavailable before onboarding.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 pb-24">
      <h1 className="text-2xl font-bold mb-4" style={{ fontFamily: 'var(--font-heading)' }}>
        <span className="text-[var(--primary)]">SYSTEM</span> <span className="text-[var(--text)]">SETTINGS</span>
      </h1>

      {message && (
        <div className="glass rounded-lg p-3 mb-3 text-xs text-[var(--primary)]">{message}</div>
      )}

      <div className="glass rounded-xl p-4 space-y-4">
        <div>
          <p className="text-xs text-[var(--text-muted)] mb-2">Hunter Name</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={profile.username}
              onChange={(e) => void updateProfileSettings({ username: e.target.value.trimStart() })}
              placeholder="Hunter name"
              className="flex-1"
            />
          </div>
          <p className="text-[10px] text-[var(--text-muted)] mt-1">
            Used across dashboard greetings, reports, and system messages.
          </p>
        </div>

        <div>
          <p className="text-xs text-[var(--text-muted)] mb-2">Theme</p>
          <div className="flex gap-2">
            {(['cote', 'solo-leveling', 'hybrid'] as ThemeType[]).map((theme) => (
              <button
                key={theme}
                onClick={async () => {
                  await setTheme(theme);
                  setMessage(`Theme changed to ${theme}`);
                }}
                className={`px-3 py-2 rounded-lg text-xs ${
                  profile.theme === theme
                    ? 'bg-[var(--primary)]/20 text-[var(--primary)]'
                    : 'bg-black/20 text-[var(--text-muted)]'
                }`}
              >
                {theme}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs text-[var(--text-muted)] mb-2">Current Stage</p>
          <p className="text-sm text-[var(--primary)]">Stage {profile.currentStage}</p>
          <p className="text-[10px] text-[var(--text-muted)] mt-1">
            {STAGE_CONFIG[profile.currentStage].name}
          </p>
        </div>

        <div>
          <p className="text-xs text-[var(--text-muted)] mb-2">Manual Stage Override (Admin)</p>
          <div className="flex gap-2">
            {([1, 2, 3] as const).map((s) => (
              <button
                key={s}
                className={`px-3 py-2 rounded-lg text-xs ${
                  profile.currentStage === s
                    ? 'bg-[var(--primary)]/20 text-[var(--primary)]'
                    : 'bg-black/20 text-[var(--text-muted)]'
                }`}
                onClick={async () => {
                  await forceStage(s);
                  setMessage(`Manual override applied: Stage ${s}`);
                }}
              >
                Stage {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs text-[var(--text-muted)] mb-2">Manual Week Override (Admin)</p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={52}
              value={profile.currentWeek}
              onChange={(e) => void forceWeek(Number(e.target.value) || 1)}
              className="w-full"
            />
            <button
              className="px-3 py-2 rounded-lg bg-[var(--primary)]/20 text-[var(--primary)] text-xs"
              onClick={() => void forceWeek(profile.currentWeek + 1)}
            >
              +1
            </button>
            <button
              className="px-3 py-2 rounded-lg bg-[var(--secondary)]/20 text-[var(--secondary)] text-xs"
              onClick={async () => {
                await calculateWeeklyStats(profile.currentWeek);
                await advanceWeek();
                setMessage(`Week advanced to ${Math.min(52, profile.currentWeek + 1)} with weekly scoring snapshot saved.`);
              }}
            >
              End Week
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Toggle
            label="Notifications"
            checked={profile.notificationsEnabled}
            onChange={async (value) => {
              await updateProfileSettings({ notificationsEnabled: value });
              setMessage(`Notifications ${value ? 'enabled' : 'disabled'}`);
            }}
          />
          <Toggle
            label="Sound"
            checked={profile.soundEnabled}
            onChange={async (value) => {
              await updateProfileSettings({ soundEnabled: value });
              setMessage(`Sound ${value ? 'enabled' : 'disabled'}`);
            }}
          />
          <Toggle
            label="Vibration"
            checked={profile.vibrationEnabled}
            onChange={async (value) => {
              await updateProfileSettings({ vibrationEnabled: value });
              setMessage(`Vibration ${value ? 'enabled' : 'disabled'}`);
            }}
          />
          <Toggle
            label="Hardcore"
            checked={profile.hardcoreMode}
            onChange={async (value) => {
              await updateProfileSettings({ hardcoreMode: value });
              setMessage(`Hardcore ${value ? 'enabled' : 'disabled'}`);
            }}
          />
        </div>
        {profile.hardcoreMode && (
          <div className="rounded-lg p-3 border border-red-500/40 bg-red-500/10">
            <p className="text-xs text-red-400">Hardcore Mode: Recovery tokens are disabled by design.</p>
          </div>
        )}

        <div>
          <p className="text-xs text-[var(--text-muted)] mb-2">Notification Schedule</p>
          <div className="space-y-2">
            {notificationRows.map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-2 rounded-lg p-2 bg-black/20">
                <span className="text-xs text-[var(--text)] capitalize">{row.type}</span>
                <input
                  type="time"
                  value={row.time}
                  onChange={async (e) => {
                    const nextTime = e.target.value;
                    await db.notifications.update(row.id, { time: nextTime });
                    setNotificationRows((prev) => prev.map((item) => item.id === row.id ? { ...item, time: nextTime } : item));
                  }}
                  className="text-xs"
                />
                <button
                  className={`px-2 py-1 rounded text-[10px] ${row.enabled ? 'bg-[var(--primary)]/20 text-[var(--primary)]' : 'bg-black/30 text-[var(--text-muted)]'}`}
                  onClick={async () => {
                    const nextEnabled = !row.enabled;
                    await db.notifications.update(row.id, { enabled: nextEnabled });
                    setNotificationRows((prev) => prev.map((item) => item.id === row.id ? { ...item, enabled: nextEnabled } : item));
                  }}
                >
                  {row.enabled ? 'ON' : 'OFF'}
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-lg p-3 bg-black/20">
            <p className="text-xs text-[var(--text-muted)]">Notification Debug</p>
            <p className="text-[11px] text-[var(--text-muted)] mt-1">Permission: <span className="text-[var(--text)]">{notifPermission}</span></p>
            <p className="text-[11px] text-[var(--text-muted)]">Current Time: <span className="text-[var(--text)]">{now.toLocaleTimeString()}</span></p>
            <p className="text-[11px] text-[var(--text-muted)]">Current HH:mm: <span className="text-[var(--text)]">{`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`}</span></p>
            <div className="mt-2 space-y-1">
              {notificationRows.filter((r) => r.enabled).map((r) => {
                const dayKey = now.toISOString().slice(0, 10);
                const dedupeKey = `hybrid-notified-${r.type}-${dayKey}-${r.time}`;
                const fired = !!localStorage.getItem(dedupeKey);
                return (
                  <p key={r.id} className="text-[11px] text-[var(--text-muted)]">
                    {r.type} @ {r.time} - <span className={fired ? 'text-emerald-400' : 'text-amber-400'}>{fired ? 'fired' : 'pending today'}</span>
                  </p>
                );
              })}
            </div>
          </div>
          <button
            className="mt-3 px-3 py-2 rounded-lg bg-[var(--primary)]/20 text-[var(--primary)] text-xs"
            onClick={async () => {
              if (!('Notification' in window)) {
                setMessage('Notifications not supported in this browser.');
                return;
              }
              if (Notification.permission !== 'granted') {
                const p = await Notification.requestPermission();
                setNotifPermission(p);
                if (p !== 'granted') {
                  setMessage('Permission not granted for notifications.');
                  return;
                }
              }

              const nowDate = new Date();
              nowDate.setMinutes(nowDate.getMinutes() + 1);
              const hh = String(nowDate.getHours()).padStart(2, '0');
              const mm = String(nowDate.getMinutes()).padStart(2, '0');
              const time = `${hh}:${mm}`;
              const existing = await db.notifications.get('wake');
              if (existing) {
                await db.notifications.update('wake', { enabled: true, time });
                setNotificationRows((prev) => prev.map((r) => r.id === 'wake' ? { ...r, enabled: true, time } : r));
              }
              setMessage(`Test reminder scheduled for ${time}. Keep app open for 1 minute.`);
            }}
          >
            Schedule Test Reminder (+1 min)
          </button>
        </div>

        <button
          className="px-3 py-2 rounded-lg bg-[var(--secondary)]/20 text-[var(--secondary)] text-xs"
          onClick={async () => {
            const result = await sendSystemNotification(
              'Hybrid System',
              'Notifications are active.'
            );
            if (result.ok) {
              setMessage('Notification sent successfully.');
              return;
            }
            if (result.reason === 'unsupported') {
              setMessage('This browser does not support notifications.');
              return;
            }
            if (result.reason === 'denied') {
              setMessage('Notifications are blocked. Enable them in browser site settings.');
              return;
            }
            if (result.reason === 'blocked') {
              setMessage('Notification permission was not granted.');
              return;
            }
            setMessage('Could not send notification in this context.');
          }}
        >
          Test Notification
        </button>

        <div className="flex flex-wrap gap-2">
          <label className="px-3 py-2 rounded-lg bg-black/20 text-[var(--text)] text-xs cursor-pointer">
            Upload Ayanokoji Photo
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setCharacterAsset('ayanokoji', await fileToDataUrl(file));
                setMessage('Ayanokoji photo updated');
              }}
            />
          </label>
          <label className="px-3 py-2 rounded-lg bg-black/20 text-[var(--text)] text-xs cursor-pointer">
            Upload Jinwoo Photo
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setCharacterAsset('jinwoo', await fileToDataUrl(file));
                setMessage('Jinwoo photo updated');
              }}
            />
          </label>

          <button
            className="px-3 py-2 rounded-lg bg-[var(--primary)]/20 text-[var(--primary)] text-xs"
            onClick={async () => {
              const json = await exportData();
              const blob = new Blob([json], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'hybrid-system-backup.json';
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Export Backup
          </button>

          <label className="px-3 py-2 rounded-lg bg-black/20 text-[var(--text)] text-xs cursor-pointer">
            Import Backup
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                await importData(await file.text());
                setMessage('Backup imported');
              }}
            />
          </label>

          <button
            className="px-3 py-2 rounded-lg bg-red-500/20 text-red-400 text-xs"
            onClick={() => void resetProgress()}
          >
            Reset Progress
          </button>
        </div>
      </div>

      <div className="glass rounded-xl p-4 space-y-3 mt-4">
        <h2 className="text-sm font-medium text-[var(--text)]">Reward Shop</h2>
        <p className="text-xs text-[var(--text-muted)]">
          Spend XP coins to unlock cinematic assets and style packs.
        </p>
        <p className="text-xs text-[var(--primary)] font-mono">
          Coins: {Math.max(0, Math.floor((xpData?.totalXP || 0) / 10) - spentCoins)}
        </p>
        <ShopRow
          id="theme-pack-shadow"
          name="Shadow Theme Pack"
          cost={120}
          totalXP={xpData?.totalXP || 0}
          spentCoins={spentCoins}
          setSpentCoins={setSpentCoins}
          unlockMap={unlockMap}
          setUnlockMap={setUnlockMap}
          equippedMap={equippedMap}
          setEquippedMap={setEquippedMap}
          setMessage={setMessage}
        />
        <ShopRow
          id="aura-pack-neon"
          name="Neon Aura Background"
          cost={90}
          totalXP={xpData?.totalXP || 0}
          spentCoins={spentCoins}
          setSpentCoins={setSpentCoins}
          unlockMap={unlockMap}
          setUnlockMap={setUnlockMap}
          equippedMap={equippedMap}
          setEquippedMap={setEquippedMap}
          setMessage={setMessage}
        />
        <ShopRow
          id="sfx-pack-system"
          name="System SFX Pack"
          cost={60}
          totalXP={xpData?.totalXP || 0}
          spentCoins={spentCoins}
          setSpentCoins={setSpentCoins}
          unlockMap={unlockMap}
          setUnlockMap={setUnlockMap}
          equippedMap={equippedMap}
          setEquippedMap={setEquippedMap}
          setMessage={setMessage}
        />
      </div>

      <div className="glass rounded-xl p-4 space-y-2 mt-4">
        <h2 className="text-sm font-medium text-[var(--text)]">Plan Documentation</h2>
        <p className="text-xs text-[var(--text-muted)]">
          12-Month Hybrid Plan (2-4-6): Stage 1 Foundation (Weeks 1-12, early exit Week 5-6), Stage 2 Strategy & Control (Weeks 13-28), Stage 3 High-Stakes Adaptation (Weeks 29-52).
        </p>
        <p className="text-xs text-[var(--text-muted)]">
          Stage progression requires two consecutive passing weeks under stage-specific score and metric gates.
        </p>
      </div>
    </div>
  );
}

function ShopRow({
  id,
  name,
  cost,
  totalXP,
  spentCoins,
  setSpentCoins,
  unlockMap,
  setUnlockMap,
  equippedMap,
  setEquippedMap,
  setMessage
}: {
  id: string;
  name: string;
  cost: number;
  totalXP: number;
  spentCoins: number;
  setSpentCoins: (value: number) => void;
  unlockMap: Record<string, boolean>;
  setUnlockMap: (value: Record<string, boolean>) => void;
  equippedMap: Record<string, boolean>;
  setEquippedMap: (value: Record<string, boolean>) => void;
  setMessage: (value: string) => void;
}) {
  const owned = !!unlockMap[id];
  const equipped = !!equippedMap[id];
  const baseCoins = Math.floor(totalXP / 10);
  const available = Math.max(0, baseCoins - spentCoins);
  const canBuy = available >= cost && !owned;

  return (
    <div className="flex items-center justify-between rounded-lg p-3 bg-black/20">
      <div>
        <p className="text-xs text-[var(--text)]">{name}</p>
        <p className="text-[10px] text-[var(--text-muted)]">Cost: {cost} XP coins</p>
      </div>
      <button
        disabled={!canBuy && !owned}
        onClick={() => {
          if (owned) {
            const nextEquipped: Record<string, boolean> = { ...equippedMap };
            Object.keys(nextEquipped).forEach((k) => {
              if (k.includes(id.split('-')[0])) nextEquipped[k] = false;
            });
            nextEquipped[id] = !equipped;
            localStorage.setItem('hybrid-shop-equipped', JSON.stringify(nextEquipped));
            setEquippedMap(nextEquipped);
            setMessage(`${name} ${nextEquipped[id] ? 'equipped' : 'unequipped'}`);
            return;
          }
          if (available < cost) {
            setMessage(`Insufficient coins for ${name}`);
            return;
          }
          const nextSpent = spentCoins + cost;
          const nextUnlocks = { ...unlockMap, [id]: true };
          localStorage.setItem('hybrid-shop-spent', String(nextSpent));
          localStorage.setItem('hybrid-shop-unlocks', JSON.stringify(nextUnlocks));
          setSpentCoins(nextSpent);
          setUnlockMap(nextUnlocks);
          setMessage(`${name} unlocked`);
        }}
        className={`px-3 py-2 rounded-lg text-xs ${
          owned
            ? equipped
              ? 'bg-[var(--primary)]/20 text-[var(--primary)]'
              : 'bg-emerald-500/20 text-emerald-300'
            : canBuy
              ? 'bg-[var(--primary)]/20 text-[var(--primary)]'
              : 'bg-black/30 text-[var(--text-muted)]'
        }`}
      >
        {owned ? (equipped ? 'Equipped' : 'Equip') : 'Purchase'}
      </button>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void | Promise<void>;
}) {
  return (
    <button
      onClick={() => void onChange(!checked)}
      className={`rounded-lg p-2 text-left ${checked ? 'bg-[var(--primary)]/15 border border-[var(--primary)]/40' : 'bg-black/20 border border-transparent'}`}
    >
      <p className="text-xs text-[var(--text)]">{label}</p>
      <p className="text-[10px] text-[var(--text-muted)]">{checked ? 'Enabled' : 'Disabled'}</p>
    </button>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
