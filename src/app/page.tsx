'use client';
import { useState, useEffect, useRef } from 'react';
import AppShell from '@/components/AppShell';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

interface Stats { notes: number; tasks: number | null; events: number | null; workspaces: number; }
interface Note  { id: string; title: string; content_md: string; workspace_id: string; is_pinned: boolean; updated_at: string; }
interface Task  { id: string; title: string; status: string; priority: string; }

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (d < 60) return 'just now';
  if (d < 3600) return `${Math.floor(d/60)}m ago`;
  if (d < 86400) return `${Math.floor(d/3600)}h ago`;
  return `${Math.floor(d/86400)}d ago`;
}

const PRIORITY_COLOR: Record<string, string> = {
  urgent: 'bg-[var(--color-error)]', high: 'bg-amber-500', medium: 'bg-[var(--color-primary)]', low: 'bg-[var(--color-outline)]',
};

export default function HomePage() {
  const { user, role, primaryWorkspace } = useAuth();
  const [stats,  setStats]  = useState<Stats | null>(null);
  const [notes,  setNotes]  = useState<Note[]>([]);
  const [tasks,  setTasks]  = useState<Task[]>([]);
  const [capture, setCapture] = useState('');
  const [saving,  setSaving]  = useState(false);
  const captureRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    api.get<{ success: boolean; data: Stats }>('/stats').then(r => setStats(r.data)).catch(() => {});
    api.get<{ success: boolean; data: Note[] }>('/notes').then(r => setNotes(r.data?.slice(0, 4) ?? [])).catch(() => {});
    if (role === 'super_admin') {
      api.get<{ success: boolean; data: Task[] }>('/tasks').then(r => setTasks(r.data?.slice(0, 4) ?? [])).catch(() => {});
    }
  }, [role]);

  const saveCapture = async () => {
    if (!capture.trim() || !primaryWorkspace) return;
    setSaving(true);
    try {
      const title = capture.split('\n')[0].slice(0, 60) || 'Quick Note';
      await api.post('/notes', { title, content_md: capture, workspace_id: primaryWorkspace.id });
      setCapture('');
      const r = await api.get<{ success: boolean; data: Note[] }>('/notes');
      setNotes(r.data?.slice(0, 4) ?? []);
      const s = await api.get<{ success: boolean; data: Stats }>('/stats');
      setStats(s.data);
    } catch {}
    setSaving(false);
  };

  const STAT_CARDS = [
    { icon: 'description', label: 'Notes',      value: stats?.notes      ?? '—', sub: 'Total'         },
    { icon: 'check_circle',label: 'Tasks',       value: stats?.tasks      ?? '—', sub: 'Open'          },
    { icon: 'calendar_month', label: 'Events',   value: stats?.events     ?? '—', sub: 'Upcoming'      },
    { icon: 'folder_open', label: 'Workspaces',  value: stats?.workspaces ?? '—', sub: 'Active'        },
  ].filter(c => {
    if (c.label === 'Tasks' && role !== 'super_admin') return false;
    if (c.label === 'Events' && role !== 'super_admin') return false;
    return true;
  });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <AppShell>
      {/* Greeting */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--color-on-surface)]">{greeting}, {user?.display_name ?? '…'}.</h1>
        <p className="text-[12px] uppercase tracking-widest text-[var(--color-outline)] mt-1">
          {new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' }).toUpperCase()}
          {primaryWorkspace && ` // ${primaryWorkspace.name}`}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        <div className="space-y-6">
          {/* Stats */}
          <div className={`grid grid-cols-2 ${STAT_CARDS.length >= 4 ? 'md:grid-cols-4' : 'md:grid-cols-2'} gap-3`}>
            {STAT_CARDS.map(c => (
              <div key={c.label} className="bg-[var(--color-surface-pure)] rounded-lg p-4 shadow-[0_1px_24px_rgba(49,51,46,0.05)]">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="mi text-[15px] text-[var(--color-primary)]">{c.icon}</span>
                  <p className="text-[10px] uppercase tracking-widest font-semibold text-[var(--color-on-surface-var)]">{c.label}</p>
                </div>
                <p className="text-3xl font-bold tracking-tight text-[var(--color-on-surface)]">{stats ? c.value : <span className="text-xl text-[var(--color-outline)]">…</span>}</p>
                <p className="text-[11px] text-[var(--color-primary)] mt-1">{c.sub}</p>
              </div>
            ))}
          </div>

          {/* Quick capture */}
          <div className="bg-[var(--color-surface-pure)] rounded-lg p-5 shadow-[0_1px_24px_rgba(49,51,46,0.05)]">
            <div className="flex items-center gap-2 mb-3">
              <span className="mi text-[14px] text-[var(--color-primary)]">bolt</span>
              <p className="text-[10px] uppercase tracking-widest font-semibold text-[var(--color-on-surface-var)]">Quick Capture</p>
            </div>
            <textarea id="quick-capture" ref={captureRef} rows={3}
              className="w-full bg-transparent text-[13.5px] text-[var(--color-on-surface)] placeholder:text-[var(--color-outline)] outline-none resize-none leading-relaxed"
              placeholder="Capture a thought, idea, or link…"
              value={capture} onChange={e => setCapture(e.target.value)} />
            <div className="flex justify-end mt-2">
              <button id="capture-save-btn" onClick={saveCapture} disabled={saving || !capture.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-surface-mid)] text-[var(--color-on-surface)] text-[12.5px] font-medium rounded-[var(--radius-md)] hover:bg-[var(--color-surface-high)] transition-colors disabled:opacity-50">
                <span className="mi text-[14px]">save</span>{saving ? 'Saving…' : 'Save Note'}
              </button>
            </div>
          </div>

          {/* Recent Notes */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] font-semibold text-[var(--color-on-surface)]">Recent Intel</p>
              <a href="/workspace" className="flex items-center gap-1 text-[11.5px] text-[var(--color-on-surface-var)] hover:text-[var(--color-primary)] transition-colors">
                View all <span className="mi text-[14px]">arrow_forward</span>
              </a>
            </div>
            {notes.length === 0 ? (
              <div className="bg-[var(--color-surface-pure)] rounded-lg p-8 text-center shadow-[0_1px_24px_rgba(49,51,46,0.05)]">
                <span className="mi text-3xl text-[var(--color-outline)]">description</span>
                <p className="text-[13px] text-[var(--color-on-surface-var)] mt-2">No notes yet. Use Quick Capture above.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {notes.map(n => (
                  <a key={n.id} href={`/workspace?note=${n.id}`}
                    className="bg-[var(--color-surface-pure)] rounded-lg p-4 shadow-[0_1px_24px_rgba(49,51,46,0.05)] hover:bg-[var(--color-surface-low)] transition-colors block">
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-[var(--radius-md)] bg-[var(--color-secondary-cnt)] text-[var(--color-on-secondary-cnt)]">Note</span>
                      <span className="mi text-[13px] text-[var(--color-outline)]">open_in_new</span>
                    </div>
                    <p className="text-[13.5px] font-semibold text-[var(--color-on-surface)] leading-snug mb-1 line-clamp-2">{n.title}</p>
                    <p className="text-[11px] text-[var(--color-on-surface-var)] line-clamp-2 mb-2">{n.content_md.replace(/[#*`>_]/g, '').slice(0, 80)}</p>
                    <p className="text-[10.5px] text-[var(--color-outline)] uppercase tracking-wider">{timeAgo(n.updated_at)}</p>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Focus tasks — super_admin only */}
          {role === 'super_admin' && (
            <div className="bg-[var(--color-surface-pure)] rounded-lg p-4 shadow-[0_1px_24px_rgba(49,51,46,0.05)]">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] uppercase tracking-widest font-semibold text-[var(--color-on-surface-var)]">Focus Protocol</p>
                <a href="/tasks" className="text-[11px] text-[var(--color-on-surface-var)] hover:text-[var(--color-primary)]">All tasks</a>
              </div>
              {tasks.length === 0 ? (
                <p className="text-[12.5px] text-[var(--color-outline)] py-2 text-center">No open tasks.</p>
              ) : (
                tasks.map(t => (
                  <div key={t.id} className="flex items-center gap-3 py-2 border-b border-[var(--color-surface-high)] last:border-0">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_COLOR[t.priority]}`} />
                    <p className={`text-[12.5px] flex-1 truncate ${t.status === 'done' ? 'line-through text-[var(--color-outline)]' : 'text-[var(--color-on-surface)]'}`}>{t.title}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Workspace info */}
          {primaryWorkspace && (
            <div className="bg-[var(--color-surface-pure)] rounded-lg p-4 shadow-[0_1px_24px_rgba(49,51,46,0.05)]">
              <p className="text-[10px] uppercase tracking-widest font-semibold text-[var(--color-on-surface-var)] mb-2">Your Workspace</p>
              <div className="flex items-center gap-2.5">
                <span className="text-xl">{primaryWorkspace.icon}</span>
                <div>
                  <p className="text-[13px] font-semibold text-[var(--color-on-surface)]">{primaryWorkspace.name}</p>
                  <p className="text-[11px] text-[var(--color-outline)]">{primaryWorkspace.slug}</p>
                </div>
              </div>
            </div>
          )}

          {/* Void stats */}
          <div className="bg-[var(--color-inverse-surface)] rounded-lg p-4">
            <p className="text-[10px] uppercase tracking-widest font-semibold text-[var(--color-inverse-on)] mb-3">Void Stats</p>
            {[['Uptime', '99.9%'], ['Sync Status', 'Active']].map(([k, v]) => (
              <div key={k} className="flex justify-between py-1.5 border-b border-white/5 last:border-0">
                <span className="text-[11.5px] text-[var(--color-inverse-on)]">{k}</span>
                <span className="text-[11.5px] font-semibold text-white">{v}</span>
              </div>
            ))}
            <pre className="mt-3 text-[10px] text-emerald-400 font-mono leading-relaxed">{'archive.init({\n  mode: \'STEALTH\',\n  sync: true\n});'}</pre>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
