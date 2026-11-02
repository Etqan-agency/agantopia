import { describe, expect, it } from "vitest";
import type { TaskEvent } from "@agentopia/shared";
import { createDemoPlayer, normalizeScript, type Scheduler } from "./demo-player";

function fakeScheduler() {
  let now = 0;
  let id = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const sch: Scheduler = {
    setTimeout: (fn, ms) => {
      id += 1;
      timers.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimeout: (h) => void timers.delete(h as number),
    now: () => now,
  };
  const advance = (ms: number) => {
    const end = now + ms;
    for (;;) {
      const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > end) break;
      timers.delete(next[0]);
      now = next[1].at;
      next[1].fn();
    }
    now = end;
  };
  return { sch, advance };
}

const script = normalizeScript({
  items: [
    { type: "task.assigned", employeeId: "a", taskId: "t", payload: { title: "X" }, delayMs: 1000, simulated: true },
    { type: "task.started", employeeId: "a", taskId: "t", payload: {}, delayMs: 500, simulated: true },
    { type: "not.a.type", employeeId: "a", payload: {}, delayMs: 10 },
  ],
});

describe("demo player", () => {
  it("normalizes the script and drops unknown types", () => {
    expect(script).toHaveLength(2);
    expect(script[0]!.simulated).toBe(true);
  });

  it("plays items with their delays, marks them simulated and loops", () => {
    const { sch, advance } = fakeScheduler();
    const got: TaskEvent[] = [];
    const loops: number[] = [];
    const p = createDemoPlayer({ script, companyId: "demo", onEvent: (e) => got.push(e), onLoop: (n) => loops.push(n), loopGapMs: 2000, scheduler: sch });
    p.start();
    advance(999);
    expect(got).toHaveLength(0);
    advance(1);
    expect(got.map((e) => e.type)).toEqual(["task.assigned"]);
    expect(got[0]!.simulated).toBe(true);
    advance(500);
    expect(got).toHaveLength(2);
    advance(2000); // loop gap
    expect(loops).toEqual([1]);
    advance(1000);
    expect(got).toHaveLength(3);
    expect(got[2]!.seq).toBe(3);
  });

  it("respects speed, pause and resume", () => {
    const { sch, advance } = fakeScheduler();
    const got: TaskEvent[] = [];
    const p = createDemoPlayer({ script, companyId: "demo", onEvent: (e) => got.push(e), speed: 2, scheduler: sch });
    p.start();
    advance(250);
    p.pause();
    advance(10000);
    expect(got).toHaveLength(0);
    p.resume();
    advance(249);
    expect(got).toHaveLength(0);
    advance(1);
    expect(got).toHaveLength(1);
    p.setSpeed(1); // next delay 500ms at 1×
    advance(499);
    expect(got).toHaveLength(1);
    advance(1);
    expect(got).toHaveLength(2);
    p.stop();
  });
});
