'use client';
import Link from 'next/link';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <html>
      <body className="min-h-screen bg-[var(--color-surface)] flex items-center justify-center px-6" style={{ fontFamily: 'system-ui, sans-serif' }}>
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">⚠️</div>
          <h1 className="text-2xl font-bold mb-3" style={{ color: 'var(--color-on-surface, #1a1a1a)' }}>
            Something went wrong
          </h1>
          <p className="text-[14px] mb-2" style={{ color: 'var(--color-outline, #666)' }}>
            An unexpected error occurred. The error has been logged.
          </p>
          {error?.digest && (
            <p className="text-[11px] font-mono mb-6" style={{ color: 'var(--color-outline, #666)' }}>
              Error ID: {error.digest}
            </p>
          )}
          <div className="flex items-center justify-center gap-3 mt-6">
            <button
              onClick={reset}
              className="px-6 py-2.5 text-white text-[13.5px] font-bold rounded-xl"
              style={{ background: 'var(--color-primary, #005fad)' }}
            >
              Try again
            </button>
            <Link href="/" className="px-6 py-2.5 text-[13.5px] font-bold rounded-xl border" style={{ color: 'var(--color-on-surface, #1a1a1a)', borderColor: 'var(--color-surface-high, #e5e5e5)' }}>
              Go home
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
