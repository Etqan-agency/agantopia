import type { EmployeeListItem } from "@/hooks/api-shapes";

export type OrgNode = { employee: EmployeeListItem; children: OrgNode[] };

/**
 * Builds the reporting tree. Roots are people with no manager in the set;
 * managers sort first, then by name. Cycles are broken by visiting each id once.
 */
export function buildOrgTree(employees: EmployeeListItem[]): OrgNode[] {
  const byId = new Map(employees.map((e) => [e.id, e]));
  const kids = new Map<string, EmployeeListItem[]>();
  const roots: EmployeeListItem[] = [];
  for (const e of employees) {
    if (e.reportsToId && byId.has(e.reportsToId) && e.reportsToId !== e.id) {
      const list = kids.get(e.reportsToId) ?? [];
      list.push(e);
      kids.set(e.reportsToId, list);
    } else roots.push(e);
  }
  const order = (a: EmployeeListItem, b: EmployeeListItem) =>
    (a.role === "MANAGER" ? 0 : 1) - (b.role === "MANAGER" ? 0 : 1) || a.name.localeCompare(b.name);
  const seen = new Set<string>();
  const visit = (e: EmployeeListItem): OrgNode => {
    seen.add(e.id);
    const children = (kids.get(e.id) ?? []).filter((c) => !seen.has(c.id)).sort(order).map(visit);
    return { employee: e, children };
  };
  const tree = roots.sort(order).map(visit);
  // Anyone only reachable through a cycle becomes a root.
  for (const e of employees) if (!seen.has(e.id)) tree.push(visit(e));
  return tree;
}

export const NODE_W = 220;
export const NODE_H = 76;
const GAP_X = 28;
const GAP_Y = 72;

/** Deterministic tidy layout: leaves are spaced evenly, parents centered over their children. */
export function layoutTree(tree: OrgNode[]) {
  const positions = new Map<string, { x: number; y: number }>();
  let cursor = 0;
  const place = (n: OrgNode, depth: number): number => {
    const y = depth * (NODE_H + GAP_Y);
    if (!n.children.length) {
      const x = cursor;
      cursor += NODE_W + GAP_X;
      positions.set(n.employee.id, { x, y });
      return x;
    }
    const xs = n.children.map((c) => place(c, depth + 1));
    const x = (xs[0] + xs[xs.length - 1]) / 2;
    positions.set(n.employee.id, { x, y });
    return x;
  };
  for (const root of tree) place(root, 0);
  return positions;
}
