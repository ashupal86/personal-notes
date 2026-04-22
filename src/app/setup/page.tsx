'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SetupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '', display_name: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Setup failed.'); return; }
      router.push('/');
    } catch { setError('Network error.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[var(--color-surface)] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <p className="text-2xl font-bold tracking-tight text-[var(--color-on-surface)]">The Quiet Archive</p>
          <p className="text-[11px] uppercase tracking-widest text-[var(--color-outline)] mt-1">First-Time Setup</p>
        </div>

        <div className="bg-[var(--color-surface-pure)] rounded-lg shadow-[0_4px_32px_rgba(49,51,46,0.1)] p-8">
          <h1 className="text-xl font-bold text-[var(--color-on-surface)] mb-1">Create Super Admin</h1>
          <p className="text-[12.5px] text-[var(--color-on-surface-var)] mb-6">
            This runs once. The account created here will have full access to everything.
          </p>

          {error && (
            <div className="mb-4 px-3.5 py-2.5 bg-[var(--color-error-cnt)]/20 border border-[var(--color-error)]/30 rounded-[var(--radius-md)] text-[12.5px] text-[var(--color-error)]">
              {error}
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            {[
              { id: 'setup-name',     key: 'display_name', label: 'Display Name', type: 'text',     placeholder: 'e.g. Researcher' },
              { id: 'setup-email',    key: 'email',         label: 'Email',        type: 'email',    placeholder: 'admin@archive.void' },
              { id: 'setup-password', key: 'password',      label: 'Password',     type: 'password', placeholder: 'Min 8 characters' },
            ].map(f => (
              <div key={f.key}>
                <label htmlFor={f.id} className="block text-[11px] uppercase tracking-widest font-semibold text-[var(--color-on-surface-var)] mb-1.5">
                  {f.label}
                </label>
                <input
                  id={f.id} type={f.type} placeholder={f.placeholder} required
                  value={form[f.key as keyof typeof form]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full bg-[var(--color-surface-pure)] border border-[var(--color-outline-var)]/40 rounded-[var(--radius-md)] px-3.5 py-2.5 text-[13.5px] text-[var(--color-on-surface)] placeholder:text-[var(--color-outline)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10 transition-colors"
                />
              </div>
            ))}

            <button id="setup-submit-btn" type="submit" disabled={loading}
              className="w-full mt-2 py-2.5 bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dim)] text-[var(--color-on-primary)] text-[13.5px] font-semibold rounded-[var(--radius-md)] hover:opacity-90 transition-opacity disabled:opacity-50">
              {loading ? 'Creating…' : 'Create Super Admin & Continue'}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-[var(--color-outline)] mt-4">
          Already set up? <a href="/login" className="text-[var(--color-primary)] hover:underline">Sign in</a>
        </p>
      </div>
    </div>
  );
}
