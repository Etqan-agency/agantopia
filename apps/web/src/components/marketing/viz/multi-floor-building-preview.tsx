"use client";

import { DEFAULT_ROOMS } from "@agentopia/shared";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useReducer, useRef, type KeyboardEvent } from "react";
import { DemoBadge } from "@/components/marketing/primitives";
import { cn } from "@/lib/utils";
import { SAMPLE_FLOORS, type FloorSample } from "./sample-data";
import { floorReducer, keyToMove } from "./sequence";
import { SURFACE, type Surface } from "./surface";

const EASE = [0.2, 0.8, 0.2, 1] as const;

/** Desk slots per room kind, filled in order by the floor's team. */
function seatTeam(team: FloorSample["team"]) {
  const used = new Map<string, number>();
  const seats = new Map<string, "occupied" | "working">();
  for (const member of team) {
    const room = DEFAULT_ROOMS.find((r) => r.kind === member.room);
    if (!room) continue;
    const n = used.get(room.kind) ?? 0;
    const slot = room.deskSlots[n];
    if (!slot) continue;
    used.set(room.kind, n + 1);
    seats.set(`${slot.x}:${slot.y}`, member.working ? "working" : "occupied");
  }
  return seats;
}

/**
 * Tiny schematic of the default floor plan (DEFAULT_ROOMS, 40×24 tiles): rooms as rects,
 * desks as squares, occupied desks tinted, live work in gold. Decorative.
 */
function FloorSchematic({ floor, surface, labels = false, className }: { floor: FloorSample; surface: Surface; labels?: boolean; className?: string }) {
  const seats = seatTeam(floor.team);
  const s = SURFACE[surface];
  return (
    <svg aria-hidden viewBox="0 0 40 24" className={cn("h-auto w-full", className)}>
      <rect x={0.25} y={0.25} width={39.5} height={23.5} rx={0.8} className={cn(s.fillBase, "stroke-white/15")} strokeWidth={0.2} />
      {DEFAULT_ROOMS.map((r) => (
        <g key={r.kind}>
          <rect
            x={r.x}
            y={r.y}
            width={r.w}
            height={r.h}
            rx={0.5}
            strokeWidth={0.15}
            className={cn(s.fillRoom, "stroke-white/15")}
          />
          {labels ? (
            <text x={r.x + 0.6} y={r.y + r.h - 0.6} className="hidden fill-mist text-[1.05px] font-medium sm:inline">
              {r.name}
            </text>
          ) : null}
          {r.deskSlots.map((d) => {
            const seat = seats.get(`${d.x}:${d.y}`);
            return (
              <rect
                key={`${d.x}:${d.y}`}
                x={d.x - 0.8}
                y={d.y - 0.6}
                width={1.6}
                height={1.2}
                rx={0.25}
                className={
                  seat === "working"
                    ? "fill-gold"
                    : seat === "occupied"
                      ? "fill-lavender"
                      : "fill-snow/10"
                }
              />
            );
          })}
        </g>
      ))}
    </svg>
  );
}

/**
 * A building with one company per floor. Floor buttons (aria-pressed, roving focus; arrow keys,
 * Home and End move between floors) bring the selected floor forward with a motion transition
 * (opacity/transform only) and update the plan and side panel: company, team size, active
 * tasks and the isolation note. Honours reduced motion through MotionConfig.
 *
 * @example
 * <MultiFloorBuildingPreview />
 * <MultiFloorBuildingPreview surface="raised" floors={myFloors} isolationNote="Each company has its own employees, tasks and knowledge." />
 */
