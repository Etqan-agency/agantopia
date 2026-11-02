import { describe, expect, it } from "vitest";
import type { EventType, TaskEvent } from "@agentopia/shared";
import { CHECK_MS, PRESENT_MS, initialState, reduce, type Command, type EmployeeAnimState, type FsmContext, type FsmInput } from "./state-machine";

let seq = 0;
function ev(type: EventType, employeeId: string | null, payload: Record<string, unknown> = {}, taskId = "t1"): TaskEvent {
  seq += 1;
  return { seq, id: `e${seq}`, companyId: "c1", taskId, employeeId, type, payload, createdAt: new Date(0).toISOString() };
}

const ctx = (over: Partial<FsmContext> = {}): FsmContext => ({
  employeeId: "mina",
  homeDeskId: "desk-mina",
  managerDeskId: "desk-boss",
  deskOf: (id) => (id === "boss" ? "desk-boss" : id === "mina" ? "desk-mina" : null),
  reducedMotion: false,
  ...over,
});

function run(s: EmployeeAnimState, inputs: FsmInput[], c: FsmContext) {
  const all: Command[] = [];
  for (const i of inputs) {
    const r = reduce(s, i, c);
    s = r.state;
    all.push(...r.commands);
  }
  return { state: s, commands: all };
}

describe("state machine: main sequence", () => {
  it("assigned → started → handoff → review → completed", () => {
    const c = ctx();
    let s = initialState("IDLE");
    expect(s.mode).toBe("idle");

    let r = reduce(s, ev("task.assigned", "mina"), c);
    s = r.state;
    expect(s.mode).toBe("thinking");
    expect(r.commands).toEqual(expect.arrayContaining([{ type: "lamp", on: true }, { type: "icon", icon: "hourglass" }]));
    expect(s.taskId).toBe("t1");

    r = reduce(s, ev("task.started", "mina"), c);
    s = r.state;
    expect(s.mode).toBe("working");
    expect(r.commands).toEqual(expect.arrayContaining([{ type: "anim", anim: "typing" }, { type: "icon", icon: null }]));

    r = reduce(s, ev("execution.tool_use", "mina"), c);
    expect(r.commands).toEqual([]); // already working: no churn
    s = r.state;

    r = reduce(s, ev("task.handoff", "mina", { fromEmployeeId: "mina", toEmployeeId: "boss", artifactIds: [], summary: "done" }), c);
    s = r.state;
    expect(s.mode).toBe("handoff_walk");
    expect(r.commands[0]).toEqual({ type: "walkTo", target: "visit", deskId: "desk-boss" });
    expect(r.commands).toEqual(expect.arrayContaining([{ type: "lamp", on: false }, { type: "anim", anim: "walk" }, { type: "prop", prop: "folder" }]));

    r = reduce(s, { type: "arrived" }, c);
    s = r.state;
    expect(s.mode).toBe("presenting");
    expect(s.location).toBe("visit");

    // Manager starts reviewing while Mina presents: Mina is unaffected.
    r = reduce(s, ev("task.review_started", "boss", { reviewerId: "boss" }), c);
    expect(r.state).toBe(s);

    r = reduce(s, { type: "tick", dt: PRESENT_MS - 1 }, c);
    s = r.state;
    expect(s.mode).toBe("presenting");
    r = reduce(s, { type: "tick", dt: 1 }, c);
    s = r.state;
    expect(s.mode).toBe("returning");
    expect(r.commands[0]).toEqual({ type: "walkTo", target: "home" });

    r = reduce(s, { type: "arrived" }, c);
    s = r.state;
    expect(s.mode).toBe("idle");
    expect(s.location).toBe("home");

    r = reduce(s, ev("task.review_decided", "boss", { approved: true, reviewerId: "boss", assigneeId: "mina" }), c);
    s = r.state;
    expect(s.mode).toBe("idle");
    expect(s.icon).toBe("check");
    s = reduce(s, { type: "tick", dt: CHECK_MS }, c).state;
    expect(s.icon).toBeNull();

    r = reduce(s, ev("task.completed", "mina"), c);
    s = r.state;
    expect(s.mode).toBe("completed");
    expect(s.icon).toBe("check");
    s = run(s, [{ type: "tick", dt: 1000 }, { type: "tick", dt: 1000 }], c).state;
    expect(s.mode).toBe("idle");
    expect(s.icon).toBeNull();
  });

  it("reviewer shuffles papers and returns to idle after deciding", () => {
    const c = ctx({ employeeId: "boss", homeDeskId: "desk-boss" });
    let s = initialState("IDLE");
    let r = reduce(s, ev("task.review_started", "boss", { reviewerId: "boss" }), c);
    s = r.state;
    expect(s.mode).toBe("reviewing");
    expect(r.commands).toEqual(expect.arrayContaining([{ type: "anim", anim: "shuffle" }]));
    r = reduce(s, ev("task.review_decided", "boss", { approved: false, reviewerId: "boss", assigneeId: "mina" }), c);
    expect(r.state.mode).toBe("idle");
  });

  it("a review decided while walking is queued until the employee is back", () => {
    const c = ctx();
    let s = run(initialState("WORKING"), [ev("task.handoff", "mina", { fromEmployeeId: "mina", toEmployeeId: "boss" })], c).state;
    s = reduce(s, ev("task.review_decided", "boss", { approved: true, reviewerId: "boss", assigneeId: "mina" }), c).state;
    expect(s.mode).toBe("handoff_walk");
    s = run(s, [{ type: "arrived" }, { type: "tick", dt: PRESENT_MS }, { type: "arrived" }], c).state;
    expect(s.mode).toBe("idle");
    expect(s.icon).toBe("check");
  });

  it("rejected review cuts the presentation short and walks back to work", () => {
    const c = ctx();
    let s = run(initialState("WORKING"), [ev("task.handoff", "mina", { fromEmployeeId: "mina", toEmployeeId: "boss" }), { type: "arrived" }], c).state;
    expect(s.mode).toBe("presenting");
    const r = reduce(s, ev("task.review_decided", "boss", { reviewerId: "boss", assigneeId: "mina" }), c); // approved missing → false
    s = r.state;
    expect(s.mode).toBe("returning");
    expect(r.commands[0]).toEqual({ type: "walkTo", target: "home" });
    s = reduce(s, { type: "arrived" }, c).state;
    expect(s.mode).toBe("working");
    expect(s.lamp).toBe(true);
    expect(s.anim).toBe("typing");
  });

  it("ignores events for other employees", () => {
    const c = ctx();
    const s = initialState("IDLE");
    expect(reduce(s, ev("task.started", "someone-else"), c).state).toBe(s);
    expect(reduce(s, ev("task.handoff", "x", { fromEmployeeId: "x", toEmployeeId: "boss" }), c).state).toBe(s);
  });
});

