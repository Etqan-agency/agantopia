# Agentopia — final report

Date: 2026-11-01. Built in one session from an empty directory. Everything
below was run on this machine; nothing was deployed, purchased, or committed.

## 1. Progress table

| Phase | Status | Completed | Remaining | Blockers |
| --- | --- | --- | --- | --- |
| 0 Audit & research | Done | Empty repo audited; primary-source research on Agent SDK, Codex SDK, PixiJS 8, Next 16, Prisma 7, BullMQ, better-auth; skill candidates evaluated; `docs/*` written | — | — |
| 1 Auth, visitor demo, floors/companies, static office | Done | better-auth (HttpOnly cookies, sign-up/in/out, reset), `proxy.ts` gate, Building→Floor→Company schema, `/demo` with seeded two-floor demo building and labelled simulated activity, procedurally drawn top-down office | Email delivery for password reset is logged in dev only (no SMTP) | — |
| 2 PixiJS state-driven animation | Done | Single-atlas scene (1 draw call/frame), grid A* walking, deterministic FSM (lamps, typing, handoff walk, presenting, reviewing, blocked, offline), floor switching, pause/speed/low-power/reduced-motion/static list view, visibility throttling, perf HUD + benchmark | Low-power, Firefox/Safari/mobile GPU not measured | — |
| 3 Employees, orchestration, persistence, provider adapter, SSE | Done (simulated path verified; live paths unverified) | Hiring from role templates, versioned prompts with rollback, skills, career evidence, task state machine, deterministic manager planner (+ optional bounded LLM decomposition), durable BullMQ queues with leases/heartbeats/recovery, approval gates, artifacts, usage records, SSE with replay cursor, Anthropic (Agent SDK) and Codex adapters behind one interface, local runner CLI | Live run of Claude/Codex (needs an API key: see `docs/live-verification.md`) | No provider credentials available in this environment |
| 4 Learning, memory, progression, usage, hardening, tests | Done | Twice-weekly tz-aware schedules (Mon/Thu 09:00 Africa/Cairo, DST-tested), docs + GitHub sources (both enabled), specialization-only filter, zero/low token modes with hard caps and pause, ETag/SHA/hash change detection, approval-gated verified memory, PostgreSQL FTS retrieval with provenance, truthful prior-experience statements, postmortems, evidence-based progression with owner override, usage dashboard with provenance labels, IDOR/secret/runner/demo security tests | pgvector (deliberately deferred); live LLM synthesis unverified | — |
| QA | Done | 28/28 Playwright e2e (visitor demo, auth, companies/floors + isolation, hiring/prompt/skills, task → office, approvals/failures, learning, integrations, a11y/responsive, perf), 4 bugs fixed, screenshots re-captured | 5 minor polish items in `docs/qa-report.md` (learning page layout shift, label truncation at small zoom, completed column off-screen, feed tagging of simulated-provider events, explicit WORKING state event) | — |

## 2. Provider verification matrix

| Provider / mode | Adapter | Key verification | Execution | Status |
| --- | --- | --- | --- | --- |
| Simulated | `providers/simulated.ts` | n/a | Deterministic, labelled "Simulated run (no provider was called)" | **Verified end-to-end** over HTTP and in 145 automated tests (plan → assign → execute → handoff → review → complete; cancel; retry → FAILED; approval block/resume) |
| Anthropic, API mode | `providers/anthropic.ts` (Claude Agent SDK 0.3.316) | `models.list` (not billed) | `query()` with `cwd`, `allowedTools`, `disallowedTools`, `permissionMode`, `maxTurns`, `maxBudgetUsd`, `canUseTool` approvals, `abortController`, `resume` | **Unverified live.** Contract tests replay recorded SDK messages. Checklist: `docs/live-verification.md` §A |
| **Claude Code subscription (default)** — local runner spawns the user's own unmodified `claude -p` | `providers/claude-cli.ts` inside `apps/runner` | user's own sign-in detected (keychain item existence / `codex login status`); never read | runner protocol: heartbeat / claim / events / control / complete; `rate_limit_event`, `api_retry` and auth failures classified by the Usage Limit Manager | **Verified live 2026-11-02** on the owner's machine: task "Create hello.md" → file written, tokens reported (9 in / 263 out / 70k cache read), reviewed, COMPLETED; no API key present in the child env |
| **Codex subscription (default)** — local runner runs the bundled/installed Codex CLI with the user's ChatGPT sign-in | `providers/openai-codex.ts` (subscription mode, keys stripped from env) | `codex login status` | same protocol; limit/auth errors classified from `turn.failed`/`error` text | **Verified live 2026-11-02**: task "Create hello-codex.md" → file written, 34,312 input / 132 output tokens reported, COMPLETED; no USD charge (not applicable) |
| OpenAI Codex, API mode (explicit, billed separately) | `providers/openai-codex.ts` (Codex SDK 0.166.0, bundled CLI) | `models.list` (not billed) | `startThread`/`runStreamed` with `workingDirectory`, `sandboxMode`, `approvalPolicy: never`, network off, `signal` cancel; usage → tokens, cost estimated | **Unverified live.** Contract tests replay recorded thread events. Checklist §B |
| Subscription logins **inside Agentopia** (hosted) | — | — | — | **Refused by design**: Agentopia never offers claude.ai/ChatGPT login, never stores or proxies tokens; subscriptions are used only by the user's own CLI on the user's own machine (vendor terms, `docs/integrations-research.md` §7) |

