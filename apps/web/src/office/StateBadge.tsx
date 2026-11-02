import type { VisualState } from "@agentopia/shared";
import { VISUAL_LABEL } from "./describe";

const TONE: Record<VisualState, string> = {
  IDLE: "bg-surface-sunken text-fg-muted",
  THINKING: "bg-sky-wash text-sky-ink",
  WORKING: "bg-gold text-navy",
  COLLABORATING: "bg-sky-wash text-sky-ink",
  REVIEWING: "bg-sky-wash text-sky-ink",
  WAITING_APPROVAL: "bg-saffron-wash text-saffron-ink",
  BLOCKED: "bg-brick-wash text-brick-ink",
  COMPLETED: "bg-moss-wash text-moss-ink",
  OFFLINE: "bg-surface-sunken text-fg-muted",
};

export function StateBadge({ state }: { state: VisualState }) {
  return <span className={`inline-flex items-center rounded-sm px-1.5 py-0.5 text-xs font-medium ${TONE[state]}`}>{VISUAL_LABEL[state]}</span>;
}
