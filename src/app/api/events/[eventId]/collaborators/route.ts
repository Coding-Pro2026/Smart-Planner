import { api, HttpError, requireEvent } from "@/lib/http";
import { db } from "@/lib/db";
import { collaboratorInput } from "@/lib/schemas";
import { audit } from "@/lib/services/common";

export const GET = api({}, async ({ user, params }) => {
  await requireEvent(user.id, params.eventId!, "read");
  const rows = await db.collaborator.findMany({ where: { eventId: params.eventId! }, include: { user: { select: { email: true } } } });
  return { collaborators: rows.map((c) => ({ id: c.id, userId: c.userId, email: c.user.email, role: c.role })) };
});

export const POST = api({ body: collaboratorInput, rate: { name: "collab-add", limit: 20, windowMs: 60_000 } }, async ({ user, params, body }) => {
  const eventId = params.eventId!;
  await requireEvent(user.id, eventId, "manage");
  const target = await db.user.findUnique({ where: { email: body.email }, select: { id: true } });
  if (!target) throw new HttpError(404, "No account with that email — ask them to register first");
  const c = await db.collaborator.upsert({ where: { eventId_userId: { eventId, userId: target.id } }, create: { eventId, userId: target.id, role: body.role }, update: {} });
  if (c.role === "owner") throw new HttpError(409, "That user already owns this event");
  const updated = await db.collaborator.update({ where: { id: c.id }, data: { role: body.role } });
  await audit(db, eventId, user.id, "collaborator.set", { userId: target.id, role: body.role });
  return { collaborator: { id: updated.id, role: updated.role } };
});
