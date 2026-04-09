import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, User, Settings, Palette, Database, FileText, X } from 'lucide-react';
import { useAppStore } from '@/store';
import type { ThemeType } from '@/types';

export function SideMenu() {
  const [open, setOpen] = useState(false);
  const { profile, setTheme, exportData, importData, setCurrentTab } = useAppStore();
  if (!profile) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed top-4 left-4 z-[70] p-2 rounded-lg border border-[var(--border)] bg-[var(--surface)]/80 text-[var(--text)]"
      >
        <Menu className="w-5 h-5" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            <motion.aside
              className="h-full w-[82%] max-w-xs glass p-4 border-r border-[var(--border)]"
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-[var(--text)]">System Menu</h2>
                <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-white/10">
                  <X className="w-4 h-4 text-[var(--text-muted)]" />
                </button>
              </div>

              <div className="space-y-2">
                <button className="w-full text-left p-3 rounded-lg bg-black/20 text-[var(--text)] text-sm flex items-center gap-2">
                  <User className="w-4 h-4 text-[var(--primary)]" />
                  Profile: {profile.username}
                </button>
                <button
                  className="w-full text-left p-3 rounded-lg bg-black/20 text-[var(--text)] text-sm flex items-center gap-2"
                  onClick={() => {
                    setCurrentTab('settings');
                    setOpen(false);
                  }}
                >
                  <Settings className="w-4 h-4 text-[var(--primary)]" />
                  Settings
                </button>

                <div className="p-3 rounded-lg bg-black/20 text-sm">
                  <div className="flex items-center gap-2 text-[var(--text)] mb-2">
                    <Palette className="w-4 h-4 text-[var(--primary)]" />
                    Themes
                  </div>
                  <div className="flex gap-2">
                    {(['cote', 'solo-leveling', 'hybrid'] as ThemeType[]).map((theme) => (
                      <button
                        key={theme}
                        className="px-2 py-1 rounded text-xs bg-[var(--primary)]/20 text-[var(--primary)]"
                        onClick={() => void setTheme(theme)}
                      >
                        {theme}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  className="w-full text-left p-3 rounded-lg bg-black/20 text-[var(--text)] text-sm flex items-center gap-2"
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
                  <Database className="w-4 h-4 text-[var(--primary)]" />
                  Export Backup
                </button>
                <label className="w-full text-left p-3 rounded-lg bg-black/20 text-[var(--text)] text-sm flex items-center gap-2 cursor-pointer">
                  <Database className="w-4 h-4 text-[var(--primary)]" />
                  Import Backup
                  <input
                    type="file"
                    accept="application/json"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const text = await file.text();
                      await importData(text);
                      setOpen(false);
                    }}
                  />
                </label>

                <div className="p-3 rounded-lg bg-black/20 text-xs text-[var(--text-muted)]">
                  <div className="flex items-center gap-2 text-[var(--text)] mb-1">
                    <FileText className="w-4 h-4 text-[var(--primary)]" />
                    Plan Documentation
                  </div>
                  12-Month Hybrid Plan (2-4-6): Stage 1 Foundation, Stage 2 Strategy and Control, Stage 3 High-Stakes Adaptation.
                </div>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
