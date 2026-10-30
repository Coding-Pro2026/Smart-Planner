"use client";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

export const cn = (...a: Parameters<typeof clsx>) => twMerge(clsx(a));

export function Button({ variant = "primary", size = "md", loading, className, children, disabled, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "outline" | "danger"; size?: "sm" | "md"; loading?: boolean }) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-4 py-2 text-sm",
        variant === "primary" && "bg-brand text-white hover:opacity-90 dark:text-black",
        variant === "outline" && "border border-line bg-card hover:bg-brand-soft",
        variant === "ghost" && "hover:bg-brand-soft",
        variant === "danger" && "bg-bad text-white hover:opacity-90",
        className,
      )}
      {...p}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export const Card = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => <div className={cn("rounded-xl border border-line bg-card p-5 shadow-sm", className)} {...p} />;

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "ok" | "warn" | "bad" | "brand"; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", tone === "neutral" && "bg-line/60 text-muted", tone === "ok" && "bg-ok/15 text-ok", tone === "warn" && "bg-warn/15 text-warn", tone === "bad" && "bg-bad/15 text-bad", tone === "brand" && "bg-brand-soft text-brand")}>
      {children}
    </span>
  );
}

export const Field = ({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) => (
  <label className="block space-y-1 text-sm">
    <span className="font-medium">{label}</span>
    {children}
    {hint && <span className="block text-xs text-muted">{hint}</span>}
  </label>
);

export const Spinner = ({ label }: { label?: string }) => (
  <div className="flex items-center gap-2 text-sm text-muted">
    <Loader2 className="h-4 w-4 animate-spin" /> {label ?? "Loading…"}
  </div>
);

export const ErrorNote = ({ error }: { error: unknown }) => (error ? <p role="alert" className="rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad">{(error as Error).message}</p> : null);

export function Progress({ pct, tone }: { pct: number; tone: "ok" | "warn" | "bad" }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full transition-all", tone === "ok" && "bg-ok", tone === "warn" && "bg-warn", tone === "bad" && "bg-bad")} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className={cn("my-8 w-full rounded-xl border border-line bg-card p-6 shadow-xl", wide ? "max-w-5xl" : "max-w-lg")} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">✕</Button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const sevTone = (s: "ok" | "warning" | "over" | string) => (s === "over" ? "bad" : s === "warning" ? "warn" : "ok") as "ok" | "warn" | "bad";
