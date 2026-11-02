import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TITLE = {
  // h2 scale: 36px mobile, 44px desktop.
  md: "text-[2.25rem] leading-[1.1] lg:text-[2.75rem]",
  // Page / hero scale: 40px mobile, 56px tablet, 72px desktop.
  lg: "text-[2.5rem] leading-[1.05] md:text-[3.5rem] lg:text-[4.5rem] tracking-[-0.03em]",
} as const;

/**
 * Section title (Sora 600, sentence case, snow) with a short gold rule above it, an optional
 * gold `kicker` (sentence case) and an optional mist lead paragraph. Every marketing tone is
 * dark, so the heading is always light on dark.
 *
 * @example
 * <SectionHeading id="features-h" title="What your company can do" lead="Hire, plan, review." />
 * <SectionHeading id="learn-h" kicker="Learning" title="Agents that learn over time" />
 */
export function SectionHeading({
  id,
  title,
  lead,
  kicker,
  align = "start",
  size = "md",
  as: Tag = "h2",
  rule = true,
  className,
}: {
  id: string;
  title: ReactNode;
  lead?: ReactNode;
  /** Short gold label above the title (sentence case). */
  kicker?: ReactNode;
  align?: "start" | "center";
  size?: keyof typeof TITLE;
  as?: "h1" | "h2" | "h3";
  /** The 40×3 gold rule above the title. */
  rule?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex max-w-3xl flex-col gap-4", align === "center" && "mx-auto items-center text-center", className)}>
      {rule || kicker ? (
        <div className={cn("flex flex-col gap-3", align === "center" && "items-center")}>
          {rule ? <span aria-hidden className="block h-[3px] w-10 rounded-full bg-gold" /> : null}
          {kicker ? <p className="text-sm font-semibold text-gold">{kicker}</p> : null}
        </div>
      ) : null}
      <Tag id={id} className={cn("font-display font-semibold tracking-[-0.02em] text-snow", TITLE[size])}>
        {title}
      </Tag>
      {lead ? <p className="max-w-[62ch] text-base leading-relaxed text-mist md:text-lg">{lead}</p> : null}
    </div>
  );
}
