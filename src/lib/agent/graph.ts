import { z } from "zod";
import { generateStructured } from "../llm/structured";
import type { ImageInput, LlmConfig } from "../llm/types";
import { fenceUntrusted, sanitizeUntrusted, UNTRUSTED_NOTICE } from "../security/sanitize";
import { BENCHMARK_ALLOCATIONS } from "../engine/budget";
import { compareQuotes } from "../engine/quotes";
import { quoteTermsSchema } from "../documents/quote-schema";
import { actionSchema, paletteSchema, toolCallSchema, TOOL_DOCS, type Action, type ToolCall } from "./tools";
import type { EventContext } from "./context";

/**
 * Planning orchestrator: a small, typed state graph (Supervisor -> fan-out specialists -> merge)
 * with a checkpoint written after every node. LangGraph-compatible in shape, but dependency-free so
 * every edge is unit-testable with a fake model.
 *
 *   supervisor ──► [theme | budget | logistics | vendor] (parallel) ──► merge
 */

export const AGENTS = ["theme", "budget", "logistics", "vendor"] as const;
export type AgentName = (typeof AGENTS)[number];

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface GraphState {
  input: string;
  image?: ImageInput;
  history: ChatTurn[];
  context: EventContext;
  delegations: { agent: AgentName; instruction: string }[];
  agentOutputs: { agent: AgentName; reply: string; toolCalls: ToolCall[]; warnings: string[] }[];
  directReply?: string;
  reply: string;
  actions: Action[];
  insights: { comparison?: ReturnType<typeof compareQuotes>; palette?: z.infer<typeof paletteSchema> };
  warnings: string[];
}

export interface Checkpoint {
  node: string;
  at: string;
  state: Omit<GraphState, "context" | "image">;
}

export interface GraphDeps {
  llm: LlmConfig;
  /** Quote lookup for the deterministic compare tool (already tenant-scoped by the caller). */
  loadQuotes: (vendorIds: string[]) => Promise<{ vendorId: string; vendorName: string; terms: z.infer<typeof quoteTermsSchema> }[]>;
  checkpoint?: (cp: Checkpoint) => Promise<void> | void;
  generate?: typeof generateStructured;
}

const supervisorSchema = z.object({
  delegations: z.array(z.object({ agent: z.enum(AGENTS), instruction: z.string().trim().min(1).max(500) })).max(4),
  directReply: z.string().trim().max(1500).optional(),
});

const agentOutputSchema = z.object({
  reply: z.string().trim().max(2000),
  toolCalls: z.array(toolCallSchema).max(15).default([]),
  warnings: z.array(z.string().trim().max(300)).max(5).default([]),
});

const ROLE: Record<AgentName, { tier: "fast" | "reasoning"; prompt: string }> = {
  theme: { tier: "reasoning", prompt: "You are the Theme & Ideation agent. Suggest cohesive themes, colour palettes, decor and menu/dietary ideas tailored to the event. If an image is attached, describe its palette (hex codes), style and decor elements." },
  budget: {
    tier: "reasoning",
    prompt: `You are the Budget Allocator agent. Propose budget line items via add_budget_item. Use realistic per-unit costs in the event currency. Benchmark category split for this event type (percent of target): ${"%BENCH%"}. Never compute totals yourself.`,
  },
  logistics: { tier: "fast", prompt: "You are the Logistics & Timeline agent. Break the event into milestones relative to event day (T-minus days) via create_task, using dependsOn for prerequisites (e.g. florals depend on venue contract). Use shift_schedule only to move an existing task by a number of days." },
  vendor: { tier: "reasoning", prompt: "You are the Vendor & Contract agent. Help choose and compare vendors. To compare uploaded quotes call compare_vendor_quotes with vendor ids from context. Advise on risks (hidden fees, cancellation terms)." },
};

function contextBlock(c: EventContext): string {
  return `Event context (trusted, from the database):\n${JSON.stringify(c)}`;
}

function userBlock(s: GraphState): string {
  const hist = s.history.slice(-8).map((h) => `${h.role}: ${sanitizeUntrusted(h.content, 600).text}`).join("\n");
  return `${contextBlock(s.context)}\n\n${hist ? fenceUntrusted("history", hist) + "\n\n" : ""}${fenceUntrusted("user_message", sanitizeUntrusted(s.input, 2000).text)}`;
}

