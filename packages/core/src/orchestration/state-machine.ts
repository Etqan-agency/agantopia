import type { TaskStatus } from "@agentopia/shared";
import { DomainError } from "../errors";

/**
 * Allowed Task.status transitions (docs/architecture.md §4).
 *   BACKLOG → PLANNING → ASSIGNED → IN_PROGRESS → REVIEW → COMPLETED
 *   IN_PROGRESS ↔ WAITING_APPROVAL; REVIEW → IN_PROGRESS (rework)
 *   any non-terminal → BLOCKED / CANCELLED; FAILED/BLOCKED/CANCELLED → re-plan or retry (owner action)
 *   ASSIGNED/IN_PROGRESS → WAITING_FOR_PROVIDER_LIMIT (subscription/rate limit hit; no attempt consumed)
 *   WAITING_FOR_PROVIDER_LIMIT → ASSIGNED (resume after the provider window) / BLOCKED (retries exhausted) / CANCELLED
 */
export const TASK_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  BACKLOG: ["PLANNING", "ASSIGNED", "BLOCKED", "CANCELLED"],
  PLANNING: ["BACKLOG", "ASSIGNED", "BLOCKED", "CANCELLED", "FAILED"],
  ASSIGNED: ["PLANNING", "IN_PROGRESS", "WAITING_FOR_PROVIDER_LIMIT", "BLOCKED", "CANCELLED"],
  IN_PROGRESS: ["WAITING_APPROVAL", "WAITING_FOR_PROVIDER_LIMIT", "REVIEW", "BLOCKED", "FAILED", "CANCELLED"],
  WAITING_FOR_PROVIDER_LIMIT: ["ASSIGNED", "BLOCKED", "CANCELLED"],
  WAITING_APPROVAL: ["IN_PROGRESS", "BLOCKED", "FAILED", "CANCELLED"],
  REVIEW: ["COMPLETED", "IN_PROGRESS", "FAILED", "CANCELLED"],
  BLOCKED: ["PLANNING", "ASSIGNED", "IN_PROGRESS", "FAILED", "CANCELLED"],
  FAILED: ["PLANNING", "ASSIGNED", "IN_PROGRESS"],
  CANCELLED: ["PLANNING", "ASSIGNED"],
  COMPLETED: [],
};

export const TERMINAL_TASK_STATUSES: readonly TaskStatus[] = ["COMPLETED", "FAILED", "CANCELLED"];

/** True if `from → to` is an allowed task transition (self-transitions are not). */
export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return TASK_TRANSITIONS[from].includes(to);
}

/** Throws a CONFLICT DomainError when the transition is not allowed. */
export function assertTransition(from: TaskStatus, to: TaskStatus): void {
  if (!canTransition(from, to)) throw new DomainError("CONFLICT", `Task cannot move from ${from} to ${to}`, { from, to });
}

/** True for COMPLETED, FAILED and CANCELLED. */
export function isTerminalTaskStatus(s: TaskStatus): boolean {
  return TERMINAL_TASK_STATUSES.includes(s);
}
