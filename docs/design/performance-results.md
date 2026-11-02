# Performance results: marketing site (production build)

Date: 2026-11-02. Author: performance pass of the frontend refactor.
Raw data: `artifacts/agentopia-frontend-refactor/qa/` (`build-output.txt`, `build-output-before.txt`,
`lighthouse-summary.md`, `lighthouse/*.json|html`).

> **All numbers are lab measurements on localhost.** TTFB is about 10 ms, there is no CDN, and
> Lighthouse's throttling is simulated. Production hosting will add real network latency, TLS
> and server time. Use these numbers to compare before and after, not as a forecast of field
> Core Web Vitals.

## 1. Method and environment

* **Build:** `APP_URL=http://localhost:3200 pnpm --filter @agentopia/web build` (Next.js 16.4.3,
  Turbopack). In Next 16, `next dev` writes to `.next/dev` and `next build` writes to `.next`, so the
  build ran beside the live dev server on :3100 without touching it (see `docs/01-app/03-api-reference/06-cli/next.md`,
  "Development builds output to `.next/dev`"). The packages need no build step (no `dist`; they are
  transpiled through `transpilePackages`).
* **Server:** `next start -p 3200` with `APP_URL=http://localhost:3200`, so canonical, OG and sitemap
  URLs resolve to :3200. The shared worker, Postgres and Redis were running.
* **Lighthouse 13.6** (added as an `apps/web` devDependency, allowed by contract §8). It ran the
  Playwright Chromium binary (`chromium-1248`) with `--headless=new`, mobile (default) and
  `--preset=desktop`, with the categories performance, accessibility, best-practices and SEO. There
  was one run per page and preset, plus two repeat runs of `/` and `/demo` to check variance (±1
  perf point).
* **First-load JS:** Next 16 no longer prints a "First Load JS" column in the build table, so I
  measured it in two ways:
  1. Sum of gzip-9 sizes of every `<script src>` in the prerendered HTML, excluding the `noModule`
     polyfill chunk (38.6 kB gz, which modern browsers skip).
  2. In Chromium (Playwright), the gzip size of every JS chunk the page actually loads, with RSC
     prefetch requests blocked so that `<Link>` prefetching of other routes is not counted. This
     includes lazily loaded chunks that hydrate SSR'd `next/dynamic` components. It is the number
     reported as "first-load JS" below.
* **rAF check:** Playwright wraps `window.requestAnimationFrame` in an init script and counts calls
  over 3 s in each state.

## 2. Build result

The build passed on the first attempt: no type errors, no server/client boundary errors, and no
`generateStaticParams` issues. All marketing routes prerender as static: `/`, `/product`,
`/how-it-works`, `/faq`, `/about`, `/ai-tools`, `/ai-tools/claude-code`, `/ai-tools/codex`,
`/use-cases` and `/opengraph-image.png`, `/sitemap.xml`, `/robots.txt` are `○`; `/features/[slug]`
(6 paths) and `/use-cases/[slug]` (4 paths) are `●` SSG. `/demo` and the authenticated app routes are `ƒ`
(dynamic), as expected.

Build warnings:

* `metadataBase property ... is not set`. It came from routes that do not call `buildMetadata`
  (auth, onboarding, dev). It is **fixed**: the root layout now sets `metadataBase: new URL(SITE_URL)`.
  The final build has no metadata warnings.
* Three Turbopack "dynamic filesystem access causes tracing of the whole project" warnings in
  `src/server/services/tasks.ts` and `packages/core/src/env.ts`. These are outside marketing scope
  (core and server services are off-limits under contract §0). They only matter for
  standalone/serverless output size. They are listed under recommendations.

## 3. First-load JS per route (gzip)

| Route | Before | After | Change |
|---|---|---|---|
| `/` | 332.9 kB | **306.9 kB** | −26.0 kB (−8%) |
| `/product` | 302.7 kB | **219.9 kB** | −82.8 kB (−27%) |
| `/how-it-works` | 302.7 kB | **199.2 kB** | −103.5 kB (−34%) |
| `/features/agent-learning` | 302.7 kB | **199.2 kB** | −103.5 kB (−34%) |
| `/features/multi-company` (renders the building preview) | 302.7 kB | **262.3 kB** | −40.4 kB |
| `/ai-tools/claude-code` | 302.7 kB | **199.2 kB** | −103.5 kB (−34%) |
| `/use-cases/software-development` | 302.7 kB | **199.2 kB** | −103.5 kB (−34%) |
| `/faq` | 302.7 kB | **201.7 kB** | −101.0 kB (−33%) |
| `/login` (reference) | n/a | 216.2 kB (scripts in HTML) | |

