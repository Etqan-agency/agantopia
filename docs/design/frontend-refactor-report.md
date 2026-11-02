# Agentopia frontend refactor: final report

Date: 2026-11-02. Scope: the public marketing site, the brand system, and visual alignment of the
signed-in app, auth pages, onboarding and the `/demo` header. Contract:
`docs/design/frontend-refactor-plan.md`.

Every figure below comes from a design doc, a QA file in `artifacts/agentopia-frontend-refactor/qa/`,
or a command run while writing this report (file counts, `pnpm vitest run`, typecheck, lint, image
sizes). Where docs disagree, the "Discrepancies" section at the end says how it was resolved.

Nothing was committed, pushed or deployed. No packages were added beyond `@axe-core/playwright` and
`lighthouse` (devDependencies of `apps/web`) and the `sideEffects` fields in
`apps/web/package.json` and `packages/shared/package.json`. The repository has no commits yet;
`git status --short` shows every top-level path as untracked.

---

## Implementation

### What changed, by area

| Area | Change | Main files |
| --- | --- | --- |
| Brand tokens | New palette (navy, violet, lavender, gold, snow, mist), semantic light/dark variables, legacy aliases kept, motion tokens, `shadow-frame`, radii | `apps/web/src/app/globals.css`, `apps/web/src/office/palette.ts` |
| Typography | Sora (display) and Inter (body) through `next/font/google`; Fraunces removed | `apps/web/src/app/layout.tsx` |
| Logo | `BrandLogo` and `AgentopiaMark` with light, dark and auto tones; approved PNGs unchanged | `apps/web/src/components/brand/logo.tsx`, `apps/web/public/brand/` |
| Buttons | `brand` and `outline-light` variants added | `apps/web/src/components/ui/button.tsx` |
| Marketing site | New route group with its own layout, navbar, footer, skip link and site JSON-LD; copy in typed content files | `apps/web/src/app/(marketing)/`, `apps/web/src/content/marketing/` |
| SEO | Metadata builder, JSON-LD helpers, sitemap, robots, branded 404, proxy public prefixes | `apps/web/src/lib/seo.ts`, `apps/web/src/app/sitemap.ts`, `apps/web/src/app/robots.ts`, `apps/web/src/app/not-found.tsx`, `apps/web/src/proxy.ts` |
| Signed-in app | Brand alignment of shell, lamps, badges, tabs, tasks board, learning, integrations, onboarding, auth (no layout, route or selector changes) | see `docs/design/app-alignment-report.md` |
| Accessibility fixes | Ten source fixes (contrast, label-in-name, keyboard-scrollable regions, underlined auth links, crawlable FAQ, `/demo` metadata) | see `docs/design/accessibility-review.md` §3 |
| Performance | `sideEffects` flags, lazy client wrappers for interactive viz, `metadataBase` in the root layout | `apps/web/src/components/marketing/viz/lazy.tsx`, `apps/web/src/components/marketing/templates/visual-slot.tsx` |
| App bug fix | Approval toast moved into `useDecideApproval` mutation options (production timing race) | `apps/web/src/hooks/use-api.ts`, `apps/web/src/components/tasks/approval-actions.tsx` |

### Pages created (20)

19 new marketing routes plus the branded 404. `/demo` already existed and was only restyled; it is
the 20th URL in the sitemap.

| # | Route | Source file |
| ---: | --- | --- |
| 1 | `/` | `(marketing)/page.tsx` (moved from `src/app/page.tsx`) |
| 2 | `/product` | `(marketing)/product/page.tsx` |
| 3 | `/how-it-works` | `(marketing)/how-it-works/page.tsx` |
| 4 | `/features/ai-employees` | `(marketing)/features/[slug]/page.tsx` |
| 5 | `/features/ai-manager` | same, SSG |
| 6 | `/features/virtual-office` | same, SSG |
| 7 | `/features/agent-collaboration` | same, SSG |
| 8 | `/features/agent-learning` | same, SSG |
| 9 | `/features/multi-company` | same, SSG |
| 10 | `/ai-tools` | `(marketing)/ai-tools/page.tsx` |
| 11 | `/ai-tools/claude-code` | `(marketing)/ai-tools/claude-code/page.tsx` |
| 12 | `/ai-tools/codex` | `(marketing)/ai-tools/codex/page.tsx` |
| 13 | `/use-cases` | `(marketing)/use-cases/page.tsx` |
| 14 | `/use-cases/software-development` | `(marketing)/use-cases/[slug]/page.tsx` |
| 15 | `/use-cases/marketing` | same, SSG |
| 16 | `/use-cases/research` | same, SSG |
| 17 | `/use-cases/quality-assurance` | same, SSG |
| 18 | `/faq` | `(marketing)/faq/page.tsx` |
| 19 | `/about` | `(marketing)/about/page.tsx` |
| 20 | 404 | `src/app/not-found.tsx` |

Not built on purpose: `/pricing`, `/blog`, `/docs`, `/contact` (no billing, content pipeline, docs
site or contact destination exists). A development-only `/dev/components` page also exists (see
remaining issues).

### Pages redesigned

- **Homepage:** 14 sections with alternating tones: hero, explainer, workforce, office alive, one
  task (delegation), learning, multiple companies, AI tools, how it works, oversight, feature
  showcase, use cases, FAQ, final CTA.
- **`/demo` header:** navy with the dark-surface logo, gold dashed Simulated pill, snow Sign in and a
  violet Sign up pill; the office below stays on the light app surface. Metadata now goes through
  `buildMetadata()` (fixes the doubled title and missing canonical).
- **Auth (`/login`, `/signup`, `/forgot-password`, `/reset-password`):** subscription-first aside
  footnote, a chrome-rule border in dark mode, inline links always underlined.
