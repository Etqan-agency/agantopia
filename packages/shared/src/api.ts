import { z } from "zod";
import { RANKS, SPECIALTIES, TASK_PRIORITIES, WEEKDAYS, TOKEN_STRATEGIES, PROVIDER_KINDS, EXECUTION_MODES, PROVIDER_AUTH_MODES } from "./enums";
import { PromptFieldsSchema } from "./prompt";
import { CompanySettingsSchema, ProviderSettingsSchema } from "./settings";
import { patchSchema, TimeZone } from "./schema-utils";

// --- Common ------------------------------------------------------------------
export const IdParam = z.string().min(1).max(64);
export const PaginationQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export const ApiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

const Name = z.string().trim().min(1).max(80);

// --- Buildings / floors / companies -----------------------------------------
export const CreateCompanyInput = z.object({
  name: Name,
  timezone: TimeZone.default("Africa/Cairo"),
  floorName: Name.optional(),
  buildingId: z.string().optional(),
});
export const UpdateCompanyInput = z.object({
  name: Name.optional(),
  timezone: TimeZone.optional(),
  settings: patchSchema(CompanySettingsSchema).optional(),
});
export const CreateFloorInput = z.object({ buildingId: z.string(), name: Name });
export const UpdateFloorInput = z.object({ name: Name.optional(), order: z.number().int().optional(), archived: z.boolean().optional() });
export const RenameBuildingInput = z.object({ name: Name });

// --- Employees ----------------------------------------------------------------
export const AvatarSchema = z.object({
  palette: z.string().default("teal"),
  hair: z.number().int().min(0).max(5).default(0),
  skin: z.number().int().min(0).max(3).default(1),
  accessory: z.string().optional(),
});
export const HireEmployeeInput = z.object({
  name: Name,
  specialty: z.enum(SPECIALTIES),
  title: Name.optional(),
  department: Name.optional(),
  rank: z.enum(RANKS).default("JUNIOR"),
  avatar: AvatarSchema.optional(),
  prompt: patchSchema(PromptFieldsSchema).optional(),
  skillSlugs: z.array(z.string()).optional(),
  providerConnectionId: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  reportsToId: z.string().nullable().optional(),
  roomId: z.string().optional(),
  initializeFromTemplate: z.boolean().default(true),
});
export const UpdateEmployeeInput = z.object({
  name: Name.optional(),
  title: Name.optional(),
  department: Name.optional(),
  avatar: AvatarSchema.optional(),
  providerConnectionId: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  reportsToId: z.string().nullable().optional(),
  status: z.enum(["ACTIVE", "PAUSED", "ARCHIVED"]).optional(),
  specializationTopics: z.array(z.string().max(60)).max(40).optional(),
  deskId: z.string().nullable().optional(),
});
export const CreatePromptVersionInput = z.object({
  fields: PromptFieldsSchema,
  note: z.string().max(300).optional(),
});
export const SetEmployeeSkillsInput = z.object({
  skills: z.array(z.object({ skillId: z.string(), proficiency: z.enum(["FAMILIAR", "PROFICIENT", "EXPERT"]).default("PROFICIENT"), enabled: z.boolean().default(true) })),
});
export const OverrideRankInput = z.object({ rank: z.enum(RANKS), reason: z.string().min(3).max(500) });

// --- Skills ------------------------------------------------------------------
export const CreateSkillInput = z.object({
  name: Name,
  slug: z.string().regex(/^[a-z0-9-]+$/).max(60),
  description: z.string().max(500),
  instructions: z.string().max(8000),
  applicableRoles: z.array(z.enum(SPECIALTIES)).min(1),
});
export const UpdateSkillInput = CreateSkillInput.partial().extend({ enabled: z.boolean().optional() });

