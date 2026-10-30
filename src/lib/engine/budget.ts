/**
 * Deterministic budget engine. Pure and isomorphic (runs on the server for persistence and in the
 * browser for the live simulator, so both always agree). All arithmetic is in integer cents; the
 * LLM never produces a total, tax amount, or percentage-used value.
 *
 * Per-line formula (each step rounded half-up to a cent):
 *   effectiveQty = perGuest ? quantity * guestCount : quantity
 *   subtotal     = round(unitCost * effectiveQty)
 *   tax          = round(subtotal * taxPct / 100)
 *   contingency  = round((subtotal + tax) * contingencyPct / 100)
 *   total        = subtotal + tax + contingency
 */

export interface BudgetLineInput {
  name: string;
  category: string;
  unitCost: number;
  quantity: number;
  taxPct?: number;
  contingencyPct?: number;
  perGuest?: boolean;
}

export interface BudgetLine extends BudgetLineInput {
  taxPct: number;
  contingencyPct: number;
  effectiveQuantity: number;
  subtotalCents: number;
  taxCents: number;
  contingencyCents: number;
  totalCents: number;
}

export type Severity = "ok" | "warning" | "over";

export interface CategoryRollup {
  category: string;
  subtotalCents: number;
  taxCents: number;
  contingencyCents: number;
  totalCents: number;
  itemCount: number;
  /** Share of the grand total, 0-100, 2dp. */
  sharePct: number;
  /** Set only when a per-category cap was supplied. */
  capCents?: number;
  severity: Severity;
}

export interface BudgetAlert {
  scope: "total" | "category";
  category?: string;
  severity: Exclude<Severity, "ok">;
  limitCents: number;
  totalCents: number;
  overByCents: number;
}

export interface BudgetSummary {
  lines: BudgetLine[];
  categories: CategoryRollup[];
  subtotalCents: number;
  taxCents: number;
  contingencyCents: number;
  grandTotalCents: number;
  targetCents: number;
  remainingCents: number;
  /** grandTotal / target * 100, 2dp. null if there is no target. */
  percentUsed: number | null;
  severity: Severity;
  alerts: BudgetAlert[];
}

export interface BudgetOptions {
  guestCount?: number;
  /** Fraction of the target at which a warning fires. Default 0.9. */
  warnThreshold?: number;
  /** Category -> cap in currency units (not cents). */
  categoryCaps?: Record<string, number>;
}

export class BudgetValidationError extends RangeError {}

export const toCents = (amount: number): number => {
  if (!Number.isFinite(amount)) throw new BudgetValidationError(`Not a finite amount: ${amount}`);
  // Round on the decimal string-ish value to dodge 1.005 * 100 = 100.49999999999999.
  return Math.sign(amount) * Math.round(Number((Math.abs(amount) * 100).toPrecision(15)));
};
export const fromCents = (cents: number): number => cents / 100;

/** Half-up rounding of an exact-ish float (non-negative inputs only; validated upstream). */
const roundHalfUp = (x: number): number => Math.floor(Number(x.toPrecision(15)) + 0.5);

function validateLine(l: BudgetLineInput, idx: number): void {
  const where = `Line ${idx + 1} ("${l.name}")`;
  const checks: [string, number | undefined, number, number][] = [
    ["unitCost", l.unitCost, 0, 1e9],
    ["quantity", l.quantity, 0, 1e7],
    ["taxPct", l.taxPct ?? 0, 0, 100],
    ["contingencyPct", l.contingencyPct ?? 0, 0, 100],
  ];
  for (const [field, v, min, max] of checks) {
    if (typeof v !== "number" || !Number.isFinite(v)) throw new BudgetValidationError(`${where}: ${field} must be a finite number`);
    if (v < min) throw new BudgetValidationError(`${where}: ${field} cannot be negative`);
    if (v > max) throw new BudgetValidationError(`${where}: ${field} exceeds maximum ${max}`);
  }
}

export function calculateLine(input: BudgetLineInput, guestCount = 0, idx = 0): BudgetLine {
  validateLine(input, idx);
  const taxPct = input.taxPct ?? 0;
  const contingencyPct = input.contingencyPct ?? 0;
  const effectiveQuantity = input.perGuest ? input.quantity * guestCount : input.quantity;
  const subtotalCents = roundHalfUp(toCents(input.unitCost) * effectiveQuantity);
  const taxCents = roundHalfUp((subtotalCents * taxPct) / 100);
  const contingencyCents = roundHalfUp(((subtotalCents + taxCents) * contingencyPct) / 100);
  return {
    ...input,
    taxPct,
    contingencyPct,
    effectiveQuantity,
    subtotalCents,
    taxCents,
    contingencyCents,
    totalCents: subtotalCents + taxCents + contingencyCents,
  };
}

const pct2 = (n: number, d: number): number => (d === 0 ? 0 : Math.round((n / d) * 10000) / 100);

