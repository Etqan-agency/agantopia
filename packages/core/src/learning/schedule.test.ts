import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CronExpressionParser } from "cron-parser";
import { DateTime } from "luxon";
import { prisma } from "@agentopia/db";
import { LearningConfigSchema } from "@agentopia/shared";
import { setLearningDeps } from "./deps";
import { buildCronSpec, computeNextRuns, startLearningRuns, startScheduledLearningRun, syncScheduleToQueue } from "./schedule";
import { ensureDefaultSources } from "./sources";
import { createCompanyFixture, createEmployee, type Fixture } from "./test-fixtures";

const cfg = (over: Partial<ReturnType<typeof LearningConfigSchema.parse>> = {}) => LearningConfigSchema.parse(over);

function cronNext(pattern: string, tz: string, from: Date, n: number): Date[] {
  const it = CronExpressionParser.parse(pattern, { tz, currentDate: from });
  return Array.from({ length: n }, () => it.next().toDate());
}

describe("buildCronSpec", () => {
  it("defaults to Mon+Thu 09:00 Cairo with seconds field", () => {
    expect(buildCronSpec(cfg())).toEqual({ pattern: "0 0 9 * * 1,4", tz: "Africa/Cairo" });
  });
  it("sorts and de-duplicates days, keeps minutes", () => {
    expect(buildCronSpec(cfg({ days: ["sunday", "friday", "monday", "friday"], time: "23:05", timezone: "UTC" })).pattern).toBe("0 5 23 * * 0,1,5");
  });
  it("rejects invalid timezones", () => {
    expect(() => buildCronSpec(cfg({ timezone: "Mars/Olympus" }))).toThrow();
  });
});

describe("computeNextRuns across Cairo DST (2026)", () => {
  it("Cairo really changes offset in the expected windows", () => {
    expect(DateTime.fromISO("2026-04-23T12:00", { zone: "Africa/Cairo" }).offset).toBe(120);
    expect(DateTime.fromISO("2026-04-24T12:00", { zone: "Africa/Cairo" }).offset).toBe(180);
    expect(DateTime.fromISO("2026-10-29T12:00", { zone: "Africa/Cairo" }).offset).toBe(180);
    expect(DateTime.fromISO("2026-10-30T12:00", { zone: "Africa/Cairo" }).offset).toBe(120);
  });
  it("09:00 stays 09:00 local through spring-forward (late April)", () => {
    const c = cfg({ days: ["monday", "thursday", "friday"] });
    const runs = computeNextRuns(c, new Date("2026-04-20T00:00:00Z"), 4);
    expect(runs.map((d) => d.toISOString())).toEqual([
      "2026-04-20T07:00:00.000Z", // Mon 09:00 +02
      "2026-04-23T07:00:00.000Z", // Thu 09:00 +02
      "2026-04-24T06:00:00.000Z", // Fri 09:00 +03 (DST started at 00:00)
      "2026-04-27T06:00:00.000Z", // Mon 09:00 +03
    ]);
    for (const d of runs) expect(DateTime.fromJSDate(d).setZone("Africa/Cairo").toFormat("HH:mm")).toBe("09:00");
    expect(cronNext(buildCronSpec(c).pattern, c.timezone, new Date("2026-04-20T00:00:00Z"), 4)).toEqual(runs);
  });
  it("09:00 stays 09:00 local through fall-back (late October)", () => {
    const c = cfg({ days: ["monday", "thursday", "friday"] });
    const runs = computeNextRuns(c, new Date("2026-10-26T00:00:00Z"), 4);
    expect(runs.map((d) => d.toISOString())).toEqual([
      "2026-10-26T06:00:00.000Z", // Mon +03
      "2026-10-29T06:00:00.000Z", // Thu +03 (DST ends at the end of this day)
      "2026-10-30T07:00:00.000Z", // Fri +02
      "2026-11-02T07:00:00.000Z", // Mon +02
    ]);
    expect(cronNext(buildCronSpec(c).pattern, c.timezone, new Date("2026-10-26T00:00:00Z"), 4)).toEqual(runs);
  });
  it("skips a wall time that does not exist (DST gap), like cron-parser/BullMQ", () => {
    const c = cfg({ days: ["friday"], time: "00:30" });
    const from = new Date("2026-04-22T00:00:00Z");
    const runs = computeNextRuns(c, from, 2);
    expect(runs.map((d) => d.toISOString())).toEqual(["2026-04-30T21:30:00.000Z", "2026-05-07T21:30:00.000Z"]);
    expect(cronNext(buildCronSpec(c).pattern, c.timezone, from, 2)).toEqual(runs);
  });
  it("is strictly after `from` and returns `count` items", () => {
    const from = new Date("2026-11-02T07:00:00Z"); // exactly Mon 09:00 Cairo
    const runs = computeNextRuns(cfg(), from, 3);
    expect(runs).toHaveLength(3);
    expect(runs[0]!.toISOString()).toBe("2026-11-05T07:00:00.000Z");
  });
});

