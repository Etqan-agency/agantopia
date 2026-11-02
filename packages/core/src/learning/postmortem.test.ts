import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@agentopia/db";
import { setLearningDeps } from "./deps";
import { generateTaskPostmortem } from "./postmortem";
import type { SynthFn } from "./synth";
import { createCompanyFixture, createEmployee, type Fixture } from "./test-fixtures";

describe("generateTaskPostmortem", () => {
  let fx: Fixture;
  let restore: () => void;
  beforeAll(async () => {
    fx = await createCompanyFixture("Postmortem Co");
    restore = setLearningDeps({ emitEvent: async () => undefined });
  });
  afterAll(async () => {
    restore();
    await fx.cleanup();
  });

  it("drafts a deterministic TASK_LESSON from task records, scoped to employee + project", async () => {
    const emp = await createEmployee(fx.companyId, "FRONTEND");
    const project = await prisma.project.create({ data: { companyId: fx.companyId, name: "Site" } });
    const task = await prisma.task.create({
      data: {
        companyId: fx.companyId,
        projectId: project.id,
        assigneeId: emp.id,
        title: "Build pricing page",
        description: "Create a responsive pricing page with three tiers.",
        status: "COMPLETED",
        attempt: 2,
        resultSummary: "Implemented PricingTable component with tests.",
        completedAt: new Date("2026-10-30T10:00:00Z"),
        requiredSpecialty: "FRONTEND",
      },
    });
    await prisma.artifact.create({ data: { companyId: fx.companyId, taskId: task.id, name: "PricingTable.tsx", kind: "FILE" } });
    await prisma.taskEvent.create({ data: { companyId: fx.companyId, taskId: task.id, type: "task.review_decided", payload: { decision: "APPROVED", note: "Looks good, contrast fixed" } } });
    const ex = await prisma.executionSession.create({
      data: { companyId: fx.companyId, taskId: task.id, employeeId: emp.id, attempt: 1, provider: "simulated", mode: "SIMULATED", status: "FAILED", error: "type error in props" },
    });
    expect(ex.id).toBeTruthy();

    const synthSpy: SynthFn = async () => {
      throw new Error("must not be called in ZERO mode");
    };
    const entry = await generateTaskPostmortem(task.id, { mode: "ZERO", synth: synthSpy });
    expect(entry).not.toBeNull();
    expect(entry).toMatchObject({ kind: "TASK_LESSON", provenance: "TASK_POSTMORTEM_DETERMINISTIC", status: "DRAFT", employeeId: emp.id, projectId: project.id, taskId: task.id });
    expect(entry!.content).toContain("What was asked: Create a responsive pricing page");
    expect(entry!.content).toContain("What was delivered: Implemented PricingTable");
    expect(entry!.content).toContain("PricingTable.tsx (file)");
    expect(entry!.content).toContain("Review: approved: Looks good, contrast fixed");
    expect(entry!.content).toContain("Errors: type error in props");
    expect(entry!.tags).toEqual(expect.arrayContaining(["task-lesson", "frontend", "completed"]));

    // Idempotent.
    const again = await generateTaskPostmortem(task.id, { mode: "ZERO" });
    expect(again!.id).toBe(entry!.id);
  });

  it("LOW mode with a synth adds lessons and records usage", async () => {
    const emp = await createEmployee(fx.companyId, "BACKEND");
    const task = await prisma.task.create({
      data: { companyId: fx.companyId, assigneeId: emp.id, title: "Add queue retries", description: "Retry failed jobs", status: "FAILED", errorMessage: "timeout" },
    });
    const synth: SynthFn = async (i) => ({ title: "Retries need backoff", claim: "Use exponential backoff.", confidence: 0.6, tokens: { input: 200, output: 50 }, costUsd: null, model: "fake", provider: i.provider, parsed: true });
    const entry = await generateTaskPostmortem(task.id, { mode: "LOW", synth });
    expect(entry).toMatchObject({ provenance: "TASK_POSTMORTEM", status: "DRAFT" });
    expect(entry!.content.startsWith("Lessons: Use exponential backoff.")).toBe(true);
    expect(await prisma.usageRecord.count({ where: { taskId: task.id, source: "PROVIDER_REPORTED" } })).toBe(1);
  });

  it("returns null for demo, unfinished or unassigned tasks", async () => {
    const emp = await createEmployee(fx.companyId, "QA");
    const mk = (data: Record<string, unknown>) =>
      prisma.task.create({ data: { companyId: fx.companyId, title: "t", description: "d", status: "COMPLETED", assigneeId: emp.id, ...data } });
    expect(await generateTaskPostmortem((await mk({ isDemo: true })).id, { mode: "ZERO" })).toBeNull();
    expect(await generateTaskPostmortem((await mk({ status: "IN_PROGRESS" })).id, { mode: "ZERO" })).toBeNull();
    expect(await generateTaskPostmortem((await mk({ assigneeId: null })).id, { mode: "ZERO" })).toBeNull();
  });
});