- **App alignment:** 21 screen-level changes in `docs/design/app-alignment-report.md`, captured
  before and after at 1440 and 390 in light and dark (78 files per walk). Examples: violet rail
  indicator (gold kept for live work), danger-ink blocked lamp, distinct icons for all nine provider
  statuses, "Jump to a column" chips on `/tasks`, no layout shift on `/learning`.

### Components created

Counts are files on disk (`find apps/web/src/components/marketing/<dir> -type f`).

| Directory | Files | Names |
| --- | ---: | --- |
| `primitives/` | 11 | `Container`, `Section`, `SectionHeading`, `MotionReveal`, `ScreenshotFrame`, `Pill`, `DemoBadge`, `AnimatedConnector`, `Stepper`, `marketing-button` (re-export), `index.ts` barrel |
| `viz/` | 22 (19 source, 1 test, 1 data, 1 barrel) | `AgentProfileCard`, `AgentRoleSelector`, `avatar-tone`, `BentoFeatureGrid`, `ConversionCta`, `FeatureShowcaseTabs`, `feature-tabs-data`, `IntegrationShowcase`, `KnowledgeSourceCard`, `lazy` (dynamic wrappers), `LearningJourney`, `ManagerDelegationDiagram`, `MultiFloorBuildingPreview`, `RunOnView`, `sample-data`, `sequence` (+ `sequence.test.ts`), `surface`, `TaskProgressTimeline`, `UseCaseShowcase`, `WorkflowAnimation`, `index.ts` |
| `hero/` | 5 | `HeroSection`, `HeroOfficeExperience`, `hero-script` (+ `hero-script.test.ts`), `useHeroTimeline` |
| `office/` | 2 | `OfficeFloorSvg` (`office-floor-svg.tsx`), `floor-geometry` |
| `chrome/` | 3 | `MarketingNavbar`, `MarketingFooter`, `nav-model` |
| `sections/` | 15 | `AiToolsSection`, `DelegationSection`, `ExplainerSection`, `FaqAccordion`, `FaqSection`, `FeatureShowcaseSection`, `FinalCtaSection`, `HowItWorksSection`, `LearningSection`, `MultiCompanySection`, `OfficeAliveSection`, `OfficeAliveStory`, `OversightSection`, `UseCasesSection`, `WorkforceSection` |
| `templates/` | 6 | `DetailPage`, `FaqPage`, `IndexPage`, `SectionBody`, `VisualSlot`, `index.ts` |
| **Total** | **64** | |

Content: 13 files in `apps/web/src/content/marketing/` (`routes.ts` is the single source for
sitemap, navbar, footer and breadcrumbs; `screenshots.ts` is the generated screenshot manifest).

### Animations implemented

From `docs/design/motion-guidelines.md` §4. Engine: `motion` + CSS + SVG; no GSAP; Pixi only in the
real office.

| Animation | File | Notes |
| --- | --- | --- |
| Hero six-scene timeline (24 s) | `hero/hero-script.ts`, `hero/use-hero-timeline.ts`, `hero/hero-office-experience.tsx` | rAF only while playing, on screen and tab visible; re-renders on beats, not frames; play/pause, replay, scene stepper |
| "The office comes alive" scroll story | `sections/office-alive-story.tsx` | Sticky office from 1024 px; IntersectionObserver picks the beat; no scroll-jacking |
| Connector dash travel | `primitives/animated-connector.tsx` | CSS `connector-travel`, 0.8 s |
| Workflow staged highlight | `viz/workflow-animation.tsx`, `viz/run-on-view.tsx` | Runs once in view; also drives `TaskProgressTimeline` and `LearningJourney` |
| Building floor transition | `viz/multi-floor-building-preview.tsx` | 400 ms; arrow keys, Home, End |
| Reveal on scroll | `primitives/motion-reveal.tsx` | Fade + 8 px rise, once; nothing hidden in server HTML |
| Lamp glow | `app/globals.css` (`lamp-glow`) | 2.4 s; the only glow on the site |
| Feature tabs panel | `viz/feature-showcase-tabs.tsx` | Manual activation, no auto-rotation, lazy panel mount |
| CTA, link, chevron, navbar hover | various | Colour transitions only, 160 to 240 ms |
| Hero employee popover | `hero/hero-office-experience.tsx` | Radix Popover, Escape returns focus |

Every item has a reduced-motion fallback (`motion-guidelines.md` §5): the hero starts paused on the
final frame with a manual stepper, the scroll story becomes office + stepper, connectors become solid
lines, lamps stop pulsing.

### SEO improvements

| Item | Detail |
| --- | --- |
| Metadata builder | `buildMetadata()` in `apps/web/src/lib/seo.ts`: absolute canonical, Open Graph (1200x630 image), Twitter `summary_large_image`, robots, absolute titles |
| Copy | Unique meta titles (36 to 56 chars) and descriptions (136 to 153 chars) for 19 pages |
| Sitemap | `apps/web/src/app/sitemap.ts`, 20 URLs (verified 200 on dev and production) |
| Robots | `apps/web/src/app/robots.ts`: allows `/`, disallows `/api/`, the app routes and `/onboarding` |
| Canonical on production | `/` and `/features/ai-manager` checked with curl on :3200 |
| `metadataBase` | Set in the root layout; build has no metadata warnings |
| 404 | Branded `not-found.tsx`; Next adds `noindex` |
| Crawlable FAQ | `Accordion.Content forceMount`; `curl /faq` contains all 18 answers outside the JSON-LD |

JSON-LD types per page:

| Page | Types |
| --- | --- |
| Every marketing page (layout) | Organization, WebSite |
| `/`, `/product` | + SoftwareApplication (no offers, no ratings) |
| `/features/*`, `/ai-tools/claude-code`, `/ai-tools/codex`, `/use-cases/*` details | + BreadcrumbList |
| `/faq` | + FAQPage (the homepage shows ten FAQ items but does not emit FAQPage) |

### Assets created

