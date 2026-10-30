import { describe, expect, it } from "vitest";
import { allocateBenchmark, BudgetValidationError, calculateEventBudget, calculateLine, toCents } from "@/lib/engine/budget";

const item = (o: Partial<Parameters<typeof calculateLine>[0]> = {}) => ({ name: "x", category: "Venue", unitCost: 100, quantity: 1, ...o });

describe("calculateEventBudget", () => {
  it("handles an empty budget", () => {
    const s = calculateEventBudget([], 0);
    expect(s.grandTotalCents).toBe(0);
    expect(s.percentUsed).toBeNull();
    expect(s.severity).toBe("ok");
    expect(s.alerts).toEqual([]);
  });

  it("applies tax, then contingency on (subtotal + tax)", () => {
    const l = calculateLine(item({ unitCost: 1000, quantity: 2, taxPct: 10, contingencyPct: 10 }));
    expect(l.subtotalCents).toBe(200000);
    expect(l.taxCents).toBe(20000);
    expect(l.contingencyCents).toBe(22000);
    expect(l.totalCents).toBe(242000);
  });

  it("zero values produce zero cost, not NaN", () => {
    expect(calculateLine(item({ unitCost: 0 })).totalCents).toBe(0);
    expect(calculateLine(item({ quantity: 0 })).totalCents).toBe(0);
  });

  it("rejects negative and non-finite inputs", () => {
    expect(() => calculateLine(item({ unitCost: -1 }))).toThrow(BudgetValidationError);
    expect(() => calculateLine(item({ quantity: -2 }))).toThrow(/negative/);
    expect(() => calculateLine(item({ taxPct: -5 }))).toThrow(BudgetValidationError);
    expect(() => calculateLine(item({ taxPct: 101 }))).toThrow(BudgetValidationError);
    expect(() => calculateLine(item({ unitCost: NaN }))).toThrow(BudgetValidationError);
    expect(() => calculateLine(item({ unitCost: Infinity }))).toThrow(BudgetValidationError);
    expect(() => calculateEventBudget([], -1)).toThrow(BudgetValidationError);
  });

  it("is exact for classic float traps (0.1 + 0.2, 1.005, 33.33 * 3)", () => {
    const s = calculateEventBudget([item({ unitCost: 0.1 }), item({ unitCost: 0.2 })], 1);
    expect(s.grandTotalCents).toBe(30);
    expect(toCents(1.005)).toBe(101);
    expect(calculateLine(item({ unitCost: 33.33, quantity: 3 })).subtotalCents).toBe(9999);
  });

  it("rounds half-up at each step", () => {
    // 10.05 subtotal, 7.5% tax = 0.75375 -> 75 cents
    const l = calculateLine(item({ unitCost: 10.05, taxPct: 7.5 }));
    expect(l.taxCents).toBe(75);
    // 0.5 cent rounds up: 1.00 at 0.5% = 0.5 cent -> 1
    expect(calculateLine(item({ unitCost: 1, taxPct: 0.5 })).taxCents).toBe(1);
  });

  it("scales per-guest lines with guest count", () => {
    const s = calculateEventBudget([item({ name: "Plate", category: "Food", unitCost: 85, quantity: 1, perGuest: true })], 20000, { guestCount: 120 });
    expect(s.grandTotalCents).toBe(1020000);
    expect(s.lines[0]!.effectiveQuantity).toBe(120);
  });

  it("rolls up categories and shares sum to ~100%", () => {
    const s = calculateEventBudget([item({ category: "A", unitCost: 300 }), item({ category: "B", unitCost: 100 }), item({ category: "A", unitCost: 100 })], 1000);
    expect(s.categories.map((c) => [c.category, c.totalCents])).toEqual([["A", 40000], ["B", 10000]]);
    expect(s.categories.reduce((a, c) => a + c.sharePct, 0)).toBeCloseTo(100, 1);
  });

  it("detects warning / over thresholds on the total", () => {
    expect(calculateEventBudget([item({ unitCost: 89 })], 100).severity).toBe("ok");
    expect(calculateEventBudget([item({ unitCost: 90 })], 100).severity).toBe("warning");
    const over = calculateEventBudget([item({ unitCost: 100.01 })], 100);
    expect(over.severity).toBe("over");
    expect(over.alerts[0]).toMatchObject({ scope: "total", overByCents: 1 });
    expect(over.remainingCents).toBe(-1);
    expect(calculateEventBudget([item({ unitCost: 100 })], 100).severity).toBe("warning"); // exactly at limit is not over
  });

  it("any spend with a zero target is over budget", () => {
    expect(calculateEventBudget([item()], 0).severity).toBe("over");
  });

  it("detects per-category cap breaches", () => {
    const s = calculateEventBudget([item({ category: "Venue", unitCost: 600 })], 10000, { categoryCaps: { Venue: 500 } });
    expect(s.alerts).toEqual([expect.objectContaining({ scope: "category", category: "Venue", severity: "over", overByCents: 10000 })]);
  });

  it("validates guest count and threshold", () => {
    expect(() => calculateEventBudget([], 1, { guestCount: -1 })).toThrow(BudgetValidationError);
    expect(() => calculateEventBudget([], 1, { guestCount: 1.5 })).toThrow(BudgetValidationError);
    expect(() => calculateEventBudget([], 1, { warnThreshold: 0 })).toThrow(BudgetValidationError);
  });

  it("does not mutate its inputs", () => {
    const items = [item()];
    const snap = JSON.stringify(items);
    calculateEventBudget(items, 100);
    expect(JSON.stringify(items)).toBe(snap);
  });
});

describe("allocateBenchmark", () => {
  it.each(["wedding", "birthday", "community"] as const)("%s allocations sum exactly to the target", (type) => {
    for (const target of [0, 1, 999.99, 25000, 100000.01]) {
      const parts = allocateBenchmark(type, target);
      expect(parts.reduce((a, p) => a + p.pct, 0)).toBe(100);
      expect(parts.reduce((a, p) => a + p.cents, 0)).toBe(toCents(target));
    }
  });
});
