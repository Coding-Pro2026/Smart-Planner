import { describe, expect, it } from "vitest";
import { computeCriticalPath } from "@/lib/engine/schedule";
import { starterTasks, STARTER_STEPS } from "@/lib/templates";

describe("starter templates", () => {
  it.each(Object.keys(STARTER_STEPS) as (keyof typeof STARTER_STEPS)[])("%s plan is acyclic, stable and finishes before the event", (type) => {
    const date = "2031-06-15";
    const t = starterTasks(type, date);
    const sched = t.map((x) => ({ id: x.key, start: x.startDate, due: x.dueDate, dependencies: x.deps }));
    const r = computeCriticalPath(sched, { deadline: date });
    expect(r.tasks.every((x) => x.shiftedDays === 0)).toBe(true); // dependency ordering already consistent
    expect(r.overrunDays).toBe(0);
    expect(Math.min(...r.tasks.map((x) => x.slackDays))).toBeGreaterThanOrEqual(0);
  });
});
