import { ArrowUpRight, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { HOME } from "@/content/marketing/home";
import type { UseCaseCard } from "@/content/marketing/types";
import { cn } from "@/lib/utils";
import { USE_CASE_REVIEW } from "./sample-data";
import { SURFACE, type Surface } from "./surface";

/** Item indexes that span two columns at 1024px+ (for six items: 2+1, 1+2, 1+2). */
const LG_WIDE = new Set([0, 3, 5]);

export type UseCaseItem = UseCaseCard & { reviewed?: string };

/**
 * The use cases as a grid: title, one-line value, the specialists involved as role chips and
 * what gets reviewed. Items with an `href` link to their page (the whole card is the link);
 * items without one are plain cards. The first item spans two columns (as do the 4th and 6th
 * from 1024px, so six items fill three rows), and cards alternate between a filled and an outlined treatment so the grid does not repeat itself.
 * The lead card carries a 2px gold top border; linked cards lift their border to gold on hover.
 *
 * @example
 * <UseCaseShowcase />
 * <UseCaseShowcase surface="raised" items={HOME.useCases.items.slice(0, 4)} />
 */
export function UseCaseShowcase({
  items = HOME.useCases.items,
  surface = "dark",
  headingLevel: H = "h3",
  className,
}: {
  items?: UseCaseItem[];
  surface?: Surface;
  headingLevel?: "h2" | "h3";
  className?: string;
}) {
  const s = SURFACE[surface];
  const orphanAtTwo = (items.length - 1) % 2 === 1;

  return (
    <ul className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {items.map((item, i) => {
        const lead = i === 0;
        const filled = lead || i % 3 === 1;
        const reviewed = item.reviewed ?? USE_CASE_REVIEW[item.id];
        const card = cn(
          "group relative flex h-full flex-col gap-4 rounded-lg border p-5 transition-colors duration-[160ms] sm:p-6",
          filled ? s.panel : "border-white/15 bg-transparent",
          lead && "border-t-2 border-t-gold",
          item.href && "hover:border-gold/60",
        );
        const content = (
          <>
            <div className="flex items-start justify-between gap-3">
              <H className={cn("font-display font-semibold tracking-tight", lead ? "text-2xl" : "text-lg")}>{item.title}</H>
              {item.href ? <ArrowUpRight aria-hidden className={cn("size-5 shrink-0 transition-transform duration-[160ms] group-hover:translate-x-0.5 group-hover:-translate-y-0.5", s.icon)} /> : null}
            </div>
            <p className={cn("leading-relaxed", lead ? "max-w-[52ch] text-base" : "text-sm", s.muted)}>{item.body}</p>
            <div className="flex flex-col gap-2">
              <span className={cn("text-xs font-medium", s.muted)}>Who works on it</span>
              <ul className="flex flex-wrap gap-1.5" aria-label="Specialists involved">
                {item.specialists.map((role) => (
                  <li key={role} className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", s.chip)}>
                    {role}
                  </li>
                ))}
              </ul>
            </div>
            {reviewed ? (
              <p className={cn("mt-auto flex items-start gap-2 border-t pt-4 text-sm leading-relaxed", s.rule)}>
                <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
                <span>
                  <span className="sr-only">What gets reviewed: </span>
                  {reviewed}
                </span>
              </p>
            ) : null}
          </>
        );
        return (
          <li
            key={item.id}
            className={cn(
              // Lead spans two columns; at 3 columns rows read 2+1, 1+2, 1+2 so six items fill the grid.
              lead && "sm:col-span-2",
              LG_WIDE.has(i) && "lg:col-span-2",
              // At 2 columns an odd remainder would leave a gap: the last card spans instead.
              orphanAtTwo && i === items.length - 1 && cn("sm:col-span-2", !LG_WIDE.has(i) && "lg:col-span-1"),
            )}
          >
            {item.href ? (
              <Link href={item.href} className={cn(card, s.focus)}>
                {content}
              </Link>
            ) : (
              <div className={card}>{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
