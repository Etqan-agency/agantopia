import Link from "next/link";
import { Container } from "@/components/marketing/primitives/container";
import { Section } from "@/components/marketing/primitives/section";
import { Button } from "@/components/ui/button";
import type { ClosingCta } from "@/content/marketing/types";
import { HERO_CAST } from "../office/floor-geometry";
import { OfficeFloorSvg } from "../office/office-floor-svg";
import { sceneEndFrame } from "../hero/hero-script";

/** Closing call to action over a quiet, static callback of the hero office and a soft gold light. Raised. */
export function FinalCtaSection({ content }: { content: ClosingCta }) {
  const frame = sceneEndFrame(2); // lamps on: the moment the office is busiest
  return (
    <Section tone="raised" id="get-started" aria-labelledby="final-cta-h" className="overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="w-[1100px] max-w-none shrink-0 opacity-[0.14] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_70%)] md:w-[1300px]">
          <OfficeFloorSvg cast={HERO_CAST} states={frame.states} lamps={frame.lamps} tags={false} idPrefix="cta-floor" />
        </div>
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 size-[44rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,var(--color-gold)_0%,transparent_62%)] opacity-[0.14]"
      />
      <Container className="relative flex flex-col items-center gap-6 py-8 text-center md:py-12">
        <span aria-hidden className="block h-[3px] w-10 rounded-full bg-gold" />
        <h2 id="final-cta-h" className="max-w-[18ch] font-display text-[2.25rem] leading-[1.1] font-semibold tracking-[-0.02em] lg:text-[3rem]">
          {content.heading}
        </h2>
        <p className="max-w-[52ch] text-base leading-relaxed text-mist md:text-lg">{content.body}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild variant="brand" size="lg">
            <Link href={content.ctas.primary.href} data-cta={content.ctas.primary.dataCta}>
              {content.ctas.primary.label}
            </Link>
          </Button>
          {content.ctas.secondary ? (
            <Button asChild variant="gold" size="lg">
              <Link href={content.ctas.secondary.href} data-cta={content.ctas.secondary.dataCta}>
                {content.ctas.secondary.label}
              </Link>
            </Button>
          ) : null}
        </div>
      </Container>
    </Section>
  );
}
