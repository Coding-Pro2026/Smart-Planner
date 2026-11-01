import { useMemo } from 'react';
import { AlertCircle, CheckCircle2, Circle, Clock, ClipboardCheck, ExternalLink } from 'lucide-react';
import type { EventRecord, VendorRecord } from '../types/domain';
import { buildVendorChecklist } from '../lib/vendorChecklist';
import { Badge, Card, EmptyState, PageHeader, ProgressBar, cx, focusRing } from './ui/kit';

export function VendorChecklistView({
  event,
  vendors,
  manualDone,
  today,
  targetBudget,
  onToggle,
  onOpenVendors,
}: {
  event: EventRecord;
  vendors: VendorRecord[];
  manualDone: Record<string, boolean>;
  today: string;
  targetBudget: number;
  onToggle: (key: string, next: boolean) => void;
  onOpenVendors: () => void;
}) {
  const rows = useMemo(
    () => buildVendorChecklist(event, vendors, manualDone, today),
    [event, vendors, manualDone, today]
  );
  const booked = rows.filter((r) => r.state === 'booked').length;
  const pct = rows.length ? (booked / rows.length) * 100 : 0;
  const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

  return (
    <section className="space-y-6" aria-label="Vendor checklist">
      <PageHeader
        icon={<ClipboardCheck className="h-4 w-4" />}
        eyebrow="Vendor checklist"
        title={`Who to book for your ${event.event_type}, and when`}
        description={`Booking windows are counted back from ${event.date}. Vendors you analyse in the Vendors tab link automatically; tick anything you booked offline.`}
        stat={{ value: `${booked}/${rows.length}`, label: 'categories booked' }}
      >
        <ProgressBar value={pct} label="Categories booked" />
      </PageHeader>

      {rows.length === 0 ? (
        <EmptyState icon={<ClipboardCheck className="h-5 w-5" />} title="No categories for this event type" body="Open the Vendors tab to add vendors manually." />
      ) : (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {rows.map((r) => {
            const suggested = (targetBudget * r.budgetSharePct) / 100;
            const isBooked = r.state === 'booked';
            const Icon = isBooked ? CheckCircle2 : r.state === 'in_progress' ? Clock : Circle;
            const iconCls = isBooked ? 'text-[#3B5943] dark:text-emerald-300' : r.state === 'in_progress' ? 'text-amber-700 dark:text-amber-300' : 'text-stone-500';
            return (
              <li key={r.key}>
                <Card as="div" interactive className="flex items-start gap-3 p-5">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={isBooked}
                    aria-label={`${r.label}: ${isBooked ? 'booked' : 'not booked'}`}
                    onClick={() => onToggle(r.key, !isBooked)}
                    className={cx('-m-1.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-transform active:scale-90 motion-reduce:transition-none', focusRing)}
                  >
                    <Icon aria-hidden="true" className={cx('h-6 w-6', iconCls)} />
                  </button>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className={cx('text-sm font-semibold leading-5', isBooked ? 'text-stone-500 line-through' : 'text-stone-900')}>{r.label}</h3>
                      {r.essential && <Badge tone="warn">Essential</Badge>}
                      {r.overdue && (
                        <Badge tone="bad">
                          <AlertCircle aria-hidden="true" className="h-3 w-3" /> Book now
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm leading-5 text-stone-600">
                      Book by <span className="font-mono tabular-nums text-stone-800">{r.bookByDate}</span> · {r.leadWeeks} wks ahead
                      {r.budgetSharePct > 0 && (
                        <>
                          {' '}· typical {r.budgetSharePct}% (~<span className="font-mono tabular-nums">{money(suggested)}</span>)
                        </>
                      )}
                    </p>
                    {r.matchedVendor ? (
                      <p className="text-sm leading-5 text-[#2F4A38] dark:text-emerald-300">
                        Linked: <strong className="font-medium">{r.matchedVendor.name}</strong> · {r.matchedVendor.status}
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={onOpenVendors}
                        className={cx('inline-flex items-center gap-1 rounded text-sm font-medium text-[#3B5943] dark:text-emerald-300 hover:underline', focusRing)}
                      >
                        Compare quotes <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
