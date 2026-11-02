# Implementation plan

Status legend: implemented / tested / mocked / blocked / not started. The
final report (`docs/final-report.md`) carries the live version of this table.

| Phase | Scope | Milestone |
| --- | --- | --- |
| 0 | Repo audit, research, architecture decisions | `docs/*-research.md`, `architecture.md`, schema |
| 1 | Auth, visitor demo, floor/company schema, static top-down office | sign up → create company/floor → see office; `/demo` works without credentials |
| 2 | PixiJS state-driven animations, lamps, walking, handoffs, floor switching | events → sprites; low-power/reduced-motion/list view |
| 3 | Employee management, manager orchestration, persistence, provider adapter, SSE | task → plan → assign → execute (simulated + real adapters) → review → artifacts |
| 4 | Specialization-only learning, memory, progression, usage controls, hardening, tests | twice-weekly tz-aware schedule, zero/low modes, approval-gated memory, retrieval |

## Vertical slices and ownership (parallel agents)

| Slice | Files | Notes |
| --- | --- | --- |
| A. Core domain | `packages/core/src/{crypto,providers,orchestration,usage,queue,workspace}` | Adapters for Anthropic (Agent SDK), OpenAI (Codex SDK), Simulated; state machine; manager planner; approvals |
| B. Learning + memory | `packages/core/src/{learning,memory}` | fetchers, relevance, dedup, zero/low modes, schedulers, FTS retrieval, postmortems |
| C. Web server | `apps/web/src/{server,app/api,lib/auth*,proxy.ts}`, `packages/db/prisma/seed.ts` | better-auth, authz DAL, all REST routes, SSE, demo routes, seed |
| D. Web UI | `apps/web/src/{app/(app),app/(auth),components}` | design system, screens, onboarding, React Flow org chart |
| E. Office scene | `apps/web/src/office`, `apps/web/src/app/(app)/office`, `/demo` | PixiJS scene, atlas, A*, state machine, floor switcher, list view |
| F. Worker + runner | `apps/worker`, `apps/runner` | BullMQ workers, schedulers, maintenance, runner protocol |
| G. QA | `tests/`, `apps/web/e2e`, screenshots | unit, integration (DB), e2e (Playwright), perf measurements, security tests |

## Risks

| Risk | Mitigation |
| --- | --- |
| No provider credentials available during development | Simulated adapter for demo; adapter contract tests with recorded streams; precise live checklist |
| Provider terms change | Adapters only use documented SDK options; auth constraints documented in `integrations-research.md` |
| Runaway cost | per-execution `maxBudgetUsd`, company weekly caps, approval for paid execution, learning budgets, hard abort |
| Prompt injection from docs/repos | retrieved text wrapped as data; tool allowlists; no code execution from studied repos |
| PixiJS performance | atlas + batching, pools, culling only when GPU-bound, throttled ticker, measured in `docs/performance.md` |

## Test strategy

* Unit (vitest): state machine transitions, planner matching, prompt compile,
  learning relevance/dedup/budget, cron/tz next-run, crypto.
* Integration (vitest + real Postgres): orchestration end-to-end with the
  simulated adapter; tenant isolation; approvals; knowledge lifecycle; FTS.
* E2E (Playwright): visitor demo, signup/login, create company + floors,
  hire employee, submit task, see office state change, approve knowledge;
  screenshots in `docs/screenshots/`.
* Security: IDOR attempts across companies, credential redaction in API and
  logs, invalid key handling, runner token misuse.
* Performance: scripted scene with 40 idle + 8 working employees, FPS and
  memory sampled via `performance.now()` and `performance.memory` where
  available; recorded, not fabricated.
