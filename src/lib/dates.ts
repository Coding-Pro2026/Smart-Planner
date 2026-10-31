/**
 * Date helpers. All dates are ISO `YYYY-MM-DD` strings handled in UTC so that
 * results never drift with the viewer's timezone or DST.
 */

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysIso(baseIso: string, days: number): string {
  const safeBase = isValidIsoDate(baseIso) ? baseIso : todayIso();
  const d = new Date(`${safeBase}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Math.round(days));
  return d.toISOString().slice(0, 10);
}

/** Whole days from `fromIso` to `toIso` (negative when `toIso` is earlier). */
export function diffDays(fromIso: string, toIso: string): number {
  if (!isValidIsoDate(fromIso) || !isValidIsoDate(toIso)) return 0;
  const a = Date.parse(`${fromIso}T00:00:00Z`);
  const b = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export function formatLongDate(iso: string): string {
  if (!isValidIsoDate(iso)) return iso || '—';
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** Kickoff is always "today" for new plans (never in the past, never hard-coded). */
export function defaultKickoff(today: string = todayIso()): string {
  return today;
}
