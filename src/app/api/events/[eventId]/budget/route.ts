import { api, HttpError, requireEvent } from "@/lib/http";
import { db } from "@/lib/db";
import { budgetItemInput } from "@/lib/schemas";
import { serializeBudgetItem } from "@/lib/serialize";
import { audit } from "@/lib/services/common";
import { budgetSummaryFor, estimateFor, syncActualSpend } from "@/lib/services/budget";

export const GET = api({}, async ({ user, params }) => {
  const id = params.eventId!;
  await requireEvent(user.id, id, "read");
  const [items, summary, event] = await Promise.all([db.budgetItem.findMany({ where: { eventId: id }, orderBy: [{ category: "asc" }, { name: "asc" }] }), budgetSummaryFor(db, id), db.event.findUniqueOrThrow({ where: { id } })]);
  return { items: items.map(serializeBudgetItem), summary, guestCount: event.guestCount, targetBudget: Number(event.targetBudget) };
});

export const POST = api({ body: budgetItemInput }, async ({ user, params, body }) => {
  const id = params.eventId!;
  await requireEvent(user.id, id, "write");
  const item = await db.$transaction(async (tx) => {
    const event = await tx.event.findUniqueOrThrow({ where: { id } });
    if (body.vendorId && !(await tx.vendor.findFirst({ where: { id: body.vendorId, eventId: id }, select: { id: true } }))) throw new HttpError(400, "Unknown vendor");
    const created = await tx.budgetItem.create({ data: { ...body, eventId: id, estimatedCost: estimateFor(body, event.guestCount) } });
    await syncActualSpend(tx, id);
    await audit(tx, id, user.id, "budget.item_added", { itemId: created.id, name: created.name });
    return created;
  });
  return { item: serializeBudgetItem(item) };
});
