import { calculateEventBudget, fromCents } from "../engine/budget";
import { toLineInput } from "../services/budget";
import { isoDate, num, type Tx } from "../services/common";
import { quoteTermsSchema } from "../documents/quote-schema";
import { sanitizeUntrusted } from "../security/sanitize";

export interface EventContext {
  event: { id: string; title: string; type: string; date: string; location: string | null; guestCount: number; targetBudget: number; currency: string; daysToEvent: number };
  tasks: { id: string; title: string; category: string; start: string; due: string; status: string; dependsOn: string[]; critical: boolean }[];
  budget: { grandTotal: number; remaining: number; percentUsed: number | null; categories: { category: string; total: number }[] };
  vendors: { id: string; name: string; serviceType: string; status: string; quote: number | null; hasParsedQuote: boolean }[];
  theme: unknown;
}

/** Snapshot of the event for prompts. Free-text fields are sanitised because collaborators can edit them. */
export async function buildEventContext(tx: Tx, eventId: string, now = new Date()): Promise<EventContext> {
  const [e, tasks, items, vendors] = await Promise.all([
    tx.event.findUniqueOrThrow({ where: { id: eventId } }),
    tx.task.findMany({ where: { eventId }, orderBy: { startDate: "asc" }, take: 80 }),
    tx.budgetItem.findMany({ where: { eventId } }),
    tx.vendor.findMany({ where: { eventId }, take: 30 }),
  ]);
  const clean = (s: string, n = 120) => sanitizeUntrusted(s, n).text;
  const summary = calculateEventBudget(items.map(toLineInput), num(e.targetBudget), { guestCount: e.guestCount });
  const date = isoDate(e.date);
  return {
    event: { id: e.id, title: clean(e.title), type: e.eventType, date, location: e.location ? clean(e.location) : null, guestCount: e.guestCount, targetBudget: num(e.targetBudget), currency: e.currency, daysToEvent: Math.ceil((Date.parse(`${date}T00:00:00Z`) - now.getTime()) / 86_400_000) },
    tasks: tasks.map((t) => ({ id: t.id, title: clean(t.title), category: clean(t.category, 60), start: isoDate(t.startDate), due: isoDate(t.dueDate), status: t.status, dependsOn: t.dependencies, critical: t.isCriticalPath })),
    budget: { grandTotal: fromCents(summary.grandTotalCents), remaining: fromCents(summary.remainingCents), percentUsed: summary.percentUsed, categories: summary.categories.map((c) => ({ category: c.category, total: fromCents(c.totalCents) })) },
    vendors: vendors.map((v) => ({ id: v.id, name: clean(v.name), serviceType: clean(v.serviceType, 60), status: v.status, quote: v.quoteAmount == null ? null : num(v.quoteAmount), hasParsedQuote: quoteTermsSchema.safeParse(v.parsedTerms).success })),
    theme: e.theme ?? null,
  };
}
