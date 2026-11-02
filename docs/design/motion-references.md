# Motion references

Date: 2026-11-02. Author: UX research. Scope: the evidence behind the motion rules in
`frontend-refactor-plan.md` (section 0 rules 6–7, section 6 hero). Every source below was fetched
on 2026-11-02 unless marked otherwise. Nothing here is a new requirement; it explains the ones we
already have.

## 1. Why we stay on `motion` (not GSAP)

`apps/web/package.json` already ships `motion` ^14.9.0 alongside `pixi.js` ^8.22.0 (the real
office). Adding GSAP would mean two animation engines for one marketing site.

Source: Motion, "GSAP vs Motion", https://motion.dev/docs/gsap-vs-motion (fetched 2026-11-02).
This is the Motion maintainers' own comparison, so treat it as a vendor document. What it states:

- Size. The prose lists Motion `animate()` mini at 3.2 kb and full at 22 kb against GSAP at 23 kb;
  the comparison table on the same page lists 2.6 kb / 18 kb / 23.5 kb. The two sets disagree, so
  we do not quote a single number. Scroll-linked animation is listed as ~2.5 kb in Motion versus
  ~12 kb in GSAP; scroll triggers ~0.5 kb versus ~12 kb.
- Hardware acceleration. The page says Motion can hand animations to the browser so they run off the
  main thread and stay smooth when JavaScript is busy, and marks this as unsupported in GSAP.
- React model. Motion is declarative (props on `motion.*` components, `useReducedMotion`), while
  GSAP is imperative (refs, `useGSAP`). Our components are React server/client components, so the
  declarative model fits the existing code.
- Licence. The page states Motion is MIT. It states GSAP is closed source, owned by Webflow, and its
  licence bars use in tools that compete with Webflow. Agentopia is not a website builder, but a
  licence that the owner can terminate is a dependency risk we do not need.
- Layout animation. Motion claims a layout engine beyond GSAP's FLIP approach. We do not plan to rely
  on layout animation for the hero (it uses fixed coordinates on the floor plan), so this is not a
  deciding factor.

Decision restated: `motion` + CSS + SVG for all new marketing animation; Pixi only inside
`src/office`. No GSAP.

## 2. Animation principles (Emil Kowalski)

Two articles were fetched. Only these are cited.

- "Great Animations", https://emilkowal.ski/ui/great-animations (fetched 2026-11-02). Key points:
  motion should feel physical (things do not appear or vanish instantly; springs help); keep UI
  animations short, generally under 300 ms, with `ease-out`; animate only where motion adds
  information and weigh how often the user sees it; skip animation on keyboard-triggered actions;
  animate `transform` and `opacity` to avoid layout and paint; prefer CSS or WAAPI when the main
  thread is busy; keep animations interruptible; honour `prefers-reduced-motion` (CSS media query
  or Motion's `useReducedMotion`) by swapping heavy motion for gentler alternatives such as fades.
- "You Don't Need Animations", https://emilkowal.ski/ui/you-dont-need-animations (fetched
  2026-11-02). Key points: ask what an animation is for (explaining a feature, feedback, spatial
  consistency, delight); frequency decides whether to animate at all; repeated keyboard actions
  should never animate; a 180 ms dropdown feels faster than a 400 ms one; marketing sites are the
  stated exception to the under-300 ms rule.

How this maps to Agentopia:

| Principle | Where it applies |
| --- | --- |
| Marketing is the exception to "keep it short" | The hero's ~24 s scripted timeline is explanatory storytelling, not UI feedback. Individual moves inside it (lamp on, pill swap, connector travel) should still be short (150–400 ms) and eased out. |
| Frequency | The authenticated app (`/office`, `/tasks`) is seen hundreds of times; keep its chrome motion minimal. Spend motion on the marketing hero and the office canvas, where motion is the information. |
| Explain a feature | Connector travel (manager → employee), artifact travel (employee → manager), and the lamp are the only motion that carries meaning. Decorative float, parallax and marquee loops are out. |
| Interruptible | Hero controls (pause, replay, scene stepper) must cancel in-flight animations cleanly; scene changes jump to the target state rather than queueing. |
| Transform and opacity only | Lamps animate opacity/scale of a glow element; sprites move with `transform: translate`; connectors animate `stroke-dashoffset` / Motion `pathLength` (paint-only on a small SVG, acceptable). |

## 3. SVG connector techniques

