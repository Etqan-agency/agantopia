import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Marketing section tones. All three are dark (the marketing site has no white surfaces):
 * navy #111326 (default), raised navy-800 #1B2436, deep navy-950 #0C0E1C.
 * Alternate them so neighbouring sections always differ.
 */
type PaintedTone = "navy" | "raised" | "deep";

const ALIAS = { paper: "deep" } as const; // Deprecated alias of the old light tone: keeps older call sites compiling and renders "deep".

export type SectionTone = PaintedTone | keyof typeof ALIAS;

const TONE: Record<PaintedTone, string> = {
  navy: "bg-navy text-snow",
  raised: "bg-navy-800 text-snow",
  deep: "bg-navy-950 text-snow",
};

const PADDING = {
  normal: "py-16 md:py-24", // 64px mobile, 96px desktop
  tight: "py-10 md:py-14",
  none: "",
} as const;

/** The tone actually painted (resolves the deprecated alias). */
export function resolveTone(tone: SectionTone): PaintedTone {
  return tone in ALIAS ? ALIAS[tone as keyof typeof ALIAS] : (tone as PaintedTone);
}

/**
 * Full-bleed marketing section with a fixed dark tone (does not follow the app theme toggle).
 * Pair with `Container` inside and a `SectionHeading` whose `id` matches `aria-labelledby`.
 *
 * @example
 * <Section tone="deep" id="how" aria-labelledby="how-h">
 *   <Container><SectionHeading id="how-h" title="How it works" /></Container>
 * </Section>
 */
export function Section({
  tone,
  padding = "normal",
  className,
  ...props
}: Omit<ComponentProps<"section">, "id"> & {
  tone: SectionTone;
  id: string;
  "aria-labelledby"?: string;
  padding?: keyof typeof PADDING;
}) {
  return <section data-tone={resolveTone(tone)} className={cn("relative scroll-mt-20", TONE[resolveTone(tone)], PADDING[padding], className)} {...props} />;
}
