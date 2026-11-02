"use client";

import { Check, ShieldCheck } from "lucide-react";
import { Fragment, useId, useMemo, useState } from "react";
import { AnimatedConnector, DemoBadge } from "@/components/marketing/primitives";
import { cn } from "@/lib/utils";
import { AvatarDisc } from "./avatar-tone";
import { SAMPLE_DELEGATION, type DelegationSubtask } from "./sample-data";
import { bridgeEdges, layerByDependencies, parallelWith } from "./sequence";
import { SURFACE, type Surface } from "./surface";

const NON_SCALING = "[&_path]:[vector-effect:non-scaling-stroke]";

function Bridge({ left, right, focus }: { left: DelegationSubtask[]; right: DelegationSubtask[]; focus: string }) {
  const tone = "gold";
  const edges = bridgeEdges(left, right);
  return (
    <>
      {/* Wide screens: columns run left to right. */}
      <svg aria-hidden viewBox="0 0 40 100" preserveAspectRatio="none" className={cn("hidden w-10 shrink-0 self-stretch overflow-visible lg:block", NON_SCALING)}>
        {edges.map((e) => (
          <AnimatedConnector key={`${e.from}-${e.to}`} d={`M0 ${e.y1} C 20 ${e.y1}, 20 ${e.y2}, 40 ${e.y2}`} active={e.from === focus || e.to === focus} tone={tone} />
        ))}
      </svg>
      {/* Narrow screens: columns stack top to bottom; parallel subtasks sit side by side. */}
      <svg aria-hidden viewBox="0 0 100 28" preserveAspectRatio="none" className={cn("block h-7 w-full overflow-visible lg:hidden", NON_SCALING)}>
        {edges.map((e) => (
          <AnimatedConnector key={`${e.from}-${e.to}`} d={`M${e.y1} 0 C ${e.y1} 14, ${e.y2} 14, ${e.y2} 28`} active={e.from === focus || e.to === focus} tone={tone} />
        ))}
      </svg>
    </>
  );
}

/**
 * One task split into subtasks with dependencies (sequential and parallel branches) and a
 * review node. Hovering or focusing a subtask previews why it went to that employee in the
 * side panel; clicking (or Enter/Space) pins it. Columns are computed from `dependsOn`, so any
 * acyclic plan renders; edges are drawn between adjacent columns.
 *
 * @example
 * <ManagerDelegationDiagram />
 * <ManagerDelegationDiagram surface="raised" task="Build the pricing page hero" manager="Morgan Hale" subtasks={mySubtasks} />
 */
