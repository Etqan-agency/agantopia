// Shared enums mirrored from the Prisma schema so the browser bundle never
// imports the database client.
export const SPECIALTIES = ["MANAGEMENT", "FRONTEND", "BACKEND", "UIUX", "QA", "RESEARCH"] as const;
export type Specialty = (typeof SPECIALTIES)[number];

export const RANKS = ["TRAINEE", "JUNIOR", "MID_LEVEL", "SENIOR", "EXPERT"] as const;
export type Rank = (typeof RANKS)[number];

export const EMPLOYEE_STATUSES = ["ACTIVE", "PAUSED", "ARCHIVED"] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

export const VISUAL_STATES = [
  "IDLE",
  "THINKING",
  "WORKING",
  "COLLABORATING",
  "REVIEWING",
  "WAITING_APPROVAL",
  "BLOCKED",
  "COMPLETED",
  "OFFLINE",
] as const;
export type VisualState = (typeof VISUAL_STATES)[number];

export const TASK_STATUSES = [
  "BACKLOG",
  "PLANNING",
  "ASSIGNED",
  "IN_PROGRESS",
  "WAITING_APPROVAL",
  "WAITING_FOR_PROVIDER_LIMIT",
  "REVIEW",
  "COMPLETED",
  "BLOCKED",
  "FAILED",
  "CANCELLED",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const ROOM_KINDS = ["MANAGER_OFFICE", "DEVELOPMENT", "DESIGN", "RESEARCH", "QA", "SHARED", "LOUNGE"] as const;
export type RoomKind = (typeof ROOM_KINDS)[number];

export const PROVIDER_KINDS = ["ANTHROPIC", "OPENAI", "SIMULATED"] as const;
export type ProviderKind = (typeof PROVIDER_KINDS)[number];

export const EXECUTION_MODES = ["API", "LOCAL_RUNNER", "SIMULATED"] as const;
export type ExecutionMode = (typeof EXECUTION_MODES)[number];

export const EXECUTION_STATUSES = ["QUEUED", "RUNNING", "WAITING_APPROVAL", "SUCCEEDED", "FAILED", "CANCELLED", "TIMED_OUT"] as const;
export type ExecutionStatus = (typeof EXECUTION_STATUSES)[number];

export const KNOWLEDGE_STATUSES = ["DRAFT", "VERIFIED", "REJECTED", "EXPIRED", "STALE", "DELETED"] as const;
export type KnowledgeStatus = (typeof KNOWLEDGE_STATUSES)[number];

export const KNOWLEDGE_KINDS = ["OWNER_INSTRUCTION", "PROJECT_DOC", "LEARNED_NOTE", "TASK_LESSON"] as const;
export type KnowledgeKind = (typeof KNOWLEDGE_KINDS)[number];

export const TOKEN_STRATEGIES = ["ZERO", "LOW"] as const;
export type TokenStrategy = (typeof TOKEN_STRATEGIES)[number];

export const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** Maps a specialty to the room kind where its desks live. */
export const SPECIALTY_ROOM: Record<Specialty, RoomKind> = {
  MANAGEMENT: "MANAGER_OFFICE",
  FRONTEND: "DEVELOPMENT",
  BACKEND: "DEVELOPMENT",
  UIUX: "DESIGN",
  QA: "QA",
  RESEARCH: "RESEARCH",
};

/** Human labels used throughout the UI. */
export const SPECIALTY_LABEL: Record<Specialty, string> = {
  MANAGEMENT: "Management",
  FRONTEND: "Frontend",
  BACKEND: "Backend",
  UIUX: "UI/UX",
  QA: "QA",
  RESEARCH: "Research",
};

export const RANK_LABEL: Record<Rank, string> = {
  TRAINEE: "Trainee",
  JUNIOR: "Junior",
  MID_LEVEL: "Mid-Level",
  SENIOR: "Senior",
  EXPERT: "Expert",
};

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  BACKLOG: "Backlog",
  PLANNING: "Planning",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In progress",
  WAITING_APPROVAL: "Waiting for approval",
  WAITING_FOR_PROVIDER_LIMIT: "Waiting for provider limit",
  REVIEW: "In review",
  COMPLETED: "Completed",
  BLOCKED: "Blocked",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

export const PROVIDER_AUTH_MODES = ["SUBSCRIPTION_CLI", "API_KEY"] as const;
export type ProviderAuthMode = (typeof PROVIDER_AUTH_MODES)[number];

export const PROVIDER_AUTH_MODE_LABEL: Record<ProviderAuthMode, string> = {
  SUBSCRIPTION_CLI: "My subscription (local runner)",
  API_KEY: "API key (billed separately)",
};

export const PROVIDER_LIMIT_KINDS = ["OK", "RATE_LIMITED", "USAGE_LIMIT", "AUTH_EXPIRED"] as const;
export type ProviderLimitKind = (typeof PROVIDER_LIMIT_KINDS)[number];

/** Error classes produced by provider adapters and the runner. */
export const PROVIDER_ERROR_KINDS = ["USAGE_LIMIT", "RATE_LIMIT", "AUTH_EXPIRED", "RUNNER_OFFLINE", "UNSUPPORTED", "OTHER"] as const;
export type ProviderErrorKind = (typeof PROVIDER_ERROR_KINDS)[number];
