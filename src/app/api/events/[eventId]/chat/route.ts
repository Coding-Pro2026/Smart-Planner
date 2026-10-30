import { Prisma } from "@prisma/client";
import { api, requireEvent } from "@/lib/http";
import { db } from "@/lib/db";
import { buildEventContext } from "@/lib/agent/context";
import { runPlanningGraph, type Checkpoint } from "@/lib/agent/graph";
import { validateImage } from "@/lib/images";
import { resolveLlmConfig } from "@/lib/llm/resolve";
import { chatInput } from "@/lib/schemas";
import { summarizeActions } from "@/lib/services/actions";
import { loadQuotes } from "@/lib/services/quotes";
import { audit } from "@/lib/services/common";

export const maxDuration = 120;

/**
 * Runs the planning graph. State-changing results are stored as a PENDING proposal; nothing is
 * written to the plan until a user with write access accepts it.
 */
export const POST = api({ body: chatInput, rate: { name: "chat", limit: 20, windowMs: 60_000 } }, async ({ req, user, params, body }) => {
  const eventId = params.eventId!;
  await requireEvent(user.id, eventId, "write");
  const llm = await resolveLlmConfig(req, user.id);
  const image = body.image ? validateImage(body.image) : undefined;
  const context = await buildEventContext(db, eventId);

  const run = await db.agentRun.create({ data: { eventId, userId: user.id, input: body.message.slice(0, 2000) } });
  const checkpoints: Checkpoint[] = [];
  try {
    const state = await runPlanningGraph(
      { input: body.message, history: body.history, context, image },
      {
        llm,
        loadQuotes: (ids) => loadQuotes(eventId, ids),
        checkpoint: async (cp) => {
          checkpoints.push(cp);
          await db.agentRun.update({ where: { id: run.id }, data: { checkpoints: checkpoints as unknown as Prisma.InputJsonArray } });
        },
      },
    );
    await db.agentRun.update({ where: { id: run.id }, data: { status: "completed" } });

    let proposal: { id: string; summary: string; actions: unknown[] } | null = null;
    if (state.actions.length) {
      const summary = summarizeActions(state.actions);
      const p = await db.proposal.create({ data: { eventId, userId: user.id, summary, actions: state.actions as unknown as Prisma.InputJsonArray } });
      proposal = { id: p.id, summary, actions: state.actions };
      await audit(db, eventId, user.id, "proposal.created", { proposalId: p.id, actions: state.actions.length });
    }
    return { reply: state.reply, warnings: state.warnings, agents: state.delegations.map((d) => d.agent), proposal, comparison: state.insights.comparison ?? null, palette: state.insights.palette ?? null, runId: run.id };
  } catch (e) {
    await db.agentRun.update({ where: { id: run.id }, data: { status: "failed" } });
    throw e;
  }
});
