import { Info } from "lucide-react";
import { Container, MotionReveal, Section, SectionHeading } from "@/components/marketing/primitives";
import { AgentRoleSelector, profileFromRole } from "@/components/marketing/viz";
import type { HomeContent } from "@/content/marketing/types";

/** "Meet your AI workforce": example roles in a tab switcher, each with a full profile card. Raised. */
export function WorkforceSection({ content }: { content: HomeContent["workforce"] }) {
  const profiles = content.roles.map(profileFromRole);
  return (
    <Section tone="raised" id="workforce" aria-labelledby="workforce-h">
      <Container className="grid gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-14">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <MotionReveal>
            <SectionHeading id="workforce-h" title={content.heading} lead={content.lead} />
          </MotionReveal>
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <AgentRoleSelector profiles={profiles} surface="raised" label="Example roles" />
          <p className="flex items-start gap-2.5 border-t border-white/10 pt-4 text-sm leading-relaxed text-mist">
            <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-gold" />
            {content.note}
          </p>
        </div>
      </Container>
    </Section>
  );
}
