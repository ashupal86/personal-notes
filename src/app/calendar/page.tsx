'use client';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AppShell from '@/components/AppShell';
import CalendarEventModal, { apiToCalEvent, type ApiEvent, type ModalEvent } from '@/components/CalendarEventModal';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

const TYPE_COLORS: Record<string, string> = {
  meeting: 'bg-blue-500',
  deadline: 'bg-rose-500',
  reminder: 'bg-emerald-500',
  other: 'bg-purple-500',
};


interface Workspace { id: string; name: string; slug: string; }

function buildCalendar(year: number, month: number) {
  const first = new Date(year, month, 1).getDay();
  const days  = new Date(year, month + 1, 0).getDate();
  const cells: { day: number | null; thisMonth: boolean }[] = [];
  for (let i = 0; i < first; i++) cells.push({ day: null, thisMonth: false });
  for (let d = 1; d <= days; d++) cells.push({ day: d, thisMonth: true });
  while (cells.length % 7 !== 0) cells.push({ day: null, thisMonth: false });
  return cells;
}

type CalEvent = ModalEvent;


export default function CalendarPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CalendarContent />
    </Suspense>
  );
}

function CalendarContent() {
  const searchParams = useSearchParams();
  const now   = new Date();
  const { primaryWorkspace } = useAuth();
  const [year, setYear]     = useState(now.getFullYear());
  const [month, setMonth]   = useState(now.getMonth());
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal]       = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalEvent | null>(null);
  const [initialDay,   setInitialDay]   = useState<number | undefined>();

  const cells         = buildCalendar(year, month);
  const today         = now.getDate();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  const loadEvents = useCallback(async (yr: number, mo: number) => {
    setLoading(true);
    try {
      const r = await api.get<{ success: boolean; data: ApiEvent[] }>('/calendar');
      const mapped = (r.data ?? [])
        .map(e => apiToCalEvent(e, yr, mo))
        .filter(Boolean) as CalEvent[];
      setEvents(mapped);
    } catch { setEvents([]); }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadEvents(year, month);
    api.get<{ success: boolean; data: Workspace[] }>('/workspaces')
      .then(r => {
        const ws = r.data ?? [];
        setWorkspaces(ws);
      }).catch(() => {});
  }, [year, month, loadEvents]);

  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      openNew();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get('new')]);

  const prev = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const next = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };
  const goToToday = () => { setYear(now.getFullYear()); setMonth(now.getMonth()); };

  const dayEvents = (d: number) => events.filter(e => e.date === d);

  const openNew = (day?: number) => {
    setEditingEvent(null);
    setInitialDay(day);
    setShowModal(true);
  };

  const openEdit = (e: React.MouseEvent, evt: CalEvent) => {
    e.stopPropagation();
    setEditingEvent(evt);
    setInitialDay(undefined);
    setShowModal(true);
  };

  const handleSaved = (raw: ApiEvent) => {
    const mapped = apiToCalEvent(raw, year, month);
    if (editingEvent) {
      if (mapped) setEvents(evs => evs.map(e => e.id === editingEvent.id ? mapped : e));
    } else {
      if (mapped) setEvents(evs => [...evs, mapped]);
    }
  };

  const handleDeleted = (id: string) => {
    setEvents(evs => evs.filter(e => e.id !== id));
  };

  return (
    <AppShell>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-on-surface)]">
            {MONTHS[month]} {year}
          </h1>
          <div className="flex items-center gap-1 bg-[var(--color-surface-pure)] border border-[var(--color-surface-high)] rounded-[var(--radius-md)] p-1">
            <button onClick={prev} className="p-1.5 rounded-[var(--radius-sm)] text-[var(--color-on-surface-var)] hover:bg-[var(--color-surface-low)] hover:text-[var(--color-on-surface)] transition-colors">
              <ChevronLeft size={16} />
            </button>
            <button onClick={goToToday} className="px-3 text-[12px] font-semibold text-[var(--color-on-surface-var)] hover:text-[var(--color-on-surface)] transition-colors">
              Today
            </button>
            <button onClick={next} className="p-1.5 rounded-[var(--radius-sm)] text-[var(--color-on-surface-var)] hover:bg-[var(--color-surface-low)] hover:text-[var(--color-on-surface)] transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        </div>

      {/* Calendar Grid */}
      <div className="bg-[var(--color-surface-pure)] border border-[var(--color-surface-high)] rounded-xl shadow-sm overflow-hidden flex flex-col h-[calc(100vh-140px)] min-h-[600px]">
        {/* Day Headers */}
        <div className="grid grid-cols-7 border-b border-[var(--color-surface-high)] bg-[var(--color-surface-low)]">
          {DAYS.map(d => (
            <div key={d} className="px-3 py-2 text-[11px] font-bold text-[var(--color-outline)] uppercase tracking-wider">
              {d}
            </div>
          ))}
        </div>

        {/* Grid Cells */}
        <div className="flex-1 grid grid-cols-7 grid-rows-[repeat(auto-fill,minmax(100px,1fr))] auto-rows-fr bg-[var(--color-surface-high)] gap-[1px]">
          {loading ? (
            <div className="col-span-7 flex items-center justify-center py-20 bg-[var(--color-surface-pure)]">
              <span className="text-[13px] text-[var(--color-outline)]">Loading events…</span>
            </div>
          ) : cells.map((c, i) => {
            const isToday = isCurrentMonth && c.day === today;
            return (
              <div
                key={i}
                className={`bg-[var(--color-surface-pure)] flex flex-col min-h-[100px] hover:bg-[var(--color-surface-low)]/50 transition-colors cursor-pointer ${!c.thisMonth ? 'opacity-40' : ''}`}
                onClick={() => c.day && openNew(c.day)}
              >
                <div className="px-3 py-2 flex justify-between items-center">
                  <span className={`text-[13px] font-semibold flex items-center justify-center w-7 h-7 rounded-full ${isToday ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-on-surface-var)]'}`}>
                    {c.day}
                  </span>
                </div>

                <div className="px-2 pb-2 space-y-1 flex-1 overflow-y-auto">
                  {c.thisMonth && dayEvents(c.day!).map(evt => (
                    <div
                      key={evt.id}
                      onClick={e => openEdit(e, evt)}
                      className={`px-2 py-1 rounded-[var(--radius-sm)] text-[11px] font-medium flex items-center justify-between gap-1.5 truncate transition-colors ${evt.color.replace('bg-', 'bg-').replace('500', '100')} ${evt.color.replace('bg-', 'text-').replace('500', '700')} dark:bg-opacity-20`}
                    >
                      <div className="flex items-center gap-1.5 truncate flex-1">
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${evt.color}`} />
                        <span className="truncate">{evt.title}</span>
                      </div>
                      <span className={`text-[8px] uppercase font-bold px-1 rounded-sm ${!evt.workspace_id ? 'bg-purple-500/20 text-purple-700 dark:text-purple-300' : 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-300'}`}>
                        {!evt.workspace_id ? 'Me' : 'W'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showModal && (
        <CalendarEventModal
          year={year}
          month={month}
          editingEvent={editingEvent}
          initialDay={initialDay}
          workspaces={workspaces}
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </AppShell>
  );
}
