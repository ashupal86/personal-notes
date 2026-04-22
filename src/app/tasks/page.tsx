'use client';
import { useState } from 'react';
import AppShell from '@/components/AppShell';

type Priority = 'urgent' | 'high' | 'medium' | 'low';
type Status   = 'todo' | 'in_progress' | 'done';

interface Task { id: string; title: string; priority: Priority; status: Status; due?: string; }

const INIT: Task[] = [
  { id: '1', title: 'Architectural Review: Metadata Storage Engine',   priority: 'urgent', status: 'in_progress', due: 'Apr 23' },
  { id: '2', title: 'Implement WebSocket Handshake for Real-time Sync', priority: 'high',   status: 'todo',        due: 'Apr 25' },
  { id: '3', title: 'Neural Link Interface: Signal Latency Optimisation', priority: 'high', status: 'todo',       due: 'Apr 26' },
  { id: '4', title: 'API Endpoint Documentation: Workspace V2',         priority: 'medium', status: 'done',        due: 'Apr 20' },
  { id: '5', title: 'Audit SSL Certificates across all subdomains',     priority: 'low',    status: 'done',        due: 'Apr 19' },
];

const PRIORITY_BADGE: Record<Priority, string> = {
  urgent: 'bg-red-100 text-red-700',
  high:   'bg-amber-100 text-amber-700',
  medium: 'bg-blue-100 text-blue-700',
  low:    'bg-[var(--color-surface-high)] text-[var(--color-on-surface-var)]',
};

const PRIORITY_DOT: Record<Priority, string> = {
  urgent: 'bg-red-500', high: 'bg-amber-500',
  medium: 'bg-[var(--color-primary)]', low: 'bg-[var(--color-outline)]',
};

const FILTERS: { label: string; value: Status | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'To Do', value: 'todo' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Done', value: 'done' },
];

export default function TasksPage() {
  const [tasks, setTasks]   = useState(INIT);
  const [filter, setFilter] = useState<Status | 'all'>('all');
  const [newTitle, setNewTitle] = useState('');
  const [showModal, setShowModal] = useState(false);

  const visible = filter === 'all' ? tasks : tasks.filter(t => t.status === filter);

  const toggle = (id: string) =>
    setTasks(ts => ts.map(t =>
      t.id === id ? { ...t, status: t.status === 'done' ? 'todo' : 'done' } : t
    ));

  const addTask = () => {
    if (!newTitle.trim()) return;
    setTasks(ts => [...ts, { id: Date.now().toString(), title: newTitle, priority: 'medium', status: 'todo' }]);
    setNewTitle('');
    setShowModal(false);
  };

  const counts = { all: tasks.length, todo: tasks.filter(t=>t.status==='todo').length, in_progress: tasks.filter(t=>t.status==='in_progress').length, done: tasks.filter(t=>t.status==='done').length };

  return (
    <AppShell>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-on-surface)]">Task Management</h1>
          <p className="text-[12.5px] text-[var(--color-on-surface-var)] mt-0.5">
            Precision task management for technical workflows.
          </p>
        </div>
        <button
          id="new-task-btn"
          onClick={() => setShowModal(true)}
          className="self-start sm:self-auto flex items-center gap-1.5 px-4 py-2 bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dim)] text-[var(--color-on-primary)] text-[13px] font-medium rounded-[var(--radius-md)] hover:opacity-90 transition-opacity"
        >
          <span className="mi text-[16px]">add</span>New Task
        </button>
      </div>

      {/* Kanban summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {(['all', 'todo', 'in_progress', 'done'] as const).map(s => (
          <div key={s} className={`rounded-lg p-3.5 cursor-pointer transition-all ${filter === s ? 'bg-[var(--color-primary-container)] ring-2 ring-[var(--color-primary)]/30' : 'bg-[var(--color-surface-pure)] hover:bg-[var(--color-surface-low)]'}`}
            onClick={() => setFilter(s)}>
            <p className="text-[10px] uppercase tracking-widest font-semibold text-[var(--color-on-surface-var)] mb-1">
              {s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
            </p>
            <p className="text-2xl font-bold tracking-tight text-[var(--color-on-surface)]">{counts[s]}</p>
          </div>
        ))}
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {FILTERS.map(f => (
          <button key={f.value} onClick={() => setFilter(f.value)}
            className={`flex-shrink-0 px-3.5 py-1.5 rounded-[var(--radius-md)] text-[12.5px] font-medium transition-colors ${filter === f.value ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)]' : 'bg-[var(--color-surface-mid)] text-[var(--color-on-surface-var)] hover:bg-[var(--color-surface-high)]'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="space-y-2">
        {visible.map((t, i) => (
          <div key={t.id} id={`task-${t.id}`} style={{ animationDelay: `${i * 40}ms` }}
            className="animate-fade-up flex items-center gap-3 p-4 bg-[var(--color-surface-pure)] rounded-lg shadow-[0_1px_8px_rgba(49,51,46,0.04)] hover:shadow-[0_4px_20px_rgba(49,51,46,0.08)] transition-all duration-150 cursor-pointer group"
            onClick={() => toggle(t.id)}
          >
            <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-[1.5px] transition-colors ${t.status === 'done' ? 'bg-[var(--color-primary)] border-[var(--color-primary)]' : 'border-[var(--color-outline-var)] group-hover:border-[var(--color-primary)]'}`}>
              {t.status === 'done' && <span className="mi text-[12px] text-white">check</span>}
            </div>

            <span className={`flex-1 text-[13.5px] font-medium transition-colors ${t.status === 'done' ? 'line-through text-[var(--color-outline)]' : 'text-[var(--color-on-surface)]'}`}>
              {t.title}
            </span>

            {t.due && (
              <span className="hidden sm:inline text-[11px] text-[var(--color-outline)] flex-shrink-0">{t.due}</span>
            )}

            <span className={`flex-shrink-0 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-[var(--radius-sm)] ${PRIORITY_BADGE[t.priority]}`}>
              {t.priority}
            </span>

            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[t.priority]}`} />
          </div>
        ))}

        {visible.length === 0 && (
          <div className="text-center py-16 text-[var(--color-outline)]">
            <span className="mi text-5xl block mb-3">done_all</span>
            <p className="text-[13px]">No tasks here.</p>
          </div>
        )}
      </div>

      {/* Add task modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-[var(--color-surface-pure)] rounded-lg p-6 w-full max-w-md shadow-[0_20px_60px_rgba(14,14,13,0.15)] animate-fade-up" onClick={e => e.stopPropagation()}>
            <h2 className="text-[17px] font-bold text-[var(--color-on-surface)] mb-4">New Task</h2>
            <input
              id="new-task-input"
              autoFocus
              className="w-full bg-[var(--color-surface-pure)] border border-[var(--color-outline-var)]/40 rounded-[var(--radius-md)] px-3.5 py-2.5 text-[13.5px] text-[var(--color-on-surface)] placeholder:text-[var(--color-outline)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10 mb-4 transition-colors"
              placeholder="Task title…"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTask()}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-[13px] rounded-[var(--radius-md)] bg-[var(--color-surface-mid)] text-[var(--color-on-surface-var)] hover:bg-[var(--color-surface-high)] transition-colors">
                Cancel
              </button>
              <button id="confirm-add-task-btn" onClick={addTask} className="px-4 py-2 text-[13px] rounded-[var(--radius-md)] bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dim)] text-[var(--color-on-primary)] hover:opacity-90 transition-opacity">
                Add Task
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
