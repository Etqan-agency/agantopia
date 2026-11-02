# Accessibility review: marketing site and app surfaces

Date: 2026-11-02. Scope: every route in `MARKETING_ROUTES` (`apps/web/src/content/marketing/routes.ts`),
plus `/demo`, `/login`, `/signup`, `/onboarding` and the authenticated app (`/office`,
`/office?view=list`, `/employees`, an employee detail page, `/tasks`, a task detail page, `/organization`,
`/learning`, `/integrations`, `/settings`). Target: WCAG 2.2 level AA. Everything ran against the
`next dev` server on http://localhost:3100, with the worker running (the seeded task finishes on the
simulated provider).

## 1. Method and tools

| tool | version | used for |
| --- | --- | --- |
| `@axe-core/playwright` (axe-core) | 4.14.0 (axe-core 4.14.0) | automated rules, tags `wcag2a wcag2aa wcag21a wcag21aa wcag22a wcag22aa`; best-practice rules off |
| `@playwright/test` | 1.64.1, Chromium 156.0.8078.4 | driving every check below |
| Node | 22.14.0 | scripts |

Scripts and evidence (all re-runnable):

- `apps/web/scripts/a11y-sweep.mjs`: signs up a throwaway `a11y+<ts>@agentopia.test` account, creates a
  company with three employees and one task (waits for COMPLETED), then runs axe on every route above at
  1440x900 and 390x844, light theme. The marketing routes also run with `reducedMotion: "reduce"` and,
  at 390, with the mobile menu sheet open (except `/demo`, which has its own header and no sheet).
  Output: `artifacts/agentopia-frontend-refactor/qa/axe-results.json` and `axe-results.md`
  (route x viewport x variant table). The pre-fix run is kept as `axe-results-before.json/.md`.
- `apps/web/scripts/responsive-sweep.mjs`: each marketing route at 375, 390, 768, 1024, 1440 and 1920,
  plus full-page at 390 and 1440, into `artifacts/agentopia-frontend-refactor/screenshots/responsive/`.
  Per page it asserts no horizontal overflow, no console errors, page errors, failed or >= 400 same-origin
  requests, no hydration warnings, alt on every image, exactly one h1, a focus indicator on the first five
  Tab stops (1440), and target size at 390 (fail under 24x24 CSS px unless the WCAG 2.5.8 inline or
  spacing exception applies; warn under 44x44). Results: `qa/responsive-results.json`.
- `artifacts/agentopia-frontend-refactor/qa/keyboard-check.mjs`: the hand keyboard walk-through
  automated (findings in `qa/keyboard-check.json`).
- `artifacts/agentopia-frontend-refactor/qa/contrast-spot-check.mjs`: contrast from live computed styles.
- `apps/web/e2e/12-marketing-site.spec.ts`: regression tests for the marketing site (section 8).

No screen-reader software (VoiceOver, NVDA, JAWS, TalkBack) was run. Screen-reader semantics were
checked through the accessibility tree (Playwright role queries and ARIA snapshots), not by listening.

## 2. axe results, before and after

Totals (affected nodes): before 0 critical, 94 serious, 0 moderate, 0 minor over 126 runs (one of which,
`/demo` with the mobile menu, errored because `/demo` has no menu and was dropped). After: 0 / 0 / 0 / 0
over 125 runs.

Serious-node counts per route, before → after (critical was 0 everywhere in both runs):

