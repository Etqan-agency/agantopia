import { rm } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@agentopia/db";
import { CompanySettingsSchema } from "@agentopia/shared";
import { emitEvent } from "../events/emit";
import { logger } from "../logging";
import { artifactRoot } from "../workspace/paths";
import { handleExecutionFailure } from "./execute";
import { releaseExecutionSlot } from "./semaphore";

/**
 * Marks sessions whose lease expired (worker/runner died) as FAILED with
 * `lease expired`, expires their pending approvals, and retries or fails the
 * task. Returns the number of sessions recovered.
 */
export async function recoverExpiredLeases(now: Date = new Date()): Promise<number> {
  const stale = await prisma.executionSession.findMany({ where: { status: { in: ["RUNNING", "WAITING_APPROVAL"] }, leaseExpiresAt: { lt: now } }, take: 100 });
  let n = 0;
  for (const s of stale) {
    const r = await prisma.executionSession.updateMany({ where: { id: s.id, status: { in: ["RUNNING", "WAITING_APPROVAL"] }, leaseExpiresAt: { lt: now } }, data: { status: "FAILED", error: "lease expired", endedAt: now, leaseExpiresAt: null } });
    if (r.count !== 1) continue;
    n += 1;
    await prisma.approvalRequest.updateMany({ where: { executionSessionId: s.id, status: "PENDING" }, data: { status: "EXPIRED", decidedAt: now, note: "execution lease expired" } });
    await releaseExecutionSlot(s.companyId, s.id).catch(() => undefined);
    await emitEvent(prisma, { companyId: s.companyId, taskId: s.taskId, employeeId: s.employeeId, type: "execution.ended", payload: { executionSessionId: s.id, status: "FAILED", error: "lease expired" } });
    if (s.cancelRequested) continue;
    await handleExecutionFailure(s.taskId, "Execution lease expired (worker or runner stopped responding)").catch((err: Error) => logger.warn({ err: err.message, sessionId: s.id }, "lease recovery follow-up failed"));
  }
  return n;
}

/**
 * Recovers IN_PROGRESS tasks left without an active execution (e.g. the
 * process died between ending a session and moving the task). Only leaf
 * tasks that ran at least once qualify (parent tasks are IN_PROGRESS while
 * their subtasks run), and only after `graceMs` without any update. Emits a
 * `task.progress` event, then retries or fails the task like any failed
 * attempt (bounded by maxAttempts). Returns the number of tasks recovered.
 */
export async function recoverOrphanedTasks(now: Date = new Date(), opts: { graceMs?: number; companyId?: string } = {}): Promise<number> {
  const graceMs = opts.graceMs ?? 5 * 60_000;
  const cutoff = new Date(now.getTime() - graceMs);
  const orphans = await prisma.task.findMany({
    where: {
      status: "IN_PROGRESS",
      updatedAt: { lt: cutoff },
      ...(opts.companyId ? { companyId: opts.companyId } : {}),
      children: { none: {} },
      executions: { some: {}, none: { OR: [{ status: { in: ["QUEUED", "RUNNING", "WAITING_APPROVAL"] } }, { endedAt: { gte: cutoff } }] } },
    },
    select: { id: true, companyId: true, assigneeId: true },
    take: 100,
  });
  let n = 0;
  for (const t of orphans) {
    await emitEvent(prisma, { companyId: t.companyId, taskId: t.id, employeeId: t.assigneeId, type: "task.progress", payload: { message: "Recovered: the task was in progress without an active execution", recovered: true } });
    await handleExecutionFailure(t.id, "Execution ended without updating the task (recovered by maintenance)")
      .then(() => (n += 1))
      .catch((err: Error) => logger.warn({ err: err.message, taskId: t.id }, "orphaned task recovery failed"));
  }
  return n;
}

/**
 * Retention: per company, deletes TaskEvents and terminal tasks' artifacts
 * older than `retentionDays`, and expires overdue PENDING approvals.
 */
