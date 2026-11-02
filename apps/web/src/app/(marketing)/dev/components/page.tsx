import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Container, Section } from "@/components/marketing/primitives";
import {
  AgentProfileCard,
  AgentRoleSelector,
  BentoFeatureGrid,
  ConversionCta,
  DEFAULT_FEATURE_TABS,
  FeatureShowcaseTabs,
  IntegrationShowcase,
  KnowledgeSourceCard,
  LearningJourney,
  ManagerDelegationDiagram,
  MultiFloorBuildingPreview,
  SAMPLE_PROFILES,
  SAMPLE_SOURCES,
  TaskProgressTimeline,
  UseCaseShowcase,
  WorkflowAnimation,
  type BentoItem,
  type Surface,
} from "@/components/marketing/viz";
import { HOME } from "@/content/marketing/home";

export const metadata: Metadata = {
  title: "Viz components (dev preview)",
  robots: { index: false, follow: false },
};

/** Visual QA for components/marketing/viz. Development only; 404 in production. */
export default function VizPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const bento = (surface: Surface): BentoItem[] =>
    HOME.tools.cards.map((c, i) => ({
      title: c.title,
      body: c.body,
      href: c.href,
      media:
        i === 0 ? (
          <pre className={`rounded-md border border-white/10 px-4 py-3 font-mono text-xs leading-relaxed text-mist ${surface === "raised" ? "bg-navy-800" : "bg-navy"}`}>
            {"$ claude\n> /login\n> /status"}
          </pre>
        ) : undefined,
    }));

  const tabs = (surface: Surface) =>
    DEFAULT_FEATURE_TABS.map((t) =>
      t.id === "delegate"
        ? { ...t, media: <WorkflowAnimation variant="compact" surface={surface} /> }
        : t.id === "collaborate"
          ? { ...t, media: <TaskProgressTimeline animate surface={surface} /> }
          : t,
    );

  const blocks: { id: string; title: string; render: (surface: Surface) => ReactNode }[] = [
    { id: "workflow", title: "WorkflowAnimation", render: (s) => <WorkflowAnimation surface={s} caption="Illustrative plan: one task split into linked subtasks, reviewed before delivery." /> },
    { id: "workflow-compact", title: "WorkflowAnimation, compact", render: (s) => <WorkflowAnimation variant="compact" surface={s} /> },
    { id: "delegation", title: "ManagerDelegationDiagram", render: (s) => <ManagerDelegationDiagram surface={s} /> },
    { id: "roles", title: "AgentRoleSelector + AgentProfileCard", render: (s) => <AgentRoleSelector surface={s} /> },
    { id: "profile", title: "AgentProfileCard (configured role)", render: (s) => <AgentProfileCard profile={SAMPLE_PROFILES[5]} surface={s} /> },
    { id: "timeline", title: "TaskProgressTimeline (animate)", render: (s) => <TaskProgressTimeline animate surface={s} className="max-w-2xl" /> },
    { id: "learning", title: "LearningJourney", render: (s) => <LearningJourney surface={s} /> },
    {
      id: "source",
      title: "KnowledgeSourceCard",
      render: (s) => (
        <div className="grid gap-3 md:grid-cols-3">
          {SAMPLE_SOURCES.map((src) => (
            <KnowledgeSourceCard key={src.kind} source={src} surface={s} />
          ))}
        </div>
      ),
    },
    { id: "building", title: "MultiFloorBuildingPreview", render: (s) => <MultiFloorBuildingPreview surface={s} /> },
    { id: "integrations", title: "IntegrationShowcase", render: (s) => <IntegrationShowcase surface={s} /> },
    { id: "tabs", title: "FeatureShowcaseTabs", render: (s) => <FeatureShowcaseTabs surface={s} tabs={tabs(s)} /> },
    { id: "use-cases", title: "UseCaseShowcase", render: (s) => <UseCaseShowcase surface={s} /> },
    { id: "bento", title: "BentoFeatureGrid", render: (s) => <BentoFeatureGrid surface={s} items={bento(s)} /> },
  ];

  return (
    <main id="main" className="bg-navy">
      <Section tone="navy" id="viz-intro" aria-labelledby="viz-intro-h" padding="tight">
        <Container className="flex flex-col gap-3">
          <h1 id="viz-intro-h" className="font-display text-3xl font-semibold tracking-tight">
            Viz components
          </h1>
          <p className="max-w-[62ch] text-mist">
            Development preview of components/marketing/viz. Each component renders with its default data on a deep section (surface dark) and on a raised section (surface raised). There are no white surfaces.
          </p>
          <nav aria-label="Components">
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {blocks.map((b) => (
                <li key={b.id}>
                  <a href={`#${b.id}-deep`} className="text-gold underline-offset-4 hover:underline">
                    {b.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </Container>
      </Section>

      {blocks.map((b) => (
        <div key={b.id} data-viz-block={b.id}>
          <Section tone="deep" id={`${b.id}-deep`} aria-labelledby={`${b.id}-deep-h`} padding="tight">
            <Container className="flex flex-col gap-6">
              <h2 id={`${b.id}-deep-h`} className="font-display text-xl font-semibold tracking-tight">
                {b.title} <span className="text-sm font-normal text-mist">on deep</span>
              </h2>
              {b.render("dark")}
            </Container>
          </Section>
          <Section tone="raised" id={`${b.id}-raised`} aria-labelledby={`${b.id}-raised-h`} padding="tight">
            <Container className="flex flex-col gap-6">
              <h2 id={`${b.id}-raised-h`} className="font-display text-xl font-semibold tracking-tight">
                {b.title} <span className="text-sm font-normal text-mist">on raised</span>
              </h2>
              {b.render("raised")}
            </Container>
          </Section>
        </div>
      ))}

      <Section tone="raised" id="panels-on-raised" aria-labelledby="panels-on-raised-h" padding="tight">
        <Container className="flex flex-col gap-6">
          <h2 id="panels-on-raised-h" className="font-display text-xl font-semibold tracking-tight">
            Default (dark) panels inside a raised section
          </h2>
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <WorkflowAnimation variant="compact" />
            <TaskProgressTimeline />
          </div>
          <ConversionCta tone="navy" />
        </Container>
      </Section>

      <Section tone="navy" id="cta" aria-labelledby="cta-h" padding="tight">
        <Container className="flex flex-col gap-6">
          <h2 id="cta-h" className="font-display text-xl font-semibold tracking-tight">
            ConversionCta <span className="text-sm font-normal text-mist">raised, with a quiet backdrop</span>
          </h2>
          <ConversionCta
            headingId="cta-demo-h"
            headingLevel="h3"
            backdrop={
              <div className="absolute top-1/2 right-10 hidden w-[30%] -translate-y-1/2 opacity-40 lg:block">
                <WorkflowAnimation variant="compact" showBadge={false} className="border-0 bg-transparent" />
              </div>
            }
          />
        </Container>
      </Section>
    </main>
  );
}
