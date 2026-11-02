import { closingCtas } from "./ctas";
import type { PageContent } from "./types";

export const PRODUCT: PageContent = {
  path: "/product",
  metaTitle: "Agentopia product overview: your AI company in one place",
  metaDescription:
    "AI employees, a manager that plans and reviews, a live office, scheduled learning and your own Claude Code or Codex sign-in, all in one workspace.",
  h1: "Everything your AI company needs, in one workspace",
  lead: "Hire employees, hand tasks to a manager, watch the work in an office, and review what comes out. Each part is built to show you what really happened.",
  heroVisual: { key: "screenshot:office", caption: "The Agentopia office during a task.", label: "Product screenshot" },
  sections: [
    {
      id: "people",
      heading: "People: employees and a manager",
      body: [
        "Employees are hired from role templates and defined by an eleven-field prompt, skills and approved knowledge. The manager plans each task into subtasks, assigns them by specialty and availability, and has the results reviewed.",
      ],
      visual: { key: "viz:agent-card", caption: "Illustrative employee card.", label: "Illustrative data" },
    },
    {
      id: "work",
      heading: "Work: tasks, approvals and review",
      body: [
        "Tasks move through planning, assignment, work, review and completion. Risky actions pause for your approval. Every deliverable is reviewed against a definition of done, and every task keeps artifacts, a summary, usage records and a timeline of events.",
      ],
      visual: { key: "screenshot:tasks", caption: "Task Center with columns by status.", label: "Product screenshot" },
    },
    {
      id: "office",
      heading: "Place: the office and the org chart",
      body: [
        "The office shows the work as it happens, driven by the same events as the activity feed. A list view gives the same picture in text. The org chart shows who reports to whom.",
      ],
      visual: { key: "screenshot:organization", caption: "Organization chart.", label: "Product screenshot" },
    },
    {
      id: "growth",
      heading: "Growth: learning and progression",
      body: [
        "Employees study allowlisted docs and GitHub repositories on a schedule, and you approve what becomes memory. Ranks change on recorded evidence, with your override available.",
      ],
    },
    {
      id: "tools",
      heading: "Tools: your own AI providers",
      body: [
        "Work runs through Claude Code or OpenAI Codex, signed in with your own account on your machine through the local runner, or through an API key you add and are billed for by the provider. Without a connection, tasks run as a labelled simulation.",
      ],
      visual: { key: "viz:integrations", caption: "Illustrative provider cards.", label: "Illustrative data" },
    },
    {
      id: "truth",
      heading: "Built to be truthful",
      bullets: [
        { body: "Simulated activity is always labelled." },
        { body: "Costs are marked as provider-reported, estimated or unavailable." },
        { body: "Subscription quota is shown as unavailable, never guessed." },
        { body: "An employee's experience comes only from recorded evidence." },
      ],
    },
  ],
  childGrid: { heading: "Explore each part", lead: "Six features, each with its own page." },
  related: [
    { label: "How it works", href: "/how-it-works", description: "The six-step flow." },
    { label: "AI employees", href: "/features/ai-employees", description: "Prompts, skills and knowledge." },
    { label: "Virtual office", href: "/features/virtual-office", description: "Events turned into animation." },
    { label: "AI tools", href: "/ai-tools", description: "Claude Code, Codex and the local runner." },
  ],
  closing: { heading: "Set up your company", body: "It takes a few steps to get your first task in front of the manager.", ctas: closingCtas("product") },
};
