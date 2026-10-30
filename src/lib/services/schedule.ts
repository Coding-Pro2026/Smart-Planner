import { computeCriticalPath, type ScheduleResult, type ScheduleTask } from "../engine/schedule";
import { isoDate, parseDay, type Tx } from "./common";

export async function loadScheduleTasks(tx: Tx, eventId: string): Promise<{ tasks: ScheduleTask[]; deadline: string }> {
  const [event, rows] = await Promise.all([
    tx.event.findUniqueOrThrow({ where: { id: eventId }, select: { date: true } }),
    tx.task.findMany({ where: { eventId }, orderBy: [{ startDate: "asc" }, { id: "asc" }] }),
  ]);
  return {
    deadline: isoDate(event.date),
    tasks: rows.map((t) => ({ id: t.id, title: t.title, start: isoDate(t.startDate), due: isoDate(t.dueDate), dependencies: t.dependencies, bufferDays: t.bufferDays, status: t.status })),
  };
}

/** Recompute the CPM schedule from stored tasks and persist cascaded dates + critical flags. Throws on cycles. */
export async function recomputeAndPersist(tx: Tx, eventId: string): Promise<ScheduleResult> {
  const { tasks, deadline } = await loadScheduleTasks(tx, eventId);
  const result = computeCriticalPath(tasks, { deadline });
  for (const t of result.tasks) {
    const before = tasks.find((x) => x.id === t.id)!;
    await tx.task.update({
      where: { id: t.id },
      data: { ...(t.start !== before.start ? { startDate: parseDay(t.start) } : {}), ...(t.due !== before.due ? { dueDate: parseDay(t.due) } : {}), isCriticalPath: t.isCritical },
    });
  }
  return result;
}
