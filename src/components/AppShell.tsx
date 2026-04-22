'use client';
import { useState, useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  House, FolderOpen, CheckSquare, CalendarDots, Gear,
  List, MagnifyingGlass, Plus, SignOut, CaretDown, CaretRight,
  Note, Sun, Moon, Coffee,
} from '@phosphor-icons/react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { api } from '@/lib/api';

interface Workspace { id: string; name: string; slug: string; icon: string; color: string; }

const ROLE_WEIGHT: Record<string, number> = { super_admin: 3, admin: 2, user: 1 };

const NAV = [
  { href: '/',          label: 'Home',      Icon: House,          minRole: 'user'        },
  { href: '/workspace', label: 'Workspace', Icon: FolderOpen,     minRole: 'user'        },
  { href: '/tasks',     label: 'Tasks',     Icon: CheckSquare,    minRole: 'super_admin' },
  { href: '/calendar',  label: 'Calendar',  Icon: CalendarDots,   minRole: 'super_admin' },
  { href: '/settings',  label: 'Settings',  Icon: Gear,           minRole: 'user'        },
];

const THEMES = [
  { id: 'light' as const, label: 'Light',  Icon: Sun   },
  { id: 'dark'  as const, label: 'Dark',   Icon: Moon  },
  { id: 'sepia' as const, label: 'Sepia',  Icon: Coffee},
];

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, role, logout } = useAuth();
  const { theme, setTheme }    = useTheme();
  const [open, setOpen]        = useState(false);
  const [workspaces, setWorkspaces]     = useState<Workspace[]>([]);
  const [wsExpanded, setWsExpanded]     = useState(false);

  useEffect(() => { setOpen(false); }, [pathname]);

  // Load workspaces for admin+
  useEffect(() => {
    if (role && ROLE_WEIGHT[role] >= ROLE_WEIGHT['admin']) {
      api.get<{ success: boolean; data: Workspace[] }>('/workspaces')
        .then(r => setWorkspaces(r.data ?? []))
        .catch(() => {});
    }
  }, [role]);

  const visible = NAV.filter(n => ROLE_WEIGHT[role ?? 'user'] >= ROLE_WEIGHT[n.minRole]);

  const initials = user?.display_name
    ? user.display_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <div className="min-h-screen bg-[var(--color-surface)] flex">
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/30 md:hidden" onClick={() => setOpen(false)} />
      )}

      {/* ── Sidebar ── */}
      <aside
        id="sidebar"
        className={`${open ? 'open' : ''} w-[210px] flex-shrink-0 bg-[var(--color-surface-pure)] border-r border-[var(--color-surface-high)] flex flex-col transition-colors`}
      >
        {/* Brand */}
        <div className="px-5 py-5 border-b border-[var(--color-surface-high)]">
          <Link href="/">
            <p className="text-[13.5px] font-bold tracking-tight text-[var(--color-on-surface)]">The Quiet Archive</p>
            <p className="text-[9.5px] uppercase tracking-widest text-[var(--color-outline)] mt-0.5">Knowledge Workspace</p>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <p className="text-[9px] uppercase tracking-widest text-[var(--color-outline)] px-2 mb-2 font-semibold">Navigate</p>

          {visible.map(({ href, label, Icon }) => {
            const active = pathname === href || (href !== '/' && pathname.startsWith(href));
            const isWs   = href === '/workspace';

            return (
              <div key={href}>
                <div className={`flex items-center rounded-[var(--radius-md)] mb-0.5 transition-colors ${
                  active
                    ? 'bg-[var(--color-primary-container)] text-[var(--color-on-primary-cnt)]'
                    : 'text-[var(--color-on-surface-var)] hover:bg-[var(--color-surface-low)] hover:text-[var(--color-on-surface)]'
                }`}>
                  <Link href={href} className="flex items-center gap-2.5 px-3 py-2 flex-1 text-[13px] font-medium">
                    <Icon size={17} weight={active ? 'fill' : 'regular'} />
                    {label}
                  </Link>
                  {/* Workspace expand toggle for admin+ */}
                  {isWs && workspaces.length > 0 && (
                    <button onClick={() => setWsExpanded(v => !v)} className="px-2 py-2">
                      {wsExpanded ? <CaretDown size={13} /> : <CaretRight size={13} />}
                    </button>
                  )}
                </div>

                {/* Workspace sub-items */}
                {isWs && wsExpanded && workspaces.map(ws => (
                  <Link
                    key={ws.id}
                    href={`/workspace?ws=${ws.id}`}
                    className="flex items-center gap-2 pl-8 pr-3 py-1.5 rounded-[var(--radius-md)] mb-0.5 text-[12px] text-[var(--color-on-surface-var)] hover:bg-[var(--color-surface-low)] hover:text-[var(--color-on-surface)] transition-colors"
                  >
                    <span className="text-[14px]">{ws.icon}</span>
                    <span className="truncate">{ws.name}</span>
                  </Link>
                ))}
              </div>
            );
          })}

          {/* Theme switcher */}
          <div className="mt-4 pt-3 border-t border-[var(--color-surface-high)]">
            <p className="text-[9px] uppercase tracking-widest text-[var(--color-outline)] px-2 mb-2 font-semibold">Theme</p>
            <div className="flex gap-1 px-2">
              {THEMES.map(({ id, label, Icon }) => (
                <button key={id} id={`theme-${id}`} onClick={() => setTheme(id)} title={label}
                  className={`flex-1 flex items-center justify-center py-1.5 rounded-[var(--radius-md)] transition-colors text-[11px] gap-1 ${
                    theme === id
                      ? 'bg-[var(--color-primary-container)] text-[var(--color-on-primary-cnt)]'
                      : 'text-[var(--color-on-surface-var)] hover:bg-[var(--color-surface-low)]'
                  }`}>
                  <Icon size={13} weight={theme === id ? 'fill' : 'regular'} />
                </button>
              ))}
            </div>
          </div>
        </nav>

        {/* User */}
        <div className="px-3 pb-4 border-t border-[var(--color-surface-high)] pt-3">
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dim)] flex items-center justify-center text-[10.5px] font-bold text-[var(--color-on-primary)] flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-[var(--color-on-surface)] truncate">{user?.display_name ?? '…'}</p>
              <p className="text-[10px] uppercase tracking-wider text-[var(--color-outline)] truncate">{user?.role?.replace('_', ' ') ?? ''}</p>
            </div>
            <button id="logout-btn" onClick={logout} title="Sign out"
              className="w-6 h-6 flex items-center justify-center text-[var(--color-outline)] hover:text-[var(--color-error)] transition-colors">
              <SignOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-14 bg-[var(--color-surface-pure)] border-b border-[var(--color-surface-high)] flex items-center px-4 gap-3 sticky top-0 z-30">
          <button id="sidebar-toggle" className="md:hidden flex items-center justify-center w-8 h-8 rounded-[var(--radius-md)] hover:bg-[var(--color-surface-low)] transition-colors" onClick={() => setOpen(v => !v)}>
            <List size={20} color="var(--color-on-surface-var)" />
          </button>

          <p className="text-[12.5px] font-semibold text-[var(--color-on-surface-var)] capitalize hidden md:block">
            {pathname === '/' ? 'Dashboard' : pathname.split('/').filter(Boolean).join(' › ')}
          </p>

          <div className="flex-1" />

          {/* Search */}
          <div className="hidden sm:flex items-center gap-2 bg-[var(--color-surface-low)] border border-[var(--color-outline-var)]/20 rounded-[var(--radius-md)] px-3 py-1.5 w-48">
            <MagnifyingGlass size={14} color="var(--color-outline)" />
            <input id="global-search" className="bg-transparent text-[12.5px] text-[var(--color-on-surface)] outline-none placeholder:text-[var(--color-outline)] w-full" placeholder="Search…" />
          </div>

          {/* New note shortcut */}
          <button id="topbar-new-btn" onClick={() => router.push('/workspace')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dim)] text-[var(--color-on-primary)] text-[12.5px] font-medium rounded-[var(--radius-md)] hover:opacity-90 transition-opacity">
            <Plus size={15} weight="bold" />
            <span className="hidden sm:inline">New Note</span>
          </button>
        </header>

        {/* Content */}
        <main className="flex-1 p-5 md:p-6 animate-fade-up">
          {children}
        </main>
      </div>
    </div>
  );
}
