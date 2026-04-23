'use client';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { api } from '@/lib/api';

const TYPE_COLORS: Record<string, string> = {
  meeting: 'bg-blue-500', deadline: 'bg-rose-500',
  reminder: 'bg-emerald-500', other: 'bg-purple-500',
};

export interface ModalEvent {
  id: string; title: string; date: number; color: string;
  type: string; workspace_id?: string | null; start_time: string; end_time: string;
}

export interface ApiEvent {
  id: string; title: string; event_type: string; start_time: string;
  end_time: string; workspace_id?: string | null; color?: string;
}

export function apiToCalEvent(e: ApiEvent, year: number, month: number): ModalEvent | null {
  const d = new Date(e.start_time);
  if (d.getFullYear() !== year || d.getMonth() !== month) return null;
  return {
    id: e.id, title: e.title, date: d.getDate(),
    color: TYPE_COLORS[e.event_type] ?? 'bg-purple-500',
    type: e.event_type, workspace_id: e.workspace_id,
    start_time: e.start_time, end_time: e.end_time,
  };
}

interface Workspace { id: string; name: string; }

interface CalendarEventModalProps {
  year: number;
  month: number;
  editingEvent: ModalEvent | null;
  initialDay?: number;
  workspaces: Workspace[];
  onClose: () => void;
  onSaved: (ev: ApiEvent) => void;
  onDeleted?: (id: string) => void;
}

export default function CalendarEventModal({
  year, month, editingEvent, initialDay, workspaces, onClose, onSaved, onDeleted,
}: CalendarEventModalProps) {
  const [title,   setTitle]   = useState(editingEvent?.title ?? '');
  const [dateStr, setDateStr] = useState(editingEvent ? String(editingEvent.date) : (initialDay ? String(initialDay) : ''));
  const [type,    setType]    = useState(editingEvent?.type ?? 'meeting');
  const [wsId,    setWsId]    = useState(editingEvent?.workspace_id ?? '');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  const save = async () => {
    if (!title.trim() || !dateStr) { setError('Title and date are required.'); return; }
    const dateNum = parseInt(dateStr, 10);
    if (isNaN(dateNum) || dateNum < 1 || dateNum > 31) { setError('Enter a valid day (1–31).'); return; }
    setSaving(true); setError('');
    const start = new Date(year, month, dateNum, 9, 0, 0).toISOString();
    const end   = new Date(year, month, dateNum, 10, 0, 0).toISOString();
    try {
      if (editingEvent) {
        const r = await api.patch<{ success: boolean; data: ApiEvent }>(`/calendar/${editingEvent.id}`, {
          title, event_type: type, start_time: start, end_time: end,
        });
        if (r.data) onSaved(r.data);
      } else {
        const r = await api.post<{ success: boolean; data: ApiEvent }>('/calendar', {
          title, event_type: type, start_time: start, end_time: end, workspace_id: wsId || null,
        });
        if (r.data) onSaved(r.data);
      }
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save event.');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!editingEvent || !onDeleted) return;
    try { await api.delete(`/calendar/${editingEvent.id}`); onDeleted(editingEvent.id); onClose(); }
    catch { setError('Failed to delete.'); }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-surface-pure)] rounded-lg p-6 w-full max-w-md shadow-[0_20px_60px_rgba(14,14,13,0.15)] animate-fade-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-[17px] font-bold text-[var(--color-on-surface)]">
            {editingEvent ? 'Edit Event' : 'New Event'}
          </h2>
          {editingEvent && onDeleted && (
            <button
              onClick={handleDelete}
              className="p-1.5 text-[var(--color-outline)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-[var(--radius-sm)] transition-colors"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>

        {error && (
          <p className="text-[12px] text-red-500 mb-3 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-[var(--radius-md)]">
            {error}
          </p>
        )}

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-[11px] uppercase tracking-widest font-bold text-[var(--color-outline)] mb-1.5">
              Event Title
            </label>
            <input
              autoFocus
              className="w-full bg-[var(--color-surface-pure)] border border-[var(--color-surface-high)] rounded-[var(--radius-md)] px-3.5 py-2.5 text-[13.5px] text-[var(--color-on-surface)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10"
              placeholder="e.g. Design Sync"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') save(); }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] uppercase tracking-widest font-bold text-[var(--color-outline)] mb-1.5">
                Day of Month
              </label>
              <input
                type="number" min="1" max="31"
                className="w-full bg-[var(--color-surface-pure)] border border-[var(--color-surface-high)] rounded-[var(--radius-md)] px-3.5 py-2.5 text-[13.5px] text-[var(--color-on-surface)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10"
                placeholder="e.g. 23"
                value={dateStr}
                onChange={e => setDateStr(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-widest font-bold text-[var(--color-outline)] mb-1.5">
                Type
              </label>
              <select
                className="w-full bg-[var(--color-surface-pure)] border border-[var(--color-surface-high)] rounded-[var(--radius-md)] px-3.5 py-2.5 text-[13.5px] text-[var(--color-on-surface)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10"
                value={type} onChange={e => setType(e.target.value)}
              >
                <option value="meeting">Meeting</option>
                <option value="deadline">Deadline</option>
                <option value="reminder">Reminder</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {!editingEvent && (
            <div>
              <label className="block text-[11px] uppercase tracking-widest font-bold text-[var(--color-outline)] mb-1.5">
                Workspace
              </label>
              <select
                className="w-full bg-[var(--color-surface-pure)] border border-[var(--color-surface-high)] rounded-[var(--radius-md)] px-3.5 py-2.5 text-[13.5px] text-[var(--color-on-surface)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10"
                value={wsId} onChange={e => setWsId(e.target.value)}
              >
                <option value="">None (Personal)</option>
                {workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] rounded-[var(--radius-md)] bg-[var(--color-surface-mid)] text-[var(--color-on-surface-var)] hover:bg-[var(--color-surface-high)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={save} disabled={saving}
            className="px-4 py-2 text-[13px] rounded-[var(--radius-md)] bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dim)] text-[var(--color-on-primary)] hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? 'Saving…' : editingEvent ? 'Save Changes' : 'Add Event'}
          </button>
        </div>
      </div>
    </div>
  );
}
