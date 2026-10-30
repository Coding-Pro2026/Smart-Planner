import { describe, expect, it, vi } from "vitest";
import { runPlanningGraph, type Checkpoint } from "@/lib/agent/graph";
import type { EventContext } from "@/lib/agent/context";
import type { LlmConfig } from "@/lib/llm/types";
import { applyActions } from "@/lib/services/actions";

const ctx: EventContext = {
  event: { id: "e1", title: "T", type: "wedding", date: "2031-06-15", location: null, guestCount: 100, targetBudget: 30000, currency: "USD", daysToEvent: 400 },
  tasks: [{ id: "t-venue", title: "Book venue", category: "Venue", start: "2030-06-01", due: "2030-07-01", status: "todo", dependsOn: [], critical: false }],
  budget: { grandTotal: 0, remaining: 30000, percentUsed: 0, categories: [] },
  vendors: [{ id: "v1", name: "A", serviceType: "Photo", status: "quoted", quote: 1, hasParsedQuote: true }, { id: "v2", name: "B", serviceType: "Photo", status: "quoted", quote: 2, hasParsedQuote: true }],
  theme: null,
};
const llm: LlmConfig = { provider: "openai", apiKey: "k", fastModel: "f", reasoningModel: "r" };

describe("planning graph", () => {
  it("routes via supervisor, fans out in parallel, validates tool calls, checkpoints each node", async () => {
    const gen = vi.fn(async (_c: LlmConfig, req: { schemaName: string }) => {
      if (req.schemaName === "route") return { delegations: [{ agent: "logistics", instruction: "x" }, { agent: "logistics", instruction: "dup" }, { agent: "vendor", instruction: "y" }] };
      if (req.schemaName === "logistics_result")
        return { reply: "Tasks added.", warnings: [], toolCalls: [{ tool: "create_task", args: { title: "A", category: "c", daysBeforeEvent: 10, durationDays: 1, bufferDays: 0, dependsOn: ["t-venue"] } }, { tool: "create_task", args: { title: "B", category: "c", daysBeforeEvent: 5, durationDays: 1, bufferDays: 0, dependsOn: ["A"] } }, { tool: "shift_schedule", args: { taskId: "fake", days: 1, reason: "" } }] };
      return { reply: "Compared.", warnings: ["watch the fees"], toolCalls: [{ tool: "compare_vendor_quotes", args: { vendorIds: ["v1", "v2", "ghost"] } }] };
    });
    const cps: Checkpoint[] = [];
    const loadQuotes = vi.fn(async (ids: string[]) => ids.map((id) => ({ vendorId: id, vendorName: id, terms: { lineItems: [{ description: "Photo", amount: id === "v1" ? 100 : 200 }], serviceCharges: [], paymentSchedule: [], riskClauses: [], warnings: [] } })));
    const s = await runPlanningGraph({ input: "plan", context: ctx }, { llm, generate: gen as never, loadQuotes, checkpoint: (c) => void cps.push(c) });
    expect(s.delegations.map((d) => d.agent)).toEqual(["logistics", "vendor"]); // deduped
    expect(s.actions.map((a) => a.tool)).toEqual(["create_task", "create_task"]); // bad shift dropped
    expect(s.warnings.join()).toMatch(/unknown task "fake"/);
    expect(s.warnings).toContain("watch the fees");
    expect(loadQuotes).toHaveBeenCalledWith(["v1", "v2"]); // unknown vendor id filtered before the lookup
    expect(s.insights.comparison?.lowestTotalVendorId).toBe("v1");
    expect(s.reply).toContain("Tasks added.");
    expect(cps.map((c) => c.node)).toEqual(["supervisor", "specialists", "merge"]);
    expect(cps.every((c) => !("context" in c.state) && !("image" in c.state))).toBe(true);
  });

  it("answers directly when no specialist is needed", async () => {
    const gen = vi.fn(async () => ({ delegations: [], directReply: "Hello!" }));
    const s = await runPlanningGraph({ input: "hi", context: ctx }, { llm, generate: gen as never, loadQuotes: async () => [] });
    expect(s.reply).toBe("Hello!");
    expect(gen).toHaveBeenCalledTimes(1);
    expect(s.actions).toEqual([]);
  });

  it("a poisoned message cannot widen the toolset: unknown tools fail schema validation upstream", async () => {
    const { toolCallSchema } = await import("@/lib/agent/tools");
    expect(toolCallSchema.safeParse({ tool: "delete_event", args: {} }).success).toBe(false);
    expect(toolCallSchema.safeParse({ tool: "add_budget_item", args: { name: "x", category: "y", unitCost: -10 } }).success).toBe(false);
    expect(toolCallSchema.safeParse({ tool: "create_task", args: { title: "x" } }).success).toBe(false); // needs a date
  });
});

describe("applyActions guards", () => {
  it("rejects malformed stored actions before touching the DB", async () => {
    await expect(applyActions({} as never, "e", "u", [{ tool: "drop_tables", args: {} }])).rejects.toThrow(/invalid/);
  });
});
