import { closingCtas } from "./ctas";
import { breadcrumbsFor } from "./routes";
import type { PageContent } from "./types";

const EXAMPLE_NOTE = "This is an illustrative example of how the work is split. It does not describe a specific customer or result.";

export const USE_CASES: PageContent = {
  path: "/use-cases",
  metaTitle: "Use cases for AI employee teams | Agentopia",
  metaDescription:
    "See how specialised AI employees split software, marketing, research and QA work, and where a reviewer and you check the result before it counts.",
  h1: "What a team of AI employees can take on",
  lead: "Each example shows which specialists contribute, what they hand to each other and what gets reviewed. Every result is checked before the task completes.",
  heroVisual: { key: "viz:workflow", caption: "Illustrative workflow across several specialists.", label: "Illustrative data" },
  sections: [
    {
      id: "pattern",
      heading: "The same pattern every time",
      steps: [
        { title: "You describe the outcome", body: "One task, written for the manager." },
        { title: "The manager plans", body: "Subtasks for each specialty, linked in order." },
        { title: "Specialists deliver", body: "Each one hands off a summary and artifacts." },
        { title: "Someone reviews", body: "QA or the manager checks against the definition of done." },
      ],
    },
    {
      id: "examples",
      heading: "Examples",
      bullets: [
        { title: "Software development", body: "Research, a design spec, implementation and QA on one feature request." },
        { title: "Marketing", body: "A configured marketing role drafting copy from cited research." },
        { title: "Research", body: "Comparisons and feasibility notes with sources and confidence." },
        { title: "Quality assurance", body: "Test plans and evidence-based reviews of other employees' work." },
      ],
    },
  ],
  related: [
    { label: "Software development", href: "/use-cases/software-development" },
    { label: "Marketing", href: "/use-cases/marketing" },
    { label: "Research", href: "/use-cases/research" },
    { label: "Quality assurance", href: "/use-cases/quality-assurance" },
  ],
  closing: { heading: "Build the team for your work", body: "Start with the templates and shape each employee to the job.", ctas: closingCtas("use-cases") },
};

export const USE_CASE_SOFTWARE: PageContent = {
  path: "/use-cases/software-development",
  metaTitle: "AI employees for software development | Agentopia",
  metaDescription:
    "A manager splits a feature request between a researcher, designer, developer and QA engineer. Each hands off artifacts, and QA reviews before completion.",
  h1: "Software development with a full AI team",
  lead: "A feature request touches research, design, code and testing. Agentopia gives each part to a specialist and has the result reviewed before it counts.",
  breadcrumbs: breadcrumbsFor("/use-cases/software-development"),
  heroVisual: { key: "viz:workflow", caption: "Illustrative feature request split across four specialists.", label: "Illustrative data" },
  sections: [
    {
      id: "who",
      heading: "Who contributes",
      bullets: [
        { title: "AI Manager", body: "Turns the request into subtasks with dependencies and assigns them." },
        { title: "Researcher", body: "Reads the relevant docs and writes a cited note on the approach." },
        { title: "Designer", body: "Writes a spec covering states and accessibility notes." },
        { title: "Developer", body: "Implements the change in the project workspace and summarises the changed files." },
        { title: "QA Engineer", body: "Writes or runs tests when allowed and reviews against the definition of done." },
      ],
    },
    {
      id: "reviewed",
      heading: "What gets reviewed",
      bullets: [
        { body: "The developer's work is checked against the definition of done: it works, passes type-check and lint, and is documented in the summary." },
        { body: "Rejected work goes back to the developer with the review notes, while attempts remain." },
        { body: "Shell commands and network access wait for your approval." },
      ],
    },
    {
      id: "you",
      heading: "What you see",
      body: ["The office shows each specialist picking up their part. The task page keeps the timeline, the artifacts and the review result. Code is written inside a per-company workspace folder."],
      note: EXAMPLE_NOTE,
    },
  ],
  related: [
    { label: "Agent collaboration", href: "/features/agent-collaboration" },
    { label: "Claude Code", href: "/ai-tools/claude-code" },
    { label: "Quality assurance", href: "/use-cases/quality-assurance" },
  ],
  closing: { heading: "Hand over your next feature", body: "Hire a small engineering team and give the manager a request.", ctas: closingCtas("uc-software") },
};

