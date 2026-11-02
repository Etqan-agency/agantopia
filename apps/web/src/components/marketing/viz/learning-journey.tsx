import { BadgeCheck, Database, Download, History, Info, ShieldCheck } from "lucide-react";
import { AnimatedConnector, DemoBadge, Pill, Stepper } from "@/components/marketing/primitives";
import { HOME } from "@/content/marketing/home";
import type { LearningStage, MemoryDistinction } from "@/content/marketing/types";
import { cn } from "@/lib/utils";
import { KnowledgeSourceCard } from "./knowledge-source-card";
import { RunOnView } from "./run-on-view";
import { SAMPLE_SOURCES, type KnowledgeSource } from "./sample-data";
import { connectorDelayClass, delayClass, slotCenter } from "./sequence";
import { SURFACE, type Surface } from "./surface";

const NON_SCALING = "[&_path]:[vector-effect:non-scaling-stroke]";
const RUN_PATH = "[&>path:last-child]:opacity-0 [&>path:last-child]:duration-[400ms] group-data-[run=on]/run:[&>path:last-child]:opacity-100";

/** Lane markers so the four kinds of "learning" never blur together. */
const LANE = [
  { Icon: Download, border: "border-t-mist border-dashed" },
  { Icon: Database, border: "border-t-lavender" },
  { Icon: BadgeCheck, border: "border-t-success" },
  { Icon: History, border: "border-t-gold" },
] as const;

function FlowBridge({ from, to, stage }: { from: number; to: number; stage: number }) {
  const tone = "gold";
  const pairs = Array.from({ length: from }, (_, i) => ({ y1: slotCenter(i, from), y2: slotCenter(0, to) }));
  return (
    <>
      <svg aria-hidden viewBox="0 0 48 100" preserveAspectRatio="none" className={cn("hidden w-12 shrink-0 self-stretch overflow-visible lg:block", NON_SCALING)}>
        {pairs.map((p, i) => (
          <AnimatedConnector key={i} active tone={tone} d={`M0 ${p.y1} C 24 ${p.y1}, 24 ${p.y2}, 48 ${p.y2}`} className={cn(RUN_PATH, connectorDelayClass(stage))} />
        ))}
      </svg>
      <svg aria-hidden viewBox="0 0 100 32" preserveAspectRatio="none" className={cn("block h-8 w-full overflow-visible lg:hidden", NON_SCALING)}>
        <AnimatedConnector active tone={tone} d="M50 0 V32" className={cn(RUN_PATH, connectorDelayClass(stage))} />
      </svg>
    </>
  );
}

/**
 * How employees learn: the five-stage progression (initial skills → documentation → GitHub
 * knowledge → task experience → reviewed knowledge), sources flowing into the approval queue
 * and then verified memory, four labelled lanes that keep ingestion, memory, verified skills and
 * performance history apart, and the statement that the model is not retrained. The flow
 * animates once in view; under reduced motion the stages render as a static Stepper.
 *
 * @example
 * <LearningJourney />
 * <LearningJourney surface="raised" sources={[...SAMPLE_SOURCES.slice(0, 2)]} />
 */