export async function runPlanningGraph(init: Pick<GraphState, "input" | "context"> & Partial<Pick<GraphState, "image" | "history">>, deps: GraphDeps): Promise<GraphState> {
  const gen = deps.generate ?? generateStructured;
  let state: GraphState = { history: [], delegations: [], agentOutputs: [], reply: "", actions: [], insights: {}, warnings: [], ...init };
  const save = async (node: string) => {
    const rest: Omit<GraphState, "context" | "image"> & { context?: unknown; image?: unknown } = { ...state };
    delete rest.context; // checkpoints hold decisions, not the (large) context or any image bytes
    delete rest.image;
    await deps.checkpoint?.({ node, at: new Date().toISOString(), state: rest });
  };
  const flags = sanitizeUntrusted(init.input).flags;
  if (flags.length) state.warnings.push(`Your message contains text that looks like prompt-injection (${flags.join(", ")}); it was treated as plain data.`);

  // ── Supervisor ────────────────────────────────────────────────────────────
  const sup = await gen(deps.llm, {
    tier: "fast",
    schema: supervisorSchema,
    schemaName: "route",
    system: `You are the Supervisor of an event-planning assistant. Decide which specialists should handle the user's request: theme (ideas, palettes, decor, menus), budget (cost line items, allocations), logistics (tasks, milestones, schedule changes), vendor (vendors, quotes, contracts). Pick only what is needed (0-4). For greetings or general questions that need no specialist, answer in directReply.\n${UNTRUSTED_NOTICE}`,
    user: userBlock(state),
  });
  state = { ...state, delegations: dedupe(sup.delegations), directReply: sup.directReply };
  await save("supervisor");

  // ── Specialists (parallel fan-out) ───────────────────────────────────────
  if (state.delegations.length) {
    const bench = JSON.stringify(BENCHMARK_ALLOCATIONS[state.context.event.type as keyof typeof BENCHMARK_ALLOCATIONS] ?? {});
    const outputs = await Promise.all(
      state.delegations.map(async (d) => {
        const role = ROLE[d.agent];
        const useImage = d.agent === "theme" && state.image;
        if (useImage) {
          const p = await gen(deps.llm, { tier: "reasoning", schema: paletteSchema, schemaName: "palette", images: [state.image!], system: `${role.prompt}\n${UNTRUSTED_NOTICE}`, user: `${contextBlock(state.context)}\n\nTask: ${d.instruction}\nExtract the palette from the attached mood board image.` });
          state.insights.palette = { ...p, colors: dedupeColors(p.colors) };
        }
        const out = await gen(deps.llm, {
          tier: role.tier,
          schema: agentOutputSchema,
          schemaName: `${d.agent}_result`,
          system: `${role.prompt.replace("%BENCH%", bench)}\n\n${TOOL_DOCS}\n\nReturn {reply, toolCalls, warnings}. Keep reply concise and practical. Only reference ids that appear in the context.\n${UNTRUSTED_NOTICE}`,
          user: `${userBlock(state)}\n\nYour delegated task: ${d.instruction}`,
        });
        return { agent: d.agent, ...out };
      }),
    );
    state = { ...state, agentOutputs: outputs };
    await save("specialists");
  }

  // ── Merge (deterministic) ────────────────────────────────────────────────
  state = await merge(state, deps);
  await save("merge");
  return state;
}

function dedupe<T extends { agent: string }>(xs: T[]): T[] {
  const seen = new Set<string>();
  return xs.filter((x) => (seen.has(x.agent) ? false : (seen.add(x.agent), true)));
}
function dedupeColors(cs: z.infer<typeof paletteSchema>["colors"]) {
  const seen = new Set<string>();
  return cs.map((c) => ({ ...c, hex: c.hex.toLowerCase() })).filter((c) => (seen.has(c.hex) ? false : (seen.add(c.hex), true)));
}

/** Validates every tool call against real event data; invalid references are dropped with a warning. */
async function merge(s: GraphState, deps: GraphDeps): Promise<GraphState> {
  const warnings = [...s.warnings];
  const actions: Action[] = [];
  const replies: string[] = s.directReply ? [s.directReply] : [];
  const taskIds = new Set(s.context.tasks.map((t) => t.id));
  const taskTitles = new Map(s.context.tasks.map((t) => [t.title.toLowerCase(), t.id]));
  const vendorIds = new Set(s.context.vendors.map((v) => v.id));
  const batchTitles = new Set<string>();
  const seenBudget = new Set<string>(); // within-batch duplicate guard
  const insights = { ...s.insights };

  for (const o of s.agentOutputs) {
    if (o.reply) replies.push(o.reply);
    warnings.push(...o.warnings);
    for (const call of o.toolCalls) {
      if (call.tool === "create_task") {
        const bad = call.args.dependsOn.find((r) => !taskIds.has(r) && !taskTitles.has(r.toLowerCase()) && !batchTitles.has(r.toLowerCase()));
        if (bad) { warnings.push(`Skipped task "${call.args.title}": unknown dependency "${bad}".`); continue; }
        batchTitles.add(call.args.title.toLowerCase());
        actions.push({ tool: "create_task", args: call.args });
      } else if (call.tool === "shift_schedule") {
        if (!taskIds.has(call.args.taskId) && !taskTitles.has(call.args.taskId.toLowerCase())) { warnings.push(`Skipped schedule shift: unknown task "${call.args.taskId}".`); continue; }
        actions.push({ tool: "shift_schedule", args: call.args });
      } else if (call.tool === "add_budget_item") {
        const k = `${call.args.category}|${call.args.name}`.toLowerCase();
        if (seenBudget.has(k)) continue;
        seenBudget.add(k);
        actions.push({ tool: "add_budget_item", args: call.args });
      } else if (call.tool === "compare_vendor_quotes") {
        const ids = call.args.vendorIds.filter((id) => vendorIds.has(id));
        if (ids.length < 2) { warnings.push("Quote comparison needs at least two known vendors."); continue; }
        const quotes = await deps.loadQuotes(ids);
        if (quotes.length < 2) { warnings.push("Fewer than two of those vendors have a parsed quote yet — upload their PDFs first."); continue; }
        insights.comparison = compareQuotes(quotes);
      }
    }
  }
  if (insights.palette) actions.push({ tool: "save_theme", args: { palette: insights.palette } });
  const valid = actions.filter((a) => actionSchema.safeParse(a).success);
  return { ...s, actions: valid, insights, warnings: [...new Set(warnings)], reply: replies.join("\n\n") || "I'm not sure how to help with that — try asking about budget, timeline, theme ideas or vendors." };
}
