# Integrations research (Phase 0)

Research date: 2026-11-01. Every claim below was read from the linked primary
source on that date unless marked **unverified**. Nothing here should be read
as legal advice; it summarizes vendor documentation.

## 1. Claude (Anthropic)

### 1.1 Which official interface to use

| Interface | What it is | Fit for Agentopia |
| --- | --- | --- |
| Claude API (`@anthropic-ai/sdk`) | Direct Messages API; you own the tool loop | Used for cheap, non-billable key verification (`client.models.list()`), for bounded learning synthesis in "low token" mode, and for manager planning (small structured calls). |
| Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) | Claude Code packaged as a library: built-in Read/Edit/Write/Bash/Glob/Grep tools, permissions, sessions, hooks, cost reporting. Bundles the Claude Code binary via an optional platform dependency. | **Primary execution path for employees.** Gives working-directory isolation (`cwd`), `allowedTools`/`disallowedTools`, `permissionMode`, `maxTurns`, `maxBudgetUsd`, `canUseTool` approval callback, `resume`, `abortController`, and a `result` message with `total_cost_usd`, `usage`, `modelUsage`, `num_turns`, `duration_ms`, `permission_denials`. |
| Claude Code CLI (`claude -p`) | Headless CLI; same loop as the SDK | Used only by the optional local runner on the user's own machine (see 1.3). |
| Managed Agents | Anthropic-hosted sessions | Not used in MVP (adds hosting cost and a second sandbox model); listed as a future adapter. |

Source: https://code.claude.com/docs/en/agent-sdk/overview and
https://code.claude.com/docs/en/agent-sdk/typescript (installed package
`0.3.316` types were inspected locally in `node_modules`; the option and
message names used in `packages/core/src/providers/anthropic.ts` come from
that `.d.ts`).

### 1.2 Authentication and terms (API mode)

* Quickstart: set `ANTHROPIC_API_KEY`; the SDK does not load `.env` files.
  Bedrock / Vertex / Foundry are supported through environment flags
  (`CLAUDE_CODE_USE_BEDROCK=1`, etc.). Source:
  https://code.claude.com/docs/en/agent-sdk/quickstart
* Agent SDK overview, verbatim: "Unless previously approved, Anthropic does
  not allow third party developers to offer claude.ai login or rate limits for
  their products, including agents built on the Claude Agent SDK. Use the API
  key authentication methods described in the Quickstart instead."
* Legal and compliance page, verbatim: "Anthropic does not permit third-party
  developers to offer Claude.ai login into their own applications, or to route
  requests through Free, Pro, Max, or Ultra plan credentials on behalf of
  their users. Moreover, developers may not collect, store, or intermediate
  Claude.ai credentials or session tokens." Source:
  https://code.claude.com/docs/en/legal-and-compliance
* Consequence for Agentopia: **a Claude subscription is not an API key.** The
  Integrations screen accepts only an Anthropic Console API key for API mode,
  and the UI says so explicitly. Agentopia never asks for, stores, or proxies
  claude.ai OAuth tokens.

### 1.3 Local runner mode (user-operated)

* The same legal page states that the restriction "does not prevent an end
  user from signing in to the unmodified Claude Code binary with their own
  Claude subscription", and the help-center article "Use the Claude Agent
  SDK with your Claude plan" (https://support.claude.com/en/articles/15036540)
  says that, as of its 2026-10-07 update, Agent SDK and `claude -p` usage by a
  plan subscriber draws from that plan's limits. Third-party coverage of an
  earlier "separate SDK credit" plan (June 2026) describes a change that the
  help center says was paused; treat those articles as superseded.
* Agentopia's local runner (`apps/runner`) therefore:
  * runs on the user's own machine, under the user's own OS account;
  * defaults to `ANTHROPIC_API_KEY` from the runner's environment;
  * offers an explicit, documented `--auth cli` flag that simply does not set
    a key and lets the unmodified bundled Claude Code binary use whatever
    the user has configured locally. Agentopia never reads, copies or
    transmits those credentials, and the hosted server never executes with
    them. Whether using a personal plan this way is appropriate for a given
    user is between that user and Anthropic; the runner prints the help-center
    link on first use.
* **Unsupported / refused by design:** hosted Agentopia instances using a
  user's claude.ai login; scraping or importing Claude Desktop settings or
  tokens; any "subscription as API key" behavior.

### 1.4 Usage and quota reporting

* The Agent SDK result message reports `total_cost_usd` and per-model
  `usage` (input, output, cache read/write tokens). Agentopia stores these as
  `UsageRecord.source = PROVIDER_REPORTED`.