export function LearningJourney({
  stages = HOME.learning.stages,
  distinctions = HOME.learning.distinctions,
  notRetrained = HOME.learning.notRetrained,
  sources = SAMPLE_SOURCES,
  surface = "dark",
  showBadge,
  className,
}: {
  stages?: LearningStage[];
  distinctions?: MemoryDistinction[];
  notRetrained?: string;
  sources?: KnowledgeSource[];
  surface?: Surface;
  /** Defaults to true while the built-in sample sources are shown. */
  showBadge?: boolean;
  className?: string;
}) {
  const s = SURFACE[surface];
  const badge = showBadge ?? sources === SAMPLE_SOURCES;
  const box = cn("flex flex-col gap-2 rounded-md border p-4", s.inset);

  return (
    <RunOnView className={cn("flex flex-col gap-8 rounded-lg border p-5 sm:p-6", s.panel, className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="font-display text-lg font-semibold tracking-tight">From starter skills to reviewed knowledge</h3>
        {badge ? <DemoBadge kind="illustrative" /> : null}
      </div>

      {/* Stages: animated progression; static Stepper under reduced motion. */}
      <ol aria-label="Learning stages" className="grid gap-4 motion-reduce:hidden sm:grid-cols-2 lg:grid-cols-5 lg:gap-3">
        {stages.map((st, i) => {
          const last = i === stages.length - 1;
          return (
            <li key={st.id} className="relative flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className={cn(
                    "inline-flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular transition-colors duration-[400ms] ease-brand",
                    delayClass(i),
                    "border-white/20 text-mist",
                    // Current (last) stage: gold disc, navy number. Earlier stages: gold outline.
                    last
                      ? "group-data-[run=on]/run:border-gold group-data-[run=on]/run:bg-gold group-data-[run=on]/run:text-navy"
                      : "group-data-[run=on]/run:border-gold/70 group-data-[run=on]/run:text-gold",
                  )}
                >
                  {i + 1}
                </span>
                {!last ? (
                  <span aria-hidden className="hidden h-px flex-1 bg-snow/15 lg:block">
                    <span
                      className={cn(
                        "block h-px origin-left scale-x-0 transition-transform duration-[600ms] ease-brand group-data-[run=on]/run:scale-x-100",
                        delayClass(i),
                        "bg-gold/70",
                      )}
                    />
                  </span>
                ) : null}
              </div>
              <h4 className="text-sm font-semibold">{st.title}</h4>
              <p className={cn("text-sm leading-relaxed", s.muted)}>{st.body}</p>
            </li>
          );
        })}
      </ol>
      <Stepper
        label="Learning stages"
        steps={stages.map((st) => ({ id: st.id, label: st.title, description: st.body }))}
        current={stages.length - 1}
        className="hidden motion-reduce:flex"
      />

      {/* Sources → approval queue → verified memory. */}
      <div className="flex flex-col lg:flex-row">
        <div className="flex flex-col gap-3 lg:w-[38%] lg:shrink-0">
          <span className={cn("text-xs font-medium", s.muted)}>Knowledge sources</span>
          <div className="flex flex-col gap-3">
            {sources.map((src) => (
              <KnowledgeSourceCard key={`${src.kind}-${src.title}`} source={src} surface={surface} />
            ))}
          </div>
        </div>
        <div className="flex flex-col lg:flex-1 lg:flex-row lg:pt-7">
          <FlowBridge from={sources.length} to={1} stage={1} />
          <div className="flex flex-col justify-center lg:flex-1">
            <div className={box}>
              <span className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck aria-hidden className={cn("size-4", s.icon)} />
                Approval queue
              </span>
              <p className={cn("text-xs leading-relaxed", s.muted)}>Drafts wait here. Nothing is trusted until you approve it.</p>
              <ul className="flex flex-col gap-1.5">
                <li className="flex flex-wrap items-center gap-2 text-xs">
                  <span>Next.js App Router notes</span>
                  <Pill variant="gold-outline" dot className="ml-auto">
                    Awaiting approval
                  </Pill>
                </li>
                <li className="flex flex-wrap items-center gap-2 text-xs">
                  <span>Task lesson: signup meter</span>
                  <Pill variant="gold-outline" dot className="ml-auto">
                    Awaiting approval
                  </Pill>
                </li>
              </ul>
            </div>
          </div>
          <FlowBridge from={1} to={1} stage={2} />
          <div className="flex flex-col justify-center lg:flex-1">
            <div className={box}>
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Database aria-hidden className={cn("size-4", s.icon)} />
                Verified memory
              </span>
              <p className={cn("text-xs leading-relaxed", s.muted)}>Approved notes, found by full-text search and cited when the employee works on a task.</p>
              <Pill variant="success" className="self-start">
                Approved
              </Pill>
            </div>
          </div>
        </div>
      </div>

      {/* Four lanes. */}
      <ul aria-label="What learning means in Agentopia" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {distinctions.map((d, i) => {
          const lane = LANE[i % LANE.length]!;
          return (
            <li key={d.term} className={cn("flex flex-col gap-1.5 rounded-md border border-t-2 p-4", s.inset, lane.border)}>
              <span className="flex items-center gap-2 text-sm font-semibold">
                <lane.Icon aria-hidden className={cn("size-4", s.accent)} />
                {d.term}
              </span>
              <p className={cn("text-sm leading-relaxed", s.muted)}>{d.body}</p>
            </li>
          );
        })}
      </ul>

      <p className={cn("flex items-start gap-2.5 border-t pt-5 text-sm font-medium", s.rule)}>
        <Info aria-hidden className={cn("mt-0.5 size-4 shrink-0", s.icon)} />
        {notRetrained}
      </p>
    </RunOnView>
  );
}
