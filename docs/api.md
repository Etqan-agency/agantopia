# API contract (REST + SSE)

All routes live under `apps/web/src/app/api`. JSON in/out. Errors use
`{ "error": { "code", "message", "details?" } }` with HTTP 400 (validation),
401 (no session), 403 (not a member), 404, 409 (conflict/state), 429 (rate
limit), 500. Lists are cursor-paginated: `?cursor=&limit=` →
`{ items, nextCursor }`. Input schemas are the zod objects in
`packages/shared/src/api.ts`; route handlers must parse with them.

Authentication: better-auth cookie session. `X-Company-Id` is NOT used;
company scope is always in the path.

## Auth
`/api/auth/[...all]` (better-auth): sign-up, sign-in, sign-out, session,
request-password-reset, reset-password.

## Me / buildings / floors / companies
| Method | Path | Body / notes |
| --- | --- | --- |
| GET | `/api/me` | `{ user, buildings:[{id,name,floors:[{id,name,order,companyId,company:{id,name}}]}], defaultCompanyId }` |
| POST | `/api/buildings` | `{name}` |
| PATCH | `/api/buildings/:id` | `RenameBuildingInput` |
| POST | `/api/floors` | `CreateFloorInput` |
| PATCH | `/api/floors/:id` | `UpdateFloorInput` (rename, reorder, archive) |
| GET | `/api/floors/:id/view` | `FloorView` (rooms, desks, employees, task summary) |
| POST | `/api/companies` | `CreateCompanyInput` → creates company + membership + default rooms/desks + manager employee + default learning schedule; attaches to a floor (new or given) |
| GET | `/api/companies/:cid` | company + settings |
| PATCH | `/api/companies/:cid` | `UpdateCompanyInput`; `settings` is `CompanySettingsSchema.partial()`, including `allowPaidLearning` (default `false`: learning LOW mode writes zero-token notes; `true` lets it use an explicit `API_KEY` connection, billed separately, never a subscription) |
| DELETE | `/api/companies/:cid` | archive (soft) |

## Employees
| GET | `/api/companies/:cid/employees?status=&specialty=` |
| POST | `/api/companies/:cid/employees` | `HireEmployeeInput` |
| GET | `/api/companies/:cid/employees/:eid` | full detail (prompt current version, skills, evidence, learning, usage summary) |
| PATCH | `/api/companies/:cid/employees/:eid` | `UpdateEmployeeInput` |
| GET/POST | `/api/companies/:cid/employees/:eid/prompt-versions` | list / `CreatePromptVersionInput` |
| POST | `/api/companies/:cid/employees/:eid/prompt-versions/:v/rollback` | creates a new version copying `v` |
| PUT | `/api/companies/:cid/employees/:eid/skills` | `SetEmployeeSkillsInput` |
| GET | `/api/companies/:cid/employees/:eid/evidence` | career evidence |
| POST | `/api/companies/:cid/employees/:eid/rank` | `OverrideRankInput` (audited) |
| GET | `/api/companies/:cid/employees/:eid/tasks` | task history |

## Skills
| GET/POST | `/api/companies/:cid/skills` | includes global templates (companyId null) |
| PATCH/DELETE | `/api/companies/:cid/skills/:sid` |

## Projects / tasks
| GET/POST | `/api/companies/:cid/projects` |
| GET | `/api/companies/:cid/tasks?status=&assigneeId=&projectId=` | `status` accepts every `TASK_STATUSES` value, including `WAITING_FOR_PROVIDER_LIMIT` |
| POST | `/api/companies/:cid/tasks` | `CreateTaskInput` |
| GET | `/api/companies/:cid/tasks/:tid` | task + children + dependencies + assignments + executions (each with `errorKind`) + artifacts + approvals, plus `limitRetries`, `maxLimitRetries` (5), `latestErrorKind` and `providerLimit: { provider, displayName, limit: ProviderLimitView, limited } \| null` for the provider the task runs on |
| POST | `/api/companies/:cid/tasks/:tid/actions` | `TaskActionInput`: `cancel \| retry \| approve \| reject \| unblock \| resume` (`resume` re-queues a `WAITING_FOR_PROVIDER_LIMIT` task). While the provider is still limited core refuses with 409 `{ error: { code: "conflict", message, details: { reason, resetAt, retryAfterAt } } }` |
| GET | `/api/companies/:cid/tasks/:tid/events?after=` | timeline |
| GET | `/api/companies/:cid/artifacts/:aid` | content or file download |
| GET | `/api/companies/:cid/approvals?status=` |
| POST | `/api/companies/:cid/approvals/:aid` | `DecideApprovalInput` |

