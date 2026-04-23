'use client';
import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';
import AppShell from '@/components/AppShell';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { api } from '@/lib/api';
import WorkspaceIcon from '@/components/WorkspaceIcon';
import {
  User as UserIcon, Palette, Shield,
  Users, Folder, Plus, Trash2 as Trash, Settings as SettingsIcon,
  Sun, Moon, Coffee, X, Check, Loader2, ChevronDown, ChevronUp, UserPlus,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface UserRow  { id: string; email: string; display_name: string; role: string; created_at: string; }
interface Workspace { id: string; name: string; slug: string; icon: string; color: string; created_at: string; }
interface Member   { id: string; role: string; user_id: string; users: { id: string; email: string; display_name: string; role: string } }

// ── Workspace member management panel ───────────────────────────
function WorkspaceMembersPanel({ ws, allUsers, currentUserId }: { ws: Workspace; allUsers: UserRow[]; currentUserId?: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [addingId, setAddingId] = useState('');
  const [addError, setAddError] = useState('');

  const { data: members = [], isLoading } = useQuery<Member[]>({
    queryKey: ['ws-members', ws.id],
    queryFn: async () => {
      const r = await api.get<{ success: boolean; data: Member[] }>(`/workspaces/${ws.id}/members`);
      return r.data ?? [];
    },
    enabled: open,
  });

  const addMember = useMutation({
    mutationFn: (userId: string) => api.post(`/workspaces/${ws.id}/members`, { userId, role: 'member' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ws-members', ws.id] }); setAddingId(''); setAddError(''); },
    onError: (e: any) => setAddError(e.message ?? 'Failed to add member'),
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) => api.delete(`/workspaces/${ws.id}/members?userId=${userId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ws-members', ws.id] }),
  });

  const memberIds = new Set(members.map(m => m.user_id));
  const available = allUsers.filter(u => !memberIds.has(u.id));

  return (
    <div className="border-t border-[var(--color-surface-high)] mt-2">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-2.5 text-[12px] font-bold text-[var(--color-outline)] hover:text-[var(--color-primary)] transition-colors"
      >
        <span className="flex items-center gap-1.5"><Users size={13} /> Members {members.length > 0 && `(${members.length})`}</span>
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>

      {open && (
        <div className="px-5 pb-4 space-y-2">
          {isLoading && <p className="text-[12px] text-[var(--color-outline)]">Loading…</p>}

          {members.map(m => (
            <div key={m.user_id} className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dim)] flex items-center justify-center text-[10px] font-bold text-white">
                  {m.users?.display_name?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div>
                  <p className="text-[12.5px] font-semibold text-[var(--color-on-surface)]">{m.users?.display_name}</p>
                  <p className="text-[10.5px] text-[var(--color-outline)]">{m.users?.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-[var(--color-surface-mid)] rounded text-[var(--color-outline)]">{m.role}</span>
                {m.user_id !== currentUserId && (
                  <button
                    onClick={() => removeMember.mutate(m.user_id)}
                    disabled={removeMember.isPending}
                    className="p-1 text-[var(--color-outline)] hover:text-red-500 rounded transition-colors"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Add member row */}
          <div className="flex items-center gap-2 pt-1">
            <select
              className="flex-1 bg-[var(--color-surface-low)] border border-[var(--color-surface-high)] rounded-lg px-3 py-1.5 text-[12px] text-[var(--color-on-surface)] outline-none"
              value={addingId}
              onChange={e => { setAddingId(e.target.value); setAddError(''); }}
            >
              <option value="">Add a user…</option>
              {available.map(u => (
                <option key={u.id} value={u.id}>{u.display_name} ({u.email})</option>
              ))}
            </select>
            <button
              onClick={() => addingId && addMember.mutate(addingId)}
              disabled={!addingId || addMember.isPending}
              className="flex items-center gap-1 px-3 py-1.5 bg-[var(--color-primary)] text-white text-[12px] font-bold rounded-lg disabled:opacity-40 hover:opacity-90 transition-all"
            >
              {addMember.isPending ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />}
              Add
            </button>
          </div>
          {addError && <p className="text-[11px] text-red-500">{addError}</p>}
        </div>
      )}
    </div>
  );
}

const ROLE_WEIGHT: Record<string, number> = { super_admin: 3, admin: 2, user: 1 };

// ── tiny reusable field ──────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-widest font-bold text-[var(--color-outline)] mb-1.5">{label}</label>
      {children}
    </div>
  );
}
const inputCls = 'w-full bg-[var(--color-surface-low)] border border-[var(--color-surface-high)] rounded-xl px-4 py-2.5 text-[13.5px] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all text-[var(--color-on-surface)]';

// ── Sky background toggle ─────────────────────────────────────────
function SkyBgToggle() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    try { setOn(localStorage.getItem('pref_time_banner') !== 'false'); } catch {}
  }, []);

  const toggle = () => {
    const next = !on;
    setOn(next);
    try { localStorage.setItem('pref_time_banner', String(next)); } catch {}
    window.dispatchEvent(new CustomEvent('time-banner-toggle', { detail: next }));
  };

  return (
    <div className="flex items-center justify-between py-4 border-t border-[var(--color-surface-high)]">
      <div>
        <p className="text-[13.5px] font-semibold text-[var(--color-on-surface)]">Sky Background</p>
        <p className="text-[12px] text-[var(--color-outline)] mt-0.5">Animated time-of-day sky on the homepage</p>
      </div>
      <button
        id="sky-bg-toggle"
        onClick={toggle}
        aria-checked={on}
        role="switch"
        className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 ${on ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-surface-high)]'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${on ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}

function SettingsPageContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const qc           = useQueryClient();
  const { user, role } = useAuth();
  const { theme, setTheme } = useTheme();

  const tabParam = searchParams.get('tab') || 'profile';
  const [active, setActive] = useState('profile');  // always 'profile' on SSR
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); setActive(tabParam); }, [tabParam]);

  const isAdmin = ROLE_WEIGHT[role ?? 'user'] >= ROLE_WEIGHT['admin'];
  const isSuperAdmin = ROLE_WEIGHT[role ?? 'user'] >= ROLE_WEIGHT['super_admin'];

  const TABS = [
    { id: 'profile',    label: 'Profile',    icon: UserIcon },
    { id: 'appearance', label: 'Appearance', icon: Palette  },
    { id: 'security',   label: 'Security',   icon: Shield   },
    ...(isAdmin ? [{ id: 'workspaces', label: 'Workspaces', icon: Folder }] : []),
    ...(isAdmin ? [{ id: 'users',      label: 'Users',      icon: Users  }] : []),
  ];

  // ── Workspace state ────────────────────────────────────────────
  const [wsForm, setWsForm] = useState({ name: '', icon: 'folder' });
  const [showWsForm, setShowWsForm] = useState(false);
  const [wsError, setWsError] = useState('');

  const { data: workspaces = [], isLoading: wsLoading } = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const r = await api.get<{ success: boolean; data: Workspace[] }>('/workspaces');
      return r.data ?? [];
    },
    enabled: active === 'workspaces' || active === 'users',
  });

  const createWs = useMutation({
    mutationFn: (data: { name: string; icon: string }) => api.post('/workspaces', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workspaces'] });
      setShowWsForm(false);
      setWsForm({ name: '', icon: 'folder' });
      setWsError('');
    },
    onError: (e: any) => setWsError(e.message ?? 'Failed to create workspace'),
  });

  const deleteWs = useMutation({
    mutationFn: (id: string) => api.delete(`/workspaces/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workspaces'] }),
  });

  const handleCreateWs = () => {
    setWsError('');
    if (!wsForm.name.trim()) { setWsError('Workspace name is required.'); return; }
    createWs.mutate(wsForm);
  };

  // ── User state ─────────────────────────────────────────────────
  const [userForm, setUserForm] = useState({ email: '', password: '', display_name: '', role: 'user' });
  const [showUserForm, setShowUserForm] = useState(false);
  const [userError, setUserError] = useState('');

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const r = await api.get<{ success: boolean; data: UserRow[] }>('/users');
      return r.data ?? [];
    },
    enabled: active === 'users' || active === 'workspaces',
  });

  const createUser = useMutation({
    mutationFn: (data: typeof userForm) => api.post('/users', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setShowUserForm(false);
      setUserForm({ email: '', password: '', display_name: '', role: 'user' });
      setUserError('');
    },
    onError: (e: any) => setUserError(e.message ?? 'Failed to create user'),
  });

  const deleteUser = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  const handleCreateUser = () => {
    setUserError('');
    if (!userForm.email.trim())        { setUserError('Email is required.'); return; }
    if (userForm.password.length < 8)  { setUserError('Password must be at least 8 characters.'); return; }
    if (!userForm.display_name.trim()) { setUserError('Display name is required.'); return; }
    createUser.mutate(userForm);
  };

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-[var(--color-primary-container)] text-[var(--color-primary)] rounded-2xl flex items-center justify-center shadow-sm">
            <SettingsIcon size={26} strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--color-on-surface)]">Archive Settings</h1>
            <p className="text-[13px] text-[var(--color-outline)]">Manage your profile, workspaces, and team.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6 items-start">
          {/* Sidebar */}
          <nav className="space-y-1 bg-[var(--color-surface-pure)] p-2 rounded-2xl border border-[var(--color-surface-high)] shadow-sm">
            {/* Render tabs only after mount so SSR+client are identical (role-gated tabs) */}
            {(mounted ? TABS : TABS.slice(0, 3)).map(t => (
              <button
                key={t.id}
                onClick={() => { setActive(t.id); router.push(`/settings?tab=${t.id}`); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-all ${
                  active === t.id
                    ? 'bg-[var(--color-primary)] text-white shadow-md'
                    : 'text-[var(--color-on-surface-var)] hover:bg-[var(--color-surface-low)]'
                }`}
              >
                <t.icon size={16} strokeWidth={active === t.id ? 2.5 : 2} />
                {t.label}
              </button>
            ))}
          </nav>

          {/* Panel */}
          <div className="bg-[var(--color-surface-pure)] rounded-2xl border border-[var(--color-surface-high)] shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--color-surface-high)] bg-[var(--color-surface-mid)]/10">
              <h2 className="text-[15px] font-bold text-[var(--color-on-surface)] capitalize">{active}</h2>
            </div>

            <div className="p-6">

              {/* ── Profile ── */}
              {active === 'profile' && (
                <div className="space-y-6 max-w-md">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dim)] flex items-center justify-center text-2xl font-bold text-white shadow-lg">
                      {mounted ? (user?.display_name?.[0] ?? '?') : '?'}
                    </div>
                    <div>
                      <p className="text-[15px] font-bold text-[var(--color-on-surface)]">{mounted ? (user?.display_name ?? '') : ''}</p>
                      <p className="text-[12px] text-[var(--color-outline)]">{mounted ? (user?.email ?? '') : ''}</p>
                      {mounted && role && (
                        <span className="inline-block mt-1 px-2 py-0.5 bg-[var(--color-primary-container)] text-[var(--color-primary)] text-[9px] font-bold uppercase tracking-wider rounded-md">
                          {role.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                  </div>
                  <Field label="Display Name">
                    <input className={inputCls} defaultValue={mounted ? (user?.display_name || '') : ''} />
                  </Field>
                  <Field label="Email Address">
                    <input className={`${inputCls} opacity-50`} readOnly value={mounted ? (user?.email || '') : ''} />
                  </Field>
                  <button className="bg-[var(--color-primary)] text-white font-bold py-2.5 px-6 rounded-xl text-[13.5px] hover:opacity-90 transition-all">
                    Update Profile
                  </button>
                </div>
              )}

              {/* ── Appearance ── */}
              {active === 'appearance' && (
                <div className="space-y-6">
                  <div>
                    <p className="text-[13px] text-[var(--color-outline)] mb-4">Choose the visual theme for your archive.</p>
                    <div className="grid grid-cols-3 gap-4 max-w-sm">
                      {([
                        { id: 'light', label: 'Light', Icon: Sun,    bg: 'bg-white border-2 border-gray-200' },
                        { id: 'dark',  label: 'Dark',  Icon: Moon,   bg: 'bg-zinc-900' },
                        { id: 'sepia', label: 'Sepia', Icon: Coffee, bg: 'bg-[#f4ecd8] border-2 border-amber-200' },
                      ] as const).map(({ id, label, Icon, bg }) => (
                        <button
                          key={id}
                          id={`theme-${id}`}
                          onClick={() => setTheme(id)}
                          className={`p-5 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${
                            theme === id
                              ? 'border-[var(--color-primary)] shadow-lg shadow-[var(--color-primary)]/20'
                              : 'border-[var(--color-surface-high)] hover:border-[var(--color-primary)]/40'
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-full ${bg} flex items-center justify-center`}>
                            <Icon size={16} className={id === 'dark' ? 'text-white' : 'text-gray-600'} />
                          </div>
                          <span className="text-[12px] font-bold capitalize text-[var(--color-on-surface)]">{label}</span>
                          {theme === id && <Check size={14} className="text-[var(--color-primary)]" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sky Background Toggle */}
                  <SkyBgToggle />
                </div>
              )}

              {/* ── Security ── */}
              {active === 'security' && (
                <div className="space-y-4 max-w-sm">
                  <Field label="Current Password">
                    <input type="password" placeholder="••••••••" className={inputCls} />
                  </Field>
                  <Field label="New Password">
                    <input type="password" placeholder="••••••••" className={inputCls} />
                  </Field>
                  <Field label="Confirm New Password">
                    <input type="password" placeholder="••••••••" className={inputCls} />
                  </Field>
                  <button className="bg-[var(--color-primary)] text-white font-bold py-2.5 px-6 rounded-xl text-[13.5px] hover:opacity-90 transition-all">
                    Change Password
                  </button>
                </div>
              )}

              {/* ── Workspaces ── */}
              {active === 'workspaces' && isAdmin && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] text-[var(--color-outline)]">
                      {workspaces.length} workspace{workspaces.length !== 1 ? 's' : ''}
                    </p>
                    <button
                      onClick={() => { setShowWsForm(v => !v); setWsError(''); }}
                      className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white text-[13px] font-bold rounded-xl shadow-md hover:opacity-90 transition-all"
                    >
                      {showWsForm ? <X size={15} /> : <Plus size={15} strokeWidth={2.5} />}
                      {showWsForm ? 'Cancel' : 'New Workspace'}
                    </button>
                  </div>

                  {/* Inline create form */}
                  {showWsForm && (
                    <div className="bg-[var(--color-surface-low)] rounded-2xl border border-[var(--color-primary)]/30 p-5 space-y-3">
                      <p className="text-[12px] font-bold text-[var(--color-primary)] uppercase tracking-wider">New Workspace</p>
                      <div className="flex gap-3">
                        <div className="w-24">
                          <Field label="Icon">
                            <select
                              className={`${inputCls} px-2`}
                              value={wsForm.icon}
                              onChange={e => setWsForm(f => ({ ...f, icon: e.target.value }))}
                            >
                              <option value="folder">Folder</option>
                              <option value="briefcase">Briefcase</option>
                              <option value="book">Book</option>
                              <option value="code">Code</option>
                              <option value="globe">Globe</option>
                              <option value="star">Star</option>
                            </select>
                          </Field>
                        </div>
                        <div className="flex-1">
                          <Field label="Name">
                            <input
                              id="ws-name-input"
                              className={inputCls}
                              placeholder="e.g. Research"
                              value={wsForm.name}
                              onChange={e => setWsForm(f => ({ ...f, name: e.target.value }))}
                              onKeyDown={e => e.key === 'Enter' && handleCreateWs()}
                              autoFocus
                            />
                          </Field>
                        </div>
                      </div>
                      {wsError && <p className="text-[12px] text-red-500 font-medium">{wsError}</p>}
                      <button
                        id="ws-create-btn"
                        onClick={handleCreateWs}
                        disabled={createWs.isPending}
                        className="flex items-center gap-2 px-5 py-2 bg-[var(--color-primary)] text-white text-[13px] font-bold rounded-xl disabled:opacity-50 hover:opacity-90 transition-all"
                      >
                        {createWs.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        {createWs.isPending ? 'Creating…' : 'Create Workspace'}
                      </button>
                    </div>
                  )}

                  {/* Workspace list */}
                  {wsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 size={22} className="animate-spin text-[var(--color-outline)]" />
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {workspaces.map(ws => (
                        <div key={ws.id} className="bg-[var(--color-surface-low)] rounded-xl border border-[var(--color-surface-high)] hover:border-[var(--color-primary)]/30 transition-all overflow-hidden">
                          <div className="flex items-center justify-between p-4">
                            <div className="flex items-center gap-3">
                              <span className="w-10 h-10 flex items-center justify-center bg-[var(--color-surface-pure)] text-[var(--color-primary)] rounded-xl shadow-sm">
                                <WorkspaceIcon icon={ws.icon} size={20} />
                              </span>
                              <div>
                                <p className="text-[14px] font-bold text-[var(--color-on-surface)]">{ws.name}</p>
                                <p className="text-[11px] text-[var(--color-outline)] font-mono">{ws.slug}</p>
                              </div>
                            </div>
                            {isSuperAdmin && (
                              <button
                                onClick={() => deleteWs.mutate(ws.id)}
                                disabled={deleteWs.isPending}
                                className="p-2 text-[var(--color-outline)] hover:text-red-500 hover:bg-red-50 rounded-lg transition-all disabled:opacity-40 flex items-center gap-1.5 ml-2"
                              >
                                <Trash size={16} />
                                <span className="text-[11px] font-bold">Delete</span>
                              </button>
                            )}
                          </div>
                          {/* Member management — expands inline */}
                          <WorkspaceMembersPanel ws={ws} allUsers={users} currentUserId={user?.id} />
                        </div>
                      ))}
                      {workspaces.length === 0 && (
                        <p className="text-[13px] text-[var(--color-outline)] text-center py-8">No workspaces yet. Create one above.</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Users ── */}
              {active === 'users' && isAdmin && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] text-[var(--color-outline)]">{users.length} team member{users.length !== 1 ? 's' : ''}</p>
                    <button
                      onClick={() => { setShowUserForm(v => !v); setUserError(''); }}
                      className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white text-[13px] font-bold rounded-xl shadow-md hover:opacity-90 transition-all"
                    >
                      {showUserForm ? <X size={15} /> : <Plus size={15} strokeWidth={2.5} />}
                      {showUserForm ? 'Cancel' : 'Create User'}
                    </button>
                  </div>

                  {/* Inline create form */}
                  {showUserForm && (
                    <div className="bg-[var(--color-surface-low)] rounded-2xl border border-[var(--color-primary)]/30 p-5 space-y-3">
                      <p className="text-[12px] font-bold text-[var(--color-primary)] uppercase tracking-wider">New Team Member</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label="Display Name">
                          <input
                            id="user-name-input"
                            className={inputCls}
                            placeholder="Jane Doe"
                            value={userForm.display_name}
                            onChange={e => setUserForm(f => ({ ...f, display_name: e.target.value }))}
                            autoFocus
                          />
                        </Field>
                        <Field label="Email">
                          <input
                            id="user-email-input"
                            type="email"
                            className={inputCls}
                            placeholder="jane@example.com"
                            value={userForm.email}
                            onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))}
                          />
                        </Field>
                        <Field label="Password">
                          <input
                            id="user-password-input"
                            type="password"
                            className={inputCls}
                            placeholder="Min 8 characters"
                            value={userForm.password}
                            onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))}
                          />
                        </Field>
                        <Field label="Role">
                          <select
                            id="user-role-select"
                            className={inputCls}
                            value={userForm.role}
                            onChange={e => setUserForm(f => ({ ...f, role: e.target.value }))}
                          >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                            {isSuperAdmin && <option value="super_admin">Super Admin</option>}
                          </select>
                        </Field>
                      </div>
                      {userError && <p className="text-[12px] text-red-500 font-medium">{userError}</p>}
                      <button
                        id="user-create-btn"
                        onClick={handleCreateUser}
                        disabled={createUser.isPending}
                        className="flex items-center gap-2 px-5 py-2 bg-[var(--color-primary)] text-white text-[13px] font-bold rounded-xl disabled:opacity-50 hover:opacity-90 transition-all"
                      >
                        {createUser.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        {createUser.isPending ? 'Creating…' : 'Create User'}
                      </button>
                    </div>
                  )}

                  {/* User table */}
                  {usersLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 size={22} className="animate-spin text-[var(--color-outline)]" />
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-[var(--color-surface-high)]">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-[var(--color-surface-high)] bg-[var(--color-surface-low)]">
                            <th className="px-5 py-3 text-[10px] uppercase tracking-widest font-bold text-[var(--color-outline)]">Member</th>
                            <th className="px-5 py-3 text-[10px] uppercase tracking-widest font-bold text-[var(--color-outline)]">Role</th>
                            <th className="px-5 py-3 text-[10px] uppercase tracking-widest font-bold text-[var(--color-outline)] text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-surface-high)]">
                          {users.map(u => (
                            <tr key={u.id} className="group hover:bg-[var(--color-surface-low)] transition-colors">
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dim)] flex items-center justify-center text-xs font-bold text-white">
                                    {u.display_name[0]?.toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="text-[13px] font-semibold text-[var(--color-on-surface)]">{u.display_name}</p>
                                    <p className="text-[11px] text-[var(--color-outline)]">{u.email}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 py-3">
                                <span className="px-2 py-0.5 bg-[var(--color-surface-mid)] text-[10px] font-bold uppercase tracking-wider rounded-md text-[var(--color-outline)]">
                                  {u.role.replace('_', ' ')}
                                </span>
                              </td>
                              <td className="px-5 py-3 text-right">
                                {isSuperAdmin && u.id !== user?.id && (
                                  <button
                                    onClick={() => deleteUser.mutate(u.id)}
                                    className="p-1.5 text-[var(--color-outline)] hover:text-red-500 hover:bg-red-50 rounded-lg transition-all flex items-center gap-1.5 ml-auto"
                                  >
                                    <Trash size={15} />
                                    <span className="text-[11px] font-bold">Delete</span>
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                          {users.length === 0 && (
                            <tr>
                              <td colSpan={3} className="px-5 py-10 text-center text-[13px] text-[var(--color-outline)]">
                                No users yet.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center p-20"><Loader2 className="animate-spin text-[var(--color-outline)]" /></div>}>
      <SettingsPageContent />
    </Suspense>
  );
}
