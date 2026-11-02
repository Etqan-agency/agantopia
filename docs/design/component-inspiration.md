# Component inspiration library

Date: 2026-11-02. Author: UX research. Evidence: `docs/design/competitor-research.md` and the
screenshots in `artifacts/agentopia-frontend-refactor/screenshots/competitors/` (paths below are
relative to that folder). Each pattern names where it was observed, why it works, the accessibility
and performance cost, and how Agentopia should build its own version. Nothing here copies another
site's layout, art or copy; the "Agentopia adaptation" column is the brief for our version.

Component names in `code` refer to the contract (`frontend-refactor-plan.md` sections 3–4).
Event sentences quoted for Agentopia come from `apps/web/src/office/describe.ts`, so the marketing
copy uses the product's own words.

## 1. Marketing patterns

### 1.1 Animated workflow diagram

- Observed: n8n hero node graph (`n8n-1440.png`; mobile swipe strip `n8n-390.png`); Attio
  trigger → agent → branch flow (`attio-1440-full.png`); Relevance AI per-level node diagrams
  (`relevance-ai-1440-full.png`).
- Principle: the diagram is the product's own data model, so seeing it teaches the product. Motion
  is limited to "something travels along an edge", which reads as cause and effect.
- Accessibility / performance: SVG paths + DOM labels keep text selectable and translatable. n8n's
  pale pink edges on light grey are low contrast; edges carrying meaning need 3:1 against the
  background (WCAG 1.4.11). Animate `stroke-dashoffset` only while visible.
- Agentopia adaptation: not a node editor. The graph is the task plan: manager card at the top,
  subtasks as cards with dependency edges, each card with assignee avatar and status `Pill`. Edges use
  `AnimatedConnector` (violet on navy, lavender when active, gold dot travelling only for the active
  handoff). Labels are the subtask titles. Static version: the same graph fully drawn with status
  pills, which is already informative. Lives in `viz/` as the "workflow" component on
  `/features/ai-manager` and `/features/agent-collaboration`.

### 1.2 Product spotlight (a real UI fragment, large and legible)

- Observed: Linear issue + agent panel (`linear-1440.png`); Gumloop agent config
  (`gumloop-1440.png`); Attio run history (`attio-1440.png`); Lindy Slack frame (`lindy-1440.png`).
- Principle: real fragments at near 1:1 scale are believable in a way illustrations are not; one
  fragment per section keeps focus.
- Accessibility / performance: screenshots need real `alt` text describing what the fragment shows;
  rebuilt-in-HTML fragments are better (crisp, themable, readable by screen readers) but must not
  look interactive if they are not. Use `next/image` with explicit sizes to avoid CLS.
- Agentopia adaptation: `ScreenshotFrame` with captured screenshots of our real screens
  (`/employees/[id]` Prompt tab, `/tasks/[id]` timeline, `/learning` approval queue,
  `/integrations` usage with provenance labels). Captions say what is real. Where we rebuild a
  fragment in HTML for animation, mark it with `DemoBadge` "Illustrative data".

### 1.3 Interactive feature tabs

- Observed: Dify vertical tab list driving one screenshot (`dify-1440-full.png`); Lindy use-case
  tabs (`lindy-1440-full.png`); Gather "Office / Meetings / Chat" segmented control
  (`gather-1440.png`); Relevance AI department tabs (`relevance-ai-1440-full.png`); Raycast
  extension categories (`raycast-1440-full.png`).
- Principle: tabs compress five features into one viewport; a single large visual beats five small
  ones.
- Accessibility / performance: use the WAI-ARIA tabs pattern (roving tabindex, arrow keys,
  `aria-selected`, `aria-controls`). Do not auto-rotate tabs (Gather's control appears to switch on
  its own; the full capture landed on "Meetings"); if any rotation is used, pause on hover/focus and
  under reduced motion. Lazy-load non-active panel images.
- Agentopia adaptation: "feature tabs" in `viz/` for `/product`: Employees, Manager, Office,
  Learning, Usage. Each panel is one real screenshot + three sentences. On mobile, tabs become an
  accordion (each panel stacked), not a horizontal scroller.

