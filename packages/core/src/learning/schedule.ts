/** Learning schedules: cron specs, next-run preview, queue sync and run creation. */
import { DateTime } from "luxon";
import { CronExpressionParser } from "cron-parser";
import { prisma, type Db } from "@agentopia/db";
import { WEEKDAYS, type LearningConfig, type Weekday } from "@agentopia/shared";
import { scheduleToConfig } from "./config";
import { weeklyLearningUsage } from "./budget";
import { deps, log } from "./deps";
import { listSourcesForEmployee } from "./sources";
import { learningProviderLimit } from "./llm";

/** cron day-of-week numbers (0 = Sunday). */
const CRON_DOW: Record<Weekday, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};
/** luxon weekday numbers (1 = Monday ... 7 = Sunday). */
const LUXON_DOW: Record<Weekday, number> = Object.fromEntries(WEEKDAYS.map((d, i) => [d, i + 1])) as Record<Weekday, number>;

/**
 * BullMQ job-scheduler cron (6 fields, with seconds) evaluated in the config
 * timezone, e.g. `{ pattern: "0 0 9 * * 1,4", tz: "Africa/Cairo" }`.
 */
export function buildCronSpec(config: Pick<LearningConfig, "days" | "time" | "timezone">): { pattern: string; tz: string } {
  const [hh, mm] = config.time.split(":").map((n) => Number.parseInt(n, 10));
  if (hh === undefined || mm === undefined || Number.isNaN(hh) || Number.isNaN(mm)) throw new Error(`invalid time ${config.time}`);
  if (!DateTime.local().setZone(config.timezone).isValid) throw new Error(`invalid timezone ${config.timezone}`);
  const days = [...new Set(config.days.map((d) => CRON_DOW[d]))].sort((a, b) => a - b);
  if (days.length === 0) throw new Error("at least one day required");
  const pattern = `0 ${mm} ${hh} * * ${days.join(",")}`;
  CronExpressionParser.parse(pattern, { tz: config.timezone }); // validates
  return { pattern, tz: config.timezone };
}

/**
 * Next `count` run instants strictly after `from`, computed on local
 * wall-clock time in the config timezone (DST-safe: 09:00 stays 09:00 local).
 * A wall time that does not exist on a spring-forward day (e.g. 00:30 on
 * Cairo's DST start) is skipped, matching cron-parser, which BullMQ uses.
 */
export function computeNextRuns(config: Pick<LearningConfig, "days" | "time" | "timezone">, from: Date, count: number): Date[] {
  const [hh, mm] = config.time.split(":").map((n) => Number.parseInt(n, 10)) as [number, number];
  const zone = config.timezone;
  const wanted = new Set(config.days.map((d) => LUXON_DOW[d]));
  const out: Date[] = [];
  let day = DateTime.fromJSDate(from).setZone(zone).startOf("day");
  if (!day.isValid) throw new Error(`invalid timezone ${zone}`);
  for (let i = 0; out.length < count && i < 366 * 8; i++, day = day.plus({ days: 1 })) {
    if (!wanted.has(day.weekday)) continue;
    const at = DateTime.fromObject({ year: day.year, month: day.month, day: day.day, hour: hh, minute: mm }, { zone });
    if (at.hour !== hh || at.minute !== mm) continue; // nonexistent local time (DST gap)
    if (at.toMillis() > from.getTime()) out.push(at.toJSDate());
  }
  return out;
}

/**
 * Bring the BullMQ job scheduler in line with the schedule row: upsert when
 * enabled and not paused, remove otherwise (or when the row is gone).
 */
export async function syncScheduleToQueue(
  scheduleId: string,
  db: Db = prisma,
): Promise<{ action: "upserted" | "removed"; spec?: { pattern: string; tz: string } }> {
  const s = await db.learningSchedule.findUnique({ where: { id: scheduleId } });
  if (!s || !s.enabled || s.pausedAt) {
    await deps().removeLearningScheduler(scheduleId);
    return { action: "removed" };
  }
  const spec = buildCronSpec(scheduleToConfig(s));
  await deps().upsertLearningScheduler(scheduleId, spec, { scheduleId });
  return { action: "upserted", spec };
}

export type StartRunsResult = {
  runIds: string[];
  skipped: Array<{ employeeId: string | null; reason: string }>;
};

/**
 * Create QUEUED LearningRun rows for every employee a schedule covers and
 * enqueue them. Covers: the schedule's employee, or (company default) every
 * ACTIVE employee without an employee-specific schedule. Skips when the
 * schedule is paused/disabled (scheduled trigger only), an employee already
 * has a QUEUED/RUNNING run, the employee has no sources in its specialty, the
 * weekly budget is exhausted (LOW strategy), or (scheduled LOW runs) the
 * employee's provider is under a usage/rate limit ("provider limit").
 */
