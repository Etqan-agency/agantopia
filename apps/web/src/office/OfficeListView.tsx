"use client";

import type { EmployeeView, FloorView } from "@agentopia/shared";
import type { LiveEmployee } from "./describe";
import { StateBadge } from "./StateBadge";

/**
 * Accessible fallback for the canvas: rooms as sections, employees as rows.
 * Used when WebGL is unavailable, when reduced motion is preferred (until the
 * user opts into the canvas), below 900px, or when "Static view" is on.
 */
export function OfficeListView({
  view,
  live,
  titles,
  selectedId,
  onSelect,
  onShowCanvas,
  reason,
}: {
  view: FloorView;
  live: Record<string, LiveEmployee>;
  titles: (taskId: string | null) => string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onShowCanvas?: () => void;
  reason?: string;
}) {
  const deskRoom = new Map<string, string>();
  for (const r of view.rooms) for (const d of r.desks) deskRoom.set(d.id, r.id);
  const byRoom = new Map<string, EmployeeView[]>();
  const unseated: EmployeeView[] = [];
  for (const e of view.employees) {
    if (e.status === "ARCHIVED") continue;
    const room = e.deskId ? deskRoom.get(e.deskId) : undefined;
    if (room) byRoom.set(room, [...(byRoom.get(room) ?? []), e]);
    else unseated.push(e);
  }
  const sections = view.rooms
    .map((r) => ({ id: r.id, name: r.name, people: byRoom.get(r.id) ?? [] }))
    .filter((s) => s.people.length > 0);
  if (unseated.length) sections.push({ id: "unseated", name: "Without a desk", people: unseated });

  return (
    <div className="flex flex-col gap-4">
      {reason || onShowCanvas ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rule bg-surface-sunken px-3 py-2 text-sm">
          <span className="text-fg-muted">{reason ?? "Showing the list view."}</span>
          {onShowCanvas ? (
            <button
              type="button"
              onClick={onShowCanvas}
              className="min-h-9 rounded-md border border-rule-strong px-3 font-medium hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-focus"
            >
              Show the office canvas
            </button>
          ) : null}
        </div>
      ) : null}
      {sections.length === 0 ? <p className="text-sm text-fg-muted">No employees on this floor yet.</p> : null}
      {sections.map((s) => (
        <section key={s.id} aria-labelledby={`room-${s.id}`} className="rounded-lg border border-rule bg-surface-raised">
          <h3 id={`room-${s.id}`} className="border-b border-rule px-3 py-2 text-sm font-semibold">
            {s.name} <span className="font-normal text-fg-muted">· {s.people.length}</span>
          </h3>
          <ul>
            {s.people.map((e) => {
              const l = live[e.id];
              const state = l?.visualState ?? e.visualState;
              const taskId = l ? l.currentTaskId : e.currentTaskId;
              const selected = e.id === selectedId;
              return (
                <li key={e.id} className="border-b border-rule/60 last:border-b-0">
                  <button
                    type="button"
                    onClick={() => onSelect(e.id)}
                    aria-pressed={selected}
                    className={[
                      "grid min-h-12 w-full grid-cols-[1fr_auto] items-center gap-x-3 px-3 py-2 text-left text-sm",
                      "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus",
                      selected ? "bg-saffron-wash" : "hover:bg-surface-sunken",
                    ].join(" ")}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {e.name}
                        {e.role === "MANAGER" ? <span className="font-normal text-fg-muted"> · Manager</span> : null}
                      </span>
                      <span className="block truncate text-xs text-fg-muted">
                        {e.title}
                        {taskId ? ` · ${titles(taskId) ?? "On a task"}` : ""}
                      </span>
                    </span>
                    <StateBadge state={state} />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
