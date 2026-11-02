import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SURFACE, type Surface } from "./surface";

export type BentoItem = {
  title: string;
  body: string;
  media?: ReactNode;
  href?: string;
  /** Columns from 1024px. Omit to use the default zig-zag (2,1 / 1,2 / 2,1). */
  span?: 1 | 2;
};

const ZIGZAG: (1 | 2)[] = [2, 1, 1, 2, 2, 1];

/**
 * A quiet asymmetric grid for six (or any number of) features: navy-800 cells (navy-700 on a
 * raised section), one 1px rule, no shadows or glows. The first cell carries a 2px gold top
 * border; linked cells lift their border to gold on hover. Cells with `href` are links; `media` sits above
 * the text. Spans default to a zig-zag so rows read 2+1, 1+2, 2+1 on three columns.
 *
 * @example
 * <BentoFeatureGrid items={HOME.tools.cards.map(({ title, body, href }) => ({ title, body, href }))} />
 */
export function BentoFeatureGrid({
  items,
  surface = "dark",
  headingLevel: H = "h3",
  className,
}: {
  items: BentoItem[];
  surface?: Surface;
  headingLevel?: "h2" | "h3";
  className?: string;
}) {
  const s = SURFACE[surface];
  return (
    <ul className={cn("grid gap-3 md:grid-cols-2 lg:grid-cols-3", className)}>
      {items.map((item, i) => {
        const span = item.span ?? ZIGZAG[i % ZIGZAG.length];
        const cell = cn(
          "flex h-full flex-col gap-4 rounded-lg border p-6 transition-colors duration-[160ms]",
          s.panel,
          i === 0 && "border-t-2 border-t-gold",
          item.href && "hover:border-gold/60",
        );
        const content = (
          <>
            {item.media ? <div className="min-w-0">{item.media}</div> : null}
            <div className="mt-auto flex flex-col gap-2">
              <H className="font-display text-lg font-semibold tracking-tight">{item.title}</H>
              <p className={cn("max-w-[56ch] text-sm leading-relaxed", s.muted)}>{item.body}</p>
              {item.href ? (
                <span className="text-sm font-medium text-gold underline-offset-4 group-hover:underline">
                  Learn more<span className="sr-only"> about {item.title}</span>
                </span>
              ) : null}
            </div>
          </>
        );
        return (
          <li key={`${item.title}-${i}`} className={cn(span === 2 && "md:col-span-2 lg:col-span-2")}>
            {item.href ? (
              <Link href={item.href} className={cn(cell, "group", s.focus)}>
                {content}
              </Link>
            ) : (
              <div className={cell}>{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
