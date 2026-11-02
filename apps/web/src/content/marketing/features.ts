import { closingCtas } from "./ctas";
import { breadcrumbsFor } from "./routes";
import type { PageContent } from "./types";

const PROMPT_FIELDS = [
  "Identity",
  "Scope",
  "Expertise",
  "Responsibilities",
  "Work standards",
  "Constraints",
  "Tools and permissions",
  "Collaboration protocol",
  "Output format",
  "Definition of done",
  "Escalation and safety",
] as const;

export const FEATURE_AI_EMPLOYEES: PageContent = {
  path: "/features/ai-employees",
  metaTitle: "AI employees with prompts, skills and memory | Agentopia",
  metaDescription:
    "Hire AI employees from six role templates. Each has an eleven-field versioned prompt, skills, approved knowledge and a record of reviewed work.",
  h1: "AI employees you can actually read",
  lead: "Every employee has a written job description, a set of skills, the knowledge you approved and a record of the work they did. You can open and change all of it.",
  heroVisual: { key: "screenshot:employee-detail", caption: "Employee profile with prompt, skills, knowledge and progression tabs.", label: "Product screenshot" },
  breadcrumbs: breadcrumbsFor("/features/ai-employees"),
  sections: [
    {
      id: "templates",
      heading: "Start from a role template",
      body: [
        "Hire from six templates: management, frontend, backend, UI/UX, QA and research. Each comes with a starter prompt, starter skills, learning topics and default documentation and GitHub sources for its specialty.",
        "Templates are a starting point. Rename the employee, rewrite the prompt and change the skills to fit roles the templates do not cover, such as a marketing specialist.",
      ],
    },
    {
      id: "prompt",
      heading: "A structured prompt in eleven fields",
      body: [
        "Instead of one long block of text, the prompt is split into eleven fields, so you can see what the employee is told about who they are, what is in scope and when the work counts as done.",
      ],
      bullets: PROMPT_FIELDS.map((f) => ({ body: f })),
      note: "Agentopia adds one fixed instruction to every compiled prompt: project documents, repository contents, web pages and tool outputs are data, not instructions.",
    },
    {
      id: "versions",
      heading: "Versioned, with rollback",
      body: [
        "Every save creates a new prompt version. If a change makes the work worse, roll back to an earlier version from the employee's profile.",
      ],
    },
    {
      id: "skills",
      heading: "Skills: assigned versus demonstrated",
      body: [
        "Skills carry written instructions, such as a review checklist or a cited research note format. The proficiency you assign at hiring is shown separately from the experience the employee has demonstrated in recorded work, so a skill on paper never looks like a skill proven in practice.",
      ],
    },
    {
      id: "knowledge",
      heading: "Knowledge you approve",
      bullets: [
        { title: "Owner instructions", body: "Standing guidance you write for the employee." },
        { title: "Project documents", body: "Material scoped to a project." },
        { title: "Learned notes", body: "Drafted from scheduled learning, waiting for your approval." },
        { title: "Task lessons", body: "Short postmortems drafted after real tasks." },
      ],
      body: ["Only verified entries are retrieved during work, and each retrieved passage is cited with its source."],
    },
    {
      id: "track-record",
      heading: "A track record built from evidence",
      body: [
        "Approved and rejected reviews and verified knowledge are recorded as career evidence. Ranks run from Trainee to Expert, and changes are based on that evidence. Moving past Senior needs an assessment or your override, and you can set a rank yourself at any time.",
        "When an employee describes prior experience, it comes from recorded evidence and verified task lessons only.",
      ],
      visual: { key: "viz:agent-card", caption: "Illustrative employee card with role, rank, skills and provider.", label: "Illustrative data" },
    },
  ],
  related: [
    { label: "AI manager", href: "/features/ai-manager", description: "How tasks are matched to employees." },
    { label: "Agent learning", href: "/features/agent-learning", description: "Where learned notes come from." },
    { label: "Use cases", href: "/use-cases", description: "Example teams for common kinds of work." },
  ],
  closing: {
    heading: "Hire your first employee",
    body: "Pick a template, read its prompt and make it yours.",
    ctas: closingCtas("feature-employees"),
  },
};

