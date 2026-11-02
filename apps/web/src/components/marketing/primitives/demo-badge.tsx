import { Pill } from "./pill";

const LABEL = { scripted: "Scripted demo", illustrative: "Illustrative data" } as const;

/**
 * Honesty label for any scripted or illustrative visual. Must stay visible (never hover-only)
 * whenever the visual it labels is visible.
 *
 * @example
 * <div className="relative"><HeroOffice /><DemoBadge className="absolute top-3 left-3" /></div>
 * <DemoBadge kind="illustrative" />
 */
export function DemoBadge({ kind = "scripted", className }: { kind?: keyof typeof LABEL; className?: string }) {
  return (
    <Pill variant="simulated" className={className} data-demo-badge={kind}>
      {LABEL[kind]}
    </Pill>
  );
}
