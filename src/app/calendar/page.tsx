'use client';
import { useState } from 'react';
import AppShell from '@/components/AppShell';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

const EVENTS = [
  { id: '1', title: 'Architecture Review',       date: 23, color: 'bg-[var(--color-primary)]',       type: 'meeting'  },
  { id: '2', title: 'WebSocket Implementation',  date: 25, color: 'bg-amber-500',                    type: 'deadline' },
  { id: '3', title: 'SSL Audit',                 date: 28, color: 'bg-emerald-600',                  type: 'reminder' },
  { id: '4', title: 'Workspace V2 Launch',       date: 30, color: 'bg-rose-500',                     type: 'deadline' },
];

function buildCalendar(year: number, month: number) {
  const first = new Date(year, month, 1).getDay();
  const days  = new Date(year, month + 1, 0).getDate();
  const cells: { day: number | null; thisMonth: boolean }[] = [];
  for (let i = 0; i < first; i++) cells.push({ day: null, thisMonth: false });
  for (let d = 1; d <= days; d++) cells.push({ day: d, thisMonth: true });
  return cells;
}

export default function CalendarPage() {
  const now   = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selected, setSelected] = useState<number | null>(now.getDate());

  const cells  = buildCalendar(year, month);
  const today  = now.getDate();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  const prev = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const next = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const dayEvents = (d: number) => EVENTS.filter(e => e.date === d);
  const selectedEvents = selected ? dayEvents(selected) : [];

  return (
    <AppShell>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 items-start">

        {/* ── Calendar ── */}
        <div className="bg-[var(--color-surface-pure)] rounded-lg shadow-[0_1px_24px_rgba(49,51,46,0.05)] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 bg-[var(--color-surface-mid)]">
            <button onClick={prev} className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-md)] hover:bg-[var(--color-surface-high)] transition-colors">
              <span className="mi text-[18px] text-[var(--color-on-surface-var)]">chevron_left</span>
            </button>
            <h2 className="text-[15px] font-semibold text-[var(--color-on-surface)]">{MONTHS[month]} {year}</h2>
            <button onClick={next} className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-md)] hover:bg-[var(--color-surface-high)] transition-colors">
              <span className="mi text-[18px] text-[var(--color-on-surface-var)]">chevron_right</span>
            </button>
          </div>

          <div className="p-4">
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-2">
              {DAYS.map(d => (
                <div key={d} className="text-center text-[11px] font-semibold uppercase tracking-wider text-[var(--color-outline)] py-1">{d}</div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-1">
              {cells.map((c, i) => {
                if (!c.thisMonth) return <div key={i} />;
                const events   = dayEvents(c.day!);
                const isToday  = isCurrentMonth && c.day === today;
                const isSel    = c.day === selected;
                return (
                  <button
                    key={i}
                    id={`cal-day-${c.day}`}
                    onClick={() => setSelected(c.day!)}
                    className={`relative flex flex-col items-center rounded-[var(--radius-md)] py-1.5 min-h-[52px] transition-colors ${
                      isSel   ? 'bg-[var(--color-primary-container)] ring-2 ring-[var(--color-primary)]/40' :
                      isToday ? 'bg-[var(--color-primary-container)]' :
                      'hover:bg-[var(--color-surface-low)]'
                    }`}
                  >
                    <span className={`text-[13px] font-medium ${isToday || isSel ? 'text-[var(--color-on-primary-cnt)] font-bold' : 'text-[var(--color-on-surface-var)]'}`}>
                      {c.day}
                    </span>
                    <div className="flex gap-0.5 mt-1 flex-wrap justify-center">
                      {events.slice(0, 3).map(e => (
                        <div key={e.id} className={`w-1.5 h-1.5 rounded-full ${e.color}`} />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Event panel ── */}
        <div className="space-y-4">
          <div className="bg-[var(--color-surface-pure)] rounded-lg p-4 shadow-[0_1px_24px_rgba(49,51,46,0.05)]">
            <p className="text-[10px] uppercase tracking-widest font-semibold text-[var(--color-on-surface-var)] mb-3">
              {selected ? `${MONTHS[month]} ${selected}` : 'Select a day'}
            </p>

            {selectedEvents.length === 0 ? (
              <p className="text-[13px] text-[var(--color-outline)] py-4 text-center">No events</p>
            ) : (
              <div className="space-y-2">
                {selectedEvents.map(e => (
                  <div key={e.id} id={`event-${e.id}`} className="flex items-center gap-3 p-3 rounded-[var(--radius-md)] bg-[var(--color-surface-low)]">
                    <div className={`w-2 h-8 rounded-full flex-shrink-0 ${e.color}`} />
                    <div>
                      <p className="text-[13px] font-semibold text-[var(--color-on-surface)]">{e.title}</p>
                      <p className="text-[11px] uppercase tracking-wider text-[var(--color-outline)]">{e.type}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* All upcoming events */}
          <div className="bg-[var(--color-surface-pure)] rounded-lg p-4 shadow-[0_1px_24px_rgba(49,51,46,0.05)]">
            <p className="text-[10px] uppercase tracking-widest font-semibold text-[var(--color-on-surface-var)] mb-3">Upcoming</p>
            <div className="space-y-2">
              {EVENTS.map(e => (
                <div key={e.id} className="flex items-center gap-3">
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${e.color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-medium text-[var(--color-on-surface)] truncate">{e.title}</p>
                    <p className="text-[11px] text-[var(--color-outline)]">{MONTHS[month]} {e.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button id="new-event-btn" className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dim)] text-[var(--color-on-primary)] text-[13px] font-medium rounded-[var(--radius-md)] hover:opacity-90 transition-opacity">
            <span className="mi text-[16px]">add</span>New Event
          </button>
        </div>
      </div>
    </AppShell>
  );
}
