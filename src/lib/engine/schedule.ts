import { dayNumber, fromDayNumber } from "./dates";

/**
 * Deterministic scheduling engine: DAG validation + Critical Path Method.
 *
 * Model: finish-to-start dependencies. A task occupies [start, due] (due == start => milestone).
 * A successor may not start before `pred.due + pred.bufferDays`.
 * Forward pass pushes tasks LATER when needed and never pulls them earlier (a manual delay of an
 * upstream task cascades downstream; pulling one earlier does not silently re-plan others).
 * Backward pass is anchored on `deadline` (e.g. event day) or, if none, the project's own end.
 * Completed tasks are frozen: they never move and are never flagged critical.
 */

export type TaskState = "todo" | "in_progress" | "done" | "blocked";

export interface ScheduleTask {
  id: string;
  start: string;
  due: string;
  dependencies: string[];
  bufferDays?: number;
  status?: TaskState;
  title?: string;
}

export interface ScheduledTask {
  id: string;
  start: string;
  due: string;
  originalStart: string;
  originalDue: string;
  shiftedDays: number;
  /** Late start / late finish (ISO) without delaying the deadline. */
  lateStart: string;
  lateFinish: string;
  slackDays: number;
  isCritical: boolean;
}

export interface ScheduleResult {
  tasks: ScheduledTask[];
  order: string[];
  /** Critical tasks in topological order. */
  criticalPath: string[];
  projectEnd: string;
  /** Days the plan runs past `deadline` (0 if it fits or no deadline given). */
  overrunDays: number;
}

export class ScheduleError extends Error {}
export class CycleError extends ScheduleError {
  constructor(public readonly cycle: string[]) {
    super(`Circular dependency detected: ${cycle.join(" -> ")}`);
  }
}

function validate(tasks: ScheduleTask[]): Map<string, ScheduleTask> {
  const byId = new Map<string, ScheduleTask>();
  for (const t of tasks) {
    if (byId.has(t.id)) throw new ScheduleError(`Duplicate task id: ${t.id}`);
    byId.set(t.id, t);
  }
  for (const t of tasks) {
    if (dayNumber(t.due) < dayNumber(t.start)) throw new ScheduleError(`Task ${t.id}: due date is before start date`);
    if ((t.bufferDays ?? 0) < 0 || !Number.isInteger(t.bufferDays ?? 0)) throw new ScheduleError(`Task ${t.id}: bufferDays must be a non-negative integer`);
    for (const d of t.dependencies) {
      if (d === t.id) throw new CycleError([t.id, t.id]);
      if (!byId.has(d)) throw new ScheduleError(`Task ${t.id} depends on unknown task ${d}`);
    }
  }
  return byId;
}

/** Iterative DFS (no recursion limit) that recovers one concrete cycle for the error message. */
function findCycle(tasks: ScheduleTask[], byId: Map<string, ScheduleTask>): string[] {
  const state = new Map<string, 0 | 1 | 2>();
  for (const root of tasks) {
    if (state.get(root.id)) continue;
    const stack: { id: string; i: number }[] = [{ id: root.id, i: 0 }];
    const path: string[] = [root.id];
    state.set(root.id, 1);
    while (stack.length) {
      const top = stack[stack.length - 1]!;
      const deps = byId.get(top.id)!.dependencies;
      if (top.i < deps.length) {
        const next = deps[top.i++]!;
        const s = state.get(next);
        if (s === 1) return [...path.slice(path.indexOf(next)), next].reverse();
        if (!s) {
          state.set(next, 1);
          stack.push({ id: next, i: 0 });
          path.push(next);
        }
      } else {
        state.set(top.id, 2);
        stack.pop();
        path.pop();
      }
    }
  }
  return [];
}

/** Kahn topological sort; throws CycleError instead of looping on cyclic input. */
export function topologicalSort(tasks: ScheduleTask[]): string[] {
  const byId = validate(tasks);
  const indeg = new Map<string, number>();
  const succ = new Map<string, string[]>();
  for (const t of tasks) {
    indeg.set(t.id, new Set(t.dependencies).size);
    succ.set(t.id, []);
  }
  for (const t of tasks) for (const d of new Set(t.dependencies)) succ.get(d)!.push(t.id);
  const queue = tasks.filter((t) => indeg.get(t.id) === 0).map((t) => t.id);
  const order: string[] = [];
  for (let h = 0; h < queue.length; h++) {
    const id = queue[h]!;
    order.push(id);
    for (const s of succ.get(id)!) {
      const n = indeg.get(s)! - 1;
      indeg.set(s, n);
      if (n === 0) queue.push(s);
    }
  }
  if (order.length !== tasks.length) throw new CycleError(findCycle(tasks, byId));
  return order;
}

