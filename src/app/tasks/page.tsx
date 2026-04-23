'use client';
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Plus, Edit2, Trash2, Calendar, Layout, FileText } from 'lucide-react';
import AppShell from '@/components/AppShell';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

interface Workspace { id: string; name: string; slug: string; icon: string; color: string; }
type Priority = 'urgent' | 'high' | 'medium' | 'low';
type Status = 'todo' | 'in_progress' | 'done';
interface Task { id: string; title: string; priority: Priority; status: Status; due_date?: string; workspace_id?: string | null; }

const COLUMNS: { id: Status; title: string; color: string }[] = [
  { id: 'todo',        title: 'Not Started', color: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400' },
  { id: 'in_progress', title: 'In Progress',  color: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' },
  { id: 'done',        title: 'Complete 🎊',  color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' },
];

const PRIORITY_DOT: Record<Priority, string> = {
  urgent: 'bg-red-500', high: 'bg-amber-500',
  medium: 'bg-[var(--color-primary)]', low: 'bg-[var(--color-outline)]',
};

import { Suspense } from 'react';

function TasksContent() {
  const searchParams = useSearchParams();
  const { primaryWorkspace } = useAuth();
  const [tasks, setTasks]       = useState<Task[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isBrowser, setIsBrowser]   = useState(false);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [saving, setSaving]          = useState(false);
  const [error, setError]            = useState('');

  const [title, setTitle]       = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [due, setDue]           = useState('');
  const [wsId, setWsId]         = useState('');

  useEffect(() => { setIsBrowser(true); }, []);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get<{ success: boolean; data: Task[] }>('/tasks');
      setTasks(r.data ?? []);
    } catch { setTasks([]); }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTasks();
    api.get<{ success: boolean; data: Workspace[] }>('/workspaces')
      .then(r => {
        const ws = r.data ?? [];
        setWorkspaces(ws);
      }).catch(() => {});
  }, [loadTasks]);

  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      openNew();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get('new')]);


  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const { source, destination } = result;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const newStatus = destination.droppableId as Status;
    const taskId    = result.draggableId;

    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));

    try {
      await api.patch(`/tasks/${taskId}`, { status: newStatus });
    } catch {
      // Revert on failure
      loadTasks();
    }
  };

  const openNew = () => {
    setEditingTask(null);
    setTitle('');
    setPriority('medium');
    setDue('');
    setError('');
    setWsId('');
    setShowModal(true);
  };

  const openEdit = (t: Task) => {
    setEditingTask(t);
    setTitle(t.title);
    setPriority(t.priority);
    setDue(t.due_date ? t.due_date.split('T')[0] : '');
    setWsId(t.workspace_id || '');
    setError('');
    setShowModal(true);
  };

  const saveTask = async () => {
    if (!title.trim()) { setError('Title is required.'); return; }
    setSaving(true);
    setError('');
    try {
      if (editingTask) {
        const r = await api.patch<{ success: boolean; data: Task }>(`/tasks/${editingTask.id}`, {
          title, priority, due_date: due || null,
        });
        if (r.data) setTasks(ts => ts.map(t => t.id === editingTask.id ? r.data : t));
      } else {
        const r = await api.post<{ success: boolean; data: Task }>('/tasks', {
          title, priority, status: 'todo', due_date: due || null, workspace_id: wsId || null,
        });
        if (r.data) setTasks(ts => [r.data, ...ts]);
      }
      setShowModal(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save task.');
    }
    setSaving(false);
  };

  const deleteTask = async (id: string) => {
    setTasks(ts => ts.filter(t => t.id !== id));
    try { await api.delete(`/tasks/${id}`); }
    catch { loadTasks(); }
  };

  return (
    <AppShell>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8">
        <div className="flex items-center gap-3">
          <Layout className="w-8 h-8 text-[var(--color-primary)]" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--color-on-surface)]">Roadmap</h1>
            <p className="text-[12.5px] text-[var(--color-on-surface-var)] mt-0.5">
              Precision task management for technical workflows.
            </p>
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20 text-[var(--color-outline)]">
          <span className="text-[13px]">Loading tasks…</span>
        </div>
      )}

      {!loading && isBrowser && (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {COLUMNS.map(col => {
              const colTasks = tasks.filter(t => t.status === col.id);
              return (
                <div key={col.id} className="flex flex-col min-h-[400px]">
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <span className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-[var(--radius-sm)] ${col.color}`}>
                      {col.title}
                    </span>
                    <span className="text-[11px] font-semibold text-[var(--color-outline)]">{colTasks.length}</span>
                  </div>

                  <Droppable droppableId={col.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex-1 rounded-xl p-2 transition-colors ${
                          snapshot.isDraggingOver ? 'bg-[var(--color-surface-low)]' : 'bg-[var(--color-surface-pure)]/30 border border-dashed border-[var(--color-surface-high)]'
                        }`}
                      >
                        <div className="space-y-2">
                          {colTasks.map((t, i) => (
                            <Draggable key={t.id} draggableId={t.id} index={i}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  style={{ ...provided.draggableProps.style, opacity: snapshot.isDragging ? 0.9 : 1 }}
                                  className="bg-[var(--color-surface-pure)] border border-[var(--color-surface-high)] rounded-lg p-4 shadow-[0_1px_8px_rgba(49,51,46,0.04)] hover:shadow-[0_4px_20px_rgba(49,51,46,0.08)] transition-shadow group relative"
                                >
                                  <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-start gap-2 max-w-[80%]">
                                      <FileText size={13} className="text-[var(--color-outline)] mt-0.5 flex-shrink-0" />
                                      <p className="text-[13px] font-semibold text-[var(--color-on-surface)] leading-snug">{t.title}</p>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button onClick={() => openEdit(t)} className="text-[var(--color-outline)] hover:text-[var(--color-primary)]">
                                        <Edit2 size={13} />
                                      </button>
                                      <button onClick={() => deleteTask(t.id)} className="text-[var(--color-outline)] hover:text-red-500">
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1 text-[11px] text-[var(--color-on-surface-var)]">
                                      <div className={`w-2 h-2 rounded-full ${PRIORITY_DOT[t.priority]}`} />
                                      <span className="capitalize">{t.priority}</span>
                                    </div>
                                    {t.due_date && (
                                      <div className="flex items-center gap-1 text-[11px] text-[var(--color-outline)] bg-[var(--color-surface-low)] px-1.5 py-0.5 rounded-[var(--radius-sm)]">
                                        <Calendar size={11} />
                                        <span>{new Date(t.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                      </div>
                                    )}
                                    <div className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-[var(--radius-sm)] ${!t.workspace_id ? 'bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400' : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400'}`}>
                                      {!t.workspace_id ? 'Personal' : 'Workspace'}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-[var(--color-surface-pure)] rounded-lg p-6 w-full max-w-md shadow-[0_20px_60px_rgba(14,14,13,0.15)] animate-fade-up" onClick={e => e.stopPropagation()}>
            <h2 className="text-[17px] font-bold text-[var(--color-on-surface)] mb-4">{editingTask ? 'Edit Task' : 'New Task'}</h2>
            
            {error && <p className="text-[12px] text-red-500 mb-3 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-[var(--radius-md)]">{error}</p>}

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-[11px] uppercase tracking-widest font-bold text-[var(--color-outline)] mb-1.5">Title</label>
                <input
                  autoFocus
                  className="w-full bg-[var(--color-surface-pure)] border border-[var(--color-surface-high)] rounded-[var(--radius-md)] px-3.5 py-2.5 text-[13.5px] text-[var(--color-on-surface)] placeholder:text-[var(--color-outline)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10"
                  placeholder="Task title…"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveTask(); }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] uppercase tracking-widest font-bold text-[var(--color-outline)] mb-1.5">Priority</label>
                  <select
                    className="w-full bg-[var(--color-surface-pure)] border border-[var(--color-surface-high)] rounded-[var(--radius-md)] px-3.5 py-2.5 text-[13.5px] text-[var(--color-on-surface)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10"
                    value={priority}
                    onChange={e => setPriority(e.target.value as Priority)}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-widest font-bold text-[var(--color-outline)] mb-1.5">Due Date</label>
                  <input
                    type="date"
                    className="w-full bg-[var(--color-surface-pure)] border border-[var(--color-surface-high)] rounded-[var(--radius-md)] px-3.5 py-2.5 text-[13.5px] text-[var(--color-on-surface)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10"
                    value={due}
                    onChange={e => setDue(e.target.value)}
                  />
                </div>
              </div>

              {!editingTask && (
                <div>
                  <label className="block text-[11px] uppercase tracking-widest font-bold text-[var(--color-outline)] mb-1.5">Workspace</label>
                  <select
                    className="w-full bg-[var(--color-surface-pure)] border border-[var(--color-surface-high)] rounded-[var(--radius-md)] px-3.5 py-2.5 text-[13.5px] text-[var(--color-on-surface)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10"
                    value={wsId}
                    onChange={e => setWsId(e.target.value)}
                  >
                    <option value="">None (Personal)</option>
                    {workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-[13px] rounded-[var(--radius-md)] bg-[var(--color-surface-mid)] text-[var(--color-on-surface-var)] hover:bg-[var(--color-surface-high)] transition-colors">
                Cancel
              </button>
              <button onClick={saveTask} disabled={saving} className="px-4 py-2 text-[13px] rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity disabled:opacity-50">
                {saving ? 'Saving…' : editingTask ? 'Save Changes' : 'Add Task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default function TasksPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center p-20">Loading tasks...</div>}>
      <TasksContent />
    </Suspense>
  );
}
