import { describe, expect, it } from "vitest";
import { CycleError, ScheduleError, computeCriticalPath, shiftSchedule, topologicalSort, type ScheduleTask } from "@/lib/engine/schedule";
import { addDays, diffDays, dayNumber, resolveRelative } from "@/lib/engine/dates";

const T = (id: string, start: string, due: string, deps: string[] = [], extra: Partial<ScheduleTask> = {}): ScheduleTask => ({ id, start, due, dependencies: deps, ...extra });

// venue(Jan1) -> florals(Jan10-12) -> setup(Jan12-13);  venue -> catering(Jan2-5) -> setup
const plan = (): ScheduleTask[] => [
  T("venue", "2030-01-01", "2030-01-01"),
  T("florals", "2030-01-10", "2030-01-12", ["venue"]),
  T("catering", "2030-01-02", "2030-01-05", ["venue"]),
  T("setup", "2030-01-12", "2030-01-13", ["florals", "catering"]),
];

describe("dates", () => {
  it("does calendar math across month/leap boundaries", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2029-02-28", 1)).toBe("2029-03-01");
    expect(diffDays("2030-03-01", "2030-01-01")).toBe(59);
    expect(resolveRelative("2030-06-15", -180)).toBe("2029-12-17");
  });
  it("rejects invalid dates", () => {
    expect(() => dayNumber("2030-02-31")).toThrow(RangeError);
    expect(() => dayNumber("tomorrow")).toThrow(RangeError);
  });
});

describe("topologicalSort / cycle detection", () => {
  it("orders prerequisites first", () => {
    const o = topologicalSort(plan());
    expect(o.indexOf("venue")).toBeLessThan(o.indexOf("florals"));
    expect(o.indexOf("florals")).toBeLessThan(o.indexOf("setup"));
  });

  it("throws CycleError (not an infinite loop) on a 2-cycle", () => {
    const t = [T("a", "2030-01-01", "2030-01-02", ["b"]), T("b", "2030-01-03", "2030-01-04", ["a"])];
    expect(() => topologicalSort(t)).toThrow(CycleError);
    expect(() => computeCriticalPath(t)).toThrow(/Circular dependency/);
  });

  it("throws on a longer cycle and reports the path", () => {
    const t = [T("a", "2030-01-01", "2030-01-02", ["c"]), T("b", "2030-01-01", "2030-01-02", ["a"]), T("c", "2030-01-01", "2030-01-02", ["b"]), T("ok", "2030-01-01", "2030-01-02")];
    try {
      computeCriticalPath(t);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(CycleError);
      expect(new Set((e as CycleError).cycle)).toEqual(new Set(["a", "b", "c"]));
    }
  });

  it("throws on a self-dependency, unknown dependency, duplicate id, inverted dates", () => {
    expect(() => topologicalSort([T("a", "2030-01-01", "2030-01-02", ["a"])])).toThrow(CycleError);
    expect(() => topologicalSort([T("a", "2030-01-01", "2030-01-02", ["zzz"])])).toThrow(/unknown task/);
    expect(() => topologicalSort([T("a", "2030-01-01", "2030-01-02"), T("a", "2030-01-01", "2030-01-02")])).toThrow(ScheduleError);
    expect(() => topologicalSort([T("a", "2030-01-05", "2030-01-02")])).toThrow(/before start/);
  });

  it("handles a very deep chain without stack overflow", () => {
    const n = 5000;
    const chain = Array.from({ length: n }, (_, i) => T(`t${i}`, "2030-01-01", "2030-01-01", i ? [`t${i - 1}`] : []));
    expect(topologicalSort(chain)).toHaveLength(n);
    chain[0] = T("t0", "2030-01-01", "2030-01-01", [`t${n - 1}`]);
    expect(() => topologicalSort(chain)).toThrow(CycleError);
  });
});