| Asset | Count | Path |
| --- | ---: | --- |
| Product screenshots (light theme, DPR 2) | 16 PNG + 16 WebP | `apps/web/public/marketing/screenshots/` |
| Screenshot manifest (generated) | 1 | `apps/web/src/content/marketing/screenshots.ts` |
| 1440 screenshot copies for the artifact | 13 | `artifacts/agentopia-frontend-refactor/screenshots/product/` |
| Brand copies for the artifact | 2 | `artifacts/agentopia-frontend-refactor/assets/brand/` |

Generator: `apps/web/scripts/marketing-shots.mjs`. No SVG logo exists; the approved logo is raster
only (`apps/web/public/brand/`). A production set needs vector mark and wordmark sources, horizontal
and stacked SVG lockups, colour variants (full colour, reversed for navy, one-colour navy, white and
black), a favicon and app-icon set generated from the vector, clear-space and minimum-size rules, and
OG templates (`docs/design/logo-assets.md`). Until then, dark surfaces use the mark PNG with a live
Sora wordmark as an interim treatment.

---

## Quality

### Tests executed

| Check | Result | Source |
| --- | --- | --- |
| `pnpm --filter @agentopia/web typecheck` | Clean | re-run for this report |
| `pnpm --filter @agentopia/web lint` | 0 errors, 5 warnings, all pre-existing in `src/server/*` (`redis.ts`, `services/learning.ts`, `services/tasks.ts`) | re-run for this report |
| `pnpm vitest run apps/web` | 9 files, 82/82 passed | re-run for this report |
| Hero and viz unit tests | 2 files, 25/25 (`hero-script.test.ts` 14, `sequence.test.ts` 11) | re-run for this report |
| e2e, dev server :3100 | 40/41 passed | `qa/e2e-full-run.log` |
| e2e, production build :3200 | 39/41 after retry, then 06 fixed (see below) | `performance-results.md` §9 |
| Production build | Passes; marketing routes static or SSG | `qa/build-output.txt` |

**Dev e2e (40/41).** Per spec: 01 3/3, 02 3/4, 03 2/2, 04 1/1, 05 2/2, 06 2/2, 07 2/2, 08 2/2,
09 9/9, 10 1/1, 11 3/3, 12 10/10. The one failure is `02-auth › duplicate email shows an error on
sign up`: the spec sends `origin: http://localhost:3000` on purpose, and better-auth returns 403 for
that origin when the server runs on :3100 (curl: origin :3000 gets 403, :3100 gets 200). It is
environmental and should pass on :3000. `12-marketing-site.spec.ts` has 9 tests; the mobile test runs
in both projects, giving 10 runs.

**Production e2e.** First full run: 20 passed, 14 failed, 7 did not run. 13 failures were `429 Too
many requests` from better-auth's rate limiter, which is on only under `NODE_ENV=production`; the
14th was the duplicate-email spec. Retried per spec file with a 12 s gap: 39 passed, 2 failed. The
new failure was `06-approvals-failures › [simulate:block]`: the approval worked, but the "Approved"
toast never showed, because the toast fired from a per-call `mutate` callback that TanStack Query
drops when the strip unmounts first. Reverting the `apps/web` `sideEffects` flag did not change it,
so the flag is not the cause. Fix: the toasts moved into the `useMutation` options in
`useDecideApproval`. After the fix, spec 06 passed 2/2 on dev and 2/2 on production, twice. The
full production suite was not re-run end to end after the fix; the remaining known failure is the
duplicate-email spec.

### Accessibility findings

| Measure | Before | After |
| --- | --- | --- |
| axe serious nodes (WCAG 2.2 A/AA tags, 33 routes, 1440/390, reduced motion, mobile menu) | 94 over 126 runs (1 run errored and was dropped) | 0 over 125 runs |
| axe critical nodes | 0 | 0 |
| Lighthouse accessibility, mobile `/` | 97 | 100 |

Rules fixed: `color-contrast` (33 nodes), `label-content-name-mismatch` (54),
`scrollable-region-focusable` (5), `link-in-text-block` (2). No rule was disabled.

Keyboard: all 45 checks in `qa/keyboard-check.mjs` pass (skip link, navbar menu, mobile sheet focus
trap, hero controls and popover, feature tabs, floor switcher, FAQ, focus indicators).

Not verified: real screen readers (none run), Firefox and Safari, forced colours, 200% and 400% zoom
and text spacing, the app's dark theme, form error handling beyond axe, and the auth flow in depth.
Lighthouse still flags `heading-order` on `/` desktop (99) and `/demo` mobile (98).

### Performance measurements

Lab numbers on localhost (about 10 ms TTFB, no CDN, simulated throttling), Lighthouse 13.6, one run
per page and preset.

| Route | Mobile perf | Mobile LCP | Mobile TBT | Mobile CLS | Desktop perf | Desktop LCP |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | 92 → 97 | 2.44 → 1.51 s | 127 → 182 ms | 0 | 100 | 0.37 s |
| `/product` | 88 → 96 | 3.93 → 2.79 s | 36 → 30 ms | 0 | 100 | 0.62 s |
| `/how-it-works` | 100 | 1.21 s | 57 → 26 ms | 0 | 100 | 0.33 s |
| `/features/agent-learning` | 100 | 1.21 s | 68 → 89 ms | 0 | 100 | 0.33 s |
| `/ai-tools/claude-code` | 83 → 92 | 4.69 → 3.28 s | 102 → 36 ms | 0 | 100 | 0.70 s |
| `/use-cases/software-development` | 100 | 1.21 s | 73 → 63 ms | 0 | 100 | 0.33 s |
| `/faq` | 99 → 100 | 1.21 s | 111 → 86 ms | 0 | 100 | 0.33 s |
| `/demo` | 88 → 89 | 1.06 → 1.07 s | 115 → 76 ms | **0.217** | 62 → 97 | 1.28 s |

First-load JS (gzip):

