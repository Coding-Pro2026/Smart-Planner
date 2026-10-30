import { api, HttpError, notFound, requireEvent } from "@/lib/http";
import { db } from "@/lib/db";
import { serializeBudgetItem } from "@/lib/serialize";
import { audit, num } from "@/lib/services/common";
import { estimateFor } from "@/lib/services/budget";

/** Turns a vendor's (code-recomputed, all-in) quote into a budget line linked to that vendor. */
export const POST = api({}, async ({ user, params }) => {
  const eventId = params.eventId!;
  await requireEvent(user.id, eventId, "write");
  const item = await db.$transaction(async (tx) => {
    const v = await tx.vendor.findFirst({ where: { id: params.vendorId!, eventId } });
    if (!v) throw notFound();
    if (v.quoteAmount == null) throw new HttpError(422, "This vendor has no quote amount yet");
    if (await tx.budgetItem.findFirst({ where: { eventId, vendorId: v.id }, select: { id: true } })) throw new HttpError(409, "This vendor is already in the budget");
    const event = await tx.event.findUniqueOrThrow({ where: { id: eventId } });
    const line = { name: `${v.name} — ${v.serviceType}`, category: v.serviceType, unitCost: num(v.quoteAmount), quantity: 1 };
    const created = await tx.budgetItem.create({ data: { ...line, eventId, vendorId: v.id, status: v.status === "booked" ? "booked" : "quoted", estimatedCost: estimateFor(line, event.guestCount), notes: "From vendor quote (all-in)" } });
    await audit(tx, eventId, user.id, "budget.item_added", { itemId: created.id, vendorId: v.id });
    return created;
  });
  return { item: serializeBudgetItem(item) };
});
