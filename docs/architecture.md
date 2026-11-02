# Agentopia architecture

## 1. Shape: a modular monolith in a pnpm workspace

```
apps/web      Next.js 16 (App Router): UI, REST API route handlers, SSE event stream, better-auth
apps/worker   Node process: BullMQ workers (manager orchestration, execution, learning, maintenance)
apps/runner   Optional local runner CLI: executes granted jobs on the user's machine
packages/db   Prisma 7 schema, migrations, generated client, seed
packages/core Domain logic shared by web + worker: orchestration state machine, provider adapters,
              learning engine, memory retrieval, crypto, usage accounting, queues
packages/shared  Browser-safe contracts: enums, zod API schemas, event types, role templates
docs/         Research, plans, API contract, runner guide, final report
```

Why not microservices: one deployable web app plus one worker is enough for a
single-company MVP, keeps transactions simple, and still separates the two
things that must scale differently (HTTP vs long-running agent executions).

## 2. Data model (see `packages/db/prisma/schema.prisma`)

* **Tenancy**: `User → Building → Floor → Company`. Every business row carries
  `companyId`; `Company.ownerId` plus `CompanyMembership` decide access. A
  floor is a UI grouping only. One floor hosts at most one company in the MVP,
  but `Floor.companyId` is nullable and non-unique at the building level so the
  constraint can relax later.
* **People**: `Employee` (manager is an employee with `role = MANAGER`),
  `PromptVersion` (append-only, `currentPromptVersion` pointer on the
  employee), `Skill` + `EmployeeSkill` (assigned proficiency ≠ demonstrated
  experience), `EmployeeCareerEvidence` (the only input to rank changes).
* **Work**: `Project`, `Task` (tree via `parentTaskId`, DAG via
  `TaskDependency`), `Assignment` (handoff record), `ExecutionSession`
  (one per attempt; holds lease/heartbeat/cancel flag/usage), `Artifact`,
  `ApprovalRequest`, `UsageRecord`.
* **Events**: `TaskEvent.seq` is a global bigint cursor. Events are written in
  the same transaction as the state change, then published to Redis
  (`events:<companyId>`). SSE clients send `after=<seq>` to replay.
* **Learning/memory**: `LearningSchedule`, `LearningSource` (allowlist),
  `LearningRun`, `SourceDocument` (hash/ETag/SHA tracked), `KnowledgeEntry`
  (4 kinds, provenance, status, `searchVector` generated tsvector column with
  GIN index), `KnowledgeApproval`.
* **Providers**: `ProviderConnection` (AES-256-GCM `encryptedSecret`, never
  returned), `Runner` (hashed bearer token).
* `AuditLog` for every mutation that matters.

## 3. Request path and authorization

* better-auth issues HttpOnly, SameSite=Lax session cookies. `proxy.ts`
  performs the optimistic cookie check; every route handler calls
  `requireSession()` then `authorizeCompany(session.user.id, companyId)` from
  `apps/web/src/server/authz.ts` (the Data Access Layer). There are no
  unscoped queries: repository helpers take `companyId` as the first argument.
* Visitor demo routes (`/api/demo/*`) read only rows where `Company.isDemo =
  true` and never write; interactive demo state lives in the browser.
* Provider secrets are decrypted only inside the worker/runner process at
  execution time. API responses expose `secretLast4` and status only.

## 4. Orchestration (packages/core/src/orchestration)

State machine for `Task.status`:

```
BACKLOG → PLANNING → ASSIGNED → IN_PROGRESS → REVIEW → COMPLETED
                 ↘ BLOCKED (missing skill/approval/dependency)   ↘ FAILED (after maxAttempts)
any non-terminal → CANCELLED (explicit)        IN_PROGRESS ↔ WAITING_APPROVAL
```

* `submitToManager` enqueues `manager.plan(taskId)`. The planner is
  deterministic first (specialty inference from keywords + required
  specialty, availability = no ACTIVE assignment, rank and demonstrated
  evidence as tie-breakers) and optionally asks the manager's provider for a
  bounded JSON decomposition when the task is large and a verified
  connection exists. Subtasks become child `Task`s with `TaskDependency`
  edges; cycles are rejected at creation.
