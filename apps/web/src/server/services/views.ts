/** Shared Prisma selects and row → view mappers (no secrets ever selected). */
import { Prisma } from "@agentopia/db";
import { AvatarSchema, CompanySettingsSchema, ProviderSettingsSchema, PromptFieldsSchema, type CompanySettings } from "@agentopia/shared";
import type {
  ApprovalRaw,
  Avatar,
  EmployeeListItemRaw,
  KnowledgeEntryRaw,
  LearningRunRaw,
  LearningSourceRaw,
  PromptVersionRaw,
  ProviderConnectionView,
  RunnerView,
  SkillRaw,
  TaskEventView,
  TaskListItemRaw,
  UsageTotalsRaw,
} from "../../lib/api-types";
import { authMethodLabel, parseCapabilities } from "./provider-status";

export const ACTIVE_TASK_STATUSES = ["PLANNING", "ASSIGNED", "IN_PROGRESS", "WAITING_APPROVAL", "REVIEW"] as const;

export function toAvatar(v: unknown): Avatar {
  const r = AvatarSchema.safeParse(v ?? {});
  return r.success ? r.data : { palette: "teal", hair: 0, skin: 1 };
}

export function companySettings(v: unknown): CompanySettings {
  const r = CompanySettingsSchema.safeParse(v ?? {});
  return r.success ? r.data : CompanySettingsSchema.parse({});
}

// --- Employees ---------------------------------------------------------------------
export const employeeListSelect = {
  id: true, name: true, title: true, department: true, specialty: true, role: true, rank: true, status: true, visualState: true,
  avatar: true, reportsToId: true, providerConnectionId: true, model: true, xp: true, isTeamLead: true, createdAt: true,
  providerConnection: { select: { provider: true } },
  desk: { select: { id: true } },
  assignments: {
    where: { status: "ACTIVE", task: { status: { in: [...ACTIVE_TASK_STATUSES] } } },
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { task: { select: { id: true, title: true } } },
  },
} satisfies Prisma.EmployeeSelect;

export type EmployeeListRow = Prisma.EmployeeGetPayload<{ select: typeof employeeListSelect }>;

export function toEmployeeListItem(e: EmployeeListRow): EmployeeListItemRaw {
  const task = e.assignments[0]?.task ?? null;
  return {
    id: e.id, name: e.name, title: e.title, department: e.department, specialty: e.specialty, role: e.role, rank: e.rank,
    status: e.status, visualState: e.visualState, avatar: toAvatar(e.avatar), reportsToId: e.reportsToId,
    providerConnectionId: e.providerConnectionId, provider: e.providerConnection?.provider ?? null, model: e.model, xp: e.xp,
    isTeamLead: e.isTeamLead, deskId: e.desk?.id ?? null, currentTaskId: task?.id ?? null, currentTaskTitle: task?.title ?? null,
    createdAt: e.createdAt,
  };
}

export function toPromptVersion(p: { id: string; version: number; fields: unknown; compiled: string; note: string | null; createdById: string | null; createdAt: Date }): PromptVersionRaw {
  return { ...p, fields: PromptFieldsSchema.parse(p.fields ?? {}) };
}

export function toSkill(s: SkillRaw): SkillRaw {
  return s;
}

// --- Tasks ---------------------------------------------------------------------------
export const taskListSelect = {
  id: true, title: true, description: true, status: true, priority: true, kind: true, assigneeId: true, projectId: true,
  parentTaskId: true, requiredSpecialty: true, isDemo: true, attempt: true, createdAt: true, updatedAt: true, completedAt: true,
  assignee: { select: { id: true, name: true, avatar: true, visualState: true } },
  project: { select: { id: true, name: true } },
} satisfies Prisma.TaskSelect;

export type TaskListRow = Prisma.TaskGetPayload<{ select: typeof taskListSelect }>;

export function toTaskListItem(t: TaskListRow): TaskListItemRaw {
  return { ...t, assignee: t.assignee ? { ...t.assignee, avatar: toAvatar(t.assignee.avatar) } : null };
}

export function toApproval(a: ApprovalRaw): ApprovalRaw {
  return a;
}

// --- Events --------------------------------------------------------------------------
export function toEventView(e: { seq: bigint | number; id: string; companyId: string; taskId: string | null; employeeId: string | null; type: string; payload: unknown; createdAt: Date | string }): TaskEventView {
  const payload = (e.payload && typeof e.payload === "object" && !Array.isArray(e.payload) ? e.payload : {}) as Record<string, unknown>;
  return {
    seq: Number(e.seq),
    id: e.id,
    companyId: e.companyId,
    taskId: e.taskId,
    employeeId: e.employeeId,
    type: e.type,
    payload,
    createdAt: typeof e.createdAt === "string" ? e.createdAt : e.createdAt.toISOString(),
    ...(payload.simulated === true ? { simulated: true } : {}),
  };
}

