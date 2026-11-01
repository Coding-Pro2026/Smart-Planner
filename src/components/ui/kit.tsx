import React from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Small design kit for the redesigned screens (shadcn-style: unstyled-by-default
 * primitives composed with Tailwind classes, no runtime dependency).
 *
 * Spacing follows a 4px base / 8px rhythm (p-4, p-6, gap-2, gap-4, gap-6).
 * Text on white is never lighter than stone-600 (>= 7:1); sage/gold accents
 * use the AA-checked darker shades (#3B5943, #8C6226).
 */

export const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

export const focusRing =
  'outline-none focus-visible:ring-2 focus-visible:ring-[#4A6B53] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-stone-900';

/* ----------------------------------------------------------------- Card */

export function Card({
  as: Tag = 'section',
  className,
  interactive,
  children,
  ...rest
}: React.HTMLAttributes<HTMLElement> & { as?: 'section' | 'div' | 'article'; interactive?: boolean }) {
  return (
    <Tag
      {...rest}
      className={cx(
        'bg-white border border-stone-200 rounded-2xl shadow-[0_1px_2px_rgba(28,25,23,0.04)]',
        'transition-[box-shadow,border-color] duration-200 motion-reduce:transition-none',
        interactive && 'hover:border-stone-300 hover:shadow-[0_4px_16px_-4px_rgba(28,25,23,0.12)]',
        className
      )}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({
  id,
  eyebrow,
  title,
  action,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-stone-600 leading-4">{eyebrow}</p>
        )}
        <h3 id={id} className="text-base font-semibold tracking-[-0.01em] text-stone-900 leading-6 mt-0.5">
          {title}
        </h3>
      </div>
      {action}
    </header>
  );
}

/* --------------------------------------------------------------- Buttons */

type Variant = 'primary' | 'secondary' | 'ghost';
const variants: Record<Variant, string> = {
  primary: 'bg-[#3B5943] text-white hover:bg-[#314a38] active:bg-[#294031] shadow-sm',
  secondary: 'bg-white text-stone-900 border border-stone-300 hover:bg-stone-50 hover:border-stone-400 active:bg-stone-100',
  ghost: 'text-[#3B5943] dark:text-emerald-300 hover:bg-[#EEF4EF] active:bg-[#DFECE2]',
};

export function Button({
  variant = 'secondary',
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg text-sm font-medium leading-5',
        'transition-[background-color,border-color,transform] duration-150 active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100',
        'disabled:opacity-50 disabled:pointer-events-none',
        focusRing,
        variants[variant],
        className
      )}
    >
      {children}
    </button>
  );
}

/* ----------------------------------------------------------------- Badge */

type Tone = 'neutral' | 'good' | 'warn' | 'bad';
const tones: Record<Tone, string> = {
  neutral: 'bg-stone-100 text-stone-700 ring-stone-200 dark:bg-stone-800 dark:text-stone-200 dark:ring-stone-700',
  good: 'bg-[#EEF4EF] text-[#2F4A38] ring-[#C9DDCF] dark:bg-emerald-950 dark:text-emerald-200 dark:ring-emerald-800',
  warn: 'bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-800',
  bad: 'bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-950 dark:text-rose-200 dark:ring-rose-800',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={cx('inline-flex items-center gap-1 h-6 px-2 rounded-md text-xs font-medium ring-1 ring-inset', tones[tone])}>
      {children}
    </span>
  );
}

/* -------------------------------------------------------------- Progress */

export function ProgressBar({
  value,
  label,
  tone = 'good',
  className,
}: {
  value: number;
  label: string;
  tone?: Exclude<Tone, 'neutral'>;
  className?: string;
}) {
  const pct = Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 0;
  const fill = tone === 'good' ? 'bg-[#4A6B53]' : tone === 'warn' ? 'bg-amber-600' : 'bg-rose-600';
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={cx('h-2 w-full rounded-full bg-stone-100 overflow-hidden', className)}
    >
      <div
        className={cx('h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none', fill)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/* --------------------------------------------------------------- Skeleton */

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cx('animate-pulse motion-reduce:animate-none rounded-md bg-stone-200/70', className)} />;
}

/* ---------------------------------------------------- Empty / Error states */

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center gap-3 rounded-xl border border-dashed border-stone-300 bg-stone-50/60 px-6 py-8">
      <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-stone-600 ring-1 ring-stone-200">
        {icon}
      </span>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-stone-900 leading-5">{title}</p>
        <p className="text-sm text-stone-600 leading-5 max-w-[32ch] mx-auto">{body}</p>
      </div>
      {action}
    </div>
  );
}

export function ErrorState({
  title,
  body,
  onRetry,
  retryLabel = 'Try again',
  announce = true,
}: {
  title: string;
  body: string;
  onRetry?: () => void;
  retryLabel?: string;
  /** Set false when another live alert already announces the same problem. */
  announce?: boolean;
}) {
  return (
    <div role={announce ? 'alert' : undefined} className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-800 dark:bg-rose-950">
      <AlertTriangle aria-hidden="true" className="h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300 mt-0.5" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-semibold text-rose-900 dark:text-rose-100 leading-5">{title}</p>
        <p className="text-sm text-rose-800 dark:text-rose-200 leading-5">{body}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry} className="shrink-0 !h-8 !px-3">
          {retryLabel}
        </Button>
      )}
    </div>
  );
}

