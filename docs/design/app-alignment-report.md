# App alignment report (authenticated app, brand system v1)

Date: 2026-11-02. Scope: aligning the signed-in app, auth pages, onboarding and `/demo` with
`docs/design/agentopia-brand-system.md` without changing layouts, routes, data contracts, accessible
names or e2e selectors. Office behaviour (state machine, pathfinding, Pixi draw order) is untouched.

## How the screens were walked

Seeded through the API the same way `apps/web/scripts/screenshots.mjs` does: a fresh
`shots+<ts>@agentopia.test` account, company "Harbor Studio", hires Mina Fares (Frontend), Omar
Adel (Backend), Laila Noor (UI/UX), Youssef Kamal (QA), Nour Hany (Research), two learning sources,
one owner instruction, and four tasks: "Build the pricing page", "Write the onboarding email
sequence", "Audit the signup flow for accessibility" (all completed on the simulated provider) and
"Migrate the billing webhooks" (`[simulate:block]`, held in Waiting for approval so waiting states
are visible).

Every screen was captured full-page at 1440 and 390, light and dark (`agentopia.theme` set before
load): `/office`, `/office?view=list`, `/employees`, `/employees/[id]` (Overview, Prompt, Skills,
Knowledge, Projects and tasks, Progression, Learning, Usage at 1440; Overview at 390), `/tasks`,
`/tasks/[id]` (completed and waiting), `/organization`, `/learning`, `/integrations`, `/settings`,
`/login`, `/signup`, `/forgot-password`, `/demo`, `/onboarding` (fresh account without a company).

- Before: `artifacts/agentopia-frontend-refactor/screenshots/app/before/<screen>-<width>-<theme>.png` (78 files)
- After: `artifacts/agentopia-frontend-refactor/screenshots/app/after/<screen>-<width>-<theme>.png` (same names)

No page errors or console errors were logged in either walk.

## Changes by screen