describe("state machine: review payload variants", () => {
  it("accepts decision: APPROVED and infers the worker from the task when no assignee is given", () => {
    const c = ctx();
    let s = run(initialState("IDLE"), [ev("task.assigned", "mina"), ev("task.started", "mina")], c).state;
    s = reduce(s, ev("task.review_decided", "qa", { decision: "APPROVED", reviewerId: "qa" }), c).state;
    expect(s.mode).toBe("idle");
    expect(s.icon).toBe("check");
  });

  it("walks to the recipient's desk when the recipient is on the floor", () => {
    const c = ctx({ deskOf: (id) => (id === "qa" ? "desk-qa" : null) });
    const r = reduce(initialState("WORKING"), ev("task.handoff", "mina", { fromEmployeeId: "mina", toEmployeeId: "qa" }), c);
    expect(r.commands[0]).toEqual({ type: "walkTo", target: "visit", deskId: "desk-qa" });
  });
});

describe("state machine: failure branch", () => {
  it("failed → blocked with lamp off, cross icon and slump", () => {
    const c = ctx();
    let s = run(initialState("IDLE"), [ev("task.assigned", "mina"), ev("task.started", "mina")], c).state;
    const r = reduce(s, ev("task.failed", "mina", { message: "boom" }), c);
    s = r.state;
    expect(s.mode).toBe("blocked");
    expect(r.commands).toEqual(
      expect.arrayContaining([{ type: "lamp", on: false }, { type: "icon", icon: "cross" }, { type: "anim", anim: "slump" }]),
    );
    // A retry restarts work.
    s = reduce(s, ev("task.started", "mina"), c).state;
    expect(s.mode).toBe("working");
    expect(s.icon).toBeNull();
  });

  it("blocked and waiting approval and cancel", () => {
    const c = ctx();
    let s = reduce(initialState("WORKING"), ev("task.waiting_approval", "mina"), c).state;
    expect(s.mode).toBe("waiting_approval");
    expect(s.icon).toBe("exclamation");
    expect(s.lamp).toBe(true);
    s = reduce(s, ev("task.blocked", "mina"), c).state;
    expect(s.mode).toBe("blocked");
    s = reduce(s, ev("task.cancelled", "mina"), c).state;
    expect(s.mode).toBe("idle");
    expect(s.taskId).toBeNull();
  });
});