Sources:
- MDN, `pathLength` attribute, https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/pathLength
  (fetched 2026-11-02). "lets authors specify a total length for the path, in user units"; the
  browser scales distance computations by `pathLength / computed length`, and `stroke-dasharray`
  treats the end of the path as the `pathLength` value. Applies to `path`, `line`, `polyline`,
  `polygon`, `rect`, `circle`, `ellipse`.
- MDN, `stroke-dashoffset` attribute, https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/stroke-dashoffset
  (fetched 2026-11-02). "defining an offset on the rendering of the associated dash array"; the
  offset is "usually expressed in user units resolved against the `pathLength`"; animatable; the
  CSS property wins over the attribute.
- Motion, SVG animation, https://motion.dev/docs/react-svg-animation (fetched 2026-11-02).
  `pathLength`, `pathSpacing`, `pathOffset` as 0–1 progress values on `motion.path` etc.; example
  `initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}`.

Recommended technique for `AnimatedConnector` (contract section 3):

1. Draw-in (connection established): set `pathLength="1"` on the path, then
   `stroke-dasharray: 1; stroke-dashoffset: 1 → 0`. Because offsets resolve against `pathLength`,
   the same CSS works for any path geometry without measuring with `getTotalLength()`. Equivalent
   in Motion: `pathLength` 0 → 1.
2. Travel (work is flowing): a short dash moving along a dim base line. Two stacked paths: a base
   path at low opacity, and an overlay with `pathLength="1"`, `stroke-dasharray: 0.12 0.88`,
   animating `stroke-dashoffset` from 1 to 0 on a loop only while `active`. In Motion,
   `pathLength: 0.12` with `pathOffset` animated 0 → 1.
3. Packet (artifact handoff): a small DOM or SVG element moved along the path with CSS
   `offset-path: path(...)` and `offset-distance: 0% → 100%`, or Motion keyframes over points
   sampled from the path. (`offset-path` is not covered by the sources above; verify support on the
   target browsers before relying on it, and keep the dash technique as the fallback.)
4. Reduced motion: show the connector fully drawn and static with an arrowhead or end marker so the
   direction is still legible; no looping dash.
5. Accessibility: connectors are `aria-hidden="true"`; the meaning ("Manager delegated research to
   Riley") is carried by the event feed text and the stepper, which are real DOM text.
6. Performance: stop loops when the hero is paused, offscreen (IntersectionObserver) or the tab is
   hidden (`visibilitychange`); no continuous rAF while paused (contract section 6).

## 4. Accessible motion

Sources:
- W3C, Understanding SC 2.3.3 Animation from Interactions (WCAG 2.2),
  https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html (fetched 2026-11-02).
  Text: "Motion animation triggered by interaction can be disabled, unless the animation is
  essential to the functionality or the information being conveyed." Level AAA. Intent: motion
  triggered by user action (including scroll-triggered effects such as parallax) can cause
  dizziness, nausea or headaches for people with vestibular disorders. Sufficient techniques: C39
  (CSS `prefers-reduced-motion` to prevent motion), SCR40 (the same query read in JavaScript), and
  a user-set preference that prevents animation.
- MDN, `prefers-reduced-motion`, https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
  (fetched 2026-11-02). Values `no-preference` and `reduce`; "Animations such as scaling or panning
  large objects can be vestibular motion triggers."

What this means for us even though 2.3.3 is AAA (our baseline is AA):

- The hero autoplays, so it is not purely "triggered by interaction". WCAG 2.2.2 Pause, Stop, Hide
  (Level A, not fetched here; it is the criterion for auto-playing motion longer than five seconds)
  is the binding requirement: the hero's visible pause control satisfies it. Treat 2.3.3 as the
  guide for scroll-triggered reveals (`MotionReveal`).
- Under `prefers-reduced-motion: reduce`: hero renders the final frame with the stepper (contract
  section 6); `MotionReveal` renders content immediately; connectors are static; lamps are on/off
  without glow pulses; no parallax, no marquee, no scale-in of large panels.
- Do not scale or pan large objects even with motion allowed (MDN's named trigger). The office
  spotlight should crossfade between floors, not zoom.
- Provide an in-page control as well as the OS preference: the hero's pause button doubles as the
  "Gx" user preference for that component.
- Text equivalents: every animated state change in the hero also appears as a line in the event
  feed (real DOM text, `aria-live="polite"` only when the user has pressed play, so screen readers
  are not flooded on load).