| Route | Before | After |
| --- | --- | --- |
| `/` | 332.9 kB | **306.9 kB** |
| `/product` | 302.7 kB | 219.9 kB |
| `/features/multi-company` | 302.7 kB | 262.3 kB |
| `/faq` | 302.7 kB | 201.7 kB |
| `/how-it-works`, `/features/agent-learning`, `/ai-tools/claude-code`, `/use-cases/software-development` | 302.7 kB | 199.2 kB |

- **The homepage is 306.9 kB against the ~200 kB target.** About 128 kB is the framework floor, about
  18 kB is sonner and TanStack Query from the root layout (unused by marketing), about 50 kB is Radix,
  next/image and helpers, about 95 kB is `motion` plus every homepage island hydrating on load.
- Recommendations to close the gap: move `QueryProvider` and `<Toaster />` out of the root layout;
  `LazyMotion` + `m` (estimated 15 to 25 kB); hydrate below-the-fold islands on visibility; render the
  office-alive story once instead of twice (the homepage HTML is 793 kB raw, 84 kB gz, about 380 kB of
  it four office SVGs).
- CLS is 0.000 on every marketing route, mobile and desktop.
- Hero rAF check (production, 1440x900, calls per 3 s): in view and playing 261, scrolled offscreen
  **0**, back in view 238, simulated hidden tab **0**, paused **0**.

### Responsive QA

`apps/web/scripts/responsive-sweep.mjs`: 20 routes x 6 widths (375, 390, 768, 1024, 1440, 1920) =
120 page loads, 0 failures (`qa/responsive-results.json`). Checked per load: no horizontal overflow,
no console or page errors, no failed requests, no hydration warnings, alt on every image, one h1,
visible focus on the first five Tab stops, target size at 390.

### Remaining issues

| # | Issue | Evidence | Suggested action |
| ---: | --- | --- | --- |
| 1 | Homepage first-load JS 306.9 kB vs ~200 kB target | `performance-results.md` §3 | Recommendations 1 to 4 above |
| 2 | Mobile homepage is long: the 390 full-page capture is 23,325 px tall (14 sections) | `screenshots/responsive/home-390-full.png` (measured with `sips`) | Trim or collapse sections on small screens |
| 3 | Hero employee targets about 12x17 CSS px at 390; pass 2.5.8 only through the spacing exception | `accessibility-review.md` §4 | Larger invisible hit area on small screens |
| 4 | Integrations screenshot is 2400x3050 (portrait) and is the mobile LCP on `/ai-tools/claude-code` (3.28 s) | `performance-results.md` §7 item 5 | Cropped landscape capture of the provider cards |
| 5 | `/demo` mobile CLS 0.217 (demo office grid reflows after data loads) | `lighthouse-summary.md` | Reserve height or sized skeleton |
| 6 | App QA items 2, 3, 5 skipped (simulated events not tagged in the feed; no `WORKING` event; truncated canvas labels) | `app-alignment-report.md` | Behavioural changes for the orchestration and office owners |
| 7 | `02-auth` duplicate-email spec hard-codes origin `http://localhost:3000`; fails on :3100 and :3200 | `qa/e2e-full-run.log` | Derive the origin from `E2E_BASE_URL` |
| 8 | better-auth rate limiter (production only) breaks a single full e2e run against `next start` | `performance-results.md` §9 | Test-only rate-limit config or per-file runs |
| 9 | Toaster and React Query providers sit in the root layout, so marketing pays about 18 kB for them | `apps/web/src/app/layout.tsx` | Move into `(app)`, `(auth)`, `demo`, `onboarding` layouts |
| 10 | Dev-only `/dev/components` route ships in the tree; it calls `notFound()` in production and is `noindex` | `apps/web/src/app/(marketing)/dev/components/page.tsx` | Keep or delete before launch |
| 11 | Relevance AI uses the same Sora + Inter pairing (at Sora 400, -0.05em) | `competitor-research.md` finding 5 | Keep Sora 600/700 with -0.02 to -0.03em; recorded as a known risk |
| 12 | No SVG logo; raster PNGs only, interim live-text wordmark on navy | `logo-assets.md` | Commission vector sources and lockups |
| 13 | Lighthouse `heading-order` on `/` desktop and `/demo` mobile | `lighthouse-summary.md` | Fix heading levels |
| 14 | Hero is hydrated with the page, not split with a dynamic import; INP not measured | `motion-guidelines.md` §8, `performance-results.md` §8 | Measure INP on a real device first |
| 15 | Turbopack traces the whole project from `src/server/services/tasks.ts` and `packages/core/src/env.ts` | `performance-results.md` §2 | `turbopackIgnore` before a standalone or serverless deploy |

---

## Research

### Competitors studied

20 sites, inspected 2026-11-02, each captured at 1440 above the fold, 1440 full page and 390 (60
screenshots), with hero typography read from computed styles.

| Group | Sites |
| --- | --- |
| AI workforce and agent platforms | Relevance AI, Lindy, CrewAI, AutoGen, n8n, Gumloop, Relay.app, Zapier, Dify, Langflow |
| Virtual office | Gather, Kumospace, Spatial |
| Premium SaaS | Linear, Vercel, Raycast, Notion, Framer, Stripe, Attio |

Caveats: **Relay.app has shut down** (September 2026); only its shutdown notice was captured.
**Spatial** is now a branded 3D worlds and games studio, not a virtual office; it is a negative
reference. **AutoGen** redirects to a documentation site, not marketing. Authenticated product UIs
were not inspected for any site. 18 of 20 pages lean on proof walls (logos, metrics, ratings), which
Agentopia cannot use.

### Best component inspirations

From `docs/design/component-inspiration.md` §1.

