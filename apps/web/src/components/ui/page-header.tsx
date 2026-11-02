import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  meta,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b border-rule pb-5", className)}>
      <div className="flex min-w-0 flex-col gap-1.5">
        {meta ? <div className="flex flex-wrap items-center gap-2 text-sm text-fg-muted">{meta}</div> : null}
        <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="max-w-prose text-sm leading-relaxed text-fg-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** Section heading inside a page: a rule, a title, optional actions. */
export function SectionHeader({
  title,
  description,
  actions,
  className,
  as: As = "h2",
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  as?: "h2" | "h3";
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3 pb-3", className)}>
      <div className="flex flex-col gap-1">
        <As className="text-base font-semibold">{title}</As>
        {description ? <p className="max-w-prose text-sm leading-relaxed text-fg-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
