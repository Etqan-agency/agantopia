/**
 * Agentopia worker: BullMQ consumers for manager (plan/review), execution,
 * learning and maintenance queues. Env is loaded by tsx `--env-file`.
 */
import { DelayedError, Worker, type Job } from "bullmq";
import { pino, type LoggerOptions } from "pino";
import {
  bullConnection,
  closeQueues,
  closeRedis,
  envNumber,
  loggerOptions,
  markStaleRunnersOffline,
  pruneRetention,
  queuePrefix,
  recoverExpiredLeases,
  recoverOrphanedTasks,
  releaseRunnerOfflineTasks,
  releaseWaitingTasks,
  runExecution,
  runManagerPlan,
  runManagerReview,
  settleEmployeeIdle,
  upsertMaintenanceScheduler,
  type ExecutionJob,
  type LearningJob,
  type MaintenanceJob,
  type ManagerJob,
} from "@agentopia/core";
import { prisma } from "@agentopia/db";

const dev = process.env.NODE_ENV !== "production";
const opts: LoggerOptions = dev ? { transport: { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:HH:MM:ss" } } } : {};
const log = pino(loggerOptions({ name: "worker", ...opts }));

type AnyFn = (...args: unknown[]) => Promise<unknown>;
const learningFns = new Map<string, AnyFn | null>();

/** Resolves an optional learning export from the learning slice (null when absent). */
async function learningFn(name: "runLearningRun" | "startScheduledLearningRun"): Promise<AnyFn | null> {
  if (learningFns.has(name)) return learningFns.get(name) ?? null;
  for (const spec of ["@agentopia/core/learning/run", "@agentopia/core/learning/schedule", "@agentopia/core/learning/index"]) {
    try {
      const mod = (await import(/* @vite-ignore */ spec)) as Record<string, unknown>;
      if (typeof mod[name] === "function") {
        learningFns.set(name, mod[name] as AnyFn);
        return mod[name] as AnyFn;
      }
    } catch {
      // module not present yet
    }
  }
  learningFns.set(name, null);
  return null;
}

const connection = bullConnection();
const prefix = queuePrefix();
const workers: Worker[] = [];

workers.push(
  new Worker<ManagerJob>(
    "manager",
    async (job) => {
      const { kind, taskId } = job.data;
      const res = kind === "review" ? await runManagerReview(taskId) : await runManagerPlan(taskId);
      log.info({ jobId: job.id, kind, taskId, res }, "manager job done");
      return res;
    },
    { connection, prefix, concurrency: 2 },
  ),
);

workers.push(
  new Worker<ExecutionJob>(
    "execution",
    async (job: Job<ExecutionJob>, token?: string) => {
      // runExecution skips LOCAL_RUNNER sessions and parks the task (no attempt consumed) when the provider is limited.
      const res = await runExecution(job.data.executionSessionId);
      if (res.outcome === "deferred") {
        // Company concurrency semaphore is full: park the job and retry later.
        await job.moveToDelayed(Date.now() + res.delayMs, token);
        throw new DelayedError();
      }
      log.info({ jobId: job.id, sessionId: job.data.executionSessionId, res }, "execution job done");
      return res;
    },
    { connection, prefix, concurrency: envNumber("EXECUTION_CONCURRENCY", 2), lockDuration: 120_000 },
  ),
);

workers.push(
  new Worker<LearningJob>(
    "learning",
    async (job) => {
      if (job.data.learningRunId) {
        const fn = await learningFn("runLearningRun");
        if (!fn) throw new Error("learning engine not available (packages/core/src/learning/run)");
        return fn(job.data.learningRunId);
      }
      if (job.data.scheduleId) {
        const fn = await learningFn("startScheduledLearningRun");
        if (!fn) throw new Error("learning scheduler not available");
        return fn(job.data.scheduleId);
      }
      log.warn({ jobId: job.id }, "learning job without runId/scheduleId ignored");
      return null;
    },
    { connection, prefix, concurrency: envNumber("LEARNING_CONCURRENCY", 1), lockDuration: 25 * 60_000 },
  ),
);

workers.push(
  new Worker<MaintenanceJob>(
    "maintenance",
    async (job) => {
      if (job.data.kind === "employee-idle") {
        return settleEmployeeIdle(job.data.companyId, job.data.employeeId, job.data.taskId);
      }
      const leases = await recoverExpiredLeases();
      const retention = await pruneRetention();
      const runnersOffline = await markStaleRunnersOffline();
      // Usage Limit Manager: resume tasks whose provider window passed (bounded), and tasks blocked only because no runner was online.
      const limits = await releaseWaitingTasks();
      const runnerBlocked = await releaseRunnerOfflineTasks();
      // IN_PROGRESS tasks left without an active execution (process died between session end and task move).
      const orphans = await recoverOrphanedTasks();
      const summary = { leases, ...retention, runnersOffline, limitReleased: limits.released, limitBlocked: limits.blocked, limitWaiting: limits.stillWaiting, runnerReleased: runnerBlocked.released, orphansRecovered: orphans };
      if (leases || retention.events || retention.artifacts || retention.approvalsExpired || runnersOffline || limits.released || limits.blocked || runnerBlocked.released || orphans) log.info(summary, "maintenance sweep");
      return summary;
    },
    { connection, prefix, concurrency: 1 },
  ),
);

for (const w of workers) {
  w.on("failed", (job, err) => log.error({ queue: w.name, jobId: job?.id, err: err.message }, "job failed"));
  w.on("error", (err) => log.error({ queue: w.name, err: err.message }, "worker error"));
}

await upsertMaintenanceScheduler(60_000);
log.info({ prefix, executionConcurrency: envNumber("EXECUTION_CONCURRENCY", 2), learningConcurrency: envNumber("LEARNING_CONCURRENCY", 1) }, "Agentopia worker started");

let stopping = false;
async function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  log.info({ signal }, "shutting down (waiting for active jobs)");
  const force = setTimeout(() => {
    log.warn("forced exit after 30s");
    process.exit(1);
  }, 30_000);
  force.unref();
  await Promise.allSettled(workers.map((w) => w.close()));
  await closeQueues().catch(() => undefined);
  await closeRedis().catch(() => undefined);
  await prisma.$disconnect().catch(() => undefined);
  log.info("bye");
  process.exit(0);
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
