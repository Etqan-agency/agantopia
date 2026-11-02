import { Ban, ClipboardCheck, Gauge, History, ShieldCheck, TriangleAlert, Activity, type LucideIcon } from "lucide-react";
import { Container } from "@/components/marketing/primitives/container";
import { Section, type SectionTone } from "@/components/marketing/primitives/section";
import { SectionHeading } from "@/components/marketing/primitives/section-heading";
import type { HomeContent } from "@/content/marketing/types";

const ICONS: Record<string, LucideIcon> = {
  Review: ClipboardCheck,
  Approvals: ShieldCheck,
  Progress: Activity,
  "Error states": TriangleAlert,
  "Provider limits": Gauge,
  Cancellation: Ban,
  "Activity history": History,
};

/**
 * The concrete controls a person keeps, as a two-column list with gold icons. No screenshot
 * here: "The product, up close" is the homepage's single screenshot section.
 */
export function OversightSection({ content, tone = "raised" }: { content: HomeContent["oversight"]; tone?: SectionTone }) {
  return (
    <Section tone={tone} id="oversight" aria-labelledby="oversight-h" padding="tight">
      <Container className="grid gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16">
        <SectionHeading id="oversight-h" title={content.heading} lead={content.lead} />
        <ul className="grid gap-x-10 sm:grid-cols-2">
          {content.points.map((p) => {
            const Icon = ICONS[p.title ?? ""] ?? ClipboardCheck;
            return (
              <li key={p.title} className="flex gap-4 border-t border-white/10 py-5">
                <span aria-hidden className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/10">
                  <Icon className="size-4 text-gold" />
                </span>
                <div className="flex flex-col gap-1">
                  <h3 className="text-base font-semibold text-snow">{p.title}</h3>
                  <p className="text-sm leading-relaxed text-mist">{p.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </Container>
    </Section>
  );
}
