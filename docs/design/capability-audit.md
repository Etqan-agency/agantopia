# Capability audit for marketing claims

Date: 2026-11-02. Every claim in `apps/web/src/content/marketing/*.ts` must map to a row marked
**Implemented** here, or be phrased with the caveat in the row. Sources: `docs/final-report.md`,
`docs/local-runner.md`, `docs/integrations-research.md`, `docs/architecture.md`, and the code
files listed. Status reflects the docs and code as read on this date; it does not re-run tests.

Legend: **Implemented** (built and covered by docs and tests), **Partial** (built with a caveat that
copy must respect), **Planned** (not built; do not claim), **Unsupported** (will not be built;
state plainly when relevant).

## Accounts, structure, people

| Capability | Status | Evidence | Copy notes |
| --- | --- | --- | --- |
| Sign-up, sign-in, sign-out (HttpOnly cookies) | Implemented | `apps/web/src/proxy.ts`, `apps/web/src/app/(auth)/`, e2e `02-auth.spec.ts` | |
| Password-reset email | Partial | `docs/final-report.md` §6 (logged, not sent) | Only mentioned on `/faq` ("not sent yet in this build") |
| Building → floors → companies, one company per floor | Implemented | `docs/architecture.md` §2, `apps/web/src/app/api/floors/`, e2e `03-companies-floors.spec.ts` | |
| Company isolation (scoped DAL, IDOR tests) | Implemented | `apps/web/src/server/authz.ts`, `docs/final-report.md` §5, `tests/security/` | "covered by automated tests" |
| Manager created with every company | Implemented | `apps/web/src/server/services/companies.ts` | |
| Six role templates (management, frontend, backend, UI/UX, QA, research) | Implemented | `packages/shared/src/roles.ts` | |
| Marketing specialist as a preset | Unsupported (not a template) | `packages/shared/src/roles.ts` | Always "configured role, not a preset" |
| Edit name, prompt, skills, knowledge | Implemented | `apps/web/src/server/services/employees.ts`, e2e `04-hiring-prompt-skills.spec.ts` | |
| Eleven-field prompt | Implemented | `packages/shared/src/prompt.ts` (`PROMPT_FIELD_ORDER`) | Field names listed on `/features/ai-employees` |
| Prompt versions and rollback | Implemented | `apps/web/src/app/api/companies/[cid]/employees/[eid]/prompt-versions/[v]/rollback/route.ts` | |
| Untrusted-content instruction appended to every prompt | Implemented | `compilePrompt` in `packages/shared/src/prompt.ts` | |
| Skills: assigned proficiency vs demonstrated | Implemented | `docs/architecture.md` §2 (`EmployeeSkill`), `apps/web/src/server/services/skills.ts` | |
| Knowledge kinds: owner instruction, project doc, learned note, task lesson | Implemented | `KNOWLEDGE_KINDS` in `packages/shared/src/enums.ts` | |
| Evidence-based ranks Trainee → Expert, owner override | Implemented | `packages/core/src/orchestration/career.ts` (`PROMOTION_RULES`), `apps/web/src/app/api/companies/[cid]/employees/[eid]/rank/route.ts` | Past Senior needs assessment or override |
| Truthful prior-experience statements | Implemented | `docs/final-report.md` §1 phase 4 | |
| Org chart | Implemented | `apps/web/src/app/(app)/organization/` | |

## Work and orchestration

