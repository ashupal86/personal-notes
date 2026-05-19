'use client';
import { useState, useEffect } from 'react';
import AppShell from '@/components/AppShell';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import { ConfirmModal } from '@/components/ConfirmModal';
import { Trash2, RotateCcw, FolderOpen, X, Clock, FileText } from 'lucide-react';

interface TrashedNote {
  id: string;
  title: string;
  content_md: string;
  workspace_id: string | null;
  deleted_at: string;
  updated_at: string;
}

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (d < 60)    return 'Just now';
  if (d < 3600)  return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

const ROLE_WEIGHT: Record<string, number> = { super_admin: 3, admin: 2, user: 1 };

export default function TrashPage() {
  const { role } = useAuth();
  const { notify } = useNotifications();
  const [mounted, setMounted] = useState(false);
  const [notes, setNotes] = useState<TrashedNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState<{ id: string; action: 'restore' | 'purge'; title: string } | null>(null);
  const [preview, setPreview] = useState<TrashedNote | null>(null);
  const [working, setWorking] = useState(false);

  // Avoid hydration mismatch — role is null on server
  const isAdmin = mounted && ROLE_WEIGHT[role ?? 'user'] >= ROLE_WEIGHT['admin'];

  useEffect(() => { setMounted(true); }, []);

  const loadTrash = async () => {
    setLoading(true);
    try {
      const r = await api.get<{ success: boolean; data: TrashedNote[] }>('/notes/trash');
      setNotes(r.data ?? []);
    } catch {
      notify('error', 'Failed to load trash');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTrash(); }, []);

  const handleAction = async (id: string, action: 'restore' | 'purge') => {
    setWorking(true);
    try {
      await api.post('/notes/trash', { action, id });
      setNotes(prev => prev.filter(n => n.id !== id));
      setPreview(null);
      notify(
        action === 'restore' ? 'success' : 'info',
        action === 'restore' ? 'Note restored successfully' : 'Note permanently deleted',
      );
    } catch {
      notify('error', 'Operation failed', 'Please try again.');
    } finally {
      setWorking(false);
      setConfirm(null);
    }
  };

  const purgeAll = async () => {
    setWorking(true);
    const count = notes.length;
    try {
      await Promise.all(notes.map(n => api.post('/notes/trash', { action: 'purge', id: n.id })));
      setNotes([]);
      notify('info', 'Trash cleared', `${count} note(s) permanently deleted.`);
    } catch {
      notify('error', 'Failed to clear trash');
    } finally {
      setWorking(false);
      setConfirm(null);
    }
  };

  return (
    <AppShell>
      {confirm && confirm.id !== '__all__' && (
        <ConfirmModal
          title={confirm.action === 'restore' ? 'Restore Note' : 'Permanently Delete'}
          message={
            confirm.action === 'restore'
              ? <>Restore <strong>{confirm.title}</strong> back to your workspace?</>
              : <>This will permanently delete <strong>{confirm.title}</strong>. This action cannot be undone.</>
          }
          confirmLabel={confirm.action === 'restore' ? 'Restore' : 'Delete Forever'}
          danger={confirm.action === 'purge'}
          onConfirm={() => handleAction(confirm.id, confirm.action)}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm?.id === '__all__' && (
        <ConfirmModal
          title="Empty Trash"
          message={<>This will permanently delete all <strong>{notes.length} note(s)</strong> in the trash. This action cannot be undone.</>}
          confirmLabel="Empty Trash"
          danger
          onConfirm={purgeAll}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* ── Note Preview Modal ── */}
      {preview && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[500] flex items-center justify-center p-4"
          onClick={() => setPreview(null)}
        >
          <div
            className="bg-[var(--color-surface-pure)] border border-[var(--color-surface-high)] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col animate-fade-up"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between p-5 border-b border-[var(--color-surface-high)] flex-shrink-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-md bg-red-100 dark:bg-red-950/40 flex items-center justify-center">
                    <Trash2 size={12} className="text-red-500" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">Deleted {timeAgo(preview.deleted_at)}</span>
                </div>
                <h2 className="text-[16px] font-bold text-[var(--color-on-surface)] leading-tight truncate">
                  {preview.title || 'Untitled'}
                </h2>
                <p className="text-[11px] text-[var(--color-outline)] mt-0.5 flex items-center gap-1">
                  <Clock size={10} /> Last edited {timeAgo(preview.updated_at)}
                </p>
              </div>
              <button
                onClick={() => setPreview(null)}
                className="p-1.5 text-[var(--color-outline)] hover:text-[var(--color-on-surface)] hover:bg-[var(--color-surface-low)] rounded-lg transition-colors flex-shrink-0 ml-3"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5">
              {preview.content_md.trim() ? (
                <pre className="text-[13px] text-[var(--color-on-surface-var)] leading-relaxed whitespace-pre-wrap font-sans">
                  {preview.content_md}
                </pre>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText size={24} className="text-[var(--color-outline)] opacity-30 mb-3" />
                  <p className="text-[12px] text-[var(--color-outline)] italic">This note is empty</p>
                </div>
              )}
            </div>

            {/* Actions — only for admin+ */}
            {isAdmin && (
              <div className="flex items-center justify-end gap-3 p-4 border-t border-[var(--color-surface-high)] flex-shrink-0">
                <button
                  onClick={() => { setConfirm({ id: preview.id, action: 'purge', title: preview.title || 'Untitled' }); setPreview(null); }}
                  disabled={working}
                  className="flex items-center gap-2 px-4 py-2 text-[12px] font-semibold text-red-500 border border-red-300 dark:border-red-800/50 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors disabled:opacity-50"
                >
                  <Trash2 size={13} /> Delete Forever
                </button>
                <button
                  onClick={() => { setConfirm({ id: preview.id, action: 'restore', title: preview.title || 'Untitled' }); setPreview(null); }}
                  disabled={working}
                  className="flex items-center gap-2 px-4 py-2 text-[12px] font-bold text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl transition-colors disabled:opacity-50"
                >
                  <RotateCcw size={13} /> Restore Note
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 max-w-5xl mx-auto w-full space-y-6">
        <div className="surface-panel-strong page-hero flex items-end justify-between gap-4" data-aos="fade-up">
          <div className="relative z-[1]">
            <h1 className="display-title text-[2.3rem] leading-none text-[var(--color-on-surface)] flex items-center gap-4">
              <div className="w-12 h-12 rounded-[22px] bg-red-100 flex items-center justify-center">
                <Trash2 size={18} className="text-red-500" />
              </div>
              Trash
            </h1>
            <p className="mt-3 text-[13px] text-[var(--color-on-surface-var)]">
              {notes.length} deleted note{notes.length !== 1 ? 's' : ''}
              {isAdmin ? ' · Click a note to preview its contents.' : ' · Contact an admin to restore notes.'}
            </p>
          </div>
          {isAdmin && notes.length > 0 && (
            <button
              onClick={() => setConfirm({ id: '__all__', action: 'purge', title: 'all notes' })}
              disabled={working}
              className="flex items-center gap-2 px-4 py-2 text-[12px] font-semibold text-red-500 border border-red-300 dark:border-red-800/50 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors disabled:opacity-50"
            >
              <Trash2 size={14} /> Empty Trash
            </button>
          )}
        </div>

        {!isAdmin && (
          <div className="surface-panel flex items-center gap-3 p-4 text-[13px] text-amber-700">
            <Trash2 size={16} />
            <span>Only admins and super admins can restore or permanently delete notes from the trash.</span>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[130px] rounded-xl bg-[var(--color-surface-pure)]/60 border border-[var(--color-surface-high)] animate-pulse" />
            ))}
          </div>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface-pure)]/60 border border-dashed border-[var(--color-surface-high)] flex items-center justify-center mb-4">
              <FolderOpen size={28} className="text-[var(--color-outline)] opacity-40" />
            </div>
            <p className="text-[14px] font-medium text-[var(--color-outline)]">Trash is empty</p>
            <p className="text-[12px] text-[var(--color-outline)] opacity-60 mt-1">Deleted notes will appear here</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {notes.map(n => (
              <div
                key={n.id}
                onClick={() => setPreview(n)}
                className="surface-panel p-4 group hover:border-red-300/50 transition-all cursor-pointer"
                data-aos="fade-up"
              >
                <p className="text-[13px] font-semibold text-[var(--color-on-surface)] leading-snug line-clamp-2 mb-1 group-hover:text-red-500 transition-colors">
                  {n.title || 'Untitled'}
                </p>
                <p className="text-[11px] text-[var(--color-on-surface-var)] line-clamp-2 leading-relaxed mb-3">
                  {n.content_md.replace(/[#*`>_~]/g, '').slice(0, 100) || <span className="italic opacity-50">Empty note</span>}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[var(--color-outline)] flex items-center gap-1">
                    <Clock size={9} /> Deleted {timeAgo(n.deleted_at)}
                  </span>
                  {isAdmin && (
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={e => { e.stopPropagation(); setConfirm({ id: n.id, action: 'restore', title: n.title || 'Untitled' }); }}
                        disabled={working}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg transition-colors"
                      >
                        <RotateCcw size={11} /> Restore
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); setConfirm({ id: n.id, action: 'purge', title: n.title || 'Untitled' }); }}
                        disabled={working}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                      >
                        <Trash2 size={11} /> Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
