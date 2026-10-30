import { api, requireEvent } from "@/lib/http";
import { db } from "@/lib/db";

export const GET = api({}, async ({ user, params }) => {
  await requireEvent(user.id, params.eventId!, "write");
  const proposals = await db.proposal.findMany({ where: { eventId: params.eventId!, status: "pending" }, orderBy: { createdAt: "desc" }, take: 20 });
  return { proposals: proposals.map((p) => ({ id: p.id, summary: p.summary, actions: p.actions, createdAt: p.createdAt })) };
});
