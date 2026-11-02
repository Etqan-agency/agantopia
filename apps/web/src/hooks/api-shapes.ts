/**
 * The UI's names for API response shapes. Everything comes from the server
 * agent's `@/lib/api-types` (the source of truth for docs/api.md); only the
 * memory search hit is declared here because api-types does not export it yet.
 */
import type { KnowledgeKind, KnowledgeStatus } from "@agentopia/shared";
import type {
  ApprovalView,
  CareerEvidenceView,
  Page,
  ProjectView,
  PromptVersionView,
  SkillView,
  TaskEventView,
  VerifyProviderResponse,
} from "@/lib/api-types";

export type {
  Avatar,
  CompanyView,
  CreateCompanyResponse,
  CreatedRunner,
  EmployeeDetail,
  EmployeeListItem,
  KnowledgeEntryView,
  LearningRunView,
  LearningScheduleView,
  LearningSourceView,
  MeResponse,
  ProviderConnectionView,
  ProviderLimitView,
  ProviderStatusView,
  ReconnectProviderResponse,
  RunnerCapabilitiesSummary,
  RunnerToolInfo,
  RunnerView,
  TaskProviderLimit,
  TaskDetail,
  TaskListItem,
  UsageSummary,
  UsageTotals,
  ArtifactView,
} from "@/lib/api-types";

export type Paginated<T> = Page<T>;
export type PromptVersion = PromptVersionView;
export type Skill = SkillView;
export type CareerEvidence = CareerEvidenceView;
export type Project = ProjectView;
export type ApprovalRequest = ApprovalView;
export type TaskTimelineEvent = TaskEventView;
export type VerifyResult = VerifyProviderResponse;
export type Proficiency = "FAMILIAR" | "PROFICIENT" | "EXPERT";

/** GET /api/companies/:cid/memory/search item (ranked verified chunk with provenance). */
export type MemoryHit = {
  id: string;
  title: string;
  /** The server returns a highlighted excerpt (packages/core/src/memory/search.ts), not the full content. */
  excerpt: string;
  content?: string;
  kind: KnowledgeKind;
  status?: KnowledgeStatus;
  sourceUrl?: string | null;
  retrievedAt?: string | null;
  rank?: number;
  score?: number;
  employeeId?: string | null;
  projectId?: string | null;
  provenance?: string;
};
