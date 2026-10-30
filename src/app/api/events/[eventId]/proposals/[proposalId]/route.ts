import { api, HttpError, requireEvent } from "@/lib/http";
import { db } from "@/lib/db";
import { decisionInput } from "@/lib/schemas";
import { applyActions } from "@/lib/services/actions";
import { audit } from "@/lib/services/common";

export const POST = api({ body: decisionInput }, async ({ user, params, body }) => {
  const eventId = params.eventId!;
  await requireEvent(user.id, eventId, "write");
  return db.$transaction(async (tx) => {
    // Atomic claim: only one concurrent request can flip pending -> decided (no double-apply).
    const claimed = await tx.proposal.updateMany({ where: { id: params.proposalId!, eventId, status: "pending" }, data: { status: body.decision === "accept" ? "accepted" : "rejected" } });
    if (claimed.count === 0) throw new HttpError(409, "This proposal was already handled or does not exist");
    if (body.decision === "reject") {
      await audit(tx, eventId, user.id, "proposal.rejected", { proposalId: params.proposalId! });
      return { status: "rejected" };
    }
    const p = await tx.proposal.findUniqueOrThrow({ where: { id: params.proposalId! } });
    const result = await applyActions(tx, eventId, user.id, p.actions as unknown[]); // throws => whole transaction (incl. claim) rolls back
    return { status: "accepted", result };
  });
});
