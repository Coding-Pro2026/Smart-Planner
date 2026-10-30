import { describe, expect, it } from "vitest";
import { compareQuotes, computeQuote } from "@/lib/engine/quotes";
import { quoteTermsSchema, scanRiskClauses, type QuoteTerms } from "@/lib/documents/quote-schema";

const terms = (o: Partial<QuoteTerms> = {}): QuoteTerms => ({ lineItems: [], serviceCharges: [], paymentSchedule: [], riskClauses: [], warnings: [], ...o });

describe("computeQuote", () => {
  it("sums line items, percentage + flat charges, tax and gratuity exactly", () => {
    const q = computeQuote(terms({
      lineItems: [{ description: "Dinner", quantity: 100, unitPrice: 95.5, amount: 9550 }, { description: "Bar", amount: 2000.1 }],
      serviceCharges: [{ name: "Service charge", pct: 20, mandatory: true, hiddenInSummary: true }, { name: "Setup", amount: 150, mandatory: true, hiddenInSummary: false }],
      taxPct: 8, gratuityPct: 5, statedTotal: 11550.1,
    }));
    expect(q.subtotalCents).toBe(1_155_010);
    expect(q.chargesCents).toBe(231_002 + 15_000);
    expect(q.hiddenChargesCents).toBe(231_002);
    expect(q.taxCents).toBe(Math.floor((1_155_010 + 246_002) * 0.08 + 0.5));
    expect(q.totalCents).toBe(q.subtotalCents + q.chargesCents + q.taxCents + q.gratuityCents);
    expect(q.warnings.join(" ")).toMatch(/hidden charges/);
  });
  it("flags arithmetic that doesn't add up in the document and missing items", () => {
    expect(computeQuote(terms({ lineItems: [{ description: "Chairs", quantity: 10, unitPrice: 5, amount: 80 }] })).warnings[0]).toMatch(/10 × 5 ≠ 80/);
    expect(computeQuote(terms({ lineItems: [{ description: "A", amount: 100 }], statedTotal: 500 })).warnings[0]).toMatch(/missed in extraction/);
  });
  it("is silent when the stated total matches", () => {
    expect(computeQuote(terms({ lineItems: [{ description: "A", amount: 100 }], statedTotal: 100 })).warnings).toEqual([]);
  });
});

describe("compareQuotes", () => {
  it("builds an apples-to-apples matrix and highlights missing items", () => {
    const a = terms({ lineItems: [{ description: "Photography package", amount: 3000 }, { description: "Second shooter", amount: 500 }], riskClauses: [{ category: "non_refundable", severity: "high", excerpt: "x", explanation: "y" }] });
    const b = terms({ lineItems: [{ description: "Photography", amount: 2800 }], serviceCharges: [{ name: "Travel", amount: 900, mandatory: true, hiddenInSummary: true }] });
    const c = compareQuotes([{ vendorId: "a", vendorName: "A", terms: a }, { vendorId: "b", vendorName: "B", terms: b }]);
    const photo = c.rows.find((r) => r.key === "photography")!;
    expect(photo.amountsCents).toEqual([300000, 280000]);
    expect(c.rows.find((r) => r.label === "Second shooter")!.amountsCents).toEqual([50000, null]);
    expect(c.vendors[0]!.highRisks).toBe(1);
    expect(c.vendors[1]!.allInvisibleCostsCents).toBe(90000);
    expect(c.lowestTotalVendorId).toBe("a"); // A = 3500 all-in; B = 2800 + 900 hidden travel = 3700
  });
});

describe("quote schema & clause scan", () => {
  it("rejects negative amounts and oversized arrays", () => {
    expect(quoteTermsSchema.safeParse(terms({ lineItems: [{ description: "x", amount: -1 }] })).success).toBe(false);
    expect(quoteTermsSchema.safeParse(terms({ lineItems: Array.from({ length: 101 }, () => ({ description: "x", amount: 1 })) })).success).toBe(false);
  });
  it("regex backstop finds hidden risky clauses", () => {
    const cats = scanRiskClauses("This agreement automatically renews each year. All deposits are non-refundable. Overtime billed at $200 per hour.").map((r) => r.category);
    expect(cats).toEqual(expect.arrayContaining(["auto_renewal", "non_refundable", "overtime"]));
    expect(scanRiskClauses("Friendly florist, delivers on time.")).toEqual([]);
  });
});
