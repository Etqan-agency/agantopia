import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { HeroContent } from "@/content/marketing/types";
import { cn } from "@/lib/utils";
import { HeroMotionGate } from "./hero-motion-gate";
import { HeroSceneB, heroVignetteClass } from "./hero-scene-b";

const BRACKET = "pointer-events-none absolute z-[3] size-6 border-0 border-gold/55";

/**
 * Homepage hero ("Hero B", owner-approved; plan §6 rules on CLS, reduced motion, offscreen pause,
 * server-rendered copy). Centred two-line headline over an illustrated scene: the owner at a gold
 * rail watching the AI team in a spotlight. The site navbar sits above; the section fills the rest
 * of the first screen. All copy is HTML; the scene is a decorative server-rendered SVG.
 */
export function HeroSection({ hero }: { hero: HeroContent }) {
  return (
    <HeroMotionGate
      aria-labelledby="hero-heading"
      data-hero
      className="relative isolate flex min-h-[calc(100svh-4rem)] flex-col overflow-hidden bg-navy text-snow"
    >
      <HeroSceneB />

      <span aria-hidden className={cn(BRACKET, "top-3 left-3 border-t border-l", "max-[560px]:top-2 max-[560px]:left-2")} />
      <span aria-hidden className={cn(BRACKET, "top-3 right-3 border-t border-r", "max-[560px]:top-2 max-[560px]:right-2")} />
      <span aria-hidden className={cn(BRACKET, "bottom-3 left-3 border-b border-l", "max-[560px]:bottom-2 max-[560px]:left-2")} />
      <span aria-hidden className={cn(BRACKET, "right-3 bottom-3 border-r border-b", "max-[560px]:right-2 max-[560px]:bottom-2")} />

      {/* Top padding adds the 8px the concept's 72px top bar had over the 64px navbar. */}
      <div className="relative z-[2] mx-auto flex w-full max-w-[1200px] flex-col items-center px-4 pt-[clamp(32px,calc(6vh+8px),72px)] text-center max-[560px]:pt-4">
        <div aria-hidden className={cn("pointer-events-none absolute -inset-x-[12%] -top-10 -bottom-6 -z-10", heroVignetteClass)} />
        <h1 id="hero-heading" className="font-display text-[clamp(40px,calc(4.4vw+8px),76px)] leading-[1.05] font-bold tracking-[-0.03em] text-balance">
          <span className="block text-snow">{hero.headline}</span>
          <span className="block text-gold">{hero.headlineSecond}</span>
        </h1>
        <p className={cn("mt-5 max-w-[44ch] text-lg leading-[1.6] text-mist", "max-[560px]:mt-4 max-[560px]:text-base")}>{hero.support}</p>
        <div className={cn("mt-7 flex flex-wrap justify-center gap-3.5", "max-[560px]:mt-[22px] max-[560px]:w-full max-[560px]:max-w-[340px] max-[560px]:flex-col max-[560px]:items-stretch max-[560px]:gap-2.5")}>
          <Button asChild variant="gold" size="lg" className={cn("h-[52px] px-[26px]", "max-[560px]:h-[46px]")}>
            <Link href={hero.ctas.primary.href} data-cta={hero.ctas.primary.dataCta}>
              {hero.ctas.primary.label}
            </Link>
          </Button>
          {hero.ctas.secondary ? (
            <Button asChild variant="outline-gold" size="lg" className={cn("h-[52px] bg-navy/55 px-[26px] hover:border-gold", "max-[560px]:h-[46px]")}>
              <Link href={hero.ctas.secondary.href} data-cta={hero.ctas.secondary.dataCta}>
                {hero.ctas.secondary.label}
              </Link>
            </Button>
          ) : null}
        </div>
        <p className={cn("mt-[18px] max-w-[62ch] text-sm leading-normal text-mist", "max-[560px]:mt-3.5 max-[560px]:text-[13px]")}>
          {hero.trustLine}{" "}
          <Link
            href="/how-it-works"
            data-cta="hero-how-it-works"
            className="rounded-sm font-semibold whitespace-nowrap text-gold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            See how it works
          </Link>
        </p>
      </div>

      {/* Room for the team; the scene itself is the absolutely positioned SVG above. */}
      <div aria-hidden className={cn("min-h-[clamp(300px,40vh,560px)] flex-[1_0_auto]", "max-[560px]:min-h-[290px]")} />

      <p className="sr-only">{hero.visual.caption}</p>

      <div className={cn("pointer-events-none absolute inset-x-10 bottom-[22px] z-[4] flex items-end justify-between gap-3", "max-[560px]:inset-x-4 max-[560px]:bottom-4")}>
        <span className="inline-flex h-[26px] items-center rounded-full border border-dashed border-gold/80 bg-navy/80 px-3 text-xs leading-5 font-medium whitespace-nowrap text-gold">
          {hero.visual.label}, not a live scene
        </span>
        <span className={cn("rounded-md bg-navy/70 px-2 py-0.5 text-xs text-mist", "max-[560px]:hidden")}>
          <i aria-hidden className="mr-[5px] inline-block size-[7px] rounded-full bg-gold align-[1px]" />
          gold lamp = working ·{" "}
          <i aria-hidden className="mr-[5px] inline-block size-[7px] rounded-full bg-violet align-[1px]" />
          violet = agent · you = at the rail
        </span>
      </div>
    </HeroMotionGate>
  );
}
