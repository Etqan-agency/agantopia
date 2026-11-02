import type { VisualState } from "@agentopia/shared";
import type { ReactNode } from "react";
import { DemoBadge, Pill, ScreenshotFrame } from "@/components/marketing/primitives";
import { IntegrationShowcase } from "@/components/marketing/viz/integration-showcase";
import { LearningJourney } from "@/components/marketing/viz/learning-journey";
import {
  LazyAgentRoleSelector as AgentRoleSelector,
  LazyFeatureShowcaseTabs as FeatureShowcaseTabs,
  LazyMultiFloorBuildingPreview as MultiFloorBuildingPreview,
} from "@/components/marketing/viz/lazy";
import type { Surface } from "@/components/marketing/viz/surface";
import { TaskProgressTimeline } from "@/components/marketing/viz/task-progress-timeline";
import { WorkflowAnimation } from "@/components/marketing/viz/workflow-animation";
import { HERO_CAST } from "@/components/marketing/office/floor-geometry";
import { OfficeFloorSvg, type LampLevel } from "@/components/marketing/office/office-floor-svg";
import { SCREENSHOTS, type ScreenshotKey } from "@/content/marketing/screenshots";
import type { VisualKey, VisualRef } from "@/content/marketing/types";
import { cn } from "@/lib/utils";

/** Visuals that read best across the full content width rather than in a split column. */
const WIDE_KEYS = new Set<VisualKey>(["viz:workflow", "viz:learning-journey", "viz:integrations", "viz:feature-tabs", "screenshot:office", "hero:office"]);

export function isWideVisual(visual: VisualRef): boolean {
  return WIDE_KEYS.has(visual.key);
}

/**
 * Highest heading level each viz renders internally. Used to insert visually hidden bridge
 * headings so the page outline never skips a level (h1 → h3, h2 → h4).
 */
const INNER_HEADING: Partial<Record<VisualKey, number>> = {
  "viz:integrations": 3,
  "viz:learning-journey": 3,
  "viz:agent-card": 3,
  "viz:feature-tabs": 3,
  "viz:building": 4,
};

/** Static office spotlight: the hero cast at their desks with two lamps lit. */
const SPOTLIGHT_STATES: Record<string, VisualState> = {
  manager: "REVIEWING",
  researcher: "WORKING",
  designer: "IDLE",
  developer: "WORKING",
  qa: "IDLE",
  "developer-2": "IDLE",
};
const SPOTLIGHT_LAMPS: Record<string, LampLevel> = {
  manager: "off",
  researcher: "on",
  designer: "off",
  developer: "on",
  qa: "off",
  "developer-2": "off",
};

function screenshotKey(key: VisualKey): ScreenshotKey | null {
  if (!key.startsWith("screenshot:")) return null;
  const k = key.slice("screenshot:".length);
  return k in SCREENSHOTS ? (k as ScreenshotKey) : null;
}

function renderViz(visual: VisualRef, surface: Surface): ReactNode {
  switch (visual.key) {
    case "viz:workflow":
      return <WorkflowAnimation surface={surface} />;
    case "viz:learning-journey":
      return <LearningJourney surface={surface} />;
    case "viz:building":
      return <MultiFloorBuildingPreview surface={surface} />;
    case "viz:agent-card":
      return <AgentRoleSelector surface={surface} defaultRoleId={visual.focus} />;
    case "viz:integrations":
      return <IntegrationShowcase surface={surface} />;
    case "viz:timeline":
      return <TaskProgressTimeline surface={surface} />;
    case "viz:feature-tabs":
      return <FeatureShowcaseTabs surface={surface} />;
    case "viz:office-spotlight":
    case "hero:office":
      return (
        <div className="overflow-hidden rounded-lg border border-white/10 bg-navy shadow-frame">
          <OfficeFloorSvg cast={HERO_CAST} states={SPOTLIGHT_STATES} lamps={SPOTLIGHT_LAMPS} tags idPrefix={`spot-${visual.key.replace(/\W/g, "")}`} title={visual.caption} />
        </div>
      );
    default:
      return null;
  }
}

/** Components that do not draw their own DemoBadge get one from the slot. */
const NEEDS_BADGE = new Set<VisualKey>(["viz:office-spotlight", "hero:office", "viz:feature-tabs"]);

/**
 * Resolves a content `VisualRef` to what it names: a real product screenshot (framed, lazy,
 * labelled "Product screenshot") or a viz component with its default sample data (each one
 * labels itself "Illustrative data" / "Scripted demo"). Unknown keys render nothing.
 *
 * `headingContext` is the level of the heading that owns this visual (1 in a page header,
 * 2 in a section); bridge headings are added visually hidden when the viz starts deeper.
 */
export function VisualSlot({
  visual,
  surface,
  headingContext = 2,
  priority = false,
  sizes,
  className,
}: {
  visual: VisualRef;
  surface: Surface;
  headingContext?: 1 | 2 | 3;
  /** Preload a screenshot (only for the above-the-fold header visual). */
  priority?: boolean;
  /** next/image sizes for screenshots; defaults to the width of a split column. */
  sizes?: string;
  className?: string;
}) {
  const shotKey = screenshotKey(visual.key);

  if (shotKey) {
    const shot = SCREENSHOTS[shotKey];
    return (
      <div className={cn("flex min-w-0 flex-col gap-3", className)}>
        <div>
          <Pill variant="neutral" data-visual-label="screenshot">
            Product screenshot
          </Pill>
        </div>
        <ScreenshotFrame
          src={shot.src}
          alt={shot.alt}
          width={shot.width}
          height={shot.height}
          priority={priority}
          sizes={sizes ?? "(min-width: 1200px) 660px, (min-width: 1024px) 56vw, 100vw"}
          caption={<span className="text-mist">{visual.caption || shot.caption}</span>}
          zoom
        />
      </div>
    );
  }

  const viz = renderViz(visual, surface);
  if (!viz) {
    if (process.env.NODE_ENV === "development") {
      console.warn(`[VisualSlot] Unknown visual key "${visual.key}"; rendering nothing.`);
    }
    return null;
  }

  const inner = INNER_HEADING[visual.key];
  const bridges: ReactNode[] = [];
  if (inner) {
    for (let level = headingContext + 1; level < inner; level++) {
      const Tag = `h${level}` as "h2" | "h3" | "h4";
      const text = level === headingContext + 1 ? visual.caption.replace(/\.$/, "") : visual.label;
      bridges.push(
        <Tag key={level} className="sr-only">
          {text}
        </Tag>,
      );
    }
  }

  return (
    <figure className={cn("flex min-w-0 flex-col gap-3", className)} data-visual={visual.key}>
      {bridges}
      {NEEDS_BADGE.has(visual.key) ? (
        <div>
          <DemoBadge kind={visual.label === "Scripted demo" ? "scripted" : "illustrative"} />
        </div>
      ) : null}
      {viz}
      <figcaption className="text-sm leading-relaxed text-mist">{visual.caption}</figcaption>
    </figure>
  );
}
