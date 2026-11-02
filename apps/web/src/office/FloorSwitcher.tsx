"use client";

export type FloorSummary = {
  id: string;
  name: string;
  order: number;
  companyId?: string | null;
  companyName: string | null;
  taskSummary?: { active: number; review: number; blocked: number; completedToday: number };
};

/**
 * Elevator-style floor control: one button per floor, highest floor on top,
 * with the company name and task summary counts when known.
 */
export function FloorSwitcher({
  floors,
  currentId,
  onSelect,
  buildingName,
}: {
  floors: FloorSummary[];
  currentId: string | null;
  onSelect: (floorId: string) => void;
  buildingName?: string;
}) {
  if (floors.length === 0) return null;
  const ordered = [...floors].sort((a, b) => b.order - a.order);
  return (
    <nav aria-label="Floors" className="rounded-lg border border-rule bg-surface-raised p-2">
      {buildingName ? <p className="px-2 pt-1 pb-2 text-xs font-medium text-fg-muted">{buildingName}</p> : null}
      <ul className="flex flex-col gap-1">
        {ordered.map((f) => {
          const active = f.id === currentId;
          const s = f.taskSummary;
          return (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => onSelect(f.id)}
                aria-current={active ? "true" : undefined}
                className={[
                  "flex min-h-11 w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                  // Dark: a violet wash instead of an inverted snow fill, so the current floor is not a white block.
                  active ? "bg-fg text-surface dark:bg-sky-wash dark:text-fg" : "hover:bg-surface-sunken",
                ].join(" ")}
              >
                <span
                  aria-hidden
                  className={[
                    "grid size-7 shrink-0 place-items-center rounded-full border text-xs font-semibold tabular-nums",
                    active ? "border-gold bg-gold text-navy" : "border-rule-strong",
                  ].join(" ")}
                >
                  {f.order}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{f.companyName ?? "Vacant floor"}</span>
                  <span className={["block truncate text-xs", active ? "text-surface/75 dark:text-fg-muted" : "text-fg-muted"].join(" ")}>
                    {f.name}
                    {s ? ` · ${s.active} active · ${s.review} in review${s.blocked ? ` · ${s.blocked} blocked` : ""}` : ""}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
