import { z } from "zod";

/**
 * Typed tool contracts. The LLM may only emit these shapes; anything else fails Zod validation.
 * No tool accepts a computed total, a derived date, or a free-form URL.
 */
const title = z.string().trim().min(1).max(160);
const category = z.string().trim().min(1).max(60);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const ref = z.string().trim().min(1).max(160);

export const createTaskArgs = z
  .object({
    title,
    category: category.default("general"),
    /** Offset from event day T-0, e.g. 30 means 30 days before. Preferred. */
    daysBeforeEvent: z.number().int().min(0).max(1500).optional(),
    dueDate: isoDate.optional(),
    durationDays: z.number().int().min(0).max(365).default(1),
    bufferDays: z.number().int().min(0).max(120).default(0),
    /** Existing task ids, or titles of tasks created earlier in the same batch. */
    dependsOn: z.array(ref).max(10).default([]),
  })
  .refine((a) => a.daysBeforeEvent !== undefined || a.dueDate !== undefined, { message: "daysBeforeEvent or dueDate is required" });

export const shiftScheduleArgs = z.object({
  taskId: ref,
  days: z.number().int().min(-365).max(365).refine((n) => n !== 0, "days must be non-zero"),
  reason: z.string().trim().max(200).default(""),
});

export const addBudgetItemArgs = z.object({
  name: title,
  category,
  unitCost: z.number().finite().min(0).max(1e8),
  quantity: z.number().finite().min(0).max(1e6).default(1),
  taxPct: z.number().finite().min(0).max(100).default(0),
  contingencyPct: z.number().finite().min(0).max(100).default(0),
  perGuest: z.boolean().default(false),
});

export const compareVendorQuotesArgs = z.object({ vendorIds: z.array(ref).min(2).max(6) });

export const paletteSchema = z.object({
  colors: z.array(z.object({ hex: z.string().regex(/^#[0-9a-fA-F]{6}$/), name: z.string().trim().max(40) })).min(1).max(8),
  styleKeywords: z.array(z.string().trim().max(40)).max(10),
  decorElements: z.array(z.string().trim().max(60)).max(12),
  dietarySuggestions: z.array(z.string().trim().max(80)).max(8),
  summary: z.string().trim().max(400),
});
export type Palette = z.infer<typeof paletteSchema>;

export const toolCallSchema = z.discriminatedUnion("tool", [
  z.object({ tool: z.literal("create_task"), args: createTaskArgs }),
  z.object({ tool: z.literal("shift_schedule"), args: shiftScheduleArgs }),
  z.object({ tool: z.literal("add_budget_item"), args: addBudgetItemArgs }),
  z.object({ tool: z.literal("compare_vendor_quotes"), args: compareVendorQuotesArgs }),
]);
export type ToolCall = z.infer<typeof toolCallSchema>;

/** Actions that mutate state; produced from tool calls and applied only after a human accepts. */
export const actionSchema = z.discriminatedUnion("tool", [
  z.object({ tool: z.literal("create_task"), args: createTaskArgs }),
  z.object({ tool: z.literal("shift_schedule"), args: shiftScheduleArgs }),
  z.object({ tool: z.literal("add_budget_item"), args: addBudgetItemArgs }),
  z.object({ tool: z.literal("save_theme"), args: z.object({ palette: paletteSchema }) }),
]);
export type Action = z.infer<typeof actionSchema>;

export const TOOL_DOCS = `Available tools (emit as {"tool": name, "args": {...}}):
- create_task: {title, category, daysBeforeEvent (int, days before event day; preferred) OR dueDate (YYYY-MM-DD), durationDays, bufferDays, dependsOn: [existing task id or title of an earlier task in this batch]}
- shift_schedule: {taskId (an existing id from context), days (non-zero int; positive = later), reason}
- add_budget_item: {name, category, unitCost (per unit, number), quantity, taxPct, contingencyPct, perGuest (true if cost is per guest)} — NEVER include totals; totals are calculated by the system.
- compare_vendor_quotes: {vendorIds: [2-6 vendor ids from context]}`;