* There is **no official endpoint** for a consumer plan's remaining weekly
  quota. The usage dashboard shows "Unavailable" for subscription quota and
  never estimates it. Organization-level Admin API usage reports require an
  admin key and are out of MVP scope.
* Pricing used for *estimates only* (labelled `ESTIMATED`) comes from the
  Claude API reference snapshot in the `claude-api` skill (2026-10-06) and is
  configurable in `packages/core/src/providers/pricing.ts`.

### 1.5 Permissions mapping

Agentopia settings → Agent SDK options (verified names):

| Agentopia | Agent SDK |
| --- | --- |
| Workspace | `cwd` (per-company, per-project isolated directory) |
| Allowed tools | `allowedTools` |
| Blocked tools / patterns | `disallowedTools` (e.g. `Bash(rm -rf *)`) |
| Permission mode | `permissionMode` (`default`, `acceptEdits`, `dontAsk`, `plan`; `bypassPermissions` is never offered) |
| Approval gate | `canUseTool` callback → `ApprovalRequest` row → owner decision via UI → `{behavior:'allow'}` / `{behavior:'deny', message}` |
| Max turns | `maxTurns` |
| Max cost | `maxBudgetUsd` (plus Agentopia's own hard stop on `execution.usage`) |
| Timeout / cancel | `abortController` |
| Reasoning | `effort` (`low`/`medium`/`high`) |
| Resume | `resume` (session id persisted on `ExecutionSession.providerSessionId`) |

Permission evaluation order (hooks → deny rules → ask rules → mode → allow
rules → `canUseTool`) is documented at
https://code.claude.com/docs/en/agent-sdk/permissions. Note the documented
caveat: tools auto-approved by `allowedTools` never reach `canUseTool`, so
Agentopia keeps `Bash` out of `allowedTools` by default and routes it through
the approval gate.

## 2. Codex (OpenAI)

### 2.1 Interfaces

| Interface | Notes |
| --- | --- |
| `@openai/codex-sdk` (TypeScript) | Wraps the `codex` CLI (bundled via `@openai/codex` optional platform package; present locally after install). `new Codex({ apiKey, env, config })`, `startThread({ model, sandboxMode, workingDirectory, skipGitRepoCheck, approvalPolicy, networkAccessEnabled, modelReasoningEffort, additionalDirectories })`, `thread.run()` / `thread.runStreamed()` → `ThreadEvent`s (`thread.started`, `turn.started`, `item.started/updated/completed`, `turn.completed` with `usage`, `turn.failed`, `error`); `ThreadItem`s include `agent_message`, `reasoning`, `command_execution`, `file_change`, `mcp_tool_call`, `web_search`, `todo_list`, `error`. `TurnOptions.signal` cancels. Names verified from the installed `dist/index.d.ts` (0.166.0). |
| Codex App Server | JSON-RPC over stdio; used by rich clients (VS Code). Docs state its authentication "has never been permitted for commercial or hosted services". Not used. Source: https://learn.chatgpt.com/docs/app-server.md |
| OpenAI API (`openai`) | Used for key verification (`models.list`) and bounded learning synthesis in low-token mode. |

### 2.2 Authentication and terms

* Auth docs: "Use API key authentication for programmatic Codex CLI workflows,
  such as CI/CD jobs." and "When you sign in with an API key, Codex uses
  standard API pricing instead of included ChatGPT plan credits." Source:
  https://learn.chatgpt.com/docs/auth
* The SDK injects `CODEX_API_KEY` into the CLI environment when `apiKey` is
  provided. ChatGPT-plan sign-in is interactive/device-code based and is
  intended for the user's own CLI; Agentopia never collects or forwards
  ChatGPT credentials. **A ChatGPT subscription is not an API key**; the UI
  states this.
* Unsupported by design: hosted execution using a ChatGPT login; copying
  `~/.codex/auth.json`.

### 2.3 Permissions mapping

| Agentopia | Codex SDK |
| --- | --- |
| Workspace | `workingDirectory` + `skipGitRepoCheck: true` (workspaces are initialized as git repos anyway) |
| Sandbox | `sandboxMode` (`read-only` or `workspace-write`; `danger-full-access` never offered) |
| Approval | `approvalPolicy: "never"` + Agentopia pre-execution approval for shell/network, because the SDK's JSONL stream has no interactive approval round-trip. Network stays off (`networkAccessEnabled: false`) unless the owner enables it. |
| Reasoning | `modelReasoningEffort` |
| Cancel | `TurnOptions.signal` |
| Usage | `turn.completed.usage` (input, cached input, output, reasoning tokens). Codex does not report USD; cost is `ESTIMATED` when a price table exists, otherwise shown as tokens only. |

### 2.4 Verification status

Codex CLI binary is bundled by npm (`@openai/codex@0.166.0-darwin-arm64`),
so the adapter can run locally once an `OPENAI_API_KEY` is supplied. **Live
run unverified in this session** (no key available). Contract tests use a
recorded event stream.

## 3. GitHub and documentation ingestion (learning engine)

* GitHub REST: unauthenticated requests are limited to 60/hour per IP;
  authenticated 5,000/hour. Agentopia uses the public `GET /repos/{owner}/{repo}`
  (default branch, license, pushed_at), `GET /repos/{owner}/{repo}/commits/{branch}`
  (HEAD SHA for change detection) and `GET /repos/{owner}/{repo}/readme`
  (base64 README). ETag / `If-None-Match` is honoured to avoid counting
  unchanged fetches against the limit. Optional `GITHUB_TOKEN` env raises
  the limit. Repository *code* is never executed; only README, docs/*.md,
  CHANGELOG/releases are read, and only for allowlisted repos in the
  employee's specialty.
* Docs sites: fetched with a plain `fetch`, `User-Agent: AgentopiaLearningBot`,
  `robots.txt` checked for the path before fetching, HTML reduced to text
  deterministically (no LLM), capped at 200 KB per page, hashed (SHA-256) for
  change detection, and stored as `SourceDocument`.
* Licensing: the stored text is a bounded excerpt used for retrieval and
  citation back to the source URL; the UI always links to the origin.

## 4. PixiJS v8 (office scene)

Sources: https://pixijs.com/8.x/guides/concepts/performance-tips,
https://pixijs.com/8.x/guides/components/application/ticker-plugin,
https://github.com/pixijs/pixijs/blob/dev/skills/pixijs-performance/SKILL.md,
https://pixijs.download/release/docs/ticker.Ticker.html

Applied decisions:

* One `Application` per office page, `sharedTicker: false`, `autoStart:
  false`; the scene controller calls `app.start()/app.stop()` on visibility
  change and on floor switch. `ticker.maxFPS = 30` in low-power mode, `60`
  otherwise (verified property names).
* One procedurally generated texture atlas (characters, desks, lamps,
  furniture) built once with `Graphics` → `renderer.generateTexture()` so all
  sprites batch; no per-frame `Graphics` mutation; no filters, no masks, no
  real-time lighting. Desk lamps are a sprite swap (`lamp_off`/`lamp_on`).
* `interactiveChildren = false` on non-interactive layers; `hitArea` set on
  the floor container; employees are the only interactive sprites.
* `BitmapText` is not needed: name labels are HTML overlays positioned from
  sprite coordinates, which keeps text crisp and accessible.
* Sprite pools keyed by employee id; floor switch destroys the previous floor
  container with `{children:true}` (textures are shared and kept).
* `preferWebGPU: false` and WebGL with the canvas fallback; if `Application.init`
  throws, the page renders the accessible list view instead.

## 5. Next.js 16, Prisma 7, BullMQ, better-auth

* Next.js 16: `middleware.ts` → `proxy.ts`; `cookies()`/`headers()`/`params`
  are async; Turbopack default; `next lint` removed. Source:
  https://nextjs.org/docs/app/guides/upgrading/version-16
* Prisma 7: ESM, `prisma-client` generator with `output`, `prisma.config.ts`,
  driver adapters required (`@prisma/adapter-pg`), `migrate dev` no longer
  runs generate/seed. Source: Prisma 7 upgrade guide.
* BullMQ job schedulers: `queue.upsertJobScheduler(id, { pattern, tz }, template)`;
  cron with `tz` is evaluated in that zone (DST-safe for wall-clock times).
  Source: https://docs.bullmq.io/guide/job-schedulers
* better-auth 1.7: `betterAuth({ database: prismaAdapter(prisma, {provider:'postgresql'}), emailAndPassword:{enabled:true}, plugins:[nextCookies()] })`,
  route handler `toNextJsHandler(auth)` at `/api/auth/[...all]`, server session via
  `auth.api.getSession({ headers })`, optimistic cookie check with
  `getSessionCookie` in `proxy.ts`. Sources: better-auth Next.js, Prisma adapter
  and email/password docs.

## 6. Candidate skills evaluated

| Skill | Trust / license | Decision |
| --- | --- | --- |
| anthropics `frontend-design` (now in `anthropics/claude-plugins-official`) | Apache-2.0, text-only SKILL.md | Read; its anti-template guidance (no generic SaaS card kit, one memorable element, restraint) shaped the design tokens. Not installed as a plugin (not needed at runtime). |
| `vercel-labs/agent-skills` | MIT, ~33k stars, SKILL.md + references | Read `react-best-practices` and `web-design-guidelines`; applied rules on waterfalls, dynamic imports (PixiJS and React Flow are lazy-loaded), server auth of actions. Not installed. |
| `nextlevelbuilder/ui-ux-pro-max-skill` | MIT; ships an npm CLI that writes into global agent directories; includes promotional/donation content | Not installed. Reviewed README only; no unique guidance beyond the two above. |

## 7. Subscription-first execution (2026-11-02)

Agentopia now runs real work by default through **the user's own, unmodified
Claude Code / Codex CLI, on the user's own machine, signed in with the user's
own account** (the local runner, `docs/local-runner.md`). API keys remain an
explicit, separately billed option. There is no automatic paid fallback.

### 7.1 Terms basis

* **Anthropic** (legal and compliance page, help center 2026-10-07): third-party
  developers may not offer claude.ai login, route requests through Pro/Max
  credentials on behalf of users, or collect/store/intermediate claude.ai
  credentials; sign-in must complete through Anthropic's own flow. The page
  explicitly does not prevent "an end user from signing in to the unmodified
  Claude Code binary with their own Claude subscription", and products may run
  the unmodified binary when each user authenticates with their own
  credentials and usage bills to them. Agent SDK / `claude -p` / third-party
  app usage by a signed-in subscriber draws from that plan's limits.
  `claude -p --bare` does not use the subscription login, so Agentopia never
  passes `--bare` in subscription mode.
* **OpenAI**: the Codex CLI supports "Sign in with ChatGPT" for the user's own
  use (`codex login`, `codex login status`). OpenAI recommends API keys for
  automation; the third-party "Sign in with ChatGPT" program is for
  participating commercial apps and is not available to Agentopia.

### 7.2 What Agentopia does

* Spawns the unmodified CLI (`claude -p --output-format stream-json --verbose …`;
  `codex exec --experimental-json` via `@openai/codex-sdk` with
  `codexPathOverride`) with provider API keys removed from the child
  environment; sign-in happens only in the vendors' own flows (`/login`,
  `codex login`).
* Detects installation and sign-in without reading secrets: binary on PATH or
  bundled vendor binary, `--version`, macOS keychain item existence (no `-w`),
  `~/.claude/.credentials.json` existence, `codex login status`.
* Refuses a subscription run whose CLI reports `apiKeySource: ANTHROPIC_API_KEY`
  (a stray key would silently make it a paid run).
* Usage Limit Manager (`packages/core/src/providers/limits.ts`): classifies
  provider signals (`rate_limit_event`, `api_retry`, result/turn error text)
  into USAGE_LIMIT / RATE_LIMIT / AUTH_EXPIRED, records one state per company
  and provider, parks tasks in WAITING_FOR_PROVIDER_LIMIT without consuming an
  attempt, and resumes them at the provider-reported reset / Retry-After or a
  bounded backoff (5 min × 2ⁿ, ≤ 60 min, ≤ 5 automatic re-queues). Reset times
  are only ever taken from provider data. Learning and manager LLM calls skip a
  limited provider; learning uses an API key only when the company sets
  `allowPaidLearning: true`.

### 7.3 Explicitly UNSUPPORTED

| Item | Why |
| --- | --- |
| Hosted / server-side execution with a user's Claude or ChatGPT subscription | Routes plan credentials through a third party; not permitted (Anthropic) and not offered (OpenAI). The server only executes API-key connections. |
| Agent SDK–embedded subscription auth (Agentopia's process using a claude.ai login via the SDK) | Agentopia would be the product intermediating the login; only the unmodified CLI binary run by the user is used. |
| "Sign in with ChatGPT" inside Agentopia | The program is for participating commercial apps; Agentopia has no access. Users sign in in the Codex CLI themselves. |
| Credential extraction (reading keychain items, `~/.claude/.credentials.json`, `~/.codex/auth.json`, tokens, cookies) or importing desktop logins | Collecting/intermediating credentials is prohibited; detection checks existence only. |
| Any automatic switch from a subscription to an API key or another connection | Would bill the user without consent; limits make tasks wait instead. |
