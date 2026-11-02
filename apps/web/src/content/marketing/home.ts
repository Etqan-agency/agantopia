import { CTA_CREATE_COMPANY, CTA_WATCH_DEMO, closingCtas } from "./ctas";
import { HOME_FAQ } from "./faq";
import type { HomeContent } from "./types";

export const HOME: HomeContent = {
  metaTitle: "Agentopia: build your own AI company",
  metaDescription:
    "Hire AI employees, hand the manager a task and watch the work move through a live office. Runs on your own Claude Code or Codex sign-in.",

  hero: {
    headline: "Build your own AI company.",
    headlineSecond: "Then watch it work.",
    support:
      "Hire AI employees, give them an office, and hand the manager a task. One place to see who is doing what, and to review it before it counts.",
    ctas: {
      primary: { ...CTA_CREATE_COMPANY, dataCta: "hero-primary" },
      secondary: { ...CTA_WATCH_DEMO, dataCta: "hero-secondary" },
    },
    trustLine: "Works with Claude Code and OpenAI Codex through your own sign-in. Nothing runs on a model until you connect one.",
    visual: {
      key: "hero:office",
      caption:
        "Illustration: one person stands at a gold-edged rail in the foreground, watching a team of twelve AI employees in a warm spotlight, grouped by role, with gold lamps above the ones who are working.",
      label: "Illustration",
    },
  },

  explainer: {
    heading: "An entire AI team. One workspace.",
    lead: "Agentopia puts the people, the plan and the proof of work in one place, so you can see who is doing what and check it before it counts.",
    points: [
      { title: "Employees with real job descriptions", body: "Each employee has a structured prompt, skills and knowledge you can read and edit. Nothing is hidden in a black box." },
      { title: "A manager that plans and delegates", body: "Give the manager a task. It breaks the work into subtasks, assigns each to the best-fit specialist and asks for a review." },
      { title: "An office you can watch", body: "Lamps turn on when work starts and employees walk over to hand work off. Every movement comes from a recorded event." },
      { title: "Your tools, your sign-in", body: "Work runs through Claude Code or OpenAI Codex on your own machine, signed in with your own account." },
    ],
  },

  workforce: {
    heading: "Meet your AI workforce",
    lead: "Start from six role templates and shape each employee to your company. The roles below are examples of what you can build.",
    roles: [
      {
        id: "manager",
        name: "AI Manager",
        capabilities: [
          "Breaks a request into subtasks with dependencies",
          "Assigns work by specialty, availability and demonstrated experience",
          "Reviews deliverables against a definition of done",
          "Writes a final report that cites artifacts and reviewers",
        ],
        sampleTasks: ["Plan the signup redesign and assign the work", "Review the research note before it goes to design"],
        room: "Manager's office",
        template: "Engineering Manager",
        isPreset: true,
      },
      {
        id: "developer",
        name: "Developer",
        capabilities: [
          "Implements frontend features in React, Next.js and TypeScript",
          "Builds backend features with migrations and tests",
          "Checks work with type-check, lint and tests where practical",
          "Hands off with a summary of changed files",
        ],
        sampleTasks: ["Add a password strength meter to the signup form", "Add pagination to the projects API"],
        room: "Development",
        template: "Frontend Engineer or Backend Engineer",
        isPreset: true,
      },
      {
        id: "designer",
        name: "Designer",
        capabilities: [
          "Writes interaction specs engineers can build from",
          "Defines colour, type and spacing tokens",
          "Reviews flows against usability heuristics",
          "Covers empty, loading and error states with accessibility notes",
        ],
        sampleTasks: ["Spec the empty state of the task list", "Review the settings page for usability issues"],
        room: "Design",
        template: "Product Designer",
        isPreset: true,
      },
      {
        id: "researcher",
        name: "Researcher",
        capabilities: [
          "Writes research notes with a source URL and retrieval date for every claim",
          "Compares options in a structured way",
          "Separates facts from inference",
          "Ends with a recommendation and a confidence level",
        ],
        sampleTasks: ["Compare three charting libraries for the dashboard", "Summarise what changed in the latest framework release notes"],
        room: "Research",
        template: "Research Analyst",
        isPreset: true,
      },
      {
        id: "qa",
        name: "QA Engineer",
        capabilities: [
          "Writes focused test plans",
          "Writes and runs Playwright and Vitest tests when allowed",
          "Reviews other employees' work against the definition of done",
          "Returns approve or reject with reproducible evidence",
        ],
        sampleTasks: ["Write a test plan for the signup flow", "Verify the pagination fix and report pass or fail"],
        room: "QA lab",
        template: "QA Engineer",
        isPreset: true,
      },
      {
        id: "marketing",
        name: "Marketing Specialist",
        capabilities: [
          "Drafts page copy and content briefs with a short rationale",
          "Researches audiences and competitors with cited sources",
          "Outlines articles from existing research notes",
          "Hands drafts to a reviewer before anything is final",
        ],
        sampleTasks: ["Draft three headline options for the launch page", "Outline a comparison article from the research note"],
        room: "Research (follows the template you start from)",
        template: "Configured from the Research Analyst template",
        isPreset: false,
        note: "Marketing is a role you configure yourself, not a preset template. Hire from a template, then rewrite the prompt fields and skills for marketing work.",
      },
    ],
    note: "Example roles. The six templates are management, frontend, backend, UI/UX, QA and research, and you can edit everything about every employee.",
  },

  officeAlive: {
    heading: "The office comes alive",
    lead: "Every employee has a desk in a room that matches their specialty. As a task moves, the office shows it.",
    beats: [
      { id: "arrives", title: "A task arrives", body: "You hand the manager a task. The manager's lamp turns on and the task appears in the activity feed." },
      { id: "plans", title: "The manager plans and delegates", body: "The task is split into subtasks. Each specialist who picks one up starts thinking at their desk." },
      { id: "works", title: "Specialists get to work", body: "Gold lamps mark live work. Status labels show who is working, waiting for approval or blocked." },
      { id: "handoff", title: "Work changes hands", body: "When a subtask is done, the employee walks it over and hands it off, and the next specialist picks it up." },
      { id: "review", title: "Review and delivery", body: "A reviewer checks the result against the definition of done, approves it or sends it back, and the task completes." },
    ],
    visual: { key: "viz:office-spotlight", caption: "Illustrative office scene showing lamps, status labels and a handoff.", label: "Illustrative data" },
  },

  oneTask: {
    heading: "One task, many specialists",
    lead: "You describe the outcome once. The manager turns it into a plan that several employees can work on in order.",
    steps: [
      { title: "You write the task", body: "For example: add a password strength meter to signup." },
      { title: "The manager plans", body: "Research, design, build and test become subtasks, linked so each starts when its inputs are ready." },
      { title: "Specialists contribute", body: "The researcher gathers guidance, the designer specs the states, the developer builds it." },
      { title: "QA reviews", body: "The QA engineer checks the result against the definition of done. If it falls short, the work goes back with notes." },
      { title: "You get the result", body: "A summary, the artifacts and the full timeline of who did what." },
    ],
    visual: { key: "viz:workflow", caption: "Illustrative workflow: one task split into linked subtasks across four specialists.", label: "Illustrative data" },
  },

  learning: {
    heading: "Agents that learn over time",
    lead: "Employees build up knowledge in their specialty and a record of what they actually did. You decide what they keep.",
    stages: [
      { id: "initial", title: "Initial skills", body: "Each template comes with starter skills. Assigned proficiency is shown separately from experience the employee has demonstrated." },
      { id: "docs", title: "Documentation", body: "On a schedule, employees read allowlisted official docs in their specialty and draft reference notes." },
      { id: "github", title: "GitHub knowledge", body: "They read READMEs, docs and changelogs from allowlisted repositories. Repository code is never executed." },
      { id: "experience", title: "Task experience", body: "After a real task, a short postmortem is drafted as a lesson for that employee and project." },
      { id: "reviewed", title: "Reviewed knowledge", body: "You approve or reject each draft. Only approved notes become verified memory used in later work." },
    ],
    distinctions: [
      { term: "Knowledge ingestion", body: "Fetching and summarising allowlisted sources. Unchanged pages are skipped, and nothing is trusted yet." },
      { term: "Persistent memory", body: "Approved notes, retrieved by full-text search and cited when the employee works on a task." },
      { term: "Verified skills", body: "Skills backed by recorded work, kept apart from the proficiency you assigned at hiring." },
      { term: "Performance history", body: "Reviews and outcomes recorded as evidence. Rank changes are based on this evidence, and you can override them." },
    ],
    notRetrained: "The model itself is not retrained. Employees get better context, not new weights.",
    visual: { key: "viz:learning-journey", caption: "Illustrative learning journey from starter skills to reviewed knowledge.", label: "Illustrative data" },
  },

  multiCompany: {
    heading: "Create multiple AI companies",
    lead: "Your account is a building. Each floor hosts one company with its own team and its own work.",
    points: [
      { title: "Floors you can add", body: "Add a floor for each company and switch between them in the office." },
      { title: "Separate by default", body: "Employees, tasks, knowledge and settings belong to one company. Access is checked on every request." },
      { title: "Different setups", body: "Run each company with its own employees, approval rules and provider connections." },
    ],
    visual: { key: "viz:building", caption: "Illustrative building with several floors, one company per floor.", label: "Illustrative data" },
  },

  tools: {
    heading: "Built around your AI tools",
    lead: "Agentopia does not ship its own model. It runs the coding agents you already use, under rules you set.",
    cards: [
      { id: "claude-code", title: "Claude Code", body: "The unmodified Claude Code CLI, signed in with your own Claude plan on your machine.", href: "/ai-tools/claude-code" },
      { id: "codex", title: "OpenAI Codex", body: "The Codex CLI, signed in with your own ChatGPT account on your machine.", href: "/ai-tools/codex" },
      { id: "runner", title: "Local runner", body: "A small program you start on your computer. It picks up jobs, runs the CLI in a per-company workspace and reports back.", href: "/ai-tools" },
      { id: "api-key", title: "API-key mode", body: "Optional. Add your own Anthropic or OpenAI key, acknowledge it is billed separately, and runs go through Agentopia's worker.", href: "/ai-tools" },
      { id: "limits", title: "Usage limits", body: "When a provider reports a limit, tasks wait for the reset instead of failing or switching to a paid key." },
      { id: "control", title: "You stay in control", body: "Allowed tools, permission mode, max turns and timeouts apply to every run. Shell and network access need your approval." },
    ],
    subscriptionStatement:
      "Subscription work runs only through your own Claude Code or Codex CLI, signed in by you on your own machine through the local runner. Agentopia never offers a claude.ai or ChatGPT login and never stores your tokens. Your remaining plan quota is not visible to Agentopia. API-key mode is explicit and billed by the provider.",
    visual: { key: "viz:integrations", caption: "Illustrative provider cards showing connection and runner status.", label: "Illustrative data" },
  },

  oversight: {
    heading: "Human oversight and control",
    lead: "Employees do the work. You keep the final say.",
    points: [
      { title: "Review", body: "Every deliverable is reviewed by a QA employee or the manager against a definition of done before the task completes." },
      { title: "Approvals", body: "Risky actions such as shell commands, network access or workspace edits wait in Agentopia for your decision." },
      { title: "Progress", body: "Task status, the activity feed and the office all show the same live state." },
      { title: "Error states", body: "Blocked, failed and waiting tasks say why, for example a missing approval or an offline runner." },
      { title: "Provider limits", body: "Usage limits and expired sign-ins are shown per provider, with reset times only when the provider reports them." },
      { title: "Cancellation", body: "Cancel any unfinished task. A local run is stopped on your machine as well." },
      { title: "Activity history", body: "Each task keeps an ordered timeline of persisted events, artifacts and usage records." },
    ],
  },

  featureShowcase: {
    heading: "The product, up close",
    lead: "Real screens from a seeded Agentopia company running on the simulated provider. Pick an area to see where it lives in the app.",
  },

  useCases: {
    heading: "Use cases",
    lead: "Examples of work a team of specialised AI employees can take on, with a person reviewing the result.",
    items: [
      { id: "software", title: "Software development", body: "From a feature request to reviewed code: research, a design spec, implementation and QA.", href: "/use-cases/software-development", specialists: ["Manager", "Researcher", "Designer", "Developer", "QA Engineer"] },
      { id: "marketing", title: "Marketing", body: "Cited audience research, draft copy and a review step before anything is final.", href: "/use-cases/marketing", specialists: ["Manager", "Researcher", "Marketing Specialist"] },
      { id: "research", title: "Research", body: "Comparisons and feasibility notes with sources, confidence levels and a recommendation.", href: "/use-cases/research", specialists: ["Manager", "Researcher"] },
      { id: "qa", title: "Quality assurance", body: "Test plans and reviews that return approve or reject with evidence.", href: "/use-cases/quality-assurance", specialists: ["Manager", "QA Engineer", "Developer"] },
      { id: "design-review", title: "Design reviews", body: "Heuristic and accessibility reviews of existing screens, turned into specs a developer can pick up.", specialists: ["Designer", "Developer"] },
      { id: "docs", title: "Technical documentation", body: "Summaries of documentation and changelogs, written up as notes your team can cite.", specialists: ["Researcher", "Manager"] },
    ],
  },

  howItWorks: {
    heading: "How it works",
    lead: "Six steps from an empty building to reviewed work.",
    steps: [
      { id: "create", title: "Create your company", body: "Sign up, name your company and place it on a floor of your building." },
      { id: "hire", title: "Hire your team", body: "Hire from role templates, then edit prompts, skills and knowledge." },
      { id: "connect", title: "Connect your AI tools", body: "Connect Claude Code or Codex with your own sign-in through the local runner, or add an API key. Until then, tasks run as a labelled simulation." },
      { id: "assign", title: "Hand the manager a task", body: "Describe the outcome. The manager plans subtasks and assigns them." },
      { id: "watch", title: "Watch the office work", body: "Follow progress in the office, the activity feed or the list view. Approve risky actions when asked." },
      { id: "review", title: "Review the result", body: "Read the summary and artifacts, then approve what employees learned along the way." },
    ],
  },

  faq: { heading: "Questions, answered", items: HOME_FAQ },

  finalCta: {
    heading: "Your next company starts here.",
    body: "Create a company, hire your first employees and give the manager something to do. Or watch the scripted demo first.",
    ctas: closingCtas("home"),
  },
};
