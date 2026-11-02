/**
 * Shapes for the marketing copy in src/content/marketing. Pages compose
 * components with this data; components never hard-code marketing claims.
 */

/** Product screenshot or visualisation a section should show. */
export type VisualKey =
  | "hero:office"
  | "screenshot:office"
  | "screenshot:office-list"
  | "screenshot:employees"
  | "screenshot:employee-detail"
  | "screenshot:tasks"
  | "screenshot:task-detail"
  | "screenshot:organization"
  | "screenshot:learning"
  | "screenshot:integrations"
  | "screenshot:settings"
  | "screenshot:onboarding"
  | "viz:workflow"
  | "viz:learning-journey"
  | "viz:building"
  | "viz:agent-card"
  | "viz:integrations"
  | "viz:timeline"
  | "viz:office-spotlight"
  | "viz:feature-tabs";

export type Cta = {
  label: string;
  href: string;
  /** Hook for future analytics (contract §7). No analytics is attached today. */
  dataCta: string;
};

export type CtaPair = { primary: Cta; secondary?: Cta };

export type InternalLink = { label: string; href: string; description?: string };

/** Short visible label for visuals that are not live data. */
export type VisualLabel = "Scripted demo" | "Illustrative data" | "Product screenshot" | "Illustration";

export type VisualRef = {
  key: VisualKey;
  /** Alt text / caption for the visual. */
  caption: string;
  label: VisualLabel;
  /** Optional item a visualisation opens on, e.g. a role id for "viz:agent-card". */
  focus?: string;
};

export type Bullet = { title?: string; body: string };

export type ContentSection = {
  id: string;
  heading: string;
  /** Short paragraphs. */
  body?: string[];
  bullets?: Bullet[];
  /** Ordered steps; render as an ordered list. */
  steps?: Bullet[];
  visual?: VisualRef;
  /** Note rendered in small print (caveats, "illustrative" labels). */
  note?: string;
};

export type ClosingCta = { heading: string; body: string; ctas: CtaPair };

export type BreadcrumbCrumb = { name: string; path: string };

/** Copy for one marketing route other than the homepage. */
export type PageContent = {
  path: string;
  /** ≤ 60 characters, used verbatim as the <title>. */
  metaTitle: string;
  /** ≤ 155 characters. */
  metaDescription: string;
  h1: string;
  lead: string;
  heroVisual?: VisualRef;
  /** Present on detail pages (features, AI tools, use cases). */
  breadcrumbs?: BreadcrumbCrumb[];
  sections: ContentSection[];
  related: InternalLink[];
  closing: ClosingCta;
  /** Index pages: heading for the grid of child pages (cards come from MARKETING_ROUTES). */
  childGrid?: { heading: string; lead?: string };
};

/* ---------------------------------------------------------------- homepage */

export type HeroContent = {
  /** First headline line (snow). */
  headline: string;
  /** Second headline line (gold; the owner-approved hero exception). */
  headlineSecond: string;
  support: string;
  ctas: CtaPair;
  trustLine: string;
  visual: VisualRef;
};

export type RoleCard = {
  id: string;
  name: string;
  capabilities: string[];
  sampleTasks: [string, string];
  /** Office room from DEFAULT_ROOMS where this role's desk sits. */
  room: string;
  /** Role template the example maps to (ROLE_TEMPLATES title). */
  template: string;
  /** false for roles you configure yourself (e.g. Marketing specialist). */
  isPreset: boolean;
  note?: string;
};

export type Beat = { id: string; title: string; body: string };

export type LearningStage = { id: string; title: string; body: string };

export type MemoryDistinction = { term: string; body: string };

export type ToolCard = { id: string; title: string; body: string; href?: string };

export type UseCaseCard = { id: string; title: string; body: string; href?: string; specialists: string[] };

export type HowStep = { id: string; title: string; body: string };

export type FaqItem = { id: string; question: string; answer: string };

export type HomeContent = {
  metaTitle: string;
  metaDescription: string;
  hero: HeroContent;
  explainer: { heading: string; lead: string; points: Bullet[] };
  workforce: { heading: string; lead: string; roles: RoleCard[]; note: string };
  officeAlive: { heading: string; lead: string; beats: Beat[]; visual: VisualRef };
  oneTask: { heading: string; lead: string; steps: Bullet[]; visual: VisualRef };
  learning: {
    heading: string;
    lead: string;
    stages: LearningStage[];
    distinctions: MemoryDistinction[];
    notRetrained: string;
    visual: VisualRef;
  };
  multiCompany: { heading: string; lead: string; points: Bullet[]; visual: VisualRef };
  tools: { heading: string; lead: string; cards: ToolCard[]; subscriptionStatement: string; visual: VisualRef };
  oversight: { heading: string; lead: string; points: Bullet[] };
  featureShowcase: { heading: string; lead: string };
  useCases: { heading: string; lead: string; items: UseCaseCard[] };
  howItWorks: { heading: string; lead: string; steps: HowStep[] };
  faq: { heading: string; items: FaqItem[] };
  finalCta: ClosingCta;
};

/* ------------------------------------------------------------------ routes */

export type NavGroup = "home" | "product" | "ai-tools" | "use-cases" | "resources";

export type MarketingRoute = {
  path: string;
  /** Short label for nav, footer and breadcrumbs. */
  title: string;
  navGroup: NavGroup;
  /** Column inside a two-column dropdown (Product and Resources only). */
  navColumn?: 0 | 1;
  description: string;
  /** Parent path for breadcrumbs. */
  parent?: string;
  changeFrequency: "weekly" | "monthly" | "yearly";
  priority: number;
};

/* --------------------------------------------------------------------- faq */

export type FaqGroup = { id: string; heading: string; items: FaqItem[] };

export type FaqPageContent = PageContent & { groups: FaqGroup[] };
