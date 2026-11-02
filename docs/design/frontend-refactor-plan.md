# Agentopia frontend refactor: shared contract

Date: 2026-11-02. This file is the single source of truth for every agent working on the
marketing site and frontend refactor. Read it fully before touching code.

## 0. Hard rules

1. Existing app, not greenfield. Do not touch `apps/worker`, `apps/runner`, `packages/core`,
   `packages/db`, auth, API routes, orchestration, `authMode` routing. Never add a paid API fallback.
2. Preserve the approved logo PNGs in `apps/web/public/brand/`. Never redraw the mark. On light
   surfaces use the official lockup image; on dark surfaces use the mark image + a text wordmark
   (the official wordmark is navy and vanishes on navy).
3. Marketing claims must match implemented capabilities (section 5). No testimonials, metrics,
   customer logos, pricing, certifications, or "trusted by" lines. No invented links.
4. Do not commit or push. Do not deploy. Do not install packages beyond those listed in section 8
   without noting it in your report.
5. Never claim a test ran or a screenshot exists unless you ran it / captured it.
6. One animation engine for new work: `motion` (already installed) + CSS + SVG. No GSAP. Pixi stays
   only for the real office (`src/office`).
7. Reduced motion is a first-class path. Every animated component has a static or stepper fallback.
8. Essential copy is server-rendered HTML; canvas/SVG animation is an enhancement.
9. Routes: `/integrations`, `/office`, `/employees`, `/tasks`, `/learning`, `/settings`,
   `/organization` are the authenticated app and must keep working. Marketing uses the routes in
   section 4 only.
10. The Agentopia dev server runs on http://localhost:3100 (`next dev`, hot reload; port 3000 belongs to an unrelated project). Use :3100 for screenshots.
    Do not start another server; do not touch :3000.

## 1. Creative direction (decided)

Blend of Direction B "Premium AI Command Center" (navy, confident type, real product fragments)
with Direction A "Living AI Office" (the top-down office is the one memorable element, gold lamps
mark live work). Not a gaming site. Light surfaces appear in the authenticated app by default and in
screenshot frames; the marketing site is navy-first with white "paper" sections for reading-heavy
content (how it works, FAQ, feature detail). Spend boldness on the office; keep everything else quiet.

Typography: display `Sora` (600/700, tracking -0.02em to -0.03em at large sizes), body `Inter`.
Loaded with `next/font/google` in `src/app/layout.tsx` as `--font-sora` and `--font-inter`.
Keep the Tailwind utility names `font-display` and `font-sans`. Fraunces is removed.
Headlines are sentence case. No all-caps eyebrows. No "→" in button text. No single-word colour
accents in headlines. Numbered markers only for actual sequences.

## 2. Design tokens (contract)

Brand hues (Tailwind `@theme` in `src/app/globals.css`):

| token | hex | use |
| --- | --- | --- |
| `--color-violet` | #7357F6 | primary accent, buttons, links on light, rail active |
| `--color-violet-deep` | #5B3FD9 | hover, text-safe violet on white (6.6:1) |
| `--color-lavender` | #B8A7FF | links and accents on navy (8.7:1), secondary series |
| `--color-gold` | #FFC66D | the lamp: activity, intelligence, progress. Sparingly. Black/navy text on it. |
| `--color-gold-deep` | #E8A93D | gold hover |
| `--color-navy` | #111326 | deep navy: marketing background, rail, text on light |
| `--color-navy-800` | #1B2436 | dark surface |
| `--color-navy-700` | #242D43 | elevated surface |
| `--color-snow` | #F5F7FF | text on dark, light sunken surface |
| `--color-mist` | #A8B4CA | muted text on dark (7.9:1) |
| `--color-success` | #34D399 | success on dark; `--color-success-ink` #0E7A55 on light |
| `--color-danger` | #FB7185 | danger on dark; `--color-danger-ink` #C0314F on light |
| `--color-white` | #FFFFFF | |

