import { EMPLOYEE_STATUSES, RANKS, RANK_LABEL, SPECIALTIES, SPECIALTY_LABEL } from "@agentopia/shared";

export const SPECIALTY_OPTIONS = SPECIALTIES.map((s) => ({ value: s, label: SPECIALTY_LABEL[s] }));
export const RANK_OPTIONS = RANKS.map((r) => ({ value: r, label: RANK_LABEL[r] }));

export const STATUS_LABEL: Record<(typeof EMPLOYEE_STATUSES)[number], string> = {
  ACTIVE: "Active",
  PAUSED: "Paused",
  ARCHIVED: "Archived",
};
export const STATUS_OPTIONS = EMPLOYEE_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }));

export const PROFICIENCY_LABEL = { FAMILIAR: "Familiar", PROFICIENT: "Proficient", EXPERT: "Expert" } as const;

export const PROVIDER_LABEL: Record<string, string> = { ANTHROPIC: "Anthropic", OPENAI: "OpenAI", SIMULATED: "Simulated" };

/** Sentinel for "no provider connection": Radix Select cannot use an empty string value. */
export const SIMULATED_VALUE = "__simulated";
