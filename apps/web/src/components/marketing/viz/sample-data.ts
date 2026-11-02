/**
 * Illustrative sample data for the viz components. Names reuse the demo seed
 * (packages/db/prisma/seed.ts); everything else restates implemented behaviour from
 * src/content/marketing. No metrics, customers or outcomes. Components that render this
 * data by default show DemoBadge "Illustrative data".
 */
import { ROLE_TEMPLATES, type Rank, type VisualState } from "@agentopia/shared";
import { HOME } from "@/content/marketing/home";
import type { RoleCard } from "@/content/marketing/types";
import type { AvatarTone } from "./avatar-tone";

export const SAMPLE_TASK = "Add a password strength meter to signup";

/* ------------------------------------------------------------- profiles */

export type SkillProficiency = "Familiar" | "Proficient" | "Expert";

export type AgentSkill = {
  name: string;
  proficiency: SkillProficiency;
  /** "assigned" = set at hiring; "demonstrated" = backed by recorded, reviewed work. */
  basis: "assigned" | "demonstrated";
};

export type AgentProfile = {
  /** RoleCard id from HOME.workforce. */
  roleId: string;
  name: string;
  /** Job title (role template title). */
  title: string;
  /** Example role name shown on the site (RoleCard.name). */
  role: string;
  /** Role template the example maps to. */
  template: string;
  tone: AvatarTone;
  rank: Rank;
  status: VisualState;
  provider: string;
  room: string;
  skills: AgentSkill[];
  tasks: string[];
  learning: string[];
  capabilities: string[];
  isPreset: boolean;
  note?: string;
};

type SampleExtras = Pick<AgentProfile, "name" | "title" | "tone" | "rank" | "status" | "provider" | "skills" | "learning">;

const EXTRAS: Record<string, SampleExtras> = {
  manager: {
    name: "Morgan Hale",
    title: ROLE_TEMPLATES.MANAGEMENT.title,
    tone: "sky",
    rank: "SENIOR",
    status: "THINKING",
    provider: "Claude Code, my subscription (local runner)",
    skills: [
      { name: "Task decomposition", proficiency: "Expert", basis: "demonstrated" },
      { name: "Review checklist", proficiency: "Proficient", basis: "assigned" },
    ],
    learning: ["Drafted a task lesson from the signup review, approved", "Studied the team's definition of done, 1 note awaiting approval"],
  },
  developer: {
    name: "Lina Farouk",
    title: ROLE_TEMPLATES.FRONTEND.title,
    tone: "teal",
    rank: "JUNIOR",
    status: "WORKING",
    provider: "OpenAI Codex, my subscription (local runner)",
    skills: [
      { name: "React component standards", proficiency: "Proficient", basis: "demonstrated" },
      { name: "Accessibility review", proficiency: "Familiar", basis: "assigned" },
    ],
    learning: ["Studied Next.js docs, 2 notes awaiting approval", "Read the vercel/next.js changelog, unchanged pages skipped"],
  },
  designer: {
    name: "Sofia Reyes",
    title: ROLE_TEMPLATES.UIUX.title,
    tone: "plum",
    rank: "EXPERT",
    status: "WORKING",
    provider: "Claude Code, my subscription (local runner)",
    skills: [
      { name: "UX heuristic review", proficiency: "Expert", basis: "demonstrated" },
      { name: "Design tokens", proficiency: "Proficient", basis: "demonstrated" },
    ],
    learning: ["Studied WAI-ARIA Authoring Practices, 1 note approved", "Read shadcn-ui/ui docs, 2 notes awaiting approval"],
  },
  researcher: {
    name: "Amara Okafor",
    title: ROLE_TEMPLATES.RESEARCH.title,
    tone: "saffron",
    rank: "JUNIOR",
    status: "WAITING_APPROVAL",
    provider: "Claude Code, my subscription (local runner)",
    skills: [{ name: "Cited research note", proficiency: "Proficient", basis: "assigned" }],
    learning: ["Studied MDN Web Docs, 3 notes awaiting approval", "Drafted a task lesson from the charting comparison"],
  },
  qa: {
    name: "Kenji Watanabe",
    title: ROLE_TEMPLATES.QA.title,
    tone: "moss",
    rank: "JUNIOR",
    status: "REVIEWING",
    provider: "OpenAI Codex, my subscription (local runner)",
    skills: [
      { name: "Test plan", proficiency: "Proficient", basis: "demonstrated" },
      { name: "Review checklist", proficiency: "Proficient", basis: "assigned" },
    ],
    learning: ["Studied the Playwright docs, 1 note awaiting approval", "Read the Vitest guide, unchanged since the last run"],
  },
  marketing: {
    name: "Theo Park",
    title: "Marketing Specialist",
    tone: "brick",
    rank: "TRAINEE",
    status: "IDLE",
    provider: "Simulated provider (no model is called)",
    skills: [{ name: "Cited research note", proficiency: "Familiar", basis: "assigned" }],
    learning: ["Learning sources not set yet: add allowlisted docs for marketing work"],
  },
};

