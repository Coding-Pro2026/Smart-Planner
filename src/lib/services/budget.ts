import type { Prisma } from "@prisma/client";
import { calculateEventBudget, calculateLine, fromCents, type BudgetLineInput, type BudgetSummary } from "../engine/budget";
import { num, type Tx } from "./common";

type ItemRow = Prisma.BudgetItemGetPayload<object>;

export const toLineInput = (i: Pick<ItemRow, "name" | "category" | "unitCost" | "quantity" | "taxPct" | "contingencyPct" | "perGuest">): BudgetLineInput => ({
  name: i.name,
  category: i.category,
  unitCost: num(i.unitCost),
  quantity: num(i.quantity),
  taxPct: num(i.taxPct),
  contingencyPct: num(i.contingencyPct),
  perGuest: i.perGuest,
});

/** Engine-computed estimated cost for a single line, in currency units. */
export const estimateFor = (line: BudgetLineInput, guestCount: number): number => fromCents(calculateLine(line, guestCount).totalCents);

export async function recalcEstimates(tx: Tx, eventId: string, guestCount: number): Promise<void> {
  const items = await tx.budgetItem.findMany({ where: { eventId } });
  for (const it of items) {
    const est = estimateFor(toLineInput(it), guestCount);
    if (est !== num(it.estimatedCost)) await tx.budgetItem.update({ where: { id: it.id }, data: { estimatedCost: est } });
  }
}

export async function syncActualSpend(tx: Tx, eventId: string): Promise<number> {
  const agg = await tx.budgetItem.aggregate({ where: { eventId }, _sum: { actualCost: true } });
  const total = num(agg._sum.actualCost);
  await tx.event.update({ where: { id: eventId }, data: { actualSpend: total } });
  return total;
}

export async function budgetSummaryFor(tx: Tx, eventId: string): Promise<BudgetSummary> {
  const [event, items] = await Promise.all([tx.event.findUniqueOrThrow({ where: { id: eventId } }), tx.budgetItem.findMany({ where: { eventId }, orderBy: { name: "asc" } })]);
  return calculateEventBudget(items.map(toLineInput), num(event.targetBudget), { guestCount: event.guestCount });
}
