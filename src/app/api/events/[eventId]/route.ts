import { api, notFound, requireEvent } from "@/lib/http";
import { db } from "@/lib/db";
import { eventPatch } from "@/lib/schemas";
import { serializeEvent } from "@/lib/serialize";
import { audit, parseDay } from "@/lib/services/common";
import { recalcEstimates } from "@/lib/services/budget";
import { recomputeAndPersist } from "@/lib/services/schedule";

export const GET = api({}, async ({ user, params }) => {
  const role = await requireEvent(user.id, params.eventId!, "read_tasks");
  const e = await db.event.findUnique({ where: { id: params.eventId! } });
  if (!e) throw notFound();
  return { event: serializeEvent(e, role) };
});

export const PATCH = api({ body: eventPatch }, async ({ user, params, body }) => {
  const id = params.eventId!;
  await requireEvent(user.id, id, "write");
  const e = await db.$transaction(async (tx) => {
    const updated = await tx.event.update({ where: { id }, data: { ...body, date: body.date ? parseDay(body.date) : undefined, location: body.location === undefined ? undefined : body.location } });
    if (body.guestCount !== undefined) await recalcEstimates(tx, id, updated.guestCount);
    if (body.date) await recomputeAndPersist(tx, id); // deadline moved => refresh critical path
    await audit(tx, id, user.id, "event.updated", { fields: Object.keys(body) });
    return updated;
  });
  return { event: serializeEvent(e) };
});

export const DELETE = api({}, async ({ user, params }) => {
  await requireEvent(user.id, params.eventId!, "delete_event");
  await db.event.delete({ where: { id: params.eventId! } });
  return { ok: true };
});
