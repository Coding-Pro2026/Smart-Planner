import { api, HttpError, notFound, requireEvent } from "@/lib/http";
import { db } from "@/lib/db";
import { taskPatch } from "@/lib/schemas";
import { serializeTask } from "@/lib/serialize";
import { audit, isoDate, parseDay } from "@/lib/services/common";
import { recomputeAndPersist } from "@/lib/services/schedule";
import { dayNumber } from "@/lib/engine/dates";

export const PATCH = api({ body: taskPatch }, async ({ user, params, body }) => {
  const eventId = params.eventId!;
  await requireEvent(user.id, eventId, "write");
  const task = await db.$transaction(async (tx) => {
    const cur = await tx.task.findFirst({ where: { id: params.taskId!, eventId } });
    if (!cur) throw notFound();
    const start = body.startDate ?? isoDate(cur.startDate);
    const due = body.dueDate ?? isoDate(cur.dueDate);
    if (dayNumber(due) < dayNumber(start)) throw new HttpError(400, "Due date is before start date");
    let deps: string[] | undefined;
    if (body.dependencies) {
      deps = [...new Set(body.dependencies)];
      if (deps.includes(cur.id)) throw new HttpError(422, "A task cannot depend on itself");
      if (deps.length && (await tx.task.count({ where: { id: { in: deps }, eventId } })) !== deps.length) throw new HttpError(400, "Unknown dependency");
    }
    await tx.task.update({ where: { id: cur.id }, data: { ...body, dependencies: deps, startDate: parseDay(start), dueDate: parseDay(due) } });
    await recomputeAndPersist(tx, eventId); // cycle => throws => rollback
    await audit(tx, eventId, user.id, "task.updated", { taskId: cur.id, fields: Object.keys(body) });
    return tx.task.findUniqueOrThrow({ where: { id: cur.id } });
  });
  return { task: serializeTask(task) };
});

export const DELETE = api({}, async ({ user, params }) => {
  const eventId = params.eventId!;
  await requireEvent(user.id, eventId, "write");
  await db.$transaction(async (tx) => {
    const r = await tx.task.deleteMany({ where: { id: params.taskId!, eventId } });
    if (r.count === 0) throw notFound();
    // Remove dangling references from dependents.
    const dependents = await tx.task.findMany({ where: { eventId, dependencies: { has: params.taskId! } } });
    for (const d of dependents) await tx.task.update({ where: { id: d.id }, data: { dependencies: d.dependencies.filter((x) => x !== params.taskId) } });
    await recomputeAndPersist(tx, eventId);
    await audit(tx, eventId, user.id, "task.deleted", { taskId: params.taskId! });
  });
  return { ok: true };
});