| route | 1440/default | 390/default | 1440/reduced-motion | 390/reduced-motion | 390/mobile-nav-open |
| --- | ---: | ---: | ---: | ---: | ---: |
| / | 6→0 | 2→0 | 2→0 | 2→0 | 2→0 |
| /product | 1→0 | 1→0 | 1→0 | 1→0 | 1→0 |
| /features/ai-employees | 1→0 | 1→0 | 1→0 | 1→0 | 1→0 |
| /features/ai-manager | 0→0 | 0→0 | 0→0 | 0→0 | 0→0 |
| /features/virtual-office | 0→0 | 0→0 | 0→0 | 0→0 | 0→0 |
| /features/agent-collaboration | 0→0 | 0→0 | 0→0 | 0→0 | 0→0 |
| /features/agent-learning | 0→0 | 0→0 | 0→0 | 0→0 | 0→0 |
| /features/multi-company | 0→0 | 0→0 | 0→0 | 0→0 | 0→0 |
| /ai-tools | 0→0 | 0→0 | 0→0 | 0→0 | 0→0 |
| /ai-tools/claude-code | 0→0 | 0→0 | 0→0 | 0→0 | 0→0 |
| /ai-tools/codex | 0→0 | 0→0 | 0→0 | 0→0 | 0→0 |
| /use-cases | 0→0 | 0→0 | 0→0 | 0→0 | 0→0 |
| /use-cases/software-development | 0→0 | 0→0 | 0→0 | 0→0 | 0→0 |
| /use-cases/marketing | 1→0 | 1→0 | 1→0 | 1→0 | 1→0 |
| /use-cases/research | 0→0 | 0→0 | 0→0 | 0→0 | 0→0 |
| /use-cases/quality-assurance | 0→0 | 0→0 | 0→0 | 0→0 | 0→0 |
| /how-it-works | 0→0 | 0→0 | 0→0 | 0→0 | 0→0 |
| /faq | 0→0 | 0→0 | 0→0 | 0→0 | 0→0 |
| /demo | 0→0 | 0→0 | 0→0 | 0→0 | n/a |
| /about | 0→0 | 0→0 | 0→0 | 0→0 | 0→0 |
| /login | 0→0 | 0→0 | n/a | n/a | n/a |
| /signup | 1→0 | 1→0 | n/a | n/a | n/a |
| /onboarding | 0→0 | 1→0 | n/a | n/a | n/a |
| /office | 3→0 | 3→0 | n/a | n/a | n/a |
| /office?view=list | 3→0 | 3→0 | n/a | n/a | n/a |
| /employees | 3→0 | 3→0 | n/a | n/a | n/a |
| /tasks | 2→0 | 2→0 | n/a | n/a | n/a |
| /organization | 3→0 | 3→0 | n/a | n/a | n/a |
| /learning | 9→0 | 9→0 | n/a | n/a | n/a |
| /integrations | 2→0 | 2→0 | n/a | n/a | n/a |
| /settings | 2→0 | 2→0 | n/a | n/a | n/a |
| /employees/[id] | 2→0 | 2→0 | n/a | n/a | n/a |
| /tasks/[id] | 2→0 | 2→0 | n/a | n/a | n/a |

Rules seen before the fixes: `color-contrast` (33 nodes), `label-content-name-mismatch` (54),
`scrollable-region-focusable` (5), `link-in-text-block` (2). axe passing is necessary, not sufficient:
it does not judge reading order, meaning, focus management or motion, which sections 4 to 6 cover.

## 3. Violations found and fixed

All fixes are in source; no rule was disabled or excluded (the only exclusion is the Next.js dev
overlay, `nextjs-portal`, which is not product UI). No copy changed.

