import { closingCtas } from "./ctas";
import type { FaqItem, FaqPageContent } from "./types";

/**
 * Canonical FAQ answers. The homepage shows HOME_FAQ_IDS; /faq shows every
 * group and emits FAQPage JSON-LD from the same text (visible text and
 * structured data must match).
 */

export const FAQ_ITEMS = {
  whatIs: {
    id: "what-is-agentopia",
    question: "What is Agentopia?",
    answer:
      "Agentopia is a workspace where you run a small company staffed by AI employees. You hire employees from role templates, give each one a structured prompt, skills and knowledge, and hand tasks to an AI manager. The manager plans the work, delegates it to specialists and has it reviewed. A top-down office shows the work as it happens, driven by the same events you see in the task timeline.",
  },
  tryWithoutAccount: {
    id: "try-without-account",
    question: "Can I try it without creating an account?",
    answer:
      "Yes. The visitor demo at /demo shows a seeded two-floor building with scripted, clearly labelled activity. It needs no account and no AI provider, and it never calls a model.",
  },
  useSubscription: {
    id: "use-my-subscription",
    question: "Can I use my Claude or ChatGPT subscription?",
    answer:
      "Yes, through the local runner on your own machine. You sign in to the unmodified Claude Code CLI or the Codex CLI yourself, using the vendors' own sign-in flows, and the runner starts that CLI for each job. Usage counts against your own plan. Subscription work never runs on Agentopia's servers.",
  },
  storeLogin: {
    id: "store-my-login",
    question: "Does Agentopia ask for or store my Claude or ChatGPT login?",
    answer:
      "No. Agentopia never offers a claude.ai or ChatGPT login, and never reads, stores or forwards your tokens. The runner only checks whether a sign-in exists (for example, that the Claude Code keychain item is present, or what codex login status reports). It never opens the credential itself.",
  },
  cost: {
    id: "what-does-it-cost",
    question: "What does it cost to run tasks?",
    answer:
      "Subscription runs count against your own Claude or ChatGPT plan, not per token. API-key mode is optional and explicit: you add your own Anthropic or OpenAI key, acknowledge that it is billed separately, and the provider bills you directly. There is no automatic switch from a subscription to an API key. With no provider connected, tasks run as a labelled simulation and no model is called.",
  },
  quota: {
    id: "see-remaining-quota",
    question: "Can I see how much of my plan is left?",
    answer:
      "No. Claude and ChatGPT do not offer an official way to read a plan's remaining quota, so Agentopia shows it as unavailable instead of guessing. Token counts reported by the CLI are recorded per run, and costs are labelled as provider-reported, estimated or unavailable.",
  },
  limits: {
    id: "usage-limit-reached",
    question: "What happens when I reach a usage limit?",
    answer:
      "The runner stops the CLI, keeps the partial output, and the task moves to Waiting for provider limit without using up an attempt. No new work starts on that provider. When the provider-reported reset time passes, or after a bounded backoff if no time was reported, waiting tasks are queued again. After five automatic retries a task is blocked so you can retry it yourself.",
  },
  learning: {
    id: "do-employees-learn",
    question: "Do AI employees actually learn?",
    answer:
      "They build up knowledge and a track record, but the model itself is not retrained. On a schedule (twice a week by default), each employee reads allowlisted documentation and GitHub repositories in their specialty, skips anything unchanged, and drafts notes. You approve a note before it becomes verified memory. Verified memory is retrieved with citations when the employee works on a later task.",
  },
  control: {
    id: "stay-in-control",
    question: "How do I keep control over what employees do?",
    answer:
      "Risky actions such as shell commands or network access wait for your approval before they run. Every deliverable is reviewed by a QA employee or the manager against a definition of done. You can cancel or retry a task at any time, and attempt limits, timeouts and per-run caps stop runaway work. Each task keeps a timeline of persisted events.",
  },
  officeReal: {
    id: "is-the-office-real",
    question: "Is the office animation showing real work?",
    answer:
      "In your own company, yes. Every movement in the office comes from a persisted task event, and the same events appear in the activity feed and the list view. Viewing the office never calls a model. The visitor demo and the animation on this website are scripted and labelled as such.",
  },
  multiCompany: {
    id: "multiple-companies",
    question: "Can I run more than one company?",
    answer:
      "Yes. Your account has a building with floors, and each floor hosts one company. Companies keep their own employees, tasks, knowledge and settings, and data from one company is not visible to another.",
  },
  whichProviders: {
    id: "which-providers",
    question: "Which AI tools does Agentopia work with?",
    answer:
      "Claude Code (Anthropic) and OpenAI Codex. Each can run through your own CLI sign-in via the local runner, or through an API key you add yourself.",
  },
  runnerWhere: {
    id: "where-runner-runs",
    question: "Where does the local runner run?",
    answer:
      "On your own machine, under your own operating system account. You start it from a terminal with a runner token created in Integrations. It checks in every 30 seconds, works in per-company workspace folders, and stops if its token is revoked.",
  },
  keysStored: {
    id: "api-key-storage",
    question: "How are API keys stored?",
    answer:
      "API keys are encrypted on the server (AES-256-GCM), shown only by their last four characters, and can be rotated or revoked. They are never sent to the browser or the office scene.",
  },
  runnerOffline: {
    id: "runner-offline",
    question: "What if my runner is offline?",
    answer:
      "Subscription tasks are marked blocked with a note to start the local runner, and they continue on their own when a runner that can run the CLI comes back online. They never move to an API key.",
  },
  editPrompts: {
    id: "edit-prompts",
    question: "Can I change how an employee behaves?",
    answer:
      "Yes. Each employee has an eleven-field prompt, from Identity to Escalation and safety. Every save creates a new version, and you can roll back to an earlier one.",
  },
  ranks: {
    id: "how-ranks-work",
    question: "How do employees move up in rank?",
    answer:
      "Ranks go from Trainee to Expert. Changes are based on recorded evidence, such as approved reviews and verified knowledge. Moving past Senior requires an assessment or your explicit override, and you can always set a rank yourself.",
  },
  marketplace: {
    id: "not-available",
    question: "What is not available yet?",
    answer:
      "There is no marketplace, no billing, and no multiplayer office for several people. Password-reset emails are not sent yet in this build. Running a Claude or ChatGPT subscription on a hosted server is not supported and will not be, because the vendors' terms do not allow it.",
  },
} satisfies Record<string, FaqItem>;

