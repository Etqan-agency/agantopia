/**
 * Response types for the REST API (docs/api.md). Browser-safe: type-only.
 *
 * `*Raw` types are what server services return (Dates); the exported names are
 * their JSON forms (`Jsonify`) as received by the browser: Date → ISO string,
 * bigint → number.
 */
import type {
  CompanySettings,
  EmployeeStatus,
  ExecutionMode,
  ExecutionStatus,
  FloorView,
  KnowledgeKind,
  KnowledgeStatus,
  PromptFields,
  ProviderAuthMode,
  ProviderErrorKind,
  ProviderKind,
  ProviderLimitView,
  ProviderSettings,
  ProviderStatusView,
  RunnerToolInfo,
  Rank,
  Specialty,
  TaskPriority,
  TaskStatus,
  TokenStrategy,
  VisualState,
  Weekday,
} from "@agentopia/shared";

export type Jsonify<T> = T extends Date
  ? string
  : T extends bigint
    ? number
    : T extends (infer U)[]
      ? Jsonify<U>[]
      : T extends object
        ? { [K in keyof T]: Jsonify<T[K]> }
        : T;

export type Page<T> = { items: T[]; nextCursor: string | null };
export type ApiErrorBody = { error: { code: string; message: string; details?: unknown } };
export type Avatar = { palette: string; hair: number; skin: number; accessory?: string };
export type EmployeeRef = { id: string; name: string };

// --- Me / buildings / companies ---------------------------------------------------
export type MeResponse = {
  user: { id: string; name: string; email: string; image: string | null };
  buildings: Array<{
    id: string;
    name: string;
    isDemo: boolean;
    isOwner: boolean;
    floors: Array<{ id: string; name: string; order: number; companyId: string | null; company: { id: string; name: string } | null }>;
  }>;
  defaultCompanyId: string | null;
};

export type BuildingRaw = { id: string; name: string; isDemo: boolean; createdAt: Date; updatedAt: Date };
export type FloorRaw = { id: string; name: string; order: number; buildingId: string; companyId: string | null; archivedAt: Date | null; createdAt: Date; updatedAt: Date };

export type CompanyRaw = {
  id: string;
  name: string;
  timezone: string;
  isDemo: boolean;
  settings: CompanySettings;
  role: "OWNER" | "MEMBER";
  floor: { id: string; name: string; order: number; buildingId: string } | null;
  createdAt: Date;
  updatedAt: Date;
};
export type CompanyView = Jsonify<CompanyRaw>;
export type CreateCompanyResponse = { company: CompanyView; floorId: string; buildingId: string; managerId: string };

export type { FloorView };
export type { ProviderStatusView, ProviderLimitView, RunnerToolInfo, ProviderAuthMode };

// --- Employees ----------------------------------------------------------------------
export type EmployeeListItemRaw = {
  id: string;
  name: string;
  title: string;
  department: string;
  specialty: Specialty;
  role: "MANAGER" | "EMPLOYEE";
  rank: Rank;
  status: EmployeeStatus;
  visualState: VisualState;
  avatar: Avatar;
  reportsToId: string | null;
  providerConnectionId: string | null;
  provider: ProviderKind | null;
  model: string | null;
  xp: number;
  isTeamLead: boolean;
  deskId: string | null;
  currentTaskId: string | null;
  currentTaskTitle: string | null;
  createdAt: Date;
};
export type EmployeeListItem = Jsonify<EmployeeListItemRaw>;

export type PromptVersionRaw = { id: string; version: number; fields: PromptFields; compiled: string; note: string | null; createdById: string | null; createdAt: Date };
export type PromptVersionView = Jsonify<PromptVersionRaw>;

export type SkillRaw = {
  id: string;
  companyId: string | null;
  slug: string;
  name: string;
  description: string;
  instructions: string;
  applicableRoles: Specialty[];
  provenance: string;
  version: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};
export type SkillView = Jsonify<SkillRaw>;

