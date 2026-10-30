import { z } from "zod";

const money = z.number().finite().min(0).max(1e9);
const pct = z.number().finite().min(0).max(100);
const text = (n: number) => z.string().trim().max(n);

export const RISK_CATEGORIES = ["auto_renewal", "non_refundable", "overtime", "liability", "exclusivity", "price_escalation", "payment_terms", "cancellation", "other"] as const;

/** What the Vendor & Contract agent must extract. Numbers are extracted, never computed, by the model. */
export const quoteTermsSchema = z.object({
  vendorName: text(120).optional(),
  serviceType: text(60).optional(),
  currency: z.string().trim().length(3).optional(),
  lineItems: z.array(z.object({ description: text(200), quantity: z.number().finite().min(0).max(1e6).optional(), unitPrice: money.optional(), amount: money })).max(100),
  serviceCharges: z
    .array(z.object({ name: text(120), amount: money.optional(), pct: pct.optional(), mandatory: z.boolean(), hiddenInSummary: z.boolean().describe("true if the charge is only in fine print / not in the headline price") }))
    .max(30),
  taxPct: pct.optional(),
  gratuityPct: pct.optional(),
  statedTotal: money.optional(),
  paymentSchedule: z.array(z.object({ label: text(120), amount: money.optional(), pct: pct.optional(), due: text(80).optional() })).max(20),
  cancellationTerms: text(1000).optional(),
  riskClauses: z.array(z.object({ category: z.enum(RISK_CATEGORIES), severity: z.enum(["low", "medium", "high"]), excerpt: text(400), explanation: text(300) })).max(25),
  warnings: z.array(text(300)).max(10).default([]),
});
export type QuoteTerms = z.infer<typeof quoteTermsSchema>;

/** Cheap regex backstop so a missed clause is still surfaced even if the model overlooks it. */
const CLAUSE_PATTERNS: { category: (typeof RISK_CATEGORIES)[number]; severity: "low" | "medium" | "high"; re: RegExp; explanation: string }[] = [
  { category: "auto_renewal", severity: "high", re: /auto(?:matic(?:ally)?)?[- ]?renew|renews?\s+automatically/i, explanation: "Contract renews automatically unless cancelled." },
  { category: "non_refundable", severity: "high", re: /non[- ]?refundable|no refunds?|deposit.{0,40}forfeit/i, explanation: "Payments may be non-refundable." },
  { category: "overtime", severity: "medium", re: /overtime|additional hours?.{0,30}(?:rate|fee|charge)|per hour (?:after|beyond)/i, explanation: "Extra hours billed at additional cost." },
  { category: "price_escalation", severity: "medium", re: /price (?:increase|adjustment|escalation)|subject to change|market rate/i, explanation: "Price may change after signing." },
  { category: "liability", severity: "medium", re: /not (?:be )?liable|limit(?:ation)? of liability|hold harmless|indemnif/i, explanation: "Limits the vendor's liability or shifts it to you." },
  { category: "exclusivity", severity: "low", re: /exclusive(?:ly)?\s+(?:vendor|provider|caterer|photographer)|may not (?:bring|use) (?:outside|other)/i, explanation: "Restricts using other vendors." },
  { category: "cancellation", severity: "medium", re: /cancell?ation (?:fee|charge|penalt)|cancel.{0,40}(?:\d+%|full (?:amount|payment))/i, explanation: "Cancellation carries a penalty." },
  { category: "payment_terms", severity: "low", re: /late (?:fee|payment)|interest of \d|due (?:upon|on) signing|balance due \d+ days/i, explanation: "Strict payment timing or late fees." },
];

export function scanRiskClauses(documentText: string): QuoteTerms["riskClauses"] {
  const out: QuoteTerms["riskClauses"] = [];
  for (const p of CLAUSE_PATTERNS) {
    const m = p.re.exec(documentText);
    if (!m) continue;
    const at = Math.max(0, m.index - 80);
    out.push({ category: p.category, severity: p.severity, excerpt: documentText.slice(at, m.index + m[0].length + 120).replace(/\s+/g, " ").trim().slice(0, 400), explanation: p.explanation });
  }
  return out;
}
