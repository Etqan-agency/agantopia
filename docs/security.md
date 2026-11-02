# Security and privacy

| Threat | Mitigation |
| --- | --- |
| Prompt injection from docs/GitHub/web/tool output | Retrieved text is wrapped in a "data, not instructions" block; prompts state the rule; learning never executes code or install scripts; relevance filter + allowlist; knowledge needs owner approval before use |
| Credential exposure | AES-256-GCM at rest with `AGENTOPIA_ENCRYPTION_KEY`; decrypted only in worker/runner at run time; API returns last-4 only; pino redaction of `apiKey`, `authorization`, `encryptedSecret`; never sent to the browser or the PixiJS scene |
| Cross-company access (IDOR) | Every handler resolves `companyId` from the path and checks membership; repository helpers require `companyId`; tests attempt cross-tenant reads/writes |
| Runaway loops / cost | `maxTurns`, `maxBudgetUsd`, task timeout with abort, attempt limits, cycle detection, company concurrency semaphore, learning time/token/cost caps with pause |
| Job spoofing | Runner bearer tokens are random 32 bytes, stored hashed; jobs are leased to one runner; events accepted only for the leased session |
| Runner privilege | Runs as the user's own account; workspaces are per-company directories; `disallowedTools` defaults block destructive shell patterns; network tools off by default |
| Visitor demo abuse | Demo routes are read-only on `isDemo` rows; interaction is browser-local; rate-limited |
| Data retention | `CompanySettings.retentionDays`; maintenance job prunes events/artifacts; knowledge and employees are deletable; company archive cascades |