export type CareerEvidenceRaw = {
  id: string;
  kind: string;
  summary: string;
  taskId: string | null;
  score: number | null;
  fromRank: Rank | null;
  toRank: Rank | null;
  createdById: string | null;
  createdAt: Date;
};
export type CareerEvidenceView = Jsonify<CareerEvidenceRaw>;

export type UsageTotalsRaw = { records: number; inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; costUsd: number };

export type EmployeeDetailRaw = EmployeeListItemRaw & {
  specializationTopics: string[];
  currentPromptVersion: number;
  prompt: PromptVersionRaw | null;
  skills: Array<{ skillId: string; proficiency: "FAMILIAR" | "PROFICIENT" | "EXPERT"; enabled: boolean; assignedAt: Date; skill: SkillRaw }>;
  evidence: CareerEvidenceRaw[];
  reportsTo: EmployeeRef | null;
  providerConnection: { id: string; label: string; provider: ProviderKind; mode: ExecutionMode; status: string } | null;
  desk: { id: string; roomId: string; roomName: string; roomKind: string } | null;
  learning: {
    schedule: LearningScheduleRaw | null;
    recentRuns: LearningRunRaw[];
    sourcesCount: number;
    knowledgeCounts: Partial<Record<KnowledgeStatus, number>>;
  };
  usage: { providerReported: UsageTotalsRaw; estimated: UsageTotalsRaw };
  updatedAt: Date;
};
export type EmployeeDetail = Jsonify<EmployeeDetailRaw>;

// --- Tasks ----------------------------------------------------------------------------
export type TaskListItemRaw = {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  kind: "USER_REQUEST" | "SUBTASK" | "REVIEW";
  assigneeId: string | null;
  assignee: { id: string; name: string; avatar: Avatar; visualState: VisualState } | null;
  projectId: string | null;
  project: { id: string; name: string } | null;
  parentTaskId: string | null;
  requiredSpecialty: Specialty | null;
  isDemo: boolean;
  attempt: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
};
export type TaskListItem = Jsonify<TaskListItemRaw>;

export type TaskDetailRaw = TaskListItemRaw & {
  maxAttempts: number;
  maxCostUsd: number | null;
  timeoutSec: number;
  requiresApproval: boolean;
  resultSummary: string | null;
  errorMessage: string | null;
  plan: unknown;
  startedAt: Date | null;
  createdByUserId: string | null;
  createdByEmployeeId: string | null;
  parent: { id: string; title: string; status: TaskStatus } | null;
  children: TaskListItemRaw[];
  dependencies: Array<{ id: string; title: string; status: TaskStatus }>;
  dependents: Array<{ id: string; title: string; status: TaskStatus }>;
  assignments: Array<{ id: string; employeeId: string; employee: EmployeeRef; assignedById: string | null; reason: string; handoff: unknown; status: string; createdAt: Date; endedAt: Date | null }>;
  executions: Array<{
    id: string; attempt: number; employeeId: string; provider: string; mode: ExecutionMode; model: string | null; status: ExecutionStatus;
    runnerId: string | null; usage: unknown; costUsd: number | null; costSource: string | null; error: string | null; errorKind: string | null; cancelRequested: boolean;
    startedAt: Date | null; endedAt: Date | null; createdAt: Date;
  }>;
  artifacts: Array<{ id: string; name: string; kind: string; mimeType: string; sizeBytes: number; executionSessionId: string | null; hasContent: boolean; createdAt: Date }>;
  approvals: ApprovalRaw[];
  /** Re-queues used after provider usage limits (bounded by MAX_LIMIT_RETRIES). */
  limitRetries: number;
  maxLimitRetries: number;
  /** errorKind of the latest execution (ProviderErrorKind), when classified. */
  latestErrorKind: ProviderErrorKind | null;
  providerLimit: TaskProviderLimit | null;
};
export type TaskDetail = Jsonify<TaskDetailRaw>;