export function computeCriticalPath(tasks: ScheduleTask[], opts: { deadline?: string } = {}): ScheduleResult {
  const byId = validate(tasks);
  const order = topologicalSort(tasks);
  const buf = (id: string) => byId.get(id)!.bufferDays ?? 0;
  const frozen = (id: string) => byId.get(id)!.status === "done";

  // Forward pass.
  const es = new Map<string, number>();
  const ef = new Map<string, number>();
  const dur = new Map<string, number>();
  for (const id of order) {
    const t = byId.get(id)!;
    const d = dayNumber(t.due) - dayNumber(t.start);
    dur.set(id, d);
    let start = dayNumber(t.start);
    if (!frozen(id)) {
      for (const p of t.dependencies) start = Math.max(start, ef.get(p)! + buf(p));
    }
    es.set(id, start);
    ef.set(id, start + d);
  }

  const maxEf = order.length ? Math.max(...order.map((id) => ef.get(id)!)) : 0;
  const deadlineN = opts.deadline ? dayNumber(opts.deadline) : undefined;
  const projectEndN = deadlineN ?? maxEf;

  // Backward pass.
  const succ = new Map<string, string[]>(order.map((id) => [id, []]));
  for (const t of tasks) for (const d of new Set(t.dependencies)) succ.get(d)!.push(t.id);
  const ls = new Map<string, number>();
  const lf = new Map<string, number>();
  for (const id of [...order].reverse()) {
    let finish = projectEndN;
    for (const s of succ.get(id)!) finish = Math.min(finish, ls.get(s)! - buf(id));
    lf.set(id, finish);
    ls.set(id, finish - dur.get(id)!);
  }

  const out: ScheduledTask[] = tasks.map((t) => {
    const slack = ls.get(t.id)! - es.get(t.id)!;
    return {
      id: t.id,
      start: fromDayNumber(es.get(t.id)!),
      due: fromDayNumber(ef.get(t.id)!),
      originalStart: t.start,
      originalDue: t.due,
      shiftedDays: es.get(t.id)! - dayNumber(t.start),
      lateStart: fromDayNumber(ls.get(t.id)!),
      lateFinish: fromDayNumber(lf.get(t.id)!),
      slackDays: slack,
      isCritical: !frozen(t.id) && slack <= 0,
    };
  });
  const crit = new Set(out.filter((t) => t.isCritical).map((t) => t.id));
  return {
    tasks: out,
    order,
    criticalPath: order.filter((id) => crit.has(id)),
    projectEnd: fromDayNumber(projectEndN),
    overrunDays: deadlineN === undefined ? 0 : Math.max(0, maxEf - deadlineN),
  };
}

export interface ScheduleChange {
  id: string;
  fromStart: string;
  fromDue: string;
  toStart: string;
  toDue: string;
}

/**
 * Delay (or advance) one task by `days` and cascade the consequences downstream.
 * Returns the full recomputed schedule plus a minimal change list for confirmation UIs.
 */
export function shiftSchedule(
  tasks: ScheduleTask[],
  taskId: string,
  days: number,
  opts: { deadline?: string } = {},
): ScheduleResult & { changes: ScheduleChange[] } {
  if (!Number.isInteger(days)) throw new ScheduleError("Shift must be a whole number of days");
  const target = tasks.find((t) => t.id === taskId);
  if (!target) throw new ScheduleError(`Unknown task ${taskId}`);
  if (target.status === "done") throw new ScheduleError(`Task ${taskId} is already completed and cannot be shifted`);
  const moved = tasks.map((t) =>
    t.id === taskId ? { ...t, start: fromDayNumber(dayNumber(t.start) + days), due: fromDayNumber(dayNumber(t.due) + days) } : t,
  );
  const result = computeCriticalPath(moved, opts);
  const changes: ScheduleChange[] = [];
  for (const r of result.tasks) {
    const before = tasks.find((t) => t.id === r.id)!;
    if (r.start !== before.start || r.due !== before.due) {
      changes.push({ id: r.id, fromStart: before.start, fromDue: before.due, toStart: r.start, toDue: r.due });
    }
  }
  return { ...result, changes };
}
