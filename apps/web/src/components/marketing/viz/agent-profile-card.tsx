import { RANK_LABEL, type VisualState } from "@agentopia/shared";
import { BookOpen, Briefcase, Cpu, DoorOpen, LayoutTemplate, SquareCheckBig } from "lucide-react";
import type { ReactNode } from "react";
import { DemoBadge, Pill, type PillVariant } from "@/components/marketing/primitives";
import { cn } from "@/lib/utils";
import { VISUAL_LABEL } from "@/office/describe";
import { AvatarDisc } from "./avatar-tone";
import { SAMPLE_PROFILES, type AgentProfile } from "./sample-data";
import { SURFACE, type Surface } from "./surface";

/** Status pill tone per visual state: gold only while work is live. */
const STATUS_TONE: Record<VisualState, PillVariant> = {
  IDLE: "neutral",
  THINKING: "gold",
  WORKING: "gold",
  COLLABORATING: "gold",
  REVIEWING: "gold",
  WAITING_APPROVAL: "gold-outline",
  BLOCKED: "danger",
  COMPLETED: "success",
  OFFLINE: "neutral",
};

function Block({ icon, title, children, surface }: { icon: ReactNode; title: string; children: ReactNode; surface: Surface }) {
  return (
    <section className="flex min-w-0 flex-col gap-2">
      <h4 className={cn("flex items-center gap-1.5 text-xs font-medium", SURFACE[surface].muted)}>
        <span aria-hidden className="text-gold [&_svg]:size-3.5">
          {icon}
        </span>
        {title}
      </h4>
      {children}
    </section>
  );
}

/**
 * An AI employee profile: identity, role, rank, live status (office wording), skills with the
 * assigned-versus-demonstrated distinction, sample tasks, provider, office room, learning
 * history, and the configured-role note when the role is not a preset template.
 * Sample fields are labelled with DemoBadge "Illustrative data" (`illustrative`, default true).
 *
 * @example
 * <AgentProfileCard profile={SAMPLE_PROFILES[1]} />
 * <AgentProfileCard profile={profileFromRole(HOME.workforce.roles[5])} surface="raised" headingLevel="h3" />
 */
export function AgentProfileCard({
  profile = SAMPLE_PROFILES[0]!,
  surface = "dark",
  illustrative = true,
  headingLevel: H = "h3",
  className,
}: {
  profile?: AgentProfile;
  surface?: Surface;
  /** Shows the "Illustrative data" badge. Turn off only for real data. */
  illustrative?: boolean;
  headingLevel?: "h2" | "h3";
  className?: string;
}) {
  const s = SURFACE[surface];
  const p = profile;
  const live = STATUS_TONE[p.status] === "gold";

  return (
    <article aria-label={`${p.name}, ${p.title}`} className={cn("flex flex-col gap-5 rounded-lg border p-5 sm:p-6", s.panel, className)}>
      <header className="flex flex-wrap items-start gap-4">
        {illustrative ? (
          <div className="flex w-full justify-end sm:order-last sm:w-auto">
            <DemoBadge kind="illustrative" />
          </div>
        ) : null}
        <AvatarDisc name={p.name} tone={p.tone} size="lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <H className="font-display text-xl font-semibold tracking-tight">{p.name}</H>
          <p className={cn("text-sm", s.muted)}>
            {p.title}
            <span aria-hidden> · </span>
            <span className="sr-only">, </span>
            Example role: {p.role}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Pill variant={STATUS_TONE[p.status]} dot={live}>
              <span className="sr-only">Status: </span>
              {VISUAL_LABEL[p.status]}
            </Pill>
            <Pill variant="violet">
              <span className="sr-only">Rank: </span>
              {RANK_LABEL[p.rank]}
            </Pill>
            {!p.isPreset ? (
              <Pill variant="neutral">
                Configured role
              </Pill>
            ) : null}
          </div>
        </div>
      </header>

      <div className={cn("grid gap-5 border-t pt-5 sm:grid-cols-2", s.rule)}>
        <Block icon={<SquareCheckBig />} title="Skills" surface={surface}>
          <ul className="flex flex-col gap-2">
            {p.skills.map((k) => (
              <li key={k.name} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span className="font-medium">{k.name}</span>
                <span className={cn("text-xs", s.muted)}>{k.proficiency}</span>
                {k.basis === "demonstrated" ? (
                  <Pill variant="success">
                    Demonstrated
                  </Pill>
                ) : (
                  <Pill variant="neutral">
                    Assigned
                  </Pill>
                )}
              </li>
            ))}
          </ul>
          <p className={cn("text-xs leading-relaxed", s.muted)}>Assigned is the proficiency set at hiring. Demonstrated is backed by recorded, reviewed work.</p>
        </Block>

        <Block icon={<Briefcase />} title="Assigned tasks" surface={surface}>
          <ul className="flex flex-col gap-1.5">
            {p.tasks.map((t) => (
              <li key={t} className="text-sm leading-snug">
                {t}
              </li>
            ))}
          </ul>
        </Block>

        <Block icon={<Cpu />} title="Provider" surface={surface}>
          <p className="text-sm leading-snug">{p.provider}</p>
        </Block>

        <Block icon={<DoorOpen />} title="Office room" surface={surface}>
          <p className="text-sm leading-snug">{p.room}</p>
        </Block>

        <Block icon={<BookOpen />} title="Learning history" surface={surface}>
          <ul className="flex flex-col gap-1.5">
            {p.learning.map((l) => (
              <li key={l} className="text-sm leading-snug">
                {l}
              </li>
            ))}
          </ul>
        </Block>

        {p.template !== p.title ? (
          <Block icon={<LayoutTemplate />} title="Role template" surface={surface}>
            <p className="text-sm leading-snug">{p.template}</p>
          </Block>
        ) : null}
      </div>

      {p.note ? (
        <p className={cn("rounded-md border px-3.5 py-3 text-sm leading-relaxed", "border-lavender/30 bg-violet/10 text-snow")}>
          {p.note}
        </p>
      ) : null}
    </article>
  );
}
