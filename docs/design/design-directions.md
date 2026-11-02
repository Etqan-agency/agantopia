# Design directions

Date: 2026-11-02. Author: UX research. Inputs: `competitor-research.md`, `component-inspiration.md`,
`motion-references.md`, and the fixed brand palette and fonts in `frontend-refactor-plan.md`
section 2. The decision is already made (B blended with A, contract section 1). This document records
the three directions that were weighed and why that blend wins, so later contributors do not
re-open it without new evidence.

All three directions use only the contract palette: violet #7357F6 / violet-deep #5B3FD9, lavender
#B8A7FF, gold #FFC66D / gold-deep #E8A93D, navy #111326 / 800 #1B2436 / 700 #242D43, snow #F5F7FF,
mist #A8B4CA, white, success and danger. No direction introduces a new hue.

---

## Direction A: A Living AI Office

The office is the site. The homepage is a large top-down floor you can explore; sections are rooms.

- Hero concept: full-bleed office floor (the real `DEFAULT_ROOMS` plan) filling the viewport, with
  the headline set into the floor like a room label. The scripted day plays at once: the task
  arrives, lamps come on, folders travel between desks. Scrolling "walks" the camera from room to
  room (Manager, Development, Design, Research, QA), each room revealing one feature.
- Typography: Sora 700 for room titles and the headline, set large on the floor; Inter for small
  in-scene labels. Labels behave like signage (short, sentence case).
- Colour usage: navy floor, navy-700 walls, violet room washes for Manager/Development, lavender for
  Research, gold reserved for lamps and the delivery beat. Paper (white) sections are rare: only FAQ.
- Navigation concept: a floor switcher in the header (Product, Features, AI tools, Use cases) styled
  as a building directory; on scroll the nav shrinks to a minimap.
- Two representative sections: (1) "The manager's office": camera centres on the manager desk while
  the plan graph unfolds as sticky notes on a wall. (2) "The learning library": a room with shelves
  where sources arrive, notes wait in an "approval tray", then move into the employee's memory
  drawer.
- Motion concept: continuous ambient life (walking, typing) plus scroll-driven camera pans.
- Mobile concept: the floor is cropped to one room per screen; swipe moves between rooms; a list
  view toggle is always visible.
- Advantages: maximally distinctive (no inspected site does this, see competitor-research
  cross-cutting finding 2); memorable; demonstrates that the office is real.
- Weaknesses: camera pans and scroll-driven panning of large surfaces are the vestibular triggers MDN
  names; reads as a game (contract: "Not a gaming site"); essential copy buried in a canvas; heavy
  rendering on low-end phones; every feature page must invent a room metaphor, which strains for
  Usage, Multi-company and AI tools; the critique already recorded in `docs/design-research.md`
  (large maps feel empty) applies.

## Direction B: Premium AI Command Center

Navy, confident type, real product fragments. The site reads like a well-made tool, in the register of
Linear and Attio.

- Hero concept: left column headline "Build your own AI company.", support line, two CTAs and the
  trust line; right column a large framed product view showing a task moving through the plan and
  timeline, with live status pills and a usage row with its provenance label.
- Typography: Sora 600/700 at 56–72px desktop, tracking -0.02 to -0.03em; Inter 16–18px body,
  15px UI fragments. Two-tone headings allowed when the second clause is mist (full clause, never one
  word).
- Colour usage: navy page; navy-800 frames with navy-700 rules; violet for primary buttons and active
  states; lavender for links on navy; gold only for "live" indicators; paper sections for reading.
- Navigation concept: a slim navy bar: Product, How it works, Features (menu: AI employees, AI manager,
  Virtual office, Collaboration, Learning, Multi-company), AI tools, Use cases, FAQ; "Sign in" and
  "Create your company". Mobile: full-screen sheet with the same groups.
- Two representative sections: (1) "One task, start to finish": the plan graph (component-inspiration
  1.1) beside the timeline fragment with attempts, approvals and the review decision. (2) "What you
  pay for and what you don't": the runner architecture diagram (1.14) plus a usage row labelled
  "provider-reported" or "estimated", with a paper callout listing what is unsupported.
- Motion concept: restrained: `MotionReveal` entrances, connector travel on the plan, pill swaps;
  under 400 ms per move; nothing ambient.
- Mobile concept: frames cropped (not scaled) to the relevant column, as Linear does; tabs become
  accordions.
- Advantages: product clarity; honest by construction (real fragments, labels); accessible and fast;
  easy to maintain with the existing component library.
- Weaknesses: in a crowded category it can look like every other agent platform (Linear, Attio,
  Gumloop, Relevance all use framed UI on dark or light). The "AI company" idea is told, not felt.

## Direction C: Editorial Future Workspace

A magazine-like site: large type, asymmetric layouts, few images, a calm voice.

- Hero concept: a very large two-line headline across 9 of 12 columns, set asymmetrically, with a short
  essay-style paragraph offset to the right and a single small office vignette (one room, three desks)
  as an illustration plate with a caption.
- Typography: Sora 700 at 88–112px for display, generous leading; Inter at 18–20px for long-form
  body; numbered figure captions only where they mark a sequence.
- Colour usage: mostly paper (white) with navy text; navy reserved for one or two full-bleed
  statements; violet only for links and the primary button; gold used once per page.
