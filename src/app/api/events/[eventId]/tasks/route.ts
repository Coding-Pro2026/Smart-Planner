import { api, HttpError, requireEvent } from "@/lib/http";
import { db } from "@/lib/db";
import { taskInput } from "@/lib/schemas";
import { serializeTask } from "@/lib/serialize";
import { audit, parseDay } from "@/lib/services/common";
import { loadScheduleTasks, recomputeAndPersist } from "@/lib/services/schedule";
import { computeCriticalPath } from "@/lib/engine/schedule";
import { dayNumber } from "@/lib/engine/dates";

export const GET = api({}, async ({ user, params }) => {
  const id = params.eventId!;
  await requireEvent(user.id, id, "read_tasks");
  const [rows, { tasks, deadline }] = await Promise.all([db.task.findMany({ where: { eventId: id }, orderBy: [{ startDate: "asc" }, { id: "asc" }] }), loadScheduleTasks(db, id)]);
  const cpm = computeCriticalPath(tasks, { deadline });
  const slack = Object.fromEntries(cpm.tasks.map((t) => [t.id, t.slackDays]));
  return { tasks: rows.map((t) => ({ ...serializeTask(t), slackDays: slack[t.id] ?? 0 })), criticalPath: cpm.criticalPath, projectEnd: cpm.projectEnd, overrunDays: cpm.overrunDays, eventDate: deadline };
});

export const POST = api({ body: taskInput }, async ({ user, params, body }) => {
  const id = params.eventId!;
  await requireEvent(user.id, id, "write");
  if (dayNumber(body.dueDate) < dayNumber(body.startDate)) throw new HttpError(400, "Due date is before start date");
  const task = await db.$transaction(async (tx) => {
    const deps = [...new Set(body.dependencies)];
    if (deps.length && (await tx.task.count({ where: { id: { in: deps }, eventId: id } })) !== deps.length) throw new HttpError(400, "Unknown dependency");
    const t = await tx.task.create({ data: { ...body, dependencies: deps, assignedTo: body.assignedTo ?? null, eventId: id, startDate: parseDay(body.startDate), dueDate: parseDay(body.dueDate) } });
    await recomputeAndPersist(tx, id);
    await audit(tx, id, user.id, "task.created", { taskId: t.id, title: t.title });
    return tx.task.findUniqueOrThrow({ where: { id: t.id } });
  });
  return { task: serializeTask(task) };
});
