import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Pill variants. `gold` is live work (Working / In progress): gold fill, navy text.
 * `gold-outline` is waiting (awaiting approval, waiting for reset). `simulated` is the dashed
 * honesty label used by DemoBadge.
 */
export type PillVariant = "neutral" | "violet" | "gold" | "gold-outline" | "success" | "danger" | "simulated";

const VARIANT: Record<PillVariant, string> = {
  neutral: "border-snow/15 bg-snow/[0.06] text-snow",
  violet: "border-lavender/30 bg-violet/20 text-lavender",
  gold: "border-gold bg-gold text-navy",
  "gold-outline": "border-gold/70 bg-transparent text-gold",
  success: "border-success/35 bg-success/15 text-success",
  danger: "border-danger/35 bg-danger/15 text-danger",
  simulated: "border-dashed border-gold/70 bg-transparent text-gold",
};

const DOT: Record<PillVariant, string> = {
  neutral: "bg-mist",
  violet: "bg-lavender",
  gold: "bg-navy",
  "gold-outline": "bg-gold",
  success: "bg-success",
  danger: "bg-danger",
  simulated: "bg-gold",
};

/**
 * Small status / label pill for the (always dark) marketing surfaces.
 * `dot` adds a leading lamp dot.
 *
 * @example
 * <Pill variant="gold" dot>Working</Pill>
 * <Pill variant="gold-outline">Awaiting approval</Pill>
 * <Pill variant="success">Completed</Pill>
 */
export function Pill({
  variant = "neutral",
  dot = false,
  className,
  children,
  ...props
}: ComponentProps<"span"> & { variant?: PillVariant; dot?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium leading-5",
        VARIANT[variant],
        className,
      )}
      {...props}
    >
      {dot ? <span aria-hidden className={cn("size-1.5 rounded-full", DOT[variant])} /> : null}
      {children}
    </span>
  );
}