describe("state machine: employee.state overrides", () => {
  it("authoritative projection overrides local state", () => {
    const c = ctx();
    let s = reduce(initialState("IDLE"), ev("employee.state", "mina", { state: "WORKING", taskId: "t9" }), c).state;
    expect(s.mode).toBe("working");
    expect(s.taskId).toBe("t9");
    const r = reduce(s, ev("employee.state", "mina", { state: "OFFLINE" }), c);
    s = r.state;
    expect(s.mode).toBe("offline");
    expect(r.commands).toEqual(expect.arrayContaining([{ type: "desaturate", on: true }, { type: "lamp", on: false }]));
    // Offline ignores task events until the projection says otherwise.
    expect(reduce(s, ev("task.started", "mina"), c).state).toBe(s);
    const back = reduce(s, ev("employee.state", "mina", { state: "IDLE" }), c);
    expect(back.state.mode).toBe("idle");
    expect(back.commands).toEqual(expect.arrayContaining([{ type: "desaturate", on: false }]));
  });

  it("offline while away snaps home", () => {
    const c = ctx();
    const s = run(initialState("WORKING"), [ev("task.handoff", "mina", { fromEmployeeId: "mina" })], c).state;
    const r = reduce(s, ev("employee.state", "mina", { state: "OFFLINE" }), c);
    expect(r.commands[0]).toEqual({ type: "teleport", target: "home" });
    expect(r.state.location).toBe("home");
  });

  it("initial state honours status and visual state", () => {
    expect(initialState("WORKING").lamp).toBe(true);
    expect(initialState("WORKING", { status: "PAUSED" }).mode).toBe("offline");
    expect(initialState("COMPLETED").mode).toBe("idle");
  });
});

describe("state machine: reduced motion", () => {
  it("never walks; handoff presents in place and state applies immediately", () => {
    const c = ctx({ reducedMotion: true });
    const inputs: FsmInput[] = [
      ev("task.assigned", "mina"),
      ev("task.started", "mina"),
      ev("task.handoff", "mina", { fromEmployeeId: "mina", toEmployeeId: "boss" }),
    ];
    const first = run(initialState("IDLE"), inputs, c);
    let s = first.state;
    expect(s.mode).toBe("presenting");
    expect(s.location).toBe("home");
    expect(first.commands.some((x) => x.type === "walkTo")).toBe(false);

    // Decision arrives while presenting: applies immediately, no walking.
    const r = reduce(s, ev("task.review_decided", "boss", { reviewerId: "boss", assigneeId: "mina", approved: false }), c);
    s = r.state;
    expect(s.mode).toBe("working");
    expect(r.commands.some((x) => x.type === "walkTo")).toBe(false);

    // Presentation timer ends without walking.
    s = run(s, [ev("task.handoff", "mina", { fromEmployeeId: "mina" }), { type: "tick", dt: PRESENT_MS }], c).state;
    expect(s.mode).toBe("idle");
    expect(s.location).toBe("home");
  });
});
