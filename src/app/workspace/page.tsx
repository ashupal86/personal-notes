'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';
import AppShell from '@/components/AppShell';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import MarkdownEditor from '@/components/MarkdownEditor';
import WorkspaceIcon from '@/components/WorkspaceIcon';
import {
  Plus, Trash2, Pin, PinOff,
  Save, Check, FolderOpen, ChevronRight,
  List, Pencil, Copy, MoreVertical, FolderOutput
} from 'lucide-react';

interface Note      { id: string; title: string; content_md: string; workspace_id: string; is_pinned: boolean; updated_at: string; }
interface Workspace { id: string; name: string; slug: string; icon: string; color: string; }

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (d < 60)    return 'Just now';
  if (d < 3600)  return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

// ── Context Menu ────────────────────────────────────────────────
interface ContextMenuProps {
  x: number; y: number;
  items: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean }[];
  onClose: () => void;
}
function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);
  return (
    <div
      ref={ref}
      className="fixed z-[999] bg-[var(--color-surface-pure)] border border-[var(--color-surface-high)] rounded-xl shadow-2xl py-1.5 min-w-[180px] animate-fade-up"
      style={{ top: y, left: x - 180 }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => { item.onClick(); onClose(); }}
          className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium transition-colors text-left ${
            item.danger
              ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30'
              : 'text-[var(--color-on-surface)] hover:bg-[var(--color-surface-low)]'
          }`}
        >
          <span className="w-4 h-4">{item.icon}</span>
          {item.label}
        </button>
      ))}
    </div>
  );
}

function WorkspacePageContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const wsParam      = searchParams.get('ws');
  const noteParam    = searchParams.get('note');
  const { primaryWorkspace, user } = useAuth();

  const [activeWs, setActiveWs]     = useState<Workspace | null>(null);
  const [allWorkspaces, setAllWorkspaces] = useState<Workspace[]>([]);
  const [active, setActive]         = useState<Note | null>(null);
  const [content, setContent]       = useState('');
  const contentRef = useRef('');
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [creating, setCreating]     = useState(false);
  const [rightOpen, setRightOpen]   = useState(true);
  const [wsNotes, setWsNotes]       = useState<Note[]>([]);
  const [wsNotesLoading, setWsNotesLoading] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number; note: Note } | null>(null);
  const [moveModal, setMoveModal] = useState<Note | null>(null);
  // Abort controller for note fetches
  const fetchAbort = useRef<AbortController | null>(null);

  const outline = content.split('\n').filter(l => /^#{1,3} /.test(l)).slice(0, 8);
  const words   = content.split(/\s+/).filter(Boolean).length;
  const chars   = content.length;

  // ── Load all workspaces (cache + fresh) ──
  useEffect(() => {
    let cached: Workspace[] = [];
    try {
      const raw = localStorage.getItem('cache_workspaces');
      if (raw) {
        cached = JSON.parse(raw);
        setAllWorkspaces(cached);
        if (wsParam) { const f = cached.find(w => w.id === wsParam); if (f) setActiveWs(f); }
      }
    } catch {}
    api.get<{ success: boolean; data: Workspace[] }>('/workspaces')
      .then(r => {
        const ws = r.data ?? [];
        setAllWorkspaces(ws);
        try { localStorage.setItem('cache_workspaces', JSON.stringify(ws)); } catch {}
        if (wsParam) { const f = ws.find(w => w.id === wsParam); if (f) setActiveWs(f); }
      }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsParam]);

  // ── Load note from URL param, and resolve its workspace if needed ──
  const loadNote = useCallback(async (noteId: string) => {
    if (fetchAbort.current) fetchAbort.current.abort();
    const ctrl = new AbortController();
    fetchAbort.current = ctrl;

    try {
      const res = await fetch(`/api/notes/${noteId}`, { credentials: 'include', signal: ctrl.signal });
      if (!res.ok) return;
      const json = await res.json();
      const note: Note = json.data;
      if (!ctrl.signal.aborted && note) {
        setActive(note);
        setContent(note.content_md);
        contentRef.current = note.content_md;
        setSaved(false);
        // Resolve workspace for this note if not already set via ws= param
        if (!wsParam && note.workspace_id) {
          setActiveWs(prev => {
            if (prev?.id === note.workspace_id) return prev;
            // Try from already-fetched list
            const cached = allWorkspaces.find(w => w.id === note.workspace_id);
            if (cached) return cached;
            // Fallback: fetch fresh
            api.get<{ success: boolean; data: Workspace[] }>('/workspaces').then(r => {
              const ws = r.data ?? [];
              setAllWorkspaces(ws);
              const found = ws.find(w => w.id === note.workspace_id);
              if (found) setActiveWs(found);
            }).catch(() => {});
            return prev;
          });
        }
      }
    } catch { /* aborted or error */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsParam, allWorkspaces]);

  useEffect(() => {
    if (noteParam) {
      loadNote(noteParam);
    } else {
      // No note selected — clear editor
      setActive(null);
      setContent('');
      contentRef.current = '';
    }
  }, [noteParam, loadNote]);

  // ── Save note ──
  const saveNote = async () => {
    if (!active) return;
    setSaving(true);
    const latestContent = contentRef.current;
    try {
      await api.patch(`/notes/${active.id}`, { content_md: latestContent, title: active.title });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {}
    setSaving(false);
  };

  // Auto-save on content change (debounced)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleAutoSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(saveNote, 2000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // ── Load notes for workspace tiles view ──
  useEffect(() => {
    if (noteParam) return;
    setWsNotesLoading(true);
    const url = activeWs ? `/notes?workspace_id=${activeWs.id}` : '/notes?workspace_id=personal';
    api.get<{ success: boolean; data: Note[] }>(url)
      .then(r => setWsNotes(r.data ?? []))
      .catch(() => setWsNotes([]))
      .finally(() => setWsNotesLoading(false));
  }, [activeWs, noteParam]);

  // ── Create note in current workspace ──
  const createNote = async () => {
    const wsId = wsParam ?? activeWs?.id ?? null; // null means personal
    if (creating) return;
    setCreating(true);
    try {
      // Enforce max 3 empty/untitled notes
      const existingUrl = wsId ? `/notes?workspace_id=${wsId}` : '/notes?workspace_id=personal';
      const existing = await api.get<{ success: boolean; data: Note[] }>(existingUrl);
      const emptyCount = (existing.data ?? []).filter(
        n => (!n.title || n.title === 'Untitled') && (!n.content_md || n.content_md.trim() === '')
      ).length;
      if (emptyCount >= 3) {
        alert('You already have 3 empty notes. Please fill in or delete one before creating another.');
        setCreating(false);
        return;
      }
      const r = await api.post<{ success: boolean; data: Note }>('/notes', {
        title: 'Untitled', content_md: '', workspace_id: wsId,
      });
      if (r.data) {
        if (wsId) {
          router.push(`/workspace?ws=${wsId}&note=${r.data.id}`);
        } else {
          router.push(`/workspace?note=${r.data.id}`);
        }
      }
    } catch {}
    setCreating(false);
  };

  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      createNote();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get('new')]);

  // ── Note operations ──
  const renameNote = (id: string, title: string) => {
    if (active?.id === id) setActive(a => a ? { ...a, title } : a);
  };

  const togglePin = async (n: Note) => {
    if (active?.id === n.id) setActive(a => a ? { ...a, is_pinned: !a.is_pinned } : a);
    await api.patch(`/notes/${n.id}`, { is_pinned: !n.is_pinned });
  };

  const deleteNote = async (id: string) => {
    await api.delete(`/notes/${id}`);
    // Navigate back to workspace without the note param
    router.push(`/workspace${wsParam ? `?ws=${wsParam}` : ''}`);
  };

  const duplicateNote = async (n: Note) => {
    const wsId = wsParam ?? n.workspace_id;
    try {
      const r = await api.post<{ success: boolean; data: Note }>('/notes', {
        title: `${n.title} (copy)`, content_md: n.content_md, workspace_id: wsId,
      });
      if (r.data) router.push(`/workspace?ws=${wsId}&note=${r.data.id}`);
    } catch {}
  };

  const openMenu = (e: React.MouseEvent, note: Note) => {
    e.preventDefault(); e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, note });
  };

  const menuItems = menu ? [
    { label: 'Rename',    icon: <Pencil size={14} />,    onClick: () => { const t = prompt('New title:', menu.note.title); if (t) { renameNote(menu.note.id, t); api.patch(`/notes/${menu.note.id}`, { title: t }).catch(() => {}); } } },
    { label: active?.is_pinned ? 'Unpin' : 'Pin', icon: active?.is_pinned ? <PinOff size={14} /> : <Pin size={14} />, onClick: () => togglePin(menu.note) },
    { label: 'Duplicate', icon: <Copy size={14} />,      onClick: () => duplicateNote(menu.note) },
    { label: 'Move to...', icon: <FolderOutput size={14} />, onClick: () => setMoveModal(menu.note) },
    { label: 'Delete',    icon: <Trash2 size={14} />,    onClick: () => deleteNote(menu.note.id), danger: true },
  ] : [];

  const handleMove = async (targetWsId: string | null) => {
    if (!moveModal) return;
    try {
      await api.patch(`/notes/${moveModal.id}`, { workspace_id: targetWsId });
      setMoveModal(null);
      // Remove from current view
      setWsNotes(notes => notes.filter(n => n.id !== moveModal.id));
      if (active?.id === moveModal.id) {
        setActive(null);
        setContent('');
        contentRef.current = '';
        router.push(`/workspace${targetWsId ? `?ws=${targetWsId}` : ''}`);
      }
    } catch {}
  };

  return (
    <AppShell>
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} />}

      {moveModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={() => setMoveModal(null)}>
          <div className="bg-[var(--color-surface-pure)] rounded-lg p-6 w-full max-w-sm shadow-[0_20px_60px_rgba(14,14,13,0.15)] animate-fade-up" onClick={e => e.stopPropagation()}>
            <h2 className="text-[15px] font-bold text-[var(--color-on-surface)] mb-4">Move Note to...</h2>
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-2">
              <button
                onClick={() => handleMove(null)}
                className="w-full flex items-center gap-2 px-3 py-2 text-[13px] font-medium rounded-lg text-[var(--color-on-surface)] hover:bg-[var(--color-surface-low)] transition-colors text-left"
              >
                <span>👤</span> Personal
              </button>
              {allWorkspaces.map(w => (
                <button
                  key={w.id}
                  onClick={() => handleMove(w.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[13px] font-medium rounded-lg text-[var(--color-on-surface)] hover:bg-[var(--color-surface-low)] transition-colors text-left"
                >
                  <WorkspaceIcon icon={w.icon} size={14} /> {w.name}
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={() => setMoveModal(null)} className="px-4 py-2 text-[12px] font-medium text-[var(--color-on-surface-var)] hover:bg-[var(--color-surface-low)] rounded-lg transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col h-[calc(100vh-4rem)] border-t border-[var(--color-surface-high)] mt-1">
        {/* Top bar */}
        <header className="flex-none h-[46px] flex items-center justify-between px-4 bg-[var(--color-surface-pure)] border-b border-[var(--color-surface-high)] relative z-10">
          <div className="flex items-center gap-2 min-w-0">
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--color-outline)]">
              {user && (
                <>
                  <span className="opacity-60 max-w-[100px] truncate">{user.display_name}</span>
                  <ChevronRight size={11} className="opacity-40 flex-shrink-0" />
                </>
              )}
              {activeWs ? (
                <span className="flex items-center gap-1 hover:text-[var(--color-on-surface)] cursor-pointer transition-colors" onClick={() => router.push(`/workspace?ws=${activeWs.id}`)}>
                  <WorkspaceIcon icon={activeWs.icon} size={13} />
                  <span className="truncate max-w-[120px]">{activeWs.name}</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 hover:text-[var(--color-on-surface)] cursor-pointer transition-colors" onClick={() => router.push('/workspace')}>
                  <span>👤</span>
                  <span className="truncate max-w-[120px]">Personal</span>
                </span>
              )}
              {active && (
                <>
                  <ChevronRight size={11} className="opacity-40 flex-shrink-0" />
                  <span className="text-[var(--color-on-surface)] truncate max-w-[180px]">{active.title || 'Untitled'}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {active && (
              <button
                onClick={e => openMenu(e, active)}
                className="p-1.5 text-[var(--color-outline)] hover:text-[var(--color-on-surface)] hover:bg-[var(--color-surface-low)] rounded-md transition-all"
              >
                <MoreVertical size={16} />
              </button>
            )}
            <button
              onClick={() => setRightOpen(!rightOpen)}
              className={`p-1.5 rounded-md transition-all ${rightOpen && active ? 'text-[var(--color-primary)] bg-[var(--color-primary-container)]' : 'text-[var(--color-outline)] hover:text-[var(--color-on-surface)] hover:bg-[var(--color-surface-low)]'}`}
              title="Toggle Table of Contents"
            >
              <List size={16} />
            </button>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden">

          {/* ── CENTER — Editor or Grid ── */}
          <main className="flex-1 bg-dotted-grid overflow-y-auto flex flex-col relative min-w-[320px]">
            {active ? (
              <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col min-h-full">
                {/* Editor Header */}
                <div className="flex items-center justify-between px-8 py-5 border-b border-[var(--color-surface-high)] bg-transparent">
                  <div className="flex-1 mr-4">
                    <input
                      className="text-[28px] font-bold tracking-tight text-[var(--color-on-surface)] bg-transparent outline-none placeholder:opacity-30 w-full"
                      placeholder="Untitled Note"
                      value={active.title}
                      onChange={e => renameNote(active.id, e.target.value)}
                      onBlur={() => api.patch(`/notes/${active.id}`, { title: active.title }).catch(() => {})}
                    />
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] text-[var(--color-outline)] font-medium">Last updated {timeAgo(active.updated_at)}</span>
                      {active.is_pinned && <Pin size={10} className="text-[var(--color-primary)]" fill="currentColor" />}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={saveNote}
                      disabled={saving}
                      className={`flex items-center gap-2 px-4 py-2 text-[12px] font-bold rounded-lg transition-all ${
                        saved ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-[var(--color-primary)] text-white hover:opacity-90'
                      } disabled:opacity-50`}
                    >
                      {saved ? <Check size={14} strokeWidth={3} /> : <Save size={14} />}
                      {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
                    </button>
                  </div>
                </div>

                {/* Editor Body */}
                <div className="flex-1 px-8 py-6">
                  <MarkdownEditor
                    key={active.id}
                    initialContent={active.content_md}
                    onChange={t => {
                      setContent(t);
                      contentRef.current = t;
                      setSaved(false);
                      scheduleAutoSave();
                    }}
                    placeholder="Start typing your thoughts…"
                  />
                </div>

                {/* Status bar */}
                <div className="py-2 px-8 border-t border-[var(--color-surface-high)] text-[10px] text-[var(--color-outline)] flex items-center justify-between bg-transparent mt-auto">
                  <div className="flex gap-4">
                    <span>{words} words</span>
                    <span>{chars} characters</span>
                  </div>
                  <span>{saved ? 'All changes saved' : saving ? 'Saving...' : 'Unsaved changes'}</span>
                </div>
              </div>
            ) : !noteParam ? (
              /* ── Workspace note tiles ── */
              <div className="flex-1 p-6">
                {/* Workspace header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[var(--color-surface-pure)] border border-[var(--color-surface-high)] flex items-center justify-center">
                      {activeWs ? <WorkspaceIcon icon={activeWs.icon} size={22} /> : <span className="text-[22px]">👤</span>}
                    </div>
                    <div>
                      <h2 className="text-[17px] font-bold text-[var(--color-on-surface)] leading-tight">{activeWs ? activeWs.name : 'Personal Notes'}</h2>
                      <p className="text-[11px] text-[var(--color-outline)] mt-0.5">{wsNotes.length} note{wsNotes.length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                </div>

                {wsNotesLoading ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="h-[130px] rounded-xl bg-[var(--color-surface-pure)]/60 border border-[var(--color-surface-high)] animate-pulse" />
                    ))}
                  </div>
                ) : wsNotes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface-pure)]/60 border border-dashed border-[var(--color-surface-high)] flex items-center justify-center mb-4">
                      <FolderOpen size={26} className="text-[var(--color-outline)] opacity-50" />
                    </div>
                    <p className="text-[13px] text-[var(--color-outline)]">No notes yet.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                    {wsNotes.map(n => (
                      <button
                        key={n.id}
                        onClick={() => router.push(activeWs ? `/workspace?ws=${activeWs.id}&note=${n.id}` : `/workspace?note=${n.id}`)}
                        className="text-left p-4 rounded-xl bg-[var(--color-surface-pure)]/70 border border-[var(--color-surface-high)] hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-surface-pure)] transition-all group"
                      >
                        <div className="flex items-center justify-between mb-2">
                          {n.is_pinned && <Pin size={11} className="text-[var(--color-primary)]" fill="currentColor" />}
                          <span className="ml-auto text-[10px] text-[var(--color-outline)]">{timeAgo(n.updated_at)}</span>
                        </div>
                        <p className="text-[13px] font-semibold text-[var(--color-on-surface)] leading-snug line-clamp-2 mb-2 group-hover:text-[var(--color-primary)] transition-colors">
                          {n.title || 'Untitled'}
                        </p>
                        <p className="text-[11px] text-[var(--color-on-surface-var)] line-clamp-3 leading-relaxed">
                          {n.content_md.replace(/[#*`>_~]/g, '').slice(0, 100) || <span className="italic opacity-50">Empty note</span>}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </main>

          {/* ── RIGHT SIDEBAR — Table of Contents ── */}
          {active && rightOpen && (
            <aside className="w-[220px] flex-none bg-[var(--color-surface-pure)] border-l border-[var(--color-surface-high)] p-5 overflow-y-auto z-10 transition-all">
              <p className="text-[10px] uppercase tracking-widest text-[var(--color-outline)] mb-4 font-bold flex items-center gap-1.5">
                <List size={12} /> Table of Contents
              </p>
              {outline.length > 0 ? (
                <div className="space-y-0.5">
                  {outline.map((l, i) => {
                    const lvl  = (l.match(/^(#+)/)![1]).length;
                    const slug = l.replace(/^#+\s/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                    return (
                      <div key={i}
                        onClick={() => { const el = document.getElementById(`heading-${slug}`); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                        className="text-[12px] text-[var(--color-on-surface-var)] truncate rounded-md px-2 py-1.5 hover:bg-[var(--color-surface-low)] hover:text-[var(--color-primary)] transition-colors cursor-pointer"
                        style={{ paddingLeft: `${(lvl - 1) * 12 + 8}px` }}>
                        {l.replace(/^#+\s/, '')}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[11px] text-[var(--color-outline)] italic">No headings found.</p>
              )}
            </aside>
          )}
        </div>
      </div>
    </AppShell>
  );
}

export default function WorkspacePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center p-20">Loading workspace...</div>}>
      <WorkspacePageContent />
    </Suspense>
  );
}
