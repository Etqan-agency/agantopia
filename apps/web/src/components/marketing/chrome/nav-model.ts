import { CTA_CREATE_COMPANY, CTA_SIGN_IN } from "@/content/marketing/ctas";
import { dropdownColumns, findRoute, routesInGroup } from "@/content/marketing/routes";
import type { MarketingRoute } from "@/content/marketing/types";

/** Navigation model shared by the desktop menu, the mobile sheet and the footer. */
export type NavLinkItem = { href: string; title: string; description: string };
export type NavEntry =
  | { kind: "link"; id: string; label: string; href: string }
  | { kind: "menu"; id: string; label: string; columns: NavLinkItem[][] };

const toItem = (r: MarketingRoute): NavLinkItem => ({ href: r.path, title: r.title, description: r.description });

/** "Resources" in the bar: FAQ, About, Demo ("How it works" has its own top-level link). */
const resources = routesInGroup("resources").filter((r) => r.path !== "/how-it-works");

export const NAV: NavEntry[] = [
  { kind: "menu", id: "product", label: "Product", columns: dropdownColumns("product").map((col) => col.map(toItem)) },
  { kind: "link", id: "how-it-works", label: findRoute("/how-it-works")?.title ?? "How it works", href: "/how-it-works" },
  { kind: "menu", id: "ai-tools", label: "AI tools", columns: [routesInGroup("ai-tools").map(toItem)] },
  { kind: "menu", id: "use-cases", label: "Use cases", columns: [routesInGroup("use-cases").map(toItem)] },
  { kind: "menu", id: "resources", label: "Resources", columns: [resources.map(toItem)] },
];

/** Footer groups. */
export const FOOTER_GROUPS: Array<{ id: string; label: string; links: NavLinkItem[] }> = [
  { id: "product", label: "Product", links: routesInGroup("product").map(toItem) },
  { id: "ai-tools", label: "AI tools", links: routesInGroup("ai-tools").map(toItem) },
  { id: "use-cases", label: "Use cases", links: routesInGroup("use-cases").map(toItem) },
  { id: "resources", label: "Resources", links: routesInGroup("resources").map(toItem) },
];

/** The sign-in form lives at /login (/sign-in only redirects there). */
export const NAV_SIGN_IN = { ...CTA_SIGN_IN, href: "/login", dataCta: "nav-sign-in" };
export const NAV_PRIMARY = { ...CTA_CREATE_COMPANY, dataCta: "nav-primary" };
