'use client';
import { useState } from 'react';
import AppShell from '@/components/AppShell';

const SECTIONS = [
  {
    title: 'Profile',
    icon: 'person',
    fields: [
      { label: 'Display Name', id: 'setting-display-name', type: 'text', value: 'Researcher', placeholder: 'Your name' },
      { label: 'Email', id: 'setting-email', type: 'email', value: 'researcher@archive.void', placeholder: 'you@example.com' },
      { label: 'Role', id: 'setting-role', type: 'text', value: 'Admin', placeholder: 'Role' },
    ],
  },
  {
    title: 'Appearance',
    icon: 'palette',
    fields: [],
  },
  {
    title: 'Notifications',
    icon: 'notifications',
    fields: [],
  },
  {
    title: 'Security',
    icon: 'security',
    fields: [
      { label: 'Current Password', id: 'setting-current-pw', type: 'password', value: '', placeholder: '••••••••' },
      { label: 'New Password',     id: 'setting-new-pw',     type: 'password', value: '', placeholder: '••••••••' },
    ],
  },
];

const TOGGLES = [
  { label: 'Email notifications',  id: 'toggle-email-notif',  on: true  },
  { label: 'Push notifications',   id: 'toggle-push-notif',   on: false },
  { label: 'Archive auto-sync',    id: 'toggle-auto-sync',    on: true  },
  { label: 'Two-factor auth',      id: 'toggle-2fa',          on: false },
];

function Toggle({ id, on, onChange }: { id: string; on: boolean; onChange: () => void }) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={on}
      onClick={onChange}
      className={`relative w-10 h-5 rounded-full transition-colors ${on ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-surface-high)]'}`}
    >
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}

export default function SettingsPage() {
  const [active, setActive] = useState('Profile');
  const [toggles, setToggles] = useState(TOGGLES);

  const flipToggle = (id: string) => setToggles(ts => ts.map(t => t.id === id ? { ...t, on: !t.on } : t));

  return (
    <AppShell>
      <div className="max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-on-surface)]">Settings</h1>
          <p className="text-[12.5px] text-[var(--color-on-surface-var)] mt-0.5">Manage your archive configuration.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-5 items-start">

          {/* Sidebar tabs */}
          <nav className="bg-[var(--color-surface-pure)] rounded-lg p-2 shadow-[0_1px_24px_rgba(49,51,46,0.05)]">
            {SECTIONS.map(s => (
              <button key={s.title} id={`settings-tab-${s.title.toLowerCase()}`}
                onClick={() => setActive(s.title)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[var(--radius-md)] text-[13px] font-medium transition-colors mb-0.5 ${active === s.title ? 'bg-[var(--color-primary-container)] text-[var(--color-on-primary-cnt)]' : 'text-[var(--color-on-surface-var)] hover:bg-[var(--color-surface-low)]'}`}>
                <span className="mi text-[17px]">{s.icon}</span>
                {s.title}
              </button>
            ))}
          </nav>

          {/* Panel */}
          <div className="bg-[var(--color-surface-pure)] rounded-lg p-5 shadow-[0_1px_24px_rgba(49,51,46,0.05)] space-y-5 animate-fade-up">
            {active === 'Profile' && (
              <>
                {/* Avatar */}
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dim)] flex items-center justify-center text-2xl font-bold text-[var(--color-on-primary)]">R</div>
                  <div>
                    <p className="text-[14px] font-semibold text-[var(--color-on-surface)]">Researcher</p>
                    <p className="text-[12px] text-[var(--color-on-surface-var)]">researcher@archive.void</p>
                    <button className="text-[12px] text-[var(--color-primary)] hover:underline mt-1">Change avatar</button>
                  </div>
                </div>

                <div className="h-px bg-[var(--color-surface-high)]" />

                {SECTIONS[0].fields.map(f => (
                  <div key={f.id}>
                    <label htmlFor={f.id} className="block text-[11px] uppercase tracking-widest font-semibold text-[var(--color-on-surface-var)] mb-1.5">{f.label}</label>
                    <input id={f.id} type={f.type} defaultValue={f.value} placeholder={f.placeholder}
                      className="w-full bg-[var(--color-surface-pure)] border border-[var(--color-outline-var)]/40 rounded-[var(--radius-md)] px-3.5 py-2.5 text-[13.5px] text-[var(--color-on-surface)] placeholder:text-[var(--color-outline)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10 transition-colors" />
                  </div>
                ))}
              </>
            )}

            {active === 'Appearance' && (
              <div>
                <p className="text-[13px] text-[var(--color-on-surface-var)] mb-4">Choose your preferred theme.</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {['Light', 'Dark', 'System'].map(t => (
                    <button key={t} id={`theme-${t.toLowerCase()}`}
                      className={`py-3 rounded-[var(--radius-md)] text-[13px] font-medium transition-colors ${t === 'Light' ? 'bg-[var(--color-primary-container)] text-[var(--color-on-primary-cnt)] ring-2 ring-[var(--color-primary)]/40' : 'bg-[var(--color-surface-low)] text-[var(--color-on-surface-var)] hover:bg-[var(--color-surface-mid)]'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {active === 'Notifications' && (
              <div className="space-y-4">
                {toggles.slice(0, 2).map(t => (
                  <div key={t.id} className="flex items-center justify-between py-2 border-b border-[var(--color-surface-high)] last:border-0">
                    <span className="text-[13.5px] text-[var(--color-on-surface)]">{t.label}</span>
                    <Toggle id={t.id} on={t.on} onChange={() => flipToggle(t.id)} />
                  </div>
                ))}
              </div>
            )}

            {active === 'Security' && (
              <div className="space-y-4">
                {/* Toggles */}
                {toggles.slice(2).map(t => (
                  <div key={t.id} className="flex items-center justify-between py-2 border-b border-[var(--color-surface-high)]">
                    <span className="text-[13.5px] text-[var(--color-on-surface)]">{t.label}</span>
                    <Toggle id={t.id} on={t.on} onChange={() => flipToggle(t.id)} />
                  </div>
                ))}

                <div className="h-px bg-[var(--color-surface-high)]" />

                {SECTIONS[3].fields.map(f => (
                  <div key={f.id}>
                    <label htmlFor={f.id} className="block text-[11px] uppercase tracking-widest font-semibold text-[var(--color-on-surface-var)] mb-1.5">{f.label}</label>
                    <input id={f.id} type={f.type} placeholder={f.placeholder}
                      className="w-full bg-[var(--color-surface-pure)] border border-[var(--color-outline-var)]/40 rounded-[var(--radius-md)] px-3.5 py-2.5 text-[13.5px] text-[var(--color-on-surface)] placeholder:text-[var(--color-outline)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10 transition-colors" />
                  </div>
                ))}
              </div>
            )}

            {/* Save */}
            <div className="flex justify-end pt-2">
              <button id="settings-save-btn" className="flex items-center gap-1.5 px-5 py-2 bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dim)] text-[var(--color-on-primary)] text-[13px] font-medium rounded-[var(--radius-md)] hover:opacity-90 transition-opacity">
                <span className="mi text-[15px]">save</span>Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