export type ApprovalRaw = {
  id: string; taskId: string | null; executionSessionId: string | null; kind: string; title: string; payload: unknown; status: string;
  requestedAt: Date; expiresAt: Date | null; decidedAt: Date | null; decidedById: string | null; note: string | null;
  task?: { id: string; title: string } | null;
};
export type ApprovalView = Jsonify<ApprovalRaw>;

export type ArtifactRaw = { id: string; taskId: string; name: string; kind: string; mimeType: string; content: string | null; sizeBytes: number; sha256: string | null; executionSessionId: string | null; createdAt: Date };
export type ArtifactView = Jsonify<ArtifactRaw>;

/** Event as sent over SSE and the polling endpoint (matches TaskEventSchema). */
export type TaskEventView = {
  seq: number;
  id: string;
  companyId: string;
  taskId: string | null;
  employeeId: string | null;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
  simulated?: boolean;
};
export type EventsPage = { items: TaskEventView[]; nextCursor: number | null };

export type ProjectRaw = { id: string; name: string; description: string; status: "ACTIVE" | "ARCHIVED"; workspacePath: string | null; createdAt: Date; updatedAt: Date };
export type ProjectView = Jsonify<ProjectRaw>;

// --- Providers / runners / usage ---------------------------------------------------------
export type ProviderConnectionView = {
  id: string;
  provider: ProviderKind;
  mode: ExecutionMode;
  /** SUBSCRIPTION_CLI (default: the user's own CLI via the local runner) or API_KEY (billed separately). */
  authMode: ProviderAuthMode;
  /** Human description of how this connection authenticates. */
  authMethodLabel: string;
  label: string;
  /** True for SIMULATED connections: no real model is called. */
  simulated: boolean;
  hasSecret: boolean;
  secretLast4: string | null;
  status: "UNVERIFIED" | "VERIFIED" | "INVALID" | "REVOKED";
  lastVerifiedAt: string | null;
  verifyError: string | null;
  defaultModel: string | null;
  /** Models reported by the last successful verify. */
  models: string[];
  settings: ProviderSettings;
  createdAt: string;
  updatedAt: string;
  revokedAt: string | null;
};
export type VerifyProviderResponse = { status: ProviderConnectionView["status"]; models: string[]; error: string | null; connection: ProviderConnectionView };

/** Display-safe runner capabilities (only known fields of the last heartbeat; old runners omit `tools`). */
export type RunnerCapabilitiesSummary = {
  version?: string;
  hostname?: string;
  /** "subscription" | "env" | "cli" */
  auth?: string;
  providers?: string[];
  tools?: { claude?: RunnerToolInfo; codex?: RunnerToolInfo };
  detectedAt?: string;
};
export type RunnerView = {
  id: string; name: string; status: "ONLINE" | "OFFLINE" | "REVOKED"; capabilities: RunnerCapabilitiesSummary | null;
  lastSeenAt: string | null; createdAt: string; revokedAt: string | null;
};

/** POST /providers/:pid/reconnect. Agentopia never performs a vendor login itself. */
export type ReconnectProviderResponse = {
  status: ProviderStatusView | null;
  /** True when a stale AUTH_EXPIRED limit was cleared. */
  cleared: boolean;
  /** What the person must do on their own machine (subscription connections). */
  instructions: string | null;
  verify?: VerifyProviderResponse;
};

/** The provider limit that applies to a task (from its latest execution or its assignee's connection). */
export type TaskProviderLimit = {
  provider: "ANTHROPIC" | "OPENAI";
  displayName: "Claude Code" | "OpenAI Codex";
  limit: ProviderLimitView;
  /** True while the provider should not be used (Resume is refused). */
  limited: boolean;
};
export type CreatedRunner = { runner: RunnerView; token: string };

