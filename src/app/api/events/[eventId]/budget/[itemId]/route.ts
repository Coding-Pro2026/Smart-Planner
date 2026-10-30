import { api, HttpError, notFound, requireEvent } from "@/lib/http";
import { db } from "@/lib/db";
import { budgetItemPatch } from "@/lib/schemas";
import { serializeBudgetItem } from "@/lib/serialize";
import { audit } from "@/lib/services/common";
import { estimateFor, syncActualSpend, toLineInput } from "@/lib/services/budget";

export const PATCH = api({ body: budgetItemPatch }, async ({ user, params, body }) => {
  const eventId = params.eventId!;
  await requireEvent(user.id, eventId, "write");
  const item = await db.$transaction(async (tx) => {
    const cur = await tx.budgetItem.findFirst({ where: { id: params.itemId!, eventId } }); // eventId filter = tenant isolation
    if (!cur) throw notFound();
    if (body.vendorId && !(await tx.vendor.findFirst({ where: { id: body.vendorId, eventId }, select: { id: true } }))) throw new HttpError(400, "Unknown vendor");
    const event = await tx.event.findUniqueOrThrow({ where: { id: eventId } });
    const merged = { ...toLineInput(cur), ...Object.fromEntries(Object.entries(body).filter(([k, v]) => v !== undefined && ["name", "category", "unitCost", "quantity", "taxPct", "contingencyPct", "perGuest"].includes(k))) };
    const updated = await tx.budgetItem.update({ where: { id: cur.id }, data: { ...body, estimatedCost: estimateFor(merged as ReturnType<typeof toLineInput>, event.guestCount) } });
    await syncActualSpend(tx, eventId);
    await audit(tx, eventId, user.id, "budget.item_updated", { itemId: cur.id, fields: Object.keys(body) });
    return updated;
  });
  return { item: serializeBudgetItem(item) };
});

export const DELETE = api({}, async ({ user, params }) => {
  const eventId = params.eventId!;
  await requireEvent(user.id, eventId, "write");
  await db.$transaction(async (tx) => {
    const r = await tx.budgetItem.deleteMany({ where: { id: params.itemId!, eventId } });
    if (r.count === 0) throw notFound();
    await syncActualSpend(tx, eventId);
    await audit(tx, eventId, user.id, "budget.item_deleted", { itemId: params.itemId! });
  });
  return { ok: true };
});
