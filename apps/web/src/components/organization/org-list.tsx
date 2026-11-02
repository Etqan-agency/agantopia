import Link from "next/link";
import { RANK_LABEL, type Rank } from "@agentopia/shared";
import { AvatarSwatch } from "@/components/avatar-swatch";
import { SpecialtyBadge } from "@/components/specialty";
import { lampFromVisual, StatusDot, visualLabel } from "@/components/ui/status-dot";
import type { OrgNode } from "./tree";

/** Static nested list of reporting lines: the accessible and small-screen view of the org chart. */
export function OrgList({ nodes, level = 0 }: { nodes: OrgNode[]; level?: number }) {
  return (
    <ul className={level === 0 ? "flex flex-col" : "ml-4 flex flex-col border-l border-rule pl-4"}>
      {nodes.map((n) => (
        <li key={n.employee.id}>
          <Link
            href={`/employees/${n.employee.id}`}
            className="flex min-h-11 items-center gap-3 rounded-md py-2 pr-2 hover:bg-surface-sunken"
          >
            <AvatarSwatch name={n.employee.name} palette={n.employee.avatar?.palette} size="sm" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium">{n.employee.name}</span>
              <span className="truncate text-xs text-fg-muted">
                {n.employee.title}, {RANK_LABEL[n.employee.rank as Rank] ?? n.employee.rank}
              </span>
            </span>
            <SpecialtyBadge specialty={n.employee.specialty} />
            <StatusDot state={lampFromVisual(n.employee.visualState)} label={visualLabel(n.employee.visualState)} />
          </Link>
          {n.children.length ? <OrgList nodes={n.children} level={level + 1} /> : null}
        </li>
      ))}
    </ul>
  );
}