describe("schedule DB integration", () => {
  let fx: Fixture;
  const enqueued: string[] = [];
  const synced: Array<[string, string]> = [];
  let restore: () => void;

  beforeAll(async () => {
    fx = await createCompanyFixture("Schedule Test Co");
    restore = setLearningDeps({
      enqueueLearningRun: async (id) => void enqueued.push(id),
      upsertLearningScheduler: async (id) => void synced.push(["upsert", id]),
      removeLearningScheduler: async (id) => void synced.push(["remove", id]),
      emitEvent: async () => undefined,
    });
  });
  afterAll(async () => {
    restore();
    await fx.cleanup();
  });

  it("covers active employees, skips overlap, overrides, no-source and paused", async () => {
    const fe = await createEmployee(fx.companyId, "FRONTEND");
    const be = await createEmployee(fx.companyId, "BACKEND");
    const qa = await createEmployee(fx.companyId, "QA");
    const mgr = await createEmployee(fx.companyId, "MANAGEMENT");
    await ensureDefaultSources(fx.companyId, fe.id, "FRONTEND");
    await ensureDefaultSources(fx.companyId, null, "BACKEND"); // shared sources
    await ensureDefaultSources(fx.companyId, qa.id, "QA");
    expect(await ensureDefaultSources(fx.companyId, fe.id, "FRONTEND")).toHaveLength(0); // idempotent

    const def = await prisma.learningSchedule.create({ data: { companyId: fx.companyId, employeeId: null } });
    // QA has its own schedule → excluded from the company default.
    const qaSched = await prisma.learningSchedule.create({ data: { companyId: fx.companyId, employeeId: qa.id, tokenStrategy: "ZERO" } });
    // Backend already running → overlap.
    const running = await prisma.learningRun.create({
      data: { companyId: fx.companyId, employeeId: be.id, status: "RUNNING", startedAt: new Date(), tokenStrategy: "LOW" },
    });

    const r = await startLearningRuns(def.id);
    expect(r.runIds).toHaveLength(1);
    const created = await prisma.learningRun.findUniqueOrThrow({ where: { id: r.runIds[0]! } });
    expect(created).toMatchObject({ employeeId: fe.id, status: "QUEUED", trigger: "scheduled", scheduleId: def.id });
    expect(enqueued).toContain(created.id);
    expect(r.skipped).toEqual(
      expect.arrayContaining([
        { employeeId: be.id, reason: `overlapping run ${running.id}` },
        { employeeId: mgr.id, reason: "no enabled sources in specialty" },
      ]),
    );
    expect(r.skipped.some((s) => s.employeeId === qa.id)).toBe(false);

    // Running again: frontend now has a QUEUED run → overlap; nothing new.
    expect(await startScheduledLearningRun(def.id)).toBeNull();

    // Employee-specific schedule covers only that employee.
    const qaRun = await startScheduledLearningRun(qaSched.id);
    expect(qaRun).not.toBeNull();
    expect((await prisma.learningRun.findUniqueOrThrow({ where: { id: qaRun! } })).tokenStrategy).toBe("ZERO");

    // Paused schedule: scheduled trigger skips; manual trigger still allowed.
    await prisma.learningRun.updateMany({ where: { companyId: fx.companyId }, data: { status: "COMPLETED" } });
    await prisma.learningSchedule.update({ where: { id: def.id }, data: { pausedAt: new Date(), pauseReason: "test" } });
    const paused = await startLearningRuns(def.id);
    expect(paused.runIds).toHaveLength(0);
    expect(paused.skipped[0]!.reason).toMatch(/paused/);
    const manual = await startLearningRuns(def.id, { trigger: "manual" });
    expect(manual.runIds.length).toBeGreaterThan(0);
  });

  it("skips when the weekly token budget is exhausted", async () => {
    await prisma.learningRun.updateMany({ where: { companyId: fx.companyId }, data: { status: "COMPLETED" } });
    const s = await prisma.learningSchedule.findFirstOrThrow({ where: { companyId: fx.companyId, employeeId: null } });
    await prisma.learningSchedule.update({ where: { id: s.id }, data: { pausedAt: null, weeklyTokenBudget: 1000 } });
    const any = await prisma.learningRun.findFirstOrThrow({ where: { companyId: fx.companyId } });
    await prisma.learningRun.update({ where: { id: any.id }, data: { tokensUsed: 1000 } });
    const r = await startLearningRuns(s.id);
    expect(r.runIds).toHaveLength(0);
    expect(r.skipped[0]!.reason).toBe("weekly budget exhausted");
  });

  it("fails stale RUNNING runs instead of blocking forever", async () => {
    await prisma.learningRun.updateMany({ where: { companyId: fx.companyId }, data: { status: "COMPLETED", tokensUsed: 0 } });
    const s = await prisma.learningSchedule.findFirstOrThrow({ where: { companyId: fx.companyId, employeeId: null } });
    const fe = await prisma.employee.findFirstOrThrow({ where: { companyId: fx.companyId, specialty: "FRONTEND" } });
    const stale = await prisma.learningRun.create({
      data: { companyId: fx.companyId, employeeId: fe.id, status: "RUNNING", startedAt: new Date(Date.now() - 3 * 3600_000), tokenStrategy: "LOW" },
    });
    const r = await startLearningRuns(s.id);
    expect((await prisma.learningRun.findUniqueOrThrow({ where: { id: stale.id } })).status).toBe("FAILED");
    expect(r.runIds.length).toBeGreaterThan(0);
  });

  it("syncScheduleToQueue upserts enabled and removes paused/disabled", async () => {
    const s = await prisma.learningSchedule.findFirstOrThrow({ where: { companyId: fx.companyId, employeeId: null } });
    await prisma.learningSchedule.update({ where: { id: s.id }, data: { pausedAt: null, enabled: true } });
    expect(await syncScheduleToQueue(s.id)).toEqual({ action: "upserted", spec: { pattern: "0 0 9 * * 1,4", tz: "Africa/Cairo" } });
    await prisma.learningSchedule.update({ where: { id: s.id }, data: { enabled: false } });
    expect((await syncScheduleToQueue(s.id)).action).toBe("removed");
    expect(synced).toEqual([
      ["upsert", s.id],
      ["remove", s.id],
    ]);
  });
});