export async function startLearningRuns(
  scheduleId: string,
  opts: { trigger?: "scheduled" | "manual"; now?: Date; db?: Db; employeeId?: string } = {},
): Promise<StartRunsResult> {
  const db = opts.db ?? prisma;
  const trigger = opts.trigger ?? "scheduled";
  const now = opts.now ?? new Date();
  const result: StartRunsResult = { runIds: [], skipped: [] };
  const s = await db.learningSchedule.findUnique({ where: { id: scheduleId } });
  if (!s) {
    result.skipped.push({ employeeId: null, reason: "schedule not found" });
    return result;
  }
  if (trigger === "scheduled" && (!s.enabled || s.pausedAt)) {
    result.skipped.push({ employeeId: s.employeeId, reason: s.pausedAt ? `paused: ${s.pauseReason ?? "paused"}` : "disabled" });
    return result;
  }
  const config = scheduleToConfig(s);

  if (config.tokenStrategy === "LOW") {
    const weekly = await weeklyLearningUsage(s.companyId, now, config.timezone, db);
    if (weekly.tokens >= config.weeklyTokenBudget || weekly.costUsd >= config.weeklyCostBudgetUsd) {
      result.skipped.push({ employeeId: s.employeeId, reason: "weekly budget exhausted" });
      return result;
    }
  }

  let employees: Array<{ id: string }>;
  if (s.employeeId) {
    employees = await db.employee.findMany({ where: { id: s.employeeId, companyId: s.companyId, status: "ACTIVE" }, select: { id: true } });
    if (employees.length === 0) result.skipped.push({ employeeId: s.employeeId, reason: "employee not active" });
  } else {
    const overridden = await db.learningSchedule.findMany({
      where: { companyId: s.companyId, employeeId: { not: null } },
      select: { employeeId: true },
    });
    const skip = new Set(overridden.map((o) => o.employeeId));
    employees = (
      await db.employee.findMany({ where: { companyId: s.companyId, status: "ACTIVE" }, select: { id: true }, orderBy: { createdAt: "asc" } })
    ).filter((e) => !skip.has(e.id));
  }
  if (opts.employeeId) employees = employees.filter((e) => e.id === opts.employeeId);

  for (const e of employees) {
    await failStaleRuns(e.id, config.maxDurationMinutes, now, db);
    const active = await db.learningRun.findFirst({ where: { employeeId: e.id, status: { in: ["QUEUED", "RUNNING"] } }, select: { id: true } });
    if (active) {
      result.skipped.push({ employeeId: e.id, reason: `overlapping run ${active.id}` });
      continue;
    }
    if (trigger === "scheduled" && config.tokenStrategy === "LOW" && (await employeeProviderLimited(e.id, db))) {
      // Postponed, not paused: the next scheduled slot tries again. No paid fallback.
      result.skipped.push({ employeeId: e.id, reason: "provider limit" });
      continue;
    }
    const sources = await listSourcesForEmployee(s.companyId, e.id, db);
    if (sources.length === 0) {
      result.skipped.push({ employeeId: e.id, reason: "no enabled sources in specialty" });
      continue;
    }
    const run = await db.learningRun.create({
      data: { companyId: s.companyId, employeeId: e.id, scheduleId: s.id, status: "QUEUED", trigger, tokenStrategy: config.tokenStrategy },
    });
    result.runIds.push(run.id);
  }
  if (result.runIds.length > 0) await db.learningSchedule.update({ where: { id: s.id }, data: { lastRunAt: now } });
  for (const id of result.runIds) {
    try {
      await deps().enqueueLearningRun(id);
    } catch (err) {
      log.error({ err: String(err), runId: id }, "failed to enqueue learning run");
    }
  }
  return result;
}

/** True when the employee's provider is currently limited (Usage Limit Manager). */
async function employeeProviderLimited(employeeId: string, db: Db): Promise<boolean> {
  const emp = await db.employee.findUnique({ where: { id: employeeId }, include: { providerConnection: true } });
  if (!emp) return false;
  return (await learningProviderLimit(emp)) !== null;
}

/**
 * Runs that can no longer be live (worker crash, lost queue job) must not block
 * future runs forever: RUNNING longer than 2x the time cap + 5 min, or QUEUED
 * for more than 6 hours, are marked FAILED.
 */
async function failStaleRuns(employeeId: string, maxDurationMinutes: number, now: Date, db: Db): Promise<void> {
  const runningCutoff = new Date(now.getTime() - (maxDurationMinutes * 2 + 5) * 60_000);
  const queuedCutoff = new Date(now.getTime() - 6 * 3600_000);
  await db.learningRun.updateMany({
    where: {
      employeeId,
      OR: [
        { status: "RUNNING", startedAt: { lt: runningCutoff } },
        { status: "QUEUED", createdAt: { lt: queuedCutoff } },
      ],
    },
    data: { status: "FAILED", endedAt: now, error: "stale run (worker lost)" },
  });
}

/**
 * Scheduler entry point (called by the BullMQ job for `scheduleId`).
 * Returns the first created run id, or null when nothing was started.
 * Use `startLearningRuns` for the full list and skip reasons.
 */
export async function startScheduledLearningRun(
  scheduleId: string,
  opts: { trigger?: "scheduled" | "manual"; now?: Date; db?: Db; employeeId?: string } = {},
): Promise<string | null> {
  const r = await startLearningRuns(scheduleId, opts);
  for (const sk of r.skipped) log.info({ scheduleId, ...sk }, "learning run skipped");
  return r.runIds[0] ?? null;
}