export function calculateEventBudget(
  items: BudgetLineInput[],
  totalBudget: number,
  options: BudgetOptions = {},
): BudgetSummary {
  const { guestCount = 0, warnThreshold = 0.9, categoryCaps = {} } = options;
  if (!Number.isFinite(totalBudget) || totalBudget < 0) {
    throw new BudgetValidationError("totalBudget must be a non-negative finite number");
  }
  if (!Number.isInteger(guestCount) || guestCount < 0) {
    throw new BudgetValidationError("guestCount must be a non-negative integer");
  }
  if (warnThreshold <= 0 || warnThreshold > 1) throw new BudgetValidationError("warnThreshold must be in (0, 1]");

  const lines = items.map((it, i) => calculateLine(it, guestCount, i));
  const sum = (f: (l: BudgetLine) => number) => lines.reduce((a, l) => a + f(l), 0);
  const subtotalCents = sum((l) => l.subtotalCents);
  const taxCents = sum((l) => l.taxCents);
  const contingencyCents = sum((l) => l.contingencyCents);
  const grandTotalCents = subtotalCents + taxCents + contingencyCents;
  const targetCents = toCents(totalBudget);

  const sev = (total: number, limit: number): Severity => {
    if (total > limit) return "over";
    if (limit > 0 && total >= limit * warnThreshold) return "warning";
    return "ok";
  };

  const byCat = new Map<string, BudgetLine[]>();
  for (const l of lines) {
    const key = l.category.trim() || "Uncategorized";
    byCat.set(key, [...(byCat.get(key) ?? []), l]);
  }
  const alerts: BudgetAlert[] = [];
  const categories: CategoryRollup[] = [...byCat.entries()]
    .map(([category, ls]) => {
      const total = ls.reduce((a, l) => a + l.totalCents, 0);
      const cap = categoryCaps[category];
      const capCents = cap === undefined ? undefined : toCents(cap);
      const severity: Severity = capCents === undefined ? "ok" : sev(total, capCents);
      if (capCents !== undefined && severity !== "ok") {
        alerts.push({ scope: "category", category, severity, limitCents: capCents, totalCents: total, overByCents: Math.max(0, total - capCents) });
      }
      return {
        category,
        subtotalCents: ls.reduce((a, l) => a + l.subtotalCents, 0),
        taxCents: ls.reduce((a, l) => a + l.taxCents, 0),
        contingencyCents: ls.reduce((a, l) => a + l.contingencyCents, 0),
        totalCents: total,
        itemCount: ls.length,
        sharePct: pct2(total, grandTotalCents),
        ...(capCents === undefined ? {} : { capCents }),
        severity,
      };
    })
    .sort((a, b) => b.totalCents - a.totalCents || a.category.localeCompare(b.category));

  const severity: Severity = targetCents === 0 && grandTotalCents === 0 ? "ok" : sev(grandTotalCents, targetCents);
  if (severity !== "ok") {
    alerts.unshift({ scope: "total", severity, limitCents: targetCents, totalCents: grandTotalCents, overByCents: Math.max(0, grandTotalCents - targetCents) });
  }

  return {
    lines,
    categories,
    subtotalCents,
    taxCents,
    contingencyCents,
    grandTotalCents,
    targetCents,
    remainingCents: targetCents - grandTotalCents,
    percentUsed: targetCents === 0 ? null : pct2(grandTotalCents, targetCents),
    severity,
    alerts,
  };
}

/** Benchmark category split used by the Budget Allocator as a starting point (sums to 100). */
export const BENCHMARK_ALLOCATIONS: Record<"wedding" | "birthday" | "community", Record<string, number>> = {
  wedding: { Venue: 30, "Food & Beverage": 28, Photography: 10, "Attire & Beauty": 8, "Decor & Flowers": 8, "Music & Entertainment": 7, Stationery: 2, Transport: 2, Miscellaneous: 5 },
  birthday: { Venue: 20, "Food & Beverage": 35, "Decor & Flowers": 10, "Music & Entertainment": 12, Cake: 6, Photography: 5, "Favors & Gifts": 7, Miscellaneous: 5 },
  community: { Venue: 25, "Food & Beverage": 25, "Equipment & AV": 15, Marketing: 10, Insurance: 5, Staffing: 10, Supplies: 5, Miscellaneous: 5 },
};

/** Split `targetBudget` across benchmark categories, guaranteeing the parts sum exactly to the target. */
export function allocateBenchmark(eventType: keyof typeof BENCHMARK_ALLOCATIONS, targetBudget: number): { category: string; pct: number; cents: number }[] {
  const table = BENCHMARK_ALLOCATIONS[eventType];
  const total = toCents(targetBudget);
  const entries = Object.entries(table);
  const out = entries.map(([category, pct]) => ({ category, pct, cents: Math.floor((total * pct) / 100) }));
  let leftover = total - out.reduce((a, o) => a + o.cents, 0);
  for (let i = 0; leftover > 0; i = (i + 1) % out.length, leftover--) out[i]!.cents += 1;
  return out;
}
