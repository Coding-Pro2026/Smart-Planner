/** UTC-only calendar-day arithmetic on `YYYY-MM-DD` strings. No timezones, no DST surprises. */

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_DAY = 86_400_000;

export function dayNumber(iso: string): number {
  const m = ISO.exec(iso);
  if (!m) throw new RangeError(`Invalid ISO date: ${iso}`);
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(t);
  // Reject rollovers such as 2025-02-31.
  if (d.getUTCFullYear() !== Number(m[1]) || d.getUTCMonth() !== Number(m[2]) - 1 || d.getUTCDate() !== Number(m[3])) {
    throw new RangeError(`Invalid calendar date: ${iso}`);
  }
  return Math.round(t / MS_DAY);
}

export function fromDayNumber(n: number): string {
  return new Date(n * MS_DAY).toISOString().slice(0, 10);
}

export const addDays = (iso: string, days: number): string => fromDayNumber(dayNumber(iso) + days);
export const diffDays = (a: string, b: string): number => dayNumber(a) - dayNumber(b);
export const toISODate = (d: Date): string => d.toISOString().slice(0, 10);

/** `T-30` => 30 days before the event; `T+1` => the day after; `T-0` => the day itself. */
export function resolveRelative(eventDate: string, offsetDays: number): string {
  return addDays(eventDate, offsetDays);
}
