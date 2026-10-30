import { allocateBenchmark, fromCents } from "../engine/budget";
import { isoDate, audit, parseDay, type Tx } from "./common";
import { estimateFor } from "./budget";
import { recomputeAndPersist } from "./schedule";
import { starterTasks } from "../templates";

/** Deterministic starter timeline + benchmark budget lines. Works with no LLM key. */
export async function seedStarterPlan(tx: Tx, eventId: string, actorId: string) {
  const e = await tx.event.findUniqueOrThrow({ where: { id: eventId } });
  const steps = starterTasks(e.eventType, isoDate(e.date));
  const idByKey = new Map<string, string>();
  for (const s of steps) {
    const t = await tx.task.create({ data: { eventId, title: s.title, category: s.category, startDate: parseDay(s.startDate), dueDate: parseDay(s.dueDate), bufferDays: s.bufferDays, dependencies: s.deps.map((k) => idByKey.get(k)!).filter(Boolean) } });
    idByKey.set(s.key, t.id);
  }
  await recomputeAndPersist(tx, eventId);
  const target = Number(e.targetBudget);
  if (target > 0) {
    for (const a of allocateBenchmark(e.eventType, target)) {
      if (a.cents === 0) continue;
      const unitCost = fromCents(a.cents);
      await tx.budgetItem.create({ data: { eventId, category: a.category, name: `${a.category} (benchmark ${a.pct}%)`, unitCost, quantity: 1, estimatedCost: estimateFor({ name: a.category, category: a.category, unitCost, quantity: 1 }, e.guestCount) } });
    }
  }
  await audit(tx, eventId, actorId, "starter_plan.seeded", { tasks: steps.length });
}