// --- Projects / tasks --------------------------------------------------------
export const CreateProjectInput = z.object({ name: Name, description: z.string().max(2000).default("") });
export const CreateTaskInput = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(3).max(20000),
  priority: z.enum(TASK_PRIORITIES).default("NORMAL"),
  projectId: z.string().optional(),
  requiredSpecialty: z.enum(SPECIALTIES).optional(),
  maxCostUsd: z.number().min(0).max(100).optional(),
  timeoutSec: z.number().int().min(30).max(7200).optional(),
  /** Route through the manager (plan + delegate). When false, assign directly. */
  submitToManager: z.boolean().default(true),
  assigneeId: z.string().optional(),
  dependsOn: z.array(z.string()).max(20).optional(),
});
export const TaskActionInput = z.object({
  action: z.enum(["cancel", "retry", "approve", "reject", "unblock", "resume"]),
  note: z.string().max(1000).optional(),
});
export const DecideApprovalInput = z.object({ decision: z.enum(["APPROVED", "DENIED"]), note: z.string().max(1000).optional() });

// --- Providers ---------------------------------------------------------------
export const CreateProviderConnectionInput = z.object({
  provider: z.enum(PROVIDER_KINDS),
  /** Deprecated for new connections: derived from authMode (SUBSCRIPTION_CLI → LOCAL_RUNNER, API_KEY → API). */
  mode: z.enum(EXECUTION_MODES).optional(),
  /** Default is the user's own subscription through the local runner. */
  authMode: z.enum(PROVIDER_AUTH_MODES).default("SUBSCRIPTION_CLI"),
  /** Required (true) when authMode is API_KEY: the user confirms separate, pay-as-you-go billing. */
  acknowledgeSeparateBilling: z.boolean().default(false),
  label: Name,
  /** Never echoed back. Required for API mode, ignored for LOCAL_RUNNER/SIMULATED. */
  apiKey: z.string().min(10).max(500).optional(),
  defaultModel: z.string().optional(),
  settings: patchSchema(ProviderSettingsSchema).optional(),
});
export const UpdateProviderConnectionInput = z.object({
  label: Name.optional(),
  apiKey: z.string().min(10).max(500).optional(),
  defaultModel: z.string().optional(),
  settings: patchSchema(ProviderSettingsSchema).optional(),
});
export const CreateRunnerInput = z.object({ name: Name });

// --- Learning / memory -------------------------------------------------------
export const UpsertLearningScheduleInput = z.object({
  employeeId: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
  days: z.array(z.enum(WEEKDAYS)).min(1).max(7).optional(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  timezone: TimeZone.optional(),
  maxDurationMinutes: z.number().int().min(5).max(20).optional(),
  tokenStrategy: z.enum(TOKEN_STRATEGIES).optional(),
  sourceDocs: z.boolean().optional(),
  sourceGithub: z.boolean().optional(),
  specializationOnly: z.boolean().optional(),
  approvalRequired: z.boolean().optional(),
  skipUnchanged: z.boolean().optional(),
  pauseOnBudgetExhaustion: z.boolean().optional(),
  perRunTokenBudget: z.number().int().min(0).max(200000).optional(),
  weeklyTokenBudget: z.number().int().min(0).max(1000000).optional(),
  weeklyCostBudgetUsd: z.number().min(0).max(50).optional(),
  paused: z.boolean().optional(),
});
export const CreateLearningSourceInput = z.object({
  employeeId: z.string().nullable().optional(),
  kind: z.enum(["DOCS", "GITHUB"]),
  url: z.string().url().max(500),
  title: Name,
  specialty: z.enum(SPECIALTIES),
  topics: z.array(z.string().max(60)).max(20).default([]),
});
export const CreateKnowledgeInput = z.object({
  employeeId: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  kind: z.enum(["OWNER_INSTRUCTION", "PROJECT_DOC"]),
  title: Name,
  content: z.string().min(1).max(20000),
  sourceUrl: z.string().url().optional(),
  tags: z.array(z.string().max(40)).max(20).default([]),
});
export const DecideKnowledgeInput = z.object({ decision: z.enum(["APPROVED", "REJECTED"]), note: z.string().max(500).optional() });
export const MemorySearchQuery = z.object({
  q: z.string().min(1).max(300),
  employeeId: z.string().optional(),
  projectId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});

export type HireEmployeeInputT = z.infer<typeof HireEmployeeInput>;
export type CreateTaskInputT = z.infer<typeof CreateTaskInput>;
