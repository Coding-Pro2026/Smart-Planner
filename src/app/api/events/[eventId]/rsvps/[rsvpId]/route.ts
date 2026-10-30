import { api, notFound, requireEvent } from "@/lib/http";
import { db } from "@/lib/db";
import { rsvpPatch } from "@/lib/schemas";

export const PATCH = api({ body: rsvpPatch }, async ({ user, params, body }) => {
  const eventId = params.eventId!;
  await requireEvent(user.id, eventId, "write");
  const r = await db.guestRsvp.updateMany({ where: { id: params.rsvpId!, eventId }, data: body });
  if (r.count === 0) throw notFound();
  return { rsvp: await db.guestRsvp.findFirstOrThrow({ where: { id: params.rsvpId!, eventId } }) };
});

export const DELETE = api({}, async ({ user, params }) => {
  const eventId = params.eventId!;
  await requireEvent(user.id, eventId, "write");
  const r = await db.guestRsvp.deleteMany({ where: { id: params.rsvpId!, eventId } });
  if (r.count === 0) throw notFound();
  return { ok: true };
});