| Capability | Status | Evidence | Copy notes |
| --- | --- | --- | --- |
| Manager planning into subtasks with dependencies, cycle rejection | Implemented | `packages/core/src/orchestration/planner.ts`, `plan.ts`, `docs/architecture.md` §4 | |
| Best-fit assignment (specialty, availability, rank, evidence) | Implemented | `docs/architecture.md` §4 | |
| Optional LLM decomposition for large tasks | Partial | `packages/core/src/orchestration/llm.ts`; tested with fakes only (`docs/final-report.md` §6) | Phrased as "can ask its model", only with a verified connection |
| Execution lifecycle: cancel, retry, attempt limits, timeouts | Implemented | `packages/core/src/orchestration/lifecycle.ts`, `execute.ts`, `apps/web/src/app/api/companies/[cid]/tasks/[tid]/actions/route.ts` | |
| Approvals for risky actions (shell, network, edits) | Implemented | `packages/core/src/orchestration/gate.ts`, `apps/web/src/app/api/companies/[cid]/approvals/`, e2e `06-approvals-failures.spec.ts` | For CLI runs the approval is once per run, before it starts (`docs/local-runner.md`) |
| Review by QA or manager against definition of done | Implemented | `packages/core/src/orchestration/review.ts` | Deterministic checklist in simulated mode; LLM review path tested with fakes only |
| Artifacts, summary, usage records with provenance | Implemented | `packages/core/src/orchestration/usage.ts`, `apps/web/src/server/services/usage.ts` | provider-reported / estimated / unavailable |
| Task timeline of persisted events | Implemented | `docs/architecture.md` §2 (`TaskEvent.seq`), `apps/web/src/app/api/companies/[cid]/tasks/[tid]/events/route.ts` | |
| Per-company concurrency, cost cap, timeout, retention settings | Implemented | `packages/shared/src/settings.ts` (`CompanySettingsSchema`) | |
| Cross-company collaboration | Planned | `docs/final-report.md` §6 | Not claimed |

## Office

| Capability | Status | Evidence | Copy notes |
| --- | --- | --- | --- |
| Pixi office animated from persisted events | Implemented | `apps/web/src/office/scene.ts`, `state-machine.ts`, `stream.ts` | |
| Rooms by specialty (manager, development, design, research, QA, shared, lounge) | Implemented | `DEFAULT_ROOMS` in `packages/shared/src/office.ts`, `SPECIALTY_ROOM` in `enums.ts` | |
| List view; default under reduced motion / no WebGL / small screens | Implemented | `apps/web/src/office/OfficeListView.tsx`, `docs/design-research.md` | |
| Floor switching, pause, speed | Implemented | `apps/web/src/office/FloorSwitcher.tsx`, `docs/final-report.md` phase 2 | |
| Viewing the office never calls a model | Implemented | `docs/final-report.md` §5 | |
| Visitor demo at `/demo` (scripted, labelled) | Implemented | `apps/web/src/app/demo/`, `apps/web/src/office/demo-player.ts`, e2e `01-visitor-demo.spec.ts` | Always "scripted" |
| Low-power mode, Firefox/Safari/mobile GPU performance | Partial (not measured) | `docs/final-report.md` phase 2 | Not claimed |
| Human multiplayer office | Unsupported in MVP | `docs/final-report.md` §6 | Stated on `/about` and `/faq` |

## Learning and memory

| Capability | Status | Evidence | Copy notes |
| --- | --- | --- | --- |
| Twice-weekly schedule (Mon/Thu 09:00, time-zone aware), configurable | Implemented | `packages/shared/src/settings.ts` (`LearningConfigSchema`), `packages/core/src/learning/schedule.ts` | |
| Allowlisted docs (robots.txt checked) and GitHub (README/docs/changelog, no code execution) | Implemented | `docs/integrations-research.md` §3, `packages/core/src/learning/fetchers/` | |
| Specialization-only filter | Implemented | `LearningConfigSchema.specializationOnly` | |
| Change detection (ETag, SHA, hash) | Implemented | `packages/core/src/learning/dedup.ts`, `run.ts` | |
| Zero-token and low-token modes with caps and pause | Implemented | `packages/core/src/learning/budget.ts`, `synth.ts` | Low-token synthesis live call unverified (`docs/final-report.md` §6); copy describes the mode, not a verified result |
| Learning USD cost | Partial | `docs/final-report.md` §6 (null unless pricing configured) | Not claimed |
| Approval queue → verified memory | Implemented | `apps/web/src/app/api/companies/[cid]/knowledge/[kid]/decide/route.ts`, e2e `07-learning.spec.ts` | |
| Task postmortems as task lessons | Implemented | `packages/core/src/learning/postmortem.ts` | |
| Full-text retrieval with citations, size-capped | Implemented | `packages/core/src/memory/search.ts`, `docs/architecture.md` §7 | |
| Learning postponed when a provider is limited | Implemented | `docs/local-runner.md` (Limits) | |
| Vector embeddings (pgvector) | Planned (deferred) | `docs/architecture.md` §7 | Not claimed |
| Automatic model retraining | Unsupported | contract §5 | Stated: "the model itself is not retrained" |

