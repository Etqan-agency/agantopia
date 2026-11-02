import { closingCtas } from "./ctas";
import { breadcrumbsFor } from "./routes";
import type { PageContent } from "./types";

const SUBSCRIPTION_RULE =
  "Agentopia never offers a claude.ai or ChatGPT login and never reads, stores or forwards your tokens. Subscription work runs only on your own machine, through a CLI you signed in to yourself.";

export const AI_TOOLS: PageContent = {
  path: "/ai-tools",
  metaTitle: "AI tools: Claude Code, Codex, local runner, API keys",
  metaDescription:
    "Agentopia runs Claude Code and OpenAI Codex through your own CLI sign-in on your machine, or through an API key you add. No automatic paid fallback.",
  h1: "Runs on the AI tools you already use",
  lead: "Agentopia does not ship its own model. Employees run through Claude Code or OpenAI Codex, either with your own sign-in on your machine or with an API key you choose to add.",
  heroVisual: { key: "viz:integrations", caption: "Illustrative provider cards with connection and runner status.", label: "Illustrative data" },
  sections: [
    {
      id: "modes",
      heading: "Two ways to connect",
      bullets: [
        {
          title: "My subscription (local runner), the default",
          body: "You sign in to the Claude Code or Codex CLI on your machine with your own account. The local runner starts that CLI for each job. Usage counts against your own plan.",
        },
        {
          title: "API key, billed separately",
          body: "You add an Anthropic or OpenAI API key and acknowledge that it is billed by the provider. Runs go through Agentopia's worker. Keys are encrypted and shown only by their last four characters.",
        },
      ],
      body: ["With no connection, tasks run as a labelled simulation and no model is called."],
    },
    {
      id: "runner",
      heading: "The local runner",
      steps: [
        { title: "Add a runner", body: "In Integrations, create a runner and copy its token. It is shown once and stored only as a hash." },
        { title: "Sign in to the CLI", body: "Claude Code: run claude, then /login. Codex: run codex login and choose Sign in with ChatGPT." },
        { title: "Start the runner", body: "Run pnpm runner with your server address and token. It checks in every 30 seconds and reconnects on its own." },
        { title: "Assign the connection", body: "Choose the connection for each employee. Jobs go only to a runner that can run that CLI." },
      ],
      note: "In subscription mode the runner removes provider API keys from the CLI's environment, so a stray key cannot quietly turn a plan run into a paid run.",
    },
    {
      id: "limits",
      heading: "Usage limits without surprises",
      body: [
        "When a provider reports a usage or rate limit, the task waits for the reset instead of failing, and no new work starts on that provider. Reset times come only from the provider. If none is given, Agentopia waits a bounded time and tries again.",
        "There is no automatic switch from a subscription to an API key or another connection.",
      ],
    },
    {
      id: "statuses",
      heading: "Clear statuses",
      bullets: [
        { title: "Ready", body: "A runner is online and the CLI is installed and signed in." },
        { title: "Running", body: "Work is in progress." },
        { title: "Runner offline", body: "Start the runner on your machine." },
        { title: "Authentication expired", body: "Sign in to the CLI again." },
        { title: "Usage limit reached, Waiting for reset", body: "The provider reported a limit; tasks wait." },
        { title: "Unsupported integration", body: "The CLI is missing, or an API key is present in subscription mode." },
      ],
      note: "Usage details are shown as unavailable unless the provider reports them. Agentopia never invents percentages or reset times.",
    },
    {
      id: "rules",
      heading: "What Agentopia will not do",
      body: [SUBSCRIPTION_RULE, "Running a Claude or ChatGPT subscription on a hosted server is not supported, because the vendors' terms do not allow it."],
    },
  ],
  childGrid: { heading: "Setup guides for each tool" },
  related: [
    { label: "Claude Code", href: "/ai-tools/claude-code", description: "Setup and permissions for Claude Code." },
    { label: "OpenAI Codex", href: "/ai-tools/codex", description: "Setup and sandboxing for Codex." },
    { label: "FAQ", href: "/faq", description: "Costs, quota and limits." },
  ],
  closing: { heading: "Connect the tool you already pay for", body: "Create a company, add a runner and sign in to your CLI on your own machine.", ctas: closingCtas("ai-tools") },
};

