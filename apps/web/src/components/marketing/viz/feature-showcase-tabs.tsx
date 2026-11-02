"use client";

import { Check } from "lucide-react";
import { MotionConfig, motion } from "motion/react";
import { Tabs } from "radix-ui";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { DEFAULT_FEATURE_TABS, type FeatureTab } from "./feature-tabs-data";
import { SURFACE, type Surface } from "./surface";

/**
 * Five feature tabs (Manage, Delegate, Collaborate, Learn, Review) on radix Tabs with manual
 * activation: arrow keys move focus, Enter or Space selects (WAI-ARIA). Each panel has a title,
 * body, bullets and a `media` slot. Panels fade and rise in; motion respects reduced motion.
 *
 * @example
 * <FeatureShowcaseTabs />
 * <FeatureShowcaseTabs surface="raised" tabs={DEFAULT_FEATURE_TABS.map((t) => t.id === "delegate" ? { ...t, media: <WorkflowAnimation variant="compact" /> } : t)} />
 */
export function FeatureShowcaseTabs({
  tabs = DEFAULT_FEATURE_TABS,
  defaultTab,
  label = "Product features",
  surface = "dark",
  className,
}: {
  tabs?: FeatureTab[];
  defaultTab?: string;
  /** Accessible name of the tab list. */
  label?: string;
  surface?: Surface;
  className?: string;
}) {
  const s = SURFACE[surface];
  const [value, setValue] = useState(defaultTab ?? tabs[0]?.id ?? "");

  return (
    <MotionConfig reducedMotion="user">
      <Tabs.Root value={value} onValueChange={setValue} activationMode="manual" className={cn("flex flex-col gap-6", className)}>
        <Tabs.List aria-label={label} className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <Tabs.Trigger
              key={t.id}
              value={t.id}
              className={cn(
                "inline-flex h-11 cursor-pointer items-center rounded-full border border-snow/15 px-4 text-sm font-medium transition-colors duration-[160ms] sm:px-5",
                s.focus,
                // Active tab: gold pill with navy text.
                "text-mist hover:border-gold/50 hover:text-snow data-[state=active]:border-gold data-[state=active]:bg-gold data-[state=active]:text-navy",
              )}
            >
              {t.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        {tabs.map((t) => (
          <Tabs.Content key={t.id} value={t.id} className={cn("rounded-md", s.focus)}>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
              className={cn("grid items-start gap-8", t.media ? "lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]" : "max-w-2xl")}
            >
              <div className="flex flex-col gap-4">
                <h3 className="font-display text-2xl font-semibold tracking-tight">{t.title}</h3>
                <p className={cn("text-base leading-relaxed", s.muted)}>{t.body}</p>
                <ul className="flex flex-col gap-2.5">
                  {t.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2.5 text-sm leading-relaxed">
                      <Check aria-hidden className={cn("mt-0.5 size-4 shrink-0", s.icon)} />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
              {t.media ? <div className="min-w-0">{t.media}</div> : null}
            </motion.div>
          </Tabs.Content>
        ))}
      </Tabs.Root>
    </MotionConfig>
  );
}
