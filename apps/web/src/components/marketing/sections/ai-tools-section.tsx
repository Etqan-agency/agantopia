import { Gauge, KeyRound, Laptop, ShieldCheck, SquareTerminal, Terminal, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Container, MotionReveal, Section, SectionHeading } from "@/components/marketing/primitives";
import { IntegrationShowcase } from "@/components/marketing/viz";
import type { HomeContent } from "@/content/marketing/types";

const ICONS: Record<string, LucideIcon> = {
  "claude-code": SquareTerminal,
  codex: Terminal,
  runner: Laptop,
  "api-key": KeyRound,
  limits: Gauge,
  control: ShieldCheck,
};

const LINK =
  "rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";

/**
 * "Built around your AI tools": the subscription statement (verbatim from content) and the
 * provider showcase, then the six facts as a quiet list with gold icons. Deep.
 */
export function AiToolsSection({ content }: { content: HomeContent["tools"] }) {
  return (
    <Section tone="deep" id="ai-tools" aria-labelledby="ai-tools-h">
      <Container className="flex flex-col gap-12 md:gap-16">
        <div className="grid items-end gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <MotionReveal>
            <SectionHeading id="ai-tools-h" title={content.heading} lead={content.lead} />
          </MotionReveal>
          <div className="flex flex-col items-start gap-3">
            <p className="max-w-[64ch] rounded-lg border border-l-2 border-white/10 border-l-gold bg-navy-800 p-5 text-base leading-relaxed text-snow">{content.subscriptionStatement}</p>
            <Link href="/ai-tools" className={`${LINK} inline-flex min-h-11 items-center text-sm font-semibold text-gold`}>
              How Agentopia works with your AI tools
            </Link>
          </div>
        </div>

        <figure className="flex min-w-0 flex-col gap-3">
          <IntegrationShowcase showLegend={false} />
          <figcaption className="text-sm text-mist">{content.visual.caption}</figcaption>
        </figure>

        <ul className="grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
          {content.cards.map((card) => {
            const Icon = ICONS[card.id] ?? ShieldCheck;
            return (
              <li key={card.id} className="flex gap-4 border-t border-white/10 py-6">
                <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-gold" />
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-base font-semibold text-snow">
                    {card.href ? (
                      <Link href={card.href} className={LINK}>
                        {card.title}
                      </Link>
                    ) : (
                      card.title
                    )}
                  </h3>
                  <p className="text-sm leading-relaxed text-mist">{card.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </Container>
    </Section>
  );
}