The before column is method 1 (the baseline had no lazy chunks, so its script tags were
everything it loaded). The after column is method 2.

**The homepage is still above the ~200 kB target (306.9 kB).** What it loads:

| Part | gz kB | Notes |
|---|---|---|
| react-dom + Next router/runtime + Turbopack runtime | ~128 | Framework floor; `/login` pays it too |
| Root-layout providers: sonner (Toaster) + TanStack Query | ~18 | Marketing uses neither (see recommendation 1) |
| Radix (navigation menu, dialog, remove-scroll, slot), next/image, tailwind-merge, lucide | ~50 | Navbar, ScreenshotFrame zoom dialog |
| `motion` + hero, office-alive story, feature tabs, building preview, role selector, delegation diagram | ~95 | Every island on the homepage hydrates on load |
| Hero script and event phrasing | ~13 | |

Getting below 200 kB would need the structural changes in recommendations 1 to 3. Each touches
files owned by other agents or the authenticated app, so this pass did not make them.

## 4. Lighthouse (lab, localhost)

Full tables, including desktop, are in `artifacts/agentopia-frontend-refactor/qa/lighthouse-summary.md`.

### Mobile (simulated slow 4G, 4x CPU)

| Route | Perf before → after | LCP before → after | TBT before → after | CLS | LCP element |
|---|---|---|---|---|---|
| `/` | 92 → **97** | 2.44 s → **1.51 s** | 127 → 182 ms | 0 | hero support paragraph (text) |
| `/product` | 88 → **96** | 3.93 s → **2.79 s** | 36 → 30 ms | 0 | office screenshot (preloaded) |
| `/how-it-works` | 100 → 100 | 1.21 s → 1.21 s | 57 → 26 ms | 0 | h1 |
| `/features/agent-learning` | 100 → 100 | 1.21 s → 1.21 s | 68 → 89 ms | 0 | h1 |
| `/ai-tools/claude-code` | 83 → **92** | 4.69 s → **3.28 s** | 102 → 36 ms | 0 | integrations screenshot (preloaded) |
| `/use-cases/software-development` | 100 → 100 | 1.21 s → 1.21 s | 73 → 63 ms | 0 | h1 |
| `/faq` | 99 → 100 | 1.21 s → 1.21 s | 111 → 86 ms | 0 | h1 |
| `/demo` | 88 → 89 | 1.06 s → 1.07 s | 115 → 76 ms | **0.217** | feed empty-state text |

### Desktop

All marketing routes score 100 for performance both before and after. LCP is 0.33 to 0.70 s, TBT
is 0 ms and CLS is 0. `/demo` went from 62 to 97 (TBT 855 to 42 ms). The `/demo` script set did not
change between builds (216 kB in both), so I treat the baseline as a cold single-run outlier (for
example, the first Pixi/texture initialisation), not as a result of these changes.

Accessibility is 100 on every marketing route after the parallel accessibility fixes, except `/`
desktop (99, `heading-order`). Best practices and SEO are 100 everywhere.

## 5. What changed and the measured effect

| # | Change | Files | Effect |
|---|---|---|---|
| 1 | `"sideEffects": false` on `@agentopia/shared`. Marketing imports only `enums`, `office`, `roles`, `provider-status`. Without the flag, the `export *` barrel kept `api.ts`, `events.ts`, `prompt.ts` and `settings.ts` (all zod schemas) in the client bundle. | `packages/shared/package.json` | zod (31 kB gz) left every marketing page. App routes that validate with zod still get it. |
| 2 | `"sideEffects": ["**/*.css"]` on `@agentopia/web`. The only bare side-effect imports in `src/` are two CSS files, which are kept. This lets Turbopack drop unused re-exports of the `viz` and `primitives` barrels. | `apps/web/package.json` | With #1: `/` 332.9 → 301.5 kB, other marketing pages 302.7 → 265.8 kB. |
| 3 | `viz/lazy.tsx`: a `"use client"` module that wraps `AgentRoleSelector`, `FeatureShowcaseTabs` and `MultiFloorBuildingPreview` in `next/dynamic` (SSR kept). `VisualSlot` uses these and imports the server viz from their own files instead of the barrel. Reason: every detail, FAQ and index template imports `VisualSlot`, and `VisualSlot` can render any viz, so all viz client components plus `motion` were in every marketing page's bundle. `next/dynamic` does not split when called from a Server Component (Next docs, lazy-loading guide), hence the client wrapper. | `src/components/marketing/viz/lazy.tsx` (new), `src/components/marketing/templates/visual-slot.tsx` | Pages that render no interactive viz: 265.8 → 199.2 kB. Pages that render one load only that chunk (`/product` 219.9, `/features/multi-company` 262.3). Verified in Chromium: no console or hydration errors; tabs and the building floor switcher respond. |
| 4 | `metadataBase: new URL(SITE_URL)` in the root layout metadata (allowed by seo-strategy §7). | `src/app/layout.tsx` | The build warning is gone. Pages without `buildMetadata` (login, dev) now resolve `og:image` against `APP_URL`, not a hard-coded `localhost:3000`. |
| 5 | Added `lighthouse` devDependency. | `apps/web/package.json`, `pnpm-lock.yaml` | Tooling only. |

