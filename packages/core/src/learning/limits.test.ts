import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@agentopia/db";
import { encryptSecret } from "../crypto/secrets";
import { clearProviderLimit, recordProviderLimit } from "../providers/limits";
import { setLearningDeps } from "./deps";
import { resolveEmployeeLlm } from "./llm";
import { runLearningRun } from "./run";
import { startLearningRuns } from "./schedule";
import type { SynthFn } from "./synth";
import { createCompanyFixture, createEmployee, type Fixture } from "./test-fixtures";

describe("learning × Usage Limit Manager", () => {
  let fx: Fixture;
  let employeeId: string;
  let restore: () => void;

  beforeAll(async () => {
    fx = await createCompanyFixture("Learning Limits Co");
    restore = setLearningDeps({ emitEvent: async () => undefined, enqueueLearningRun: async () => undefined, removeLearningScheduler: async () => undefined, upsertLearningScheduler: async () => undefined });
    const emp = await createEmployee(fx.companyId, "FRONTEND", { specializationTopics: ["react"] });
    employeeId = emp.id;
    const conn = await prisma.providerConnection.create({ data: { companyId: fx.companyId, provider: "ANTHROPIC", mode: "LOCAL_RUNNER", authMode: "SUBSCRIPTION_CLI", label: "My plan" } });
    await prisma.employee.update({ where: { id: employeeId }, data: { providerConnectionId: conn.id } });
    await prisma.learningSource.create({ data: { companyId: fx.companyId, employeeId, kind: "DOCS", url: "https://docs.test/react", title: "react", specialty: "FRONTEND", topics: ["react"] } });
  });
  afterAll(async () => {
    restore();
    await fx.cleanup();
  });

  it("a LOW run is postponed (no LLM call, deterministic notes only) while the provider is limited, and completes", async () => {
    await recordProviderLimit(fx.companyId, "ANTHROPIC", { kind: "USAGE_LIMIT", message: "You've hit your limit", resetAt: new Date(Date.now() + 3600_000), source: "provider_reported" });
    const schedule = await prisma.learningSchedule.create({ data: { companyId: fx.companyId, employeeId, tokenStrategy: "LOW", maxDurationMinutes: 5 } });
    const run = await prisma.learningRun.create({ data: { companyId: fx.companyId, employeeId, scheduleId: schedule.id, tokenStrategy: "LOW", trigger: "manual" } });
    let calls = 0;
    const synth: SynthFn = async () => {
      calls += 1;
      throw new Error("synth must not be called while the provider is limited");
    };
    const r = await runLearningRun(run.id, { synth, fetchers: { robots: async () => true, docs: async () => ({ status: "unchanged" }) as never } });
    expect(r.status).toBe("COMPLETED");
    expect(calls).toBe(0);
    const row = await prisma.learningRun.findUniqueOrThrow({ where: { id: run.id } });
    expect((row.log as Array<{ step: string }>).map((s) => s.step)).toContain("postponed: provider limit");
    expect(row.tokensUsed).toBe(0);
    // The schedule is not paused.
    expect((await prisma.learningSchedule.findUniqueOrThrow({ where: { id: schedule.id } })).pausedAt).toBeNull();

    // Scheduled LOW runs skip the employee with reason "provider limit".
    const started = await startLearningRuns(schedule.id, { trigger: "scheduled" });
    expect(started.runIds).toEqual([]);
    expect(started.skipped).toEqual([{ employeeId, reason: "provider limit" }]);
    await clearProviderLimit(fx.companyId, "ANTHROPIC", "test");
    const again = await startLearningRuns(schedule.id, { trigger: "scheduled" });
    expect(again.runIds).toHaveLength(1);
  });

  it("LOW learning uses an API_KEY connection only when settings.allowPaidLearning is true; never a subscription", async () => {
    const emp = await prisma.employee.findUniqueOrThrow({ where: { id: employeeId }, include: { providerConnection: true } });
    expect(await resolveEmployeeLlm(emp, { allowPaidLearning: true })).toBeNull(); // SUBSCRIPTION_CLI is never used for learning

    const api = await prisma.providerConnection.create({ data: { companyId: fx.companyId, provider: "ANTHROPIC", mode: "API", authMode: "API_KEY", label: "API", status: "VERIFIED", encryptedSecret: encryptSecret("sk-ant-learning") } });
    await prisma.employee.update({ where: { id: employeeId }, data: { providerConnectionId: api.id } });
    const withApi = await prisma.employee.findUniqueOrThrow({ where: { id: employeeId }, include: { providerConnection: true } });
    expect(await resolveEmployeeLlm(withApi)).toBeNull(); // default: allowPaidLearning false
    await prisma.company.update({ where: { id: fx.companyId }, data: { settings: { allowPaidLearning: true } } });
    expect(await resolveEmployeeLlm(withApi)).toMatchObject({ provider: "ANTHROPIC", secret: "sk-ant-learning" });
    // …but not while that provider is limited.
    await recordProviderLimit(fx.companyId, "ANTHROPIC", { kind: "RATE_LIMIT", message: "429", retryAfterAt: new Date(Date.now() + 60_000), source: "provider_reported" });
    expect(await resolveEmployeeLlm(withApi)).toBeNull();
  });
});