export async function pruneRetention(now: Date = new Date()): Promise<{ events: number; artifacts: number; approvalsExpired: number }> {
  let events = 0;
  let artifacts = 0;
  const companies = await prisma.company.findMany({ select: { id: true, settings: true } });
  for (const c of companies) {
    const days = CompanySettingsSchema.parse(c.settings ?? {}).retentionDays;
    const cutoff = new Date(now.getTime() - days * 86_400_000);
    events += (await prisma.taskEvent.deleteMany({ where: { companyId: c.id, createdAt: { lt: cutoff } } })).count;
    const old = await prisma.artifact.findMany({ where: { companyId: c.id, createdAt: { lt: cutoff }, task: { status: { in: ["COMPLETED", "FAILED", "CANCELLED"] } } }, select: { id: true, storagePath: true }, take: 1000 });
    for (const a of old) {
      if (a.storagePath) {
        const abs = path.resolve(a.storagePath);
        // Only delete files inside the artifact root; rows are dropped either way.
        if (abs.startsWith(artifactRoot() + path.sep)) await rm(abs, { force: true }).catch(() => undefined);
      }
    }
    if (old.length) artifacts += (await prisma.artifact.deleteMany({ where: { id: { in: old.map((a) => a.id) } } })).count;
  }
  const approvalsExpired = (await prisma.approvalRequest.updateMany({ where: { status: "PENDING", expiresAt: { lt: now } }, data: { status: "EXPIRED", decidedAt: now } })).count;
  return { events, artifacts, approvalsExpired };
}

/**
 * Marks ONLINE runners not seen for `staleMs` (default 90s) as OFFLINE and
 * emits runner.status. Their RUNNING / WAITING_APPROVAL sessions are FAILED
 * with errorKind RUNNER_OFFLINE and the task is re-queued (bounded by
 * maxAttempts); without another runner the re-queue blocks it as RUNNER_OFFLINE.
 */
export async function markStaleRunnersOffline(now: Date = new Date(), staleMs = 90_000): Promise<number> {
  const stale = await prisma.runner.findMany({ where: { status: "ONLINE", OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: new Date(now.getTime() - staleMs) } }] } });
  for (const r of stale) {
    const u = await prisma.runner.updateMany({ where: { id: r.id, status: "ONLINE" }, data: { status: "OFFLINE" } });
    if (!u.count) continue;
    await emitEvent(prisma, { companyId: r.companyId, type: "runner.status", payload: { runnerId: r.id, status: "OFFLINE", lastSeenAt: r.lastSeenAt?.toISOString() ?? null } });
    await failRunnerSessions(r.id, now);
  }
  return stale.length;
}

/** Fails a runner's live sessions with errorKind RUNNER_OFFLINE and retries/fails their tasks. */
export async function failRunnerSessions(runnerId: string, now: Date = new Date()): Promise<number> {
  const live = await prisma.executionSession.findMany({ where: { runnerId, status: { in: ["RUNNING", "WAITING_APPROVAL"] } } });
  let n = 0;
  for (const s of live) {
    const r = await prisma.executionSession.updateMany({
      where: { id: s.id, status: { in: ["RUNNING", "WAITING_APPROVAL"] } },
      data: { status: "FAILED", error: "Local runner went offline", errorKind: "RUNNER_OFFLINE", endedAt: now, leaseExpiresAt: null },
    });
    if (r.count !== 1) continue;
    n += 1;
    await prisma.approvalRequest.updateMany({ where: { executionSessionId: s.id, status: "PENDING" }, data: { status: "EXPIRED", decidedAt: now, note: "runner offline" } });
    await emitEvent(prisma, { companyId: s.companyId, taskId: s.taskId, employeeId: s.employeeId, type: "execution.ended", payload: { executionSessionId: s.id, status: "FAILED", error: "Local runner went offline", errorKind: "RUNNER_OFFLINE" } });
    if (s.cancelRequested) continue;
    await handleExecutionFailure(s.taskId, "Local runner went offline").catch((err: Error) => logger.warn({ err: err.message, sessionId: s.id }, "runner-offline follow-up failed"));
  }
  return n;
}

/** Settles an employee from COMPLETED back to IDLE (delayed maintenance job). */
export async function settleEmployeeIdle(companyId: string, employeeId: string, taskId: string | null): Promise<boolean> {
  const e = await prisma.employee.findFirst({ where: { id: employeeId, companyId }, select: { visualState: true } });
  if (!e || e.visualState !== "COMPLETED") return false;
  await emitEvent(prisma, { companyId, taskId, employeeId, type: "employee.state", payload: { state: "IDLE", taskId, reason: "settled after completion" } });
  return true;
}
