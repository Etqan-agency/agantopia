-- CreateEnum
CREATE TYPE "CompanyRole" AS ENUM ('OWNER', 'MEMBER');

-- CreateEnum
CREATE TYPE "RoomKind" AS ENUM ('MANAGER_OFFICE', 'DEVELOPMENT', 'DESIGN', 'RESEARCH', 'QA', 'SHARED', 'LOUNGE');

-- CreateEnum
CREATE TYPE "Specialty" AS ENUM ('MANAGEMENT', 'FRONTEND', 'BACKEND', 'UIUX', 'QA', 'RESEARCH');

-- CreateEnum
CREATE TYPE "EmployeeRole" AS ENUM ('MANAGER', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "Rank" AS ENUM ('TRAINEE', 'JUNIOR', 'MID_LEVEL', 'SENIOR', 'EXPERT');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "VisualState" AS ENUM ('IDLE', 'THINKING', 'WORKING', 'COLLABORATING', 'REVIEWING', 'WAITING_APPROVAL', 'BLOCKED', 'COMPLETED', 'OFFLINE');

-- CreateEnum
CREATE TYPE "Proficiency" AS ENUM ('FAMILIAR', 'PROFICIENT', 'EXPERT');

-- CreateEnum
CREATE TYPE "EvidenceKind" AS ENUM ('TASK_COMPLETED', 'REVIEW_APPROVED', 'REVIEW_REJECTED', 'TASK_FAILED', 'ASSESSMENT', 'KNOWLEDGE_VERIFIED', 'OWNER_OVERRIDE', 'RANK_CHANGE', 'INITIALIZED_AS');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('BACKLOG', 'PLANNING', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_APPROVAL', 'REVIEW', 'COMPLETED', 'BLOCKED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TaskKind" AS ENUM ('USER_REQUEST', 'SUBTASK', 'REVIEW');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ACTIVE', 'HANDED_OFF', 'RETURNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ExecutionMode" AS ENUM ('API', 'LOCAL_RUNNER', 'SIMULATED');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('QUEUED', 'RUNNING', 'WAITING_APPROVAL', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'TIMED_OUT');

-- CreateEnum
CREATE TYPE "ArtifactKind" AS ENUM ('TEXT', 'FILE', 'DIFF', 'LINK', 'LOG');

-- CreateEnum
CREATE TYPE "ProviderKind" AS ENUM ('ANTHROPIC', 'OPENAI', 'SIMULATED');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('UNVERIFIED', 'VERIFIED', 'INVALID', 'REVOKED');

-- CreateEnum
CREATE TYPE "RunnerStatus" AS ENUM ('ONLINE', 'OFFLINE', 'REVOKED');

-- CreateEnum
CREATE TYPE "UsageSource" AS ENUM ('PROVIDER_REPORTED', 'ESTIMATED');

-- CreateEnum
CREATE TYPE "TokenStrategy" AS ENUM ('ZERO', 'LOW');

-- CreateEnum
CREATE TYPE "SourceKind" AS ENUM ('DOCS', 'GITHUB');

-- CreateEnum
CREATE TYPE "LearningRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'TIMED_OUT', 'BUDGET_EXHAUSTED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "KnowledgeKind" AS ENUM ('OWNER_INSTRUCTION', 'PROJECT_DOC', 'LEARNED_NOTE', 'TASK_LESSON');

-- CreateEnum
CREATE TYPE "KnowledgeProvenance" AS ENUM ('OWNER', 'LEARNING_LLM', 'LEARNING_DETERMINISTIC', 'TASK_POSTMORTEM', 'TASK_POSTMORTEM_DETERMINISTIC');

-- CreateEnum
CREATE TYPE "KnowledgeStatus" AS ENUM ('DRAFT', 'VERIFIED', 'REJECTED', 'EXPIRED', 'STALE', 'DELETED');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ApprovalKind" AS ENUM ('TOOL_USE', 'COST', 'PUBLISH', 'CREDENTIAL', 'DESTRUCTIVE');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'EXPIRED');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Building" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Building_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Floor" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "companyId" TEXT,
    "layout" JSONB NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Floor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Cairo',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyMembership" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "CompanyRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "floorId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "RoomKind" NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "w" INTEGER NOT NULL,
    "h" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Desk" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "facing" TEXT NOT NULL DEFAULT 'down',
    "employeeId" TEXT,

    CONSTRAINT "Desk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar" JSONB NOT NULL,
    "title" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "specialty" "Specialty" NOT NULL,
    "role" "EmployeeRole" NOT NULL DEFAULT 'EMPLOYEE',
    "reportsToId" TEXT,
    "providerConnectionId" TEXT,
    "model" TEXT,
    "rank" "Rank" NOT NULL DEFAULT 'JUNIOR',
    "isTeamLead" BOOLEAN NOT NULL DEFAULT false,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "visualState" "VisualState" NOT NULL DEFAULT 'IDLE',
    "xp" INTEGER NOT NULL DEFAULT 0,
    "specializationTopics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "knowledgePermissions" JSONB NOT NULL DEFAULT '{}',
    "currentPromptVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptVersion" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "fields" JSONB NOT NULL,
    "compiled" TEXT NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "applicableRoles" "Specialty"[],
    "provenance" TEXT NOT NULL DEFAULT 'owner',
    "version" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeSkill" (
    "employeeId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "proficiency" "Proficiency" NOT NULL DEFAULT 'PROFICIENT',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeSkill_pkey" PRIMARY KEY ("employeeId","skillId")
);

-- CreateTable
CREATE TABLE "EmployeeCareerEvidence" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "kind" "EvidenceKind" NOT NULL,
    "summary" TEXT NOT NULL,
    "taskId" TEXT,
    "score" DOUBLE PRECISION,
    "fromRank" "Rank",
    "toRank" "Rank",
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeCareerEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "workspacePath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT,
    "parentTaskId" TEXT,
    "createdByUserId" TEXT,
    "createdByEmployeeId" TEXT,
    "assigneeId" TEXT,
    "kind" "TaskKind" NOT NULL DEFAULT 'USER_REQUEST',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "TaskStatus" NOT NULL DEFAULT 'BACKLOG',
    "requiredSpecialty" "Specialty",
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 2,
    "maxCostUsd" DOUBLE PRECISION,
    "timeoutSec" INTEGER NOT NULL DEFAULT 900,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "resultSummary" TEXT,
    "errorMessage" TEXT,
    "plan" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskDependency" (
    "taskId" TEXT NOT NULL,
    "dependsOnId" TEXT NOT NULL,

    CONSTRAINT "TaskDependency_pkey" PRIMARY KEY ("taskId","dependsOnId")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "assignedById" TEXT,
    "reason" TEXT NOT NULL,
    "handoff" JSONB NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskEvent" (
    "seq" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "taskId" TEXT,
    "employeeId" TEXT,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskEvent_pkey" PRIMARY KEY ("seq")
);

