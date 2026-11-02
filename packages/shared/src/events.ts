import { z } from "zod";
import { TASK_STATUSES, VISUAL_STATES } from "./enums";

/**
 * Persisted task/office events. Every event is written to TaskEvent BEFORE it
 * is broadcast over Redis pub/sub and SSE. `seq` is the global cursor used for
 * replay after reconnect (GET /api/companies/:id/events?after=<seq>).
 *
 * The office scene derives sprite animation purely from these events; it never
 * invents state and never talks to an LLM.
 */
export const EVENT_TYPES = [
  "task.created",
  "task.planned",
  "task.assigned",
  "task.started",
  "task.progress",
  "task.waiting_approval",
  "task.waiting_provider_limit",
  "task.approval_decided",
  "task.handoff",
  "task.review_started",
  "task.review_decided",
  "task.completed",
  "task.failed",
  "task.blocked",
  "task.cancelled",
  "task.retry_scheduled",
  "execution.started",
  "execution.message",
  "execution.tool_use",
  "execution.usage",
  "execution.ended",
  "employee.state",
  "employee.hired",
  "employee.updated",
  "learning.run_started",
  "learning.run_ended",
  "knowledge.drafted",
  "knowledge.decided",
  "runner.status",
  "runner.capabilities",
  "provider.limit",
  "provider.limit_cleared",
  "demo.note",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const TaskEventSchema = z.object({
  seq: z.number().int().nonnegative(),
  id: z.string(),
  companyId: z.string(),
  taskId: z.string().nullable(),
  employeeId: z.string().nullable(),
  type: z.enum(EVENT_TYPES),
  payload: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.string(),
  /** True for seeded/visitor simulation events; never emitted by real execution. */
  simulated: z.boolean().optional(),
});
export type TaskEvent = z.infer<typeof TaskEventSchema>;

/** Payload conventions (kept loose on purpose; validated where produced). */
export type EmployeeStatePayload = {
  state: (typeof VISUAL_STATES)[number];
  taskId?: string | null;
  reason?: string;
};
export type TaskStatusPayload = {
  status: (typeof TASK_STATUSES)[number];
  from?: (typeof TASK_STATUSES)[number];
  assigneeId?: string | null;
  reviewerId?: string | null;
  attempt?: number;
  message?: string;
};
export type HandoffPayload = {
  fromEmployeeId: string;
  toEmployeeId: string;
  artifactIds: string[];
  summary: string;
};

/** `provider.limit` / `provider.limit_cleared` payload. */
export type ProviderLimitPayload = {
  provider: "ANTHROPIC" | "OPENAI" | "SIMULATED";
  kind: "RATE_LIMITED" | "USAGE_LIMIT" | "AUTH_EXPIRED" | "OK";
  message?: string;
  retryAfterAt?: string | null;
  resetAt?: string | null;
  source?: "provider_reported" | "classified";
  affectedTaskIds?: string[];
};
