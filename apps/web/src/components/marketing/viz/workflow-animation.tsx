import { AnimatedConnector, DemoBadge } from "@/components/marketing/primitives";
import { cn } from "@/lib/utils";
import { SAMPLE_WORKFLOW, type WorkflowNodeCopy, type WorkflowSteps } from "./sample-data";
import { connectorDelayClass, delayClass } from "./sequence";
import { RunOnView } from "./run-on-view";
import { SURFACE, type Surface } from "./surface";

type Box = { x: number; y: number; w: number; h: number };
type NodeSpec = Box & { copy: WorkflowNodeCopy; stage: number; key: string };
type EdgeSpec = { d: string; stage: number; key: string };

const NODE_BASE = { dark: "fill-navy-700 stroke-white/15", raised: "fill-navy-600 stroke-white/15" } as const;

function Node({ n, surface, compact }: { n: NodeSpec; surface: Surface; compact: boolean }) {
  const delay = delayClass(n.stage);
  const fade = cn("transition-[fill,stroke] duration-[400ms] ease-brand", delay);
  const cx = n.x + n.w / 2;
  return (
    <g>
      <rect
        x={n.x}
        y={n.y}
        width={n.w}
        height={n.h}
        rx={compact ? 10 : 14}
        strokeWidth={1.5}
        className={cn(NODE_BASE[surface], fade, "group-data-[run=on]/run:fill-violet group-data-[run=on]/run:stroke-violet")}
      />
      <circle
        cx={n.x + n.w - 12}
        cy={n.y + 12}
        r={compact ? 3.5 : 4.5}
        className={cn("fill-mist/60", fade, "group-data-[run=on]/run:fill-gold")}
      />
      <text
        x={cx}
        y={compact ? n.y + n.h / 2 + 5 : n.y + 27}
        textAnchor="middle"
        className={cn("font-sans font-semibold", compact ? "text-[15px]" : "text-[16px]", "fill-snow", fade, "group-data-[run=on]/run:fill-white")}
      >
        {n.copy.label}
      </text>
      {compact ? null : (
        <text
          x={cx}
          y={n.y + 47}
          textAnchor="middle"
          className={cn("font-sans text-[13px]", "fill-mist", fade, "group-data-[run=on]/run:fill-white")}
        >
          {n.copy.detail}
        </text>
      )}
    </g>
  );
}

function Edge({ e }: { e: EdgeSpec }) {
  return (
    <AnimatedConnector
      d={e.d}
      active
      tone="gold"
      className={cn(
        "[&>path:last-child]:opacity-0 [&>path:last-child]:duration-[400ms] group-data-[run=on]/run:[&>path:last-child]:opacity-100",
        connectorDelayClass(e.stage),
      )}
    />
  );
}

/* Horizontal layout, viewBox 1000 x 340. */
function horizontal(s: WorkflowSteps): { nodes: NodeSpec[]; edges: EdgeSpec[] } {
  const ys = [40, 142, 244];
  const nodes: NodeSpec[] = [
    { key: "task", x: 10, y: 140, w: 170, h: 64, copy: s.task, stage: 0 },
    { key: "manager", x: 230, y: 140, w: 160, h: 64, copy: s.manager, stage: 1 },
    ...s.agents.map((a, i) => ({ key: `agent-${i}`, x: 450, y: ys[i]!, w: 180, h: 64, copy: a, stage: 2 })),
    { key: "review", x: 690, y: 140, w: 150, h: 64, copy: s.review, stage: 3 },
    { key: "delivery", x: 870, y: 140, w: 125, h: 64, copy: s.delivery, stage: 4 },
  ];
  const edges: EdgeSpec[] = [
    { key: "t-m", d: "M180 172 H230", stage: 1 },
    ...ys.map((y, i) => ({ key: `m-a${i}`, d: `M390 172 C 420 172, 420 ${y + 32}, 450 ${y + 32}`, stage: 2 })),
    ...ys.map((y, i) => ({ key: `a${i}-r`, d: `M630 ${y + 32} C 660 ${y + 32}, 660 172, 690 172`, stage: 3 })),
    { key: "r-d", d: "M840 172 H870", stage: 4 },
  ];
  return { nodes, edges };
}

/* Vertical layout for narrow screens, viewBox 360 x 640. */
function vertical(s: WorkflowSteps): { nodes: NodeSpec[]; edges: EdgeSpec[] } {
  const ys = [210, 290, 370];
  const nodes: NodeSpec[] = [
    { key: "task", x: 80, y: 10, w: 200, h: 64, copy: s.task, stage: 0 },
    { key: "manager", x: 80, y: 110, w: 200, h: 64, copy: s.manager, stage: 1 },
    ...s.agents.map((a, i) => ({ key: `agent-${i}`, x: 80, y: ys[i]!, w: 200, h: 64, copy: a, stage: 2 })),
    { key: "review", x: 80, y: 470, w: 200, h: 64, copy: s.review, stage: 3 },
    { key: "delivery", x: 80, y: 566, w: 200, h: 64, copy: s.delivery, stage: 4 },
  ];
  const edges: EdgeSpec[] = [
    { key: "t-m", d: "M180 74 V110", stage: 1 },
    ...ys.map((y, i) => ({ key: `m-a${i}`, d: `M120 174 V190 H40 V${y + 32} H80`, stage: 2 })),
    ...ys.map((y, i) => ({ key: `a${i}-r`, d: `M280 ${y + 32} H320 V450 H180 V470`, stage: 3 })),
    { key: "r-d", d: "M180 534 V566", stage: 4 },
  ];
  return { nodes, edges };
}

