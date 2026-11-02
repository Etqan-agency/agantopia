import { SPECIALTY_LABEL, type Specialty } from "@agentopia/shared";
import { Badge } from "@/components/ui/badge";

/** One fill per specialty (five brand hues + a purple wash), reused by badges and org-chart nodes. */
export const SPECIALTY_TONE: Record<Specialty, "purple" | "gold" | "black" | "sky" | "neutral" | "outline"> = {
  MANAGEMENT: "purple",
  FRONTEND: "gold",
  BACKEND: "black",
  UIUX: "sky",
  QA: "neutral",
  RESEARCH: "outline",
};

/** Org-chart node fills. Every text colour is >= 4.5:1 on its fill. UI/UX and Research use semantic
 * tokens so they follow the theme (same values as before in light; navy-raised and violet-wash in dark). */
export const SPECIALTY_FILL: Record<Specialty, { bg: string; fg: string; muted: string; border: string }> = {
  MANAGEMENT: { bg: "#5b3fd9", fg: "#ffffff", muted: "#e4ddff", border: "#5b3fd9" },
  FRONTEND: { bg: "#ffc66d", fg: "#111326", muted: "#111326", border: "#e8a93d" },
  BACKEND: { bg: "#111326", fg: "#f5f7ff", muted: "#a8b4ca", border: "#3a4561" },
  UIUX: { bg: "var(--sky-wash)", fg: "var(--text)", muted: "var(--sky-ink)", border: "#7357f6" },
  QA: { bg: "#a8b4ca", fg: "#111326", muted: "#111326", border: "#a8b4ca" },
  RESEARCH: { bg: "var(--surface-raised)", fg: "var(--text)", muted: "var(--text-muted)", border: "var(--rule-strong)" },
};

/** Single accent colour per specialty (legacy consumers). */
export const SPECIALTY_HEX: Record<Specialty, string> = {
  MANAGEMENT: "#7357f6",
  FRONTEND: "#ffc66d",
  BACKEND: "#111326",
  UIUX: "#7357f6",
  QA: "#a8b4ca",
  RESEARCH: "#a8b4ca",
};

export function SpecialtyBadge({ specialty }: { specialty: Specialty | string }) {
  const s = specialty as Specialty;
  return <Badge tone={SPECIALTY_TONE[s] ?? "neutral"}>{SPECIALTY_LABEL[s] ?? specialty}</Badge>;
}
