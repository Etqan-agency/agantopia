# QA report (2026-11-01)

Scope: the acceptance tests from the brief, run as a Playwright e2e suite
against the running dev server (`http://localhost:3000`, Next 16 + Turbopack)
and the BullMQ worker. Only the simulated provider ran. The one external call
was the Anthropic models-list request made when verifying the fake key
`sk-ant-invalid-test`. That endpoint is not billed.

How to run: `pnpm --filter @agentopia/web test:e2e` (config:
`apps/web/playwright.config.ts`, one worker; the `mobile-chromium` project
runs only the 390x844 test). Failure traces and screenshots go to
`test-results/e2e/`, and the HTML report to `test-results/playwright-report/`.

## Results

The final full run passed all 28 tests (27 desktop-chromium + 1
mobile-chromium, Pixel 7 emulation) in 7.9 min, exit code 0. Other checks:

- `pnpm -r typecheck`: passed.
- `pnpm --filter @agentopia/web lint`: 0 errors. There are 6 warnings, all
  of them in files this QA work did not touch.
- `AGENTOPIA_REDIS_PREFIX=agentopia_test pnpm vitest run`: 145/145 passed.

Evidence paths are relative to `apps/web/`.

| Acceptance test | Status | Evidence |
| --- | --- | --- |
| Visitor demo: loads signed out, "Simulated" labels, both floors listed, floor switch, feed shows simulated events | pass | `e2e/01-visitor-demo.spec.ts` |
| Visitor demo: "Run a task" / "Connect a provider" lead to the sign-up explanation and the sign-up page | pass | `e2e/01-visitor-demo.spec.ts` |
| Visitor demo: `/api/demo/*` never exposes non-demo data (building, both floor views, every employee, tasks, task detail, script, `?companyId=` injection; non-demo floor/employee/task ids return 404) | pass | `e2e/01-visitor-demo.spec.ts` |
| Auth: sign-up form (validation + success), sign-out, wrong password error, sign-in, duplicate email | pass | `e2e/02-auth.spec.ts` |
| Auth: protected route redirects signed-out visitors (`/tasks` → `/login?next=%2Ftasks`), `/api/me` 401 | pass | `e2e/02-auth.spec.ts` |
| Auth: forgot-password form submits without error | pass | `e2e/02-auth.spec.ts` |
| Companies/floors: second company on a new floor via Settings, rename floor (inline) and company, switch floors in the rail | pass | `e2e/03-companies-floors.spec.ts` |
| Isolation: user B gets 403/404 on 18 of user A's company, floor and building endpoints (read and write); A's ids are absent from B's `/api/me` | pass | `e2e/03-companies-floors.spec.ts` |
| Hiring via the sheet, detail page, prompt edit → v2, rollback → v3 (copy of v1), assign a skill (Expert), assigned-proficiency copy, rank override requires a reason (UI + API 400) | pass | `e2e/04-hiring-prompt-skills.spec.ts` |
| Task → office: created from the office dialog; events ordered assigned → started → handoff → review_started → completed; assignee projected to WORKING; list view showed "Working" + task title; feed received the events; detail timeline in order; `summary.md` listed with a Simulated tag; Tasks board scrolls horizontally to Completed and shows the task | pass | `e2e/05-task-office.spec.ts` |
| Office: Static view toggle ↔ canvas; canvas renders a name label for each employee | pass | `e2e/05-task-office.spec.ts` |
| Approvals: `[simulate:block]` → PENDING approval in the API and in the Tasks strip; approved through the UI; task COMPLETED | pass | `e2e/06-approvals-failures.spec.ts` |
| Failures: `[simulate:fail]` → retry_scheduled, 2 attempts, FAILED; UI shows Failed; the Retry button starts a new attempt, which fails again | pass | `e2e/06-approvals-failures.spec.ts` |
| Learning: schedule edit (Mon/Thu, 09:00, Africa/Cairo, 10 min, Zero → Low); the next-run preview changes and every run is Mon/Thu 09:00 Cairo; the PUT persists across reload; out-of-range duration refused | pass | `e2e/07-learning.spec.ts` |
| Learning: docs source for FRONTEND; owner instruction created in the UI is VERIFIED; the retrieval tester returns it with "Owner instruction" and its provenance line; the approval queue is empty (no demo drafts) | pass (after bug fix 3) | `e2e/07-learning.spec.ts` |
| Integrations: Anthropic key `sk-ant-invalid-test` → Verify → INVALID; the key never appears in page text, input values, HTML or any `/api/*` response; revoke works | pass | `e2e/08-integrations.spec.ts` |
| Integrations: runner token shown once (not in the list, the page after reload, or the API); the token authenticates once, then gets 401 after revoke; subscription quota shows "Unavailable" | pass | `e2e/08-integrations.spec.ts` |
| A11y: every visible interactive control has an accessible name on `/office`, `/office?view=list`, `/tasks`, `/employees`, `/learning` | pass | `e2e/09-accessibility-responsive.spec.ts`, `e2e/a11y-heuristics.ts` |
| A11y: Tab reaches the rail floor switcher, the office floor buttons and New task; Enter opens the dialog, Escape closes it; the skip link is the first tab stop | pass | `e2e/09-accessibility-responsive.spec.ts` |
| A11y: `prefers-reduced-motion: reduce` → list view, no canvas (`/office` and `/demo`) | pass | `e2e/09-accessibility-responsive.spec.ts` |
| Responsive: 390x844 office list view, tasks grouped list; no horizontal page scroll on `/office`, `/tasks`, `/employees`, `/learning`, `/integrations`, `/settings`, `/demo` | pass (desktop project with a resized viewport, and Pixel 7 emulation) | `e2e/09-accessibility-responsive.spec.ts` |
| Performance: `/demo?mock=1&bench=1`, headless with no GPU flags | pass (numbers recorded) | `e2e/10-performance.spec.ts`, `test-results/perf/office-bench.json`, `docs/performance.md` "QA run" |