// --- Providers / runners ------------------------------------------------------------------
/** Explicit column list: `encryptedSecret` is never selected. */
export const providerSelect = {
  id: true, provider: true, mode: true, authMode: true, label: true, secretLast4: true, status: true, lastVerifiedAt: true, verifyError: true,
  defaultModel: true, settings: true, createdAt: true, updatedAt: true, revokedAt: true,
} satisfies Prisma.ProviderConnectionSelect;
export type ProviderRow = Prisma.ProviderConnectionGetPayload<{ select: typeof providerSelect }>;

/** Reserved key inside ProviderConnection.settings holding the last verify's model list. */
export const MODELS_KEY = "_availableModels";
export const HAS_SECRET_KEY = "_hasSecret";

export function toProviderView(p: ProviderRow): ProviderConnectionView {
  const raw = (p.settings && typeof p.settings === "object" ? p.settings : {}) as Record<string, unknown>;
  const { [MODELS_KEY]: models, [HAS_SECRET_KEY]: hasSecret, ...rest } = raw;
  const settings = ProviderSettingsSchema.safeParse(rest);
  return {
    id: p.id, provider: p.provider, mode: p.mode, authMode: p.authMode, authMethodLabel: authMethodLabel(p.provider, p.authMode, p.mode),
    label: p.label, simulated: p.provider === "SIMULATED" || p.mode === "SIMULATED",
    hasSecret: hasSecret === true, secretLast4: p.secretLast4, status: p.status,
    lastVerifiedAt: p.lastVerifiedAt?.toISOString() ?? null, verifyError: p.verifyError, defaultModel: p.defaultModel,
    models: Array.isArray(models) ? models.filter((m): m is string => typeof m === "string") : [],
    settings: settings.success ? settings.data : ProviderSettingsSchema.parse({}),
    createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString(), revokedAt: p.revokedAt?.toISOString() ?? null,
  };
}

export const runnerSelect = { id: true, name: true, status: true, capabilities: true, lastSeenAt: true, createdAt: true, revokedAt: true } satisfies Prisma.RunnerSelect;
export function toRunnerView(r: Prisma.RunnerGetPayload<{ select: typeof runnerSelect }>): RunnerView {
  return { ...r, capabilities: parseCapabilities(r.capabilities), lastSeenAt: r.lastSeenAt?.toISOString() ?? null, createdAt: r.createdAt.toISOString(), revokedAt: r.revokedAt?.toISOString() ?? null };
}

// --- Usage ---------------------------------------------------------------------------------
export function emptyTotals(): UsageTotalsRaw {
  return { records: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0 };
}
export function addTotals(t: UsageTotalsRaw, r: { _count?: { _all?: number } | number; _sum: { inputTokens: number | null; outputTokens: number | null; cacheReadTokens: number | null; cacheWriteTokens: number | null; costUsd: number | null } }) {
  const count = typeof r._count === "number" ? r._count : (r._count?._all ?? 0);
  t.records += count;
  t.inputTokens += r._sum.inputTokens ?? 0;
  t.outputTokens += r._sum.outputTokens ?? 0;
  t.cacheReadTokens += r._sum.cacheReadTokens ?? 0;
  t.cacheWriteTokens += r._sum.cacheWriteTokens ?? 0;
  t.costUsd = Math.round((t.costUsd + (r._sum.costUsd ?? 0)) * 1e6) / 1e6;
  return t;
}

// --- Learning / knowledge --------------------------------------------------------------------
export const knowledgeSelect = {
  id: true, employeeId: true, projectId: true, taskId: true, learningRunId: true, kind: true, provenance: true, status: true, title: true,
  content: true, sourceUrl: true, commitSha: true, retrievedAt: true, confidence: true, tags: true, expiresAt: true, verifiedAt: true,
  verifiedById: true, createdAt: true, updatedAt: true, employee: { select: { id: true, name: true } },
} satisfies Prisma.KnowledgeEntrySelect;
export function toKnowledge(k: Prisma.KnowledgeEntryGetPayload<{ select: typeof knowledgeSelect }>): KnowledgeEntryRaw {
  return k;
}

export const learningRunSelect = {
  id: true, employeeId: true, scheduleId: true, status: true, trigger: true, tokenStrategy: true, startedAt: true, endedAt: true,
  durationMs: true, tokensUsed: true, costUsd: true, sourcesChecked: true, sourcesChanged: true, sourcesSkipped: true, entriesDrafted: true,
  error: true, createdAt: true, employee: { select: { id: true, name: true } },
} satisfies Prisma.LearningRunSelect;
export function toLearningRun(r: Prisma.LearningRunGetPayload<{ select: typeof learningRunSelect }>): LearningRunRaw {
  return r;
}

export const learningSourceSelect = {
  id: true, employeeId: true, kind: true, url: true, title: true, specialty: true, topics: true, enabled: true, lastFetchedAt: true, lastChangedAt: true, createdAt: true,
} satisfies Prisma.LearningSourceSelect;
export function toLearningSource(s: Prisma.LearningSourceGetPayload<{ select: typeof learningSourceSelect }>): LearningSourceRaw {
  return s;
}
