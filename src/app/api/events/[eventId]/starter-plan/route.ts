import { api, HttpError, requireEvent } from "@/lib/http";
import { db } from "@/lib/db";
import { seedStarterPlan } from "@/lib/services/starter";

export const POST = api({}, async ({ user, params }) => {
  const id = params.eventId!;
  await requireEvent(user.id, id, "write");
  if ((await db.task.count({ where: { eventId: id } })) > 0) throw new HttpError(409, "This event already has tasks");
  await db.$transaction((tx) => seedStarterPlan(tx, id, user.id));
  return { ok: true };
});