/* ------------------------------------------------------- Page-level chrome */

/** Header card shared by every workspace tab: eyebrow, h2, description, optional stat + actions. */
export function PageHeader({
  icon,
  eyebrow,
  title,
  description,
  stat,
  actions,
  children,
}: {
  icon?: React.ReactNode;
  eyebrow: string;
  title: string;
  description?: React.ReactNode;
  stat?: { value: React.ReactNode; label: string };
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <Card aria-labelledby="page-title" className="p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0 max-w-2xl space-y-2">
          <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.08em] text-stone-600 leading-4">
            {icon && <span aria-hidden="true">{icon}</span>}
            {eyebrow}
          </p>
          <h2 id="page-title" className="text-2xl leading-8 sm:text-[28px] sm:leading-9 text-stone-900 text-balance">
            {title}
          </h2>
          {description && <p className="text-sm leading-5 text-stone-600">{description}</p>}
        </div>
        {stat && (
          <div className="text-right">
            <p className="font-mono text-2xl leading-8 font-semibold tabular-nums text-stone-900">{stat.value}</p>
            <p className="text-sm leading-5 text-stone-600">{stat.label}</p>
          </div>
        )}
        {actions && <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children && <div className="mt-6">{children}</div>}
    </Card>
  );
}

export const inputCls = cx(
  'h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-900 placeholder:text-stone-500',
  'transition-[border-color,box-shadow] duration-150 hover:border-stone-400 motion-reduce:transition-none',
  'focus-visible:border-[#4A6B53] focus-visible:ring-2 focus-visible:ring-[#4A6B53]/30 outline-none',
  'disabled:opacity-50 disabled:cursor-not-allowed'
);

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cx('block space-y-1.5', className)}>
      <span className="block text-sm font-medium leading-5 text-stone-800">{label}</span>
      {children}
      {hint && <span className="block text-xs leading-4 text-stone-600">{hint}</span>}
    </label>
  );
}

/* ------------------------------------------------------------------ Modal */

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Focus management shared by every dialog: moves focus in on open ([data-autofocus] first), traps Tab,
 * closes on Escape (unless locked), locks page scroll and restores focus on close.
 */
export function useDialogFocus(open: boolean, panel: React.RefObject<HTMLElement | null>, onClose: () => void, locked = false) {
  const onCloseRef = React.useRef(onClose);
  const lockedRef = React.useRef(locked);
  onCloseRef.current = onClose;
  lockedRef.current = locked;

  React.useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const root = panel.current;
    const first = root?.querySelector<HTMLElement>('[data-autofocus]') ?? root?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? root)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !lockedRef.current) {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panel.current) return;
      const nodes = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (nodes.length === 0) {
        e.preventDefault();
        return;
      }
      const firstEl = nodes[0];
      const lastEl = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
      previous?.focus?.();
    };
  }, [open, panel]);
}

/** Accessible modal dialog: role="dialog" + aria-modal, labelled by its title, plus useDialogFocus. */
export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  locked = false,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  /** While true (e.g. a request is in flight) Escape/backdrop/close do nothing. */
  locked?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const panel = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  useDialogFocus(open, panel, onClose, locked);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !locked) onClose();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="max-h-[90vh] w-full max-w-lg space-y-5 overflow-y-auto rounded-2xl border border-stone-200 bg-white p-6 shadow-[0_24px_64px_-16px_rgba(28,25,23,0.35)] outline-none"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {eyebrow && <p className="text-xs font-medium uppercase tracking-[0.08em] text-stone-600">{eyebrow}</p>}
            <h3 id={titleId} className="mt-0.5 text-lg font-semibold leading-7 tracking-[-0.01em] text-stone-900">
              {title}
            </h3>
          </div>
          <button
            type="button"
            aria-label="Close dialog"
            disabled={locked}
            onClick={onClose}
            className={cx('-m-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-stone-600 hover:bg-stone-100 hover:text-stone-900 disabled:opacity-50', focusRing)}
          >
            <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>
        <div className="text-sm leading-5 text-stone-600">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

/** Inline status/error message that is announced to assistive tech and dismissible. */
export function Notice({
  kind,
  children,
  onDismiss,
}: {
  kind: 'success' | 'error';
  children: React.ReactNode;
  onDismiss?: () => void;
}) {
  const ok = kind === 'success';
  return (
    <div
      role={ok ? 'status' : 'alert'}
      className={cx(
        'flex items-start justify-between gap-3 rounded-xl border p-4 text-sm leading-5',
        ok
          ? 'border-[#C9DDCF] bg-[#EEF4EF] text-[#2F4A38] dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
          : 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200'
      )}
    >
      <span>{children}</span>
      {onDismiss && (
        <button type="button" aria-label="Dismiss message" onClick={onDismiss} className={cx('-m-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-black/5', focusRing)}>
          <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
            <path d="M3 3l10 10M13 3L3 13" />
          </svg>
        </button>
      )}
    </div>
  );
}

export const HEX_RE = /^#[0-9a-fA-F]{3,8}$/;