Legacy aliases must keep resolving so existing components do not break:
`purple`→violet, `purple-deep`→violet-deep, `black`→navy, `grey`→mist, `ink`→navy,
`parchment`→white, `moss`→success, `brick`→danger, `sky`→violet, `saffron`→gold, `stone-*`→cool
neutral ramp between white and navy (50 #F7F8FC, 100 #EEF1F8, 200 #E3E7F2, 300 #CBD2E1,
400 #A8B4CA, 500 #7D889F, 600 #5B6478, 700 #3A4561, 800 #242D43, 900 #1B2436, 950 #111326).

Semantic CSS variables (same names as today, new values):

Light (default): `--surface` #FFFFFF, `--surface-raised` #FFFFFF, `--surface-sunken` #F5F7FF,
`--text` #111326, `--text-muted` #5B6478 (5.9:1), `--rule` #E3E7F2, `--rule-strong` #B9C1D4,
`--focus` #7357F6, `--chrome` #111326, `--chrome-raised` #1B2436, `--chrome-text` #F5F7FF,
`--chrome-muted` #A8B4CA, `--chrome-rule` #242D43, `--moss-ink` #0E7A55, `--brick-ink` #C0314F,
`--sky-ink` #5B3FD9, `--saffron-ink` #8A5A00, `--moss-wash` #DDF5EA, `--brick-wash` #FFE4E9,
`--sky-wash` #EEEAFF, `--saffron-wash` #FFF3DD, `--lamp-done` #5B3FD9.

Dark (`prefers-color-scheme: dark` unless `[data-theme=light]`, and `[data-theme=dark]`):
`--surface` #111326, `--surface-raised` #1B2436, `--surface-sunken` #0C0E1C, `--text` #F5F7FF,
`--text-muted` #A8B4CA, `--rule` #242D43, `--rule-strong` #3A4561, `--focus` #FFC66D,
chrome same as light, `--moss-ink` #34D399, `--brick-ink` #FB7185, `--sky-ink` #B8A7FF,
`--saffron-ink` #FFC66D, `--moss-wash` #12352B, `--brick-wash` #3D1A23, `--sky-wash` #221C4A,
`--saffron-wash` #3A2E17, `--lamp-done` #B8A7FF.

Marketing sections always render on navy regardless of theme unless they opt into the "paper"
variant (white surface, navy text). Use the utility classes `bg-navy text-snow` and
`bg-white text-navy` directly in marketing components so the marketing site does not flip with the
app theme toggle.

Office (Pixi) palette `src/office/palette.ts`: PURPLE 0x7357f6, GOLD 0xffc66d, GREY 0xa8b4ca,
BLACK 0x111326, WHITE 0xffffff; keep the tint/mix helpers; floor washes stay derived.
`src/components/landing/floor-illustration.tsx` is superseded by the new hero and may be deleted
once nothing imports it.

Radii: sm 6px, md 10px, lg 16px, xl 24px (cards in marketing use lg; buttons use full or md).
Shadows: one soft navy shadow for raised marketing frames
`0 24px 60px -24px rgb(17 19 38 / .45)`. No glassmorphism, no glow halos except the lamp.

## 3. Marketing primitives (owned by the design-system agent, consumed by everyone)

Directory `apps/web/src/components/marketing/primitives/`:

- `container.tsx` `Container` (max-w 1200px, px 16/24/40)
- `section.tsx` `Section` props `{ tone: "navy" | "paper" | "raised"; id; aria-labelledby; padding?: "normal" | "tight" | "none" }`
- `section-heading.tsx` `SectionHeading` props `{ id, title, lead?, align?: "start" | "center", size?: "md" | "lg" }`
- `motion-reveal.tsx` `MotionReveal` (IntersectionObserver fade+8px rise once, disabled under reduced motion; wraps children; `as` prop)
- `screenshot-frame.tsx` `ScreenshotFrame` (browser-ish frame with a caption slot, `src`, `alt`, `width`, `height`, `priority?`, optional `zoom` dialog)
- `pill.tsx` `Pill` (status/label pill; variants `neutral | violet | gold | success | danger | simulated`)
- `demo-badge.tsx` `DemoBadge` ("Scripted demo" / "Illustrative data" label, always visible on scripted visuals)
- `animated-connector.tsx` `AnimatedConnector` (SVG path with stroke-dash travel, props `d`, `active`, `tone`)
- `stepper.tsx` `Stepper` (accessible step list with current index; used as the non-motion alternative)
- `marketing-button.tsx` re-exports `Button` from `@/components/ui/button` with two marketing variants added to `buttonVariants`: `brand` (violet fill, white text) and `outline-light` (snow outline on navy). Add these variants to `src/components/ui/button.tsx` itself.

All primitives: server components unless they need state; typed props; `className` passthrough;
keyboard and focus-visible styles; no inline hex (use tokens).

## 4. Routes and ownership

Marketing route group `apps/web/src/app/(marketing)/` with its own `layout.tsx`
(MarketingNavbar + MarketingFooter + skip link + JSON-LD Organization/WebSite). Move the current
`src/app/page.tsx` into `(marketing)/page.tsx`.

| route | page |
| --- | --- |
| `/` | homepage |
| `/product` | product overview |
| `/how-it-works` | six-step walkthrough |
| `/features/ai-employees` | employee profile: prompt, skills, knowledge, track record |
| `/features/ai-manager` | planning, delegation, review |
| `/features/virtual-office` | the office, events to animation, list view, floors |
| `/features/agent-collaboration` | subtasks, handoffs, review loops |
| `/features/agent-learning` | learning schedules, sources, approval, memory, progression |
| `/features/multi-company` | building, floors, companies, isolation |
| `/ai-tools` | runtimes overview: Claude Code, Codex, local runner, API-key mode |
| `/ai-tools/claude-code` | Claude Code detail |
| `/ai-tools/codex` | Codex detail |
| `/use-cases` | index |
| `/use-cases/software-development`, `/use-cases/marketing`, `/use-cases/research`, `/use-cases/quality-assurance` | detail |
| `/faq` | FAQ with FAQPage JSON-LD |
| `/about` | what Agentopia is, principles (real vs simulated), no team bios |
| `not-found.tsx` | branded 404 (root `src/app/not-found.tsx`) |
| `sitemap.ts`, `robots.ts` | root `src/app/` |

No `/pricing`, `/blog`, `/docs`, `/contact` (no billing, content pipeline, docs site, or contact
destination exists). `src/proxy.ts` PUBLIC_PREFIXES must include every marketing prefix above plus
`/sitemap.xml`.

Copy lives in `apps/web/src/content/marketing/*.ts` (typed objects), pages compose components with
that data. Site config (name, URL from `process.env.APP_URL`, default OG) in `src/lib/seo.ts` with
`buildMetadata()` and JSON-LD helpers.

Component directories:
- `components/marketing/chrome/` navbar, mobile nav, footer
- `components/marketing/hero/` HeroOfficeExperience and its script/engine
- `components/marketing/viz/` product visualisation components (workflow, learning journey, building, agent card, timeline, integration showcase, office spotlight, feature tabs)
- `components/marketing/sections/` composed homepage/page sections
- `components/marketing/primitives/` see section 3

## 5. Capability classification (source: docs/final-report.md, docs/design-research.md, code)

Implemented: accounts; building → floors → companies (multi-company, isolation tested);
hire from six role templates (management, frontend, backend, UI/UX, QA, research) and edit anything;
eleven-field versioned prompts with rollback; skills with proficiency vs demonstrated;
knowledge (instructions, project documents, learned notes awaiting approval); manager planning into
subtasks with dependencies and best-fit assignment; execution lifecycle with approvals for risky
actions, cancel, retry, attempt limits, timeouts; review by QA/manager against definition of done;
artifacts and summary; usage records with provenance (provider-reported vs estimated vs
unavailable); task timeline of persisted events; live office animated from those events (Pixi),
list view, reduced motion; twice-weekly learning schedules from allowlisted docs and GitHub repos
with change detection, zero/low-token modes and caps, approval-gated verified memory, full-text
retrieval with citations; evidence-based rank progression with owner override; Claude Code and
OpenAI Codex execution through the local runner using the user's own CLI sign-in (subscription
mode, default) or an explicit API key (billed separately, acknowledged); usage-limit manager that
parks tasks and resumes after provider-reported reset; visitor demo at `/demo` (scripted, labelled).

