'use client';
import { useState, useEffect, useRef, useCallback, Suspense, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Home, FolderOpen, CheckSquare, Calendar, Settings,
  AlignJustify, Search, Plus, LogOut, ChevronDown, ChevronRight,
  Sun, Moon, Coffee, FileText, Pin, Loader2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { api } from '@/lib/api';
import WorkspaceIcon from '@/components/WorkspaceIcon';

interface Workspace { id: string; name: string; slug: string; icon: string; color: string; }
interface Note      { id: string; title: string; is_pinned: boolean; updated_at: string; workspace_id: string; }

const ROLE_WEIGHT: Record<string, number> = { super_admin: 3, admin: 2, user: 1 };

const NAV = [
  { href: '/',         label: 'Home',      Icon: Home,        minRole: 'user'  },
  { href: '/workspace',label: 'Workspace', Icon: FolderOpen,  minRole: 'user'  },
  { href: '/tasks',    label: 'Tasks',     Icon: CheckSquare, minRole: 'admin' },
];

const THEMES = [
  { id: 'light' as const, label: 'Light', Icon: Sun   },
  { id: 'dark'  as const, label: 'Dark',  Icon: Moon  },
  { id: 'sepia' as const, label: 'Sepia', Icon: Coffee},
];

function AppShellContent({ children, glassBg }: { children: ReactNode; glassBg?: boolean }) {
  const pathname     = usePathname();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { user, role, logout } = useAuth();
  const { theme, setTheme }    = useTheme();

  const [mounted, setMounted]         = useState(false);
  const [open, setOpen]               = useState(false);
  const [workspaces, setWorkspaces]   = useState<Workspace[]>([]);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Which workspace is expanded in the sidebar ('personal' is a special key)
  const PERSONAL_KEY = '__personal__';
  const [expandedWs, setExpandedWs]     = useState<string | null>(null);
  // notes per workspace id (PERSONAL_KEY for personal notes)
  const [wsNotes, setWsNotes]           = useState<Record<string, Note[]>>({});
  const [wsLoading, setWsLoading]       = useState<Record<string, boolean>>({});
  const notesAbort = useRef<Record<string, AbortController>>({});

  useEffect(() => {
    setMounted(true);
    setOpen(false);
    // Load cached workspaces only on client after mount
    try {
      const cached = localStorage.getItem('cache_workspaces');
      if (cached) setWorkspaces(JSON.parse(cached));
    } catch {}
  }, [pathname]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => {
    if (role) {
      api.get<{ success: boolean; data: Workspace[] }>('/workspaces')
        .then(r => {
          const ws = r.data ?? [];
          setWorkspaces(ws);
          try { localStorage.setItem('cache_workspaces', JSON.stringify(ws)); } catch {}
          // Auto-expand the active workspace from URL
          const wsFromUrl = searchParams.get('ws');
          if (wsFromUrl && ws.find(w => w.id === wsFromUrl)) {
            setExpandedWs(wsFromUrl);
          } else if (ws.length > 0 && pathname.startsWith('/workspace')) {
            setExpandedWs(ws[0].id);
          }
        })
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  // Sync expanded workspace when URL changes (e.g. clicking workspace from home)
  useEffect(() => {
    const wsFromUrl = searchParams.get('ws');
    if (wsFromUrl) setExpandedWs(wsFromUrl);
  }, [searchParams]);

  const fetchNotes = useCallback(async (wsId: string) => {
    // Cancel prior in-flight fetch for this ws
    if (notesAbort.current[wsId]) notesAbort.current[wsId].abort();
    const ctrl = new AbortController();
    notesAbort.current[wsId] = ctrl;

    setWsLoading(l => ({ ...l, [wsId]: true }));
    try {
      // PERSONAL_KEY fetches notes with no workspace
      const url = wsId === PERSONAL_KEY
        ? '/api/notes?workspace_id=personal'
        : `/api/notes?workspace_id=${wsId}`;
      const res = await fetch(url, { credentials: 'include', signal: ctrl.signal });
      if (!res.ok) throw new Error('failed');
      const json = await res.json();
      const data: Note[] = json.data ?? [];
      if (!ctrl.signal.aborted) {
        setWsNotes(n => ({ ...n, [wsId]: data }));
      }
    } catch {
      /* aborted or error — ignore */
    } finally {
      if (!ctrl.signal.aborted) setWsLoading(l => ({ ...l, [wsId]: false }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleWorkspace = (wsId: string) => {
    if (expandedWs === wsId) {
      setExpandedWs(null);
    } else {
      setExpandedWs(wsId);
      // Fetch if not already loaded
      if (!wsNotes[wsId]) fetchNotes(wsId);
    }
  };

  // Refresh notes for expanded workspace on nav changes (catches create/delete)
  useEffect(() => {
    if (expandedWs) fetchNotes(expandedWs);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedWs, searchParams]);

  const currentRole = mounted ? (role ?? 'user') : 'user';
  const visible = NAV.filter(n => ROLE_WEIGHT[currentRole] >= ROLE_WEIGHT[n.minRole]);

  const initials = mounted && user?.display_name
    ? user.display_name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  const activeNoteId = searchParams.get('note');

  return (
    <div className={`min-h-screen flex relative ${glassBg ? '' : 'bg-[var(--color-surface)]'}`} style={glassBg ? { zIndex: 1 } : {}}>
      {open && <div className="fixed inset-0 z-40 bg-black/30 md:hidden" onClick={() => setOpen(false)} />}

      {/* ── Sidebar ── */}
      <aside
        id="sidebar"
        className={`${open ? 'open' : ''} w-[220px] flex-shrink-0 flex flex-col transition-colors border-r ${
          glassBg
            ? 'border-white/10'
            : 'bg-[var(--color-surface-pure)] border-[var(--color-surface-high)]'
        }`}
        style={glassBg ? { position: 'relative', zIndex: 10, background: 'rgba(8,8,22,0.38)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' } : {}}
      >
        {/* Brand */}
        <div className={`px-5 py-5 border-b flex-shrink-0 ${glassBg ? 'border-white/10' : 'border-[var(--color-surface-high)]'}`}>
          <Link href="/">
            <p className={`text-[13.5px] font-bold tracking-tight ${glassBg ? 'text-white' : 'text-[var(--color-on-surface)]'}`}>The Quiet Archive</p>
            <p className={`text-[9.5px] uppercase tracking-widest mt-0.5 ${glassBg ? 'text-white/50' : 'text-[var(--color-outline)]'}`}>Knowledge Workspace</p>
          </Link>
        </div>

        {/* Nav — scrollable */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto min-h-0">
          {mounted && (
            <div className="flex flex-col gap-1.5 mb-4">
              {!pathname.startsWith('/tasks') && (
                <Link href="/workspace?new=true" className="flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dim)] text-[var(--color-on-primary)] hover:opacity-90 transition-opacity shadow-sm">
                  <Plus size={15} strokeWidth={2.5} /> New Note
                </Link>
              )}
              {pathname.startsWith('/tasks') && (
                <Link href="/tasks?new=true" className="flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dim)] text-[var(--color-on-primary)] hover:opacity-90 transition-opacity shadow-sm">
                  <Plus size={15} strokeWidth={2.5} /> New Task
                </Link>
              )}
            </div>
          )}
          <p className={`text-[9px] uppercase tracking-widest px-2 mb-2 font-semibold ${glassBg ? 'text-white/35' : 'text-[var(--color-outline)]'}`}>Navigate</p>

          {visible.map(({ href, label, Icon }) => {
            const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
            const isWs     = href === '/workspace';

            return (
              <div key={href} className="mb-0.5">
                {isWs ? (
                  /* ── Workspace section with expandable workspaces ── */
                  <div>
                    <div className={`flex items-center rounded-lg transition-all ${
                    isActive
                      ? glassBg ? 'text-white font-semibold' : 'text-[var(--color-on-surface)]'
                      : glassBg ? 'text-white/60 hover:bg-white/10 hover:text-white' : 'text-[var(--color-on-surface-var)] hover:bg-[var(--color-surface-low)] hover:text-[var(--color-on-surface)]'
                  }`}>
                      <Link href="/workspace" className="flex items-center gap-2.5 px-3 py-2 flex-1 text-[13px] font-medium">
                        <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                        {label}
                      </Link>
                    </div>

                    {/* Workspace list — only rendered after mount to avoid hydration mismatch */}
                    {mounted && (
                      <div className={`mt-0.5 ml-3 border-l pl-1.5 space-y-0.5 ${glassBg ? 'border-white/15' : 'border-[var(--color-surface-high)]'}`}>
                        {workspaces.map(ws => {
                          const isExpanded = expandedWs === ws.id;
                          const notes      = wsNotes[ws.id] ?? [];
                          const loading    = wsLoading[ws.id] ?? false;
                          const pinned     = notes.filter(n => n.is_pinned);
                          const unpinned   = notes.filter(n => !n.is_pinned);
                          const ordered    = [...pinned, ...unpinned];

                          return (
                            <div key={ws.id}>
                              <button
                                onClick={() => toggleWorkspace(ws.id)}
                                className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] transition-colors ${
                                  isExpanded
                                    ? 'bg-[var(--color-primary-container)]/40 text-[var(--color-primary)] font-semibold'
                                    : glassBg
                                      ? 'text-white/55 hover:bg-white/10 hover:text-white'
                                      : 'text-[var(--color-on-surface-var)] hover:bg-[var(--color-surface-low)]'
                                }`}
                              >
                                <WorkspaceIcon icon={ws.icon} size={13} className="flex-shrink-0" />
                                <span className="truncate flex-1 text-left">{ws.name}</span>
                                <ChevronRight
                                  size={11}
                                  className={`flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90 text-[var(--color-primary)]' : glassBg ? 'text-white/30' : 'text-[var(--color-outline)]'}`}
                                />
                              </button>

                              {isExpanded && (
                                <div className="ml-3 mt-0.5 border-l border-[var(--color-primary-container)] pl-1.5 max-h-[280px] overflow-y-auto">
                                  {loading ? (
                                    <div className="flex items-center gap-1.5 px-2 py-2 text-[11px] text-[var(--color-outline)]">
                                      <Loader2 size={11} className="animate-spin" />
                                      Loading…
                                    </div>
                                  ) : ordered.length === 0 ? (
                                    <p className="px-2 py-2 text-[11px] text-[var(--color-outline)] italic">No notes yet.</p>
                                  ) : (
                                    ordered.map(note => {
                                      const isNoteActive = activeNoteId === note.id;
                                      return (
                                        <Link
                                          key={note.id}
                                          href={`/workspace?ws=${ws.id}&note=${note.id}`}
                                          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11.5px] transition-colors truncate ${
                                            isNoteActive
                                              ? 'bg-[var(--color-primary)] text-white font-medium'
                                              : glassBg
                                                ? 'text-white/50 hover:bg-white/10 hover:text-white'
                                                : 'text-[var(--color-on-surface-var)] hover:bg-[var(--color-surface-low)] hover:text-[var(--color-on-surface)]'
                                          }`}
                                        >
                                          {note.is_pinned
                                            ? <Pin size={9} className="flex-shrink-0 opacity-70" fill="currentColor" />
                                            : <FileText size={9} className="flex-shrink-0 opacity-50" />
                                          }
                                          <span className="truncate">{note.title || 'Untitled'}</span>
                                        </Link>
                                      );
                                    })
                                  )}
                                 </div>
                              )}
                            </div>
                          );
                        })}

                        {/* ── Personal notes section ── */}
                        {(() => {
                          const isExpanded  = expandedWs === PERSONAL_KEY;
                          const notes       = wsNotes[PERSONAL_KEY] ?? [];
                          const loading     = wsLoading[PERSONAL_KEY] ?? false;
                          const pinned      = notes.filter(n => n.is_pinned);
                          const unpinned    = notes.filter(n => !n.is_pinned);
                          const ordered     = [...pinned, ...unpinned];
                          return (
                            <div>
                              <button
                                onClick={() => toggleWorkspace(PERSONAL_KEY)}
                                className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] transition-colors ${
                                  isExpanded
                                    ? 'bg-[var(--color-primary-container)]/40 text-[var(--color-primary)] font-semibold'
                                    : glassBg
                                      ? 'text-white/70 hover:bg-white/10 hover:text-white'
                                      : 'text-[var(--color-on-surface-var)] hover:bg-[var(--color-surface-low)]'
                                }`}
                              >
                                <span className="flex-shrink-0 text-[12px]">👤</span>
                                <span className="truncate flex-1 text-left">Personal</span>
                                <ChevronRight
                                  size={11}
                                  className={`flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90 text-[var(--color-primary)]' : glassBg ? 'text-white/30' : 'text-[var(--color-outline)]'}`}
                                />
                              </button>
                              {isExpanded && (
                                <div className="ml-3 mt-0.5 border-l border-[var(--color-primary-container)] pl-1.5 max-h-[280px] overflow-y-auto">
                                  {loading ? (
                                    <div className="flex items-center gap-1.5 px-2 py-2 text-[11px] text-[var(--color-outline)]">
                                      <Loader2 size={11} className="animate-spin" /> Loading…
                                    </div>
                                  ) : ordered.length === 0 ? (
                                    <p className="px-2 py-2 text-[11px] text-[var(--color-outline)] italic">No personal notes.</p>
                                  ) : (
                                    ordered.map(note => {
                                      const isNoteActive = activeNoteId === note.id;
                                      return (
                                        <Link
                                          key={note.id}
                                          href={`/workspace?note=${note.id}`}
                                          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11.5px] transition-colors truncate ${
                                            isNoteActive
                                              ? 'bg-[var(--color-primary)] text-white font-medium'
                                              : glassBg
                                                ? 'text-white/60 hover:bg-white/10 hover:text-white'
                                                : 'text-[var(--color-on-surface-var)] hover:bg-[var(--color-surface-low)] hover:text-[var(--color-on-surface)]'
                                          }`}
                                        >
                                          {note.is_pinned
                                            ? <Pin size={9} className="flex-shrink-0 opacity-70" fill="currentColor" />
                                            : <FileText size={9} className="flex-shrink-0 opacity-50" />
                                          }
                                          <span className="truncate">{note.title || 'Untitled'}</span>
                                        </Link>
                                      );
                                    })
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                ) : (
                  /* ── Regular nav item ── */
                  <div className={`flex items-center rounded-lg transition-all ${
                    isActive
                      ? glassBg
                        ? 'bg-white/15 text-white font-semibold'
                        : 'bg-[var(--color-primary-container)] text-[var(--color-on-primary-cnt)]'
                      : glassBg
                        ? 'text-white/70 hover:bg-white/10 hover:text-white'
                        : 'text-[var(--color-on-surface-var)] hover:bg-[var(--color-surface-low)] hover:text-[var(--color-on-surface)]'
                  }`}>
                    <Link href={href} className="flex items-center gap-2.5 px-3 py-2 flex-1 text-[13px] font-medium">
                      <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                      {label}
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* ── User / Profile Dropdown ── */}
        <div className={`px-3 pb-4 border-t pt-3 relative flex-shrink-0 ${glassBg ? 'border-white/10' : 'border-[var(--color-surface-high)]'}`} ref={profileRef}>
          <button
            id="profile-menu-btn"
            onClick={() => setProfileOpen(v => !v)}
            className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg transition-colors ${glassBg ? 'hover:bg-white/10' : 'hover:bg-[var(--color-surface-low)]'}`}
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dim)] flex items-center justify-center text-[10.5px] font-bold text-[var(--color-on-primary)] flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className={`text-[12px] font-semibold truncate ${glassBg ? 'text-white/90' : 'text-[var(--color-on-surface)]'}`}>{mounted ? (user?.display_name ?? '…') : '…'}</p>
              <p className={`text-[10px] uppercase tracking-wider truncate ${glassBg ? 'text-white/35' : 'text-[var(--color-outline)]'}`}>{mounted ? (user?.role?.replace('_', ' ') ?? '') : ''}</p>
            </div>
            <ChevronDown size={12} className={`transition-transform ${profileOpen ? 'rotate-180' : ''} ${glassBg ? 'text-white/30' : 'text-[var(--color-outline)]'}`} />
          </button>

          {profileOpen && (
            <div className="absolute bottom-full left-3 right-3 mb-2 bg-[var(--color-surface-pure)] border border-[var(--color-surface-high)] rounded-xl shadow-2xl overflow-hidden z-50">
              {/* Theme */}
              <div className="px-3 pt-3 pb-2">
                <p className="text-[9px] uppercase tracking-widest text-[var(--color-outline)] mb-2 font-bold">Theme</p>
                <div className="grid grid-cols-3 gap-1">
                  {THEMES.map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      id={`theme-${id}`}
                      onClick={() => setTheme(id)}
                      title={label}
                      className={`flex flex-col items-center gap-1 py-2 rounded-lg text-[10px] font-semibold transition-all ${
                        theme === id
                          ? 'bg-[var(--color-primary)] text-white shadow-sm'
                          : 'text-[var(--color-on-surface-var)] hover:bg-[var(--color-surface-low)]'
                      }`}
                    >
                      <Icon size={14} strokeWidth={theme === id ? 2.5 : 2} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-px bg-[var(--color-surface-high)] mx-3" />

              <div className="p-2">
                <Link
                  href="/settings"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12.5px] font-medium text-[var(--color-on-surface-var)] hover:bg-[var(--color-surface-low)] transition-colors"
                >
                  <Settings size={14} />
                  Settings
                </Link>
                <button
                  id="logout-btn"
                  onClick={() => { setProfileOpen(false); logout(); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12.5px] font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className={`h-14 border-b flex items-center px-4 gap-3 sticky top-0 z-30 ${
          glassBg
            ? 'border-white/10'
            : 'bg-[var(--color-surface-pure)] border-[var(--color-surface-high)]'
        }`}
          style={glassBg ? { background: 'rgba(10,10,30,0.45)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' } : {}}
        >
          <button id="sidebar-toggle" className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg hover:bg-[var(--color-surface-low)] transition-colors" onClick={() => setOpen(v => !v)}>
            <AlignJustify size={18} className="text-[var(--color-on-surface-var)]" />
          </button>

          <p className={`text-[12.5px] font-semibold capitalize hidden md:block ${
            glassBg ? 'text-white/70' : 'text-[var(--color-on-surface-var)]'
          }`}>
            {pathname === '/' ? 'Dashboard' : pathname.split('/').filter(Boolean).join(' › ')}
          </p>

          <div className="flex-1" />

          <div className="hidden sm:flex items-center gap-2 bg-[var(--color-surface-low)] border border-[var(--color-outline-var)]/20 rounded-lg px-3 py-1.5 w-48">
            <Search size={13} className="text-[var(--color-outline)]" />
            <input id="global-search" className="bg-transparent text-[12.5px] text-[var(--color-on-surface)] outline-none placeholder:text-[var(--color-outline)] w-full" placeholder="Search…" />
          </div>

        </header>

        <main className="flex-1 p-5 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function AppShell({ children, glassBg }: { children: ReactNode; glassBg?: boolean }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--color-surface)] flex items-center justify-center"><Loader2 className="animate-spin text-[var(--color-outline)]" /></div>}>
      <AppShellContent glassBg={glassBg}>{children}</AppShellContent>
    </Suspense>
  );
}
