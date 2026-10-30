import { toCents } from "./budget";
import type { QuoteTerms } from "../documents/quote-schema";

/**
 * Deterministic quote maths. The LLM extracts the figures printed in the document; this module
 * recomputes the all-in price from them so a mis-read total is caught rather than trusted.
 */
export interface ComputedQuote {
  subtotalCents: number;
  chargesCents: number;
  hiddenChargesCents: number;
  taxCents: number;
  gratuityCents: number;
  totalCents: number;
  statedTotalCents: number | null;
  /** statedTotal - computed. Non-zero beyond rounding means either hidden costs or an extraction error. */
  discrepancyCents: number | null;
  warnings: string[];
}

const round = (x: number) => Math.floor(Number(x.toPrecision(15)) + 0.5);

export function computeQuote(t: QuoteTerms): ComputedQuote {
  const warnings: string[] = [];
  let subtotal = 0;
  for (const li of t.lineItems) {
    const cents = toCents(li.amount);
    if (li.quantity !== undefined && li.unitPrice !== undefined) {
      const expected = round(toCents(li.unitPrice) * li.quantity);
      if (Math.abs(expected - cents) > 1) warnings.push(`"${li.description}": ${li.quantity} × ${li.unitPrice} ≠ ${li.amount}`);
    }
    subtotal += cents;
  }
  let charges = 0;
  let hidden = 0;
  for (const c of t.serviceCharges) {
    const cents = c.amount !== undefined ? toCents(c.amount) : c.pct !== undefined ? round((subtotal * c.pct) / 100) : 0;
    charges += cents;
    if (c.hiddenInSummary) hidden += cents;
  }
  const tax = round(((subtotal + charges) * (t.taxPct ?? 0)) / 100);
  const gratuity = round((subtotal * (t.gratuityPct ?? 0)) / 100);
  const total = subtotal + charges + tax + gratuity;
  const stated = t.statedTotal === undefined ? null : toCents(t.statedTotal);
  const discrepancy = stated === null ? null : stated - total;
  if (discrepancy !== null && Math.abs(discrepancy) > Math.max(100, total * 0.005)) {
    warnings.push(
      discrepancy < 0
        ? `Computed all-in total exceeds the stated total by ${(-discrepancy / 100).toFixed(2)} — likely hidden charges.`
        : `Stated total exceeds the computed total by ${(discrepancy / 100).toFixed(2)} — an item may have been missed in extraction.`,
    );
  }
  return { subtotalCents: subtotal, chargesCents: charges, hiddenChargesCents: hidden, taxCents: tax, gratuityCents: gratuity, totalCents: total, statedTotalCents: stated, discrepancyCents: discrepancy, warnings };
}

export interface QuoteInput {
  vendorId: string;
  vendorName: string;
  terms: QuoteTerms;
}

export interface QuoteComparison {
  vendors: { vendorId: string; vendorName: string; computed: ComputedQuote; highRisks: number; allInvisibleCostsCents: number }[];
  /** One row per normalised line item; `null` = vendor did not quote it (possible exclusion). */
  rows: { key: string; label: string; amountsCents: (number | null)[] }[];
  lowestTotalVendorId: string | null;
}

export const normalizeItemKey = (desc: string): string =>
  desc.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\b(the|a|an|of|and|for|per|package|service|services|fee|fees)\b/g, " ").replace(/\s+/g, " ").trim();

export function compareQuotes(quotes: QuoteInput[]): QuoteComparison {
  const vendors = quotes.map((q) => {
    const computed = computeQuote(q.terms);
    return {
      vendorId: q.vendorId,
      vendorName: q.vendorName,
      computed,
      highRisks: q.terms.riskClauses.filter((r) => r.severity === "high").length,
      allInvisibleCostsCents: computed.hiddenChargesCents + computed.gratuityCents + computed.taxCents,
    };
  });
  const rowMap = new Map<string, { label: string; amounts: (number | null)[] }>();
  quotes.forEach((q, qi) => {
    for (const li of q.terms.lineItems) {
      const key = normalizeItemKey(li.description) || li.description.toLowerCase();
      const row = rowMap.get(key) ?? { label: li.description, amounts: quotes.map(() => null) };
      row.amounts[qi] = (row.amounts[qi] ?? 0) + toCents(li.amount);
      rowMap.set(key, row);
    }
  });
  const rows = [...rowMap.entries()].map(([key, r]) => ({ key, label: r.label, amountsCents: r.amounts }));
  const lowest = vendors.length ? vendors.reduce((a, b) => (b.computed.totalCents < a.computed.totalCents ? b : a)) : null;
  return { vendors, rows, lowestTotalVendorId: lowest?.vendorId ?? null };
}
