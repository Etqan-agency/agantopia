# Competitor and inspiration research

Date inspected: 2026-11-02 (all sites). Author: UX research. Status: input to the marketing refactor;
the creative direction is already fixed in `frontend-refactor-plan.md` section 1.

## Method and evidence

- Public homepages were read with WebFetch (text extraction) and captured with Playwright Chromium
  using `artifacts/agentopia-frontend-refactor/scripts/competitor-shots.mjs`: 1440×900 above the fold,
  1440 full page capped at 6000 px, and 390×844 mobile. 20 sites × 3 = 60 screenshots, all saved to
  `artifacts/agentopia-frontend-refactor/screenshots/competitors/`. The per-capture log (HTTP status,
  final URL, page title, notes) is `_capture-log.json` in the same folder.
- Hero typography was read from computed styles with
  `artifacts/agentopia-frontend-refactor/scripts/competitor-type.mjs`; output in `_typography.json`.
  Font names below come from that file, not from guessing.
- No site blocked the headless browser outright. Known capture artefacts, stated so nobody
  over-reads the images:
  - Full-page captures scroll the page first. Sticky headers therefore sometimes appear overlaid
    part-way down the hero (Relevance AI, Lindy, n8n, Notion, CrewAI). That is the capture, not the
    site's layout.
  - Sticky scrollytelling sections render as long empty bands in full-page captures (n8n "See +
    understand + trust your agents", Lindy "Why Lindy feels like a real teammate", Framer, Raycast,
    Vercel's lower half). The panels are pinned and swapped on scroll; the capture shows one state.
  - Videos sometimes render as black frames or a single frame (Dify hero video, CrewAI, Kumospace).
  - Cookie banners: dismissed on n8n, Dify, Gather and others. Not dismissed on Framer ("Ok"),
    Attio ("Continue"), Langflow (IBM consent banner appearing mid-page), and a Zapier
    "How did you hear about us?" survey overlays its full capture.
  - A first Stripe capture was invalid: the cookie matcher clicked a product card containing the word
    "Accept" and opened a modal. The matcher was fixed to exact button names and Stripe was
    re-captured; only the corrected images are kept.
- Authenticated product UI was not inspected for any site. Everything said about product UX comes
  from marketing screenshots and public docs, which are curated.
- Two sites were not what the brief assumed:
  - **relay.app has shut down.** The homepage states that Relay.app shut down in September 2026 and
    all accounts, workflows and run history were deleted. It links an Internet Archive snapshot, which
    WebFetch could not fetch. Relay is recorded as a shutdown notice only.
  - **spatial.io** is now positioned as spatial computing and AI for brand experiences plus a gaming
    studio (Animal Company on Meta Quest). The page title still says "Create Immersive UGC, Virtual
    Classrooms, Experiential Marketing". It is not a virtual office product.
- `microsoft.github.io/autogen/` redirects to `/autogen/stable/` (docs site, version 0.7.5 shown in
  the version picker). It is documentation, not marketing.

A finding that affects our own type choice: Relevance AI's hero uses **Sora** for the h1 and **Inter**
for body text, the same pairing the contract picks for Agentopia. See "Cross-cutting findings".

---

## AI workforce and agent platforms

### Relevance AI

- URL: https://relevanceai.com/ · inspected 2026-11-02
- Screenshots: `relevance-ai-1440.png`, `relevance-ai-1440-full.png`, `relevance-ai-390.png`
- Positioning: "The home of the AI Workforce" (footer); hero currently sells "Invent 2.0", an agent
  that builds agents.
- Hero composition: split. Left: "Meet Invent 2.0" / "Your 24/7 AI solutions engineer" / paragraph /
  "Watch the video" + "Launch blog". Right: a blob mascot with a speech bubble ("I build, manage, and
  optimize agentic workflows."). Logo grid with "Case study" links directly under the hero.
- Typography: h1 Sora 48px, weight 400, letter-spacing -2.4px; body Inter. Light weight Sora reads
  softer than the 600/700 the contract specifies.
- Animated previews: department-tabbed use-case cards with small animated UI chips; dashboard
  mockup with KPIs (tasks run, spend, cost per task, eval pass rate).
- Above-the-fold messaging: launch announcement, not the category. A first-time visitor learns
  about a feature before learning what Relevance is.
- CTA placement: header "Talk to sales" (primary) + "Sign in"; hero CTAs are video and blog, so there
  is no sign-up CTA above the fold.
- Storytelling: a "weeks 1–2 / week 3+ / week 4+" onboarding timeline; "L1 Assisted → L4 Self-Driving"
  autonomy ladder with small node diagrams per level.
- Feature sections: use-case cards by department; "Specialist agents for every task" dashboard;
  autonomy ladder; enterprise security; 1,000+ integrations.
- Interactive demos: tabs only; the dashboard has a chat input that is decorative in the capture.
- Social proof and trust: dense. Customer logos with case-study links, video testimonial, metric
  cards ($7M pipeline, 40 hours saved), G2 4.5, SOC 2 Type II, GDPR, analyst badges.
- Pricing: footer link only. FAQ: none.
- Conversion path: sales-led ("Book a demo" repeated, "Try it out" secondary).
- Best components: the autonomy ladder (L1–L4) as a compact way to explain how much control a human
  keeps; the agent table with per-agent model and cost columns.
- Weak patterns: hero spent on a feature launch; mascot is generic; light grey body copy
  (low contrast in the screenshot); no self-serve path above the fold.
- Why it works: for enterprise buyers, the page is a proof wall, with every claim attached to a named
  customer.
- Relevance to Agentopia: direct competitor in "AI workforce" language. We cannot use proof walls
  (contract rule 3), so we must win on showing the work happening, not on logos.
- Recommendation: **Adapt** the autonomy-ladder idea as a plain explanation of our approval gates
  (what runs on its own, what waits for you). **Avoid** the launch-first hero and the mascot.

### Lindy

- URL: https://www.lindy.ai/ · inspected 2026-11-02
- Screenshots: `lindy-1440.png`, `lindy-1440-full.png`, `lindy-390.png`
- Positioning: "the AI employee that plugs into your tools, learns how you work, and takes real work
  off your plate."
- Hero composition: centred headline "Hire Lindy, / get it done." (second line in a gold gradient),
  floating integration icons on both sides, CTAs, then a large Slack-like product frame (#growth
  channel, Lindy replying with step progress and a "Pause the campaign" action button).
- Typography: Manrope 72px / 700 / -1.44px for the h1, Manrope 20px body. Friendly, rounded.
- Animated previews: Slack conversations play as scripted chat; use-case tabs swap the chat.
- Above the fold: the claim, two CTAs, "$50 in free credits • Set up in 2 minutes", G2 4.9.
- CTA placement: header "Book a demo" + "Try for free"; hero repeats them; footer CTA repeats again.
- Storytelling: the product is shown where the user already works (Slack, iMessage, email). The
  "Why Lindy feels like a real teammate" section is sticky: five numbered claims on the left
  ("Connected to everything.", "It's sat in every meeting.", "Shows up on schedule.", "Learns your
  skills.", "Its memory is yours to edit.") with one pinned visual on the right.
- Interactive demos: six tabs ("Find answers", "Build decks", ...) each with a scripted chat.
- Social proof and trust: logo marquee, testimonial grid styled as Slack and X posts, compliance
  badges (GDPR, SOC 2, HIPAA, PIPEDA), "Security by design" section.
- Pricing: on the homepage, three tiers (Free $0 with credits, Team $49.99/mo, Enterprise).
- FAQ: nine collapsible questions (what an AI employee is, credits, privacy).
- Conversion path: self-serve first, demo second; every section ends near a CTA.
- Best components: "Its memory is yours to edit" as a trust claim; the action button inside the chat
  ("Pause the campaign") showing the agent proposing and the human deciding.
- Weak patterns: gradient accent word in the headline; floating app icons as decoration; the full
  page relies on scripted chats that are not labelled as illustrative.
- Why it works: the "AI employee" metaphor is made concrete by placing it inside familiar tools.
- Relevance to Agentopia: closest message overlap ("hire", "AI employee", "learns"). Our
  differentiator is a team with a manager working in a visible office, with the user's own Claude
  Code or Codex sign-in, instead of one assistant in Slack.
- Recommendation: **Adapt** the sticky numbered-claims section for our employee profile (prompt,
  skills, knowledge, track record), with real product fragments. **Adopt** the editable-memory
  framing, which matches our approval-gated memory. **Avoid** the gradient accent word (contract
  forbids single-word colour accents) and unlabelled scripted chats.

### CrewAI

- URL: https://www.crewai.com/ (redirects to https://crewai.com/) · inspected 2026-11-02
- Screenshots: `crewai-1440.png`, `crewai-1440-full.png`, `crewai-390.png`
- Positioning: "The Enterprise Agent Build & Runtime for the work your business runs on."
- Hero composition: centred serif headline with an italic second line over a coral/pink blurred
  gradient card; below it a tilted 3D-perspective product frame (Visual/Code tabs, `Agent(role=...)`
  code) with a floating "Ask any question" chat box. Event banner across the top.
- Typography: h1 "Exposure" 60px / 300 / -2.4px (light serif), body GT Standard.
- Animated previews: hero is a video on mobile (player controls visible at 0:07) and an animated
  perspective frame on desktop.
- Above the fold: headline and subhead only; the CTA ("Book a Demo") sits below the media.
- Storytelling: four alternating text/screenshot sections (Discover, Build, Govern, Optimize), each
  with a short checklist, then a circular "Train → Run → Trace → Evaluate" loop diagram.
- Social proof: "Used by 65% of the Fortune 500", logos, metric cards (450M+ workflows per month),
  five testimonials with metrics. The open-source page cites 63% in one place and 65% in another.
- Pricing: nav link. FAQ: none.
- Conversion path: demo only on the marketing site; open source routes to docs.
- Best components: the circular improvement loop diagram is a clear model for a repeating process;
  the role/goal/backstory vocabulary on the open-source page maps to how people think about agents.
- Weak patterns: CTA below the fold; tilted 3D frames reduce legibility; inconsistent statistics.
- Why it works: serif + soft gradient sets it apart from blue-purple AI sites.
- Relevance to Agentopia: CrewAI's crews (agents with roles, tasks, a manager agent) are conceptually
  the closest to our manager + employees model. Their site never shows the crew working together;
  that gap is our opening.
- Recommendation: **Adapt** the loop diagram for our learning cycle (sources → learned notes →
  approval → memory → better work). **Avoid** tilted perspective frames and CTA-below-media.

### AutoGen

- URL: https://microsoft.github.io/autogen/ (redirects to /autogen/stable/) · inspected 2026-11-02
- Screenshots: `autogen-1440.png`, `autogen-1440-full.png`, `autogen-390.png`
- Positioning: "A framework for building AI agents and applications" (documentation site).
- Hero composition: centred title and subtitle, then stacked cards: Studio (no-code UI), AgentChat,
  Core, Extensions, each with a PyPI badge, install snippet and "Get Started".
- Typography: system font stack (-apple-system), PyData Sphinx theme.
- Animated previews, social proof, pricing, FAQ, trust signals: none.
- Conversion path: install command → Get Started docs.
- Best components: the install snippet as the CTA for a developer audience.
- Weak patterns: none relevant; it is not trying to market.
- Relevance to Agentopia: shows how a technical audience evaluates (code first). Our runner setup
  (`pnpm runner`, CLI sign-in) could get a similar copyable block on `/ai-tools`.
- Recommendation: **Adapt** the copyable command block for the local-runner page only. Otherwise
  not a design reference.

### n8n

- URL: https://n8n.io/ · inspected 2026-11-02
- Screenshots: `n8n-1440.png`, `n8n-1440-full.png`, `n8n-390.png`
- Positioning: "the platform for agents and workflows you can follow."
- Hero composition: centred "Build the agent. / Understand its workflow." on a dotted grid; below it
  a live node graph (trigger → fetch sources → merge → summarise → email) with pink connector curves
  and a "CLICK HERE" tag on an add-node button. Tabs switch the example workflow ("Process invoice",
  "Knowledge assistant", "Daily News Digest"; a refund flow with Slack approval appears on mobile).
- Typography: "n8n Baumer Uniwidth" 64px / 500 for the h1; nav and buttons in an uppercase mono style.
- Animated previews: the hero graph is interactive; on mobile it becomes a horizontally swipeable
  strip with a "← SWIPE" hint.
- Above the fold: headline, subhead, two CTAs, and the product itself (the graph).
- Storytelling: case-study tabs by person and role ("Mark, IT", "Deborah, Security") each with a
  dark workflow canvas; then sticky sections "See + understand + trust your agents" (live
  visibility, rules and human approvals, self-hosting) and "Built by you + readable by anyone".
- Social proof: logos, GitHub stars (209.1k), G2 4.7, community size, case studies.
- Trust: SOC/GDPR badges, self-hosting, SSO, RBAC, audit logs.
- Pricing: nav link only. FAQ: none on the homepage (present on `/ai-agents/`).
- Conversion path: "Get started" + "Talk to sales" repeated.
- Best components: the hero graph is the product, not a picture of it; the mobile swipe fallback;
  approval shown as a node in the graph ("Ask for approval on Slack").
- Weak patterns: all-caps mono nav reduces readability; pink-on-light connectors are low contrast.
- Why it works: the promise ("understand its workflow") and the visual are the same thing.
- Relevance to Agentopia: highest. Our hero should do for the office what n8n does for the graph:
  make the first thing you see the product working, with approval as a visible step.
- Recommendation: **Adopt** the principle "hero visual = the product's own model". **Adapt** the
  mobile swipe strip as a fallback idea for our scene stepper. **Avoid** all-caps UI type (contract
  forbids all-caps eyebrows).

### Gumloop

- URL: https://www.gumloop.com/ · inspected 2026-11-02
- Screenshots: `gumloop-1440.png`, `gumloop-1440-full.png`, `gumloop-390.png`
- Positioning: "the multiplayer AI agent builder" (per the text extraction); hero headline "Build,
  share, optimize & control agents".
- Note: WebFetch returned a machine-readable index (llms-style link lists) rather than the rendered
  page, so section-level claims below come from the screenshots.
- Hero composition: left-aligned headline with four small coloured shapes above it, two CTAs, then a
  large grey stage holding overlapping product windows: an agent list grouped by team ("Revenue":
  GTM Agent, Account Researcher; "Customer Success": Renewal Watch, Ticket Triage), an agent detail
  panel (Model "Smartest (Claude 5.5 Opus)", instructions field, Connectors with Slack/HubSpot/Gong/
  Gmail, Skills), and AI spend and model-provider charts.
- Typography: h1 Gellix 48px / 500 / -1.2px; UI text Geist Sans.
- Animated previews: an agent run card reads "Worked for 4 minutes · 38 accounts reviewed · 1
  approval pending".
- Storytelling: "Let your experts build the agents", "A real browser for every agent" (bento with
  human-in-the-loop handoff and session recordings), "Meet your team where they work" (Slack,
  Teams, email screenshots).
- Social proof: "1B+ tasks automated", "341K+ agents deployed", logo grid.
- Pricing: nav link. FAQ: not observed in the capture.
- Best components: the agent configuration panel (model, instructions, connectors, skills) is a clear
  public example of an agent profile; the run footer that states duration, scope and pending approvals.
- Weak patterns: overlapping windows get busy at 1440; decorative shapes.
- Relevance to Agentopia: strong for the employee profile and for how to phrase run summaries.
- Recommendation: **Adapt** the run footer phrasing ("worked for N minutes · N subtasks · 1 approval
  waiting") for our task cards, using real fields from our timeline. **Adapt** the layered-windows
  idea sparingly (max two frames).

### Relay.app

- URL: https://www.relay.app/ · inspected 2026-11-02
- Screenshots: `relay-1440.png`, `relay-1440-full.png`, `relay-390.png` (all show the shutdown notice)
- Status: "Relay.app has shut down." Shut down September 2026; accounts, workflows and run history
  permanently deleted; links to a July 2026 Internet Archive snapshot that WebFetch could not fetch.
- Nothing about its former human-in-the-loop marketing can be verified from today's inspection, so
  none is claimed here.
- Relevance to Agentopia: a reminder that users trust tools that keep data local and under their
  control. Agentopia's local runner and the user's own CLI sign-in are a real advantage to state
  plainly, without overclaiming.
- Recommendation: no design reference.

### Zapier

- URL: https://zapier.com/ · inspected 2026-11-02
- Screenshots: `zapier-1440.png`, `zapier-1440-full.png`, `zapier-390.png`
- Positioning: "Welcome to automation in the agentic era" (visible h1, Degular Display 56px / 500).
  WebFetch returned a different, metadata-like heading ("Zapier: Build and Govern AI Workflows,
  Agents, and Apps"); the screenshot is treated as the source for visible copy.
- Hero composition: small uppercase eyebrow "THE NEXT GENERATION OF ZAPIER", centred headline,
  "Start free with email" + "Start free with Google", then a wide video frame over a blurred
  landscape. The first frame shows a card "We fixed 'Support ticket reply assistant' before you had
  to"; the full capture shows an "Agentically managed" toggle.
- Storytelling: "Build anywhere. Run on Zapier. Govern in one place."; alternating feature rows with
  accordions; a "Fluid Determinism" slider with four positions (Deterministic → Deterministic + AI →
  Deterministic + agent → Fully agentic) that swaps an illustration; an audit-log screenshot under
  "Govern in one place".
- Social proof: logo strip, a large pull-quote (Crunchbase), customer stories with metrics.
- Trust: SOC 2 Type II, SOC 3, GDPR, CCPA, SSO/SCIM, audit records.
- Pricing: nav link. FAQ: none.
- Best components: the self-repair message ("we found the gap and patched it", naming the failed step
  and the fix) is a good example of how to explain error recovery; the four-step autonomy slider.
- Weak patterns: uppercase eyebrow; marketing survey popup over content; video-only hero.
- Relevance to Agentopia: our retry/attempt limits and usage-limit parking can be explained the same
  way: plain sentences naming what failed and what happens next.
- Recommendation: **Adapt** the error-recovery copy pattern. **Adapt** the slider as a stepper for our
  approval settings. **Avoid** the uppercase eyebrow and intrusive survey.

### Dify

- URL: https://dify.ai/ · inspected 2026-11-02
- Screenshots: `dify-1440.png`, `dify-1440-full.png`, `dify-390.png`
- Positioning: "The Platform for Production-Ready Agentic Workflows."
- Hero composition: left-aligned 96px headline with the middle line in electric blue, a long
  paragraph, a concrete sculpture photograph on the right; the hero video frame below rendered black
  with an "AI" badge in the capture. At 1440×900 the hero shows no CTA button other than the header's
  "Get Started".
- Typography: Söhne 96px / 500 / -2.855px. Very large, very tight.
- Storytelling: logo + testimonial grid with a stone-stack photograph; "Deploy Dify Your Way" three
  tiers (Cloud, Enterprise, Community Edition with GitHub stars); "Everything Teams Need..." with a
  vertical tab list (Workflow, Agent, Knowledge Pipeline, Plugins, Publish & Monitor) driving one
  large screenshot.
- Trust: SOC 2 Type II, ISO 27001, GDPR, SSO/SAML, RBAC, audit logs.
- Pricing: nav link plus deployment tiers. FAQ: none.
- Best components: vertical tab list beside a single screenshot; "Turn Prompt Logic Into a Visible
  Execution Path" as a headline for the workflow tab.
- Weak patterns: single blue colour-accent words in headlines (forbidden by our contract); stock
  sculpture photography unrelated to the product; hero CTA missing above the fold at 1440.
- Relevance to Agentopia: the vertical tab + single screenshot is a good fit for `/product`.
- Recommendation: **Adapt** the tabbed screenshot pattern. **Avoid** colour-accent words and unrelated
  photography.

### Langflow

- URL: https://www.langflow.org/ · inspected 2026-11-02
- Screenshots: `langflow-1440.png`, `langflow-1440-full.png`, `langflow-390.png`
- Positioning: "a powerful tool to build and deploy AI agents and MCP servers."
- Hero composition: dark page; the headline "Stop fighting your tools" sits inside an outlined box
  that is wired by a glowing connector to a component panel (Input, Model, API Key, Temperature
  slider). Community counts in the header (GitHub, Discord, X, YouTube).
- Typography: Chivo 56px / 400 / -2px.
- Storytelling: a single connector line threads down the page from section to section ("Drag. Drop.
  Deploy.", "Run, Share and Collaborate.", "Agents at your service", "Flow as an API"), linking
  real-looking component cards; a "Swap and compare" before/after slider.
- Social proof: logo strip, community counts, three testimonials at the bottom.
- Trust: "enterprise-grade, secure cloud" only. Pricing: none. FAQ: not reached in the extraction.
- Best components: the page-long connector is a memorable way to make a node-based product feel
  continuous.
- Weak patterns: glow and neon gradients; the IBM consent banner interrupts mid-page.
- Relevance to Agentopia: a connector that visually links sections could carry "the task moves from
  desk to desk" through the homepage, but it competes with the office for attention.
- Recommendation: **Adapt** once, in the "how it works" section only. **Avoid** glow/neon styling
  (contract: no glow halos except the lamp).

---

## Virtual office inspiration

### Gather

- URL: https://www.gather.town/ · inspected 2026-11-02
- Screenshots: `gather-1440.png`, `gather-1440-full.png`, `gather-390.png`
- Positioning: "A virtual workspace that feels refreshingly human."
- Hero composition: split. Left: headline, subhead, one CTA "Create Your Space", three G2 badges and
  "4.8 out of 5 on G2". Right: a pixel-art top-down office map bleeding off the right edge, with name
  tags and status dots over avatars ("Daud, Aaron, Philip", "Katrina"), plus a segmented control
  "Office / Meetings / Chat" that swaps the visual (the full capture shows the Meetings video grid).
- Typography: Graphik Semibold 56px / 600 / -2.8px.
- Storytelling: "Collaborate instantly" shows the map with a floating side card (profile "Som /
  Active / Wave", calendar block) and four steps ("See who's free", "Wave them over", "Hear nearby
  conversations", "Join in a click"); "Minimize distractions" three cards; a before/after
  "Traditional Collaboration Tools" vs "Gather's Workspace"; testimonials; a three-step "first 30
  days" onboarding (2 minutes, 1 click, immediately); FAQ.
- Social proof: G2 badges and rating, "5,000+ distributed teams", named testimonials.
- Trust: privacy link only. Pricing: 30-day free trial, "View Plans". FAQ: five questions.
- Mobile: the map drops below the headline and badges, so the first screen shows no office.
- Best components: map + floating profile card; status chips on avatars; before/after comparison;
  "time to value" onboarding steps.
- Weak patterns: on mobile the product disappears below the fold; badges crowd the hero.
- Why it works: the map instantly says "place". Name tags make it about people, not furniture.
- Relevance to Agentopia: our office is the same visual category, with a different meaning: the
  people are AI employees and the status is real execution state. The `docs/design-research.md`
  critique ("large open maps feel empty") still applies.
- Recommendation: **Adapt** map + floating profile card (our employee popover) and status chips
  (our pills). **Avoid** pixel-art styling (our art is procedural and flatter) and pushing the office
  below the fold on mobile.

### Kumospace

- URL: https://www.kumospace.com/ · inspected 2026-11-02
- Screenshots: `kumospace-1440.png`, `kumospace-1440-full.png`, `kumospace-390.png`
- Positioning: "The #1 virtual office software" / "Meet, Motivate, and Manage Remote Teams".
- Hero composition: saturated green background; left: uppercase tracked eyebrow (rendered as the h1
  element: AkkuratLL 16px / 700 / 3.2px tracking), headline in Sharp Grotesk, long paragraph, two CTAs;
  right: a photographic top-down office with circular video avatars and status labels ("Chelsea
  Benett · Grabbing a snack, brb").
- Storytelling: chat/screen-share/spatial-audio slides; NASA quote; G2 badge; device mockups;
  a dark "Company culture happens here" run of alternating videos (watercooler, games, gong for
  milestones); people analytics screenshot; integrations; FAQ (four questions).
- Social proof: big-brand logos, NASA quote, G2, press logos.
- Pricing: nav link; FAQ says free to sign up.
- Mobile: map pushed off the first screen by a long paragraph and two stacked CTAs.
- Best components: free-text status under the avatar ("Grabbing a snack, brb") is a human way to
  show state; "celebrate milestones" (gong) is a small delight beat.
- Weak patterns: the h1 element is an eyebrow (semantic and SEO issue); heavy video; brand-logo wall.
- Relevance to Agentopia: our employees could show a one-line current activity under the name, taken
  from the event description ("Drafting the landing page copy"), not a canned status.
- Recommendation: **Adapt** the activity line and a restrained delivery beat. **Avoid** the h1 misuse
  and the long hero paragraph.

### Spatial

- URL: https://www.spatial.io/ · inspected 2026-11-02
- Screenshots: `spatial-1440.png`, `spatial-1440-full.png`, `spatial-390.png`
- Positioning: "Powering Experiences For The World's Leading Brands": spatial computing and AI for
  branded virtual worlds, plus a games studio.
- Hero composition: full-bleed blurred 3D brand-world screenshot with avatars; heavy title-case
  headline; single CTA "Enterprise Log In". No h1 element was found on the page.
- Content: brand logos, a "Flagship Studio" block (Animal Company metrics).
- Pricing, FAQ, trust: none.
- Relevance to Agentopia: low. It shows the gaming/metaverse register the contract tells us to avoid
  ("Not a gaming site").
- Recommendation: **Avoid**. Use only as a negative reference for 3D avatar worlds.

---

## Premium SaaS references

### Linear

- URL: https://linear.app/ · inspected 2026-11-02
- Screenshots: `linear-1440.png`, `linear-1440-full.png`, `linear-390.png`
- Positioning: "The product development system for teams and agents."
- Note: WebFetch received only "Loading…" (client-rendered); everything below comes from screenshots
  and computed styles.
- Hero composition: near-black page; left-aligned two-line headline, one-line subhead, a "New Loops"
  link on the right; no hero button (only "Sign up" in the header). Directly below, a full-width
  product frame: sidebar (Inbox, My issues, Reviews, Initiatives, Projects; favourites including
  "Agent tasks", "Agent Insights") and an issue with an activity log ("Triage Intelligence added the
  labels...") and an agent panel ("Worked for 10 sec", "Pushed and opened a draft PR", diff summary).
- Typography: Inter Variable 64px / weight 510 / -1.408px; subhead 15px. Restraint: the type is not
  huge; the product frame does the work.
- Storytelling: "A new species of product tool." (two-tone sentence, second clause in grey); three
  wireframe 3D illustrations labelled "FIG 0.1 / 0.2 / 0.3"; sections "Intake and integrations",
  "Planning and monitoring", "AI and automations", each pairing a short heading with dense UI
  fragments (Slack thread → issue board; timeline; agent sessions from several tools).
- Social proof: logo row. Pricing: nav link. FAQ: none.
- Mobile: the desktop product frame is cropped at the right edge rather than shrunk, so text stays
  legible.
- Best components: real UI at legible scale; agents shown as first-class participants in the
  activity log (the same phrasing style as a human); the two-tone sentence headline; mobile cropping.
- Weak patterns: no explicit hero CTA; grey-on-black secondary text is low contrast in places.
- Why it works: confidence. The page assumes the product is self-evidently good and lets you read it.
- Relevance to Agentopia: the reference for Direction B. Our task timeline already writes events in
  sentences; Linear shows how to present that as marketing.
- Recommendation: **Adopt** legible product fragments and the activity-log presentation, and crop
  rather than shrink on mobile. **Adapt** two-tone headlines carefully (colour on a full clause, not
  a single word). **Avoid** omitting the hero CTA.

### Vercel

- URL: https://vercel.com/ · inspected 2026-11-02
- Screenshots: `vercel-1440.png`, `vercel-1440-full.png`, `vercel-390.png`
- Positioning: "Agentic Infrastructure".
- Hero composition: three columns: headline + "Deploy now" / "Talk to sales" on the left, a large
  black triangle (the logo shape) with a soft halo in the centre, three short lines on the right
  ("For coding agents", "To ship apps and agents", "Automated by agents"). Logo row at the bottom.
- Typography: Geist Sans 64px / 400 / -3.84px; Geist Mono for small labels.
- Storytelling: each section pairs a large headline with a customer UI fragment and a feature list
  (Notion AI chat, Zapier's site). The lower half of the full capture rendered empty (lazy content not
  triggered), so later sections were not seen.
- Pricing: nav link. FAQ: none.
- Best components: the three-column hero with a compact claims list; generous whitespace.
- Weak patterns: brand-mark-as-hero only works for a famous mark.
- Relevance to Agentopia: whitespace and restraint for paper sections; not the hero model.
- Recommendation: **Adapt** the short right-hand claims list as our hero trust line format. **Avoid**
  logo-as-hero.

### Raycast

- URL: https://www.raycast.com/ · inspected 2026-11-02
- Screenshots: `raycast-1440.png`, `raycast-1440-full.png`, `raycast-390.png`
- Positioning: "Your shortcut to everything."
- Hero composition: centred headline over large diagonal red light bars on black; "Download for Mac"
  with requirement text in mono ("macOS Tahoe and Apple Silicon required", "Install via Homebrew").
- Typography: Inter 64px / 600.
- Storytelling: a macOS window showing clipboard history; an interactive keyboard graphic ("It's not
  about saving time."); extension cards by category tabs; "Meet your new virtual assistant" with an
  agent chat that syncs Linear tasks to Things, showing step lines ("Fetching assigned tasks",
  "Create Things task"); feature grid; community.
- Pricing: nav link. FAQ: footer link.
- Best components: tool-call step lines in the AI demo; requirement text next to the download CTA.
- Weak patterns: atmospheric hero art says nothing about the product.
- Relevance to Agentopia: the requirement line maps to our trust line ("Works with Claude Code and
  OpenAI Codex through your own sign-in...").
- Recommendation: **Adopt** stating requirements next to the CTA. **Adapt** the step-line pattern for
  our event feed. **Avoid** abstract hero art.

### Notion

- URL: https://www.notion.so/ (redirects to https://www.notion.com/) · inspected 2026-11-02
- Screenshots: `notion-1440.png`, `notion-1440-full.png`, `notion-390.png`
- Positioning: "Where teams and agents [verb] together."
- Hero composition: centred 96px headline whose verb rotates inside a lavender pill (captured as
  "Jam", "Think", "Create"); two CTAs; hand-drawn character illustrations at the frame edges; a
  product frame of a team workspace whose sidebar lists named agents ("Task routing agent", "Q&A
  agent", "Reporting agent", "IT help desk", "Onboarding buddy") above a task board.
- Typography: NotionInter 96px / 600 / -4.6px.
- Storytelling: "AI where your team works." three-card bento (Capture knowledge, Find answers,
  Automate busywork) with UI; five use-case links; three photo testimonials; stats band; final CTA.
- Pricing: nav link. FAQ: none.
- Best components: agents listed in the sidebar like teammates; short bento with real UI.
- Weak patterns: rotating word in the headline harms screen-reader output and reading (the computed
  h1 text contained the line break and the current word).
- Relevance to Agentopia: confirms that "agents as named teammates" is now mainstream; our office
  must be the distinctive part, not the naming.
- Recommendation: **Adapt** the named-roster idea for the employee list. **Avoid** rotating headline
  words.

### Framer

- URL: https://www.framer.com/ · inspected 2026-11-02
- Screenshots: `framer-1440.png`, `framer-1440-full.png`, `framer-390.png`
- Positioning: "the pro website builder with a world-class design agent."
- Hero composition: black; left-aligned headline (GT Walsheim Medium 54px / 500 / -2.16px), two
  CTAs and an MCP link; a large stage playing a product video (code file with a blue glow, then a 3D
  image carousel) with a 0:36 timestamp.
- Storytelling: the full editor UI with an agent panel ("Thinking…", "Adding images…", changes list);
  three short columns (Start with the agent, Refine on the canvas, Publish); "Build your website
  together with agents" where inactive sub-sections are dimmed and the active one is lit as you
  scroll, beside a pinned agent chat; an MCP terminal panel; platform features; showcases.
- Pricing: nav link. FAQ: none.
- Best components: dim-inactive / light-active scroll focus; agent panel with progress lines and a
  "Changes" list.
- Weak patterns: blue glow frame; cookie notice overlapping content.
- Relevance to Agentopia: the dimming technique is useful for the six-step "how it works" page.
- Recommendation: **Adapt** dim/active focus with a reduced-motion fallback that shows all steps at
  full contrast. **Avoid** the glow.

### Stripe

- URL: https://stripe.com/ · inspected 2026-11-02 (re-captured after the cookie-matcher fix)
- Screenshots: `stripe-1440.png`, `stripe-1440-full.png`, `stripe-390.png`
- Positioning: "Financial infrastructure to grow your revenue."
- Hero composition: a live counter ("Global GDP running on Stripe: 1.74267461%"), a long two-tone
  headline (first sentence navy, continuation in slate), CTAs "Get started" + "Sign up with Google",
  the animated colour ribbon on the right, logo marquee.
- Typography: sohne-var 48px / weight 300 / -0.96px. Light weight at large size.
- Storytelling: bento of product cards, each with a miniature real UI (checkout, billing meter,
  agentic commerce chat, card, globe, connected accounts table) and an expand button; a product
  recommendation form; dark metrics band; case studies; "What's happening" carousel.
- Social proof: heavy (logos, metrics, case studies). Pricing: "See what you'll pay" link.
  FAQ: none.
- Best components: bento cards with miniature real UI and an expand affordance; the two-tone
  headline.
- Weak patterns: the page is extremely long (15,438 px); live counter only works with real data.
- Relevance to Agentopia: the bento of miniature product UI suits our features index.
- Recommendation: **Adapt** bento with miniature real UI (agent card, timeline, learning queue,
  building). **Avoid** live counters (we have no public metrics) and length.

### Attio

- URL: https://attio.com/ · inspected 2026-11-02
- Screenshots: `attio-1440.png`, `attio-1440-full.png`, `attio-390.png`
- Positioning: "Welcome to agentic revenue."
- Hero composition: centred headline (interDisplay 64px / 600 / -1.28px), two CTAs, then a product
  frame that cycles between views. The 1440 capture shows a workflow "Runs" tab: "Run #7 · Attempt
  #12 · Re-run", "Live" toggle, "Trigger manually", "Run history" (Run #14 just now ✓, #13 paused,
  #12 ✓, #11 retrying) and a node marked "Completed". The full capture shows a "Good morning, Alex"
  home view. On mobile the CTA becomes an email field + "Send me a demo".
- Storytelling: a sticky left index (Build pipeline, Convert leads, Run sales motions, Forecast
  revenue, Retain and expand) driving a long sequence of two-tone headed sections, each with one
  dense UI fragment (tables, a trigger → agent → branch workflow, a pipeline board, a drafted email
  "for approval": "The move's ready. You make the call.").
- Social proof: logo grid, usage metrics, customer stories, changelog dated October 29, 2026.
- Pricing: nav link. FAQ: none.
- Best components: run history with attempts and re-run; "The move's ready. You make the call."
  as approval copy; sticky index for long storytelling.
- Weak patterns: cookie notice covers the frame on mobile; the page is long.
- Relevance to Agentopia: the run-history vocabulary matches our execution lifecycle (attempt limits,
  retry, cancel). Approval copy is directly transferable in spirit.
- Recommendation: **Adopt** the run history presentation for our task timeline fragment. **Adapt** the
  sticky index for `/how-it-works`. **Adapt** the approval line in our own words.

---

## Cross-cutting findings

1. **The category headline is crowded.** "Teams and agents" (Linear, Notion), "AI employee" (Lindy),
   "AI workforce" (Relevance), "agentic" (Zapier, Dify, Vercel, Attio). A headline about agents is no
   longer distinctive. "Build your own AI company." is different in kind (ownership, a company),
   and the office is the proof. Keep it.
2. **Almost nobody shows agents working together.** Every site shows one agent in a chat or a node
   graph. CrewAI talks about crews but shows code. Gather and Kumospace show a place, but with people.
   The combination (a place + a team of AI employees + a manager handing work around) was not seen on
   any inspected site. That is our distinctive element.
3. **Proof walls dominate; we cannot use them.** 18 of 20 pages (all but AutoGen and the Relay shutdown notice) lean on logos, metrics, ratings or community counts. Our
   substitute is evidence of the mechanism: visible approvals, usage provenance labels, the
   "scripted demo" badge, "what is real vs simulated". Plain honesty is itself rare on these pages.
4. **Approval is shown as part of the flow**: n8n (approval node), Lindy (Pause the campaign button),
   Gumloop ("1 approval pending"), Attio ("You make the call"), Zapier ("Fluid Determinism"). Our
   hero should show one approval beat or at least mention it in the feed.
5. **Typography.** Tight negative tracking at 48–96px is universal. Weights split between light
   (Stripe 300, CrewAI 300, Relevance 400) and medium/semibold (Linear 510, Attio 600, Notion 600).
   **Relevance AI uses Sora + Inter**, our exact pairing. Recommendation: keep Sora (contract) but use
   it at 600/700 as specified, with -0.02 to -0.03em tracking, which looks different from Relevance's
   400 weight at -0.05em. Do not switch fonts on this basis alone; record it as a known risk.
6. **Mobile.** Virtual-office sites (Gather, Kumospace) lose the office below the fold on mobile.
   Linear crops its UI instead of shrinking it. For us: keep the hero copy short enough that the top
   of the office appears in the first 390×844 viewport, and crop the floor plan to the active rooms
   rather than scaling the whole 40×24 grid down to unreadable size.
7. **Colour-accent words** (Lindy gold gradient, Dify blue) are common and look templated. The
   contract already bans them; two-tone full-clause headlines (Linear, Stripe, Attio) are the
   acceptable alternative.

## Summary table

| Site | Type | Recommendation | Main takeaway |
| --- | --- | --- | --- |
| Relevance AI | competitor | Adapt | autonomy ladder; avoid launch-first hero |
| Lindy | competitor | Adapt | sticky numbered claims; editable memory framing |
| CrewAI | competitor | Adapt | loop diagram for the learning cycle |
| AutoGen | framework docs | Adapt (narrow) | copyable command for runner setup |
| n8n | competitor | Adopt | hero visual = product's own model; approval as a step |
| Gumloop | competitor | Adapt | agent config panel; run summary footer |
| Relay.app | shut down | none | shutdown notice only |
| Zapier | competitor | Adapt | error-recovery sentences; autonomy stepper |
| Dify | competitor | Adapt | vertical tabs + one screenshot |
| Langflow | competitor | Adapt (once) | page-long connector |
| Gather | office | Adapt | map + floating profile; status chips |
| Kumospace | office | Adapt | activity line under avatars |
| Spatial | 3D worlds | Avoid | negative reference |
| Linear | premium SaaS | Adopt | legible product fragments; activity log; mobile crop |
| Vercel | premium SaaS | Adapt | compact claims list |
| Raycast | premium SaaS | Adopt/Adapt | requirement line by CTA; step lines |
| Notion | premium SaaS | Adapt | named roster; avoid rotating words |
| Framer | premium SaaS | Adapt | dim/active scroll focus |
| Stripe | premium SaaS | Adapt | bento with miniature real UI |
| Attio | premium SaaS | Adopt/Adapt | run history; approval copy; sticky index |
