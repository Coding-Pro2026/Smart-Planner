import { api, requireEvent } from "@/lib/http";
import { db } from "@/lib/db";
import { rsvpInput } from "@/lib/schemas";
import { audit } from "@/lib/services/common";

export const GET = api({}, async ({ user, params }) => {
  await requireEvent(user.id, params.eventId!, "read");
  const rsvps = await db.guestRsvp.findMany({ where: { eventId: params.eventId! }, orderBy: { guestName: "asc" }, take: 2000 });
  const counts = { invited: 0, accepted: 0, declined: 0, maybe: 0 };
  for (const r of rsvps) counts[r.status]++;
  return { rsvps, counts };
});

export const POST = api({ body: rsvpInput }, async ({ user, params, body }) => {
  const id = params.eventId!;
  await requireEvent(user.id, id, "write");
  const rsvp = await db.guestRsvp.create({ data: { ...body, eventId: id } });
  await audit(db, id, user.id, "rsvp.added", { rsvpId: rsvp.id });
  return { rsvp };
});