describe("computeCriticalPath", () => {
  it("returns empty for no tasks", () => {
    expect(computeCriticalPath([]).criticalPath).toEqual([]);
  });

  it("identifies the critical path and slack", () => {
    const r = computeCriticalPath(plan());
    // venue float is bound by catering (late start Jan 9)
    expect(r.criticalPath).toEqual(["florals", "setup"]);
    expect(r.tasks.find((t) => t.id === "venue")!.slackDays).toBe(8);
    const catering = r.tasks.find((t) => t.id === "catering")!;
    expect(catering.isCritical).toBe(false);
    expect(catering.slackDays).toBeGreaterThan(0);
    expect(r.projectEnd).toBe("2030-01-13");
  });

  it("respects buffer days between dependent tasks", () => {
    const r = computeCriticalPath([T("a", "2030-01-01", "2030-01-03", [], { bufferDays: 5 }), T("b", "2030-01-04", "2030-01-05", ["a"])]);
    expect(r.tasks.find((t) => t.id === "b")!.start).toBe("2030-01-08");
    expect(r.tasks.find((t) => t.id === "b")!.due).toBe("2030-01-09");
  });

  it("flags overrun against a deadline and marks everything on the path critical", () => {
    const r = computeCriticalPath(plan(), { deadline: "2030-01-10" });
    expect(r.overrunDays).toBe(3);
    expect(r.tasks.find((t) => t.id === "setup")!.slackDays).toBeLessThan(0);
  });

  it("with a generous deadline, slack appears on every task", () => {
    const r = computeCriticalPath(plan(), { deadline: "2030-02-01" });
    expect(r.criticalPath).toEqual([]);
    expect(r.overrunDays).toBe(0);
  });

  it("never marks completed tasks critical and never moves them", () => {
    const t = plan();
    t[0] = { ...t[0]!, status: "done" };
    const r = computeCriticalPath(t);
    expect(r.criticalPath).not.toContain("venue");
    expect(r.tasks.find((x) => x.id === "venue")!.shiftedDays).toBe(0);
  });
});

describe("shiftSchedule", () => {
  it("cascades a 14-day venue delay to dependents and recomputes the critical path", () => {
    const r = shiftSchedule(plan(), "venue", 14);
    const get = (id: string) => r.tasks.find((t) => t.id === id)!;
    expect(get("venue").start).toBe("2030-01-15");
    // florals was Jan10 -> must now start after venue ends Jan15
    expect(get("florals").start).toBe("2030-01-15");
    expect(get("florals").due).toBe("2030-01-17");
    // catering (3 days) now ends Jan 18 and becomes the longest chain into setup
    expect(get("catering").due).toBe("2030-01-18");
    expect(get("setup").start).toBe("2030-01-18");
    expect(r.criticalPath).toEqual(["venue", "catering", "setup"]);
    expect(get("florals").slackDays).toBe(1);
    expect(r.changes.map((c) => c.id).sort()).toEqual(["catering", "florals", "setup", "venue"]);
  });

  it("only moves downstream tasks that actually collide", () => {
    const r = shiftSchedule(plan(), "venue", 2);
    expect(r.tasks.find((t) => t.id === "florals")!.start).toBe("2030-01-10"); // had room
    expect(r.tasks.find((t) => t.id === "catering")!.start).toBe("2030-01-03"); // started the day venue used to finish
    expect(r.changes.map((c) => c.id)).toEqual(["venue", "catering"]);
  });

  it("does not pull dependents earlier when a task is advanced", () => {
    const r = shiftSchedule(plan(), "venue", -3);
    expect(r.changes.map((c) => c.id)).toEqual(["venue"]);
  });

  it("refuses to shift completed or unknown tasks, and non-integers", () => {
    const t = plan();
    t[0] = { ...t[0]!, status: "done" };
    expect(() => shiftSchedule(t, "venue", 1)).toThrow(/completed/);
    expect(() => shiftSchedule(plan(), "nope", 1)).toThrow(/Unknown/);
    expect(() => shiftSchedule(plan(), "venue", 1.5)).toThrow(/whole number/);
  });

  it("does not mutate the input", () => {
    const t = plan();
    const snap = JSON.stringify(t);
    shiftSchedule(t, "venue", 30);
    expect(JSON.stringify(t)).toBe(snap);
  });
});
