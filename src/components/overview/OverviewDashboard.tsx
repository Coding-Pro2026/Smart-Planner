import React, { useMemo, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  BedDouble,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Info,
  ListChecks,
  MapPin,
  PartyPopper,
  Sparkles,
  Store,
  Users,
  Wallet,
} from 'lucide-react';
import type {
  CustomEventModule,
  EventRecord,
  GuestRsvpRecord,
  HotelRoomBlockRecord,
  TaskRecord,
  TaskStatus,
  VendorRecord,
} from '../../types/domain';
import type { BudgetCalculationResult } from '../../lib/deterministicEngine';
import type { Insight, ReadinessReport } from '../../lib/insights';
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, ProgressBar, Skeleton, cx, focusRing } from '../ui/kit';

export type OverviewTab = 'timeline' | 'budget' | 'forecasting' | 'custom_hotels' | 'vendors' | 'checklist' | 'theme_rsvps';

export interface OverviewDashboardProps {
  event: EventRecord;
  /** ISO yyyy-mm-dd used to flag overdue tasks. */
  today: string;
  daysToEvent: number;
  readiness: ReadinessReport;
  budget: BudgetCalculationResult;
  tasks: TaskRecord[];
  /** Non-null when the schedule engine failed (e.g. cyclic dependency). */
  scheduleError?: string | null;
  rsvps: GuestRsvpRecord[];
  confirmedGuests: number;
  vendors: VendorRecord[];
  hotelBlocks: HotelRoomBlockRecord[];
  customModules: CustomEventModule[];
  palette?: { title: string; swatches: { hex: string; name: string }[] };
  isLoading?: boolean;
  onNavigate: (tab: OverviewTab) => void;
  onToggleTask: (taskId: string, next: TaskStatus) => void;
  onOpenCustomModule: (moduleId: string) => void;
  /** Jump to the timeline so the user can fix a schedule error. */
  onFixSchedule?: () => void;
  /** Optional first-run checklist; rendered under the hero when provided. */
  gettingStarted?: React.ReactNode;
  /** Heavy widgets (map, forecast) are rendered below the dashboard. */
  children?: React.ReactNode;
}

/* ------------------------------------------------------------- helpers */

const HEX = /^#[0-9a-fA-F]{3,8}$/;

function makeMoney(currency: string) {
  try {
    const f = new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 0 });
    return (n: number) => f.format(n);
  } catch {
    return (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
  }
}

