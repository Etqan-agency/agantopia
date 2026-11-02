/**
 * The office reads the company's live events from the shared SSE stream owned by
 * CompanyEventsProvider (hooks/use-events.tsx), so /office never opens a second
 * EventSource. This module only adapts those events to the office's types.
 */
import type { TaskEvent } from "@agentopia/shared";
import type { TaskEventView } from "@/lib/api-types";
import type { StreamStatus as ProviderStreamStatus } from "@/hooks/use-events";

export type StreamStatus = "connecting" | "open" | "reconnecting" | "closed";

/** Normalise a stream event for the office (numeric seq, payload always an object). */
export function toOfficeEvent(e: TaskEventView): TaskEvent | null {
  if (!e || typeof e !== "object" || typeof e.type !== "string") return null;
  const seq = Number(e.seq);
  if (!Number.isFinite(seq)) return null;
  return { ...e, seq, payload: e.payload ?? {} } as TaskEvent;
}

/** The provider's stream status in the office's vocabulary (null before a company is known). */
export function officeStreamStatus(s: ProviderStreamStatus | undefined): StreamStatus | null {
  return !s || s === "idle" ? null : s;
}
