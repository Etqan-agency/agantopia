import type { TaskStatus, VisualState } from "@agentopia/shared";
import { cn } from "@/lib/utils";

/**
 * The lamp. The one memorable element across the UI: a gold dot that glows only
 * while real (or clearly labelled simulated) work is happening. Waiting is a dim
 * gold ring, blocked/failed is danger-ink, done is the violet "lamp-done" (lavender
 * on dark surfaces), idle is a hollow ring and offline a dashed one.
 */
export type LampState = "live" | "waiting" | "idle" | "blocked" | "done" | "offline";

const LAMP_LABEL: Record<LampState, string> = {
  live: "Working",
  waiting: "Waiting",
  idle: "Idle",
  blocked: "Blocked",
  done: "Done",
  offline: "Offline",
};

export function lampFromVisual(state: VisualState | string | null | undefined): LampState {
  switch (state) {
    case "THINKING":
    case "WORKING":
    case "COLLABORATING":
    case "REVIEWING":
      return "live";
    case "WAITING_APPROVAL":
      return "waiting";
    case "BLOCKED":
      return "blocked";
    case "COMPLETED":
      return "done";
    case "OFFLINE":
      return "offline";
    default:
      return "idle";
  }
}

export function lampFromTask(status: TaskStatus | string | null | undefined): LampState {
  switch (status) {
    case "PLANNING":
    case "IN_PROGRESS":
    case "REVIEW":
      return "live";
    case "WAITING_APPROVAL":
    case "WAITING_FOR_PROVIDER_LIMIT":
      return "waiting";
    case "BLOCKED":
    case "FAILED":
      return "blocked";
    case "COMPLETED":
      return "done";
    case "CANCELLED":
      return "offline";
    default:
      return "idle";
  }
}

const VISUAL_LABEL: Record<string, string> = {
  IDLE: "Idle",
  THINKING: "Thinking",
  WORKING: "Working",
  COLLABORATING: "Handing off",
  REVIEWING: "Reviewing",
  WAITING_APPROVAL: "Waiting for approval",
  BLOCKED: "Blocked",
  COMPLETED: "Just finished",
  OFFLINE: "Offline",
};

export function visualLabel(state: string | null | undefined) {
  return (state && VISUAL_LABEL[state]) || "Idle";
}

export function StatusDot({
  state,
  label,
  showLabel = false,
  size = "md",
  className,
}: {
  state: LampState;
  /** Accessible text. Defaults to a generic label for the state. */
  label?: string;
  showLabel?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const text = label ?? LAMP_LABEL[state];
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        aria-hidden
        data-lamp={state}
        className={cn(
          "inline-block shrink-0 rounded-full",
          size === "sm" ? "size-2" : "size-2.5",
          state === "live" && "bg-gold outline-1 -outline-offset-1 outline-fg/25 motion-safe:animate-lamp",
          state === "waiting" && "bg-gold/45 outline-1 -outline-offset-1 outline-fg/20 ring-2 ring-gold/40 ring-offset-1 ring-offset-transparent",
          state === "idle" && "border-[1.5px] border-grey",
          state === "blocked" && "bg-brick-ink ring-2 ring-brick-ink/30",
          state === "done" && "bg-lamp-done",
          state === "offline" && "border-[1.5px] border-dashed border-grey/50",
        )}
      />
      {showLabel ? <span className="text-sm">{text}</span> : <span className="sr-only">{text}</span>}
    </span>
  );
}