Measured Lighthouse effect (mobile): `/` LCP 2.44 → 1.51 s (perf 92 → 97); `/product` LCP 3.93 → 2.79 s
(88 → 96); `/ai-tools/claude-code` LCP 4.69 → 3.28 s (83 → 92). On the screenshot pages, the
preloaded LCP image no longer competes with 80–100 kB of unneeded JS on the simulated slow link.

### Checked and left as is (with evidence)

* **Hero LCP:** the LCP element is text: the `h1` "Build your own AI company." on desktop and the
  support paragraph on mobile. It is not the SVG and not an image. The hero floor is inline SVG in
  the server HTML, and the homepage has no image above the fold. No preload is needed.
* **Fonts:** `next/font/google` self-hosts both families with `display: swap` and metric-adjusted
  fallbacks (`Inter Fallback`, `Sora Fallback`). Inter is one variable woff2 (48 kB); all three Sora
  weights (500/600/700) resolve to the **same** variable woff2 (25 kB). Only the two latin files are
  preloaded, about 73 kB total. CLS is 0.000 on every marketing route on mobile and desktop, so there
  is no font-induced layout shift. Sora 500 adds no bytes, so I did not change it.
* **Image `sizes`:** every `ScreenshotFrame` usage passes a `sizes` that matches its rendered width:
  `(min-width: 1200px) 660px/680px/1120px/900px, (min-width: 1024px) 56vw, 100vw`. Lighthouse shows
  the mobile runs fetching `w=750` variants (14–41 kB). A 1440 px desktop at DPR 1 picks the
  `w=750`/`w=828` variant for split columns and `w=1200` for wide ones. At DPR 2 it picks `w=1920`,
  which is correct, so it does not download the 2400 px originals. The zoom dialog image (`sizes="95vw"`)
  is mounted only when the dialog opens. No change needed.
* **motion tree-shaking:** all four users import from `"motion/react"` (`motion`, `AnimatePresence`,
  `MotionConfig`); nothing imports `framer-motion` or the vanilla `motion` entry. After change #3,
  motion ships only on pages that render a motion component (home, product/feature pages with the
  tabs or building preview). The full `motion` component is about 34 kB gz; see recommendation 2.
