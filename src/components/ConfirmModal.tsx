'use client';
import { useEffect, useRef, ReactNode } from 'react';
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import { useNotifications, NotifType } from '@/context/NotificationContext';

// ── Reusable Confirm Modal ─────────────────────────────────────────────────────
interface ConfirmModalProps {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmModal({
  title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false, onConfirm, onCancel,
}: ConfirmModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onCancel]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[500] flex items-center justify-center p-4 animate-fade-up"
      onClick={e => { if (e.target === overlayRef.current) onCancel(); }}
    >
      <div className="bg-[var(--color-surface-pure)] border border-[var(--color-surface-high)] rounded-2xl shadow-2xl p-6 w-full max-w-[400px]">
        {/* Icon */}
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
          danger ? 'bg-red-100 dark:bg-red-950/40' : 'bg-[var(--color-primary-container)]'
        }`}>
          {danger
            ? <AlertCircle size={24} className="text-red-500" />
            : <Info size={24} className="text-[var(--color-primary)]" />
          }
        </div>

        <h2 className="text-[16px] font-bold text-[var(--color-on-surface)] mb-2">{title}</h2>
        <p className="text-[13px] text-[var(--color-on-surface-var)] leading-relaxed mb-6">{message}</p>

        <div className="flex items-center gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-[13px] font-medium text-[var(--color-on-surface-var)] hover:bg-[var(--color-surface-low)] rounded-xl transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-5 py-2 text-[13px] font-bold rounded-xl transition-all shadow-sm ${
              danger
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-[var(--color-primary)] hover:opacity-90 text-white'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Toast Notification Stack ────────────────────────────────────────────────────
const ICONS: Record<NotifType, ReactNode> = {
  success:  <CheckCircle  size={16} className="text-emerald-500 flex-shrink-0" />,
  error:    <AlertCircle  size={16} className="text-red-500 flex-shrink-0" />,
  warning:  <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />,
  info:     <Info          size={16} className="text-[var(--color-primary)] flex-shrink-0" />,
};

const BG: Record<NotifType, string> = {
  success: 'border-emerald-400/30 bg-emerald-50 dark:bg-emerald-950/30',
  error:   'border-red-400/30 bg-red-50 dark:bg-red-950/30',
  warning: 'border-amber-400/30 bg-amber-50 dark:bg-amber-950/30',
  info:    'border-[var(--color-primary)]/20 bg-[var(--color-primary-container)]/40',
};

export function ToastStack() {
  const { toasts, dismissToast } = useNotifications();
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[600] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: 360 }}>
      {[...toasts].reverse().map(t => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-sm animate-fade-up ${BG[t.type]}`}
          style={{ minWidth: 280 }}
        >
          {ICONS[t.type]}
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-[var(--color-on-surface)] leading-tight">{t.title}</p>
            {t.message && <p className="text-[11px] text-[var(--color-on-surface-var)] mt-0.5 leading-snug">{t.message}</p>}
          </div>
          <button
            onClick={() => dismissToast(t.id)}
            className="p-0.5 text-[var(--color-outline)] hover:text-[var(--color-on-surface)] transition-colors flex-shrink-0 mt-0.5"
          >
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}
