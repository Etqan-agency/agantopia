import { Container, Section } from "@/components/marketing/primitives";
import { FAQAccordion } from "@/components/marketing/sections/faq-accordion";
import type { FaqPageContent } from "@/content/marketing/types";
import { faqJsonLd, JsonLd } from "@/lib/seo";
import { ClosingBand, PageHeader } from "./detail-page";

/**
 * /faq: header, then each group from faq.ts as an h2 with its questions (h3) in FAQAccordion,
 * a sticky in-page index on wide screens, related links and the closing CTA. FAQPage JSON-LD
 * is built from exactly the items rendered here.
 */
export function FaqPage({ page }: { page: FaqPageContent }) {
  const items = page.groups.flatMap((g) => g.items);
  return (
    <>
      <PageHeader page={page} />
      <Section tone="deep" id="questions" aria-label="Questions by topic">
        <Container className="grid gap-12 lg:grid-cols-12 lg:gap-10">
          <nav aria-label="FAQ topics" className="lg:sticky lg:top-28 lg:col-span-3 lg:self-start">
            <p className="mb-3 text-sm font-semibold text-gold">On this page</p>
            <ul className="flex flex-wrap gap-2 lg:flex-col lg:gap-0 lg:border-l lg:border-white/10">
              {page.groups.map((g) => (
                <li key={g.id}>
                  <a
                    href={`#${g.id}`}
                    className="inline-flex min-h-11 items-center rounded-full lg:block lg:py-2.5 lg:leading-snug border border-snow/15 px-4 text-sm text-mist hover:border-gold/60 hover:text-snow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold lg:-ml-px lg:rounded-none lg:border-0 lg:border-l-2 lg:border-transparent lg:px-4 lg:hover:border-gold"
                  >
                    {g.heading}
                    <span aria-hidden className="tabular ml-2 text-gold/80">{g.items.length}</span>
                    <span className="sr-only"> ({g.items.length} questions)</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex min-w-0 flex-col gap-16 lg:col-span-8 lg:col-start-5">
            {page.groups.map((g) => (
              <section key={g.id} id={g.id} aria-labelledby={`${g.id}-h`} className="scroll-mt-24">
                <h2 id={`${g.id}-h`} className="mb-6 before:mb-4 before:block before:h-[3px] before:w-10 before:rounded-full before:bg-gold before:content-[''] font-display text-[1.75rem] leading-[1.15] font-semibold tracking-[-0.02em] text-snow lg:text-[2rem]">
                  {g.heading}
                </h2>
                <FAQAccordion items={g.items} headingLevel={3} />
              </section>
            ))}
          </div>
        </Container>
      </Section>
      <ClosingBand page={page} tone="navy" />
      <JsonLd data={faqJsonLd(items)} id="ld-faq" />
    </>
  );
}