/** Builds a sample profile for a RoleCard from HOME.workforce. */
export function profileFromRole(role: RoleCard): AgentProfile {
  const x = EXTRAS[role.id] ?? EXTRAS.manager!;
  return {
    roleId: role.id,
    role: role.name,
    template: role.template,
    room: role.room,
    tasks: [...role.sampleTasks],
    capabilities: role.capabilities,
    isPreset: role.isPreset,
    note: role.note,
    ...x,
  };
}

export const SAMPLE_PROFILES: AgentProfile[] = HOME.workforce.roles.map(profileFromRole);

/* ------------------------------------------------------------- workflow */

export type WorkflowNodeCopy = { label: string; detail: string };
export type WorkflowSteps = {
  task: WorkflowNodeCopy;
  manager: WorkflowNodeCopy;
  agents: [WorkflowNodeCopy, WorkflowNodeCopy, WorkflowNodeCopy];
  review: WorkflowNodeCopy;
  delivery: WorkflowNodeCopy;
};

export const SAMPLE_WORKFLOW: WorkflowSteps = {
  task: { label: "Your task", detail: "Password strength meter" },
  manager: { label: "AI manager", detail: "Plans subtasks" },
  agents: [
    { label: "Researcher", detail: "Gathers guidance" },
    { label: "Designer", detail: "Specs the states" },
    { label: "Developer", detail: "Builds it" },
  ],
  review: { label: "Review", detail: "Definition of done" },
  delivery: { label: "Delivery", detail: "Summary, artifacts" },
};

/* ----------------------------------------------------------- delegation */

export type DelegationSubtask = {
  id: string;
  title: string;
  assignee: string;
  role: string;
  tone: AvatarTone;
  /** Short reasons, in the order the manager weighs them: specialty, availability, evidence. */
  reasons: string[];
  dependsOn?: string[];
  kind?: "work" | "review";
};

export const SAMPLE_DELEGATION: { task: string; manager: string; subtasks: DelegationSubtask[] } = {
  task: SAMPLE_TASK,
  manager: "Morgan Hale",
  subtasks: [
    {
      id: "research",
      title: "Gather password guidance",
      assignee: "Amara Okafor",
      role: "Researcher",
      tone: "saffron",
      reasons: ["Research specialty", "Available", "Cited research note skill"],
    },
    {
      id: "design",
      title: "Spec the meter states",
      assignee: "Sofia Reyes",
      role: "Designer",
      tone: "plum",
      reasons: ["UI/UX specialty", "Available", "Design tokens skill, demonstrated"],
      dependsOn: ["research"],
    },
    {
      id: "api",
      title: "Check the signup API rules",
      assignee: "Omar Nasser",
      role: "Developer (backend)",
      tone: "brick",
      reasons: ["Backend specialty", "Available", "API contract first skill"],
      dependsOn: ["research"],
    },
    {
      id: "build",
      title: "Build the meter component",
      assignee: "Lina Farouk",
      role: "Developer (frontend)",
      tone: "teal",
      reasons: ["Frontend specialty", "Available", "React component skill, demonstrated"],
      dependsOn: ["design", "api"],
    },
    {
      id: "review",
      title: "Review against the definition of done",
      assignee: "Kenji Watanabe",
      role: "QA Engineer",
      tone: "moss",
      reasons: ["QA specialty", "Available", "Review checklist skill"],
      dependsOn: ["build"],
      kind: "review",
    },
  ],
};

/* ------------------------------------------------------------- timeline */

export type TimelineStep = {
  id: string;
  /** Event label, as the task timeline shows it. */
  label: string;
  actor: string;
  /** One sentence in the activity feed's own phrasing (src/office/describe.ts). */
  sentence: string;
  /** Placeholder timestamp; never a measured duration. */
  time: string;
  lamp: "done" | "active" | "waiting" | "idle";
};

const T = `‘${SAMPLE_TASK}’`;

