/** Human sentences and a light-weight list-view projection derived from events. */
import { EVENT_TO_VISUAL, type EmployeeView, type TaskEvent, type VisualState } from "@agentopia/shared";
import { isApproved } from "./state-machine";

export type Lookup = {
  name: (employeeId: string | null | undefined) => string | null;
  title: (taskId: string | null | undefined) => string | null;
};

export const VISUAL_LABEL: Record<VisualState, string> = {
  IDLE: "Idle",
  THINKING: "Thinking",
  WORKING: "Working",
  COLLABORATING: "Handing off",
  REVIEWING: "Reviewing",
  WAITING_APPROVAL: "Waiting for approval",
  BLOCKED: "Blocked",
  COMPLETED: "Completed",
  OFFLINE: "Offline",
};

function s(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v : null;
}

/** Task title carried by an event payload, when the server includes one. */
export function titleFromEvent(e: TaskEvent): string | null {
  // Approval events carry the approval's own title, not the task's.
  if (e.type === "task.waiting_approval" || e.type === "task.approval_decided") return null;
  const p = e.payload ?? {};
  return s(p.title) ?? s(p.taskTitle) ?? s((p.task as Record<string, unknown> | undefined)?.title);
}

function toolName(provider: unknown): string {
  const up = typeof provider === "string" ? provider.toUpperCase() : "";
  return up === "OPENAI" ? "OpenAI Codex" : up === "ANTHROPIC" ? "Claude Code" : "the provider";
}

export function describeEvent(e: TaskEvent, lookup: Lookup): string {
  const p = (e.payload ?? {}) as Record<string, unknown>;
  const who = lookup.name(e.employeeId) ?? "Someone";
  const title = titleFromEvent(e) ?? lookup.title(e.taskId);
  const task = title ? `‘${title}’` : "a task";
  switch (e.type) {
    case "task.created":
      return `New task ${task} was created`;
    case "task.planned":
      return `${who} planned ${task}`;
    case "task.assigned":
      return `${lookup.name(s(p.assigneeId) ?? e.employeeId) ?? who} picked up ${task}`;
    case "task.started":
      return `${who} started working on ${task}`;
    case "task.progress":
      return s(p.message) ? `${who}: ${s(p.message)}` : `${who} made progress on ${task}`;
    case "task.waiting_approval":
      return s(p.title) ? `${who} is waiting for approval: ${s(p.title)}` : `${who} is waiting for approval on ${task}`;
    case "task.waiting_provider_limit": {
      const tool = toolName(p.provider);
      return p.kind === "AUTH_EXPIRED" ? `${who} is waiting for ${tool} to be signed in again` : `${who} is waiting for the ${tool === "the provider" ? "provider" : tool} usage limit to reset`;
    }
    case "task.approval_decided":
      return p.decision === "DENIED" ? `Approval denied on ${task}` : p.decision === "APPROVED" ? `Approval granted on ${task}` : `Approval decided on ${task}`;
    case "task.handoff": {
      const from = lookup.name(s(p.fromEmployeeId) ?? e.employeeId) ?? who;
      const to = lookup.name(s(p.toEmployeeId)) ?? "the manager";
      return `${from} handed ${task} to ${to}`;
    }
    case "task.review_started":
      return `${lookup.name(s(p.reviewerId) ?? e.employeeId) ?? who} started reviewing ${task}`;
    case "task.review_decided": {
      const reviewer = lookup.name(s(p.reviewerId) ?? e.employeeId) ?? who;
      return isApproved(p) ? `${reviewer} approved ${task}` : `${reviewer} sent ${task} back for changes`;
    }
    case "task.completed":
      return `${who} completed ${task}`;
    case "task.failed":
      return `${who} failed on ${task}`;
    case "task.blocked":
      return `${who} is blocked on ${task}`;
    case "task.cancelled":
      return `${task.charAt(0).toUpperCase()}${task.slice(1)} was cancelled`;
    case "task.retry_scheduled":
      return `A retry of ${task} was scheduled`;
    case "execution.started":
      return `${who} began a run on ${task}`;
    case "execution.message":
      return `${who} posted an update on ${task}`;
    case "execution.tool_use":
      return s(p.tool) ? `${who} used ${s(p.tool)} on ${task}` : `${who} used a tool on ${task}`;
    case "execution.usage":
      return `${who} reported usage on ${task}`;
    case "execution.ended":
      return `${who} finished a run on ${task}`;
    case "employee.state": {
      const st = s(p.state) as VisualState | null;
      return st && st in VISUAL_LABEL ? `${who} is now ${VISUAL_LABEL[st].toLowerCase()}` : `${who} changed state`;
    }
    case "employee.hired":
      return `${who} joined the company`;
    case "employee.updated":
      return `${who}'s profile was updated`;
    case "learning.run_started":
      return `${who} started a learning run`;
    case "learning.run_ended":
      return `${who} finished a learning run`;
    case "knowledge.drafted":
      return `${who} drafted a knowledge note`;
    case "knowledge.decided":
      return `A knowledge note was reviewed`;
    case "provider.limit": {
      const tool = toolName(p.provider);
      return p.kind === "AUTH_EXPIRED" ? `${tool} is signed out; tasks wait until you sign in again` : `${tool} ${p.kind === "RATE_LIMITED" ? "rate limit" : "usage limit"} reached; tasks are waiting`;
    }
    case "provider.limit_cleared":
      return `${toolName(p.provider)} is available again`;
    case "runner.capabilities":
      return `Runner reported its installed tools`;
    case "runner.status":
      return `Runner status: ${s(p.status) ?? "updated"}`;
    case "demo.note":
      return s(p.text) ?? s(p.message) ?? "Demo note";
    default:
      return `${who}: ${String(e.type)}`;
  }
}

