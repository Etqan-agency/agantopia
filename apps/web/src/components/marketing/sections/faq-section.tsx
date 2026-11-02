import Link from "next/link";
import { Container } from "@/components/marketing/primitives/container";
import { Section, type SectionTone } from "@/components/marketing/primitives/section";
import { SectionHeading } from "@/components/marketing/primitives/section-heading";
import type { HomeContent } from "@/content/marketing/types";
import { FAQAccordion } from "./faq-accordion";

/** Homepage FAQ: the first `limit` questions and a gold link to the full /faq page. */
export function FaqSection({ content, tone = "navy", limit = 6 }: { content: HomeContent["faq"]; tone?: SectionTone; limit?: number }) {
  return (
    <Section tone={tone} id="faq" aria-labelledby="faq-h">
      <Container className="grid gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16">
        <div className="flex flex-col items-start gap-4">
          <SectionHeading id="faq-h" title={content.heading} />
          <Link
            href="/faq"
            className="inline-flex min-h-11 items-center rounded-sm text-sm font-semibold text-gold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            See all questions
          </Link>
        </div>
        <FAQAccordion items={content.items.slice(0, limit)} />
      </Container>
    </Section>
  );
}
