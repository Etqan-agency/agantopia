import { Container, MotionReveal, Section, SectionHeading } from "@/components/marketing/primitives";
import { LearningJourney } from "@/components/marketing/viz";
import type { HomeContent } from "@/content/marketing/types";

/**
 * "Agents that learn over time": a two-column intro (heading and lead; the four kinds of
 * learning as a quiet definition list) above the learning journey. Deep.
 */
export function LearningSection({ content }: { content: HomeContent["learning"] }) {
  return (
    <Section tone="deep" id="learning" aria-labelledby="learning-h">
      <Container className="flex flex-col gap-12 md:gap-16">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <MotionReveal>
            <SectionHeading id="learning-h" title={content.heading} lead={content.lead} />
          </MotionReveal>
          <dl aria-label="Four things learning means here" className="grid gap-x-10 sm:grid-cols-2">
            {content.distinctions.map((d) => (
              <div key={d.term} className="flex flex-col gap-1.5 border-t border-white/10 py-5">
                <dt className="flex items-center gap-2 font-display text-base font-semibold tracking-tight text-snow">
                  <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-gold" />
                  {d.term}
                </dt>
                <dd className="text-sm leading-relaxed text-mist">{d.body}</dd>
              </div>
            ))}
          </dl>
        </div>
        <figure className="flex flex-col gap-3">
          <LearningJourney stages={content.stages} distinctions={[]} notRetrained={content.notRetrained} />
          <figcaption className="text-sm text-mist">{content.visual.caption}</figcaption>
        </figure>
      </Container>
    </Section>
  );
}
