import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/marketing/primitives";
import { HOME } from "@/content/marketing/home";
import type { CtaPair } from "@/content/marketing/types";
import { cn } from "@/lib/utils";

/**
 * Closing call to action: heading, body, a primary (brand violet) and optional secondary
 * (gold) CTA with `data-cta` hooks, and an optional decorative `backdrop` slot drawn behind
 * the text (keep it quiet; it is aria-hidden). Paints its own navy or raised panel; the raised
 * panel carries a soft gold radial light (opacity <= 0.18) behind the heading. Place a raised
 * panel on a navy or deep section and a navy panel on a raised section.
 *
 * @example
 * <ConversionCta />
 * <ConversionCta tone="raised" heading="Bring your Claude plan" body="Sign in on your own machine." ctas={closingCtas("claude-code")} />
 */
export function ConversionCta({
  heading = HOME.finalCta.heading,
  body = HOME.finalCta.body,
  ctas = HOME.finalCta.ctas,
  tone = "raised",
  backdrop,
  headingId,
  headingLevel: H = "h2",
  className,
}: {
  heading?: string;
  body?: string;
  ctas?: CtaPair;
  tone?: "raised" | "navy";
  backdrop?: ReactNode;
  headingId?: string;
  headingLevel?: "h2" | "h3";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-xl border px-6 py-12 text-snow sm:px-10 md:py-16",
        tone === "raised" ? "border-white/10 bg-navy-800" : "border-white/10 bg-navy",
        className,
      )}
    >
      {tone === "raised" ? (
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -left-24 -z-10 size-[34rem] rounded-full bg-[radial-gradient(circle,var(--color-gold)_0%,transparent_65%)] opacity-[0.16]"
        />
      ) : null}
      {backdrop ? (
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          {backdrop}
        </div>
      ) : null}
      <div className="flex max-w-2xl flex-col gap-4">
        <H id={headingId} className="font-display text-[2rem] leading-[1.1] font-semibold tracking-[-0.02em] md:text-[2.5rem]">
          {heading}
        </H>
        <p className="max-w-[60ch] text-base leading-relaxed text-mist md:text-lg">{body}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button asChild variant="brand" size="lg" className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold">
            <Link href={ctas.primary.href} data-cta={ctas.primary.dataCta}>
              {ctas.primary.label}
            </Link>
          </Button>
          {ctas.secondary ? (
            <Button asChild variant="gold" size="lg" className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold">
              <Link href={ctas.secondary.href} data-cta={ctas.secondary.dataCta}>
                {ctas.secondary.label}
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