### 1.4 Screenshot reveal

- Observed: Framer's large stage under the hero (`framer-1440-full.png`); Notion hero frame rising
  under the logo strip (`notion-1440-full.png`); Linear full-width frame (`linear-1440-full.png`).
- Principle: the hero promises, the frame below proves; a small entrance (fade + rise) signals
  "this is the product".
- Accessibility / performance: entrance only once, opacity/transform only, no scale-from-small on
  large panels (MDN names scaling large objects as a vestibular trigger; see
  `motion-references.md`). The frame must occupy its final space from first paint (no CLS).
- Agentopia adaptation: our hero already shows the office, so the reveal belongs to section two on
  inner pages: `MotionReveal` around `ScreenshotFrame`, 8px rise, 300–400 ms ease-out.

### 1.5 Sticky storytelling (pinned visual, scrolling claims)

- Observed: Lindy five numbered claims beside one pinned visual (`lindy-1440-full.png`, rendered as
  empty band); n8n "See + understand + trust your agents" (`n8n-1440-full.png`); Attio sticky left
  index (`attio-1440-full.png`).
- Principle: the reader controls pace by scrolling; one visual changes state per claim, so the claim
  and its proof are always side by side.
- Accessibility / performance: content must exist in DOM order for screen readers (claim then
  visual description). Use CSS `position: sticky` with IntersectionObserver to pick the active step;
  no scroll-jacking. Below 900px, unpin: each claim followed by its own visual.
- Agentopia adaptation: `/features/ai-employees`: claims "A prompt you can read and version",
  "Skills with demonstrated proficiency", "Knowledge that waits for your approval", "A track record
  from real tasks", with the pinned visual being the employee profile changing tab (Prompt → Skills
  → Knowledge → Progression). Numbering is allowed only if the steps are a sequence (contract); here
  they are not, so no numbers.

### 1.6 Scrollytelling (scroll drives a scene)

- Observed: Framer dims inactive sub-sections and lights the active one (`framer-1440-full.png`);
  Langflow's single connector threading the whole page (`langflow-1440-full.png`).
- Principle: scroll position becomes a timeline; the user feels progress through a process.
- Accessibility / performance: scroll-linked animation is exactly what WCAG 2.3.3 targets. Provide a
  reduced-motion path where every step is shown at full contrast and the connector is static.
  Scroll-linked animations should be hardware accelerated (Motion `useScroll` with transforms) and
  must not block scrolling.
- Agentopia adaptation: `/how-it-works` six steps (create company → hire → connect a tool → give the
  manager a task → watch the office → review the work). A single vertical connector runs between the
  steps; the step in view is fully opaque, others at 60%. This is the one place we use the
  Langflow-like continuous line. Never on the homepage, where the office is the motion.

### 1.7 Process timeline

- Observed: Relevance AI "Weeks 1–2 / Week 3+ / Week 4+" (`relevance-ai-1440-full.png`); Gather
  "2 Minutes / 1 Click / Immediately" (`gather-1440-full.png`); CrewAI loop
  "Train → Run → Trace → Evaluate" (`crewai-1440-full.png`).
- Principle: a few labelled steps with time or effort cues reduce perceived setup cost.
- Accessibility / performance: an ordered list (`<ol>`) with visible numbers is the correct
  semantics; it is static and cheap.
- Agentopia adaptation: two uses. (a) Onboarding: the real five-step `/onboarding` flow (account →
  company/floor → provider → model/permissions → test task); no time claims unless measured.
  (b) Learning cycle as a loop: allowlisted sources → change detection → learned notes → your
  approval → verified memory → cited in later work. Use a loop only for the learning cycle; it is
  genuinely cyclic (twice-weekly schedules).

### 1.8 Bento grid

- Observed: Stripe product bento with miniature real UI and expand buttons
  (`stripe-1440-full.png`); Notion three-card bento (`notion-1440-full.png`); Gumloop browser bento
  (`gumloop-1440-full.png`).