export const USE_CASE_MARKETING: PageContent = {
  path: "/use-cases/marketing",
  metaTitle: "AI employees for marketing work | Agentopia",
  metaDescription:
    "Configure a marketing role from a template, pair it with a researcher and have a reviewer check drafts. Publishing externally always needs approval.",
  h1: "Marketing work with research behind it",
  lead: "Marketing is not a preset template, so you configure the role yourself. Paired with a researcher and a reviewer, it drafts copy that is grounded in cited sources.",
  breadcrumbs: breadcrumbsFor("/use-cases/marketing"),
  heroVisual: { key: "viz:agent-card", caption: "Illustrative card for a configured Marketing Specialist.", label: "Illustrative data", focus: "marketing" },
  sections: [
    {
      id: "configure",
      heading: "Configure the role",
      body: [
        "Hire from a template, for example the Research Analyst, then rewrite the prompt fields for marketing: identity, scope, expertise, responsibilities and definition of done. Add skills with instructions for your formats, such as headline options with a rationale.",
      ],
    },
    {
      id: "who",
      heading: "Who contributes",
      bullets: [
        { title: "AI Manager", body: "Splits a brief into research and drafting subtasks." },
        { title: "Researcher", body: "Gathers information on the audience or topic, with a source and retrieval date for each claim." },
        { title: "Marketing Specialist", body: "Drafts copy or an outline from the research note." },
        { title: "Reviewer", body: "The manager or a QA employee checks the draft against the brief's definition of done." },
      ],
    },
    {
      id: "reviewed",
      heading: "What gets reviewed",
      bullets: [
        { body: "Whether the draft matches the brief and cites the research it relies on." },
        { body: "Whether claims in the draft are backed by the research note." },
        { body: "Nothing is published externally without your approval. The default constraints in every prompt require it." },
      ],
      note: EXAMPLE_NOTE,
    },
  ],
  related: [
    { label: "AI employees", href: "/features/ai-employees" },
    { label: "Research", href: "/use-cases/research" },
    { label: "AI manager", href: "/features/ai-manager" },
  ],
  closing: { heading: "Set up your marketing role", body: "Start from a template and write the job description you want.", ctas: closingCtas("uc-marketing") },
};

export const USE_CASE_RESEARCH: PageContent = {
  path: "/use-cases/research",
  metaTitle: "AI employees for cited research | Agentopia",
  metaDescription:
    "A research analyst writes notes with sources, retrieval dates, confidence and a recommendation, builds on approved knowledge and is reviewed.",
  h1: "Research notes you can check",
  lead: "The research analyst template is built around citations: every claim has a source and a retrieval date, inferences are marked, and each note ends with a recommendation and a confidence level.",
  breadcrumbs: breadcrumbsFor("/use-cases/research"),
  heroVisual: { key: "viz:learning-journey", caption: "Illustrative path from sources to reviewed knowledge.", label: "Illustrative data" },
  sections: [
    {
      id: "who",
      heading: "Who contributes",
      bullets: [
        { title: "AI Manager", body: "Frames the question and splits large comparisons into parts." },
        { title: "Researcher", body: "Reads documentation and repository material and writes the note." },
        { title: "Reviewer", body: "Checks that sources, uncertainties and a recommendation are present." },
      ],
    },
    {
      id: "memory",
      heading: "Builds on what was approved",
      body: [
        "Between tasks, the researcher studies allowlisted documentation and GitHub sources on its learning schedule. Notes you approve become verified memory, retrieved with citations in later research.",
        "Web access during a task is only available when the task explicitly allows it.",
      ],
    },
    {
      id: "reviewed",
      heading: "What gets reviewed",
      bullets: [
        { body: "A source URL and retrieval date for each claim." },
        { body: "Facts separated from inference, and uncertainties listed." },
        { body: "A recommendation with a confidence level." },
      ],
      note: EXAMPLE_NOTE,
    },
  ],
  related: [
    { label: "Agent learning", href: "/features/agent-learning" },
    { label: "Marketing", href: "/use-cases/marketing" },
    { label: "Software development", href: "/use-cases/software-development" },
  ],
  closing: { heading: "Ask your first question", body: "Hire a research analyst and give the manager something to look into.", ctas: closingCtas("uc-research") },
};

export const USE_CASE_QA: PageContent = {
  path: "/use-cases/quality-assurance",
  metaTitle: "AI employees for quality assurance | Agentopia",
  metaDescription:
    "A QA engineer writes test plans, runs tests when allowed and reviews other employees' work against the definition of done, with evidence.",
  h1: "Quality assurance built into every task",
  lead: "When a QA employee is on the team, they review other specialists' work before a task can complete. Their verdict comes with evidence.",
  breadcrumbs: breadcrumbsFor("/use-cases/quality-assurance"),
  heroVisual: { key: "screenshot:task-detail", caption: "Task detail with the review checklist and verdict.", label: "Product screenshot" },
  sections: [
    {
      id: "who",
      heading: "Who contributes",
      bullets: [
        { title: "AI Manager", body: "Requests the review and reports the result." },
        { title: "Developer or other specialist", body: "Delivers the work and a summary of how it was verified." },
        { title: "QA Engineer", body: "Writes a test plan, runs tests when allowed and returns approve or reject." },
      ],
    },
    {
      id: "review",
      heading: "What the review checks",
      bullets: [
        { body: "The scope matches the task." },
        { body: "The definition of done is met." },
        { body: "There is evidence of verification." },
        { body: "No unsafe actions were taken." },
        { body: "The summary is truthful." },
      ],
    },
    {
      id: "loop",
      heading: "When work falls short",
      body: [
        "A rejected review sends the work back with specific reasons. Retries are limited, and the review outcome is recorded as career evidence for the employee who did the work.",
      ],
      note: EXAMPLE_NOTE,
    },
  ],
  related: [
    { label: "Agent collaboration", href: "/features/agent-collaboration" },
    { label: "OpenAI Codex", href: "/ai-tools/codex" },
    { label: "Software development", href: "/use-cases/software-development" },
  ],
  closing: { heading: "Add a reviewer to your team", body: "Hire a QA engineer and every deliverable gets a second look.", ctas: closingCtas("uc-qa") },
};

export const USE_CASE_PAGES: PageContent[] = [USE_CASES, USE_CASE_SOFTWARE, USE_CASE_MARKETING, USE_CASE_RESEARCH, USE_CASE_QA];