## Events (SSE)
`GET /api/companies/:cid/events/stream?after=<seq>` — `text/event-stream`;
replays persisted events with `seq > after`, then live. Event frames:
`id: <seq>\nevent: <type>\ndata: <TaskEvent JSON>`. Heartbeat comment every
15s. `GET /api/companies/:cid/events?after=&limit=` for polling fallback.

## Providers / runners / usage
Subscription-first: by default employees run through the user's own, unmodified
Claude Code / Codex CLI on their machine via the local runner
(`authMode: SUBSCRIPTION_CLI`, `mode: LOCAL_RUNNER`, no secret stored). An API
key (`authMode: API_KEY`, `mode: API`) is an explicit, separately billed option.

| GET | `/api/companies/:cid/providers` | `{items}`: each has `authMode`, `authMethodLabel`; never includes secrets (only `hasSecret`, `secretLast4`) |
| POST | `/api/companies/:cid/providers` | `CreateProviderConnectionInput`. `mode` is derived: `SUBSCRIPTION_CLI` → `LOCAL_RUNNER`, `API_KEY` → `API`, `provider: SIMULATED` → `SIMULATED` (a legacy explicit `mode: "API"` means `API_KEY`). Any request carrying `apiKey` (or `authMode: "API_KEY"`) is an `API_KEY` connection and requires `acknowledgeSeparateBilling: true` (400 `separate_billing_not_acknowledged`, nothing stored). Without a key it is `SUBSCRIPTION_CLI` and no secret is ever stored; a second active subscription connection for the same provider is 409 `conflict` (`details.connectionId`). Audited. |
| PATCH | `/api/companies/:cid/providers/:pid` | `UpdateProviderConnectionInput` + optional `authMode`, `acknowledgeSeparateBilling`. Switching to `API_KEY` requires the acknowledgement (400 `separate_billing_not_acknowledged`) and a key; switching to `SUBSCRIPTION_CLI` destroys the stored key. `apiKey` alone rotates an API key. |
| DELETE | `/api/companies/:cid/providers/:pid` | revoke (stored key destroyed) |
| POST | `/api/companies/:cid/providers/:pid/verify` | API keys: runs adapter `verify()`; returns status + models. Subscription connections are checked by the runner instead (no-op with an explanatory `error`). |
| GET | `/api/companies/:cid/providers/status` | `ProviderStatusView[]` (one per provider: `ANTHROPIC` "Claude Code", `OPENAI` "OpenAI Codex"): `status` (`PROVIDER_UI_STATUSES`) + `statusLabel`, `detail`, `authMode`, `authMethodLabel`, `connectionId`, `runner {id, name, status, lastSeenAt, tool: RunnerToolInfo}`, `limit: ProviderLimitView`, `activeExecutions`, `waitingTasks`, `usage: {kind: "unavailable", note: "Usage details unavailable from provider."}`. Derived from the connection, the latest runner heartbeat and `ProviderLimitState`; no invented percentages, countdowns or balances. Served by core `getProviderStatuses`; `usage` is `{kind: "reported", utilization, windowLabel, resetAt}` only when the provider itself reported utilization. A reduced local derivation is used only if core cannot be loaded. Runners count as online while the worker has not marked them stale. |
| POST | `/api/companies/:cid/providers/:pid/reconnect` | Never performs a login. `SUBSCRIPTION_CLI`: clears an `AUTH_EXPIRED` limit when the latest heartbeat (online runner) reports the CLI `logged_in`; returns `{status, cleared, instructions}` ("On your machine run `claude` and `/login` (or `codex login`), then start the runner."). `API_KEY`: re-runs verify and returns `{status, cleared, instructions: null, verify}`; a successful verify clears the provider limit through core `clearProviderLimit` (emits `provider.limit_cleared`). Owner only. |
| GET/POST | `/api/companies/:cid/runners` | `CreateRunnerInput` → returns one-time token. List items carry display-safe `capabilities {version, hostname, auth: "subscription"\|"env"\|"cli", providers, tools: {claude, codex}: RunnerToolInfo, detectedAt}` (unknown fields dropped) |
| DELETE | `/api/companies/:cid/runners/:rid` | revoke |
| GET | `/api/companies/:cid/usage?from=&to=` | `{ providerReported, estimated, subscriptionQuota: "unavailable", subscription: { note: "Usage details unavailable from provider." }, providerLimits: [{ provider, displayName, limit: ProviderLimitView, limited }], byEmployee, byProvider }` — never a computed percentage |

