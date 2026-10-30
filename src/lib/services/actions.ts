import { actionSchema, type Action } from "../agent/tools";
import { calculateLine } from "../engine/budget";
import { addDays, dayNumber } from "../engine/dates";
import { shiftSchedule } from "../engine/schedule";
import { audit, isoDate, parseDay, type Tx } from "./common";
import { estimateFor, syncActualSpend } from "./budget";
import { loadScheduleTasks, recomputeAndPersist } from "./schedule";

export class ActionError extends Error {}

/** Resolve an LLM-supplied task reference (id first, then case-insensitive title) within ONE event. */
export function resolveRef(ref: string, pool: { id: string; title: string }[]): string | null {
  const byId = pool.find((t) => t.id === ref);
  if (byId) return byId.id;
  const lower = ref.trim().toLowerCase();
  return pool.find((t) => t.title.trim().toLowerCase() === lower)?.id ?? null;
}

export interface ApplyResult {
  tasksCreated: number;
  budgetItemsAdded: number;
  tasksShifted: number;
  themeSaved: boolean;
}

/**
 * Apply an accepted proposal inside the caller's transaction. Re-validates every action with Zod and
 * re-scopes every reference to `eventId` — a stale or tampered proposal cannot touch another event.
 */
export async function applyActions(tx: Tx, eventId: string, actorId: string, rawActions: unknown[]): Promise<ApplyResult> {
  const actions: Action[] = rawActions.map((a, i) => {
    const r = actionSchema.safeParse(a);
    if (!r.success) throw new ActionError(`Action ${i + 1} is invalid: ${r.error.issues[0]?.message ?? "unknown"}`);
    return r.data;
  });
  const event = await tx.event.findUniqueOrThrow({ where: { id: eventId } });
  const eventDate = isoDate(event.date);
  const result: ApplyResult = { tasksCreated: 0, budgetItemsAdded: 0, tasksShifted: 0, themeSaved: false };

  for (const action of actions) {
    switch (action.tool) {
      case "create_task": {
        const a = action.args;
        const due = a.dueDate ?? addDays(eventDate, -(a.daysBeforeEvent ?? 0));
        dayNumber(due);
        const start = addDays(due, -a.durationDays);
        const pool = (await tx.task.findMany({ where: { eventId }, select: { id: true, title: true } }));
        const deps = a.dependsOn.map((r) => {
          const id = resolveRef(r, pool);
          if (!id) throw new ActionError(`Unknown dependency "${r}" for task "${a.title}"`);
          return id;
        });
        await tx.task.create({ data: { eventId, title: a.title, category: a.category, startDate: parseDay(start), dueDate: parseDay(due), bufferDays: a.bufferDays, dependencies: [...new Set(deps)] } });
        result.tasksCreated++;
        break;
      }
      case "shift_schedule": {
        const { tasks, deadline } = await loadScheduleTasks(tx, eventId);
        const id = resolveRef(action.args.taskId, tasks.map((t) => ({ id: t.id, title: t.title ?? "" })));
        if (!id) throw new ActionError(`Unknown task "${action.args.taskId}"`);
        const shifted = shiftSchedule(tasks, id, action.args.days, { deadline });
        for (const c of shifted.changes) {
          await tx.task.update({ where: { id: c.id }, data: { startDate: parseDay(c.toStart), dueDate: parseDay(c.toDue) } });
        }
        result.tasksShifted += shifted.changes.length;
        break;
      }
      case "add_budget_item": {
        const a = action.args;
        calculateLine(a, event.guestCount); // throws on invalid values before we write
        await tx.budgetItem.create({ data: { eventId, name: a.name, category: a.category, unitCost: a.unitCost, quantity: a.quantity, taxPct: a.taxPct, contingencyPct: a.contingencyPct, perGuest: a.perGuest, estimatedCost: estimateFor(a, event.guestCount) } });
        result.budgetItemsAdded++;
        break;
      }
      case "save_theme": {
        await tx.event.update({ where: { id: eventId }, data: { theme: action.args.palette } });
        result.themeSaved = true;
        break;
      }
    }
  }
  if (result.tasksCreated || result.tasksShifted) await recomputeAndPersist(tx, eventId); // throws CycleError => whole proposal rolls back
  await syncActualSpend(tx, eventId);
  await audit(tx, eventId, actorId, "proposal.applied", { ...result, count: actions.length });
  return result;
}

/** Human-readable one-liner for the confirmation banner (deterministic, no LLM). */
export function summarizeActions(actions: Action[]): string {
  const c = { task: 0, budget: 0, shift: [] as string[], theme: false };
  for (const a of actions) {
    if (a.tool === "create_task") c.task++;
    else if (a.tool === "add_budget_item") c.budget++;
    else if (a.tool === "shift_schedule") c.shift.push(`${a.args.days > 0 ? "+" : ""}${a.args.days}d`);
    else c.theme = true;
  }
  const parts = [];
  if (c.task) parts.push(`add ${c.task} task${c.task > 1 ? "s" : ""}`);
  if (c.budget) parts.push(`add ${c.budget} budget item${c.budget > 1 ? "s" : ""}`);
  if (c.shift.length) parts.push(`shift the timeline (${c.shift.join(", ")})`);
  if (c.theme) parts.push("save the theme palette");
  return parts.length ? `Assistant wants to ${parts.join(", ")}.` : "No changes proposed.";
}