* **Hero rAF:** instrumented in Playwright on the production build at 1440×900, counting rAF calls over 3 s:

  | State | rAF calls / 3 s |
  |---|---|
  | Hero in view, playing | 261 (includes motion's own frame loop) |
  | Scrolled to FAQ/footer (hero offscreen) | **0** |
  | Scrolled back to top | 238 |
  | Hero in view, `document.hidden` simulated (overridden `visibilityState` + dispatched `visibilitychange`) | **0** |
  | Hero in view, paused with the control | **0** |

  The hidden-tab row uses a simulated event, not a real tab switch. The offscreen and paused rows are
  real behaviour.
* **Compression and caching (`next start`):** HTML and JS are served gzip. `/_next/static/*` is
  `public, max-age=31536000, immutable`. Prerendered HTML is `s-maxage=31536000` (with
  `x-nextjs-stale-time: 300`).

## 6. Open Graph, canonical and structured data (production)

Checked with curl on the production build (`APP_URL=http://localhost:3200`):

| Check | `/` | `/features/ai-manager` |
|---|---|---|
| `<link rel="canonical">` | `http://localhost:3200` (Next renders the root without the trailing slash; the sitemap lists `http://localhost:3200/`, which is equivalent) | `http://localhost:3200/features/ai-manager` |
| `og:image` | `http://localhost:3200/opengraph-image.png` (absolute, 1200×630, with alt) | same |
| `og:title` / `og:description` / `og:url` / `og:type` | present, `website` | present |
| `twitter:card` | `summary_large_image`, with title, description, image and alt | same |
| `robots` meta | `index, follow` | `index, follow` |
| JSON-LD | `SoftwareApplication` (page) + `Organization` + `WebSite` (layout) | `BreadcrumbList` (3 items) + `Organization` + `WebSite` |

* `/opengraph-image.png` returns 200 `image/png` (286 kB). `/icon.png` and `/apple-icon.png` return 200.
* `/robots.txt` returns 200. It allows `/`, disallows `/api/` and the authenticated app routes plus
  `/onboarding`, and has `Sitemap: http://localhost:3200/sitemap.xml`.
* `/sitemap.xml` returns 200 with 20 URLs: home, product, the 6 feature pages, the AI tools index
  and its 2 pages, the use-cases index and its 4 pages, how-it-works, faq, demo and about.
* `/dev/components` is `noindex` and not in the sitemap. `/login` has no canonical and no robots
  meta, which is fine for an auth page.
* Important: `SITE_URL` is read **at build time** for the static pages. Build with the real public
  `APP_URL`, otherwise canonical, OG and sitemap URLs bake in the build-time value. `.env` currently
  says `http://localhost:3000`.

## 7. Recommendations (not done in this pass)

1. **Move `QueryProvider` and `<Toaster />` out of the root layout** into the layouts that need them:
   `(app)`, `(auth)`, `demo`, `onboarding`. Marketing uses neither. Saves about 18 kB gz on every
   marketing page. Not done because it touches the authenticated app's shell, which must keep
   working (contract §0.9).
2. **`LazyMotion` + `m`:** load motion features asynchronously (`domMax`, since the hero uses
   `layout="position"`). Estimated −15 to −25 kB gz where motion ships. This needs coordinated
   edits to the hero, office-alive story, feature tabs and building preview.
3. **Defer hydration of below-the-fold homepage islands** (office-alive story, feature tabs,
   building preview, delegation diagram): render the SSR HTML and hydrate on visibility. This is the
   main lever for getting the homepage under about 200 kB. `next/dynamic` alone does not defer them,
   because SSR'd dynamic components hydrate on load.
4. **Homepage HTML weight:** `/` is 793 kB raw / 84 kB gz, against 13–21 kB gz elsewhere. About
   380 kB raw is four office SVGs (about 80 kB each): the hero, the office-alive story rendered
   **twice** (sticky desktop copy and stepper copy, toggled by CSS), and the server-rendered final-CTA
   floor, which also appears in the RSC payload. Rendering one office-alive copy, or drawing static
   furniture once and reusing it via `<use>`, would cut HTML parse and transfer. This is the main
   remaining cost to mobile FCP on `/`.
5. **Integrations screenshot:** `integrations-1440.webp` is 2400×3050 and is the LCP element on
   `/ai-tools/claude-code` (mobile LCP 3.28 s). A cropped, landscape screenshot of the provider
   cards would load faster and read better in a split column.
6. **`/demo` CLS 0.217 on mobile:** the demo office grid (`main > div.@container > div.grid`)
   reflows after data loads. Reserve its height or render a sized skeleton.
7. **Fonts:** already self-hosted by `next/font`. Optionally drop Sora 500 from the config if no
   display text uses it (it costs no bytes today, because the variable file is shared).
8. **Hosting:** serve `/_next/static` and `/marketing/screenshots` from a CDN. Keep the immutable
   cache headers, enable Brotli at the edge, and let the CDN cache prerendered HTML within
   `s-maxage`. The image optimizer (`/_next/image`) should sit behind the CDN cache too.
9. **Output tracing:** the dynamic `path.resolve(process.env.AGENTOPIA_ARTIFACT_ROOT ...)` in
   `src/server/services/tasks.ts` and `findRepoRoot` in `packages/core/src/env.ts` make Turbopack
   trace the whole project. Add `/*turbopackIgnore: true*/` or scope the paths if a standalone or
   serverless deploy is planned.

## 8. Honest limits

* Lab only, on localhost (about 10 ms TTFB), with no CDN, one run per page and preset (plus repeats
  for `/` and `/demo`). Real hosting will have higher TTFB and LCP, and field INP will depend on
  real devices.
* INP was not measured; TBT stands in for it.
* The `document.hidden` check was simulated, not a real tab switch.
* Authenticated app routes were not profiled. The `sideEffects` flags also apply to the app bundle.
  Typecheck, lint, the 82 unit tests and the production build all pass, but app pages were not
  exercised in a browser in this pass.

## 9. Production e2e validation

Date: 2026-11-02, after the accessibility agent finished. I rebuilt
(`APP_URL=http://localhost:3200 BETTER_AUTH_URL=http://localhost:3200 pnpm --filter @agentopia/web build`),
ran `next start -p 3200` with the same env, and ran the full Playwright suite
(`E2E_BASE_URL=http://localhost:3200`, both projects, 41 tests) against the production bundle,
including both `sideEffects` flags.

**First full run:** 20 passed, 14 failed, 7 did not run. 13 of the 14 failures were
`429 Too many requests` from `POST /api/auth/sign-up/email`. better-auth enables its built-in rate
limiter only when `NODE_ENV=production` (it is off under `next dev`), and the suite signs up a fresh
owner in almost every test. This is environmental. I did not change any auth config. The 14th failure is
the known `02-auth › duplicate email shows an error on sign up`, which hard-codes origin
`http://localhost:3000` (environmental, not edited).

**Retry:** each spec file was run on its own with a 12 s gap, so every file starts in a fresh
rate-limit window. Final state, with the apps/web `sideEffects` line in place:

| Spec file | Result |
|---|---|
| 01-visitor-demo | 3 passed |
| 02-auth | 3 passed, 1 failed (hard-coded :3000 origin; environmental) |
| 03-companies-floors | 2 passed |
| 04-hiring-prompt-skills | 1 passed |
| 05-task-office | 2 passed |
| 06-approvals-failures | 1 passed, **1 failed**: `[simulate:block] ... approving it in the Tasks strip completes the task` |
| 07-learning | 2 passed |
| 08-integrations | 2 passed |
| 09-accessibility-responsive (desktop + mobile) | 9 passed |
| 10-performance | 1 passed |
| 11-subscription-integrations | 3 passed |
| 12-marketing-site (desktop + mobile) | 10 passed |
| **Total** | **39 passed, 2 failed** |

**The production-only failure, `06-approvals-failures › [simulate:block]`:**

* It fails on every prod run (3 runs) and passes on the :3100 dev server.
* The approval itself works: the task reaches Completed and the strip disappears. What fails is the
  assertion that the "Approved" toast is visible.
* I followed the plan: retried, then **reverted the apps/web `sideEffects` line** (kept the
  packages/shared one), rebuilt and re-ran. **It still failed, so the flag is not the cause.** I then
  restored the line, rebuilt, and re-ran the whole suite (the table above).
* Probable cause, in app code: `ApprovalActions` (`src/components/tasks/approval-actions.tsx`) fires
  the toast from the per-call `decide.mutate(vars, { onSuccess })` callback. TanStack Query drops
  per-call callbacks when the calling component has unmounted before the mutation resolves. On the
  faster production build, the approval strip unmounts (the task completes and queries refetch)
  before the POST response arrives, so `onSuccess` never runs. On dev the response wins the race.
* Suggested fix (tasks/app owner, not made here): move the toast into the `useMutation` options'
  `onSuccess` in `useDecideApproval`, which fires even after unmount, or keep the toast for
  this case by firing it before invalidation.

**Conclusion:** the production bundle, with both `sideEffects` flags, passes every spec that passes on
dev, except for one timing race. That race is independent of the bundling changes.

### 9.1 Fix applied for the approval-toast race

* `src/hooks/use-api.ts` (`useDecideApproval`): the "Approved"/"Denied" success toast and the
  "The decision was not saved" error toast moved into the `useMutation` `onSuccess`/`onError`
  options, which run even after the calling component unmounts. Invalidation of the approvals and
  tasks queries is unchanged and still returned from `onSuccess`. The variables accept an optional,
  display-only `title`, which is not sent. The request body is built as `{ decision, note }`, the
  same JSON on the wire as before (an undefined `note` is dropped). No data contract changes.
* `src/components/tasks/approval-actions.tsx`: calls `decide.mutate({ id, decision, title })`
  without per-call callbacks. The toast imports were removed. The toast text is identical.
* Verification: `typecheck` is clean and `lint` has 0 errors (the same 5 pre-existing warnings).
  `e2e/06-approvals-failures.spec.ts` passed 2/2 on :3100 dev and **2/2 on the production build on
  :3200, twice** (rebuilt with `APP_URL`/`BETTER_AUTH_URL=http://localhost:3200`). With this fix,
  the production suite's only remaining failure is the environmental `02-auth` duplicate-email
  spec, which hard-codes the :3000 origin.
