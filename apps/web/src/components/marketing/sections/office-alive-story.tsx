"use client";

import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { ALL_CONNECTORS, SCENES, stateAt, type HeroFrame } from "@/components/marketing/hero/hero-script";
import { OfficeFloorSvg } from "@/components/marketing/office/office-floor-svg";
import { HERO_CAST, HERO_ROWS } from "@/components/marketing/office/floor-geometry";
import { DemoBadge, Stepper } from "@/components/marketing/primitives";
import type { Beat } from "@/content/marketing/types";
import { cn } from "@/lib/utils";

const EASE = [0.2, 0.8, 0.2, 1] as const;

/**
 * Five homepage beats mapped onto moments of the hero script (same cast, same events), so the
 * office here and the hero always agree. Each entry: scene index + offset (ms) into that scene,
 * and the room to outline.
 */
const BEAT_MOMENTS: ReadonlyArray<{ scene: number; offset: number; room: string }> = [
  { scene: 0, offset: 3000, room: "Manager's office" }, // manager thinking, task in the feed
  { scene: 1, offset: 1300, room: "Manager's office" }, // connectors out to three specialists
  { scene: 2, offset: 2600, room: "Development" }, // three gold lamps
  { scene: 3, offset: 2200, room: "Design" }, // research done, design handed to development
  { scene: 4, offset: 3200, room: "QA lab" }, // manager and QA reviewing
];

const FRAMES: HeroFrame[] = BEAT_MOMENTS.map((m) => stateAt(SCENES[m.scene]!.start + m.offset));

function Office({ beat, idPrefix, className }: { beat: number; idPrefix: string; className?: string }) {
  const frame = FRAMES[beat]!;
  const feed = frame.feed.slice(-2);
  return (
    <figure className={cn("flex flex-col overflow-hidden rounded-xl border border-white/10 bg-navy-800 shadow-frame", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <span className="min-w-0 truncate text-sm font-medium text-snow">{frame.task.title}</span>
        <span className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs",
              frame.task.status === "In progress" ? "border-gold bg-gold font-medium text-navy" : frame.task.status === "Completed" ? "border-success/35 bg-success/15 text-success" : "border-white/15 text-mist",
            )}
          >
            {frame.task.status}
          </span>
          <DemoBadge kind="illustrative" />
        </span>
      </div>
      <div className="bg-navy p-2 sm:p-3">
        <OfficeFloorSvg
          cast={HERO_CAST}
          states={frame.states}
          lamps={frame.lamps}
          connectors={frame.connectors}
          connectorSlots={ALL_CONNECTORS}
          highlightRoom={BEAT_MOMENTS[beat]!.room}
          rows={HERO_ROWS}
          idPrefix={idPrefix}
        />
      </div>
      <figcaption className="flex flex-col gap-1.5 border-t border-white/10 px-4 py-3" aria-live="polite">
        <span className="text-xs font-medium text-mist">Activity</span>
        <ul className="relative flex h-[2.75rem] flex-col justify-end gap-1 overflow-hidden">
          <AnimatePresence initial={false} mode="popLayout">
            {feed.map((line) => (
              <motion.li
                key={line.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.24, ease: EASE }}
                className="truncate text-sm text-snow/90 last:text-snow"
              >
                {line.text}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </figcaption>
    </figure>
  );
}

/**
 * Scroll story for "The office comes alive". From 1024px (motion allowed): the beat panels
 * scroll on the left while the office stays pinned on the right; IntersectionObserver picks
 * the panel crossing the middle of the viewport (no scroll-jacking, no scroll-linked
 * transforms). Focusing a panel also activates it. Below 1024px or under reduced motion:
 * the office on top and a Stepper of the beats below. Both layouts are in the server HTML and
 * chosen by CSS media queries, so there is no layout shift on hydration.
 */
export function OfficeAliveStory({ beats, caption }: { beats: readonly Beat[]; caption: string }) {
  const [active, setActive] = useState(0);
  const panels = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const i = Number((e.target as HTMLElement).dataset.beat);
          if (Number.isFinite(i)) setActive(i);
        }
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    panels.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  const steps = beats.map((b, i) => ({ id: b.id, label: b.title, description: i === active ? b.body : undefined }));

  return (
    <MotionConfig reducedMotion="user">
      {/* Scroll story: 1024px+ with motion allowed. */}
      <div className="hidden gap-12 lg:motion-safe:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] xl:gap-16">
        <ol aria-label="How a task moves through the office" className="flex flex-col">
          {beats.map((b, i) => (
            <li
              key={b.id}
              ref={(el) => {
                panels.current[i] = el;
              }}
              data-beat={i}
              tabIndex={0}
              onFocus={() => setActive(i)}
              aria-current={i === active ? "step" : undefined}
              className={cn(
                "flex min-h-[52vh] flex-col justify-center gap-3 rounded-lg py-8 outline-none first:min-h-[40vh] first:justify-start first:pt-4 last:min-h-[48vh]",
                "transition-opacity duration-[400ms] ease-brand focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold",
                i === active ? "opacity-100" : "opacity-70",
              )}
            >
              <span className="flex items-center gap-3">
                <span
                  aria-hidden
                  className={cn(
                    "tabular inline-flex size-8 items-center justify-center rounded-full border text-sm font-semibold transition-colors duration-[400ms]",
                    i === active ? "border-gold bg-gold text-navy" : "border-gold/50 text-gold",
                  )}
                >
                  {i + 1}
                </span>
                <span className="sr-only">
                  Step {i + 1} of {beats.length}
                </span>
              </span>
              <h3 className="font-display text-2xl font-semibold tracking-tight text-snow xl:text-[1.75rem]">{b.title}</h3>
              <p className="max-w-[44ch] text-base leading-relaxed text-mist md:text-lg">{b.body}</p>
            </li>
          ))}
        </ol>
        <div className="relative">
          <div className="sticky top-[max(6rem,calc(50vh-17rem))]">
            <Office beat={active} idPrefix="alive-sticky" />
            <p className="mt-3 text-sm text-mist">{caption}</p>
          </div>
        </div>
      </div>

      {/* Stepper: below 1024px, and at every width under reduced motion. */}
      <div className="flex flex-col gap-6 lg:motion-safe:hidden lg:motion-reduce:grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-12">
        <div className="flex flex-col gap-3">
          <Office beat={active} idPrefix="alive-step" />
          <p className="text-sm text-mist">{caption}</p>
        </div>
        <Stepper label="How a task moves through the office" steps={steps} current={active} onSelect={setActive} />
      </div>
    </MotionConfig>
  );
}