export function ManagerDelegationDiagram({
  task = SAMPLE_DELEGATION.task,
  manager = SAMPLE_DELEGATION.manager,
  subtasks = SAMPLE_DELEGATION.subtasks,
  surface = "dark",
  showBadge,
  className,
}: {
  task?: string;
  manager?: string;
  subtasks?: DelegationSubtask[];
  surface?: Surface;
  /** Defaults to true while the built-in sample plan is shown. */
  showBadge?: boolean;
  className?: string;
}) {
  const s = SURFACE[surface];
  const panelId = useId();
  const layers = useMemo(() => layerByDependencies(subtasks), [subtasks]);
  const byId = useMemo(() => new Map(subtasks.map((t) => [t.id, t])), [subtasks]);
  const [hovered, setHovered] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const shownId = hovered ?? pinned ?? subtasks[0]?.id ?? "";
  const shown = byId.get(shownId);
  const work = subtasks.filter((t) => t.kind !== "review").length;
  const reviews = subtasks.length - work;
  const badge = showBadge ?? subtasks === SAMPLE_DELEGATION.subtasks;

  return (
    <div className={cn("flex flex-col gap-5 rounded-lg border p-4 sm:p-6", s.panel, className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className={cn("text-xs font-medium", s.muted)}>Task</span>
          <p className="font-display text-lg font-semibold tracking-tight">{task}</p>
          <p className={cn("text-sm", s.muted)}>
            {manager} (AI manager) planned {work} {work === 1 ? "subtask" : "subtasks"}
            {reviews ? ` and ${reviews === 1 ? "a review" : `${reviews} reviews`}` : ""}. Each starts when the work it depends on is done.
          </p>
        </div>
        {badge ? <DemoBadge kind="illustrative" /> : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="flex flex-col lg:flex-row" role="list" aria-label="Subtasks in dependency order">
          {layers.map((layer, li) => (
            <Fragment key={li}>
              {li > 0 ? <Bridge left={layers[li - 1]!} right={layer} focus={shownId} /> : null}
              <div className="flex flex-1 flex-row gap-2 lg:flex-col lg:justify-around lg:gap-3">
                {layer.map((t) => {
                  const isReview = t.kind === "review";
                  const selected = t.id === shownId;
                  return (
                    <div key={t.id} role="listitem" className="min-w-0 flex-1 lg:flex-none">
                      <button
                        type="button"
                        aria-pressed={pinned === t.id}
                        aria-controls={panelId}
                        onClick={() => setPinned((p) => (p === t.id ? null : t.id))}
                        onMouseEnter={() => setHovered(t.id)}
                        onMouseLeave={() => setHovered(null)}
                        onFocus={() => setHovered(t.id)}
                        onBlur={() => setHovered(null)}
                        className={cn(
                          "flex h-full w-full cursor-pointer flex-col gap-2 rounded-md border p-3 text-left transition-colors duration-[160ms] lg:min-h-[6.5rem]",
                          s.focus,
                          isReview && "border-dashed",
                          selected ? s.selected : cn(s.idle, s.hover),
                        )}
                      >
                        <span className="flex items-center gap-2">
                          {isReview ? (
                            <ShieldCheck aria-hidden className={cn("size-4 shrink-0", s.icon)} />
                          ) : null}
                          <span className="text-sm leading-snug font-medium">{t.title}</span>
                        </span>
                        <span className="mt-auto flex items-center gap-2">
                          <AvatarDisc name={t.assignee} tone={t.tone} size="sm" />
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate text-xs font-medium">{t.assignee}</span>
                            <span className={cn("truncate text-xs", s.muted)}>{t.role}</span>
                          </span>
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </Fragment>
          ))}
        </div>

        <aside id={panelId} aria-live="polite" className={cn("flex flex-col gap-3 rounded-md border p-4", s.inset)}>
          {shown ? (
            <>
              <div className="flex items-center gap-3">
                <AvatarDisc name={shown.assignee} tone={shown.tone} />
                <div className="flex min-w-0 flex-col">
                  <span className={cn("text-xs", s.muted)}>{shown.kind === "review" ? "Reviewer" : "Assigned to"}</span>
                  <span className="text-sm font-semibold">
                    {shown.assignee}, {shown.role}
                  </span>
                </div>
              </div>
              <p className="text-sm font-medium">{shown.title}</p>
              <div className="flex flex-col gap-1.5">
                <span className={cn("text-xs font-medium", s.muted)}>Why {shown.assignee.split(" ")[0]}</span>
                <ul className="flex flex-col gap-1.5">
                  {shown.reasons.map((r) => (
                    <li key={r} className="flex items-start gap-2 text-sm">
                      <Check aria-hidden className={cn("mt-0.5 size-4 shrink-0", s.icon)} />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
              <dl className={cn("flex flex-col gap-1 border-t pt-3 text-xs", s.rule)}>
                <div className="flex gap-1.5">
                  <dt className={s.muted}>Starts</dt>
                  <dd>
                    {shown.dependsOn?.length
                      ? `after ${shown.dependsOn.map((d) => `‘${byId.get(d)?.title ?? d}’`).join(" and ")}`
                      : "first, nothing to wait for"}
                  </dd>
                </div>
                {parallelWith(layers, shown.id).length ? (
                  <div className="flex gap-1.5">
                    <dt className={s.muted}>In parallel with</dt>
                    <dd>{parallelWith(layers, shown.id).map((p) => `‘${byId.get(p)?.title ?? p}’`).join(", ")}</dd>
                  </div>
                ) : null}
              </dl>
              {shown.kind === "review" ? (
                <p className={cn("text-xs leading-relaxed", s.muted)}>Approves the work or sends it back with notes. Returned work is retried while attempts remain.</p>
              ) : null}
            </>
          ) : null}
          <p className={cn("mt-auto text-xs leading-relaxed", s.muted)}>Hover, focus or select a subtask to see why the manager chose that employee.</p>
        </aside>
      </div>
    </div>
  );
}