- Principle: unequal card sizes create hierarchy; miniature UI inside each card turns a feature list
  into a product tour you can scan.
- Accessibility / performance: each card is a link or contains one; the whole card should not be a
  nested-interactive trap. Grid collapses to one column on mobile in reading order.
- Agentopia adaptation: homepage "What's inside" bento (paper section): one large card (the office
  spotlight), and smaller cards for employee profile, manager plan, timeline with approvals, learning
  queue, building/floors/companies, usage with provenance. Every miniature is either a real
  screenshot crop or an HTML fragment labelled "Illustrative data".

### 1.9 Node graph

- Observed: n8n (`n8n-1440.png`), Langflow component wiring (`langflow-1440.png`), Attio workflow
  (`attio-1440-full.png`).
- Principle: nodes and edges are the shared visual language of agent tools; users read them without
  instruction.
- Risk for us: node graphs make Agentopia look like a workflow builder, which it is not. Our model is
  people in rooms. Use graphs only for the plan (1.1) and the org chart, never as the hero.
- Agentopia adaptation: the existing React Flow org chart (`/organization`) can be screenshotted for
  `/features/multi-company`; no new node editor visuals.

### 1.10 Before / after

- Observed: Gather "Traditional Collaboration Tools" vs "Gather's Workspace"
  (`gather-1440-full.png`); Langflow "Swap and compare" slider (`langflow-1440-full.png`).
- Principle: contrast makes the value obvious without metrics.
- Accessibility / performance: draggable sliders need a keyboard-operable range input and a
  text equivalent; two static columns are simpler and fully accessible.
- Agentopia adaptation: two static columns on `/product`: "One assistant in a chat" (you paste, you
  check, you remember) vs "A company you own" (the manager plans, employees hand off, QA reviews, you
  approve, everything is logged). No disparaging competitor names; no invented time savings.

### 1.11 Floating panels

- Observed: Gather map with floating profile and calendar card (`gather-1440-full.png`); Linear agent
  panel over the issue (`linear-1440-full.png`); CrewAI floating chat box (`crewai-1440.png`).
- Principle: a panel over the scene shows detail without leaving context, which mirrors how the real
  app works (`docs/design-research.md`: panels slide over the office).
- Accessibility / performance: a popover opened by click must be reachable by keyboard (employees in
  the hero are buttons), focus moves into it, Escape closes it, and it has a label. Do not trap
  focus on hover-only panels.
- Agentopia adaptation: hero employee popover (contract section 6): name, role, skills, provider,
  state, current activity line (1.11b below). One floating panel at a time; panels never cover the
  manager's desk during a handoff scene.
- 1.11b Activity line (from Kumospace's "Grabbing a snack, brb", `kumospace-1440.png`): one line under
  the name, taken from the latest event, e.g. "Started working on ‘Landing page copy’".

### 1.12 Step-by-step explanation inside a demo

- Observed: Raycast AI step lines ("Fetching assigned tasks", "Create Things task",
  `raycast-1440-full.png`); Lindy step progress in Slack (`lindy-1440.png`); Framer agent panel
  ("Thinking…", "Adding images…", `framer-1440-full.png`).
- Principle: visible steps make an agent's work legible and trustworthy.
- Accessibility / performance: append lines as text; use `aria-live="polite"` only after the user
  starts playback; keep at most N lines visible with "show all".
- Agentopia adaptation: the hero event feed, using `describeEvent` sentences: "Riley picked up
  ‘Competitor scan’", "Riley handed ‘Competitor scan’ to Sam", "Quinn approved ‘Landing page’".
  Mobile shows the latest three lines (contract).

### 1.13 Product tour

- Observed: Notion use-case links leading to tours (`notion-1440-full.png`); Gather "See Gather in
  action" live office tours (`gather-1440-full.png`); Lindy "Book a demo".
- Principle: a low-commitment way to see the product before signing up.
- Agentopia adaptation: our tour already exists: `/demo` (scripted, labelled, no account). Every
  marketing page's secondary CTA is "Watch the office work" → `/demo`. No booked demos (no sales
  destination exists).