export const SAMPLE_TIMELINE: TimelineStep[] = [
  { id: "created", label: "Task created", actor: "You", sentence: `New task ${T} was created`, time: "09:00", lamp: "done" },
  { id: "planned", label: "Manager planned the work", actor: "Morgan Hale", sentence: `Morgan Hale planned ${T} into four subtasks and a review`, time: "09:01", lamp: "done" },
  { id: "assigned", label: "Assigned", actor: "Lina Farouk", sentence: `Lina Farouk picked up ‘Build the meter component’`, time: "09:02", lamp: "done" },
  { id: "started", label: "Work started", actor: "Lina Farouk", sentence: `Lina Farouk started working on ‘Build the meter component’`, time: "09:14", lamp: "done" },
  { id: "handoff", label: "Handed off", actor: "Sofia Reyes", sentence: `Sofia Reyes handed ‘Spec the meter states’ to Lina Farouk`, time: "09:20", lamp: "done" },
  { id: "review", label: "Review started", actor: "Kenji Watanabe", sentence: `Kenji Watanabe started reviewing ${T}`, time: "09:41", lamp: "active" },
  { id: "completed", label: "Completed", actor: "Morgan Hale", sentence: `Morgan Hale completed ${T}`, time: "09:48", lamp: "done" },
];

/* ------------------------------------------------------------- learning */

export type KnowledgeSourceKind = "docs" | "github" | "postmortem";

export type KnowledgeSource = {
  kind: KnowledgeSourceKind;
  title: string;
  /** URL, repository or task the note came from. */
  location: string;
  detail: string;
  state: string;
};

export const SAMPLE_SOURCES: KnowledgeSource[] = [
  {
    kind: "docs",
    title: "Next.js App Router docs",
    location: "https://nextjs.org/docs/app",
    detail: "Allowlisted official docs, robots.txt checked",
    state: "Changed since last run",
  },
  {
    kind: "github",
    title: "vercel/next.js",
    location: "github.com/vercel/next.js",
    detail: "README, docs and changelog. Code is never executed",
    state: "New release notes",
  },
  {
    kind: "postmortem",
    title: "Task lesson",
    location: SAMPLE_TASK,
    detail: "Short postmortem drafted after the task",
    state: "Drafted",
  },
];

/* ------------------------------------------------------------- building */

export type FloorSample = {
  id: string;
  floor: number;
  company: string;
  /** One entry per employee: their role and the DEFAULT_ROOMS kind their desk is in. */
  team: { role: string; room: string; working?: boolean }[];
  activeTasks: string[];
};

export const SAMPLE_FLOORS: FloorSample[] = [
  {
    id: "f1",
    floor: 1,
    company: "Northwind Labs",
    team: [
      { role: "Manager", room: "MANAGER_OFFICE" },
      { role: "Frontend engineer", room: "DEVELOPMENT", working: true },
      { role: "Frontend engineer", room: "DEVELOPMENT" },
      { role: "Backend engineer", room: "DEVELOPMENT", working: true },
      { role: "Product designer", room: "DESIGN", working: true },
      { role: "Research analyst", room: "RESEARCH" },
      { role: "QA engineer", room: "QA", working: true },
    ],
    activeTasks: ["Audit color tokens for contrast", "Add rate limiting to the public API"],
  },
  {
    id: "f2",
    floor: 2,
    company: "Pixel & Co.",
    team: [
      { role: "Manager", room: "MANAGER_OFFICE" },
      { role: "Frontend engineer", room: "DEVELOPMENT" },
      { role: "Product designer", room: "DESIGN", working: true },
      { role: "QA engineer", room: "QA" },
    ],
    activeTasks: ["Moodboard for the rebrand"],
  },
  {
    id: "f3",
    floor: 3,
    company: "Field Notes Research",
    team: [
      { role: "Manager", room: "MANAGER_OFFICE", working: true },
      { role: "Research analyst", room: "RESEARCH", working: true },
      { role: "Research analyst", room: "RESEARCH" },
    ],
    activeTasks: ["Compare three charting libraries for the dashboard"],
  },
];

/* ------------------------------------------------------------ use cases */

/** What a person or reviewer checks for each HOME use case (restates the implemented review step). */
export const USE_CASE_REVIEW: Record<string, string> = {
  software: "QA checks the build against the definition of done",
  marketing: "A reviewer checks drafts and their sources before anything is final",
  research: "The manager checks sources and the recommendation",
  qa: "Every approve or reject comes with reproducible evidence",
  "design-review": "The manager reviews the spec before a developer picks it up",
  docs: "The manager reviews each note and its citations",
};
