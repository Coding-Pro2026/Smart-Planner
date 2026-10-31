import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  kind: 'success' | 'error' | 'info';
  text: string;
}

export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div
      className="fixed bottom-5 right-5 z-[60] flex flex-col gap-2 w-[min(92vw,360px)]"
      role="region"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((t) => {
        const Icon = t.kind === 'success' ? CheckCircle2 : t.kind === 'error' ? TriangleAlert : Info;
        const tone =
          t.kind === 'success'
            ? 'border-emerald-200 text-emerald-800'
            : t.kind === 'error'
              ? 'border-rose-200 text-rose-800'
              : 'border-stone-200 text-stone-800';
        return (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className={`flex items-start gap-2.5 bg-white border ${tone} rounded-2xl px-4 py-3 shadow-lg text-xs font-medium`}
          >
            <Icon className="w-4 h-4 mt-0.5 shrink-0" />
            <span className="flex-1 leading-relaxed">{t.text}</span>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => onDismiss(t.id)}
              className="text-stone-400 hover:text-stone-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