function shortDate(iso: string | undefined) {
  if (!iso) return '';
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function longDate(iso: string) {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

const sev: Record<Insight['severity'], { icon: typeof Info; chip: string; label: string }> = {
  critical: { icon: AlertOctagon, chip: 'bg-rose-50 text-rose-700 ring-rose-200', label: 'Critical' },
  warning: { icon: AlertTriangle, chip: 'bg-amber-50 text-amber-800 ring-amber-200', label: 'Warning' },
  info: { icon: Info, chip: 'bg-sky-50 text-sky-800 ring-sky-200', label: 'Info' },
  success: { icon: CheckCircle2, chip: 'bg-[#EEF4EF] text-[#2F4A38] ring-[#C9DDCF]', label: 'Good' },
};

function standing(score: number): { label: string; tone: 'good' | 'warn' | 'bad'; ring: string } {
  if (score >= 75) return { label: 'On track', tone: 'good', ring: '#4A6B53' };
  if (score >= 50) return { label: 'Needs attention', tone: 'warn', ring: '#B7791F' };
  return { label: 'At risk', tone: 'bad', ring: '#C2410C' };
}

/* --------------------------------------------------------------- Hero */

function Hero({ p }: { p: OverviewDashboardProps }) {
  const s = standing(p.readiness.score);
  const isBlank = p.tasks.length === 0 && p.budget.items.length === 0 && p.vendors.length === 0 && p.rsvps.length === 0;
  const C = 2 * Math.PI * 42;
  const countdown =
    p.daysToEvent > 0 ? `${p.daysToEvent} day${p.daysToEvent === 1 ? '' : 's'} to go` : p.daysToEvent === 0 ? 'Event day' : 'Event date passed';

  return (
    <Card aria-labelledby="ov-hero-title" className="p-6 lg:p-8">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={isBlank ? 'neutral' : s.tone}>{isBlank ? 'Just getting started' : s.label}</Badge>
            <Badge>{countdown}</Badge>
          </div>
          <h2 id="ov-hero-title" className="text-[28px] leading-9 sm:text-[32px] sm:leading-10 text-stone-900 text-balance">
            {p.event.title}
          </h2>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm leading-5 text-stone-600">
            <li className="inline-flex items-center gap-2">
              <CalendarDays aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span className="sr-only">Date: </span>
              {longDate(p.event.date)}
            </li>
            <li className="inline-flex items-center gap-2 min-w-0">
              <MapPin aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span className="sr-only">Location: </span>
              <span className="truncate">{p.event.location}</span>
            </li>
            <li className="inline-flex items-center gap-2">
              <Users aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span className="tabular-nums">{p.event.guest_count}</span> guests
            </li>
          </ul>
        </div>

        <div className="flex items-center gap-6 sm:gap-8 shrink-0">
          <div className="relative h-28 w-28 shrink-0" role="img" aria-label={`Readiness score ${p.readiness.score} out of 100, grade ${p.readiness.grade}`}>
            <svg viewBox="0 0 100 100" className="h-28 w-28 -rotate-90" aria-hidden="true">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#e7e5e4" strokeWidth="8" />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke={s.ring}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - Math.max(0, Math.min(100, Number(p.readiness.score) || 0)) / 100)}
                className="transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none"
              />
            </svg>
            <div aria-hidden="true" className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-[28px] leading-8 font-semibold tabular-nums text-stone-900">{p.readiness.score}</span>
              <span className="text-xs font-medium uppercase tracking-[0.08em] text-stone-600">Grade {p.readiness.grade}</span>
            </div>
          </div>

          <ul className="w-44 space-y-3" aria-label="Readiness by area">
            {p.readiness.pillars.map((pl) => (
              <li key={pl.label} className="space-y-1">
                <div className="flex items-baseline justify-between text-xs leading-4">
                  <span className="font-medium text-stone-700">{pl.label}</span>
                  <span className="font-mono tabular-nums text-stone-600">{pl.score}</span>
                </div>
                <ProgressBar value={pl.score} label={`${pl.label} readiness`} tone={pl.score >= 75 ? 'good' : pl.score >= 50 ? 'warn' : 'bad'} className="!h-1.5" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}

/* ----------------------------------------------------------- KPI cards */

function Kpi({
  icon,
  label,
  value,
  sub,
  progress,
  tone = 'good',
  cta,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub: React.ReactNode;
  progress?: number;
  tone?: 'good' | 'warn' | 'bad';
  cta: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'group text-left w-full rounded-2xl bg-white border border-stone-200 p-5 shadow-[0_1px_2px_rgba(28,25,23,0.04)]',
        'transition-[box-shadow,border-color,transform] duration-200 hover:border-stone-300 hover:shadow-[0_4px_16px_-4px_rgba(28,25,23,0.12)]',
        'active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100',
        focusRing
      )}
    >
      <span className="flex items-center justify-between text-stone-600">
        <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.08em]">
          <span aria-hidden="true">{icon}</span>
          {label}
        </span>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-[#3B5943] opacity-0 -translate-x-1 transition-[opacity,transform] group-hover:opacity-100 group-hover:translate-x-0 group-focus-visible:opacity-100 group-focus-visible:translate-x-0 motion-reduce:transition-none">
          {cta} <ArrowRight aria-hidden="true" className="h-3 w-3" />
        </span>
      </span>
      <span className="mt-3 block font-mono text-2xl leading-8 font-semibold tabular-nums text-stone-900">{value}</span>
      <span className="mt-1 block text-sm leading-5 text-stone-600">{sub}</span>
      {progress !== undefined && <ProgressBar value={progress} label={`${label} progress`} tone={tone} className="mt-4" />}
    </button>
  );
}

/* --------------------------------------------------------- Attention list */

function Attention({ p }: { p: OverviewDashboardProps }) {
  const items = p.readiness.insights.slice(0, 4);
  return (
    <Card aria-labelledby="ov-attn" className="p-6 lg:col-span-7">
      <CardHeader id="ov-attn" eyebrow="Next best actions" title="What needs your attention" />
      <div className="mt-4">
        {items.length === 0 ? (
          <EmptyState icon={<Sparkles className="h-5 w-5" />} title="Nothing needs attention" body="Add tasks, vendors or guests and we'll flag risks here." />
        ) : (
          <ul className="-mx-2 divide-y divide-stone-100">
            {items.map((i) => {
              const { icon: Icon, chip, label } = sev[i.severity];
              const tab = i.tab;
              const body = (
                <>
                  <span className={cx('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset', chip)}>
                    <Icon aria-hidden="true" className="h-4 w-4" />
                    <span className="sr-only">{label}: </span>
                  </span>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block text-sm font-medium leading-5 text-stone-900">{i.title}</span>
                    <span className="block text-sm leading-5 text-stone-600">{i.detail}</span>
                  </span>
                  {tab && <ArrowRight aria-hidden="true" className="mt-2 h-4 w-4 shrink-0 text-stone-500 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />}
                </>
              );
              return (
                <li key={i.id}>
                  {tab ? (
                    <button
                      type="button"
                      onClick={() => p.onNavigate(tab)}
                      className={cx('group flex w-full items-start gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-stone-50 active:bg-stone-100', focusRing)}
                    >
                      {body}
                    </button>
                  ) : (
                    <div className="flex items-start gap-3 px-2 py-3">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------- Up next list */

function UpNext({ p }: { p: OverviewDashboardProps }) {
  // Tasks ticked in this view stay visible (struck through) so a mis-click can be undone.
  const [justDone, setJustDone] = useState<ReadonlySet<string>>(() => new Set());
  const done = p.tasks.filter((t) => t.status === 'completed').length;

  const list = useMemo(
    () =>
      p.tasks
        .filter((t) => t.status !== 'completed' || justDone.has(t.id))
        .sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'))
        .slice(0, 5),
    [p.tasks, justDone]
  );

  const toggle = (t: TaskRecord) => {
    const isDone = t.status === 'completed';
    if (!isDone) setJustDone((prev) => new Set(prev).add(t.id));
    p.onToggleTask(t.id, isDone ? 'todo' : 'completed');
  };

  return (
    <Card aria-labelledby="ov-next" className="p-6 lg:col-span-5">
      <CardHeader
        id="ov-next"
        eyebrow="Schedule"
        title="Up next"
        action={
          p.tasks.length > 0 ? (
            <span className="font-mono text-sm tabular-nums text-stone-600" aria-live="polite">
              {done}/{p.tasks.length} done
            </span>
          ) : undefined
        }
      />
      <div className="mt-4">
        {p.scheduleError ? (
          <ErrorState
            announce={false}
            title="Schedule couldn't be calculated"
            body={`${p.scheduleError} Fix the circular dependency in the timeline.`}
            onRetry={p.onFixSchedule ?? (() => p.onNavigate('timeline'))}
            retryLabel="Fix in timeline"
          />
        ) : p.tasks.length === 0 ? (
          <EmptyState
            icon={<ListChecks className="h-5 w-5" />}
            title="No tasks yet"
            body="Generate a milestone plan and we'll track the critical path for you."
            action={<Button variant="primary" onClick={() => p.onNavigate('timeline')}>Build schedule</Button>}
          />
        ) : list.length === 0 ? (
          <EmptyState icon={<PartyPopper className="h-5 w-5" />} title="Every task is complete" body="Nothing left on the schedule. Enjoy the event!" />
        ) : (
          <ul className="-mx-2">
            {list.map((t) => {
              const isDone = t.status === 'completed';
              const overdue = !isDone && !!t.due_date && t.due_date < p.today;
              return (
                <li key={t.id}>
                  <label className="group flex cursor-pointer items-start gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-stone-50">
                    <input type="checkbox" className="peer sr-only" checked={isDone} onChange={() => toggle(t)} />
                    <span
                      aria-hidden="true"
                      className={cx(
                        'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-stone-400 bg-white text-white transition-colors',
                        'group-hover:border-[#3B5943] peer-checked:border-[#3B5943] peer-checked:bg-[#3B5943]',
                        'peer-focus-visible:ring-2 peer-focus-visible:ring-[#4A6B53] peer-focus-visible:ring-offset-2'
                      )}
                    >
                      <svg viewBox="0 0 12 12" className={cx('h-3 w-3 transition-opacity', isDone ? 'opacity-100' : 'opacity-0')} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2.5 6.5l2.5 2.5 4.5-5.5" />
                      </svg>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cx('block truncate text-sm font-medium leading-5', isDone ? 'text-stone-500 line-through' : 'text-stone-900')}>{t.title}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs leading-4 text-stone-600">
                        <span className={overdue ? 'font-medium text-rose-700' : ''}>
                          {overdue ? 'Overdue · ' : 'Due '}
                          {shortDate(t.due_date)}
                        </span>
                        {t.is_critical_path && !isDone && <span className="font-medium text-[#8C6226]">Critical path</span>}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {!p.scheduleError && p.tasks.length > 0 && (
        <Button variant="ghost" className="mt-2 -ml-3" onClick={() => p.onNavigate('timeline')}>
          Open full schedule <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Button>
      )}
    </Card>
  );
}

/* ------------------------------------------------------- Logistics cards */

function Hotels({ p, money }: { p: OverviewDashboardProps; money: (n: number) => string }) {
  const booked = p.hotelBlocks.reduce((s, b) => s + b.rooms_booked, 0);
  const blocked = p.hotelBlocks.reduce((s, b) => s + b.rooms_blocked, 0);
  return (
    <Card aria-labelledby="ov-hotels" className="p-6 lg:col-span-6">
      <CardHeader
        id="ov-hotels"
        eyebrow="Accommodation"
        title="Room blocks"
        action={blocked > 0 ? <span className="font-mono text-sm tabular-nums text-stone-600">{booked}/{blocked} rooms</span> : undefined}
      />
      <div className="mt-4">
        {p.hotelBlocks.length === 0 ? (
          <EmptyState
            icon={<BedDouble className="h-5 w-5" />}
            title="No room blocks yet"
            body="Find hotels near the venue and hold a block for out-of-town guests."
            action={<Button variant="primary" onClick={() => p.onNavigate('custom_hotels')}>Find hotels</Button>}
          />
        ) : (
          <>
            <ul className="divide-y divide-stone-100">
              {p.hotelBlocks.slice(0, 3).map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium leading-5 text-stone-900">{h.hotel_name}</p>
                    <p className="truncate text-sm leading-5 text-stone-600">
                      {h.room_type} · {h.nights} night{h.nights === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-sm font-medium tabular-nums text-stone-900">{money(h.nightly_rate)}/night</p>
                    <p className="font-mono text-xs tabular-nums text-stone-600">{h.rooms_booked}/{h.rooms_blocked} booked</p>
                  </div>
                </li>
              ))}
            </ul>
            <Button variant="ghost" className="mt-2 -ml-3" onClick={() => p.onNavigate('custom_hotels')}>
              Manage room blocks <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}

function CustomTabs({ p }: { p: OverviewDashboardProps }) {
  const first = p.customModules[0];
  return (
    <Card aria-labelledby="ov-custom" className="p-6 lg:col-span-6">
      <CardHeader
        id="ov-custom"
        eyebrow={`Tailored for ${p.event.event_type}`}
        title={first?.category_title ?? 'Event-specific plans'}
        action={p.customModules.length > 0 ? <span className="font-mono text-sm tabular-nums text-stone-600">{p.customModules.length} tabs</span> : undefined}
      />
      <div className="mt-4">
        {!first ? (
          <EmptyState
            icon={<ClipboardList className="h-5 w-5" />}
            title="No custom plans yet"
            body="Add run-of-show, speaking order or itinerary tabs built for this event."
            action={<Button variant="primary" onClick={() => p.onNavigate('custom_hotels')}>Add a plan</Button>}
          />
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {p.customModules.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => p.onOpenCustomModule(m.id)}
                  className={cx(
                    'h-8 rounded-lg bg-stone-100 px-3 text-sm font-medium text-stone-800 transition-[background-color,transform] hover:bg-stone-200 active:scale-[0.98] motion-reduce:transition-none',
                    focusRing
                  )}
                >
                  {m.category_title} <span className="font-mono text-xs tabular-nums text-stone-600">{m.items.length}</span>
                </button>
              ))}
            </div>
            {first.items.length > 0 && (
              <ol className="mt-4 divide-y divide-stone-100 border-t border-stone-100">
                {first.items.slice(0, 4).map((it, idx) => (
                  <li key={it.id} className="flex items-center justify-between gap-4 py-2.5">
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="w-5 font-mono text-xs tabular-nums text-stone-600">{idx + 1}</span>
                      <span className="truncate text-sm leading-5 text-stone-900">{it.title}</span>
                    </span>
                    <span className="shrink-0 text-xs text-stone-600">{it.role_or_day}</span>
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------- Skeleton */

export function OverviewSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading overview" className="space-y-6">
      <Card className="p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:justify-between">
          <div className="space-y-4">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-10 w-80 max-w-full" />
            <Skeleton className="h-5 w-96 max-w-full" />
          </div>
          <Skeleton className="h-28 w-72 max-w-full" />
        </div>
      </Card>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="space-y-3 p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-2 w-full" />
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Card className="space-y-4 p-6 lg:col-span-7">
          <Skeleton className="h-6 w-48" />
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </Card>
        <Card className="space-y-4 p-6 lg:col-span-5">
          <Skeleton className="h-6 w-32" />
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
        </Card>
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/* ------------------------------------------------------------ Dashboard */

export function OverviewDashboard(p: OverviewDashboardProps) {
  const money = useMemo(() => makeMoney(p.event.currency), [p.event.currency]);

  if (p.isLoading) return <OverviewSkeleton />;

  const b = p.budget;
  const over = b.statusLevel === 'CRITICAL_OVER_BUDGET';
  const budgetTone = over ? 'bad' : b.statusLevel === 'WARNING_85' ? 'warn' : 'good';
  const hasBudget = b.items.length > 0;

  const pendingRsvps = p.rsvps.filter((r) => r.status === 'pending').length;
  const guestPct = p.event.guest_count > 0 ? (p.confirmedGuests / p.event.guest_count) * 100 : 0;

  const booked = p.vendors.filter((v) => v.status === 'booked').length;
  const vendorPct = p.vendors.length > 0 ? (booked / p.vendors.length) * 100 : 0;

  const done = p.tasks.filter((t) => t.status === 'completed').length;
  const overdue = p.tasks.filter((t) => t.status !== 'completed' && t.due_date && t.due_date < p.today).length;

  return (
    <div className="pg-stagger space-y-6">
      <Hero p={p} />

      {p.gettingStarted}

      <section aria-label="Key metrics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          icon={<Wallet className="h-4 w-4" />}
          label="Budget"
          value={hasBudget ? money(b.totalProjectedSpend) : money(0)}
          sub={
            hasBudget
              ? over
                ? `${money(Math.abs(b.remainingBudget))} over ${money(b.targetBudget)} target`
                : `${money(Math.max(0, b.remainingBudget))} left of ${money(b.targetBudget)}`
              : 'No line items yet. Add costs to start tracking.'
          }
          progress={hasBudget ? b.burnRatePct : 0}
          tone={budgetTone}
          cta="Line items"
          onClick={() => p.onNavigate('budget')}
        />
        <Kpi
          icon={<ListChecks className="h-4 w-4" />}
          label="Tasks"
          value={`${done}/${p.tasks.length}`}
          sub={p.tasks.length === 0 ? 'No tasks scheduled yet' : overdue > 0 ? `${overdue} overdue` : 'Nothing overdue'}
          progress={p.tasks.length ? (done / p.tasks.length) * 100 : 0}
          tone={overdue > 0 ? 'warn' : 'good'}
          cta="Schedule"
          onClick={() => p.onNavigate('timeline')}
        />
        <Kpi
          icon={<Users className="h-4 w-4" />}
          label="Guests confirmed"
          value={`${p.confirmedGuests}/${p.event.guest_count}`}
          sub={p.rsvps.length === 0 ? 'No RSVPs yet. Add your guest list.' : `${pendingRsvps} household${pendingRsvps === 1 ? '' : 's'} awaiting reply`}
          progress={guestPct}
          cta="Guests"
          onClick={() => p.onNavigate('theme_rsvps')}
        />
        <Kpi
          icon={<Store className="h-4 w-4" />}
          label="Vendors booked"
          value={`${booked}/${p.vendors.length}`}
          sub={p.vendors.length === 0 ? 'No vendors yet. Start your shortlist.' : `${p.vendors.length - booked} still to book`}
          progress={vendorPct}
          cta="Vendors"
          onClick={() => p.onNavigate('vendors')}
        />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Attention p={p} />
        <UpNext p={p} />
        <Hotels p={p} money={money} />
        <CustomTabs p={p} />
      </div>

      {p.palette && p.palette.swatches.length > 0 && (
        <Card aria-labelledby="ov-palette" className="p-6">
          <CardHeader id="ov-palette" eyebrow="Look & feel" title={p.palette.title} />
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {p.palette.swatches.map((s, i) => (
              <li key={`${s.hex}-${i}`} className="flex items-center gap-3">
                <span aria-hidden="true" className="h-8 w-8 shrink-0 rounded-lg ring-1 ring-inset ring-stone-300" style={{ backgroundColor: HEX.test(s.hex) ? s.hex : 'transparent' }} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium leading-5 text-stone-900">{s.name}</span>
                  <span className="block font-mono text-xs uppercase text-stone-600">{s.hex}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {p.children}
    </div>
  );
}