export type UsageTotals = UsageTotalsRaw;
export type UsageSummary = {
  from: string | null;
  to: string | null;
  providerReported: UsageTotals;
  estimated: UsageTotals;
  subscriptionQuota: "unavailable";
  /** Subscription plans do not expose usage to Agentopia. */
  subscription: { note: "Usage details unavailable from provider." };
  /** Current limit state per provider, as reported/classified (never a computed percentage). */
  providerLimits: Array<{ provider: "ANTHROPIC" | "OPENAI"; displayName: string; limit: ProviderLimitView; limited: boolean }>;
  byEmployee: Array<{ employeeId: string | null; name: string | null; providerReported: UsageTotals; estimated: UsageTotals }>;
  byProvider: Array<{ provider: string; model: string | null; providerReported: UsageTotals; estimated: UsageTotals }>;
};

// --- Learning / memory --------------------------------------------------------------------
export type LearningScheduleRaw = {
  id: string;
  employeeId: string | null;
  employee: EmployeeRef | null;
  enabled: boolean;
  days: Weekday[];
  time: string;
  timezone: string;
  maxDurationMinutes: number;
  tokenStrategy: TokenStrategy;
  sourceDocs: boolean;
  sourceGithub: boolean;
  specializationOnly: boolean;
  approvalRequired: boolean;
  skipUnchanged: boolean;
  pauseOnBudgetExhaustion: boolean;
  perRunTokenBudget: number;
  weeklyTokenBudget: number;
  weeklyCostBudgetUsd: number;
  paused: boolean;
  pausedAt: Date | null;
  pauseReason: string | null;
  lastRunAt: Date | null;
  nextRuns: Date[];
  createdAt: Date;
  updatedAt: Date;
};
export type LearningScheduleView = Jsonify<LearningScheduleRaw>;

export type LearningSourceRaw = {
  id: string; employeeId: string | null; kind: "DOCS" | "GITHUB"; url: string; title: string; specialty: Specialty; topics: string[]; enabled: boolean;
  lastFetchedAt: Date | null; lastChangedAt: Date | null; createdAt: Date;
};
export type LearningSourceView = Jsonify<LearningSourceRaw>;

export type LearningRunRaw = {
  id: string; employeeId: string; employee?: EmployeeRef | null; scheduleId: string | null; status: string; trigger: string; tokenStrategy: TokenStrategy;
  startedAt: Date | null; endedAt: Date | null; durationMs: number | null; tokensUsed: number; costUsd: number;
  sourcesChecked: number; sourcesChanged: number; sourcesSkipped: number; entriesDrafted: number; error: string | null; createdAt: Date;
};
export type LearningRunView = Jsonify<LearningRunRaw>;
export type LearningRunDetail = LearningRunView & { log: unknown; knowledge: KnowledgeEntryView[] };

export type KnowledgeEntryRaw = {
  id: string;
  employeeId: string | null;
  employee: EmployeeRef | null;
  projectId: string | null;
  taskId: string | null;
  learningRunId: string | null;
  kind: KnowledgeKind;
  provenance: string;
  status: KnowledgeStatus;
  title: string;
  content: string;
  sourceUrl: string | null;
  commitSha: string | null;
  retrievedAt: Date | null;
  confidence: number;
  tags: string[];
  expiresAt: Date | null;
  verifiedAt: Date | null;
  verifiedById: string | null;
  createdAt: Date;
  updatedAt: Date;
};
export type KnowledgeEntryView = Jsonify<KnowledgeEntryRaw>;

// --- Demo -------------------------------------------------------------------------------------
export type DemoBuilding = {
  id: string;
  name: string;
  floors: Array<{ id: string; name: string; order: number; company: { id: string; name: string } | null }>;
};
export type DemoScriptEvent = {
  type: string;
  companyId: string;
  taskId: string | null;
  employeeId: string | null;
  payload: Record<string, unknown>;
  delayMs: number;
  simulated: true;
};
export type DemoScript = { version: number; floorId: string; companyId: string; loop: boolean; events: DemoScriptEvent[]; simulated: true };