## 3. What genuinely works vs. simulated vs. needs credentials

* **Works now, no credentials:** everything in the acceptance story except the
  LLM call itself — sign-up, companies/floors, hiring, prompt versions,
  skills, manager planning and delegation, execution lifecycle, approvals,
  review, artifacts, usage records, live office animation from persisted
  events, learning runs in **zero-token** mode (real fetches of allowlisted
  docs/GitHub with change detection), approval queue, verified memory,
  retrieval with citations, progression evidence.
* **Simulated (clearly labelled):** the provider inside execution when no
  verified API connection exists; the visitor demo floors and their
  activity; the demo script played in the browser.
* **Needs your API key:** real Claude/Codex execution and low-token learning
  synthesis. Keys are stored AES-256-GCM encrypted server-side, shown as
  last-4 only, rotatable and revocable; never sent to the browser or scene.
* **Never fabricated:** subscription quota ("Unavailable"), cost for
  providers that do not report USD (shown as *estimated* or *unavailable*),
  employee experience (only recorded evidence and verified task lessons).

## 4. Evidence

| Check | Command | Result (2026-11-01) |
| --- | --- | --- |
| Type-check all packages | `pnpm -r typecheck` | clean |
| Lint web | `pnpm --filter @agentopia/web lint` | 0 errors, 6 warnings |
| Unit + integration (real Postgres + Redis) | `AGENTOPIA_REDIS_PREFIX=agentopia_test pnpm vitest run` | 18 files, 145 tests passed |
| HTTP end-to-end (sign-up → company → hire → task → completed) | `curl` script, see session log | COMPLETED with 23 ordered events, `summary.md` artifact, review checklist passed |
| Seed | `pnpm db:seed` (idempotent) | 11 employees, 6 tasks, 47 events, 10 template skills |
| Screenshots | `node apps/web/scripts/screenshots.mjs` | `docs/screenshots/01…15.png`, zero browser errors |
| Office performance | `/demo?mock=1&bench=1` | 56 employees, 1 draw call/frame, 60 fps GPU / ~31 fps SwiftShader, heap ≈31 MB (`docs/performance.md`) |
| E2E (Playwright, against the running app + worker) | `pnpm --filter @agentopia/web test:e2e` | 10 specs, 28/28 passed (27 desktop + 1 mobile), 7.9 min; details and the 5 unresolved polish items in `docs/qa-report.md` |

Code size: 299 TypeScript files, 57 API route handlers, 9 app screens plus
landing/auth/onboarding/demo, 28 office-scene modules, 968-line schema with
34 tables.

## 5. Security and cost posture

See `docs/security.md`. Highlights: company-scoped DAL on every route (tested
for IDOR), encrypted secrets with redacted logs (tested), hashed runner tokens
with per-company leases (tested), demo routes read-only on `isDemo` rows
(tested), retrieved text always wrapped as untrusted data, no code execution
from studied repositories, learning time/token/cost caps with pause, per-run
`maxBudgetUsd`, task timeouts with abort, attempt limits, cycle detection,
company concurrency semaphore. Viewing the office never calls a model.

## 6. Known gaps and honest caveats

* Live provider runs are unverified (no keys here). The adapters use only
  documented SDK options; expect small mapping fixes on first live run.