Screenshots in `docs/screenshots/` were re-captured with
`node apps/web/scripts/screenshots.mjs` after the fixes, with no console or
page errors. **Caveat:** another agent was restyling the app (globals.css,
palette, many components) while the screenshots were taken at about 23:33
local time. They therefore show that agent's in-progress purple/yellow
palette, not a final design.

## Bugs found and fixed

| # | File | Fix |
| --- | --- | --- |
| 1 | `apps/web/src/app/(app)/tasks/page.tsx` | The task board was not a containing block, so `sr-only` (absolutely positioned) spans inside the horizontally scrolling board escaped it and widened the whole document (scrollWidth 2744 px at a 1280 px viewport). Made the board `relative`. |
| 2 | `apps/web/src/office/{OfficeExperience,OfficePageClient,DemoPageClient}.tsx`, `apps/web/src/app/(app)/office/page.tsx`, `apps/web/src/app/demo/page.tsx` | `/office?view=list` (documented in design-research.md) was ignored. A `listView` prop now starts the office in the list view; the person can still opt into the canvas. |
| 3 | `apps/web/src/hooks/api-shapes.ts`, `apps/web/src/components/learning/retrieval-tester.tsx` | The retrieval tester crashed the Learning page ("Cannot read properties of undefined (reading 'length')") on any search hit. The API returns `excerpt`; the UI read `content`. The type and the render now use `excerpt`. |
| 4 | `apps/web/src/office/scene.ts` | Known item (a). The canvas fitted the floor only once, at init. It now re-fits whenever the canvas resizes, until the person pans or zooms (`autoFit` flag). |
| 5 | `apps/web/src/office/scene.ts` | Known item (a). Name labels were hidden below 0.55 zoom, which is where the authenticated office fits (≈0.47–0.52) because of the 240 px rail. Labels now show at every allowed zoom. Below 0.6 they are capped to the desk pitch with an ellipsis so neighbours don't overlap; the selected label is always shown in full. |
| 6 | `apps/web/src/office/OfficeExperience.tsx` | Known item (a). The 3-column office layout switched on a viewport breakpoint, so the rail squeezed the canvas to 624 px at 1440. It now uses a container query (`@container`, `@min-[1320px]`). In the app at 1440 the feed moves under the canvas, and the floor renders at about 0.59 instead of 0.5. The demo layout at 1440 is unchanged. |
| 7 | `apps/web/src/components/tasks/artifact-item.tsx`, `apps/web/src/app/(app)/tasks/[id]/page.tsx` | Artifacts from simulated runs had no label of their own. A Simulated tag now shows on each artifact row when the task ran on the simulated provider. |
| 8 | `apps/web/playwright.config.ts` | Test infrastructure only. The mobile project ran every spec, including desktop-only rail flows. It now runs only the 390x844 test. `workers: 1`. |

Known item (b), the Tasks board scrolling horizontally to Completed with the
completed task in it, was verified in `e2e/05-task-office.spec.ts`. Its
document-overflow bug is fix 1.

## Bugs and issues found, not fixed

1. **Layout shift on `/learning` while sections load.** The approval queue,
   sources and runs sections load one after another and push the retrieval
   tester down by about 100 px. Repro: open `/learning` at 1280x720, scroll
   to the bottom right away and open "As employee". The listbox opens where
   the trigger was before the shift and can end up off screen. The e2e test
   waits for `networkidle` to avoid this.