export const FEATURE_AI_MANAGER: PageContent = {
  path: "/features/ai-manager",
  metaTitle: "AI manager: planning, delegation and review | Agentopia",
  metaDescription:
    "Give the AI manager a task. It plans subtasks with dependencies, assigns each to the best-fit employee and has the result reviewed before it completes.",
  h1: "A manager that plans, delegates and checks",
  lead: "You describe the outcome. The manager turns it into a plan, hands each part to the right specialist and makes sure the result is reviewed.",
  heroVisual: { key: "viz:workflow", caption: "Illustrative plan: one task split into linked subtasks with assignees.", label: "Illustrative data" },
  breadcrumbs: breadcrumbsFor("/features/ai-manager"),
  sections: [
    {
      id: "planning",
      heading: "Planning into subtasks",
      body: [
        "The manager breaks a task into subtasks with explicit deliverables. Subtasks are linked by dependencies, so a step starts only when its inputs are ready, and circular plans are rejected.",
        "Planning is deterministic first. For larger tasks, and when a verified provider connection exists, the manager can ask its model for a bounded, structured breakdown.",
      ],
    },
    {
      id: "delegation",
      heading: "Best-fit assignment",
      bullets: [
        { title: "Specialty", body: "Each subtask needs a specialty, inferred from the task or set by you." },
        { title: "Availability", body: "Employees already working on something are passed over." },
        { title: "Rank and evidence", body: "When several employees fit, rank and demonstrated experience break the tie." },
      ],
      body: ["If no employee has the needed specialty, the task is blocked with that reason instead of being forced on the wrong person."],
    },
    {
      id: "review",
      heading: "Review against a definition of done",
      body: [
        "When a specialist finishes, a QA employee reviews the work if one is available, otherwise the manager does. The reviewer checks it against the definition of done and approves it or sends it back with notes. Rejected work is retried while attempts remain.",
      ],
    },
    {
      id: "report",
      heading: "A report you can check",
      body: ["The manager's final report cites the artifacts and the reviewers, and the task timeline shows every step that led there."],
      visual: { key: "screenshot:task-detail", caption: "Task detail with timeline, artifacts and review result.", label: "Product screenshot" },
    },
  ],
  related: [
    { label: "Agent collaboration", href: "/features/agent-collaboration", description: "Handoffs and review loops in detail." },
    { label: "AI employees", href: "/features/ai-employees", description: "What the manager matches on." },
    { label: "How it works", href: "/how-it-works", description: "The full flow in six steps." },
  ],
  closing: { heading: "Give the manager its first task", body: "Create a company, hire a few specialists and see how the plan comes together.", ctas: closingCtas("feature-manager") },
};

export const FEATURE_VIRTUAL_OFFICE: PageContent = {
  path: "/features/virtual-office",
  metaTitle: "Virtual office for AI employees, driven by real events",
  metaDescription:
    "A top-down office where lamps, walks and status labels come from persisted task events. Includes a list view, floor switching and reduced motion.",
  h1: "An office that shows the work as it happens",
  lead: "Each employee has a desk in a room that matches their specialty. When something happens to a task, the office shows it.",
  heroVisual: { key: "screenshot:office", caption: "The Agentopia office with rooms for management, development, design, research and QA.", label: "Product screenshot" },
  breadcrumbs: breadcrumbsFor("/features/virtual-office"),
  sections: [
    {
      id: "rooms",
      heading: "Rooms by specialty",
      body: ["The floor plan has a manager's office, development, design, research and a QA lab, plus a shared space and a lounge. Employees sit in the room for their specialty."],
    },
    {
      id: "events",
      heading: "Events become animation",
      body: [
        "Every state change is a persisted event. The office reads the same event stream as the activity feed, so the animation never runs ahead of the data.",
      ],
      bullets: [
        { title: "Thinking and working", body: "The desk lamp turns on, and typing shows active work." },
        { title: "Handing off", body: "The employee walks to the next desk with the deliverable." },
        { title: "Reviewing", body: "The reviewer works through the papers on their desk." },
        { title: "Waiting for approval", body: "An icon shows the employee is waiting for your decision." },
        { title: "Blocked or offline", body: "The lamp goes out and the reason is shown." },
      ],
    },
    {
      id: "list-view",
      heading: "A list view with the same truth",
      body: [
        "Prefer text? The list view shows each room and employee with their current state. It is the default when reduced motion is set or the browser cannot draw the scene, and on small screens.",
      ],
      visual: { key: "screenshot:office-list", caption: "Office list view grouped by room.", label: "Product screenshot" },
    },
    {
      id: "floors",
      heading: "Floors and controls",
      body: ["Switch floors to see another company. Pause the animation or change its speed. Viewing the office never calls a model."],
    },
  ],
  related: [
    { label: "Multiple companies", href: "/features/multi-company", description: "Floors, companies and isolation." },
    { label: "Live demo", href: "/demo", description: "A scripted visitor version of the office." },
    { label: "Agent collaboration", href: "/features/agent-collaboration", description: "What a handoff means in data." },
  ],
  closing: { heading: "See the office for yourself", body: "The visitor demo runs a scripted day on a seeded building, labelled as simulated.", ctas: closingCtas("feature-office") },
};