* Password-reset emails are logged, not sent (no SMTP configured).
* `ProviderConnection` keeps the verified model list inside `settings`
  (reserved keys) instead of a dedicated column.
* Learning `costUsd` is `null` unless a pricing table is configured; the
  weekly USD cap therefore acts on tokens until then.
* One LLM-planning path (`planWithProvider`) and LLM review
  (`reviewWithProvider`) are injectable and tested only with fakes.
* Not built (out of MVP scope by design): marketplace, billing, human
  multiplayer office, arbitrary room editor, pgvector embeddings, Managed
  Agents adapter, cross-company collaboration.

## 7. Visual refactor

After QA the owner requested a full palette change. The whole app, office scene, demo and landing now use only Rebecca Purple `#6e2594`, Golden Glow `#ecd444`, Grey `#808080`, Black and White (plus tints/alpha of those). Token table and contrast checks are in `docs/design-research.md`; all text pairs were calculated at ≥ 4.5:1. Screenshots in `docs/screenshots/` reflect the new palette.

## 8. Subscription-first execution (2026-11-02)

**Goal:** run employees through the usage limits of the owner's existing Claude
Code and ChatGPT/Codex subscriptions wherever officially supported, with no
unexpected API charges.

**Architecture changes (additive, backward compatible):**
* `ProviderConnection.authMode` (`SUBSCRIPTION_CLI` default | `API_KEY`), `ProviderLimitState`
  (per company + provider: kind, message, retryAfterAt, resetAt, source, utilization),
  `Task.limitRetries`, `ExecutionSession.errorKind`, `TaskStatus.WAITING_FOR_PROVIDER_LIMIT`.
* Routing is decided by `authMode` only: subscription → always the local runner;
  API key → the worker (explicit, acknowledged as billed separately); no connection →
  labelled simulation. **No automatic paid fallback exists.**
* Local runner: detects installed CLIs and sign-in state without reading any
  credential, strips provider keys from the child environment, spawns the
  unmodified `claude -p --output-format stream-json` / `codex exec` and streams
  events; refuses as Unsupported if Claude Code reports an API-key source in
  subscription mode.
* Usage Limit Manager (`packages/core/src/providers/{classify,limits,status}.ts`):
  classifies provider errors (USAGE_LIMIT / RATE_LIMIT / AUTH_EXPIRED / RUNNER_OFFLINE /
  UNSUPPORTED / OTHER), records provider-reported reset times only, parks tasks as
  `WAITING_FOR_PROVIDER_LIMIT` keeping artifacts, gates new starts and runner claims,
  releases waiting tasks after reset/backoff with at most 5 automatic re-queues, and
  postpones learning instead of spending credits.
* Integrations page shows per-provider cards with the statuses Connected /
  Disconnected / Ready / Running / Usage limit reached / Waiting for reset /
  Authentication expired / Runner offline / Unsupported integration, and
  "Usage details unavailable from provider." unless the provider reports usage.

**How users connect:** Integrations → *Connect with my subscription* → create a
runner → on their machine sign in through the vendors' own flows (`claude` →
`/login`, `codex login`) → `pnpm runner --server <url> --token <token>`.

**Verification:** 205 vitest (incl. classifier, limit manager, gating, no-fallback,
runner-offline, learning postponement, CLI adapter contract tests with recorded
streams), 31/31 Playwright, runner HTTP smoke, and two real subscription runs on
the owner's machine (see the matrix in §2; screenshots
`docs/screenshots/16-18-*.png`). Quota-exhaustion and auth-expiry were verified
with recorded streams and mocks only (a real limit cannot safely be reproduced).

**Unsupported (by vendor terms or missing official mechanism):** hosted/server-side
execution with a user's subscription; Agent SDK–embedded subscription auth;
OpenAI's third-party "Sign in with ChatGPT" program; any credential extraction;
interactive tool-approval prompts inside CLI runs (approvals happen before the run).

**Remaining manual setup:** install/sign in to the CLIs on the user's machine and keep
the runner running; API-key mode stays optional and explicit.

## 9. How to run

`README.md` → Quick start. Dev: `pnpm dev` (web :3000 + worker). Demo:
`/demo`. Tests: `pnpm test`, `pnpm test:e2e`. Runner: `docs/local-runner.md`.
Live provider checklist: `docs/live-verification.md`.
