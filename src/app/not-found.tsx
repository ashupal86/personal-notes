import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[var(--color-surface)] flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        {/* Big 404 */}
        <div className="relative mb-8">
          <p className="text-[10rem] font-black leading-none text-[var(--color-surface-high)] select-none">
            404
          </p>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-5xl">🗂️</span>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-[var(--color-on-surface)] mb-3">
          Page not found
        </h1>
        <p className="text-[14px] text-[var(--color-outline)] mb-8 leading-relaxed">
          This page doesn't exist in the archive. It may have been moved, deleted, or you may have followed an external link.
        </p>

        <div className="flex items-center justify-center gap-3">
          <Link
            href="/"
            className="px-6 py-2.5 bg-[var(--color-primary)] text-white text-[13.5px] font-bold rounded-xl hover:opacity-90 transition-all shadow-lg shadow-[var(--color-primary)]/20"
          >
            Go home
          </Link>
          <Link
            href="/workspace"
            className="px-6 py-2.5 bg-[var(--color-surface-pure)] border border-[var(--color-surface-high)] text-[var(--color-on-surface)] text-[13.5px] font-bold rounded-xl hover:bg-[var(--color-surface-low)] transition-all"
          >
            Open workspace
          </Link>
        </div>
      </div>
    </div>
  );
}
