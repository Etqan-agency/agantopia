import { Container, MotionReveal, Section, SectionHeading } from "@/components/marketing/primitives";
import { MultiFloorBuildingPreview } from "@/components/marketing/viz";
import type { HomeContent } from "@/content/marketing/types";

/** "Create multiple AI companies": heading beside the three points, then the building preview. Raised. */
export function MultiCompanySection({ content }: { content: HomeContent["multiCompany"] }) {
  return (
    <Section tone="raised" id="multi-company" aria-labelledby="multi-company-h">
      <Container className="flex flex-col gap-10 md:gap-14">
        <div className="grid items-end gap-10 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] xl:gap-16">
          <MotionReveal>
            <SectionHeading id="multi-company-h" title={content.heading} lead={content.lead} />
          </MotionReveal>
          <ul className="grid gap-x-8 sm:grid-cols-3">
            {content.points.map((p) => (
              <li key={p.title} className="flex flex-col gap-1.5 border-t border-white/10 py-5 sm:pb-0">
                <h3 className="flex items-center gap-2 font-display text-base font-semibold tracking-tight text-snow">
                  <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-gold" />
                  {p.title}
                </h3>
                <p className="text-sm leading-relaxed text-mist">{p.body}</p>
              </li>
            ))}
          </ul>
        </div>
        <figure className="flex min-w-0 flex-col gap-3">
          <MultiFloorBuildingPreview surface="raised" />
          <figcaption className="text-sm text-mist">{content.visual.caption}</figcaption>
        </figure>
      </Container>
    </Section>
  );
}
