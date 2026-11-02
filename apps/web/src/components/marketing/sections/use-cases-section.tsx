import Link from "next/link";
import { Container, MotionReveal, Section, SectionHeading } from "@/components/marketing/primitives";
import { UseCaseShowcase } from "@/components/marketing/viz";
import type { HomeContent } from "@/content/marketing/types";

/** Use cases grid; items with a page link to /use-cases/*. Deep. */
export function UseCasesSection({ content }: { content: HomeContent["useCases"] }) {
  return (
    <Section tone="deep" id="use-cases" aria-labelledby="use-cases-h">
      <Container className="flex flex-col gap-10 md:gap-14">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <MotionReveal>
            <SectionHeading id="use-cases-h" title={content.heading} lead={content.lead} />
          </MotionReveal>
          <Link
            href="/use-cases"
            className="inline-flex min-h-11 shrink-0 items-center rounded-sm text-sm font-semibold text-gold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            See all use cases
          </Link>
        </div>
        <UseCaseShowcase items={content.items} />
      </Container>
    </Section>
  );
}