| Screen | Change | Files | Before / after |
| --- | --- | --- | --- |
| Shell (all app screens) | Rail active indicator is now a violet bar on navy (was gold). Gold stays for live work only. | `components/shell/app-shell.tsx` | `before/tasks-1440-light.png` / `after/tasks-1440-light.png` |
| Shell, mobile | Active bottom-bar item gets a 2 px violet top bar (was colour only). | `components/shell/app-shell.tsx` | `before/office-390-light.png` / `after/office-390-light.png` |
| Shell | Pending-approvals count: navy text on gold (was legacy `text-black`, same value, now explicit). | `components/shell/app-shell.tsx` | same |
| Shell + onboarding | ModeBadge on navy: Live is success text on a success/15 wash (was white/15, read as neutral); Demo/Simulated is gold on gold/10 with the dashed gold border. | `components/mode-badge.tsx`, `components/onboarding/onboarding-flow.tsx` | `before/office-1440-light.png` / `after/office-1440-light.png` |
| Lamps everywhere | Blocked/failed lamp is danger-ink (`bg-brick-ink`, danger on dark) with a faint danger ring (was navy fill with a gold ring, which read as "active"). Done stays `lamp-done`. | `components/ui/status-dot.tsx` | `before/task-waiting-1440-light.png` / `after/...` |
| Office list, employee panel | StateBadge: Blocked uses the danger wash/ink pair (was solid navy); Working is navy on gold. | `office/StateBadge.tsx` | `before/demo-390-light.png` / `after/demo-390-light.png` (Amara Okafor, Blocked) |
| Office | "New task" stays the single gold action; text navy, hover `gold-deep` (was a colour-mix towards black). | `office/OfficeExperience.tsx` | `before/office-1440-*.png` / `after/office-1440-*.png` |
| Office | "Loading floor…" text replaced with a Skeleton block (with an sr-only "Loading floor" status). | `office/OfficeExperience.tsx` | (transient) |
| Office floor switcher | Building name is sentence case (was an all-caps eyebrow, which the brand rules forbid); active floor number navy on gold. | `office/FloorSwitcher.tsx` | `before/demo-1440-light.png` / `after/demo-1440-light.png` |
| Office mock notice | Mock-mode notice is a navy strip with the Simulated pill, like the marketing site. | `office/OfficeExperience.tsx` | (only with `?mock=1`) |
| New task dialog | Checkbox accent violet (legacy alias `accent-purple` → `accent-violet`, same hue). | `office/NewTaskDialog.tsx` | — |
| `/demo` | Header is navy with the dark-surface logo, a gold dashed Simulated pill and mist copy; Sign in is snow text, Sign up is a violet pill (was a second gold button next to "Run a task"). The office below stays on the light app surface. Focus rings gold on navy. | `app/demo/layout.tsx` | `before/demo-1440-light.png` / `after/demo-1440-light.png`, `before/demo-390-dark.png` / `after/demo-390-dark.png` |
| `/tasks` | Empty columns are narrower (w-48 instead of w-72) and a "Jump to a column" row of chips (only the columns that hold tasks, with lamp and count) scrolls the board to that column. Completed is now one click away at 1440 (qa-report item 4). Column `section[aria-labelledby='col-*']`, the board region name and mobile list are unchanged. | `app/(app)/tasks/page.tsx` | `before/tasks-1440-light.png` / `after/tasks-1440-light.png` |
| `/learning` | Approval queue, sources and runs render together once their three queries settle (one skeleton block before), so the retrieval tester no longer jumps ~100 px while sections load in sequence (qa-report item 1). Same queries, deduplicated by React Query. | `app/(app)/learning/page.tsx` | `before/learning-1440-light.png` / `after/learning-1440-light.png` |
| `/integrations` | Provider status badges are distinct for all nine UI statuses: icon per status (Link, dashed circle, check, live gold dot, gauge, clock, key, unplug, ban); Waiting for reset and Unsupported are outlined so they differ from Usage limit reached and Authentication expired, which share their hue. `data-testid="provider-status"` and the label text are unchanged. Cards sit on `surface-raised` with `rounded-lg`, so they lift off the page in dark mode. | `components/integrations/provider-cards.tsx` | `before/integrations-1440-dark.png` / `after/integrations-1440-dark.png` |
| Employee tabs | Active tab underline is `sky-ink` (violet-deep on light, lavender on dark; was the text colour). | `components/ui/tabs.tsx` | `before/employee-overview-1440-light.png` / `after/...` |
| Employee Progression | Negative evidence dots use danger-ink (were navy). | `components/employees/tab-progression.tsx` | `before/employee-progression-1440-light.png` / `after/...` |
| Menus | Radio indicator in dropdowns is violet (was gold, which means "live work"). | `components/ui/dropdown-menu.tsx` | — |
| Badge | `gold` tone uses navy text explicitly. | `components/ui/badge.tsx` | — |
| Onboarding | Header uses the official mark + snow wordmark (`BrandLogo tone="dark-surface"`; was a gold dot and plain text). Provider step hint is subscription-first ("Your Claude Code or Codex sign-in, an API key, or simulated"); Live mode copy says "through your own connection" (was "with your key"). | `components/onboarding/onboarding-flow.tsx`, `components/onboarding/steps.ts` | `before/onboarding-1440-light.png` / `after/onboarding-1440-light.png` |
| Auth (`/login`, `/signup`, `/forgot-password`) | Aside footnote is subscription-first ("Works with Claude Code and OpenAI Codex through your own sign-in…"; was "You bring the API key"). In dark mode the navy aside now has a chrome-rule right border so it no longer merges with the navy page. | `components/auth/auth-frame.tsx` | `before/login-1440-dark.png` / `after/login-1440-dark.png` |

Checked and left as is (already aligned): page headers use Sora (`PageHeader` → `font-display`),
EmptyState/ErrorState/Skeleton are used consistently (the only ad-hoc loading text was the office
floor, fixed above; "Loading employees…" in the New task select is a placeholder, not a page state),
table density (`h-10` header, `py-3` rows), dialog and sheet surfaces in dark (`surface-raised`
#1B2436 with `rule-strong` border over a navy/50 overlay), focus rings (violet on light, gold on dark;
3.86:1 and 11.83:1 against the navy rail), in-app primary actions (`primary` variant; the only gold
action per screen is the office "New task" / demo "Run a task"), usage-limit banner in the rail and
task notice (gold border on navy / saffron wash, both readable).

## Contrast pairs measured (WCAG 2.x, computed)

Text needs 4.5:1, UI parts and large text 3:1.