* `execution.run(executionSessionId)` is idempotent: it re-reads the session,
  refuses to start if it is terminal or leased by a live heartbeat, acquires
  a lease (`leaseExpiresAt`, refreshed every 15s), streams provider events
  into `TaskEvent`, enforces cost/turn/time limits, and finishes by writing
  artifacts + usage, then enqueues `manager.review`.
* Review: QA employee if present and available, else the manager; the
  reviewer runs a bounded review prompt (or a deterministic checklist in
  SIMULATED mode) and records `REVIEW_APPROVED`/`REVIEW_REJECTED` evidence.
  Rejection re-queues execution with the review notes if attempts remain.
* Approval gates: `canUseTool` (Claude) or pre-flight checks (Codex) create
  `ApprovalRequest` rows and park the session in `WAITING_APPROVAL`; the
  decision resumes or denies. Requests expire with the task timeout.
* Concurrency: BullMQ worker concurrency × a per-company semaphore in Redis
  (`CompanySettings.maxConcurrentExecutions`). Learning jobs run in a
  separate queue with lower priority and `LEARNING_CONCURRENCY`.
* Recovery: a maintenance job every minute marks sessions with expired leases
  as FAILED (`error = "lease expired"`) and re-queues if attempts remain.

## 5. Provider abstraction (packages/core/src/providers)

```ts
interface ProviderAdapter {
  kind: "ANTHROPIC" | "OPENAI" | "SIMULATED";
  verify(secret?: string): Promise<VerifyResult>;          // cheap, non-billable where possible
  listModels(secret?: string): Promise<string[]>;
  run(req: ExecutionRequest, hooks: ExecutionHooks): Promise<ExecutionResult>; // streams events
}
```

`ExecutionRequest` carries the compiled prompt, task brief, retrieved memory
chunks (bounded), workspace path, limits, and an `AbortSignal`.
`ExecutionHooks` has `onEvent`, `onUsage`, `requestApproval` (returns a
promise resolved by the owner's decision or timeout). Adapters: `anthropic`
(Agent SDK), `openai` (Codex SDK), `simulated` (deterministic, clearly
labelled, used for demo and tests). The same adapter code runs in the worker
(API mode) and in the local runner (LOCAL_RUNNER mode).

## 6. Learning engine (packages/core/src/learning)

Pipeline per run: pick due employees → for each enabled source in the
employee's specialty: robots/ETag/SHA checks → fetch if changed → extract
text deterministically → relevance score against employee topics (keyword
overlap; no LLM) → dedup by content hash → ZERO mode: deterministic
"reference note" (title, URL, headings, retrieval time) / LOW mode: one
bounded synthesis call per changed document under per-run and weekly token
caps → `KnowledgeEntry(status=DRAFT)` → approval queue. Time limit via
`AbortController` at `maxDurationMinutes`; budget exhaustion pauses the
schedule when configured. BullMQ job schedulers carry `tz` so 09:00 is local
wall-clock across DST.

## 7. Memory retrieval (packages/core/src/memory)

`searchMemory({companyId, employeeId?, projectId?, query, limit})` runs a
PostgreSQL full-text query (`websearch_to_tsquery` + `ts_rank_cd`) over
VERIFIED entries visible to the employee (company scope + employee scope +
project scope), returns ranked chunks capped at ~1,500 tokens total, each with
provenance. Prompt assembly cites them as data, never as instructions.
pgvector is intentionally deferred.

## 8. Office scene (apps/web/src/office)

PixiJS v8 app, one floor at a time, procedurally generated texture atlas,
sprite pools, grid A* walking, deterministic animation state machine fed by
the SSE event stream. Backend state is authoritative; the scene is a pure
projection and can be replaced by the list view at any time.

## 9. Security summary

Threats and mitigations are tracked in `docs/security.md` (prompt injection
from docs/repos, credential exposure, cross-company access, runaway loops,
job spoofing, runner privilege).
