import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return <div aria-hidden className={cn("animate-pulse rounded-sm bg-surface-sunken", className)} {...props} />;
}

/** A few stacked rows used as the default loading state for lists and tables. */
export function SkeletonRows({ rows = 5, className, label = "Loading" }: { rows?: number; className?: string; label?: string }) {
  return (
    <div role="status" aria-live="polite" className={cn("flex flex-col divide-y divide-rule", className)}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 py-3.5">
          <Skeleton className="size-8 rounded-full" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="ml-auto h-4 w-20" />
        </div>
      ))}
    </div>
  );
}
