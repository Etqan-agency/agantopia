"use client";

import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Global "Demo vs Live" indicator. Demo companies only ever run the simulated
 * provider; live companies run whatever provider each employee is connected to.
 */
export function ModeBadge({ isDemo, className, onDark }: { isDemo: boolean; className?: string; onDark?: boolean }) {
  const text = isDemo
    ? "Demo company. Every task, message and result here is simulated; no model is called."
    : "Live company. Employees with a verified provider call a real model; employees on the simulated provider are labelled.";
  return (
    <Tooltip content={text}>
      <span tabIndex={0} className={cn("inline-flex rounded-sm", className)} aria-label={text}>
        {isDemo ? (
          <Badge tone="simulated" className={cn(onDark && "border-gold bg-gold/10 text-gold")}>
            Demo
          </Badge>
        ) : (
          <Badge tone="moss" className={cn(onDark && "bg-success/15 text-success")}>
            Live
          </Badge>
        )}
      </span>
    </Tooltip>
  );
}

/** Inline tag for simulated items (tasks, executions, events). */
export function SimulatedTag({ className }: { className?: string }) {
  return (
    <Badge tone="simulated" className={className}>
      Simulated
    </Badge>
  );
}
