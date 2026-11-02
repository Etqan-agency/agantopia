import { DemoBadge } from "@/components/marketing/primitives";
import { cn } from "@/lib/utils";
import { RunOnView } from "./run-on-view";
import { SAMPLE_TASK, SAMPLE_TIMELINE, type TimelineStep } from "./sample-data";
import { delayClass } from "./sequence";
import { SURFACE, type Surface } from "./surface";

const LAMP: Record<TimelineStep["lamp"], string> = {
  done: "bg-lavender",
  active: "bg-gold motion-safe:animate-lamp",
  waiting: "border-2 border-gold bg-transparent",
  idle: "border-2 border-mist bg-transparent",
};

/**
 * A vertical task timeline in the product's own shape: event label, actor, timestamp and one
 * activity-feed sentence per step, with lamp dots (gold marks the live step). With `animate`,
 * steps reveal one after another the first time the timeline scrolls into view; without JS or
 * under reduced motion all steps are shown.
 *
 * @example
 * <TaskProgressTimeline />
 * <TaskProgressTimeline animate surface="raised" title="Build the pricing page hero" steps={steps} />
 */
export function TaskProgressTimeline({
  steps = SAMPLE_TIMELINE,
  title = SAMPLE_TASK,
  animate = false,
  surface = "dark",
  showBadge,
  className,
}: {
  steps?: TimelineStep[];
  /** Task title shown above the timeline. */
  title?: string;
  animate?: boolean;
  surface?: Surface;
  /** Defaults to true while the built-in sample steps are shown. */
  showBadge?: boolean;
  className?: string;
}) {
  const s = SURFACE[surface];
  const badge = showBadge ?? steps === SAMPLE_TIMELINE;
  const body = (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className={cn("text-xs font-medium", s.muted)}>Task timeline</span>
          <p className="font-display text-lg font-semibold tracking-tight">{title}</p>
        </div>
        {badge ? <DemoBadge kind="illustrative" /> : null}
      </div>
      <ol aria-label="Task timeline" className="relative flex flex-col border-l border-white/15 pl-6">
        {steps.map((step, i) => (
          <li
            key={step.id}
            className={cn(
              "relative pb-5 last:pb-0",
              animate &&
                cn(
                  "translate-y-1 opacity-0 transition-[opacity,translate] duration-[400ms] ease-brand group-data-[run=on]/run:translate-y-0 group-data-[run=on]/run:opacity-100",
                  delayClass(i),
                ),
            )}
          >
            <span aria-hidden className={cn("absolute top-1.5 -left-[30px] size-2.5 rounded-full", LAMP[step.lamp])} />
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-sm font-medium">{step.label}</span>
              <span className={cn("text-sm", s.muted)}>{step.actor}</span>
              <span className={cn("ml-auto text-xs tabular", s.muted)}>
                <span className="sr-only">at </span>
                {step.time}
              </span>
            </div>
            <p className={cn("mt-1 max-w-prose text-sm leading-relaxed", s.muted)}>{step.sentence}</p>
          </li>
        ))}
      </ol>
    </>
  );

  const shell = cn("flex flex-col gap-5 rounded-lg border p-5 sm:p-6", s.panel, className);
  return animate ? (
    <RunOnView className={shell}>{body}</RunOnView>
  ) : (
    <div className={shell}>{body}</div>
  );
}
