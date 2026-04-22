'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const next         = searchParams.get('next') ?? '/';

  const [form, setForm]     = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Login failed.'); return; }
      router.push(next);
      router.refresh();
    } catch { setError('Network error.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[var(--color-surface)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="text-2xl font-bold tracking-tight text-[var(--color-on-surface)]">The Quiet Archive</p>
          <p className="text-[11px] uppercase tracking-widest text-[var(--color-outline)] mt-1">Knowledge Workspace</p>
        </div>

        <div className="bg-[var(--color-surface-pure)] rounded-lg shadow-[0_4px_32px_rgba(49,51,46,0.1)] p-8">
          <h1 className="text-xl font-bold text-[var(--color-on-surface)] mb-1">Welcome back</h1>
          <p className="text-[12.5px] text-[var(--color-on-surface-var)] mb-6">Sign in to your workspace.</p>

          {error && (
            <div className="mb-4 px-3.5 py-2.5 bg-[var(--color-error-cnt)]/20 border border-[var(--color-error)]/30 rounded-[var(--radius-md)] text-[12.5px] text-[var(--color-error)]">
              {error}
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-[11px] uppercase tracking-widest font-semibold text-[var(--color-on-surface-var)] mb-1.5">Email</label>
              <input id="login-email" type="email" placeholder="you@archive.void" required
                value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                className="w-full bg-[var(--color-surface-pure)] border border-[var(--color-outline-var)]/40 rounded-[var(--radius-md)] px-3.5 py-2.5 text-[13.5px] text-[var(--color-on-surface)] placeholder:text-[var(--color-outline)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10 transition-colors" />
            </div>
            <div>
              <label htmlFor="login-password" className="block text-[11px] uppercase tracking-widest font-semibold text-[var(--color-on-surface-var)] mb-1.5">Password</label>
              <input id="login-password" type="password" placeholder="••••••••" required
                value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                className="w-full bg-[var(--color-surface-pure)] border border-[var(--color-outline-var)]/40 rounded-[var(--radius-md)] px-3.5 py-2.5 text-[13.5px] text-[var(--color-on-surface)] placeholder:text-[var(--color-outline)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10 transition-colors" />
            </div>

            <button id="login-submit-btn" type="submit" disabled={loading}
              className="w-full mt-2 py-2.5 bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dim)] text-[var(--color-on-primary)] text-[13.5px] font-semibold rounded-[var(--radius-md)] hover:opacity-90 transition-opacity disabled:opacity-50">
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-[var(--color-outline)] mt-4">
          First time? <a href="/setup" className="text-[var(--color-primary)] hover:underline">Set up your archive</a>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
