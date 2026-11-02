import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** An empty screen is an invitation to act: say what goes here and offer the action. */
export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-start gap-3 border-t border-b border-dashed border-rule-strong py-10", className)}>
      {icon ? <div className="text-fg-muted [&_svg]:size-5">{icon}</div> : null}
      <div className="flex max-w-prose flex-col gap-1">
        <h3 className="text-base font-semibold">{title}</h3>
        {description ? <p className="text-sm leading-relaxed text-fg-muted">{description}</p> : null}
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