export function MultiFloorBuildingPreview({
  floors = SAMPLE_FLOORS,
  surface = "dark",
  isolationNote = "Each company has its own employees, tasks and knowledge.",
  showBadge,
  className,
}: {
  floors?: FloorSample[];
  surface?: Surface;
  isolationNote?: string;
  /** Defaults to true while the built-in sample floors are shown. */
  showBadge?: boolean;
  className?: string;
}) {
  const s = SURFACE[surface];
  const [state, dispatch] = useReducer(floorReducer, { selected: 0, count: floors.length });
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const selected = floors[state.selected] ?? floors[0]!;
  // Top floor first, like a building.
  const order = floors.map((f, i) => ({ f, i })).sort((a, b) => b.f.floor - a.f.floor);
  const badge = showBadge ?? floors === SAMPLE_FLOORS;

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const move = keyToMove(e.key, "both");
    if (!move) return;
    e.preventDefault();
    const pos = order.findIndex((o) => o.i === state.selected);
    const nextPos =
      move.type === "first" ? 0 : move.type === "last" ? order.length - 1 : (pos + (move.type === "next" ? 1 : -1) + order.length) % order.length;
    const target = order[nextPos]!.i;
    dispatch({ type: "select", index: target });
    buttons.current[target]?.focus();
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className={cn("grid gap-6 rounded-lg border p-4 sm:p-6 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_minmax(0,16rem)]", s.panel, className)}>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className={cn("text-xs font-medium", s.muted)}>Your building</span>
            {badge ? <DemoBadge kind="illustrative" className="lg:hidden" /> : null}
          </div>
          <div role="group" aria-label="Floors" onKeyDown={onKeyDown} className="flex flex-col gap-2 rounded-md border-x border-b border-white/10 p-2 pt-3">
            <span aria-hidden className="-mx-2 -mt-3 mb-1 block h-1.5 rounded-t-md bg-gold/70" />
            {order.map(({ f, i }) => {
              const active = i === state.selected;
              return (
                <motion.button
                  key={f.id}
                  ref={(el) => {
                    buttons.current[i] = el;
                  }}
                  type="button"
                  aria-pressed={active}
                  tabIndex={active ? 0 : -1}
                  onClick={() => dispatch({ type: "select", index: i })}
                  animate={{ x: active ? 6 : 0, scale: active ? 1 : 0.97, opacity: active ? 1 : 0.7 }}
                  transition={{ duration: 0.4, ease: EASE }}
                  className={cn(
                    "relative flex cursor-pointer items-center gap-3 rounded-md border p-2 text-left",
                    s.focus,
                    active ? s.selected : s.idle,
                  )}
                >
                  <FloorSchematic floor={f} surface={surface} className="w-16 shrink-0" />
                  <span className="flex min-w-0 flex-col">
                    <span className={cn("text-xs", s.muted)}>Floor {f.floor}</span>
                    <span className="text-sm leading-snug font-medium">{f.company}</span>
                  </span>
                </motion.button>
              );
            })}
          </div>
          <p className={cn("text-xs", s.muted)}>Use the arrow keys to move between floors.</p>
        </div>

        <div className="relative flex min-w-0 flex-col justify-center overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.98 }}
              transition={{ duration: 0.4, ease: EASE }}
            >
              <FloorSchematic floor={selected} surface={surface} labels />
            </motion.div>
          </AnimatePresence>
          <div className={cn("mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs", s.muted)} aria-hidden>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-sm bg-lavender" />
              Employee desk
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-sm bg-gold" />
              Live work
            </span>
          </div>
        </div>

        <aside aria-live="polite" className={cn("flex flex-col gap-4 rounded-md border p-4", s.inset)}>
          {badge ? <DemoBadge kind="illustrative" className="hidden self-start lg:inline-flex" /> : null}
          <div className="flex flex-col gap-0.5">
            <span className={cn("text-xs", s.muted)}>Floor {selected.floor}</span>
            <h4 className="font-display text-lg font-semibold tracking-tight">{selected.company}</h4>
          </div>
          <dl className="flex flex-col gap-3 text-sm">
            <div className="flex flex-col gap-0.5">
              <dt className={cn("text-xs", s.muted)}>Team</dt>
              <dd>
                {selected.team.length} {selected.team.length === 1 ? "employee" : "employees"}
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className={cn("text-xs", s.muted)}>Active tasks</dt>
              <dd>
                <ul className="flex flex-col gap-1">
                  {selected.activeTasks.map((t) => (
                    <li key={t} className="leading-snug">
                      {t}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          </dl>
          <p className={cn("mt-auto border-t pt-3 text-sm leading-relaxed", s.rule)}>{isolationNote}</p>
        </aside>
      </div>
    </MotionConfig>
  );
}