2. **Live events from the simulated provider are not tagged "Simulated" in
   the office feed.** `TaskEvent.simulated` is only set for demo/seed events
   (the shared schema documents this). On a company running the simulated
   provider, the live feed shows untagged events, while the task page, the
   employee header and now the artifacts are tagged. This is left as a
   product decision because changing it alters the event contract. Repro:
   create a task in a new company and watch the Activity panel on `/office`.
3. **No `employee.state: WORKING` event is emitted when an execution
   starts.** WORKING is reached only through the `EVENT_TO_VISUAL`
   projection of `task.started`/`execution.started`. The UI and the DB
   projection both handle this correctly. Noted only for consumers that
   watch `employee.state` alone.
4. **Tasks board at desktop width.** With 9 fixed 288 px columns, a new
   company's only task (Completed) is off screen until the board is
   scrolled. This works as designed and is reachable by keyboard (the board
   is a focusable region), but it is easy to miss.
5. **Truncated labels at small zoom.** At 1280x720 the demo and app canvases
   fit at about 0.52, so long names are truncated ("Morgan …"). The full
   name shows when the employee is selected and in the list view.

## Accessibility findings

- Name heuristic (`e2e/a11y-heuristics.ts`; checks for missing aria-label,
  aria-labelledby, label[for], wrapping label, text or title on visible
  buttons, links, fields and ARIA widgets): **0 offenders** on the five
  pages, at desktop and Pixel 7 widths. A sanity check against injected
  unnamed controls confirmed it flags them. This is a heuristic, not a full
  axe audit. Contrast, landmark structure and focus-order semantics were not
  audited automatically.
- Keyboard: the skip link is the first stop; the rail switcher, the office
  floor buttons and New task are reachable; dialogs open with Enter and close
  with Escape.
- Reduced motion: `/office` and `/demo` render the list view with no canvas
  element. On narrow screens the "small screens" reason takes precedence,
  which is correct.
- The canvas region is focusable and has a descriptive name. The canvas
  itself and its name labels are `aria-hidden`. The list view and a polite
  live region carry the state.
- The new Simulated tag on artifacts is text, not color only.

## Performance (measured)

From `/demo?mock=1&bench=1`, headless Chromium 156 with default flags. The
renderer reported SwiftShader software WebGL. Viewport 1440x900 at DPR 1;
56 employees, 1,697 sprites, 1 draw call per frame. Details are in
`docs/performance.md`, section "QA run".

| Run | FPS avg | min | p10 | max | Heap start/end/peak |
| --- | --- | --- | --- | --- | --- |
| spec alone | 24.2 | 12 | 12 | 60.2 | 31.6/31.6/31.6 MB |
| in full suite | 19.5 | 7.5 | 10 | 60.2 | 35.6/35.6/35.6 MB |
| in full suite, concurrent file edits | 15.6 | 3.5 | 8.6 | 30 | 31.6/31.6/31.6 MB |

The heap is reported without `--enable-precise-memory-info`, so these values
are coarse. No GPU-accelerated run was made.


## Subscription-first execution (2026-11-02)

| Check | Result | Evidence |
| --- | --- | --- |
| Type-check / lint | clean / 0 errors | `pnpm -r typecheck`, `pnpm --filter @agentopia/web lint` |
| Unit + integration | 205/205 | `AGENTOPIA_REDIS_PREFIX=agentopia_test pnpm vitest run` |
| Playwright | 31/31 (one timing flake in 06 on first run, green on rerun) | `pnpm --filter @agentopia/web test:e2e` |
| Runner detection without credentials | claude 2.0.65 (keychain), codex 0.166.0 (ChatGPT) detected; nothing read | runner log, `GET /runners` capabilities |
| Claude Code subscription run | COMPLETED; hello.md written; tokens reported | `docs/screenshots/17-task-claude-subscription-run.png` |
| Codex subscription run | COMPLETED; hello-codex.md written; 34,312/132 tokens | task events |
| Provider statuses | RUNNER_OFFLINE → READY on heartbeat; both cards | `docs/screenshots/16-integrations-subscription-ready.png` |
| Usage limit / auth expiry / reset-retry | mocked with recorded `rate_limit_event`, `api_retry`, Codex error text | `packages/core/src/providers/__tests__/*`, `orchestration/__tests__/subscription-limits.test.ts` |
| No paid fallback | subscription employee without runner → BLOCKED (RUNNER_OFFLINE), never API | `subscription-limits.test.ts` |

Open: rail banner does not hide an expired limit until core clears it (≤ 60 s);
status turns RUNNER_OFFLINE ~90 s + sweep after the last heartbeat.
