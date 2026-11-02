import { Container, MotionReveal, Section, SectionHeading } from "@/components/marketing/primitives";
import type { HomeContent } from "@/content/marketing/types";
import { OfficeAliveStory } from "./office-alive-story";

/** "The office comes alive": five beats beside a pinned office (stepper on small screens). Navy. */
export function OfficeAliveSection({ content }: { content: HomeContent["officeAlive"] }) {
  return (
    <Section tone="navy" id="office-alive" aria-labelledby="office-alive-h">
      <Container className="flex flex-col gap-10 md:gap-14">
        <MotionReveal>
          <SectionHeading id="office-alive-h" title={content.heading} lead={content.lead} />
        </MotionReveal>
        <OfficeAliveStory beats={content.beats} caption={content.visual.caption} />
      </Container>
    </Section>
  );
}