## AI tools and providers

| Capability | Status | Evidence | Copy notes |
| --- | --- | --- | --- |
| Claude Code via local runner with the user's own sign-in (default) | Implemented, verified live 2026-11-02 | `packages/core/src/providers/claude-cli.ts`, `apps/runner/src/execute.ts`, `docs/final-report.md` §2 | |
| Codex via local runner with the user's own ChatGPT sign-in | Implemented, verified live 2026-11-02 | `packages/core/src/providers/openai-codex.ts`, `docs/final-report.md` §2 | |
| Sign-in detection without reading credentials | Implemented | `apps/runner/src/detect.ts`, `docs/local-runner.md` | |
| Provider keys stripped from CLI env; refuse if API-key source in subscription mode | Implemented | `docs/local-runner.md`, `docs/integrations-research.md` §7.2 | |
| API-key mode (explicit, billed separately), encrypted keys, last-4 | Partial | `packages/core/src/providers/anthropic.ts`, `openai-codex.ts`, `packages/core/src/crypto/secrets.ts` | Built; live API-key runs verified only with recorded SDK streams. Copy describes the option, not performance |
| Usage Limit Manager (park, resume at provider reset or bounded backoff, max 5 re-queues) | Implemented | `packages/core/src/providers/limits.ts`, `classify.ts` | Real quota exhaustion verified with recorded streams and mocks only |
| Integration statuses (Ready, Running, Runner offline, etc.) | Implemented | `apps/web/src/components/integrations/provider-cards.tsx`, `packages/shared/src/provider-status.ts` | |
| No automatic paid fallback | Implemented | `docs/local-runner.md`, `docs/final-report.md` §8 | |
| Labelled simulation when no provider is connected | Implemented | `packages/core/src/providers/simulated.ts` | |
| Subscription quota visibility | Unsupported (no official endpoint) | `docs/integrations-research.md` §1.4 | Shown as unavailable |
| claude.ai or ChatGPT login inside Agentopia | Unsupported | `docs/integrations-research.md` §7.3 | |
| Hosted execution with a consumer subscription | Unsupported | `docs/integrations-research.md` §7.3 | |
| Interactive tool prompts inside CLI runs | Unsupported | `docs/final-report.md` §8 | Copy says approvals happen before the run |
| Managed Agents adapter | Planned | `docs/integrations-research.md` §1.1 | Not claimed |

## Business

| Capability | Status | Evidence | Copy notes |
| --- | --- | --- | --- |
| Billing, pricing, plans | Unsupported in MVP | contract §5 | No pricing page; FAQ says no billing |
| Marketplace | Unsupported in MVP | contract §5 | |
| Analytics | Not present by decision | contract §7 | Only `data-cta` hooks |

## Claims deliberately left out of the copy

* Any speed, quality or productivity numbers, customer counts, logos, testimonials.
* "Learns" in the sense of model improvement; copy always separates context from weights.
* Performance on Firefox, Safari or mobile GPUs (not measured).
* Live API-key-mode reliability (verified only with recorded streams).
* Cost in dollars for learning (null unless pricing configured).
* Low-token learning output quality (live synthesis unverified).
* Specific default allowed tools for Codex beyond sandbox mode and network-off.