/** The ten questions shown on the homepage, in order. */
export const HOME_FAQ: FaqItem[] = [
  FAQ_ITEMS.whatIs,
  FAQ_ITEMS.tryWithoutAccount,
  FAQ_ITEMS.useSubscription,
  FAQ_ITEMS.storeLogin,
  FAQ_ITEMS.cost,
  FAQ_ITEMS.quota,
  FAQ_ITEMS.limits,
  FAQ_ITEMS.learning,
  FAQ_ITEMS.control,
  FAQ_ITEMS.officeReal,
];

export const FAQ_PAGE: FaqPageContent = {
  path: "/faq",
  metaTitle: "Agentopia FAQ: subscriptions, costs, learning, control",
  metaDescription:
    "Answers about using your own Claude Code or Codex sign-in, API-key billing, usage limits, how AI employees learn and how you stay in control.",
  h1: "Frequently asked questions",
  lead: "Short, exact answers about how Agentopia runs work, what it costs you, and what it does not do.",
  sections: [],
  groups: [
    { id: "basics", heading: "The basics", items: [FAQ_ITEMS.whatIs, FAQ_ITEMS.tryWithoutAccount, FAQ_ITEMS.officeReal, FAQ_ITEMS.multiCompany] },
    {
      id: "tools-and-costs",
      heading: "AI tools, subscriptions and costs",
      items: [
        FAQ_ITEMS.whichProviders,
        FAQ_ITEMS.useSubscription,
        FAQ_ITEMS.storeLogin,
        FAQ_ITEMS.cost,
        FAQ_ITEMS.quota,
        FAQ_ITEMS.limits,
        FAQ_ITEMS.runnerWhere,
        FAQ_ITEMS.runnerOffline,
        FAQ_ITEMS.keysStored,
      ],
    },
    { id: "employees", heading: "Employees and learning", items: [FAQ_ITEMS.editPrompts, FAQ_ITEMS.learning, FAQ_ITEMS.ranks] },
    { id: "control", heading: "Control and limits", items: [FAQ_ITEMS.control, FAQ_ITEMS.marketplace] },
  ],
  related: [
    { label: "AI tools", href: "/ai-tools", description: "How the local runner and API-key mode work." },
    { label: "Agent learning", href: "/features/agent-learning", description: "Schedules, sources and the approval queue." },
    { label: "How it works", href: "/how-it-works", description: "Six steps from company to reviewed work." },
  ],
  closing: {
    heading: "Still curious? Watch it run.",
    body: "The visitor demo plays a scripted day in the office. No account or provider needed.",
    ctas: closingCtas("faq"),
  },
};
