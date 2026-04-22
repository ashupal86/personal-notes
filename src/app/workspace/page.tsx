'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import AppShell from '@/components/AppShell';
import MarkdownEditor from '@/components/MarkdownEditor';
import Breadcrumb from '@/components/Breadcrumb';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import {
  Plus, MagnifyingGlass, Trash, PushPin, PushPinSlash,
  FloppyDisk, Check, SmileySticker, X,
} from '@phosphor-icons/react';

const TiptapEditor = dynamic(() => import('@/components/TiptapEditor'), { ssr: false, loading: () => <div className="p-5 text-[var(--color-outline)] text-sm">Loading editor…</div> });
const EmojiPicker  = dynamic(() => import('emoji-picker-react'), { ssr: false });

interface Note      { id: string; title: string; content_md: string; content_json?: object; workspace_id: string; is_pinned: boolean; updated_at: string; }
interface Workspace { id: string; name: string; slug: string; icon: string; color: string; }

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (d < 3600)  return 'Today';
  if (d < 86400) return 'Yesterday';
  return `${Math.floor(d / 86400)}d ago`;
}

export default function WorkspacePage() {
  const { user, role, primaryWorkspace } = useAuth();
  const [notes, setNotes]               = useState<Note[]>([]);
  const [workspaces, setWorkspaces]     = useState<Workspace[]>([]);
  const [activeWs, setActiveWs]         = useState<Workspace | null>(null);
  const [active, setActive]             = useState<Note | null>(null);
  const [content, setContent]           = useState('');
  const [contentJson, setContentJson]   = useState<object>({});
  const [search, setSearch]             = useState('');
  const [saving, setSaving]             = useState(false);
  const [saved,  setSaved]              = useState(false);
  const [creating, setCreating]         = useState(false);
  const [showEmoji, setShowEmoji]       = useState(false);
  const emojiRef = useRef<HTMLDivElement>(null);

  const loadNotes = useCallback(async (wsId?: string) => {
    try {
      const url = wsId ? `/notes?workspace_id=${wsId}` : '/notes';
      const r   = await api.get<{ success: boolean; data: Note[] }>(url);
      setNotes(r.data ?? []);
    } catch {}
  }, []);

  useEffect(() => {
    loadNotes();
    // Load workspaces for admin+
    const w = ROLE_WEIGHT[role ?? 'user'];
    if (w >= ROLE_WEIGHT['admin']) {
      api.get<{ success: boolean; data: Workspace[] }>('/workspaces')
        .then(r => setWorkspaces(r.data ?? []))
        .catch(() => {});
    }
  }, [role]);

  // Close emoji on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) setShowEmoji(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const selectNote = (n: Note) => {
    setActive(n);
    setContent(n.content_md);
    setContentJson(n.content_json ?? {});
    setSaved(false);
  };

  const saveNote = async () => {
    if (!active) return;
    setSaving(true);
    try {
      await api.patch(`/notes/${active.id}`, {
        content_md: content,
        content_json: contentJson,
        title: active.title,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      await loadNotes(activeWs?.id);
    } catch {}
    setSaving(false);
  };

  const createNote = async () => {
    const ws = activeWs ?? primaryWorkspace;
    if (!ws) return;
    setCreating(true);
    try {
      const r = await api.post<{ success: boolean; data: Note }>('/notes', {
        title: 'Untitled', content_md: '', workspace_id: ws.id,
      });
      await loadNotes(ws.id);
      if (r.data) { setActive(r.data); setContent(''); setContentJson({}); }
    } catch {}
    setCreating(false);
  };

  const deleteNote = async (id: string) => {
    if (!confirm('Delete this note?')) return;
    await api.delete(`/notes/${id}`);
    const remaining = notes.filter(n => n.id !== id);
    setNotes(remaining);
    if (active?.id === id) { setActive(remaining[0] ?? null); setContent(remaining[0]?.content_md ?? ''); }
  };

  const togglePin = async (n: Note) => {
    await api.patch(`/notes/${n.id}`, { is_pinned: !n.is_pinned });
    setNotes(ns => ns.map(x => x.id === n.id ? { ...x, is_pinned: !x.is_pinned } : x));
  };

  const renameNote = (id: string, title: string) => {
    setNotes(ns => ns.map(n => n.id === id ? { ...n, title } : n));
    if (active?.id === id) setActive(a => a ? { ...a, title } : a);
  };

  const switchWorkspace = (ws: Workspace) => {
    setActiveWs(ws);
    setActive(null);
    setContent('');
    loadNotes(ws.id);
  };

  const ws = activeWs ?? workspaces.find(w => w.id === active?.workspace_id) ?? primaryWorkspace;
  const filtered = notes.filter(n => n.title.toLowerCase().includes(search.toLowerCase()));
  const pinned   = filtered.filter(n => n.is_pinned);
  const unpinned = filtered.filter(n => !n.is_pinned);
  const outline  = content.split('\n').filter(l => /^#{1,3} /.test(l)).slice(0, 8);

  const words = content.split(/\s+/).filter(Boolean).length;
  const chars = content.length;

  return (
    <AppShell>
      <Breadcrumb items={[
        { label: 'Home',      href: '/' },
        { label: 'Workspace', href: '/workspace' },
        ...(ws           ? [{ label: `${ws.icon} ${ws.name}`, href: '/workspace' }] : []),
        ...(active       ? [{ label: active.title }]                                 : []),
      ]} />

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] xl:grid-cols-[220px_1fr_190px] gap-4 items-start mt-3">

        {/* ── Note list ── */}
        <aside className="bg-[var(--color-surface-pure)] rounded-lg shadow-[0_1px_24px_rgba(49,51,46,0.05)] overflow-hidden flex flex-col max-h-[calc(100vh-9rem)] sticky top-[4.5rem]">
          {/* Workspace tabs (admin+) */}
          {workspaces.length > 1 && (
            <div className="flex overflow-x-auto gap-1 px-2 pt-2 pb-0 scrollbar-none">
              {workspaces.map(w => (
                <button key={w.id} onClick={() => switchWorkspace(w)}
                  className={`flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-[var(--radius-md)] text-[11px] font-medium transition-colors ${
                    (activeWs?.id ?? '') === w.id
                      ? 'bg-[var(--color-primary-container)] text-[var(--color-on-primary-cnt)]'
                      : 'text-[var(--color-on-surface-var)] hover:bg-[var(--color-surface-low)]'
                  }`}>
                  <span>{w.icon}</span>{w.name}
                </button>
              ))}
            </div>
          )}

          {/* Header */}
          <div className="px-4 py-3 bg-[var(--color-surface-mid)] flex-shrink-0">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[9.5px] uppercase tracking-widest font-semibold text-[var(--color-on-surface-var)]">Notes</span>
              <button id="new-note-btn" onClick={createNote} disabled={creating} title="New note"
                className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-md)] hover:bg-[var(--color-surface-high)] transition-colors text-[var(--color-on-surface-var)] disabled:opacity-50">
                <Plus size={16} weight={creating ? 'regular' : 'bold'} />
              </button>
            </div>
            <div className="flex items-center gap-2 bg-[var(--color-surface-pure)] border border-[var(--color-outline-var)]/30 rounded-[var(--radius-md)] px-3 py-1.5">
              <MagnifyingGlass size={13} color="var(--color-outline)" />
              <input id="workspace-search" className="flex-1 bg-transparent text-[12px] text-[var(--color-on-surface)] outline-none placeholder:text-[var(--color-outline)]"
                placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          {/* Note items */}
          <div className="flex-1 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <p className="text-center text-[12px] text-[var(--color-outline)] py-8">No notes yet.</p>
            )}
            {[...pinned, ...unpinned].map(n => (
              <div key={n.id}
                className={`group flex items-start border-l-[3px] transition-colors ${
                  active?.id === n.id
                    ? 'bg-[var(--color-primary-container)] border-[var(--color-primary)]'
                    : 'border-transparent hover:bg-[var(--color-surface-low)]'
                }`}>
                <button id={`note-list-${n.id}`} onClick={() => selectNote(n)} className="flex-1 text-left px-3 py-2.5 min-w-0">
                  <p className={`text-[12.5px] font-semibold leading-snug truncate ${active?.id === n.id ? 'text-[var(--color-on-primary-cnt)]' : 'text-[var(--color-on-surface)]'}`}>
                    {n.is_pinned && <PushPin size={10} className="inline mr-1 align-middle" />}
                    {n.title}
                  </p>
                  <p className="text-[10.5px] text-[var(--color-outline)] mt-0.5">{timeAgo(n.updated_at)}</p>
                </button>
                <div className="opacity-0 group-hover:opacity-100 flex items-center pr-1.5 pt-2 gap-0.5 transition-opacity">
                  <button onClick={() => togglePin(n)} title={n.is_pinned ? 'Unpin' : 'Pin'}
                    className="p-1 text-[var(--color-outline)] hover:text-[var(--color-primary)] transition-colors">
                    {n.is_pinned ? <PushPinSlash size={13} /> : <PushPin size={13} />}
                  </button>
                  <button onClick={() => deleteNote(n.id)} title="Delete"
                    className="p-1 text-[var(--color-outline)] hover:text-[var(--color-error)] transition-colors">
                    <Trash size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* ── Editor ── */}
        <div className="bg-[var(--color-surface-pure)] rounded-lg shadow-[0_1px_24px_rgba(49,51,46,0.05)] flex flex-col min-h-[500px] overflow-hidden">
          {active ? (
            <>
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 pt-4 pb-3">
                <div className="min-w-0 flex-1">
                  {/* Title with emoji picker */}
                  <div className="flex items-center gap-2 relative">
                    <div ref={emojiRef}>
                      <button id="emoji-picker-btn" onClick={() => setShowEmoji(v => !v)}
                        className="text-lg hover:scale-110 transition-transform" title="Add emoji">
                        📝
                      </button>
                      {showEmoji && (
                        <div className="absolute top-8 left-0 z-50">
                          <EmojiPicker
                            emojiStyle="native" lazyLoadEmojis
                            height={350} width={300}
                            searchDisabled={false}
                            onEmojiClick={e => {
                              const t = e.emoji + ' ' + (active.title.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s]+/gu, '').trim() || 'Untitled');
                              renameNote(active.id, t);
                              setShowEmoji(false);
                            }}
                          />
                        </div>
                      )}
                    </div>
                    <input
                      className="flex-1 text-xl font-bold tracking-tight text-[var(--color-on-surface)] bg-transparent outline-none"
                      value={active.title}
                      onChange={e => renameNote(active.id, e.target.value)}
                      onBlur={async () => api.patch(`/notes/${active.id}`, { title: active.title }).catch(() => {})}
                      aria-label="Note title"
                    />
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {ws && (
                      <span className="inline-flex px-2 py-0.5 rounded-[var(--radius-md)] text-[10px] font-semibold uppercase tracking-wider bg-[var(--color-secondary-cnt)] text-[var(--color-on-secondary-cnt)]">
                        {ws.icon} {ws.name}
                      </span>
                    )}
                    <span className="text-[11px] text-[var(--color-outline)]">{timeAgo(active.updated_at)}</span>
                  </div>
                </div>
                <button id="save-note-btn" onClick={saveNote} disabled={saving}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-medium rounded-[var(--radius-md)] transition-all flex-shrink-0 ${
                    saved
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dim)] text-[var(--color-on-primary)] hover:opacity-90'
                  } disabled:opacity-50`}>
                  {saved ? <Check size={14} /> : <FloppyDisk size={14} />}
                  {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
                </button>
              </div>

              <div className="h-px bg-[var(--color-surface-high)]" />

              <TiptapEditor
                key={active.id}
                initialContent={content}
                initialJson={Object.keys(contentJson).length ? contentJson : undefined}
                onChange={(text, json) => { setContent(text); setContentJson(json); }}
                placeholder="Start writing your thoughts…"
              />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
              <span className="text-5xl mb-3">📄</span>
              <p className="text-[14px] font-semibold text-[var(--color-on-surface-var)]">No note open</p>
              <p className="text-[12.5px] text-[var(--color-outline)] mt-1 mb-4">Select from the list or create a new one.</p>
              <button onClick={createNote}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dim)] text-[var(--color-on-primary)] text-[13px] font-medium rounded-[var(--radius-md)] hover:opacity-90">
                <Plus size={15} weight="bold" />New Note
              </button>
            </div>
          )}
        </div>

        {/* ── Meta sidebar ── */}
        <aside className="hidden xl:block bg-[var(--color-surface-pure)] rounded-lg p-4 shadow-[0_1px_24px_rgba(49,51,46,0.05)] sticky top-[4.5rem] space-y-4">
          {outline.length > 0 && (
            <div>
              <p className="text-[9px] uppercase tracking-widest text-[var(--color-outline)] mb-1.5 font-semibold">Outline</p>
              {outline.map((l, i) => {
                const lvl = (l.match(/^(#+)/)![1]).length;
                return (
                  <div key={i} className="text-[11.5px] text-[var(--color-on-surface-var)] truncate rounded-[var(--radius-sm)] px-2 py-1 hover:bg-[var(--color-surface-low)]"
                    style={{ paddingLeft: `${(lvl - 1) * 10 + 8}px` }}>
                    {l.replace(/^#+\s/, '')}
                  </div>
                );
              })}
              <div className="h-px bg-[var(--color-surface-high)] my-3" />
            </div>
          )}

          <div>
            <p className="text-[9px] uppercase tracking-widest text-[var(--color-outline)] mb-1.5 font-semibold">Stats</p>
            {[['Words', words], ['Chars', chars], ['Notes', notes.length]].map(([k, v]) => (
              <div key={k} className="flex justify-between py-1 border-b border-[var(--color-surface-high)] last:border-0">
                <span className="text-[11.5px] text-[var(--color-on-surface-var)]">{k}</span>
                <span className="text-[11.5px] font-semibold text-[var(--color-on-surface)]">{v}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

const ROLE_WEIGHT: Record<string, number> = { super_admin: 3, admin: 2, user: 1 };
