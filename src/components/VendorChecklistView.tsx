import { useMemo } from 'react';
import { AlertCircle, CheckCircle2, Circle, Clock, ExternalLink } from 'lucide-react';
import type { EventRecord, VendorRecord } from '../types/domain';
import { buildVendorChecklist } from '../lib/vendorChecklist';

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
  const pct = rows.length ? Math.round((booked / rows.length) * 100) : 0;

  return (
    <section className="space-y-6" aria-label="Vendor checklist">
      <div className="bg-white border border-stone-200/80 rounded-3xl p-7 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="text-xs font-bold text-[#8C6226]">Vendor Checklist</span>
            <h2 className="text-xl font-bold text-stone-900 mt-1">
              Who to book for your {event.event_type}, and when
            </h2>
            <p className="text-xs text-stone-500 mt-1 max-w-xl">
              Recommended booking windows are counted back from {event.date}. Vendors you analyse in the
              Vendors tab are linked automatically; tick items yourself for anything booked offline.
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold font-mono tabular-nums text-stone-900">
              {booked}/{rows.length}
            </div>
            <div className="text-[11px] text-stone-500">categories booked</div>
          </div>
        </div>
        <div className="mt-4 h-2 bg-stone-100 rounded-full overflow-hidden" aria-hidden="true">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#B88B4A] to-[#4A6B53] transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <ul className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {rows.map((r) => {
          const suggested = Math.round((targetBudget * r.budgetSharePct) / 100);
          const Icon = r.state === 'booked' ? CheckCircle2 : r.state === 'in_progress' ? Clock : Circle;
          const iconCls =
            r.state === 'booked' ? 'text-emerald-600' : r.state === 'in_progress' ? 'text-amber-600' : 'text-stone-300';
          return (
            <li
              key={r.key}
              className="bg-white border border-stone-200/80 rounded-2xl p-5 flex items-start gap-4 shadow-xs"
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={r.state === 'booked'}
                aria-label={`Mark ${r.label} as ${r.state === 'booked' ? 'not booked' : 'booked'}`}
                onClick={() => onToggle(r.key, r.state !== 'booked')}
                className="mt-0.5 shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
              >
                <Icon className={`w-6 h-6 ${iconCls}`} />
              </button>
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className={`text-sm font-bold ${r.state === 'booked' ? 'text-stone-400 line-through' : 'text-stone-900'}`}>
                    {r.label}
                  </h3>
                  {r.essential && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#8C6226] bg-amber-50 rounded-md">
                      Essential
                    </span>
                  )}
                  {r.overdue && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-700 bg-rose-50 rounded-md">
                      <AlertCircle className="w-3 h-3" /> Book now
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-stone-500">
                  Book by <span className="font-mono text-stone-700">{r.bookByDate}</span> ·{' '}
                  {r.leadWeeks} wks ahead
                  {r.budgetSharePct > 0 && (
                    <>
                      {' '}· typical share {r.budgetSharePct}% (~
                      <span className="font-mono">${suggested.toLocaleString()}</span>)
                    </>
                  )}
                </p>
                {r.matchedVendor ? (
                  <p className="text-[11px] text-emerald-700">
                    Linked: <strong>{r.matchedVendor.name}</strong> — {r.matchedVendor.status}
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={onOpenVendors}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#4A6B53] hover:underline"
                  >
                    Compare quotes <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
