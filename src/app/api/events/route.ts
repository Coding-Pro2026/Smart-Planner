import { api } from "@/lib/http";
import { db } from "@/lib/db";
import { eventInput } from "@/lib/schemas";
import { serializeEvent } from "@/lib/serialize";
import { audit, parseDay } from "@/lib/services/common";
import { seedStarterPlan } from "@/lib/services/starter";

export const GET = api({}, async ({ user }) => {
  const rows = await db.collaborator.findMany({ where: { userId: user.id }, include: { event: true }, orderBy: { event: { date: "asc" } } });
  return { events: rows.map((r) => serializeEvent(r.event, r.role)) };
});

export const POST = api({ body: eventInput, rate: { name: "event-create", limit: 30, windowMs: 60_000 } }, async ({ user, body }) => {
  const event = await db.$transaction(async (tx) => {
    const e = await tx.event.create({ data: { ownerId: user.id, title: body.title, eventType: body.eventType, date: parseDay(body.date), location: body.location ?? null, guestCount: body.guestCount, targetBudget: body.targetBudget, currency: body.currency } });
    await tx.collaborator.create({ data: { eventId: e.id, userId: user.id, role: "owner" } });
    await audit(tx, e.id, user.id, "event.created");
    if (body.seedStarterPlan) await seedStarterPlan(tx, e.id, user.id);
    return e;
  });
  return { event: serializeEvent(event, "owner") };
});
