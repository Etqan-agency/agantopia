"use client";

import "@xyflow/react/dist/style.css";
import { Background, Controls, Handle, Position, ReactFlow, type Edge, type Node, type NodeProps } from "@xyflow/react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { RANK_LABEL, SPECIALTY_LABEL, type Rank, type Specialty } from "@agentopia/shared";
import { AvatarSwatch } from "@/components/avatar-swatch";
import { SPECIALTY_FILL } from "@/components/specialty";
import { lampFromVisual, StatusDot, visualLabel } from "@/components/ui/status-dot";
import type { EmployeeListItem } from "@/hooks/api-shapes";
import { buildOrgTree, layoutTree, NODE_H, NODE_W } from "./tree";

type EmployeeNode = Node<{ employee: EmployeeListItem }, "employee">;

function EmployeeNodeView({ data }: NodeProps<EmployeeNode>) {
  const e = data.employee;
  const fill = SPECIALTY_FILL[e.specialty as Specialty] ?? SPECIALTY_FILL.RESEARCH;
  return (
    <div
      className="flex cursor-pointer items-center gap-3 rounded-md border-[1.5px] px-3 text-left shadow-[0_1px_0_rgb(0_0_0/0.06)]"
      style={{ width: NODE_W, height: NODE_H, background: fill.bg, color: fill.fg, borderColor: fill.border }}
    >
      <Handle type="target" position={Position.Top} isConnectable={false} className="!size-1.5 !border-0 !bg-rule-strong" />
      <span className="inline-flex rounded-full" style={{ outline: `1.5px solid ${fill.fg}`, outlineOffset: 1 }}>
        <AvatarSwatch name={e.name} palette={e.avatar?.palette} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{e.name}</span>
        <span className="truncate text-xs" style={{ color: fill.muted }}>
          {SPECIALTY_LABEL[e.specialty as Specialty] ?? e.specialty}, {RANK_LABEL[e.rank as Rank] ?? e.rank}
        </span>
      </div>
      <span className="lamp-on-fill inline-flex" style={{ color: fill.fg }}>
        <StatusDot state={lampFromVisual(e.visualState)} label={visualLabel(e.visualState)} />
      </span>
      <Handle type="source" position={Position.Bottom} isConnectable={false} className="!size-1.5 !border-0 !bg-rule-strong" />
    </div>
  );
}

const nodeTypes = { employee: EmployeeNodeView };

export default function OrgChart({ employees }: { employees: EmployeeListItem[] }) {
  const router = useRouter();
  const { nodes, edges } = useMemo(() => {
    const positions = layoutTree(buildOrgTree(employees));
    const ids = new Set(employees.map((e) => e.id));
    const nodes: EmployeeNode[] = employees.map((e) => ({
      id: e.id,
      type: "employee",
      position: positions.get(e.id) ?? { x: 0, y: 0 },
      data: { employee: e },
      draggable: false,
      connectable: false,
      ariaLabel: `${e.name}, ${e.title}. Open profile.`,
    }));
    const edges: Edge[] = employees
      .filter((e) => e.reportsToId && ids.has(e.reportsToId))
      .map((e) => ({
        id: `${e.reportsToId}-${e.id}`,
        source: e.reportsToId!,
        target: e.id,
        type: "smoothstep",
        style: { stroke: "var(--rule-strong)", strokeWidth: 1.5 },
      }));
    return { nodes, edges };
  }, [employees]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={(_, n) => router.push(`/employees/${n.id}`)}
      nodesDraggable={false}
      nodesConnectable={false}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.3}
      maxZoom={1.5}
      proOptions={{ hideAttribution: true }}
      colorMode="system"
      style={{ background: "var(--surface)" }}
    >
      <Background gap={24} size={1} color="var(--rule)" bgColor="var(--surface)" />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}
