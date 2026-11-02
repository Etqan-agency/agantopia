# Live provider verification checklist

> Status 2026-11-02: **C (local runner, subscription mode) verified live for both Claude Code and Codex** on the owner's machine. A and B (API-key modes) remain unverified: no API key was available and they are optional, separately billed paths.

No provider credentials were available while building Agentopia, so the
Claude (Agent SDK) and Codex (Codex SDK) adapters are verified only by
contract tests that replay recorded SDK streams. Use this checklist to verify
a real run. Each step is cheap and bounded.

## A. Claude via API key (server-side API mode)

1. Create an API key in the Claude Console (https://platform.claude.com/).
   A Claude.ai Pro/Max subscription is **not** an API key.
2. Start the app: `pnpm dev` (web + worker). Sign in, open **Integrations →
   Add connection**, choose *Anthropic*, mode *API*, paste the key.
3. Click **Verify**. Expected: status `VERIFIED`, a model list appears
   (this calls `models.list`, which is not billed). An invalid key shows
   `INVALID` with a sanitized message and the key is never displayed.
4. Open **Employees → Mina (or any employee) → Overview**, set *Provider
   connection* to the new connection and a model (for example
   `claude-haiku-5-5` for the cheapest test), save.
5. Open **Integrations → connection → Execution permissions**: keep
   `permissionMode = acceptEdits`, `allowedTools = Read, Edit, Write, Glob,
   Grep`, `maxTurns = 10`, `maxCostUsd = 0.10`.
6. **Tasks → New task**: title "Create hello.md", description "Create a file
   named hello.md containing one friendly sentence. Do nothing else.", assign
   directly to that employee (toggle *Submit to manager* off) with max cost
   0.10.
7. Expected within ~1 minute: Office shows the lamp on and typing, the task
   timeline shows `execution.started` with `provider: anthropic`,
   `execution.tool_use` (Write), `execution.usage` with
   `costSource: provider_reported` and a non-zero `costUsd`, then handoff,
   review and `COMPLETED`. Artifacts: `summary.md` and `workspace.diff`.
   The file exists under `workspaces/<companyId>/default/hello.md`.
8. **Integrations → Usage** shows the provider-reported tokens and cost;
   subscription quota shows "Unavailable" (by design).
9. Approval gate test: add `Bash` to *allowed tools* is NOT needed; instead
   create a task "List files with ls" — Bash is not allowed, so the SDK asks
   through `canUseTool`; an approval appears in the Tasks approvals strip.
   Approve it; the run resumes. Deny → the run records the denial and fails
   or completes without that tool.

## B. Codex via API key

1. Create an OpenAI API key. Repeat A.2–A.4 with provider *OpenAI*.
2. Verify calls `models.list` (not billed). Choose a Codex-capable model id
   from the verified list (for example `gpt-5-codex` if present).
3. Run the same "Create hello.md" task. Expected: `execution.started` with
   `provider: openai`, `execution.tool_use` with `file_change`,
   `execution.usage` with `costSource: estimated` (Codex reports tokens, not
   USD; the estimate uses `packages/core/src/providers/pricing.ts`), then
   `COMPLETED`.

## C. Local runner

1. **Integrations → Runners → Create runner**; copy the one-time token.
2. Create a provider connection with mode *Local runner* (no key stored).
3. On your machine: `pnpm runner -- --server http://localhost:3000 --token
   <token> --auth env` with `ANTHROPIC_API_KEY` exported in that shell.
4. Assign an employee to the local-runner connection and create a task.
   Expected: the runner logs `claimed`, streams events, and the office shows
   the same animation as API mode. Stop the runner mid-task: the task shows
   `BLOCKED/FAILED` with "lease expired" after ~60 s and can be retried.
5. `--auth cli` runs the unmodified bundled Claude Code binary with whatever
   it already has configured locally; Agentopia never reads those
   credentials. See docs/integrations-research.md §1.3 for the terms.

## D. Learning engine (low-token mode)

1. **Learning → Company schedule**: token strategy *Low*, per-run budget
   5,000 tokens, press **Run now** for a frontend employee that has a
   verified connection.
2. Expected: a run with `sourcesChecked ≥ 1`, `tokensUsed > 0`, a
   `PROVIDER_REPORTED` usage record, and DRAFT notes in the approval queue
   with URL, retrieval time and confidence. Zero mode never spends tokens
   (enforced by `ZeroTokenViolation`).
