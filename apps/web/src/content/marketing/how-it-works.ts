import { closingCtas } from "./ctas";
import type { PageContent } from "./types";

export const HOW_IT_WORKS: PageContent = {
  path: "/how-it-works",
  metaTitle: "How Agentopia works: from company to reviewed work",
  metaDescription:
    "Create a company, hire AI employees, connect Claude Code or Codex, hand the manager a task, watch the office and review the result. Six steps.",
  h1: "How Agentopia works",
  lead: "Six steps take you from an empty building to work you have reviewed. The first-run setup walks you through most of them.",
  heroVisual: { key: "viz:workflow", caption: "Illustrative six-step flow.", label: "Illustrative data" },
  sections: [
    {
      id: "step-1",
      heading: "1. Create your company",
      body: ["Sign up and name your company. It is placed on a floor of your building, and you can add more floors and companies later."],
      visual: { key: "screenshot:onboarding", caption: "First-run setup.", label: "Product screenshot" },
    },
    {
      id: "step-2",
      heading: "2. Hire your team",
      body: [
        "Hire from six role templates: management, frontend, backend, UI/UX, QA and research. Every company gets a manager. Edit each employee's prompt, skills and knowledge whenever you like.",
      ],
    },
    {
      id: "step-3",
      heading: "3. Connect your AI tools",
      body: [
        "Connect Claude Code or OpenAI Codex with your own sign-in through the local runner on your machine, or add an API key that the provider bills you for. Choose permissions, max turns and timeouts for the connection.",
        "You can skip this step. Until a provider is connected, tasks run as a labelled simulation and no model is called.",
      ],
    },
    {
      id: "step-4",
      heading: "4. Hand the manager a task",
      body: ["Describe the outcome you want. The manager breaks it into subtasks with dependencies and assigns each to the best-fit employee."],
    },
    {
      id: "step-5",
      heading: "5. Watch the office work",
      body: [
        "Lamps turn on as employees start, and they walk over to hand work off. If an employee needs a risky permission, the task waits for your approval. The activity feed and list view show the same events in text.",
      ],
      visual: { key: "screenshot:office", caption: "The office during a task.", label: "Product screenshot" },
    },
    {
      id: "step-6",
      heading: "6. Review the result",
      body: [
        "Each deliverable is reviewed by QA or the manager against a definition of done. Read the summary, open the artifacts, follow the timeline, and approve any knowledge notes the employees drafted.",
      ],
      visual: { key: "viz:timeline", caption: "Illustrative task timeline.", label: "Illustrative data" },
    },
  ],
  related: [
    { label: "Product overview", href: "/product" },
    { label: "AI manager", href: "/features/ai-manager" },
    { label: "AI tools", href: "/ai-tools" },
    { label: "FAQ", href: "/faq" },
  ],
  closing: { heading: "Start with step one", body: "Create your company now, or watch the scripted demo first.", ctas: closingCtas("how-it-works") },
};