| # | issue (WCAG) | where | fix |
| --- | --- | --- | --- |
| 1 | "Violet & gold" avatar initials: gold #FFC66D on violet #7357F6 is 3.06:1 (1.4.3). Seen on `/`, `/product`, `/features/ai-employees`, `/use-cases/marketing`, `/employees`, `/organization` | `src/components/marketing/viz/avatar-tone.tsx:14`, `src/components/avatar-swatch.tsx:15` | initials white (4.75:1); the gold ring that gives the palette its name stays |
| 2 | Office scroll story: inactive beats dimmed to 45% opacity put mist body text at 2.72:1 (1.4.3) | `src/components/marketing/sections/office-alive-story.tsx:124` | inactive opacity 70% (computed 4.9:1); the active beat still stands out |
| 3 | Inline auth links ("Sign in", "Sign up", "Try the demo", back to sign-in) distinguished by colour only, 1.12:1 against the surrounding muted text (1.4.1) | `src/app/(auth)/signup/page.tsx:17`, `login/page.tsx:17,21`, `forgot-password/page.tsx:51`, `reset-password/page.tsx:14` | always underlined; hover thickens the underline |
| 4 | Rail floor switcher: `aria-label="Switch floor. Current: …"` did not contain the visible company/floor text (2.5.3) | `src/components/shell/floor-switcher.tsx:51` | aria-label removed; a visually hidden "Switch floor. Current: " prefix plus the visible text form the name (the e2e selectors `/^Switch floor\. Current:/` still match) |
| 5 | Account menu: `aria-label="Account menu for <name>"` did not contain the visible email, and in the compact rail it sat over visible initials (2.5.3) | `src/components/shell/user-menu.tsx:91` | name built from text content: hidden "Account menu for " + visible name and email; compact mode uses hidden "Account menu for <name>" |
| 6 | Learning weekday toggles: visible "Mon", name "Monday" (2.5.3) | `src/components/learning/schedule-editor.tsx:234` | the name is the visible abbreviation; the full day is the `title` (exposed as the description). `e2e/07-learning.spec.ts` updated to the visible names |
| 7 | Office activity feed scrolls but could not be reached by keyboard (2.1.1) | `src/office/EventFeed.tsx:21` | `tabIndex={0}` and `aria-labelledby` the "Activity" heading |
| 8 | Onboarding step list scrolls horizontally at 390 but could not be reached by keyboard (2.1.1) | `src/components/onboarding/onboarding-flow.tsx:71` | `tabIndex={0}` (inside the labelled "Setup progress" nav) |
| 9 | FAQ answers were not in the server HTML while closed (crawlability; also nothing for no-JS readers) | `src/components/marketing/sections/faq-accordion.tsx:30-80` | `Accordion.Content forceMount`; closed answers are `display:none` (out of the accessibility tree, as before). The close animation is kept: radix flushes styles with transitions disabled when it measures, so a CSS discrete transition cannot hold the panel open; instead the component tracks closing items (`data-closing`) and drops them on `animationend`. Under reduced motion there is no animation and no closing state. Verified: `curl /faq` contains all 18 answers outside the JSON-LD |
| 10 | `/demo` is in the sitemap but had no canonical link, and its title rendered "Demo building · Agentopia · Agentopia" | `src/app/demo/layout.tsx:8` | uses `buildMetadata()` with the same title and description |

## 4. Keyboard and accessibility-tree findings

All 45 checks in `qa/keyboard-check.mjs` pass after the fixes.

- Skip link is the first Tab stop on every marketing page and moves focus into `main`.
- Navbar (radix NavigationMenu): Tab reaches each trigger; Enter opens (aria-expanded true); Tab moves
  into the menu links, Arrow keys move between them; Escape closes and returns focus to the trigger;
  ArrowLeft/Right, Home and End move between top-level items. Current page links carry `aria-current="page"`.
- Mobile sheet (radix Dialog, 390): opens as a dialog named "Menu", focus moves to Close, focus is
  trapped (40 Tab and 5 Shift+Tab stay inside; the rest of the page is hidden from the tree), Escape
  closes and returns focus to "Open menu"; choosing a link navigates and closes the sheet.
- Hero (`HeroOfficeExperience`): a named group ("Agentopia office, scripted demo") with a description;
  the "Scripted demo" badge is real text. Pause/Play is one button whose label flips in place and keeps
  focus; Replay resets to scene 1; the scene stepper is six buttons named by scene title, the current one
  has `aria-current="step"`; a polite live region announces "Scene n of 6: title. caption". Employees are
  `role="button"` SVG groups with names like "Maya Brooks, Designer. Idle. Show details",
  `aria-haspopup="dialog"` and `aria-expanded`. Enter or Space opens a named popover, focus moves to
  "Close details"; Escape or Close returns focus to the employee.
- Feature tabs ("Product areas", radix Tabs, manual activation): Arrow keys move focus without
  selecting, Enter selects, Home/End work, Tab from the list lands on the active panel.
- Floor switcher (homepage building preview): one tabbable button (roving tabindex), Arrow keys move
  focus and selection together (`aria-pressed` follows), Home/End go to the ends. The app rail floor
  switcher is covered by `e2e/03` and `e2e/09`.
