"use client";

import { cn } from "@/lib/utils";

export type Step = { id: string; label: string; description?: string };

/**
 * Accessible ordered step list with a current step. The non-motion alternative for any
 * scripted animation (and its manual scene control under reduced motion).
 * With `onSelect`, each step is a button; without it, the list is static. Markers: the current
 * step is a gold disc with a navy number, the others a gold outline.
 *
 * @example
 * <Stepper label="Demo scenes" steps={scenes} current={scene} onSelect={setScene} />
 */
export function Stepper({
  steps,
  current,
  onSelect,
  label,
  orientation = "vertical",
  className,
}: {
  steps: readonly Step[];
  current: number;
  onSelect?: (index: number) => void;
  /** Accessible name of the list. */
  label: string;
  orientation?: "vertical" | "horizontal";
  className?: string;
}) {
  return (
    <ol aria-label={label} className={cn("flex gap-1", orientation === "vertical" ? "flex-col" : "flex-row flex-wrap", className)}>
      {steps.map((step, i) => {
        const state = i < current ? "done" : i === current ? "current" : "upcoming";
        const marker = (
          <span
            aria-hidden
            className={cn(
              "mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular",
              state === "current" && "border-gold bg-gold text-navy",
              state === "done" && "border-gold/70 text-gold",
              state === "upcoming" && "border-gold/40 text-gold/80",
            )}
          >
            {i + 1}
          </span>
        );
        const text = (
          <span className="flex min-w-0 flex-col">
            <span className={cn("text-sm font-medium", state === "current" ? "text-snow" : "text-mist")}>
              {step.label}
            </span>
            {step.description ? <span className="text-xs leading-relaxed text-mist">{step.description}</span> : null}
          </span>
        );
        const row = "flex w-full items-start gap-3 rounded-md px-2.5 py-2 text-left";
        return (
          <li key={step.id} aria-current={state === "current" ? "step" : undefined}>
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(i)}
                className={cn(
                  row,
                  "cursor-pointer transition-colors duration-[160ms] focus-visible:outline-2 focus-visible:outline-offset-1",
                  "hover:bg-snow/[0.06] focus-visible:outline-gold",
                )}
              >
                {marker}
                {text}
              </button>
            ) : (
              <div className={row}>
                {marker}
                {text}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