### 1.14 Integration diagram

- Observed: Relevance AI "Connect to 1,000+ apps" logo wall; n8n "The USB-C for your AI stack"
  with floating app icons (`n8n-1440-full.png`); Langflow integration chip wall
  (`langflow-1440-full.png`); Lindy floating icons (`lindy-1440.png`).
- Principle: breadth reassures.
- Our constraint: we integrate with exactly two execution tools (Claude Code, OpenAI Codex) via the
  local runner, plus an explicit API-key mode. A wall would be dishonest.
- Agentopia adaptation: "integration showcase" in `viz/` is a small architecture diagram: Agentopia
  (web + worker) → your local runner on your machine → Claude Code / Codex CLI signed in with your
  own account. Labels state what never happens ("no claude.ai or ChatGPT login inside Agentopia").
  Product names as text, not logos.

## 2. Product UX patterns

Only public pages and docs were available; authenticated UIs were not inspected. "Observed" means
seen in a marketing screenshot or documented in public docs. For each, the Agentopia note says what
already exists in our product (per contract section 5) and how the marketing site should show it.

| Area | What was observable | Source | Agentopia position |
| --- | --- | --- | --- |
| Agent creation | Relevance AI docs: create an agent from a description (Invent), clone from a marketplace, or build from scratch; tools built in a no-code builder; knowledge from files, Drive, SharePoint, Notion, websites. Gumloop: agents grouped by team in a sidebar. CrewAI: role, goal, backstory; tasks with expected output. | https://relevanceai.com/docs/get-started/introduction (fetched 2026-11-02); `gumloop-1440.png`; https://www.crewai.com/open-source (fetched 2026-11-02) | We hire from six role templates and edit everything. Show "hire" as choosing a role card, then the editable profile. Do not imply a marketplace (unsupported). |
| Agent profile | Gumloop panel: model, instructions, connectors, skills. Lindy: "Learns your skills", "Its memory is yours to edit". Notion: named agents in a sidebar. | `gumloop-1440.png`; `lindy-1440-full.png`; `notion-1440.png` | Our profile is richer: eleven-field versioned prompt with rollback, skills with proficiency vs demonstrated, knowledge (instructions, project docs, learned notes awaiting approval), track record, rank. Lead with versioning and "demonstrated" skills; competitors show neither. |
| Task assignment | n8n and Attio show triggers starting flows; Linear shows an issue delegated to an agent with an activity log; Lindy is assigned by @mention in Slack. | `n8n-1440.png`; `attio-1440-full.png`; `linear-1440.png`; `lindy-1440.png` | We assign to the manager, who plans subtasks with dependencies and best-fit assignment. Show the plan appearing (1.1), not a trigger. |
| Team management | Relevance AI "workforces" link agents on a canvas with handoffs (docs). CrewAI crews with an optional manager agent (open-source page). Gather/Kumospace show human teams in rooms. | Relevance docs; CrewAI open-source page; `gather-1440.png`; `kumospace-1440.png` | Building → floors → companies, rooms per role. The office is the team view. Multi-company isolation is a real, tested feature worth one section. |
| Workflow visibility | n8n "Open any step, see what it does"; replay runs (claims on https://n8n.io/ai-agents/, fetched 2026-11-02). Attio run history with attempts. Zapier audit log screenshot. | `n8n-1440-full.png`; `attio-1440.png`; `zapier-1440-full.png` | Task timeline of persisted events, artifacts, summary; the office animated from the same events. Say "the office and the timeline show the same events". |
| Status indicators | Gather status dots and labels on avatars; Kumospace free-text status; Attio run icons (✓, paused, retrying); Linear status icons in properties. | `gather-1440.png`; `kumospace-1440.png`; `attio-1440.png`; `linear-1440.png` | Our nine visual states (Idle, Thinking, Working, Handing off, Reviewing, Waiting for approval, Blocked, Completed, Offline) plus the lamp. Pills must carry text, not colour alone (WCAG 1.4.1). Gold lamp = live work, as in the contract. |
| Human approval | n8n human review for tool calls: workflow pauses, request shows tool name and parameters, approve runs it, deny cancels and informs the AI; nine channels; timeouts not documented. Dify Human Input node: web app or email, form fields, buttons route branches, default expiry 3 days with optional timeout branch. Lindy "Pause the campaign" action. Gumloop "1 approval pending". Attio "The move's ready. You make the call." | https://docs.n8n.io/advanced-ai/human-in-the-loop-tools/ and https://docs.dify.ai/en/guides/workflow/node/human-input (both fetched 2026-11-02); `lindy-1440.png`; `gumloop-1440-full.png`; `attio-1440-full.png` | We gate risky actions behind approvals, plus QA/manager review against a definition of done. Show both in the hero feed ("Sam is waiting for approval: …", "Approval granted on …"). The approval beat is the strongest trust signal we can show honestly. |
| Execution logs | Attio: "Run #7 · Attempt #12 · Re-run", run history. Linear: agent "Worked for 10 sec", diff summary. Gumloop: "Worked for 4 minutes · 38 accounts reviewed". Zapier: self-repair note naming the failed step. | `attio-1440.png`; `linear-1440-full.png`; `gumloop-1440-full.png`; `zapier-1440.png` | We have attempts, timeouts, retry, cancel, artifacts, and usage records with provenance (provider-reported vs estimated vs unavailable). Provenance labels are unique among the sites inspected; show one usage row with its label. |
| Memory / learning | CrewAI memory docs: unified memory with scopes, recency/importance scoring, consolidation, source tags and private flag, inspection helpers. Lindy: memory stored as editable files. Relevance AI: knowledge from connected sources. No site showed a scheduled learning loop with approval. | https://docs.crewai.com/en/concepts/memory (fetched 2026-11-02); `lindy-1440-full.png`; Relevance docs | Twice-weekly learning from allowlisted docs and GitHub, change detection, token caps, notes awaiting approval, verified memory with citations, rank progression from evidence. Never say "retraining" (unsupported). This is a differentiator; give it its own section with the loop (1.7b). |
| Provider connections | Most sites show model pickers (Gumloop "Smartest (Claude 5.5 Opus)", Langflow model/API key fields) and long integration lists. Zapier mentions bring-your-own-model. | `gumloop-1440.png`; `langflow-1440.png`; `zapier-1440-full.png` | Ours: Claude Code and Codex through the local runner using the user's own CLI sign-in (default), or an explicit API key billed separately. Use the architecture diagram (1.14). State what is unsupported in plain words. |
| Error recovery | Zapier: "We fixed 'Support ticket reply assistant' before you had to" with the failing step and the fix. n8n: "one-step error recovery", replays (claims). Attio: retrying run icon. | `zapier-1440.png`; `n8n-1440-full.png`; `attio-1440.png` | Ours: attempt limits, retry, cancel, blocked state, and the usage-limit manager that parks tasks and resumes after provider-reported reset ("Riley is waiting for the Claude Code usage limit to reset"). Show one parked task in a feature section; it is honest and specific. |

## 3. Patterns to avoid (seen, rejected)

- Logo walls, G2 badges, metric bands, testimonials: forbidden by contract rule 3.
- Rotating words inside the headline (Notion): accessibility and reading cost.
- Colour-accent single words (Lindy, Dify): forbidden by contract section 1.
- Uppercase eyebrows (Zapier, Kumospace) and all-caps mono navigation (n8n): forbidden by contract.
- Glow frames and neon gradients (Framer, Langflow): contract allows glow only for the lamp.
- Tilted 3D perspective frames (CrewAI): hurt legibility.
- Mascots and abstract hero art (Relevance AI, Raycast, Vercel's mark): say nothing about the work.
- Auto-rotating tabs and carousels without pause.
- Pushing the main visual below the fold on mobile (Gather, Kumospace).
