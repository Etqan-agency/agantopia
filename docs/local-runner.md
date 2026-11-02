# Local runner

The local runner (`apps/runner`, binary `agentopia-runner`) executes an
employee's work **on your own machine, under your own OS account**, through
**your own, unmodified Claude Code / Codex CLI signed in with your own
account**. This is Agentopia's default way to run real work: usage counts
against your own Claude or ChatGPT plan, nothing is billed per token, and the
Agentopia server never sees your credentials.

Routing (decided on the server, never switched automatically):

| Employee's connection | Where it runs |
| --- | --- |
| **My subscription (local runner)** (`authMode = SUBSCRIPTION_CLI`, the default) | Always on a local runner. The server never executes it and never attaches a key. |
| **API key (billed separately)** (`authMode = API_KEY`) | On the Agentopia worker with that key (explicit, pay-as-you-go). Legacy runner connections that store a key run on the runner with it. |
| No connection | Clearly labelled simulation (no provider is called). |

There is **no paid fallback**: a subscription task never moves to an API key
or to another connection. If no runner is online it is **Blocked** ("Start the
local runner on your machine") and unblocks by itself when a runner that can
run the CLI comes online. If the plan's limit is reached it **waits for the
reset** (see "Limits").

## Setup

1. In Agentopia, open **Integrations → Runners → Add runner**. Copy the token;
   it is shown once and stored only as a SHA-256 hash.
2. Connect Claude Code and/or OpenAI Codex with **My subscription (local
   runner)** and assign the connection to the employee(s).
3. Sign in to the CLIs on your machine, with your own account, through the
   vendors' own flows:
   * Claude Code: run `claude`, then `/login` (Claude Pro/Max). Check with `claude` → `/status`.
   * Codex: run `codex login` and choose **Sign in with ChatGPT**. Check with `codex login status`.
4. Start the runner from the repository root:

   ```bash
   pnpm install
   pnpm runner --server http://localhost:3000 --token <runner token>
   ```

   | Flag | Default | Meaning |
   | --- | --- | --- |
   | `--server` | `$AGENTOPIA_SERVER` or `http://localhost:3000` | Agentopia base URL |
   | `--token` | `$AGENTOPIA_RUNNER_TOKEN` | Runner token (required) |
   | `--auth subscription\|env` | `subscription` | `subscription`: your own CLI sign-in (`cli` is accepted as an alias). `env`: API keys from this shell (explicitly paid), for **API key** connections only. |
   | `--workspace-root` | `./runner-workspaces` (relative to `apps/runner` when started via `pnpm runner`) | Per-company workspaces: `<root>/<companyId>/<projectId or default>` (git-initialised) |
   | `--once` | off | Run at most one job, then exit |

The runner prints a short terms notice on start, logs what it detected, logs
`ONLINE` / `OFFLINE` transitions, reconnects with exponential backoff
(1 s → 60 s), heartbeats every 30 s, re-detects the CLIs every 5 minutes, and
stops on a 401/403 (revoked token). Ctrl+C finishes the current job; press it
twice to force-quit.

## What the runner detects (and never reads)

Detection runs at start, every 5 minutes, and is sent with each heartbeat
(`capabilities.tools`). It never runs a model and never opens a credential.

| Tool | Binary | Version | Signed in? |
| --- | --- | --- | --- |
| Claude Code | `claude` on `PATH` (shell functions/aliases are ignored), else the bundled, unmodified vendor binary from `@anthropic-ai/claude-agent-sdk-<platform>` (`bundled: true`) | `claude --version` | macOS: does the keychain item `Claude Code-credentials` exist (`security find-generic-password -s "Claude Code-credentials"`, exit code only, **never `-w`**); else does `~/.claude/.credentials.json` (or `$CLAUDE_CONFIG_DIR/.credentials.json`) exist (never opened); `CLAUDE_CODE_OAUTH_TOKEN` present in the environment (value never read). |
| Codex | `codex` on `PATH`, else the bundled vendor binary from `@openai/codex` | `codex --version` | `codex login status` → "Logged in using ChatGPT" / "Logged in using an API key" / "Not logged in" |

A tool is `executionAvailable` when it is installed and signed in
(subscription mode) or when the matching env key is set (`--auth env`). The
server only hands a runner jobs for tools it can execute.

An `--auth env` runner bills this machine's API keys per token, so it never
runs **My subscription** work, on three layers: the server never hands it a
`SUBSCRIPTION_CLI` job, it does not count as "online" for subscription tasks
(they stay **Blocked**, "Start the local runner on your machine", until a
subscription runner is online), and the runner itself refuses such a job as
**Unsupported** ("Subscription connection: start the runner with --auth
subscription").

**Never read, stored or sent:** keychain contents, `~/.claude/.credentials.json`,
`~/.codex/auth.json`, OAuth tokens, cookies, or any provider API key in your
shell. In subscription mode the runner removes `ANTHROPIC_API_KEY`,
`ANTHROPIC_AUTH_TOKEN`, `OPENAI_API_KEY` and `CODEX_API_KEY`, plus the
backend-routing settings `CLAUDE_CODE_USE_BEDROCK`, `CLAUDE_CODE_USE_VERTEX`
and `ANTHROPIC_BASE_URL`, from the CLI environment so a stray key or proxy
cannot silently turn a plan run into a paid run. If Claude Code still reports
any `apiKeySource` other than `none` (for example an `apiKeyHelper` or a key
it stored itself), the run is stopped and refused as **Unsupported**.

## How a job runs

* **Claude Code**: `claude -p --output-format stream-json --verbose
  --permission-mode <connection setting> --allowedTools … --disallowedTools …
  --max-turns N [--model m] [--resume <session>] --append-system-prompt
  <employee prompt>` with the task brief on stdin, `cwd` = the workspace.
  `--bare` is never passed (it disables the subscription login) and
  `bypassPermissions` is never used. Session persistence stays on so reworks
  can `--resume`.
* **Codex**: `codex exec --experimental-json` through the official
  `@openai/codex-sdk`, pointed at the detected binary, with no key injected
  and the env keys removed, so it uses your `codex login`.
* Headless CLIs have no interactive tool prompt. If the connection allows
  `Bash`, `WebFetch` or `WebSearch` (Claude) or workspace edits (Codex), the
  runner asks the owner **once per run** in Agentopia before starting.
* Usage: token counts are what the CLI reports. Subscription (plan) runs record
  no cost (`costSource: unavailable`) for both Claude Code and Codex, because
  plans are not billed per token; for API-key runs Claude's `total_cost_usd`
  and Codex's token-based price are recorded as `estimated`. The per-run cost
  cap applies to API-key runs; subscription runs are bounded by max turns, the
  timeout and the plan's own limits. A cost-cap stop (or the SDK's budget
  stop) fails the task once; it is not retried.
* Stopping: SIGINT, SIGTERM after the grace period (5 s), SIGKILL after twice
  that. The CLI runs in its own process group, so tool processes it started
  (Bash commands) are stopped with it, and the runner stops waiting for output
  after three times the grace period.
* Events are sent in batches of at most 200; long assistant text, progress
  text and approval titles are truncated to the protocol limits. Batches that
  fail transiently are kept and re-sent; flushes never overlap.
* Lease: if the server answers 403/404/409 for a job (it already failed or
  re-queued it, e.g. after a lease expiry), the runner stops the CLI and does
  not report a result for that job.

## Statuses (Integrations page)

| Status | Meaning |
| --- | --- |
| Ready | A runner is online, the CLI is installed and signed in. |
| Running | Executions are in progress. |
| Runner offline | No online runner (start `pnpm runner …`). |
| Authentication expired | The CLI is not signed in (or the provider rejected the sign-in). Sign in again; it clears when the runner's detection changes (signed out, then signed in), or clear it from the Integrations page. A heartbeat that merely still finds the keychain item does not clear it. |
| Usage limit reached / Waiting for reset | The provider reported a plan or rate limit; tasks wait. |
| Unsupported integration | The CLI is missing, the CLI reports an API key source in subscription mode, or the only runner was started with `--auth env` for a subscription connection. |
| Disconnected / Connected | No connection / an API-key connection (billed separately). |

"Usage details unavailable from provider." is shown unless the provider itself
reported utilization (Claude Code `rate_limit_event`); Agentopia never invents
percentages or reset times.

## Limits

* Signals: Claude Code `rate_limit_event` (`status: rejected`, `resetsAt`,
  `rateLimitType`), `system/api_retry` (`rate_limit` until `max_retries`,
  `authentication_failed`), "Not logged in" results; Codex `turn.failed` /
  `error` text ("usage limit", "429", "Retry-After", "not logged in", "401").
* On a limit the runner stops the CLI (SIGINT, SIGTERM after 5 s), keeps the
  partial output, and reports `errorKind`. The task moves to **Waiting for
  provider limit** without consuming an attempt, and the provider is marked
  limited for the company (no new work starts on it).
* Resume: at the provider-reported reset / Retry-After time, or after a
  bounded backoff (5 min × 2ⁿ, max 60 min) when the provider gave no time.
  Maintenance (every 60 s) re-queues waiting tasks; after 5 automatic
  re-queues a task is **Blocked** ("retry manually"). The owner can **Resume**
  a waiting task only once the provider is available again.
* Authentication expired: tasks wait until the runner detects a new sign-in
  (a detection change, not just an existing keychain item).
* Learning never calls a limited provider (deterministic notes only), and
  scheduled learning is postponed for that employee.
* Runner disconnects: after 90 s without a heartbeat the runner is OFFLINE, its
  running jobs fail with `RUNNER_OFFLINE` and are re-queued (bounded by the
  task's attempts); with no runner left they are Blocked until one returns.

## Safety

* Workspaces are per company/project directories under `--workspace-root`.
* The connection's settings apply locally: allowed/blocked tools, permission
  mode (never `bypassPermissions`), max turns, timeout, Codex `sandboxMode`
  with network disabled.
* Approvals are routed to Agentopia; cancelling the task aborts the local run.

## Terms basis

Anthropic's legal page does not allow third-party products to offer claude.ai
login or to route requests through Pro/Max credentials on behalf of users, but
it explicitly does not prevent an end user from signing in to the
**unmodified Claude Code binary with their own subscription**; products may
run that binary when each user authenticates with their own credentials and
usage bills to them. OpenAI documents "Sign in with ChatGPT" for a user's own
Codex CLI. The runner is built exactly on that basis. Hosted (server-side)
subscription execution, Agent-SDK-embedded subscription auth, a third-party
"Sign in with ChatGPT", and any credential extraction are **unsupported**.
Sources: [`docs/integrations-research.md`](./integrations-research.md) §1.3 and §7.

## Protocol (implemented by the web app)

All routes use `Authorization: Bearer <runner token>`; payload schemas live in
`packages/core/src/runner/protocol.ts` and the server logic in
`packages/core/src/runner/server.ts` (`authenticateRunner`, `runnerHeartbeat`,
`claimRunnerJob`, `recordRunnerEvents`, `getRunnerControl`, `completeRunnerJob`).

| Method | Path | Body → Response |
| --- | --- | --- |
| POST | `/api/runner/heartbeat` | `{capabilities: {providers, auth: "subscription"\|"env"\|"cli", version, hostname?, tools?, detectedAt?}}` → `{runnerId, serverTime}` |
| POST | `/api/runner/jobs/claim` | `{capabilities}` → `{job: RunnerJob \| null}` (`job.authMode`; `job.secret` only for API_KEY connections) |
| POST | `/api/runner/jobs/:sid/events` | `{items: (event \| usage \| approval_request \| provider_limit)[]}` → `{ok, cancel, approvals}` |
| GET | `/api/runner/jobs/:sid/control` | → `{cancel, approvals: [{id, status, note}]}` |
| POST | `/api/runner/jobs/:sid/complete` | `ExecutionResult` (+ optional `errorKind`, `limit`, `terminal`) → finalizes artifacts, usage and the task (limits park it; `terminal` fails it without a retry). Idempotent: a session that is no longer running is left unchanged. |

All additions are optional, so older runners keep working (legacy `auth: "cli"`
is read as `"subscription"`).
