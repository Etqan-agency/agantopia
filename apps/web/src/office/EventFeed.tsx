"use client";

import type { TaskEvent } from "@agentopia/shared";
import { describeEvent, type Lookup } from "./describe";

export const FEED_LIMIT = 50;

const QUIET = new Set(["execution.message", "execution.usage", "task.progress"]);

/** Live feed of the last 50 events, as human sentences. */
export function EventFeed({ events, lookup, isDemo }: { events: TaskEvent[]; lookup: Lookup; isDemo: boolean }) {
  const shown = events.filter((e) => !QUIET.has(e.type)).slice(-FEED_LIMIT).reverse();
  return (
    <section aria-labelledby="office-feed-title" className="flex min-h-0 flex-col rounded-lg border border-rule bg-surface-raised">
      <h2 id="office-feed-title" className="border-b border-rule px-3 py-2 text-sm font-semibold">
        Activity
      </h2>
      {shown.length === 0 ? (
        <p className="px-3 py-4 text-sm text-fg-muted">No activity yet. Events appear here as employees work.</p>
      ) : (
        <ol tabIndex={0} aria-labelledby="office-feed-title" className="min-h-0 flex-1 overflow-y-auto">
          {shown.map((e) => {
            const simulated = e.simulated === true || isDemo;
            const time = new Date(e.createdAt);
            return (
              <li key={`${e.id}-${e.seq}`} className="flex items-start gap-2 border-b border-rule/60 px-3 py-2 text-sm last:border-b-0">
                <span className="min-w-0 flex-1">
                  <span className="block">{describeEvent(e, lookup)}</span>
                  <span className="text-xs text-fg-muted">
                    {Number.isNaN(time.getTime()) ? "" : time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                </span>
                {simulated ? (
                  <span className="shrink-0 rounded-sm border border-dashed border-gold bg-saffron-wash px-1.5 py-0.5 text-[11px] font-medium text-fg">
                    Simulated
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