- FAQ: questions are buttons inside h3s; Enter/Space toggle; ArrowDown/Up, Home/End move within a group
  (each FAQ group is its own accordion, so End stops at the group's last question). `aria-controls` is
  set by radix only while open; the region is labelled by its question.
- Focus indicator: the first five Tab stops on every marketing route at 1440 show a 2px outline (gold on
  navy, violet on white).

Lower-severity observations (not failures; recommendations):

1. Office scroll story (1024px+, motion allowed): each beat `li` is `tabIndex=0` so keyboard users can
   drive the sticky office. That adds six non-interactive Tab stops. Acceptable, since focusing changes
   the visual; a "Skip the walkthrough" link would help. Low.
2. Hero employee targets are about 12x17 CSS px at 390. They pass 2.5.8 through the spacing exception
   (no other target within a 24px circle) and the information is also in the scene captions and the
   live region, but they are hard to tap. Consider a larger invisible hit area on small screens. Low.
3. Homepage "Claude Code / OpenAI Codex / Local runner / API-key mode" heading links are 20px tall at
   390; they pass via the spacing exception. Footer and menu links are 24 to 43px tall (warnings only,
   below the 44px enhanced target). Low.
4. The Activity feed and the onboarding step list are now Tab stops even where they do not overflow
   (desktop onboarding). Harmless; could be made conditional on overflow. Low.
5. FAQ closed answers are `display:none`, so browser find-in-page does not reach them.
   `hidden="until-found"` would allow that, but radix owns the `hidden` attribute. Low.

## 5. Reduced-motion matrix (verified)

| component | reduced-motion behaviour | how verified |
| --- | --- | --- |
| Hero office | starts paused on scene 6 (Completed); stepper seeks to each scene's settled end state; no rAF | e2e/12 "reduced motion" test; axe reduced-motion runs |
| Office scroll story | scroll story hidden; Office + Stepper shown at every width | e2e/12 (stepper visible at 1440) |
| FAQ accordion | no open/close animation, no closing state | `motion-reduce:animate-none`; code path skips `data-closing` |
| Feature tabs, floor preview, reveals | `MotionConfig reducedMotion="user"`; `MotionReveal` disabled | axe reduced-motion runs render all content (0 violations) |
| App office and `/demo` | list view instead of the Pixi canvas | existing e2e/09 |

## 6. Contrast spot checks (live computed styles)

Foreground vs the nearest opaque background, alpha composited, at 1440 (`qa/contrast-spot-check.json`):

| element | colours | ratio | size/weight |
| --- | --- | ---: | --- |
| hero supporting text | #A8B4CA on #111326 | 8.77 | 18px/400 |
| navbar link | #A8B4CA on #111326 | 8.77 | 14px/500 |
| primary CTA | #FFFFFF on #7357F6 | 4.75 | 16px/500 |
| "Scripted demo" badge | #FFC66D on #1B2436 | 10.02 | 12px/500 |
| hero scene caption | #A8B4CA on #1B2436 | 7.43 | 14px/400 |
| footer link | #A8B4CA on #111326 | 8.77 | 14px/400 |
| FAQ question | #111326 on #FFFFFF | 18.34 | 18px/600 |
| feature page body | #A8B4CA on #111326 | 8.77 | 18px/400 |
| auth inline link | #5B3FD9 on #FFFFFF | 6.65 | 14px/400 |
| auth muted text | #5B6478 on #FFFFFF | 5.93 | 14px/400 |

These match the brand-system table. One pair was missing from that table and failed in the product: gold
on violet (3.06:1), now unused for text (fix 1). The primary CTA at 4.75:1 passes AA for normal text with
little headroom; keep it at 16px or larger.

## 7. Responsive sweep

120 page loads (20 routes x 6 widths) after the fixes: 0 problems. No horizontal overflow at any width,
no console errors, page errors, failed requests or hydration warnings, every image has alt, one h1 per
page, focus visible. The only first-run failures were target-size false positives (the visually hidden
skip link measured 1x1, and isolated targets that meet the 2.5.8 spacing exception), which the checker
now handles. Sample screenshots reviewed: `/` at all six widths, `/faq` and `/use-cases` at 390 and
1920, `/ai-tools` at 768 and 1024, `use-cases-390-full`, the mobile menu open at 390 and the hero
popover open at 1440. No layout defects found. Notes: at 375 to 1024 the hero's name tags are small
(about 7px at 1024), which is fine because the tags are `aria-hidden` and the same information is in the
employee buttons and captions; the popover at 1440 covers part of the Activity column while open, which
is expected for a popover.

## 8. Automated regression coverage

`apps/web/e2e/12-marketing-site.spec.ts` (desktop-chromium, plus the "mobile 390x844" test in
mobile-chromium via `playwright.config.ts`): 200 + one h1 + canonical on every marketing route; sitemap
lists them; robots disallows the app; hero badge, Pause/Play, Replay to scene 1, stepper to scene 6 with
the Completed status; employee popover Escape returns focus; reduced motion (hero paused on scene 6,
office story stepper); Product menu by keyboard links to `/features/ai-employees`; mobile sheet
navigation to `/faq`; FAQ answers in the initial HTML (JSON-LD stripped first); JSON-LD parses on `/`,
`/faq` (FAQPage) and `/features/ai-manager`.

## 9. WCAG 2.2 AA statement

Verified (automated or by scripted keyboard checks, Chromium only, light theme): 1.1.1 (image alt),
1.3.1 (headings, lists, landmarks, labelled regions; axe), 1.4.1, 1.4.3 (axe + spot checks), 1.4.10
(no horizontal scroll at 375 to 1920), 1.4.11 (axe where computable), 2.1.1 and 2.1.2 (keyboard paths in
section 4; the sheet traps focus by design and Escape releases it), 2.2.2 (the hero has pause, stops
off-screen and in hidden tabs, and starts paused under reduced motion), 2.3.3 (reduced-motion paths),
2.4.1 (skip link), 2.4.3 (focus order in menus, sheet and popover), 2.4.7 (focus visible), 2.4.11 (focus
not obscured: sticky header is 64px and anchors use `scroll-mt-24`; spot-checked, not swept), 2.5.3
(label in name, axe), 2.5.8 (target size at 390), 4.1.2 (names, roles, states; axe + role queries).

Not verified: behaviour with real screen readers (none was run), Firefox and Safari, Windows High
Contrast / forced colours, 200% and 400% zoom and text-spacing overrides (1.4.4, 1.4.12; 1.4.10 was only
checked by viewport width), the dark theme of the app (the sweep ran light only; marketing is navy in
both), 3.3.x form error handling beyond what axe checks, 3.2.6 consistent help, 3.3.7/3.3.8 redundant
entry and accessible authentication (auth flow not reviewed in depth), and content in the authenticated
app beyond the listed pages. A conformance claim should wait for at least one VoiceOver and one NVDA
pass over the homepage, `/faq`, signup and `/office`.

## 10. Test runs (2026-11-02, against :3100)

- Full e2e suite (`E2E_BASE_URL=http://localhost:3100 npx playwright test`): 40 passed, 1 failed, out
  of 41. Per spec: 01 3/3, 02 3/4, 03 2/2, 04 1/1, 05 2/2, 06 2/2, 07 2/2, 08 2/2, 09 9/9, 10 1/1,
  11 3/3, 12 10/10. The failure is `02-auth › duplicate email shows an error on sign up`: the test
  sends `origin: http://localhost:3000` on purpose, and better-auth rejects that origin with 403 when
  the server runs on :3100 (checked with curl: origin :3000 gets 403, origin :3100 gets 200). It comes
  from the environment, not from this change, and should pass on :3000. Log:
  `artifacts/agentopia-frontend-refactor/qa/e2e-full-run.log`.
- `pnpm --filter @agentopia/web typecheck`: clean. `lint`: 0 errors, 5 warnings that were already
  there (server files). `pnpm vitest run apps/web`: 82/82.
