# Motion guidelines

Date: 2026-11-02. Scope: the public marketing site (`apps/web/src/components/marketing/`) and the
few shared UI pieces it uses. The authenticated app keeps its own minimal chrome motion; the real
office canvas (`apps/web/src/office`, Pixi) is out of scope here. Evidence for the rules is in
`docs/design/motion-references.md`; tokens come from `docs/design/agentopia-brand-system.md` §5.
Everything below was checked against the code on this date. File paths are relative to
`apps/web/src/` unless they start with `docs/`.

## 1. Principles

1. **Motion communicates state.** A lamp turning gold means work started. A status pill changing
   means the task moved. If nothing changed in the product, nothing moves.
2. **Motion explains relationships.** Connectors travel from the sender to the receiver, and the
   artifact chip travels from the developer to the manager. Direction is meaning.
3. **Motion rewards actions.** Pressing a floor button brings that floor forward; choosing a tab
   fades its panel in; the task completing gets one small check-mark beat. Responses stay short.
4. **Motion guides attention.** The hero is the one orchestrated moment on the page. Everything
   else is quiet: no ambient loops, parallax, marquees or decorative floating.
5. **Motion never blocks usability.** Copy is server-rendered and visible without JavaScript.
   Nothing waits for an animation to finish before it can be read, clicked or focused. Scene
   changes jump to the target state instead of queueing.
6. **Motion respects reduced motion.** Every animated component has a static or stepper fallback
   (section 5). The OS preference is honoured in CSS (`motion-safe:` / `motion-reduce:` variants and
   a global rule in `app/globals.css`) and in JS (`MotionConfig reducedMotion="user"`,
   `matchMedia`).
7. **Motion stops when not visible.** The hero clock runs only while the user wants it playing,
   the panel is on screen and the tab is visible. Scroll-triggered sequences run once and stop.

## 2. Stack

`motion` (React, `motion/react`, already a dependency) + CSS transitions/keyframes + SVG. No GSAP.

Why (from `docs/design/motion-references.md` §1, which cites Motion's own "GSAP vs Motion" page,
a vendor document fetched 2026-11-02):

- One engine. `motion` already ships with the app; GSAP would add a second animation runtime to one
  marketing site.
- Declarative React model (`motion.*` props, `AnimatePresence`, `MotionConfig`) fits the existing
  server/client component split; GSAP is imperative (refs, `useGSAP`).
- Licence. The page states Motion is MIT and GSAP is closed source, owned by Webflow, with terms
  that bar use in competing tools. A terminable licence is a dependency risk we do not need.
- Size and off-main-thread playback are claimed in Motion's favour on that page; the page's own
  figures disagree with each other, so no single number is quoted.

Where each tool is used:

| Need | Tool | Example |
| --- | --- | --- |
| Enter/exit of DOM overlays, keyed swaps | `motion` + `AnimatePresence` | office story overlays, feature tabs |
| Interactive transforms | `motion` `animate` prop | floor buttons in `MultiFloorBuildingPreview` |
| Staged reveal once in view | CSS transitions + delay classes, started by `RunOnView` | `WorkflowAnimation`, `TaskProgressTimeline`, `LearningJourney` |
| Looping dash travel | CSS keyframe `connector-travel` on an SVG path | `AnimatedConnector` |
| Lamp pulse | CSS keyframe `lamp-glow` | `StatusDot`, provider card, timeline live dot |
| SVG fades (lamps, connectors, halos) | CSS `transition-opacity` on SVG elements | `office/office-floor-svg.tsx` |
| Hero scene loops (spotlight, lamps, dashes) | CSS keyframes `hero-b-*`, paused by `.is-paused` | `hero/hero-scene-b.tsx` |

Pixi is used only inside `src/office` (the real office). Marketing never mounts it.

## 3. Tokens

Defined in `app/globals.css` (`@theme` and `:root`).

| Token | Value | Use |
| --- | --- | --- |
| `--duration-fast` | 160 ms | hover, press, colour changes, chevron rotation, tab underline |
| `--duration-base` | 240 ms | popovers, toggles, connector fade, hero caption swap, FAQ chevron |
| `--duration-slow` | 400 ms | reveals, scene transitions, lamp fill, floor change, tab panel |
| `--ease-brand` / `ease-brand` | `cubic-bezier(.2,.8,.2,1)` | everything except linear loops; in JS as `[0.2, 0.8, 0.2, 1]` |
| `animate-lamp` | `lamp-glow 2.4s ease-in-out infinite` | the lamp only (gold ring that expands and fades) |
| `animate-connector` | `connector-travel 0.8s linear infinite` | `AnimatedConnector` only (dash 6 + gap 6, offset to -12) |