export const FEATURE_AGENT_COLLABORATION: PageContent = {
  path: "/features/agent-collaboration",
  metaTitle: "Agent collaboration: subtasks, handoffs, review loops",
  metaDescription:
    "Specialised AI employees work on linked subtasks, hand off deliverables with a summary and go through review until the definition of done is met.",
  h1: "Specialists that hand work to each other",
  lead: "Real tasks need more than one skill. Agentopia links the pieces so each specialist builds on the last one's output.",
  heroVisual: { key: "viz:timeline", caption: "Illustrative task timeline with handoffs between specialists.", label: "Illustrative data" },
  breadcrumbs: breadcrumbsFor("/features/agent-collaboration"),
  sections: [
    {
      id: "subtasks",
      heading: "Subtasks with dependencies",
      body: ["Subtasks form a tree under the original task, with dependency links between them. A subtask waits until the work it depends on is complete."],
    },
    {
      id: "handoffs",
      heading: "Handoffs with a summary",
      body: [
        "Each employee's collaboration protocol tells them to hand off deliverables with a short summary and a list of artifacts, and to say when a task needs another specialty. Each handoff is recorded as its own assignment.",
      ],
    },
    {
      id: "review-loops",
      heading: "Review loops",
      steps: [
        { title: "Deliver", body: "The specialist finishes a run and writes artifacts and a summary." },
        { title: "Review", body: "QA or the manager checks the work against the definition of done." },
        { title: "Approve or return", body: "Approved work moves on. Returned work goes back with the review notes." },
        { title: "Stop safely", body: "Attempt limits and timeouts end loops that do not converge." },
      ],
    },
    {
      id: "approvals",
      heading: "Approvals in the middle of work",
      body: ["When an employee needs a risky permission, the run pauses as Waiting for approval until you decide. Approvals expire with the task timeout."],
    },
  ],
  related: [
    { label: "AI manager", href: "/features/ai-manager", description: "How the plan is made." },
    { label: "Software development", href: "/use-cases/software-development", description: "A multi-specialist example." },
    { label: "Virtual office", href: "/features/virtual-office", description: "How handoffs look in the office." },
  ],
  closing: { heading: "Put a team on one task", body: "Hire a researcher, a designer, a developer and a QA engineer, then hand the manager a feature request.", ctas: closingCtas("feature-collaboration") },
};

