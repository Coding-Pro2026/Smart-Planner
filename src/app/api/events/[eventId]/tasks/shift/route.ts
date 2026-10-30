import { api, requireEvent } from "@/lib/http";
import { db } from "@/lib/db";
import { shiftInput } from "@/lib/schemas";
import { shiftSchedule } from "@/lib/engine/schedule";
import { audit, parseDay } from "@/lib/services/common";
import { loadScheduleTasks } from "@/lib/services/schedule";
import { recomputeAndPersist } from "@/lib/services/schedule";
import { HttpError } from "@/lib/http";

/** Delay/advance a task and cascade downstream. `preview: true` returns the impact without saving. */
export const POST = api({ body: shiftInput }, async ({ user, params, body }) => {
  const eventId = params.eventId!;
  await requireEvent(user.id, eventId, "write");
  return db.$transaction(async (tx) => {
    const { tasks, deadline } = await loadScheduleTasks(tx, eventId);
    if (!tasks.some((t) => t.id === body.taskId)) throw new HttpError(404, "Task not found");
    const result = shiftSchedule(tasks, body.taskId, body.days, { deadline });
    const titles = Object.fromEntries(tasks.map((t) => [t.id, t.title]));
    const changes = result.changes.map((c) => ({ ...c, title: titles[c.id] }));
    if (!body.preview) {
      for (const c of result.changes) await tx.task.update({ where: { id: c.id }, data: { startDate: parseDay(c.toStart), dueDate: parseDay(c.toDue) } });
      await recomputeAndPersist(tx, eventId);
      await audit(tx, eventId, user.id, "schedule.shifted", { taskId: body.taskId, days: body.days, moved: changes.length });
    }
    return { applied: !body.preview, changes, criticalPath: result.criticalPath, overrunDays: result.overrunDays };
  });
});
