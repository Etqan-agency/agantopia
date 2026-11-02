# SEO strategy and technical checklist

Date: 2026-11-02. Scope: the public marketing site (contract §4). The authenticated app is not
indexed.

## 1. Implemented in this wave

| Item | Where | Notes |
| --- | --- | --- |
| Site config | `apps/web/src/lib/seo.ts` | `SITE_NAME`, `SITE_URL` (from `APP_URL`, fallback `http://localhost:3000`, trailing slash stripped), `DEFAULT_DESCRIPTION`, `DEFAULT_OG_IMAGE` (`/opengraph-image.png`, served from `src/app/opengraph-image.png`) |
| `buildMetadata({ title, description, path, noIndex?, image? })` | `seo.ts` | Absolute canonical (`alternates.canonical`), Open Graph (website, url, siteName, title, description, image 1200×630), Twitter `summary_large_image`, robots index/follow or noindex/follow, `metadataBase`. Title is emitted as `{ absolute }` so the root layout's `%s · Agentopia` template does not push it past 60 characters. |
| JSON-LD helpers | `seo.ts` | `organizationJsonLd`, `webSiteJsonLd`, `softwareApplicationJsonLd` (BusinessApplication, operatingSystem Web, no offers, no ratings), `breadcrumbJsonLd`, `faqJsonLd`; `JsonLd` server component with `<`, U+2028 and U+2029 escaped |
| Sitemap | `apps/web/src/app/sitemap.ts` | Exactly the routes in `MARKETING_ROUTES` (contract §4 plus `/demo`), absolute URLs |
| Robots | `apps/web/src/app/robots.ts` | Allow `/`; disallow `/api/`, `/office`, `/employees`, `/tasks`, `/learning`, `/integrations`, `/settings`, `/organization`, `/onboarding`; sitemap URL |
| Proxy | `apps/web/src/proxy.ts` | Marketing prefixes plus `/sitemap.xml`, `/robots.txt` are public |
| 404 | `apps/web/src/app/not-found.tsx` | Branded, server component; Next adds `noindex` automatically |
| Copy with meta | `apps/web/src/content/marketing/*.ts` | Unique `metaTitle` (36 to 56 chars) and `metaDescription` (136 to 153 chars) for all 19 pages, checked for length and duplicates |

Verified on 2026-11-02 against a temporary dev server: `/sitemap.xml` 200 (20 URLs), `/robots.txt`
200, unknown path under a public prefix returns 404 with the branded page and a single
`noindex` meta. Unknown paths outside public prefixes still redirect to `/sign-in` for visitors
without a session (unchanged proxy behaviour).

## 2. What every marketing page must do

1. Export `metadata = buildMetadata({ title: page.metaTitle, description: page.metaDescription, path: page.path })`.
   Never hand-write titles in the page file.
2. Exactly one `h1` (the copy's `h1`), then `h2` per section, `h3` inside sections. No skipped
   levels. Section headings come from `sections[].heading`.
3. Essential copy is server-rendered HTML. Animation and canvas are enhancements.
4. Detail pages render visible breadcrumbs and `breadcrumbJsonLd(page.breadcrumbs)`.
5. Images through `next/image` with explicit `width`/`height` (or `fill` inside an aspect-locked
   box) and meaningful `alt` from the visual's `caption`. Decorative images get `alt=""`.
6. Links are `next/link` with descriptive anchor text. Only routes in `MARKETING_ROUTES`, `/demo`
   and the auth links.
7. Non-live visuals show their label (`Scripted demo` / `Illustrative data`).
8. Main CTAs carry `data-cta` from the copy.

## 3. Index and noindex rules

| Surface | Rule |
| --- | --- |
| Marketing routes in `MARKETING_ROUTES` | index, follow; in sitemap |
| `/demo` | index, follow; in sitemap (labelled scripted demo) |
| Auth pages (`/sign-in`, `/signup`, `/forgot-password`, `/reset-password`, `/login`, `/sign-up`) | noindex, follow (pass `noIndex: true` when those pages adopt `buildMetadata`); not in sitemap |
| App routes (`/office`, `/employees`, `/tasks`, `/learning`, `/integrations`, `/settings`, `/organization`, `/onboarding`) | disallowed in robots, behind the auth proxy |
| `/api/*` | disallowed |
| 404 | noindex (Next default) |

## 4. Structured data

| Type | Helper | Where |
| --- | --- | --- |
| Organization | `organizationJsonLd()` | `(marketing)/layout.tsx` (every marketing page) |
| WebSite | `webSiteJsonLd()` | `(marketing)/layout.tsx` |
| SoftwareApplication | `softwareApplicationJsonLd()` | `/` and `/product` only |
| BreadcrumbList | `breadcrumbJsonLd(items)` | every page with `breadcrumbs` (features, AI tool details, use-case details) |
| FAQPage | `faqJsonLd(items)` | `/faq` only, built from `FAQ_PAGE.groups` (all items). The homepage shows ten FAQ items visually but does not emit FAQPage, to keep one canonical FAQ URL. |

Never add `offers`, `aggregateRating`, `review` or pricing: none exist.

## 5. Content clusters

| Cluster (topic) | Pillar | Supporting pages |
| --- | --- | --- |
| AI employees / AI company | `/` and `/product` | `/features/ai-employees`, `/features/ai-manager`, `/how-it-works`, `/about` |
| Multi-agent collaboration | `/features/agent-collaboration` | `/features/ai-manager`, `/use-cases/software-development`, `/use-cases/quality-assurance` |
| Virtual office for AI agents | `/features/virtual-office` | `/demo`, `/features/multi-company` |
| Agent learning and memory | `/features/agent-learning` | `/features/ai-employees`, `/use-cases/research`, `/faq` |
| Claude Code and Codex with your own subscription | `/ai-tools` | `/ai-tools/claude-code`, `/ai-tools/codex`, `/faq` |
| Use cases | `/use-cases` | the four detail pages |

Each supporting page links back to its pillar through `related`.

## 6. Core Web Vitals plan

* **LCP**: hero headline and support copy are server-rendered text and are the LCP candidate;
  the hero office SVG has a static first paint. Any hero image uses `next/image` with `priority`.
  Fonts load through `next/font/google` with `display: "swap"` (already the case in the root layout).
* **CLS**: every visual is in an aspect-locked frame with known dimensions; the hero's static
  frame matches its final layout; fonts use `next/font` metric overrides; no late banners.
* **INP**: the hero engine (`HeroOfficeExperience`) is a client island loaded after the copy
  (dynamic import or below-the-fold boundary), runs no rAF while paused or offscreen, and pauses on
  `visibilitychange`. Other marketing components stay server components; `MotionReveal` uses one
  IntersectionObserver and CSS transforms.
* No analytics or third-party scripts (contract §7).
* Screenshots: serve AVIF/WebP through `next/image`, sized to their rendered width.

## 7. Before production

* Set `APP_URL` to the public origin; canonical, OG and sitemap URLs derive from it.
* Root `layout.tsx` (design-system owner) may add `metadataBase: new URL(SITE_URL)`; pages already
  return absolute URLs, so this is optional.
* Validate a few pages with the Rich Results Test and the Schema Markup Validator.