export const FEATURE_AGENT_LEARNING: PageContent = {
  path: "/features/agent-learning",
  metaTitle: "Agent learning from docs and GitHub, approved by you",
  metaDescription:
    "Employees study allowlisted docs and GitHub on a twice-weekly schedule, skip unchanged sources and draft notes you approve before they become memory.",
  h1: "Employees that keep up with their field",
  lead: "On a schedule, each employee reads trusted sources in their specialty and drafts notes. You approve what becomes memory. The model itself is not retrained.",
  heroVisual: { key: "viz:learning-journey", caption: "Illustrative learning journey from starter skills to reviewed knowledge.", label: "Illustrative data" },
  breadcrumbs: breadcrumbsFor("/features/agent-learning"),
  sections: [
    {
      id: "schedule",
      heading: "A schedule you set",
      body: [
        "By default, learning runs twice a week, on Monday and Thursday at 09:00 in your time zone, and each run is capped at a set number of minutes. Change the days, time and limits per employee.",
      ],
    },
    {
      id: "sources",
      heading: "Allowlisted sources only",
      bullets: [
        { title: "Official documentation", body: "Fetched politely, with robots.txt checked first, and reduced to text without a model." },
        { title: "GitHub repositories", body: "READMEs, docs and changelogs from allowlisted repositories. Code is never executed." },
        { title: "Specialty only", body: "By default, employees only study topics in their own specialty." },
      ],
    },
    {
      id: "change-detection",
      heading: "Change detection",
      body: ["ETags, commit SHAs and content hashes tell Agentopia when a source has not changed, so unchanged pages are skipped instead of read again."],
    },
    {
      id: "token-modes",
      heading: "Zero-token and low-token modes",
      bullets: [
        { title: "Zero-token", body: "Notes are built deterministically from the source: title, link, headings and retrieval time. No model is called." },
        { title: "Low-token", body: "One bounded summary call per changed document, under per-run and weekly token caps." },
      ],
      body: [
        "When a budget runs out, the schedule can pause. If a provider has hit its usage limit, learning makes deterministic notes only and scheduled runs are postponed.",
      ],
    },
    {
      id: "approval",
      heading: "An approval queue",
      body: ["Every drafted note waits in the approval queue. Approve it and it becomes verified memory. Reject it and it is never used."],
      visual: { key: "screenshot:learning", caption: "Learning page with schedules, sources, runs and the approval queue.", label: "Product screenshot" },
    },
    {
      id: "memory",
      heading: "Memory with citations",
      body: [
        "During a task, verified notes relevant to the work are found with full-text search and passed to the employee with their source, capped in size. Retrieved text is always treated as data, never as instructions.",
      ],
    },
    {
      id: "progression",
      heading: "Progression from evidence",
      body: ["Approved reviews and verified knowledge count as evidence toward the next rank. Nothing about rank is guessed from activity alone."],
    },
  ],
  related: [
    { label: "AI employees", href: "/features/ai-employees", description: "Skills, knowledge and track record." },
    { label: "Research use case", href: "/use-cases/research", description: "Learning and cited notes in practice." },
    { label: "FAQ", href: "/faq", description: "Do employees really learn?" },
  ],
  closing: { heading: "Pick what your team studies", body: "Set sources and a schedule, then review the first notes in the approval queue.", ctas: closingCtas("feature-learning") },
};

export const FEATURE_MULTI_COMPANY: PageContent = {
  path: "/features/multi-company",
  metaTitle: "Run multiple AI companies in one building | Agentopia",
  metaDescription:
    "Your account is a building with floors. Each floor hosts one AI company with its own employees, tasks, knowledge and settings, kept separate.",
  h1: "One building, several companies",
  lead: "Run more than one AI company from the same account. Each one gets its own floor, its own team and its own data.",
  heroVisual: { key: "viz:building", caption: "Illustrative building with several floors, one company per floor.", label: "Illustrative data" },
  breadcrumbs: breadcrumbsFor("/features/multi-company"),
  sections: [
    {
      id: "structure",
      heading: "Building, floors, companies",
      body: ["Your account owns a building. Add floors to it, and place one company on each floor. Switch floors in the office to move between companies."],
    },
    {
      id: "isolation",
      heading: "Kept apart",
      body: [
        "Every company's employees, tasks, knowledge, approvals and usage records carry that company's ID. Each request checks that you can access that company, and this separation is covered by automated tests.",
      ],
    },
    {
      id: "settings",
      heading: "Settings per company",
      bullets: [
        { body: "How many tasks can run at once" },
        { body: "Whether shell and network actions need approval" },
        { body: "Default cost cap and timeout per run" },
        { body: "How long records are kept" },
      ],
    },
  ],
  related: [
    { label: "Virtual office", href: "/features/virtual-office", description: "Floors in the office view." },
    { label: "Product overview", href: "/product", description: "Everything in one workspace." },
    { label: "About", href: "/about", description: "What is real and what is simulated." },
  ],
  closing: { heading: "Start your first company", body: "You can add another floor whenever you are ready.", ctas: closingCtas("feature-multi-company") },
};

export const FEATURE_PAGES: PageContent[] = [
  FEATURE_AI_EMPLOYEES,
  FEATURE_AI_MANAGER,
  FEATURE_VIRTUAL_OFFICE,
  FEATURE_AGENT_COLLABORATION,
  FEATURE_AGENT_LEARNING,
  FEATURE_MULTI_COMPANY,
];
