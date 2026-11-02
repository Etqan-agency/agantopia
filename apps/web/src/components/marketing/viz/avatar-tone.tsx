import { initials } from "@/components/avatar-swatch";
import { cn } from "@/lib/utils";

/**
 * Avatar palette ids shared with the office (AVATAR_PALETTES / CHARACTER_PALETTES), expressed
 * as brand tokens instead of hex so marketing stays token-only.
 */
export const AVATAR_TONE = {
  teal: "bg-lavender text-navy ring-violet", // Lavender
  moss: "bg-gold text-navy ring-gold-deep", // Gold
  brick: "bg-navy text-snow ring-mist/60", // Navy
  sky: "bg-mist text-navy ring-mist", // Mist
  saffron: "bg-snow text-violet-deep ring-violet", // Snow & violet
  plum: "bg-violet text-white ring-gold", // Violet & gold (white initials: gold on violet is 3.1:1)
} as const;

export type AvatarTone = keyof typeof AVATAR_TONE;

/**
 * Decorative initials disc in one of the office avatar palettes. Pair with the visible name.
 *
 * @example
 * <AvatarDisc name="Lina Farouk" tone="teal" size="lg" />
 */
export function AvatarDisc({
  name,
  tone,
  size = "md",
  className,
}: {
  name: string;
  tone: AvatarTone;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-display font-semibold tracking-tight ring-[1.5px] ring-inset select-none",
        size === "sm" && "size-7 text-[11px]",
        size === "md" && "size-10 text-sm",
        size === "lg" && "size-14 text-base",
        AVATAR_TONE[tone],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
