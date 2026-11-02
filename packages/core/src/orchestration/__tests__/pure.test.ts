import { describe, expect, it } from "vitest";
import { TASK_STATUSES } from "@agentopia/shared";
import { assertTransition, canTransition, TASK_TRANSITIONS } from "../state-machine";
import { deterministicDecomposition, hasCycle, inferSpecialty, scoreCandidates, validatePlan, type CandidateInput } from "../planner";

describe("task state machine", () => {
  it("allows the happy path", () => {
    const path = ["BACKLOG", "PLANNING", "ASSIGNED", "IN_PROGRESS", "REVIEW", "COMPLETED"] as const;
    for (let i = 0; i < path.length - 1; i++) expect(canTransition(path[i]!, path[i + 1]!)).toBe(true);
  });
  it("allows approvals, rework, retry and cancel", () => {
    expect(canTransition("IN_PROGRESS", "WAITING_APPROVAL")).toBe(true);
    expect(canTransition("WAITING_APPROVAL", "IN_PROGRESS")).toBe(true);
    expect(canTransition("REVIEW", "IN_PROGRESS")).toBe(true);
    expect(canTransition("FAILED", "IN_PROGRESS")).toBe(true);
    for (const s of TASK_STATUSES) {
      if (!["COMPLETED", "FAILED", "CANCELLED"].includes(s)) expect(canTransition(s, "CANCELLED")).toBe(true);
    }
  });
  it("rejects invalid transitions", () => {
    expect(canTransition("COMPLETED", "IN_PROGRESS")).toBe(false);
    expect(canTransition("BACKLOG", "COMPLETED")).toBe(false);
    expect(canTransition("ASSIGNED", "REVIEW")).toBe(false);
    expect(canTransition("IN_PROGRESS", "IN_PROGRESS")).toBe(false);
    expect(() => assertTransition("COMPLETED", "CANCELLED")).toThrow(/cannot move/);
  });
  it("parks for provider limits and resumes / blocks / cancels from there", () => {
    expect(canTransition("ASSIGNED", "WAITING_FOR_PROVIDER_LIMIT")).toBe(true);
    expect(canTransition("IN_PROGRESS", "WAITING_FOR_PROVIDER_LIMIT")).toBe(true);
    expect(canTransition("WAITING_FOR_PROVIDER_LIMIT", "ASSIGNED")).toBe(true);
    expect(canTransition("WAITING_FOR_PROVIDER_LIMIT", "BLOCKED")).toBe(true);
    expect(canTransition("WAITING_FOR_PROVIDER_LIMIT", "CANCELLED")).toBe(true);
    expect(canTransition("WAITING_FOR_PROVIDER_LIMIT", "IN_PROGRESS")).toBe(false);
    expect(canTransition("WAITING_FOR_PROVIDER_LIMIT", "COMPLETED")).toBe(false);
    expect(canTransition("BACKLOG", "WAITING_FOR_PROVIDER_LIMIT")).toBe(false);
    expect(canTransition("COMPLETED", "WAITING_FOR_PROVIDER_LIMIT")).toBe(false);
  });
  it("has an entry for every status", () => {
    for (const s of TASK_STATUSES) expect(Array.isArray(TASK_TRANSITIONS[s])).toBe(true);
  });
});

const base: CandidateInput = { id: "x", name: "X", specialty: "FRONTEND", role: "EMPLOYEE", rank: "JUNIOR", status: "ACTIVE", activeAssignments: 0, evidenceCount: 0, hasEnabledSkill: false };

describe("planner", () => {
  it("infers specialty from keywords", () => {
    expect(inferSpecialty("Build a React signup form", "Tailwind, accessible")).toBe("FRONTEND");
    expect(inferSpecialty("Add an API endpoint", "Store rows in Postgres via Prisma migration")).toBe("BACKEND");
    expect(inferSpecialty("Write Playwright e2e tests", "regression coverage")).toBe("QA");
    expect(inferSpecialty("Research competitor pricing", "compare options")).toBe("RESEARCH");
    expect(inferSpecialty("Wireframe the onboarding", "user flow mockup")).toBe("UIUX");
    expect(inferSpecialty("Hello", "world")).toBeNull();
  });

  it("scores by specialty, status, availability, rank, evidence and skills", () => {
    const res = scoreCandidates({ title: "Build a React page", description: "component" }, [
      { ...base, id: "busy", name: "Busy", rank: "EXPERT", activeAssignments: 1 },
      { ...base, id: "free", name: "Free" },
      { ...base, id: "skilled", name: "Skilled", hasEnabledSkill: true, evidenceCount: 3 },
      { ...base, id: "paused", name: "Paused", status: "PAUSED", rank: "EXPERT" },
      { ...base, id: "be", name: "Backend", specialty: "BACKEND", rank: "EXPERT" },
    ]);
    expect(res.map((r) => r.employeeId)).toEqual(["skilled", "free", "busy", "be", "paused"]);
    expect(res[0]!.employeeId).toBe("skilled");
    expect(res.find((r) => r.employeeId === "paused")!.eligible).toBe(false);
    expect(res.find((r) => r.employeeId === "be")!.eligible).toBe(false);
    expect(res[0]!.reasons[0]).toMatch(/specialty match/);
  });

  it("respects requiredSpecialty over inference", () => {
    const res = scoreCandidates({ title: "Build a React page", description: "", requiredSpecialty: "QA" }, [base, { ...base, id: "qa", name: "QA", specialty: "QA" }]);
    expect(res[0]!.employeeId).toBe("qa");
  });

  it("validates plans and rejects cycles", () => {
    expect(hasCycle([[1], [0]])).toBe(true);
    expect(hasCycle([[], [0], [0, 1]])).toBe(false);
    expect(hasCycle([[5]])).toBe(true);
    expect(() => validatePlan({ subtasks: [{ title: "aaa", description: "bbb", specialty: "QA", dependsOn: [0] }] })).toThrow(/cycle/);
    expect(() => validatePlan({ subtasks: new Array(7).fill({ title: "aaa", description: "bbb", specialty: "QA" }) })).toThrow();
  });

  it("decomposes explicit multi-specialty deliverables only", () => {
    const plan = deterministicDecomposition("Signup", "Deliverables:\n- Build the React signup form component\n- Add the signup API endpoint with Prisma\n- Write Playwright e2e tests for signup", "FRONTEND");
    expect(plan?.subtasks.map((s) => s.specialty)).toEqual(["FRONTEND", "BACKEND", "QA"]);
    expect(plan?.subtasks[2]!.dependsOn).toEqual([0, 1]);
    expect(deterministicDecomposition("x", "- React button\n- CSS tweak for the page", "FRONTEND")).toBeNull();
    expect(deterministicDecomposition("x", "just one paragraph", null)).toBeNull();
  });
});