Two deliberate exceptions, both explanatory rather than UI feedback: the hero's ambient light
(`duration-[1200ms]`, opacity only) and the travelling artifact chip (duration from the script,
1.6 s, `easeInOut`). Staged reveals use `STAGE_STEP_MS = 700` between stages
(`components/marketing/viz/sequence.ts`). Marketing storytelling may exceed 300 ms per
`motion-references.md` §2; individual moves inside it stay in the 160–400 ms band.

## 4. Catalogue of implemented animations

### 4.1 Hero scene (Hero B, illustration)

Files: `components/marketing/hero/hero-scene-geometry.ts` (pure geometry), `hero/hero-scene-b.tsx`
(server-rendered SVG), `hero/hero-motion-gate.tsx` (client: pause flag), keyframes in
`app/globals.css` ("homepage hero (Hero B)" block). Approved concept:
`artifacts/hero-concept-b/` (scene.js + styles.css).

- The scene is a decorative SVG (`aria-hidden`) rendered on the server for three canonical
  evaluations of the concept's maths: wide (1440x900, shown at >= 900px), tablet (768x1024,
  561-899px) and phone (390x853, <= 560px). CSS swaps them; the SVG is sliced to the hero with
  container-query units (crop the concept's top-bar band first, at most 5% from the bottom, 30/70
  horizontally), so there is no JavaScript-dependent frame and no layout shift (CLS 0).
- Motion is CSS keyframes only, transform and opacity, no `requestAnimationFrame`:
  - spotlight pool breathes `scale(1) -> scale(1.04)`, 6 s, `ease-brand`, alternate, infinite;
  - five lamps: three steady (warm up from 0.45 to 1 in the first 0.7 s, then stay lit) and two
    cycling on an 8 s loop (on 9%-72%), lit left to right with a 0.55 s stagger (`--d`);
  - a 14 px gold dash travels along three straight HUD connectors (two on phones) by
    `translateX(var(--len))`, 5-8 s, staggered.
- Offscreen: `HeroMotionGate` (IntersectionObserver on the section) adds `is-paused` and
  `data-motion="paused"`, which sets `animation-play-state: paused` on every scene animation.
  Hidden tabs are throttled by the browser.
- Copy (h1, support, CTAs, trust line) is plain server HTML and never animates.

### 4.2 Scroll story: "The office comes alive"

File: `components/marketing/sections/office-alive-story.tsx`.

- Five beats are mapped onto moments of the hero script, so the pinned office and the hero always
  agree. From 1024 px with motion allowed, the beat panels scroll on the left while the office stays
  pinned (CSS `position: sticky`) on the right.
- An `IntersectionObserver` with `rootMargin: "-45% 0px -45% 0px"` picks the panel crossing the
  middle of the viewport. No scroll-jacking and no scroll-linked transforms; scroll only chooses
  which frame to show. Focusing a panel also activates it.
- The feed caption swaps lines with `AnimatePresence mode="popLayout"` (240 ms, 8 px).
- Both layouts are in the server HTML and chosen by CSS media queries (`lg:motion-safe:grid`), so
  hydration never shifts the layout.

### 4.3 `AnimatedConnector` dash travel

File: `components/marketing/primitives/animated-connector.tsx`; keyframe in `app/globals.css`.

- Two stacked paths: a faint solid track (25% opacity) and an overlay with
  `stroke-dasharray: 6 6` that animates `stroke-dashoffset` to -12 on a 0.8 s linear loop
  (`motion-safe:animate-connector`). `active` fades the overlay in or out (240 ms).
- Used by the hero floor (lavender over a navy halo for legibility on the light floor), the
  workflow diagram and the learning journey. Connectors are `aria-hidden`; the meaning is carried
  by the feed text and the stepper.

### 4.4 `WorkflowAnimation` staged highlight

Files: `components/marketing/viz/workflow-animation.tsx`, `viz/run-on-view.tsx`, `viz/sequence.ts`.

- User task → AI manager → three specialists → review → delivery. Stages light in sequence once
  the diagram is 30% in view: nodes fill violet, lamps turn gold, connector dashes travel.