| Pair | Colours | Ratio |
| --- | --- | --- |
| Rail active bar violet on active row | #7357F6 on #1B2436 | 3.27 (UI) |
| Rail active bar / mobile bar violet on navy | #7357F6 on #111326 | 3.86 (UI) |
| Approvals count navy on gold | #111326 on #FFC66D | 11.83 |
| Tab underline (light) violet-deep on white | #5B3FD9 on #FFFFFF | 6.65 |
| Tab underline (dark) lavender on navy | #B8A7FF on #111326 | 8.74 |
| Blocked lamp danger-ink on white | #C0314F on #FFFFFF | 5.54 |
| Blocked lamp danger on navy (dark) | #FB7185 on #111326 | 6.81 |
| StateBadge Blocked, light | #C0314F on #FFE4E9 | 4.62 |
| StateBadge Blocked, dark | #FB7185 on #3D1A23 | 5.69 |
| StateBadge Working / provider Running / New task | #111326 on #FFC66D | 11.83 |
| New task hover | #111326 on #E8A93D | 8.89 |
| ModeBadge Live on navy | #34D399 on #163037 (success/15 over navy) | 7.22 |
| ModeBadge Demo / Simulated pill on navy | #FFC66D on #29252D (gold/10 over navy) | 9.70 |
| Demo header copy mist on navy | #A8B4CA on #111326 | 8.77 |
| Demo Sign in snow on navy | #F5F7FF on #111326 | 17.15 |
| Demo Sign up white on violet / hover violet-deep | #FFFFFF on #7357F6 / #5B3FD9 | 4.75 / 6.65 |
| Demo focus ring gold on navy | #FFC66D on #111326 | 11.83 |
| Provider Ready, light / dark | #0E7A55 on #DDF5EA / #34D399 on #12352B | 4.66 / 6.96 |
| Provider Connected, light / dark | #5B3FD9 on #EEEAFF / #B8A7FF on #221C4A | 5.65 / 7.51 |
| Provider Usage limit reached, light / dark | #8A5A00 on #FFF3DD / #FFC66D on #3A2E17 | 5.40 / 8.56 |
| Provider Waiting for reset (outlined), light / dark | #8A5A00 on #FFFFFF / #FFC66D on #1B2436 | 5.93 / 10.02 |
| Provider Authentication expired, light / dark | #C0314F on #FFE4E9 / #FB7185 on #3D1A23 | 4.62 / 5.69 |
| Provider Unsupported (outlined), light / dark | #C0314F on #FFFFFF / #FB7185 on #1B2436 | 5.54 / 5.77 |
| Provider Runner offline, light / dark | #5B6478 on #F5F7FF / #A8B4CA on #0C0E1C | 5.55 / 9.17 |
| Provider Disconnected (outline), light / dark | #5B6478 on #FFFFFF / #A8B4CA on #1B2436 | 5.93 / 7.43 |
| Mock notice snow on navy | #F5F7FF on #111326 | 17.15 |
| Jump chip label / count on white | #111326 / #5B6478 on #FFFFFF | 18.34 / 5.93 |

## qa-report polish items

| # | Item | Outcome |
| --- | --- | --- |
| 1 | Layout shift on `/learning` | Fixed (sections render together; see above). |
| 2 | Live simulated events not tagged "Simulated" in the office feed | Skipped: behavioural (changes the event contract). |
| 3 | No `employee.state: WORKING` event | Skipped: behavioural (orchestration). |
| 4 | Completed column off screen on `/tasks` | Fixed visually: narrower empty columns plus the jump chips. |
| 5 | Truncated canvas name labels at small zoom | Not changed. The label text lives in `office/scene.ts`, and `e2e/05-task-office.spec.ts` asserts the full name as the label's text, so swapping to first names would break a tested contract; widening the cap would bring back overlapping labels. Full names show on selection and in the list view. |

## Not changed, on purpose

- `components/ui/button.tsx` (owned by the design-system agent): the dark-mode `primary` button is a
  snow fill with navy text, which is correct for the token system.
- `app/globals.css` tokens and the `.bg-chrome [data-lamp]` lifts.
- Office canvas palette and draw order; the office stays light in both themes.
- No layout restructuring and no marketing motion inside the app.

## Verification

- `pnpm --filter @agentopia/web typecheck`: pass. `pnpm --filter @agentopia/web lint`: 0 errors
  (5 pre-existing warnings in `src/server/*`, untouched).
- `pnpm vitest run apps/web/src/office apps/web/src/server`: 7 files, 57 tests passed.
- Playwright against :3100, `desktop-chromium`: `09-accessibility-responsive` + `08-integrations`
  10/10 passed; also `01-visitor-demo`, `05-task-office`, `06-approvals-failures`, `07-learning`,
  `11-subscription-integrations` 12/12 passed.

## Marketing screenshots

`apps/web/scripts/marketing-shots.mjs` seeds (or reuses) a throwaway account, captures 16 light-theme
DPR-2 PNGs into `apps/web/public/marketing/screenshots/`, writes `.webp` (quality 82, via `sharp`
resolved from the pnpm store), copies the 1440 PNGs to
`artifacts/agentopia-frontend-refactor/screenshots/product/`, and generates
`apps/web/src/content/marketing/screenshots.ts`. The office capture holds two approval-gated tasks so
lamps stay lit at the assignees' desks, then approves them. The rail user menu is cropped out of the
full-shell capture; no runner token is ever rendered.

Update: `task-detail-1440.png` is now captured from the top of the content (header, status, brief, result, first six timeline rows and the right-hand details), 2400x1900 at 2x. Every other PNG in the set was checked and starts at its page or tab header.
