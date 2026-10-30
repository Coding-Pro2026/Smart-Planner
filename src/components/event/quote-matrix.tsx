"use client";
import { AlertTriangle, EyeOff, ShieldAlert } from "lucide-react";
import { cents } from "@/lib/client/api";
import type { QuoteComparison } from "@/lib/engine/quotes";
import type { QuoteTerms } from "@/lib/documents/quote-schema";
import { Badge, cn } from "@/components/ui";

const SEV = { high: "bad", medium: "warn", low: "neutral" } as const;

export function QuoteMatrix({ comparison, terms, currency }: { comparison: QuoteComparison; terms: Record<string, QuoteTerms>; currency: string }) {
  const m = (c: number | null) => (c === null ? null : cents(c, currency));
  return (
    <div className="space-y-6 overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-line text-left">
            <th className="py-2 pr-3">Line item</th>
            {comparison.vendors.map((v) => <th key={v.vendorId} className="px-2 text-right">{v.vendorName}{v.vendorId === comparison.lowestTotalVendorId && <> <Badge tone="ok">lowest all-in</Badge></>}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {comparison.rows.map((r) => (
            <tr key={r.key}>
              <td className="py-1.5 pr-3">{r.label}</td>
              {r.amountsCents.map((a, i) => <td key={i} className={cn("px-2 text-right", a === null && "bg-warn/10 text-warn")}>{m(a) ?? <span title="Not quoted — may be excluded or included elsewhere">not quoted</span>}</td>)}
            </tr>
          ))}
          <Totals label="Subtotal" pick={(v) => v.computed.subtotalCents} vendors={comparison.vendors} currency={currency} />
          <Totals label="Service charges" pick={(v) => v.computed.chargesCents} vendors={comparison.vendors} currency={currency} />
          <Totals label="of which hidden in fine print" pick={(v) => v.computed.hiddenChargesCents} vendors={comparison.vendors} currency={currency} warn />
          <Totals label="Tax" pick={(v) => v.computed.taxCents} vendors={comparison.vendors} currency={currency} />
          <Totals label="Gratuity" pick={(v) => v.computed.gratuityCents} vendors={comparison.vendors} currency={currency} />
          <Totals label="All-in total (recalculated)" pick={(v) => v.computed.totalCents} vendors={comparison.vendors} currency={currency} bold />
          <tr><td className="py-1.5 text-muted">Total printed on quote</td>{comparison.vendors.map((v) => <td key={v.vendorId} className="px-2 text-right text-muted">{v.computed.statedTotalCents === null ? "—" : cents(v.computed.statedTotalCents, currency)}</td>)}</tr>
        </tbody>
      </table>

      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${comparison.vendors.length}, minmax(220px, 1fr))` }}>
        {comparison.vendors.map((v) => {
          const t = terms[v.vendorId];
          return (
            <div key={v.vendorId} className="space-y-3 rounded-lg border border-line p-3 text-sm">
              <h3 className="font-semibold">{v.vendorName}</h3>
              {v.computed.warnings.map((w) => <p key={w} className="flex gap-1.5 text-xs text-warn"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{w}</p>)}
              {t?.serviceCharges.filter((c) => c.hiddenInSummary).map((c) => <p key={c.name} className="flex gap-1.5 text-xs"><EyeOff className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" /><span><b>{c.name}</b> {c.amount !== undefined ? cents(Math.round(c.amount * 100), currency) : `${c.pct}%`} — not in headline price</span></p>)}
              {t && t.paymentSchedule.length > 0 && <div><div className="text-xs font-medium uppercase text-muted">Payment schedule</div><ul className="text-xs">{t.paymentSchedule.map((p, i) => <li key={i}>{p.label}: {p.amount !== undefined ? cents(Math.round(p.amount * 100), currency) : `${p.pct}%`}{p.due ? ` · ${p.due}` : ""}</li>)}</ul></div>}
              {t?.cancellationTerms && <div><div className="text-xs font-medium uppercase text-muted">Cancellation</div><p className="text-xs">{t.cancellationTerms}</p></div>}
              {t && t.riskClauses.length > 0 && (
                <div className="space-y-1.5"><div className="flex items-center gap-1 text-xs font-medium uppercase text-muted"><ShieldAlert className="h-3.5 w-3.5" /> Risk clauses</div>
                  {t.riskClauses.map((r, i) => (
                    <div key={i} className={cn("rounded border p-2 text-xs", r.severity === "high" ? "border-bad/50 bg-bad/10" : r.severity === "medium" ? "border-warn/50 bg-warn/10" : "border-line")}>
                      <Badge tone={SEV[r.severity]}>{r.category.replace("_", " ")}</Badge> <span>{r.explanation}</span>
                      <blockquote className="mt-1 italic text-muted">“{r.excerpt}”</blockquote>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Totals({ label, pick, vendors, currency, bold, warn }: { label: string; pick: (v: QuoteComparison["vendors"][number]) => number; vendors: QuoteComparison["vendors"]; currency: string; bold?: boolean; warn?: boolean }) {
  return <tr className={cn(bold && "border-t-2 border-line font-semibold")}><td className={cn("py-1.5", warn && "pl-4 text-warn")}>{label}</td>{vendors.map((v) => <td key={v.vendorId} className={cn("px-2 text-right", warn && pick(v) > 0 && "text-warn")}>{cents(pick(v), currency)}</td>)}</tr>;
}