- Navigation concept: minimal text links, no menus; a table of contents rail on long pages.
- Two representative sections: (1) "What an AI company is" as a short essay with pull quotes from the
  product's own principles (real vs simulated). (2) "A day on the floor" as a vertical sequence of
  captioned plates (morning plan, handoffs, review, delivery).
- Motion concept: almost none: fades on scroll, no scripted scenes.
- Mobile concept: excellent by default; single column, large type.
- Advantages: very distinctive among agent sites; best reading experience; lowest implementation
  risk; strong for FAQ, About and How it works.
- Weaknesses: under-sells the one thing that is unique (watching the work move); low conversion
  energy for a product whose value is visual; editorial restraint on the office would make it look
  like a static illustration, which the competitor set (Gather, Kumospace) already does better.

---

## Comparison

Scores 1–5 (5 best). For implementation complexity, 5 means least complex.

| Criterion | A Living Office | B Command Center | C Editorial |
| --- | --- | --- | --- |
| Brand alignment | 4: the lamp and the office are the brand's memorable element, but the game register conflicts with "not a gaming site". | 4: navy, violet and confident type match the palette; risks feeling generic without the office. | 3: honest and calm, but reduces the office to an illustration, which weakens the brand's core idea. |
| Product clarity | 3: features become room metaphors; some (usage provenance, multi-company isolation) do not fit a room. | 5: real fragments explain exactly what exists. | 3: clear prose, little product shown. |
| Distinctiveness | 5: no inspected site shows a team of AI employees working in a place. | 2: framed product UI on navy is the category default (Linear, Attio, Gumloop, Relevance). | 4: editorial agent sites are rare; CrewAI's serif hero is the nearest. |
| Conversion potential | 3: engaging, but CTAs compete with exploration and copy sits inside the scene. | 4: clear path, CTAs repeated, trust line beside the CTA. | 3: strong reading, weak "show me" moment. |
| Accessibility | 2: scroll-driven camera pans and canvas-first content work against WCAG 2.3.3 guidance and server-rendered copy. | 5: DOM-first, low motion, standard patterns. | 5: text-first, minimal motion. |
| Performance | 2: large animated surface on every page; continuous rendering. | 4: images and small SVG animations. | 5: mostly text. |
| Implementation complexity | 1: scene engine, camera, per-page room design. | 4: composes existing primitives and screenshots. | 5: typographic layouts. |
| Maintainability | 2: every product change means re-drawing rooms and scenes. | 4: screenshots must be refreshed when the app changes; otherwise stable. | 4: copy edits only; illustrations age slowly. |
| Total | 22 | 32 | 32 |

B and C tie on totals. Totals hide the most important criterion for this product: B and C both
score low on the thing that makes Agentopia worth choosing, which only A delivers. That is why the
decision is a blend, not the top scorer.

## Chosen direction: B blended with A (with two borrowings from C)

Decision (contract section 1): Direction B is the system; Direction A supplies one element, the
office in the hero and in the virtual-office feature page. Rationale against the research:

1. **Distinctiveness comes from A, and it only needs one place.** Every inspected agent platform shows
   one agent in a chat or a node graph (competitor-research cross-cutting finding 2). A scripted,
   labelled office scene where a manager plans, employees hand off and QA reviews is not on any of the
   20 sites. Putting it in the hero spends boldness where it pays. Elsewhere, B keeps the site quiet.
2. **Clarity and trust come from B.** We cannot use proof walls (contract rule 3), which 18 of 20 sites
   rely on. Our substitute is legible evidence of the mechanism: real product fragments (Linear,
   Attio), visible approvals (n8n, Attio, Gumloop), usage provenance labels (seen on no inspected
   site), and the "Scripted demo" badge. B is built from exactly those.
3. **The n8n principle joins the two.** n8n's hero visual is its own data model. Our equivalent is
   the office driven by the product's own event sentences (`describe.ts`). The hero is A in form and B
   in honesty: real floor plan, real event wording, clearly labelled as scripted.
4. **Accessibility and performance stay at B's level** because A is confined to one component with a
   pause control, an offscreen pause, a reduced-motion final frame and a stepper (contract section 6;
   `motion-references.md` section 4). No scroll-driven camera, no ambient life outside the hero.

Borrowed from C:

- **Typographic confidence.** Sora 600/700 at large sizes with tight tracking, short sentence-case
  headlines, generous paper sections for reading-heavy pages (How it works, FAQ, feature detail,
  About). This also separates us from Relevance AI's lighter Sora 400 hero, which shares our
  typeface pairing.
- **Asymmetry.** Left-aligned hero with the office on the right (not centred), uneven bento sizes,
  offset section headings on paper pages. Seven of the 20 heroes are centred (Lindy, Notion, Attio,
  Zapier, n8n, CrewAI, Raycast), including most of the agent platforms; a left-aligned split with the
  office on the right ties the layout to the content and avoids the centred-launch-page look.

Rejected from C:

- **Overly restrained motion for the office.** A still office is an illustration, and Gather and
  Kumospace already have better illustrations. The office must move to communicate "work moves from
  desk to desk". Restraint applies everywhere else.
- **Essay-length copy on the homepage.** Kept for About and FAQ only.

Rejected from A:

- Scroll-driven camera pans, ambient walking outside the hero, rooms as navigation, minimap nav,
  room metaphors for every feature page.
