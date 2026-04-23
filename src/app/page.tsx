'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import CalendarEventModal, { apiToCalEvent, type ApiEvent } from '@/components/CalendarEventModal';
import TimeBanner from '@/components/TimeBanner';
import InlineChat from '@/components/InlineChat';
import { FileText, CheckSquare, ChevronRight, Pin, Clock, ArrowUpRight, Circle } from 'lucide-react';
import WorkspaceIcon from '@/components/WorkspaceIcon';

interface Note      { id: string; title: string; content_md: string; workspace_id: string; is_pinned: boolean; updated_at: string; }
interface Workspace { id: string; name: string; slug: string; icon: string; color: string; }
interface Task      { id: string; title: string; status: string; priority: string; }
type HomeCalEvent = { id: string; title: string; date: number; type: string; color: string; workspace_id?: string | null; start_time: string; end_time: string; };

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (d < 60)    return 'just now';
  if (d < 3600)  return `${Math.floor(d/60)}m ago`;
  if (d < 86400) return `${Math.floor(d/3600)}h ago`;
  return `${Math.floor(d/86400)}d ago`;
}

const PRIORITY_DOT: Record<string, string> = {
  urgent: 'bg-red-500', high: 'bg-amber-500',
  medium: 'bg-[var(--color-primary)]', low: 'bg-[var(--color-outline)]',
};

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS     = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ── Mini Calendar ────────────────────────────────────────────────
interface MiniCalendarProps {
  events: HomeCalEvent[];
  canAddEvents: boolean;
  onDayClick: (day: number) => void;
}
function MiniCalendar({ events, canAddEvents, onDayClick }: MiniCalendarProps) {
  const now   = new Date();
  const today = now.getDate();
  const year  = now.getFullYear();
  const month = now.getMonth();

  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const eventDays = new Set(
    events.map(e => e.date)
  );

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div>
      <div className="grid grid-cols-7 mb-1.5">
        {DAYS_SHORT.map(d => (
          <div key={d} className="text-center text-[9px] font-bold uppercase tracking-wider text-[var(--color-outline)] py-1">
            {d[0]}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />;
          const isToday  = day === today;
          const hasEvent = eventDays.has(day);
          const clickable = canAddEvents;
          return (
            <div key={day} className="flex flex-col items-center">
              <button
                onClick={() => clickable && onDayClick(day)}
                title={clickable ? 'Click to add event' : undefined}
                className={`w-7 h-7 flex items-center justify-center rounded-full text-[11px] font-medium transition-colors ${
                  isToday
                    ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)] font-bold'
                    : clickable
                      ? 'text-[var(--color-on-surface-var)] hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)] cursor-pointer'
                      : 'text-[var(--color-on-surface-var)]'
                }`}
              >
                {day}
              </button>
              {hasEvent && (
                <div className={`w-1 h-1 rounded-full mt-0.5 ${isToday ? 'bg-[var(--color-on-primary)]' : 'bg-[var(--color-primary)]'}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────
export default function HomePage() {
  const { user, role } = useAuth();
  const [notes,      setNotes]      = useState<Note[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [tasks,      setTasks]      = useState<Task[]>([]);
  const [events,       setEvents]      = useState<HomeCalEvent[]>([]);
  const [mounted,      setMounted]     = useState(false);
  const [addEventDay,  setAddEventDay] = useState<number | null>(null);
  const [greeting,     setGreeting]    = useState('Good morning');

  const canManageEvents = mounted && role && ['admin', 'super_admin'].includes(role);

  useEffect(() => {
    setMounted(true);
    api.get<{ success: boolean; data: Note[] }>('/notes')
      .then(r => setNotes(r.data?.slice(0, 6) ?? [])).catch(() => {});
    api.get<{ success: boolean; data: Workspace[] }>('/workspaces')
      .then(r => setWorkspaces(r.data ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (role && ['admin', 'super_admin'].includes(role)) {
      api.get<{ success: boolean; data: Task[] }>('/tasks')
        .then(r => setTasks(r.data?.filter(t => t.status !== 'done').slice(0, 5) ?? [])).catch(() => {});
      api.get<{ success: boolean; data: ApiEvent[] }>('/calendar')
        .then(r => {
          const mapped = (r.data ?? [])
            .map(e => apiToCalEvent(e, now.getFullYear(), now.getMonth()))
            .filter(Boolean) as HomeCalEvent[];
          setEvents(mapped);
        }).catch(() => {});
    }
  }, [role, mounted]);

  const now = new Date();
  // greeting is driven by TimeBanner via onGreeting callback (falls back to hour-based)
  const hour = now.getHours();
  if (!mounted) { /* greeting already set */ }

  const upcomingEvents = events
    .filter(e => new Date(e.start_time) >= new Date(now.toDateString()))
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    .slice(0, 6);

  const tasksByStatus = {
    todo:        tasks.filter(t => t.status === 'todo').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
  };

  return (
    <AppShell glassBg>
      {/* Add Event Modal — same modal as /calendar page */}
      {addEventDay !== null && (
        <CalendarEventModal
          year={now.getFullYear()}
          month={now.getMonth()}
          editingEvent={null}
          initialDay={addEventDay}
          workspaces={workspaces}
          onClose={() => setAddEventDay(null)}
          onSaved={raw => {
            const mapped = apiToCalEvent(raw, now.getFullYear(), now.getMonth());
            if (mapped) setEvents(prev => [...prev, mapped]);
          }}
        />
      )}

      {/* Time-reactive sky banner */}
      <TimeBanner onGreeting={setGreeting} />

      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-[24px] font-bold tracking-tight text-white drop-shadow-md">
          {greeting}, {mounted ? (user?.display_name?.split(' ')[0] ?? '…') : '…'}.
        </h1>
        {mounted && (
          <p className="text-[11px] uppercase tracking-widest text-white/50 mt-1">
            {now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_272px] gap-6">
        {/* ── Left Column ── */}
        <div className="space-y-6 min-w-0">

          {/* Inline AI Chat */}
          <InlineChat />

          {/* Task Summary — admins only */}
          {canManageEvents && (
            <div className="rounded-xl border border-white/10 p-5" style={{ background: 'rgba(10,10,30,0.5)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CheckSquare size={15} strokeWidth={2.5} className="text-[var(--color-primary)]" />
                  <p className="text-[10px] uppercase tracking-widest font-bold text-white/60">Task Summary</p>
                </div>
                <Link href="/tasks" className="flex items-center gap-1 text-[11px] text-white/50 hover:text-white transition-colors">
                  View all <ChevronRight size={12} />
                </Link>
              </div>

              {tasks.length === 0 ? (
                <p className="text-[12.5px] text-white/40 py-3 text-center">All clear — no open tasks.</p>
              ) : (
                <>
                  <div className="flex gap-3 mb-4">
                    <div className="flex-1 rounded-lg px-3 py-2 text-center" style={{ background: 'rgba(255,255,255,0.07)' }}>
                      <p className="text-[18px] font-bold text-white">{tasksByStatus.todo}</p>
                      <p className="text-[10px] text-white/40 uppercase tracking-wider mt-0.5">To Do</p>
                    </div>
                    <div className="flex-1 rounded-lg px-3 py-2 text-center" style={{ background: 'rgba(245,158,11,0.15)' }}>
                      <p className="text-[18px] font-bold text-amber-400">{tasksByStatus.in_progress}</p>
                      <p className="text-[10px] text-amber-400/60 uppercase tracking-wider mt-0.5">In Progress</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {tasks.map(t => (
                      <div key={t.id} className="flex items-center gap-3 px-1 py-2 rounded-lg hover:bg-white/5 transition-colors">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[t.priority] ?? 'bg-white/30'}`} />
                        <p className="text-[12.5px] flex-1 truncate text-white/80">{t.title}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          t.status === 'in_progress'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-white/10 text-white/40'
                        }`}>
                          {t.status === 'in_progress' ? 'In Progress' : 'Todo'}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Recent Notes */}
          <div className="rounded-xl border border-white/10 p-5" style={{ background: 'rgba(10,10,30,0.5)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileText size={15} strokeWidth={2.5} className="text-[var(--color-primary)]" />
                <p className="text-[10px] uppercase tracking-widest font-bold text-white/60">Recent Notes</p>
              </div>
              <Link href="/workspace" className="flex items-center gap-1 text-[11px] text-white/50 hover:text-white transition-colors">
                View all <ChevronRight size={12} />
              </Link>
            </div>

            {notes.length === 0 ? (
              <div className="py-10 text-center">
                <FileText size={28} className="mx-auto text-[var(--color-outline)] mb-2 opacity-40" />
                <p className="text-[12.5px] text-[var(--color-outline)]">No notes yet. Create one from the sidebar.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {notes.map(n => {
                  const ws = workspaces.find(w => w.id === n.workspace_id);
                  const preview = n.content_md.replace(/[#*`>_\-\[\]]/g, '').trim().slice(0, 90);
                  return (
                    <Link
                      key={n.id}
                      href={`/workspace?ws=${n.workspace_id}&note=${n.id}`}
                      className="group flex flex-col gap-2 p-4 rounded-lg border border-white/10 hover:border-white/25 hover:bg-white/5 transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {n.is_pinned && <Pin size={10} className="text-[var(--color-primary)] flex-shrink-0" fill="currentColor" />}
                          <p className="text-[13px] font-semibold text-white/90 truncate leading-snug">
                            {n.title || 'Untitled'}
                          </p>
                        </div>
                        <ArrowUpRight size={13} className="text-white/30 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      {preview && (
                        <p className="text-[11.5px] text-white/50 line-clamp-2 leading-relaxed">{preview}</p>
                      )}
                      <div className="flex items-center justify-between mt-auto pt-1">
                        {ws ? (
                          <span className="flex items-center gap-1 text-[10px] text-white/40 font-medium">
                            <WorkspaceIcon icon={ws.icon} size={10} /> {ws.name}
                          </span>
                        ) : (
                          <span className="text-[10px] text-white/40">Personal</span>
                        )}
                        <span className="flex items-center gap-1 text-[10px] text-white/30">
                          <Clock size={9} /> {timeAgo(n.updated_at)}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Right Column ── */}
        <div className="space-y-4">
          {/* Mini Calendar */}
          <div className="rounded-xl border border-white/10 p-5" style={{ background: 'rgba(10,10,30,0.5)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
            {mounted && (
              <>
                <div className="mb-5">
                  <p className="text-[11px] uppercase tracking-widest text-white/40 font-semibold mb-1">
                    {now.toLocaleDateString('en-US', { weekday: 'long' })}
                  </p>
                  <p className="text-[32px] font-bold leading-none text-white">
                    {now.getDate()}
                  </p>
                  <p className="text-[12px] text-white/60 mt-0.5">
                    {MONTHS[now.getMonth()]} {now.getFullYear()}
                  </p>
                </div>
                <div className="h-px bg-white/10 mb-4" />
                <MiniCalendar
                  events={events}
                  canAddEvents={!!canManageEvents}
                  onDayClick={setAddEventDay}
                />
                {canManageEvents && (
                  <p className="text-[10px] text-white/30 text-center mt-3">
                    Click any date to add an event
                  </p>
                )}
              </>
            )}
          </div>

          {/* Upcoming Events */}
          <div className="rounded-xl border border-white/10 p-5" style={{ background: 'rgba(10,10,30,0.5)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] uppercase tracking-widest font-bold text-white/60">Upcoming Events</p>
              <Link href="/calendar" className="flex items-center gap-1 text-[11px] text-white/50 hover:text-white transition-colors">
                Calendar <ChevronRight size={12} />
              </Link>
            </div>

            {!mounted ? (
              <p className="text-[12px] text-white/30 text-center py-4">…</p>
            ) : !canManageEvents ? (
              <p className="text-[12px] text-white/30 text-center py-4">No access to events.</p>
            ) : upcomingEvents.length === 0 ? (
              <p className="text-[12px] text-white/30 text-center py-4">No upcoming events.</p>
            ) : (
              <div className="space-y-2">
                {upcomingEvents.map(ev => {
                  const d          = new Date(ev.start_time);
                  const isToday    = d.toDateString() === now.toDateString();
                  const isTomorrow = d.toDateString() === new Date(now.getTime() + 86400000).toDateString();
                  const label      = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  return (
                    <div key={ev.id} className="flex items-start gap-3 px-1 py-2 rounded-lg hover:bg-white/5 transition-colors">
                      <Circle size={7} className={`mt-1.5 flex-shrink-0 fill-current ${isToday ? 'text-[var(--color-primary)]' : 'text-white/30'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] font-medium text-white/90 truncate">{ev.title}</p>
                        <p className={`text-[10.5px] mt-0.5 ${isToday ? 'text-[var(--color-primary)] font-semibold' : 'text-white/40'}`}>
                          {label}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
