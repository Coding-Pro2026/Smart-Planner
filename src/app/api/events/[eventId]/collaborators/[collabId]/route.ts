import { api, HttpError, notFound, requireEvent } from "@/lib/http";
import { db } from "@/lib/db";
import { audit } from "@/lib/services/common";

export const DELETE = api({}, async ({ user, params }) => {
  const eventId = params.eventId!;
  await requireEvent(user.id, eventId, "manage");
  const c = await db.collaborator.findFirst({ where: { id: params.collabId!, eventId } });
  if (!c) throw notFound();
  if (c.role === "owner") throw new HttpError(409, "The owner cannot be removed");
  await db.collaborator.delete({ where: { id: c.id } });
  await audit(db, eventId, user.id, "collaborator.removed", { userId: c.userId });
  return { ok: true };
});
