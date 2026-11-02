# Design research (Phase 0/1)

## References studied

* **Gather** and **Kumospace** (public product pages and reviews, 2026-11-01).
  Both use a top-down 2D office with named rooms, desks, and proximity-based
  presence. Gather is pixel-art and tile-based with a builder; Kumospace is
  illustrated and room-centric. Critiques found: large open maps feel
  empty, and purely decorative animation becomes noise. No proprietary art
  or layouts were copied; Agentopia's art is generated procedurally from code
  in `apps/web/src/office/atlas.ts`.
* **Top-down management games** (generic genre conventions: desks facing a
  consistent direction, status icons above heads, a single "boss office").
* **Anthropic frontend-design skill** (Apache-2.0): avoid the generic
  cream-background/serif/terracotta look and the "SaaS card kit"; pick one
  memorable element; typographic restraint; sentence case; motion only in
  response to events.
* **Vercel web-design-guidelines** (MIT): focus rings, 44px targets, reduced
  motion, no layout shift, forms with real labels.

## Product principles → UI decisions

| Principle | Decision |
| --- | --- |
| The office is the product, not a dashboard | `/office` is the home screen. App chrome is a thin left rail; the canvas gets the space. Panels slide over the office without navigating away. |
| Truthful state | Every sprite state is derived from a persisted event. The feed shows the same events. Demo/simulated events carry a visible "Simulated" tag and a dashed outline on the floor. |
| Bold, five hues only | Palette (strict, only alpha and lightness tints/shades allowed): Rebecca Purple `#6E2594` (left rail/chrome, nav, links, "done", Manager and Development room washes, primary series), Golden Glow `#ECD444` (the lamp and its glow, CTA pills with black text, highlight cards, Design room wash, secondary series), Grey `#808080` (rules, inactive, idle lamp, Research/QA washes, walls; shaded to `#666666` for muted text so it holds 5.7:1), Black `#000000` (text, dark buttons, blocked lamp, danger), White `#FFFFFF` (page and card surfaces, floor tiles). Dark mode: black surfaces, white text, the rail stays purple, gold accent stays, purple text lifts to the tint `#BD9DCF`. Legacy token names (ink, parchment, moss, brick, sky, saffron, stone-*) are kept and now resolve onto these hues. No red anywhere: errors are black text on a gold wash. One display face, **Fraunces** (serif, used only for the company name and floor titles), body **Inter**. |
| One memorable element | The desk lamp: it is the single animated signal that "real work is happening", visible across the whole floor. Everything else stays quiet. |
| Accessible by design | Canvas is complemented by a live region announcing state changes and a full list view (`/office?view=list`) that is the default when WebGL is unavailable or `prefers-reduced-motion` is set. All controls outside the canvas are keyboard-operable. |
| Mobile | Below 900px the office becomes the overview list with per-room sections and the floor switcher; the canvas is opt-in. |

## Screen inventory

| Route | Purpose |
| --- | --- |
| `/` | Landing: explains the product, "Explore the demo" and "Sign in". |
| `/demo` | Visitor building (seeded, isolated, simulated activity with labels). |
| `/office` | Live office of the selected floor; employee panel; create task; event feed. |
| `/employees`, `/employees/[id]` | Roster, hiring, editing; detail tabs (Prompt, Skills, Knowledge, Projects, Tasks, Progression, Learning, Usage). |
| `/tasks`, `/tasks/[id]` | Task Center columns and task timeline with artifacts and controls. |
| `/organization` | React Flow org chart. |
| `/learning` | Schedules, sources, runs, approval queue, retrieval tester. |
| `/integrations` | Providers, runners, usage with provenance labels. |
| `/settings` | Company, floors and building, approvals, retention. |
| `/login`, `/signup`, `/forgot-password`, `/reset-password` | Auth. |
| `/onboarding` | 5-step first-run flow (account → company/floor → provider → model/permissions → test task). |

## Office scene behavior (state machine)

States per employee sprite: `idle` (at desk, lamp off, occasional blink),
`thinking` (at desk, lamp on, no typing), `working` (at desk, lamp on, typing
loop), `collaborating`/`handoff` (walk to manager's desk, present folder,
return), `reviewing` (manager: paper-shuffle loop), `waiting_approval` (lamp
on, exclamation icon), `blocked` (lamp off, red cross icon, slump), `completed`
(brief check icon, then idle), `offline` (desaturated, no lamp).

Walking uses grid A* over walkable tiles (room interiors + corridors);
paths are recomputed only on state change. Animation speed is a multiplier
(0.5x–2x) with a pause toggle; `prefers-reduced-motion` renders state changes
as instant sprite swaps with no walking.