| # | Pattern | Source sites | Agentopia version |
| ---: | --- | --- | --- |
| 1 | Animated workflow diagram (product's own model as the visual) | n8n, Attio, Relevance AI | `WorkflowAnimation`, `ManagerDelegationDiagram` |
| 2 | Real product fragment, large and legible | Linear, Gumloop, Attio, Lindy | `ScreenshotFrame` with the 16 captures |
| 3 | Interactive feature tabs | Dify, Lindy, Gather, Relevance AI, Raycast | `FeatureShowcaseTabs` (no auto-rotation) |
| 4 | Sticky storytelling | Lindy, n8n, Attio | `OfficeAliveStory` |
| 5 | Floating panel and activity line | Gather, Linear, CrewAI, Kumospace | Hero employee popover |
| 6 | Step lines inside a demo | Raycast, Lindy, Framer | Hero event feed in `describe.ts` wording |
| 7 | Bento with miniature real UI | Stripe, Notion, Gumloop | `BentoFeatureGrid` |
| 8 | Honest integration diagram (instead of a logo wall) | Relevance AI, n8n, Langflow, Lindy (walls, rejected) | `IntegrationShowcase`: web + worker, local runner, your own CLI sign-in |

### Design direction selected

Three directions were scored on eight criteria (1 to 5): A "Living AI Office" 22, B "Premium AI
Command Center" 32, C "Editorial Future Workspace" 32.

**Selected: B blended with A, with two borrowings from C.** B and C tie, but both score low on
distinctiveness, the one thing only A delivers (A 5, C 4, B 2). No inspected site shows a team of AI
employees working together in a place. So B is the system (navy, real product fragments, honest
labels, accessible and fast), A supplies one element (the scripted, labelled office in the hero and
on the virtual-office page), and C supplies typographic confidence and asymmetric layouts. Rejected
from A: scroll-driven camera pans, ambient motion outside the hero, rooms as navigation.

### Source references

- `docs/design/competitor-research.md`
- `docs/design/component-inspiration.md`
- `docs/design/motion-references.md`
- `docs/design/design-directions.md`
- `docs/design/frontend-refactor-plan.md`
- `docs/design/agentopia-brand-system.md`
- `docs/design/marketing-information-architecture.md`
- `docs/design/seo-strategy.md`
- `docs/design/capability-audit.md`
- `docs/design/app-alignment-report.md`
- `docs/design/motion-guidelines.md`
- `docs/design/accessibility-review.md`
- `docs/design/performance-results.md`
- `docs/design/logo-assets.md`

---

## Artifacts

### HTML research artifact

`artifacts/agentopia-frontend-refactor/index.html` (with `assets/app.js`, `assets/styles.css`,
`assets/data.json`, `assets/brand/`). Rebuild it from the docs, source and screenshots with:

```
node artifacts/agentopia-frontend-refactor/scripts/build-artifact.mjs
```

The script has no dependencies, checks every screenshot path on disk and lists missing ones.

### Screenshot directories

PNG counts from `find artifacts/agentopia-frontend-refactor/screenshots/<dir> -name '*.png'`;
625 in total.

| Directory | PNGs | Contents |
| --- | ---: | --- |
| `screenshots/app/` | 160 | `before/` 78 and `after/` 78 (app alignment walk), plus 4 loose reference captures |
| `screenshots/artifact/` | 2 | the HTML artifact at 1440 and 390 |
| `screenshots/competitors/` | 60 | 20 sites x 3, plus `_capture-log.json` and `_typography.json` |
| `screenshots/final/` | 4 | final hero, FAQ and artifact captures |
| `screenshots/hero/` | 50 | hero scenes and states |
| `screenshots/home/` | 49 | homepage sections |
| `screenshots/pages/` | 57 | marketing pages |
| `screenshots/product/` | 13 | 1440 copies of the product screenshots |
| `screenshots/responsive/` | 162 | 20 routes x 8 (six widths plus full page at 390 and 1440), plus mobile menu open and hero popover open |
| `screenshots/viz/` | 68 | viz components |

### Component documentation

- Brand system and component inventory with props: `docs/design/agentopia-brand-system.md` §8.
- JSDoc comments on the marketing primitives and page compositions (for example
  `apps/web/src/components/marketing/primitives/screenshot-frame.tsx` and the homepage section order in
  `apps/web/src/app/(marketing)/page.tsx`).
- A dev-only showcase at `/dev/components` (returns 404 in production).

### Local preview

- `pnpm dev:web` serves the app on http://localhost:3000 by default.
- This session ran `next dev -p 3100` with `APP_URL=http://localhost:3100`, because :3000 was occupied
  by another project.
- Production: set `APP_URL` to the public URL **at build time** (`SITE_URL` is baked into the static
  pages, canonical, OG and sitemap), then run
  `pnpm --filter @agentopia/web build && pnpm --filter @agentopia/web start`.

### Verified file paths

Each path below was checked on disk when this report was written.

- `docs/design/frontend-refactor-plan.md`
- `docs/design/agentopia-brand-system.md`
- `docs/design/competitor-research.md`
- `docs/design/component-inspiration.md`
- `docs/design/design-directions.md`
- `docs/design/motion-references.md`
- `docs/design/motion-guidelines.md`
- `docs/design/marketing-information-architecture.md`
- `docs/design/seo-strategy.md`
- `docs/design/capability-audit.md`
- `docs/design/app-alignment-report.md`
- `docs/design/accessibility-review.md`
- `docs/design/performance-results.md`
- `docs/design/logo-assets.md`
- `apps/web/src/app/(marketing)/layout.tsx`
- `apps/web/src/app/(marketing)/page.tsx`
- `apps/web/src/app/(marketing)/dev/components/page.tsx`
- `apps/web/src/app/not-found.tsx`
- `apps/web/src/app/sitemap.ts`
- `apps/web/src/app/robots.ts`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/globals.css`
- `apps/web/src/app/demo/layout.tsx`
- `apps/web/src/lib/seo.ts`
- `apps/web/src/proxy.ts`
- `apps/web/src/content/marketing/routes.ts`
- `apps/web/src/content/marketing/screenshots.ts`
- `apps/web/src/components/marketing/primitives/index.ts`
- `apps/web/src/components/marketing/viz/lazy.tsx`
- `apps/web/src/components/marketing/hero/hero-office-experience.tsx`
- `apps/web/src/components/marketing/office/office-floor-svg.tsx`
- `apps/web/src/components/marketing/chrome/marketing-navbar.tsx`
- `apps/web/src/components/marketing/sections/office-alive-story.tsx`
- `apps/web/src/components/marketing/templates/visual-slot.tsx`
- `apps/web/src/components/brand/logo.tsx`
- `apps/web/src/hooks/use-api.ts`
- `apps/web/src/components/tasks/approval-actions.tsx`
- `apps/web/e2e/12-marketing-site.spec.ts`
- `apps/web/scripts/marketing-shots.mjs`
- `apps/web/scripts/a11y-sweep.mjs`
- `apps/web/scripts/responsive-sweep.mjs`
- `apps/web/scripts/screenshots.mjs`
- `apps/web/scripts/live-shots.mjs`
- `apps/web/public/marketing/screenshots/`
- `apps/web/public/brand/`
- `artifacts/agentopia-frontend-refactor/index.html`
- `artifacts/agentopia-frontend-refactor/scripts/build-artifact.mjs`
- `artifacts/agentopia-frontend-refactor/scripts/competitor-shots.mjs`
- `artifacts/agentopia-frontend-refactor/scripts/competitor-type.mjs`
- `artifacts/agentopia-frontend-refactor/qa/lighthouse-summary.md`
- `artifacts/agentopia-frontend-refactor/qa/axe-results.md`
- `artifacts/agentopia-frontend-refactor/qa/axe-results-before.md`
- `artifacts/agentopia-frontend-refactor/qa/e2e-full-run.log`
- `artifacts/agentopia-frontend-refactor/qa/keyboard-check.mjs`
- `artifacts/agentopia-frontend-refactor/qa/responsive-results.json`
- `artifacts/agentopia-frontend-refactor/qa/build-output.txt`

---

## Remaining work

### Completed

- Brand tokens, typography, logo components and button variants (`agentopia-brand-system.md`).
- 19 marketing routes, branded 404, marketing layout, navbar with keyboard menus, mobile sheet,
  footer, breadcrumbs.
- 64 marketing component files across primitives, viz, hero, office, chrome, sections and templates.
- Hero office experience with six scenes, controls, popovers, offscreen and hidden-tab pause, and a
  reduced-motion path.
- SEO: metadata builder, canonical, OG/Twitter, sitemap (20 URLs), robots, JSON-LD, crawlable FAQ.
- 16 product screenshots (PNG + WebP) and the generated manifest.
- App alignment (21 screen changes) with 78 before and 78 after captures.
- axe sweep from 94 serious nodes to 0; 45 keyboard checks; 120-load responsive sweep with 0 failures.
- Lighthouse before/after; first-load JS cut on every measured marketing page.
- Approval-toast race fixed and verified on dev and production.
- HTML research artifact and rebuild script.

### Partially completed

- Homepage JS: reduced from 332.9 to 306.9 kB, still above the ~200 kB target.
- Production e2e: 39/41 before the toast fix, spec 06 passing after it; no single clean end-to-end
  production run because of the rate limiter and the :3000-origin spec.
- Accessibility: automated and keyboard checks pass on Chromium, light theme; no conformance claim
  until screen-reader passes are done.
- Logo: raster PNGs used correctly, with an interim live-text wordmark on navy.
- App QA list: items 1 and 4 fixed; 2, 3 and 5 skipped.

### Blocked

- SVG logo and lockups: need vector sources from the brand owner (`logo-assets.md`).
- Final canonical, OG and sitemap URLs: need the public production origin for `APP_URL` at build time.
- `02-auth` duplicate-email spec on this machine: :3000 belongs to another project; needs the spec to
  read its origin from `E2E_BASE_URL`, which is outside this refactor's scope.
- Removing the root-layout providers: touches the authenticated app shell (contract rule 0.9); needs
  the app owner.
- Better-auth rate limiting in production tests: auth config is off-limits under contract rule 0.1.

### Not started

- `LazyMotion` + `m` and visibility-based hydration of below-the-fold homepage islands.
- Rendering the office-alive story once (or reusing SVG furniture) to cut homepage HTML.
- Shorter mobile homepage.
- Larger hero tap targets at 390.
- Cropped landscape integrations screenshot.
- `/demo` grid height reservation to remove CLS 0.217.
- `heading-order` fixes on `/` and `/demo`.
- VoiceOver and NVDA passes; Firefox and Safari; forced colours; 200% and 400% zoom; app dark-theme
  sweep.
- INP measurement on a real device; field Core Web Vitals after deploy.
- Rich Results Test and Schema Markup Validator runs.
- Legal pages (none exist; footer intentionally has no legal links).
- Decision on keeping or deleting `/dev/components`.
- Commit, review and deploy.

---

## Discrepancies between docs and how they were resolved

| Topic | What differed | Resolution |
| --- | --- | --- |
| "20 routes" | The sitemap has 20 URLs, but one is the pre-existing `/demo`; 19 marketing pages were new | Reported as 19 new routes + the 404 = 20 created; `/demo` listed as redesigned |
| Product screenshots | 16 PNGs in `public/marketing/screenshots/`, 13 in `artifacts/agentopia-frontend-refactor/screenshots/product/` | Both correct: the artifact folder holds only the 1440 captures (3 are 390) |
| App screenshots | Alignment report says 78 per walk; the `app/` folder holds 160 | 78 + 78 plus 4 loose reference captures at the folder root |
| Responsive screenshots | 120 loads vs 162 files | 160 = 20 routes x 8 captures (six widths + two full pages), plus 2 interaction states |
| e2e spec 12 | Reported as 10/10, file has 9 tests | The mobile test runs in both Playwright projects |
| Lighthouse accessibility | `performance-results.md` says 100 everywhere except `/` desktop; `lighthouse-summary.md` also shows `/demo` mobile at 98 | Reported both from the summary table |
| Hero performance trace | `motion-guidelines.md` §8 says no trace was recorded | Superseded by the rAF measurements in `performance-results.md` §5 |
| Unit test counts | `app-alignment-report.md` cites 57 tests in 7 files; later docs cite 82 | 57 was a subset (office and server); 82 in 9 files re-run for this report |
| Production e2e result | §9 table shows 39/41 with 06 failing; §9.1 shows 06 fixed | Reported both, in order; full suite not re-run after the fix |

---

## Revision 1 (owner feedback)

Owner feedback: use gold much more; no white components anywhere (the light office floor inside
frames is fine); remove sections that repeat each other, keep "The office comes alive".

### What changed
- **Tones.** `Section` tones are now `navy`, `raised` (navy-800) and `deep` (new token
  `navy-950` #0C0E1C; `navy-600` #2E3852 added for panels on raised). `paper` is a deprecated
  alias that renders `deep`. Every section, band, panel and viz surface on the marketing site is
  dark; viz `surface` is now `"dark" | "raised"` (no light palette). `SectionHeading` is always
  light on dark.
- **Gold system.** New `Button` variants `gold` and `outline-gold`. Secondary CTAs (hero, final
  CTA, every ConversionCta) are gold; primary stays violet. Gold 40×3 rule above every section
  heading and detail band heading (optional gold `kicker`). Gold markers (Stepper, office beats,
  learning stages, step lists, how-it-works sequence): current = gold disc + navy number, others
  gold outline. Gold check/feature icons, list dots, inline links, breadcrumb current page, footer
  headings, FAQ chevrons and open question. Active tabs and role selector items are gold pills with
  navy text. Lead grid cards carry a 2 px gold top border; linked cards hover to gold/60. Pills:
  in progress = gold fill, waiting = gold outline. ScreenshotFrame chrome is navy-700 with a gold
  active dot. ConversionCta (raised) and the final CTA have a soft gold radial light (<= 0.18).
  Office scenes: lamp pools 20% larger and warmer (gold into gold-deep), gold active-room outline,
  gold status pill for "In progress". Hero play/replay controls are `outline-gold`.
- **Homepage trim.** Removed Explainer, "One task, many specialists" and "How it works"; their
  section files became unused and were deleted (`explainer-section.tsx`, `delegation-section.tsx`,
  `how-it-works-section.tsx`). The hero trust line now ends with a gold "See how it works" link.
  Oversight lost its screenshot (two-column list with gold icons, tight padding). FAQ shows the
  first 6 questions plus a gold "See all questions" link.
- **Detail pages.** Header navy; bands cycle deep, raised, navy, raised; the closing band (related
  links + raised CTA with gold light) is deep or navy, never raised. `/faq`, `/how-it-works`
  sequence, index pages and `/about` follow the same system.

### Homepage sections (11)
1 Hero (navy) · 2 Meet your AI workforce (raised) · 3 The office comes alive (navy) ·
4 Agents that learn over time (deep) · 5 Create multiple AI companies (raised) ·
6 Built around your AI tools (deep) · 7 Human oversight and control (raised) ·
8 The product, up close (navy, the only screenshot section) · 9 Use cases (deep) ·
10 Questions, answered (navy) · 11 Final CTA (raised).

### Full-page heights (homepage)
| width | before | after | change |
| --- | --- | --- | --- |
| 390 | 23,325 px | 17,834 px | −5,491 px (−24%) |
| 1440 | 16,524 px | 12,800 px | −3,724 px (−23%) |

### Verification
typecheck and lint pass (0 errors; 5 pre-existing warnings outside marketing); marketing vitest
25/25; `e2e/12-marketing-site.spec.ts` 10/10 against :3100 with no spec changes; zero console
errors across the screenshot run. Screenshots: `artifacts/agentopia-frontend-refactor/screenshots/revision1/`
(pass 1 in `revision1/pass1/`).

## Revision 2 (Hero B adopted)

The owner approved the standalone concept "Hero B" (`artifacts/hero-concept-b/`, previews in
`preview/`) and asked for it as the homepage hero, as is. Hero A (the scripted office demo with
play/pause, stepper and employee popover) is gone from the homepage; the scripted office lives on
in "The office comes alive" and the final CTA backdrop (unchanged, still driven by `hero-script.ts`).

### What changed
- **New hero layout** (`hero/hero-section.tsx`): centred two-line Sora 700 headline ("Build your
  own AI company." snow, "Then watch it work." gold), support paragraph, `gold` "Create your
  company" (`/signup?next=/onboarding`, `data-cta="hero-primary"`), `outline-gold` "Watch the office
  work" (`/demo`, `hero-secondary`), trust line with the gold "See how it works" link. The section
  fills `100svh - 64px` under the real navbar; corner brackets, the gold dashed "Illustration, not a
  live scene" pill (bottom-left) and the legend (bottom-right, hidden <= 560px) are kept from the
  concept. The concept's own top bar is not duplicated.
- **Scene port** (`hero/hero-scene-geometry.ts`, `hero/hero-scene-b.tsx`): a faithful port of
  `scene.js`. The concept recomputes in pixel space on resize; the port evaluates the same maths on
  the server for three canonical sizes (1440x900 wide, 768x1024 tablet, 390x853 phone, stage rects
  measured from the concept with Playwright) and renders each as a fixed-viewBox SVG, swapped by
  CSS at 560/900px. Slicing uses container-query units in CSS (top-bar band cropped first, bottom
  crop capped at 5%, 30/70 horizontal anchor), no JS. Colours are `var(--color-*)` tokens; character
  outfits, skin and hair come from `office/palette.ts`; the owner's shadow tones are navy-to-gold
  mixes computed with `palette.mix`; raw hex remains only in the owner's two gradients.
- **Motion** (`app/globals.css`, "homepage hero (Hero B)"): CSS keyframes only (spotlight breathe
  6 s, lamps 8 s with three steady and two cycling, dash travel on three connectors).
  `hero/hero-motion-gate.tsx` adds `is-paused` / `data-motion="paused"` offscreen (IntersectionObserver)
  and under reduced motion; reduced motion removes all scene animation (three steady lamps lit).
  No `requestAnimationFrame`.
- **Content** (`content/marketing/home.ts`, `types.ts`): `headlineSecond` added; support copy
  from the concept; trust line unchanged (subscription wording still accurate); `visual.label`
  "Illustration" (new `VisualLabel` value) and the concept's visually hidden description as the
  caption.
- **Deleted**: `hero/hero-office-experience.tsx`, `hero/use-hero-timeline.ts` (no other importers).
  Kept: `hero-script.ts`, `hero-script.test.ts`, `office/*`.
- **Tests**: `hero-scene-geometry.test.ts` (12 tests: 14 employees, 5 lamps / 3 steady, pill, tags,
  depth order, lamp stagger, bounds, connectors and feed per layout). `e2e/12-marketing-site.spec.ts`:
  the three Hero A tests are replaced by "two-line headline, illustration pill and both CTAs" and
  "reduced motion: hero scene is paused; office story shows the stepper"; the navbar keyboard test
  now waits for `networkidle` (the lighter page fires `load` before the navbar hydrates).
  `scripts/responsive-sweep.mjs` lost its Hero A popover screenshot step.
- **Docs**: brand system "Hero scene exception"; motion guidelines 4.1, stack table and
  reduced-motion matrix.
- **Deviation from the brief**: three canonical layouts instead of two. Slicing the 390 drawing up
  to 768 doubled the tags and pill (Morgan's pill overlapped the Development group) and cropped the
  HUD, so tablets get the concept's narrow formulas evaluated at 768x1024, which matches the
  concept's own 768 render.

### Measurements
| check | result |
| --- | --- |
| CLS, first 10 s (PerformanceObserver, layout-shift) | 1440x900: 0 (0 shifts); 390x844: 0 (0 shifts) |
| Hero height | 1440x900: 836 px (fills the fold under the 64 px navbar); 390x844: 789 px |
| Trust line bottom (page px) vs concept stage top | 1440: 522 vs 522; 768: 468 vs 468; 1920: 542 vs 542 |
| Full-page height | 390: 17,539 px (was 17,834); 1440: 12,898 px (was 12,800) |
| Scene SVG markup in HTML | 1440: 51.4 KB, 768: 47.7 KB, 390: 46.9 KB raw (146 KB total; whole dev HTML 133 KB gzip) |
| Console errors / hydration warnings | 0 at 375, 390, 768, 1024, 1440, 1920 and 1440 reduced motion |
| Lighthouse mobile (dev server, indicative only) | performance 69, LCP 1.4 s (element: h1 first line), CLS 0, TBT 1,470 ms (dev-mode JS) |

### Verification
typecheck pass; lint 0 errors (5 pre-existing warnings outside marketing); `pnpm vitest run
apps/web/src/components/marketing` 37/37; `e2e/12-marketing-site.spec.ts` + `e2e/01-visitor-demo.spec.ts`
12/12 against :3100 (two consecutive runs). Screenshots:
`artifacts/agentopia-frontend-refactor/screenshots/hero-b/` (`pass1-*`, `pass2-*`, `pass3-*` at
375, 390, 768, 1024, 1440, 1920 and `*-1440-reduced-motion`). The responsive sweep was not run: its
`ONLY` filter is a substring match, so `/` cannot be selected alone.

### Remaining differences vs the concept
- The site navbar (violet "Create your company", Product/Resources menus) replaces the concept's
  top bar, by instruction; corner brackets therefore start below the navbar.
- The pill reads "Illustration, not a live scene" (concept: "Concept B · illustration, ...").
- The scene no longer re-flows continuously: between canonical sizes it scales. At 1920 characters
  and tags are 1.33x the 1440 size (the concept recomputes them at 1.2x there);
  at 1024 the owner's left shoulder is cropped by about 20 px; very tall wide viewports (for example
  1024x1366 portrait tablets in the wide range) crop the sides more than the concept would.
- Skin tone index 3 follows `palette.ts` (#D5DBE7) rather than the concept's #DFE4ED; owner shadow
  tones are token mixes, within a few RGB steps of the concept's values.

## Revision 3 (owner feedback, same day)

- **Hero cast 14 → 12.** The Development cluster read as a crowd, and Daniel's lamp landed on the head of the developer standing behind him. Two developers were removed; Development is now a pair with nobody behind, so the lamp sits over Daniel alone (`hero-scene-geometry.ts`, `GROUPS[dev]`). The sr-only description, the scene comment and the geometry test now say twelve.
- **Homepage 11 → 8 sections.** Learning, Multiple companies and Use cases were taken off the homepage; each still has its own page (`/features/agent-learning`, `/features/multi-company`, `/use-cases`) and stays in the navbar and footer. Order and tones: hero (navy) · workforce (raised) · office comes alive (navy) · AI tools (deep) · oversight (raised) · product up close (navy) · FAQ (deep) · final CTA (raised).
- **Demo / office activity feed scrolls inside its panel.** On the wide layout (container ≥ 1320 px) the side column of `OfficeExperience.tsx` is now absolutely positioned inside its grid cell, so it adds no height of its own: the row is as tall as the floor and the feed scrolls within it instead of stretching the whole page. Measured at 1440×900: page height 900 px (was several thousand once the scripted feed filled). Below 1320 px the feed keeps its 420 px cap and scrolls as before.
- Verified: typecheck clean, marketing unit tests 37/37, e2e spec 12 9/9, captures in `artifacts/agentopia-frontend-refactor/screenshots/revision3/` (hero 1440 and 390, Development crop at 2×, demo 1440 and 1024, full homepage 1440 at 9291 px and 390 at 10806 px).
