# Marketing information architecture

Date: 2026-11-02. Source of truth for routes: `apps/web/src/content/marketing/routes.ts`
(`MARKETING_ROUTES`). The sitemap, navbar, footer and breadcrumbs all read from it. Copy for each
route lives next to it in `apps/web/src/content/marketing/*.ts`.

## 1. Route map

| Path | Nav group | Copy export | Breadcrumbs |
| --- | --- | --- | --- |
| `/` | home | `HOME` (`home.ts`) | no |
| `/product` | Product (col 1) | `PRODUCT` (`product.ts`) | no |
| `/features/ai-employees` | Product (col 1) | `FEATURE_AI_EMPLOYEES` (`features.ts`) | Home › Product overview › AI employees |
| `/features/ai-manager` | Product (col 1) | `FEATURE_AI_MANAGER` | yes |
| `/features/virtual-office` | Product (col 1) | `FEATURE_VIRTUAL_OFFICE` | yes |
| `/features/agent-collaboration` | Product (col 2) | `FEATURE_AGENT_COLLABORATION` | yes |
| `/features/agent-learning` | Product (col 2) | `FEATURE_AGENT_LEARNING` | yes |
| `/features/multi-company` | Product (col 2) | `FEATURE_MULTI_COMPANY` | yes |
| `/ai-tools` | AI tools (link) | `AI_TOOLS` (`ai-tools.ts`) | no |
| `/ai-tools/claude-code` | AI tools | `AI_TOOLS_CLAUDE_CODE` | Home › AI tools › Claude Code |
| `/ai-tools/codex` | AI tools | `AI_TOOLS_CODEX` | yes |
| `/use-cases` | Use cases (link) | `USE_CASES` (`use-cases.ts`) | no |
| `/use-cases/software-development` | Use cases | `USE_CASE_SOFTWARE` | Home › Use cases › Software development |
| `/use-cases/marketing` | Use cases | `USE_CASE_MARKETING` | yes |
| `/use-cases/research` | Use cases | `USE_CASE_RESEARCH` | yes |
| `/use-cases/quality-assurance` | Use cases | `USE_CASE_QA` | yes |
| `/how-it-works` | Resources (col 1) | `HOW_IT_WORKS` | no |
| `/faq` | Resources (col 1) | `FAQ_PAGE` (`faq.ts`) | no |
| `/demo` | Resources (col 2) | existing page, not part of this copy set | no |
| `/about` | Resources (col 2) | `ABOUT` (`about.ts`) | no |
| 404 | none | `src/app/not-found.tsx` | no |

Not built on purpose: `/pricing`, `/blog`, `/docs`, `/contact` (no billing, content pipeline, docs
site or contact destination exists). Do not link to them.

Auth links used by CTAs: `/signup?next=/onboarding` (create), `/sign-in` (sign in), from
`AUTH_LINKS` in `routes.ts`. Shared CTA objects are in `ctas.ts`; each carries a `dataCta` string for
the `data-cta` attribute (contract §7).

## 2. Primary navigation

Desktop, left to right: logo (home) · **Product ▾** · AI tools · Use cases · **Resources ▾** ·
Sign in (text link) · Create your company (`brand` button, `data-cta="nav-primary"`).

### Mega-menu decision

Only **Product** and **Resources** open a dropdown. AI tools (3 pages) and Use cases (5 pages) are
plain links to their index pages, which list their children; a dropdown for three items adds a
click and hides the index page that carries the overview copy.

The dropdown is a **two-column panel**, not a full-width mega menu:

* Columns come from `dropdownColumns("product" | "resources")` (split by `navColumn`).
* Product: column 1 Product overview, AI employees, AI manager, Virtual office; column 2 Agent
  collaboration, Agent learning, Multiple companies.
* Resources: column 1 How it works, FAQ; column 2 Live demo, About.
* Each item shows `title` plus the one-line `description` from `MARKETING_ROUTES`.
* No images, promos or "new" badges in the panel.
* Behaviour: opens on click and on keyboard Enter/Space/ArrowDown; closes on Escape (focus
  returns to the trigger), outside click and route change. Trigger has `aria-expanded` and
  `aria-controls`. Hover may open after a short delay but click must always work. Links are a
  plain list inside `nav`, not `role="menu"`.

## 3. Mobile navigation

* Below 900px: logo, "Create your company" compact button, and a menu button (44×44, label
  "Open menu" / "Close menu", `aria-expanded`).
* The menu is a full-height sheet on navy (`bg-navy text-snow`), opened as a modal dialog
  with focus trapped, body scroll locked, Escape to close, and focus returned to the button.
* Contents in order: Product (disclosure, closed by default, listing all seven product routes),
  AI tools, Use cases, Resources (disclosure), then Sign in and Create your company as full-width
  buttons at the bottom.
* All targets at least 44px tall. No animation beyond a 150ms fade/slide, removed under reduced
  motion.

## 4. Footer

Four columns from `MARKETING_ROUTES` grouped by `navGroup`: Product (overview + features),
AI tools (all three), Use cases (all five), Resources (How it works, FAQ, Live demo, About).
Bottom row: logo mark + wordmark, a one-line description, "Sign in" link. No social links, no
newsletter, no legal pages (none exist yet; add them when they do).

## 5. Internal linking plan

* Every page has a `related` list (3 to 4 links) rendered above the closing CTA. Links were chosen
  to keep clusters connected:
  * Product cluster: `/product` ↔ each `/features/*`; features link sideways (manager ↔
    collaboration ↔ office; employees ↔ learning; office ↔ multi-company).
  * AI tools cluster: `/ai-tools` ↔ Claude Code ↔ Codex; both detail pages link to a use case.
  * Use-case cluster: index ↔ details; each detail links to at least one feature and one other use case.
  * FAQ links to AI tools, learning and how it works; About links to product, FAQ and demo.
* Homepage sections link to their deep page: workforce → `/features/ai-employees`, office →
  `/features/virtual-office`, one task → `/features/agent-collaboration`, learning →
  `/features/agent-learning`, multiple companies → `/features/multi-company`, tools →
  `/ai-tools` (cards carry `href`), use cases → `/use-cases/*` (items carry `href`), FAQ → `/faq`.
* Anchor text is the destination's title, never "click here" or "learn more" alone.
* Only internal links listed in `MARKETING_ROUTES`, `/demo`, and the auth links are allowed.

## 6. Breadcrumbs

Detail pages (`/features/*`, `/ai-tools/*` children, `/use-cases/*` children) carry
`breadcrumbs` in their copy, built by `breadcrumbsFor(path)` from the `parent` chain. Render them
as `nav aria-label="Breadcrumb"` with an ordered list above the h1, the last item as plain text
with `aria-current="page"`, and emit `breadcrumbJsonLd(page.breadcrumbs)` on the same page.

## 7. Visual keys

Each section may name a `visual` (`VisualKey` in `types.ts`) with a caption and a visible label:
`Product screenshot` (real capture), `Illustrative data` or `Scripted demo`. Viz components must
show the label through `DemoBadge` whenever the label is not `Product screenshot`.