export const AI_TOOLS_CLAUDE_CODE: PageContent = {
  path: "/ai-tools/claude-code",
  metaTitle: "Use Claude Code with Agentopia AI employees",
  metaDescription:
    "Run Agentopia employees through the unmodified Claude Code CLI, signed in with your own Claude plan on your machine. API-key mode is optional.",
  h1: "Claude Code, signed in by you",
  lead: "Agentopia runs the unmodified Claude Code CLI on your own machine, using the Claude plan you signed in with. Your credentials never leave your computer.",
  breadcrumbs: breadcrumbsFor("/ai-tools/claude-code"),
  heroVisual: { key: "screenshot:integrations", caption: "Integrations page showing Claude Code connected through the local runner.", label: "Product screenshot" },
  sections: [
    {
      id: "how",
      heading: "How a run works",
      body: [
        "For each job, the local runner starts claude in headless mode with the employee's prompt, the task brief and the connection's limits, inside a per-company workspace folder. Session persistence stays on, so reworks after a review can resume the same session.",
      ],
    },
    {
      id: "setup",
      heading: "Setup",
      steps: [
        { title: "Connect", body: "In Integrations, choose Connect with my subscription for Claude Code." },
        { title: "Sign in", body: "On your machine, run claude, then /login, with your own Claude account. Check it with /status." },
        { title: "Run", body: "Start the local runner with your token. The card turns Ready when the runner sees a signed-in CLI." },
      ],
    },
    {
      id: "permissions",
      heading: "Permissions you set",
      bullets: [
        { title: "Allowed and blocked tools", body: "By default employees can read, edit, write and search files. Destructive shell patterns and web access are blocked." },
        { title: "Permission mode", body: "Choose how edits are handled. Bypassing permissions is never offered." },
        { title: "Max turns and timeout", body: "Every run has a turn limit and a time limit." },
        { title: "Approval before the run", body: "If a connection allows shell or web tools, you are asked once per run in Agentopia before it starts." },
      ],
    },
    {
      id: "usage",
      heading: "Usage and limits",
      body: [
        "Token counts are recorded as the CLI reports them. Claude Code's own cost figure is a client-side estimate and is labelled as estimated, because plans are not billed per token. If Claude Code reports a rate limit with a reset time, waiting tasks resume after it.",
      ],
    },
    {
      id: "api-key",
      heading: "Prefer an API key?",
      body: ["Add an Anthropic Console API key instead. Runs then go through Agentopia's worker and are billed by Anthropic. A Claude subscription is not an API key, and the two are never mixed."],
    },
  ],
  related: [
    { label: "OpenAI Codex", href: "/ai-tools/codex", description: "The same flow with Codex." },
    { label: "AI tools overview", href: "/ai-tools", description: "Runner, statuses and limits." },
    { label: "Software development", href: "/use-cases/software-development", description: "What a coding team does with it." },
  ],
  closing: { heading: "Bring your Claude plan", body: "Sign in on your own machine and let your employees use it.", ctas: closingCtas("claude-code") },
};

export const AI_TOOLS_CODEX: PageContent = {
  path: "/ai-tools/codex",
  metaTitle: "Use OpenAI Codex with Agentopia AI employees",
  metaDescription:
    "Run Agentopia employees through the Codex CLI signed in with your own ChatGPT account on your machine, sandboxed to the workspace. API keys optional.",
  h1: "OpenAI Codex, signed in by you",
  lead: "Agentopia runs the Codex CLI on your own machine with the ChatGPT account you signed in with. Work stays inside a sandboxed workspace folder.",
  breadcrumbs: breadcrumbsFor("/ai-tools/codex"),
  heroVisual: { key: "screenshot:integrations", caption: "Integrations page showing OpenAI Codex connected through the local runner.", label: "Product screenshot" },
  sections: [
    {
      id: "how",
      heading: "How a run works",
      body: ["For each job, the local runner starts codex exec through OpenAI's official SDK, pointed at the CLI on your machine, with no key injected. Codex uses your own codex login."],
    },
    {
      id: "setup",
      heading: "Setup",
      steps: [
        { title: "Connect", body: "In Integrations, choose Connect with my subscription for OpenAI Codex." },
        { title: "Sign in", body: "On your machine, run codex login and choose Sign in with ChatGPT. Check it with codex login status." },
        { title: "Run", body: "Start the local runner with your token. The card turns Ready when the runner sees a signed-in CLI." },
      ],
    },
    {
      id: "sandbox",
      heading: "Sandboxed by default",
      bullets: [
        { title: "Sandbox mode", body: "Read-only or workspace-write. Full access is never offered." },
        { title: "Network off", body: "Network access stays disabled unless you turn it on." },
        { title: "Approval before the run", body: "Workspace edits and shell access are approved in Agentopia before the run starts." },
      ],
    },
    {
      id: "usage",
      heading: "Usage and limits",
      body: ["Codex reports token counts but not a dollar cost, so runs on your plan show tokens only. Usage-limit and sign-in errors are recognised, and tasks wait instead of failing."],
    },
    {
      id: "api-key",
      heading: "Prefer an API key?",
      body: ["Add an OpenAI API key instead. Runs then go through Agentopia's worker and are billed by OpenAI at API prices. A ChatGPT subscription is not an API key."],
    },
  ],
  related: [
    { label: "Claude Code", href: "/ai-tools/claude-code", description: "The same flow with Claude Code." },
    { label: "AI tools overview", href: "/ai-tools", description: "Runner, statuses and limits." },
    { label: "Quality assurance", href: "/use-cases/quality-assurance", description: "Review loops on Codex output." },
  ],
  closing: { heading: "Bring your ChatGPT account", body: "Sign in to Codex on your own machine and put it to work.", ctas: closingCtas("codex") },
};

export const AI_TOOL_PAGES: PageContent[] = [AI_TOOLS, AI_TOOLS_CLAUDE_CODE, AI_TOOLS_CODEX];