Events: `provider.limit` / `provider.limit_cleared` (`ProviderLimitPayload`),
`task.waiting_provider_limit`, `runner.capabilities`. The UI refetches provider
status on `provider.*`, `runner.*` and `task.waiting_provider_limit`, and polls
it every 15 s.

## Learning / memory
| GET/PUT | `/api/companies/:cid/learning/schedules` | `UpsertLearningScheduleInput` |
| POST | `/api/companies/:cid/learning/schedules/:sid/run-now` | manual run (respects budgets) |
| GET/POST | `/api/companies/:cid/learning/sources` ; `DELETE .../:sid` |
| GET | `/api/companies/:cid/learning/runs?employeeId=` ; `GET .../runs/:rid` |
| POST | `/api/companies/:cid/learning/runs/:rid/cancel` |
| GET | `/api/companies/:cid/knowledge?status=&employeeId=&kind=` |
| POST | `/api/companies/:cid/knowledge` | `CreateKnowledgeInput` (owner instruction / project doc → VERIFIED immediately) |
| POST | `/api/companies/:cid/knowledge/:kid/decide` | `DecideKnowledgeInput` |
| DELETE | `/api/companies/:cid/knowledge/:kid` |
| GET | `/api/companies/:cid/memory/search?q=&employeeId=&projectId=` | ranked verified chunks with provenance |

## Runner protocol (bearer token = runner token)
The runner CLI (`apps/runner`) speaks the core protocol
(`packages/core/src/runner/protocol.ts`, see docs/local-runner.md). The web
routes authenticate the bearer token (`authenticateRunner`: revoked runners and
archived companies get 401), parse the body with the core zod schema (400
`validation_error`) and delegate to `@agentopia/core/runner/server`. A session
owned by another runner/company is 403.

| Method | Path | Body → response |
|---|---|---|
| POST | `/api/runner/heartbeat` | `RunnerHeartbeatInput` `{capabilities: {providers, auth, version, hostname?, tools?: {claude?, codex?}: RunnerToolInfo, detectedAt?}}` → `{ runnerId, serverTime }`; marks the runner ONLINE, emits `runner.status` / `runner.capabilities` on change |
| POST | `/api/runner/jobs/claim` | (body ignored) → `{ job: RunnerJob \| null }`; only providers this runner can execute and that are not limited; subscription jobs carry `secret: null` |
| POST | `/api/runner/jobs/:sid/events` | `RunnerEventsInput` `{ items: [{type: "event", event} \| {type: "usage", usage} \| {type: "provider_limit", limit}] }` (≤ 200) → `{ ok: true, cancel, approvals }` |
| GET | `/api/runner/jobs/:sid/control` | → `{ cancel, approvals: [{id, status, note}] }` |
| POST | `/api/runner/jobs/:sid/complete` | `RunnerCompleteInput` `{status, summary, providerSessionId?, usage, artifacts[], error?, numTurns?, errorKind?, limit?}`; `USAGE_LIMIT` / `RATE_LIMIT` / `AUTH_EXPIRED` park the task as `WAITING_FOR_PROVIDER_LIMIT` without consuming an attempt |

## Visitor demo (no auth)
| GET | `/api/demo/building` | demo building, floors |
| GET | `/api/demo/floors/:fid/view` | FloorView of a demo floor |
| GET | `/api/demo/employees/:eid` | demo employee profile |
| GET | `/api/demo/tasks` , `/api/demo/tasks/:tid` | demo tasks + timelines |
| GET | `/api/demo/script` | scripted simulated event sequence for the browser to play locally |