/* Compact row, viewBox 680 x 64, and compact column, viewBox 220 x 336. */
function compactRow(s: WorkflowSteps): { nodes: NodeSpec[]; edges: EdgeSpec[] } {
  const items = [s.task, s.manager, { label: "Specialists", detail: "" }, s.review, s.delivery];
  const w = 116;
  const gap = 25;
  const nodes = items.map((copy, i) => ({ key: `c${i}`, x: 4 + i * (w + gap), y: 8, w, h: 48, copy, stage: i }));
  const edges = nodes.slice(1).map((n, i) => ({ key: `ce${i}`, d: `M${n.x - gap} 32 H${n.x}`, stage: i + 1 }));
  return { nodes, edges };
}

function compactColumn(s: WorkflowSteps): { nodes: NodeSpec[]; edges: EdgeSpec[] } {
  const items = [s.task, s.manager, { label: "Specialists", detail: "" }, s.review, s.delivery];
  const nodes = items.map((copy, i) => ({ key: `v${i}`, x: 20, y: 4 + i * 66, w: 180, h: 46, copy, stage: i }));
  const edges = nodes.slice(1).map((n, i) => ({ key: `ve${i}`, d: `M110 ${n.y - 20} V${n.y}`, stage: i + 1 }));
  return { nodes, edges };
}

function Diagram({
  layout,
  viewBox,
  label,
  surface,
  compact,
  className,
}: {
  layout: { nodes: NodeSpec[]; edges: EdgeSpec[] };
  viewBox: string;
  label: string;
  surface: Surface;
  compact: boolean;
  className?: string;
}) {
  return (
    <svg viewBox={viewBox} role="img" aria-label={label} className={cn("h-auto w-full overflow-visible", className)}>
      {layout.edges.map((e) => (
        <Edge key={e.key} e={e} />
      ))}
      {layout.nodes.map((n) => (
        <Node key={n.key} n={n} surface={surface} compact={compact} />
      ))}
    </svg>
  );
}

/** Full sentence used as the diagram's accessible name. */
export function workflowLabel(s: WorkflowSteps): string {
  const [a, b, c] = s.agents;
  return `Workflow diagram. ${s.task.label} (${s.task.detail}) goes to the ${s.manager.label.toLowerCase()}, which ${s.manager.detail.toLowerCase()} and hands them to three specialists: ${a.label}, ${b.label} and ${c.label}. Their work goes to ${s.review.label.toLowerCase()} (${s.review.detail.toLowerCase()}), then ${s.delivery.label.toLowerCase()} (${s.delivery.detail.toLowerCase()}).`;
}

/**
 * User task → AI manager → three specialists → review → delivery, as an accessible SVG.
 * Stages light in sequence once the diagram scrolls into view (connector dashes travel,
 * nodes fill violet, lamps turn gold). Without JS or under reduced motion every stage is
 * shown highlighted. Below 768px the full variant stacks vertically.
 *
 * @example
 * <WorkflowAnimation />
 * <WorkflowAnimation variant="compact" surface="raised" caption="One task, many specialists." />
 * <WorkflowAnimation steps={{ ...SAMPLE_WORKFLOW, task: { label: "Your task", detail: "Pricing page hero" } }} />
 */
export function WorkflowAnimation({
  steps = SAMPLE_WORKFLOW,
  variant = "default",
  surface = "dark",
  caption,
  showBadge,
  className,
}: {
  steps?: WorkflowSteps;
  variant?: "default" | "compact";
  surface?: Surface;
  caption?: string;
  /** Defaults to true while the built-in sample steps are shown. */
  showBadge?: boolean;
  className?: string;
}) {
  const compact = variant === "compact";
  const label = workflowLabel(steps);
  const badge = showBadge ?? steps === SAMPLE_WORKFLOW;
  const ordered = [
    steps.task,
    steps.manager,
    { label: `Specialists: ${steps.agents.map((a) => a.label).join(", ")}`, detail: steps.agents.map((a) => `${a.label} ${a.detail.toLowerCase()}`).join("; ") },
    steps.review,
    steps.delivery,
  ];

  return (
    <RunOnView
      as="figure"
      className={cn(
        "relative flex flex-col gap-4 rounded-lg border",
        compact ? "p-3 sm:p-4" : "p-4 sm:p-6",
        SURFACE[surface].panel,
        className,
      )}
    >
      {badge ? (
        <div className="flex justify-end">
          <DemoBadge kind="illustrative" />
        </div>
      ) : null}
      {compact ? (
        <>
          <Diagram layout={compactRow(steps)} viewBox="0 0 680 64" label={label} surface={surface} compact className="mx-auto hidden max-w-[760px] sm:block" />
          <Diagram layout={compactColumn(steps)} viewBox="0 0 220 324" label={label} surface={surface} compact className="mx-auto max-w-[240px] sm:hidden" />
        </>
      ) : (
        <>
          <Diagram layout={horizontal(steps)} viewBox="0 0 1000 340" label={label} surface={surface} compact={false} className="hidden md:block" />
          <Diagram layout={vertical(steps)} viewBox="0 0 360 640" label={label} surface={surface} compact={false} className="mx-auto max-w-[400px] md:hidden" />
        </>
      )}
      <ol className="sr-only">
        {ordered.map((o, i) => (
          <li key={i}>
            {o.label}: {o.detail}
          </li>
        ))}
      </ol>
      {caption ? <figcaption className="text-sm leading-relaxed text-mist">{caption}</figcaption> : null}
    </RunOnView>
  );
}