Partially implemented / caveats: password-reset email is logged, not sent; live API-key-mode runs
were verified only with recorded SDK streams; learning USD cost null unless pricing configured.

Unsupported (state plainly when relevant): hosted execution with a consumer subscription; any
claude.ai or ChatGPT login inside Agentopia; automatic model retraining; subscription quota
visibility (shown as unavailable); marketplace; billing; human multiplayer office.

Illustrative roles on the site (Developer, Designer, Researcher, QA, Marketing specialist) map to the
six templates; say they are examples, and that Marketing is a configured role, not a preset template.

## 6. Hero specification (highest priority)

Headline: "Build your own AI company." Support: "Hire AI employees, give them an office, and hand
the manager a task. Watch the work move from desk to desk, then review what they built."
Primary CTA "Create your company" → `/signup?next=/onboarding`. Secondary "Watch the office work" →
`/demo`. Trust line: "Works with Claude Code and OpenAI Codex through your own sign-in. Nothing runs
on a model until you connect one."

Right side: `HeroOfficeExperience`, a scripted, clearly labelled demo (DemoBadge "Scripted demo")
of the real floor plan (`DEFAULT_ROOMS` from `@agentopia/shared`, 40×24 tiles) drawn in SVG with DOM
overlays. Six scenes on a ~24 s timeline: task arrives → manager plans and delegates (connectors) →
researcher, designer, developer start (lamps on, status pills) → handoff (researcher → designer →
developer) → review (artifact travels to manager) → delivery (task completed, deliverable preview,
small success beat). Side column shows the running event feed in the product's own words
(same phrasing as `src/office/describe.ts`). Controls: play/pause, replay, scene stepper; pauses
when offscreen or tab hidden; reduced motion renders the final frame with the stepper for manual
scene changes; clickable employees open a small popover with name, role, skills, provider, state.
Rendering budget: no continuous rAF when paused; prefer CSS/`motion` transforms and opacity.
Static first paint must match the final layout (no CLS). Mobile: office on top (full width, aspect
locked), feed collapses to the latest three lines.

## 7. Analytics, privacy

No analytics exists. Do not add any. Add `data-cta="hero-primary"` style attributes on main CTAs so
tracking can be attached later without markup changes.

## 8. Allowed additions

devDependencies in `apps/web`: `@axe-core/playwright`, `lighthouse` (run through the Playwright
chromium binary). Nothing else without a stated reason.

## 9. Verification commands

`pnpm --filter @agentopia/web typecheck`, `pnpm --filter @agentopia/web lint`,
`pnpm vitest run apps/web` (unit), `pnpm --filter @agentopia/web test:e2e` (needs dev server +
worker; the worker may not be running, so run only the specs you changed). Screenshots go to
`artifacts/agentopia-frontend-refactor/screenshots/<area>/<name>-<width>.png`.
