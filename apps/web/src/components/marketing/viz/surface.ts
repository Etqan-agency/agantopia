/**
 * Colour sets for viz components. Every marketing tone is dark, so both surfaces are dark:
 * - "dark": the component sits on a navy or deep (navy-950) section; panels are navy-800.
 * - "raised": the component sits on a raised (navy-800) section; panels step up to navy-700
 *   so they still separate from the background.
 * Gold is used for icons, markers and the active state of selectors. Tokens only.
 */
export type Surface = "dark" | "raised";

const SHARED = {
  text: "text-snow",
  muted: "text-mist",
  accent: "text-lavender",
  /** Check / feature icons. */
  icon: "text-gold",
  rule: "border-white/10",
  focus: "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
  chip: "border-snow/15 bg-snow/[0.04] text-snow",
  hover: "hover:bg-snow/[0.06]",
  /** Selected / pressed item in a selector. */
  selected: "border-gold bg-gold/10",
  /** Numbered marker that is not the current one. */
  marker: "border-gold/60 text-gold",
} as const;

export const SURFACE = {
  dark: {
    ...SHARED,
    panel: "border-white/10 bg-navy-800 text-snow",
    inset: "border-white/10 bg-navy",
    raised: "border-white/10 bg-navy-700",
    /** Unselected interactive cell inside a panel. */
    idle: "border-white/15 bg-navy",
    /** SVG fills for floor plans and diagram nodes. */
    fillBase: "fill-navy",
    fillRoom: "fill-navy-700",
  },
  raised: {
    ...SHARED,
    panel: "border-white/10 bg-navy-700 text-snow",
    inset: "border-white/10 bg-navy-800",
    raised: "border-white/10 bg-navy-600",
    idle: "border-white/15 bg-navy-800",
    fillBase: "fill-navy-800",
    fillRoom: "fill-navy-600",
  },
} as const;

/** The viz surface for a section tone. */
export function surfaceFor(tone: string): Surface {
  return tone === "raised" ? "raised" : "dark";
}
