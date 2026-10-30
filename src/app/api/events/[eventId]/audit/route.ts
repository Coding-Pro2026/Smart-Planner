import { api, requireEvent } from "@/lib/http";
import { db } from "@/lib/db";

export const GET = api({}, async ({ user, params }) => {
  await requireEvent(user.id, params.eventId!, "manage");
  const logs = await db.auditLog.findMany({ where: { eventId: params.eventId! }, orderBy: { timestamp: "desc" }, take: 100 });
  return { logs };
});
