import { cn } from "@/lib/utils";

export type ConnectorTone = "violet" | "lavender" | "gold" | "mist";

const STROKE: Record<ConnectorTone, string> = {
  violet: "stroke-violet",
  lavender: "stroke-lavender",
  gold: "stroke-gold",
  mist: "stroke-mist",
};

/**
 * An SVG connector between two points. Renders a `<g>`: place it inside your own `<svg>`
 * (so several connectors share one viewBox). Inactive: a faint solid track. Active: dashes
 * travel along the path in the direction it is drawn. Under reduced motion the active path
 * is a static solid line.
 *
 * @example
 * <svg viewBox="0 0 400 200" className="w-full" aria-hidden>
 *   <AnimatedConnector d="M40 40 C 200 40, 200 160, 360 160" active={handoff} tone="gold" />
 * </svg>
 */
export function AnimatedConnector({
  d,
  active = false,
  tone = "lavender",
  strokeWidth = 2,
  className,
}: {
  d: string;
  active?: boolean;
  tone?: ConnectorTone;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <g className={className} fill="none" strokeLinecap="round">
      <path d={d} className={cn(STROKE[tone], "opacity-25")} strokeWidth={strokeWidth} />
      <path
        d={d}
        className={cn(
          STROKE[tone],
          "transition-opacity duration-[240ms] ease-brand [stroke-dasharray:6_6] motion-safe:animate-connector motion-reduce:[stroke-dasharray:none]",
          active ? "opacity-100" : "opacity-0",
        )}
        strokeWidth={strokeWidth}
      />
    </g>
  );
}
