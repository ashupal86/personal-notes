'use client';
import Link from 'next/link';
import { useEffect } from 'react';
import AppShell from '@/components/AppShell';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[PageError]', error);
  }, [error]);

  return (
    <AppShell>
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-950/30 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-6">
            🔥
          </div>
          <h1 className="text-xl font-bold text-[var(--color-on-surface)] mb-2">
            Something broke
          </h1>
          <p className="text-[13px] text-[var(--color-outline)] mb-1">
            This section of the archive hit an unexpected error.
          </p>
          {error?.digest && (
            <p className="text-[11px] font-mono text-[var(--color-outline)] mb-6">
              #{error.digest}
            </p>
          )}
          <div className="flex items-center justify-center gap-3 mt-6">
            <button
              onClick={reset}
              className="px-5 py-2 bg-[var(--color-primary)] text-white text-[13px] font-bold rounded-xl hover:opacity-90 transition-all"
            >
              Try again
            </button>
            <Link href="/" className="px-5 py-2 bg-[var(--color-surface-low)] border border-[var(--color-surface-high)] text-[var(--color-on-surface)] text-[13px] font-bold rounded-xl hover:bg-[var(--color-surface-mid)] transition-all">
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
