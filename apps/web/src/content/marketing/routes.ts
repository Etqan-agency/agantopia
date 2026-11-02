import type { MarketingRoute, NavGroup } from "./types";

/**
 * The one list of public marketing routes. sitemap.ts, the navbar, the footer
 * and breadcrumbs all read from here. Adding a route here makes it indexable,
 * so only add routes that exist as public pages (contract §4).
 */
export const MARKETING_ROUTES: MarketingRoute[] = [
  { path: "/", title: "Home", navGroup: "home", description: "Build your own AI company and watch the work move through a live office.", changeFrequency: "weekly", priority: 1 },

  { path: "/product", title: "Product overview", navGroup: "product", navColumn: 0, description: "Everything in one workspace: employees, manager, office, learning and your AI tools.", changeFrequency: "monthly", priority: 0.9 },
  { path: "/features/ai-employees", title: "AI employees", navGroup: "product", navColumn: 0, parent: "/product", description: "Structured prompts, skills, knowledge and a track record for each employee.", changeFrequency: "monthly", priority: 0.8 },
  { path: "/features/ai-manager", title: "AI manager", navGroup: "product", navColumn: 0, parent: "/product", description: "Plans the task, delegates subtasks and reviews the results.", changeFrequency: "monthly", priority: 0.8 },
  { path: "/features/virtual-office", title: "Virtual office", navGroup: "product", navColumn: 0, parent: "/product", description: "A top-down office animated from real task events, with a list view.", changeFrequency: "monthly", priority: 0.8 },
  { path: "/features/agent-collaboration", title: "Agent collaboration", navGroup: "product", navColumn: 1, parent: "/product", description: "Subtasks, handoffs and review loops between specialists.", changeFrequency: "monthly", priority: 0.8 },
  { path: "/features/agent-learning", title: "Agent learning", navGroup: "product", navColumn: 1, parent: "/product", description: "Scheduled learning from docs and GitHub, approved before it becomes memory.", changeFrequency: "monthly", priority: 0.8 },
  { path: "/features/multi-company", title: "Multiple companies", navGroup: "product", navColumn: 1, parent: "/product", description: "A building with floors, one company per floor, data kept apart.", changeFrequency: "monthly", priority: 0.8 },

  { path: "/ai-tools", title: "AI tools", navGroup: "ai-tools", description: "Claude Code, OpenAI Codex, the local runner and API-key mode.", changeFrequency: "monthly", priority: 0.8 },
  { path: "/ai-tools/claude-code", title: "Claude Code", navGroup: "ai-tools", parent: "/ai-tools", description: "Run employees through your own Claude Code sign-in on your machine.", changeFrequency: "monthly", priority: 0.7 },
  { path: "/ai-tools/codex", title: "OpenAI Codex", navGroup: "ai-tools", parent: "/ai-tools", description: "Run employees through your own Codex CLI sign-in on your machine.", changeFrequency: "monthly", priority: 0.7 },

  { path: "/use-cases", title: "Use cases", navGroup: "use-cases", description: "How a team of specialised AI employees handles real kinds of work.", changeFrequency: "monthly", priority: 0.8 },
  { path: "/use-cases/software-development", title: "Software development", navGroup: "use-cases", parent: "/use-cases", description: "Research, design, build and QA review on one feature request.", changeFrequency: "monthly", priority: 0.7 },
  { path: "/use-cases/marketing", title: "Marketing", navGroup: "use-cases", parent: "/use-cases", description: "A configured marketing role working with research and review.", changeFrequency: "monthly", priority: 0.7 },
  { path: "/use-cases/research", title: "Research", navGroup: "use-cases", parent: "/use-cases", description: "Cited research notes, comparisons and feasibility checks.", changeFrequency: "monthly", priority: 0.7 },
  { path: "/use-cases/quality-assurance", title: "Quality assurance", navGroup: "use-cases", parent: "/use-cases", description: "Test plans and reviews against a definition of done.", changeFrequency: "monthly", priority: 0.7 },

  { path: "/how-it-works", title: "How it works", navGroup: "resources", navColumn: 0, description: "Six steps from creating a company to reviewing finished work.", changeFrequency: "monthly", priority: 0.8 },
  { path: "/faq", title: "FAQ", navGroup: "resources", navColumn: 0, description: "Straight answers about subscriptions, costs, learning and control.", changeFrequency: "monthly", priority: 0.7 },
  { path: "/demo", title: "Live demo", navGroup: "resources", navColumn: 1, description: "A scripted visitor demo of the office. No account needed.", changeFrequency: "monthly", priority: 0.7 },
  { path: "/about", title: "About", navGroup: "resources", navColumn: 1, description: "What Agentopia is, and how we separate real from simulated.", changeFrequency: "yearly", priority: 0.5 },
];

/** Authenticated app and private surfaces: never indexed. */
export const DISALLOWED_PREFIXES = [
  "/api/",
  "/office",
  "/employees",
  "/tasks",
  "/learning",
  "/integrations",
  "/settings",
  "/organization",
  "/onboarding",
] as const;

/** Auth entry points used by marketing CTAs (exist today under src/app/(auth)). */
export const AUTH_LINKS = {
  signUp: "/signup?next=/onboarding",
  signIn: "/sign-in",
} as const;

export function routesInGroup(group: NavGroup): MarketingRoute[] {
  return MARKETING_ROUTES.filter((r) => r.navGroup === group);
}

/** Routes for a two-column dropdown (Product, Resources), split by navColumn. */
export function dropdownColumns(group: "product" | "resources"): [MarketingRoute[], MarketingRoute[]] {
  const items = routesInGroup(group);
  return [items.filter((r) => r.navColumn !== 1), items.filter((r) => r.navColumn === 1)];
}

export function findRoute(path: string): MarketingRoute | undefined {
  return MARKETING_ROUTES.find((r) => r.path === path);
}

/** Home → parent → page, for breadcrumbs on detail pages. */
export function breadcrumbsFor(path: string): Array<{ name: string; path: string }> {
  const trail: Array<{ name: string; path: string }> = [];
  let current = findRoute(path);
  while (current) {
    trail.unshift({ name: current.title, path: current.path });
    current = current.parent ? findRoute(current.parent) : undefined;
  }
  if (trail[0]?.path !== "/") trail.unshift({ name: "Home", path: "/" });
  return trail;
}
