import { describe, expect, it } from "vitest";
import type { EventType, TaskEvent } from "@agentopia/shared";
import { describeEvent, projectLive, titleFromEvent } from "./describe";

const ev = (type: EventType, employeeId: string | null, payload: Record<string, unknown> = {}): TaskEvent => ({
  seq: 1, id: "e", companyId: "c", taskId: "t1", employeeId, type, payload, createdAt: new Date(0).toISOString(),
});
const lookup = { name: (id: string | null | undefined) => (id === "m" ? "Mina" : id === "a" ? "Ada" : null), title: () => "Fix header" };

describe("describeEvent", () => {
  it("writes human sentences", () => {
    expect(describeEvent(ev("task.started", "m"), lookup)).toBe("Mina started working on ‘Fix header’");
    expect(describeEvent(ev("task.handoff", "m", { fromEmployeeId: "m", toEmployeeId: "a" }), lookup)).toBe("Mina handed ‘Fix header’ to Ada");
    expect(describeEvent(ev("task.review_decided", "a", { decision: "APPROVED" }), lookup)).toBe("Ada approved ‘Fix header’");
    expect(describeEvent(ev("task.review_decided", "a", {}), lookup)).toBe("Ada sent ‘Fix header’ back for changes");
  });
  it("does not take approval titles as task titles", () => {
    expect(titleFromEvent(ev("task.waiting_approval", "m", { title: "Run a migration" }))).toBeNull();
    expect(titleFromEvent(ev("task.created", "m", { title: "Fix header" }))).toBe("Fix header");
  });
});

describe("projectLive", () => {
  it("tracks list-view state from events", () => {
    let s = { m: { visualState: "IDLE" as const, currentTaskId: null }, a: { visualState: "IDLE" as const, currentTaskId: null } } as Parameters<typeof projectLive>[0];
    s = projectLive(s, ev("task.started", "m"));
    expect(s.m!.visualState).toBe("WORKING");
    expect(s.m!.currentTaskId).toBe("t1");
    s = projectLive(s, ev("employee.state", "m", { state: "BLOCKED" }));
    expect(s.m!.visualState).toBe("BLOCKED");
    const same = projectLive(s, ev("task.started", "zzz"));
    expect(same).toBe(s);
  });
});
