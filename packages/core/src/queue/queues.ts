import { Queue, type ConnectionOptions, type JobsOptions } from "bullmq";
import { redisPrefix } from "../env";

export const QUEUE_NAMES = { manager: "manager", execution: "execution", learning: "learning", maintenance: "maintenance" } as const;
export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/** Job payloads per queue/name. */
export type ManagerJob = { kind: "plan" | "review"; taskId: string };
export type ExecutionJob = { executionSessionId: string };
export type LearningJob = { learningRunId?: string; scheduleId?: string };
export type MaintenanceJob = { kind: "sweep" } | { kind: "employee-idle"; companyId: string; employeeId: string; taskId: string | null };

/** BullMQ connection options from REDIS_URL. */
export function bullConnection(): ConnectionOptions {
  return { url: process.env.REDIS_URL ?? "redis://127.0.0.1:6379", maxRetriesPerRequest: null };
}

/** BullMQ key prefix (overridable for tests via AGENTOPIA_REDIS_PREFIX). */
export function queuePrefix(): string {
  return redisPrefix();
}

const queues = new Map<QueueName, Queue>();

const DEFAULT_JOB_OPTS: JobsOptions = { removeOnComplete: { count: 500, age: 7 * 24 * 3600 }, removeOnFail: { count: 1000 } };

/** Returns a (cached) BullMQ queue. */
export function getQueue(name: QueueName): Queue {
  let q = queues.get(name);
  if (!q) {
    q = new Queue(name, { connection: bullConnection(), prefix: queuePrefix(), defaultJobOptions: DEFAULT_JOB_OPTS });
    queues.set(name, q);
  }
  return q;
}

/** Enqueues manager planning for a task (deduplicated while pending by `plan:<taskId>`). */
export async function enqueueManagerPlan(taskId: string, opts: { delayMs?: number } = {}): Promise<void> {
  await getQueue("manager").add("plan", { kind: "plan", taskId } satisfies ManagerJob, { jobId: `plan-${taskId}-${Date.now()}`, deduplication: { id: `plan:${taskId}` }, delay: opts.delayMs });
}

/** Enqueues manager review for a task (deduplicated by `review:<taskId>`). */
export async function enqueueManagerReview(taskId: string): Promise<void> {
  await getQueue("manager").add("review", { kind: "review", taskId } satisfies ManagerJob, { jobId: `review-${taskId}-${Date.now()}`, deduplication: { id: `review:${taskId}` } });
}

/** Enqueues an execution session (job id `exec-<sessionId>`; sessions are one-shot). */
export async function enqueueExecution(executionSessionId: string, opts: { delayMs?: number } = {}): Promise<void> {
  await getQueue("execution").add("run", { executionSessionId } satisfies ExecutionJob, { jobId: `exec-${executionSessionId}`, delay: opts.delayMs });
}

/** Enqueues a learning run (job id `learn-<runId>`). */
export async function enqueueLearningRun(learningRunId: string): Promise<void> {
  await getQueue("learning").add("run", { learningRunId } satisfies LearningJob, { jobId: `learn-${learningRunId}`, priority: 10 });
}

function schedulerId(scheduleId: string): string {
  return `learning:${scheduleId}`;
}

/** Creates/updates a tz-aware cron job scheduler for a learning schedule. */
export async function upsertLearningScheduler(scheduleId: string, spec: { pattern: string; tz: string }, data: { scheduleId: string }): Promise<void> {
  await getQueue("learning").upsertJobScheduler(schedulerId(scheduleId), { pattern: spec.pattern, tz: spec.tz }, { name: "scheduled", data: data satisfies LearningJob, opts: { priority: 10 } });
}

/** Removes a learning schedule's job scheduler. */
export async function removeLearningScheduler(scheduleId: string): Promise<void> {
  await getQueue("learning").removeJobScheduler(schedulerId(scheduleId));
}

/** Next run time of a learning scheduler, or null if none is registered. */
export async function getLearningSchedulerNextRun(scheduleId: string): Promise<Date | null> {
  const s = await getQueue("learning").getJobScheduler(schedulerId(scheduleId));
  return s?.next ? new Date(s.next) : null;
}

/** Schedules an employee's COMPLETED → IDLE visual settle after a short delay. */
export async function enqueueEmployeeIdle(companyId: string, employeeId: string, taskId: string | null, delayMs = 4000): Promise<void> {
  await getQueue("maintenance").add("employee-idle", { kind: "employee-idle", companyId, employeeId, taskId } satisfies MaintenanceJob, {
    jobId: `idle-${employeeId}-${taskId ?? "none"}-${Date.now()}`,
    delay: delayMs,
  });
}

/** Registers the 60s maintenance sweep scheduler. */
export async function upsertMaintenanceScheduler(everyMs = 60_000): Promise<void> {
  await getQueue("maintenance").upsertJobScheduler("maintenance:sweep", { every: everyMs }, { name: "sweep", data: { kind: "sweep" } satisfies MaintenanceJob });
}

/** Closes all queues opened by this process. */
export async function closeQueues(): Promise<void> {
  const qs = [...queues.values()];
  queues.clear();
  await Promise.all(qs.map((q) => q.close()));
}

/** Test helper: removes all jobs in all queues under the current prefix. */
export async function obliterateQueues(): Promise<void> {
  for (const name of Object.values(QUEUE_NAMES)) await getQueue(name).obliterate({ force: true });
}