- `RunOnView` renders `data-run="on"` in server HTML (final state without JS). After hydration,
  when motion is allowed, a layout effect flips it to `off` with transitions disabled before paint,
  then back to `on` when it intersects. Children use `group-data-[run=on]/run:` variants plus a
  literal delay class per stage (`delay-[700ms]` … `delay-[4900ms]`). It runs once and disconnects.
- The same mechanism drives `TaskProgressTimeline` (steps fade and rise 4 px, 400 ms, staggered)
  and `LearningJourney` (stage rules scale in on X, 600 ms).

### 4.5 `MultiFloorBuildingPreview` floor transition

File: `components/marketing/viz/multi-floor-building-preview.tsx`.

- Floor buttons are `motion.button`s: the selected floor animates to `x: 6, scale: 1, opacity: 1`,
  the others to `x: 0, scale: 0.97, opacity: 0.7` (400 ms, brand ease).
- The plan crossfades between floors with `AnimatePresence mode="wait"`: enter from `y: 16`,
  `scale: 0.98`, exit to `y: -16` (400 ms). Small scale delta on a small schematic, never a zoom
  of a large surface (MDN names scaling large objects as a vestibular trigger).
- Keyboard: arrow keys, Home and End move between floors (`floorReducer` in `sequence.ts`).

### 4.6 `MotionReveal`

File: `components/marketing/primitives/motion-reveal.tsx`.

- Fade + 8 px rise, 400 ms brand ease, once. Server HTML is fully visible. After hydration, only
  elements that start below the fold get `data-reveal="hidden"`; one `IntersectionObserver`
  (`rootMargin: 0px 0px -10% 0px`) flips them to `shown` and disconnects. Content already on
  screen at mount is left alone so nothing flashes. Optional `delay` (keep under 240 ms).
- Uses IntersectionObserver rather than Motion's `whileInView` to keep the bundle small.

### 4.7 Lamp glow keyframe

Keyframe `lamp-glow` in `app/globals.css`: a gold `box-shadow` ring that grows to 5 px while fading
to transparent, 2.4 s, infinite. Applied only with `motion-safe:animate-lamp` on: the live state of
`components/ui/status-dot.tsx`, the Running dot in `components/integrations/provider-cards.tsx`, and
the active step of `components/marketing/viz/task-progress-timeline.tsx`. This is the only glow on
the site (brand rule: no glow halos except the lamp). In the SVG floor the lamp has no loop: it fills
gold and shows a static radial halo when on, dimmed when done.

### 4.8 `FeatureShowcaseTabs` panel transition

File: `components/marketing/viz/feature-showcase-tabs.tsx` (used by
`sections/feature-showcase-section.tsx`).

- Radix Tabs with manual activation (arrow keys move focus, Enter or Space selects). The active
  panel's content fades and rises from `y: 10` (400 ms, brand ease). The tab underline changes
  colour in 160 ms. No auto-rotation.
- Only the active panel is mounted, so only its screenshot loads (lazy mount).

### 4.9 CTA and link hover

- `Button` (`components/ui/button.tsx`): `transition-colors` only. `brand` goes violet →
  violet-deep, `outline-light` gains a `white/10` fill. No lift, scale or shadow on hover.
- Card links: the arrow icon nudges 2 px (`group-hover:translate-x-0.5 -translate-y-0.5`, 160 ms) in
  `viz/use-case-showcase.tsx`; the chevron nudges right in `templates/detail-page.tsx`.
- Navbar: dropdown chevron rotates 180° (160 ms), panel fades in, and a soft shadow appears once
  the page scrolls (240 ms, `marketing-navbar.tsx`). FAQ chevrons rotate (240 ms,
  `sections/faq-accordion.tsx`). The `ScreenshotFrame` zoom hint fades in on hover or focus.

### 4.10 Small hero overlays

Removed with Hero A (the scripted office demo and its employee popover). The hero has no
interactive overlays; the scripted office lives on in "The office comes alive" (4.2).

## 5. Reduced-motion matrix

Under `prefers-reduced-motion: reduce`, a global rule in `app/globals.css` collapses every CSS
animation and transition to 0.01 ms and one iteration. Components also opt out explicitly:

| Component | File | Fallback |
| --- | --- | --- |
| Hero scene (Hero B) | `hero/hero-scene-b.tsx`, `app/globals.css`, `hero/hero-motion-gate.tsx` | No animation at all (`animation: none`): the spotlight is still, the three steady lamps are lit, the two cycling lamps are off and no dash travels. The section also gets `is-paused` / `data-motion="paused"` (follows the preference live). |
| Office alive scroll story | `sections/office-alive-story.tsx` | The pinned scroll story is not shown (`lg:motion-safe:grid`); the office sits on top with a `Stepper` of the five beats below, same as small screens. |
| `MotionReveal` | `primitives/motion-reveal.tsx` | Nothing is hidden; content renders in place. |
| `RunOnView` sequences (`WorkflowAnimation`, `TaskProgressTimeline`) | `viz/run-on-view.tsx` | Never flips to `off`; every stage is shown in its final highlighted state. |
| `LearningJourney` | `viz/learning-journey.tsx` | The animated stage row is hidden (`motion-reduce:hidden`) and a static `Stepper` is shown instead (`motion-reduce:flex`). |
| `AnimatedConnector` | `primitives/animated-connector.tsx` | No dash loop (`motion-safe:` only); the active path becomes a static solid line (`motion-reduce:[stroke-dasharray:none]`). |
| Lamp glow | `ui/status-dot.tsx`, `integrations/provider-cards.tsx`, `viz/task-progress-timeline.tsx` | No pulse (`motion-safe:` only); the lamp is a solid gold dot. |
| SVG lamp fill, connector and halo fades | `office/office-floor-svg.tsx` | Collapsed to instant by the global CSS rule; state is still shown. |
| `MultiFloorBuildingPreview` | `viz/multi-floor-building-preview.tsx` | `MotionConfig reducedMotion="user"`: floor buttons and the plan swap without transform motion. |
| `FeatureShowcaseTabs` | `viz/feature-showcase-tabs.tsx` | `MotionConfig reducedMotion="user"`: panels change without the rise. |
| Buttons, links, chevrons, navbar shadow, popover enter | various | Collapsed by the global CSS rule. |

Per Motion's documentation, `reducedMotion="user"` disables transform and layout animations while
letting opacity animate; we rely on that behaviour and do not add a separate opacity override.

## 6. Performance rules

1. **Transform and opacity only** for anything that moves. SVG exceptions are paint-only on small
   elements: `stroke-dashoffset` for connectors, `fill` for diagram nodes, `box-shadow` for the
   small lamp dot.
2. **No rAF when paused.** The hero's rAF loop exists only while playing, on screen and visible.
   No other marketing component uses a continuous rAF; `RunOnView` uses one frame to flip state.
3. **Re-render on beats, not frames.** The hero commits React state only at script beats; the
   progress rail is a CSS animation, not React state.
4. **No layout thrash.** Fixed-size boxes and aspect-locked frames; no reading layout inside an
   animation loop (`MotionReveal` reads one bounding box at mount).
5. **Run once, then disconnect.** `MotionReveal` and `RunOnView` observers disconnect after
   firing.
6. **Lazy mount.** Only the active feature tab panel (and its image) is mounted. Screenshots use
   `next/image` with explicit sizes. The hero is server-rendered (its first frame is static SVG);
   it is not code-split today (see section 8).
7. **No new engines.** No GSAP, no Lottie, no canvas on marketing pages.

## 7. Review checklist

Before shipping a new animation, answer yes to each:

- [ ] It shows a state change, a relationship, a response to an action, or directs attention to the
      one thing that matters in that section.
- [ ] It uses the duration tokens (160 / 240 / 400 ms) and `ease-brand`, or the exception is written
      down here.
- [ ] Only `transform` and `opacity` move (or a paint-only SVG property on a small element).
- [ ] It has a reduced-motion fallback that still shows the information (final frame, static line,
      stepper). Add a row to section 5.
- [ ] Without JavaScript, the content is visible and readable.
- [ ] It stops when offscreen, when the tab is hidden, or after running once.
- [ ] Anything that auto-plays for more than five seconds has a visible pause control (WCAG 2.2.2).
- [ ] No large surface is scaled or panned.
- [ ] The final layout is reserved from first paint (no CLS).
- [ ] Animated state changes have a text equivalent (feed line, label, `aria-live="polite"` only
      when appropriate).
- [ ] Gold motion is used only for live work; no new glow outside the lamp.

## 8. Known gaps

- The hero component is server-rendered and hydrated with the page; it is not loaded through a
  dynamic import as `docs/design/seo-strategy.md` §6 suggests. Measure INP before deciding whether
  to split it.
- No performance trace has been recorded for these animations yet (see the QA wave).