-- CreateTable
CREATE TABLE "ExecutionSession" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "mode" "ExecutionMode" NOT NULL,
    "model" TEXT,
    "status" "ExecutionStatus" NOT NULL DEFAULT 'QUEUED',
    "providerSessionId" TEXT,
    "runnerId" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "heartbeatAt" TIMESTAMP(3),
    "cancelRequested" BOOLEAN NOT NULL DEFAULT false,
    "workspacePath" TEXT,
    "usage" JSONB,
    "costUsd" DOUBLE PRECISION,
    "costSource" TEXT,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExecutionSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Artifact" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "executionSessionId" TEXT,
    "name" TEXT NOT NULL,
    "kind" "ArtifactKind" NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'text/plain',
    "content" TEXT,
    "storagePath" TEXT,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "sha256" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Artifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderConnection" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "provider" "ProviderKind" NOT NULL,
    "mode" "ExecutionMode" NOT NULL,
    "label" TEXT NOT NULL,
    "encryptedSecret" TEXT,
    "secretLast4" TEXT,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "lastVerifiedAt" TIMESTAMP(3),
    "verifyError" TEXT,
    "defaultModel" TEXT,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ProviderConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Runner" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "RunnerStatus" NOT NULL DEFAULT 'OFFLINE',
    "capabilities" JSONB NOT NULL DEFAULT '{}',
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Runner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageRecord" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT,
    "taskId" TEXT,
    "executionSessionId" TEXT,
    "learningRunId" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "source" "UsageSource" NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheReadTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheWriteTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningSchedule" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "days" TEXT[] DEFAULT ARRAY['monday', 'thursday']::TEXT[],
    "time" TEXT NOT NULL DEFAULT '09:00',
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Cairo',
    "maxDurationMinutes" INTEGER NOT NULL DEFAULT 10,
    "tokenStrategy" "TokenStrategy" NOT NULL DEFAULT 'LOW',
    "sourceDocs" BOOLEAN NOT NULL DEFAULT true,
    "sourceGithub" BOOLEAN NOT NULL DEFAULT true,
    "specializationOnly" BOOLEAN NOT NULL DEFAULT true,
    "approvalRequired" BOOLEAN NOT NULL DEFAULT true,
    "skipUnchanged" BOOLEAN NOT NULL DEFAULT true,
    "pauseOnBudgetExhaustion" BOOLEAN NOT NULL DEFAULT true,
    "perRunTokenBudget" INTEGER NOT NULL DEFAULT 20000,
    "weeklyTokenBudget" INTEGER NOT NULL DEFAULT 60000,
    "weeklyCostBudgetUsd" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "pausedAt" TIMESTAMP(3),
    "pauseReason" TEXT,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningSource" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT,
    "kind" "SourceKind" NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "specialty" "Specialty" NOT NULL,
    "topics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "etag" TEXT,
    "lastCommitSha" TEXT,
    "contentHash" TEXT,
    "lastFetchedAt" TIMESTAMP(3),
    "lastChangedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningRun" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "scheduleId" TEXT,
    "status" "LearningRunStatus" NOT NULL DEFAULT 'QUEUED',
    "trigger" TEXT NOT NULL DEFAULT 'scheduled',
    "tokenStrategy" "TokenStrategy" NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sourcesChecked" INTEGER NOT NULL DEFAULT 0,
    "sourcesChanged" INTEGER NOT NULL DEFAULT 0,
    "sourcesSkipped" INTEGER NOT NULL DEFAULT 0,
    "entriesDrafted" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "log" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceDocument" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "commitSha" TEXT,
    "etag" TEXT,
    "text" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "license" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeEntry" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT,
    "projectId" TEXT,
    "taskId" TEXT,
    "learningRunId" TEXT,
    "sourceDocumentId" TEXT,
    "kind" "KnowledgeKind" NOT NULL,
    "provenance" "KnowledgeProvenance" NOT NULL,
    "status" "KnowledgeStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "commitSha" TEXT,
    "retrievedAt" TIMESTAMP(3),
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expiresAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "searchVector" tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce("title", '') || ' ' || coalesce("content", ''))) STORED,

    CONSTRAINT "KnowledgeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeApproval" (
    "id" TEXT NOT NULL,
    "knowledgeEntryId" TEXT NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "decidedById" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "taskId" TEXT,
    "executionSessionId" TEXT,
    "kind" "ApprovalKind" NOT NULL,
    "title" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "note" TEXT,

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE INDEX "Building_ownerId_idx" ON "Building"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Floor_companyId_key" ON "Floor"("companyId");

-- CreateIndex
CREATE INDEX "Floor_buildingId_order_idx" ON "Floor"("buildingId", "order");

-- CreateIndex
CREATE INDEX "Company_ownerId_idx" ON "Company"("ownerId");

-- CreateIndex
CREATE INDEX "CompanyMembership_userId_idx" ON "CompanyMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyMembership_companyId_userId_key" ON "CompanyMembership"("companyId", "userId");

-- CreateIndex
CREATE INDEX "Room_floorId_idx" ON "Room"("floorId");

-- CreateIndex
CREATE INDEX "Room_companyId_idx" ON "Room"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Desk_employeeId_key" ON "Desk"("employeeId");

-- CreateIndex
CREATE INDEX "Desk_roomId_idx" ON "Desk"("roomId");

-- CreateIndex
CREATE INDEX "Employee_companyId_status_idx" ON "Employee"("companyId", "status");

-- CreateIndex
CREATE INDEX "Employee_companyId_specialty_idx" ON "Employee"("companyId", "specialty");

-- CreateIndex
CREATE UNIQUE INDEX "PromptVersion_employeeId_version_key" ON "PromptVersion"("employeeId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_companyId_slug_key" ON "Skill"("companyId", "slug");

-- CreateIndex
CREATE INDEX "EmployeeCareerEvidence_employeeId_createdAt_idx" ON "EmployeeCareerEvidence"("employeeId", "createdAt");

-- CreateIndex
CREATE INDEX "Project_companyId_idx" ON "Project"("companyId");

-- CreateIndex
CREATE INDEX "Task_companyId_status_idx" ON "Task"("companyId", "status");

-- CreateIndex
CREATE INDEX "Task_companyId_createdAt_idx" ON "Task"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "Task_assigneeId_status_idx" ON "Task"("assigneeId", "status");

-- CreateIndex
CREATE INDEX "Task_parentTaskId_idx" ON "Task"("parentTaskId");

-- CreateIndex
CREATE INDEX "TaskDependency_dependsOnId_idx" ON "TaskDependency"("dependsOnId");

-- CreateIndex
CREATE INDEX "Assignment_taskId_idx" ON "Assignment"("taskId");

-- CreateIndex
CREATE INDEX "Assignment_employeeId_idx" ON "Assignment"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskEvent_id_key" ON "TaskEvent"("id");

-- CreateIndex
CREATE INDEX "TaskEvent_companyId_seq_idx" ON "TaskEvent"("companyId", "seq");

-- CreateIndex
CREATE INDEX "TaskEvent_taskId_seq_idx" ON "TaskEvent"("taskId", "seq");

-- CreateIndex
CREATE INDEX "ExecutionSession_taskId_attempt_idx" ON "ExecutionSession"("taskId", "attempt");

-- CreateIndex
CREATE INDEX "ExecutionSession_companyId_status_idx" ON "ExecutionSession"("companyId", "status");

-- CreateIndex
CREATE INDEX "Artifact_taskId_idx" ON "Artifact"("taskId");

-- CreateIndex
CREATE INDEX "ProviderConnection_companyId_idx" ON "ProviderConnection"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Runner_tokenHash_key" ON "Runner"("tokenHash");

-- CreateIndex
CREATE INDEX "Runner_companyId_idx" ON "Runner"("companyId");

-- CreateIndex
CREATE INDEX "UsageRecord_companyId_createdAt_idx" ON "UsageRecord"("companyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LearningSchedule_companyId_employeeId_key" ON "LearningSchedule"("companyId", "employeeId");

-- CreateIndex
CREATE INDEX "LearningSource_companyId_specialty_idx" ON "LearningSource"("companyId", "specialty");

-- CreateIndex
CREATE UNIQUE INDEX "LearningSource_companyId_employeeId_url_key" ON "LearningSource"("companyId", "employeeId", "url");

-- CreateIndex
CREATE INDEX "LearningRun_companyId_createdAt_idx" ON "LearningRun"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "LearningRun_employeeId_createdAt_idx" ON "LearningRun"("employeeId", "createdAt");

-- CreateIndex
CREATE INDEX "SourceDocument_companyId_idx" ON "SourceDocument"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "SourceDocument_sourceId_contentHash_key" ON "SourceDocument"("sourceId", "contentHash");

-- CreateIndex
CREATE INDEX "KnowledgeEntry_companyId_status_idx" ON "KnowledgeEntry"("companyId", "status");

-- CreateIndex
CREATE INDEX "KnowledgeEntry_employeeId_status_idx" ON "KnowledgeEntry"("employeeId", "status");

-- CreateIndex
CREATE INDEX "KnowledgeApproval_knowledgeEntryId_idx" ON "KnowledgeApproval"("knowledgeEntryId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_companyId_status_idx" ON "ApprovalRequest"("companyId", "status");

-- CreateIndex
CREATE INDEX "AuditLog_companyId_createdAt_idx" ON "AuditLog"("companyId", "createdAt");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Building" ADD CONSTRAINT "Building_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Floor" ADD CONSTRAINT "Floor_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Floor" ADD CONSTRAINT "Floor_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMembership" ADD CONSTRAINT "CompanyMembership_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMembership" ADD CONSTRAINT "CompanyMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Desk" ADD CONSTRAINT "Desk_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Desk" ADD CONSTRAINT "Desk_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_reportsToId_fkey" FOREIGN KEY ("reportsToId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_providerConnectionId_fkey" FOREIGN KEY ("providerConnectionId") REFERENCES "ProviderConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptVersion" ADD CONSTRAINT "PromptVersion_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSkill" ADD CONSTRAINT "EmployeeSkill_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSkill" ADD CONSTRAINT "EmployeeSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeCareerEvidence" ADD CONSTRAINT "EmployeeCareerEvidence_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdByEmployeeId_fkey" FOREIGN KEY ("createdByEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDependency" ADD CONSTRAINT "TaskDependency_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDependency" ADD CONSTRAINT "TaskDependency_dependsOnId_fkey" FOREIGN KEY ("dependsOnId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskEvent" ADD CONSTRAINT "TaskEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskEvent" ADD CONSTRAINT "TaskEvent_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskEvent" ADD CONSTRAINT "TaskEvent_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionSession" ADD CONSTRAINT "ExecutionSession_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionSession" ADD CONSTRAINT "ExecutionSession_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionSession" ADD CONSTRAINT "ExecutionSession_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionSession" ADD CONSTRAINT "ExecutionSession_runnerId_fkey" FOREIGN KEY ("runnerId") REFERENCES "Runner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_executionSessionId_fkey" FOREIGN KEY ("executionSessionId") REFERENCES "ExecutionSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderConnection" ADD CONSTRAINT "ProviderConnection_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Runner" ADD CONSTRAINT "Runner_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageRecord" ADD CONSTRAINT "UsageRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageRecord" ADD CONSTRAINT "UsageRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageRecord" ADD CONSTRAINT "UsageRecord_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageRecord" ADD CONSTRAINT "UsageRecord_executionSessionId_fkey" FOREIGN KEY ("executionSessionId") REFERENCES "ExecutionSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageRecord" ADD CONSTRAINT "UsageRecord_learningRunId_fkey" FOREIGN KEY ("learningRunId") REFERENCES "LearningRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningSchedule" ADD CONSTRAINT "LearningSchedule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningSchedule" ADD CONSTRAINT "LearningSchedule_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningSource" ADD CONSTRAINT "LearningSource_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningSource" ADD CONSTRAINT "LearningSource_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningRun" ADD CONSTRAINT "LearningRun_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningRun" ADD CONSTRAINT "LearningRun_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningRun" ADD CONSTRAINT "LearningRun_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "LearningSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceDocument" ADD CONSTRAINT "SourceDocument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceDocument" ADD CONSTRAINT "SourceDocument_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "LearningSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeEntry" ADD CONSTRAINT "KnowledgeEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeEntry" ADD CONSTRAINT "KnowledgeEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeEntry" ADD CONSTRAINT "KnowledgeEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeEntry" ADD CONSTRAINT "KnowledgeEntry_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeEntry" ADD CONSTRAINT "KnowledgeEntry_learningRunId_fkey" FOREIGN KEY ("learningRunId") REFERENCES "LearningRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeEntry" ADD CONSTRAINT "KnowledgeEntry_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeApproval" ADD CONSTRAINT "KnowledgeApproval_knowledgeEntryId_fkey" FOREIGN KEY ("knowledgeEntryId") REFERENCES "KnowledgeEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_executionSessionId_fkey" FOREIGN KEY ("executionSessionId") REFERENCES "ExecutionSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Full-text search index for knowledge retrieval (PostgreSQL FTS first; pgvector deferred)
CREATE INDEX "KnowledgeEntry_searchVector_idx" ON "KnowledgeEntry" USING GIN ("searchVector");
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "KnowledgeEntry_title_trgm_idx" ON "KnowledgeEntry" USING GIN ("title" gin_trgm_ops);