/** Events worth announcing to screen readers (the rest only appear in the feed). */
export const ANNOUNCE_TYPES = new Set<string>([
  "task.assigned",
  "task.started",
  "task.waiting_approval",
  "task.handoff",
  "task.review_started",
  "task.review_decided",
  "task.completed",
  "task.failed",
  "task.blocked",
  "task.cancelled",
  "demo.note",
]);

export type LiveEmployee = { visualState: VisualState; currentTaskId: string | null };

export function initialLive(employees: EmployeeView[]): Record<string, LiveEmployee> {
  const out: Record<string, LiveEmployee> = {};
  for (const e of employees) out[e.id] = { visualState: e.status === "ACTIVE" ? e.visualState : "OFFLINE", currentTaskId: e.currentTaskId };
  return out;
}

/** List-view projection: same truth as the canvas, without animation. */
export function projectLive(prev: Record<string, LiveEmployee>, e: TaskEvent): Record<string, LiveEmployee> {
  const p = (e.payload ?? {}) as Record<string, unknown>;
  const patch = (id: string | null, visual: VisualState | undefined, taskId?: string | null) => {
    if (!id || !prev[id] || !visual) return;
    next = next === prev ? { ...prev } : next;
    next[id] = { visualState: visual, currentTaskId: taskId === undefined ? next[id]!.currentTaskId : taskId };
  };
  let next = prev;
  switch (e.type) {
    case "employee.state": {
      const st = s(p.state) as VisualState | null;
      patch(e.employeeId, st ?? undefined, p.taskId === null ? null : s(p.taskId) ?? undefined);
      break;
    }
    case "task.handoff":
      patch(s(p.fromEmployeeId) ?? e.employeeId, "COLLABORATING", e.taskId);
      break;
    case "task.review_started":
      patch(s(p.reviewerId) ?? e.employeeId, "REVIEWING", e.taskId);
      break;
    case "task.review_decided": {
      patch(s(p.reviewerId) ?? e.employeeId, "IDLE");
      const worker = s(p.assigneeId) ?? s(p.workerId) ?? s(p.fromEmployeeId);
      patch(worker, isApproved(p) ? "IDLE" : "WORKING", e.taskId);
      break;
    }
    case "task.completed":
      patch(e.employeeId, "IDLE", null);
      break;
    case "task.cancelled":
      patch(e.employeeId, "IDLE", null);
      break;
    case "task.assigned":
      patch(s(p.assigneeId) ?? e.employeeId, "THINKING", e.taskId);
      break;
    default: {
      const v = EVENT_TO_VISUAL[e.type];
      if (v) patch(e.employeeId, v, e.taskId ?? undefined);
    }
  }
  return next;
}
