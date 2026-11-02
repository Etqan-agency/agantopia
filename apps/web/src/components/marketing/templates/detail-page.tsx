import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Container, Section, SectionHeading, type SectionTone } from "@/components/marketing/primitives";
import { ConversionCta } from "@/components/marketing/viz";
import type { BreadcrumbCrumb, ContentSection, InternalLink, PageContent } from "@/content/marketing/types";
import { breadcrumbJsonLd, JsonLd, type JsonLdObject } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { INK, inkFor, Paragraphs, SectionBody, SmallPrint, StepRow, wantsStepRow, type Ink } from "./section-body";
import { isWideVisual, VisualSlot } from "./visual-slot";

/* ------------------------------------------------------------------ pieces */

/** The 40×3 gold rule drawn above band headings (same mark as SectionHeading). */
const RULE = "before:mb-4 before:block before:h-[3px] before:w-10 before:rounded-full before:bg-gold before:content-['']";

/** Visible breadcrumb trail (ordered list, last item is the current page). */
export function Breadcrumbs({ items }: { items: BreadcrumbCrumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-mist">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={item.path} className="flex items-center gap-1.5">
              {last ? (
                <span aria-current="page" className="font-medium text-gold">
                  {item.name}
                </span>
              ) : (
                <>
                  <Link
                    href={item.path}
                    className="inline-flex min-h-6 items-center rounded-sm text-mist underline-offset-4 hover:text-snow hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                  >
                    {item.name}
                  </Link>
                  <ChevronRight aria-hidden className="size-3.5 text-mist/60" />
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Page header on navy: breadcrumbs, h1, lead and the optional hero visual. */
export function PageHeader({ page }: { page: PageContent }) {
  const visual = page.heroVisual;
  const wide = visual ? isWideVisual(visual) : false;
  const split = visual && !wide;
  return (
    <Section tone="navy" id="top" aria-labelledby="page-title" padding="none" className="pt-10 pb-16 md:pt-14 md:pb-24">
      <Container className="flex flex-col gap-10 md:gap-14">
        <div className={cn("grid gap-10 lg:gap-14", split && "lg:grid-cols-12 lg:items-center")}>
          <div className={cn("flex flex-col gap-6", split ? "lg:col-span-5" : "max-w-3xl")}>
            {page.breadcrumbs?.length ? <Breadcrumbs items={page.breadcrumbs} /> : null}
            <span aria-hidden className="-mb-2 block h-[3px] w-10 rounded-full bg-gold" />
            <h1
              id="page-title"
              className="font-display text-[2.5rem] leading-[1.05] font-semibold tracking-[-0.03em] text-snow md:text-[3rem] lg:text-[3.5rem]"
            >
              {page.h1}
            </h1>
            <p className="max-w-[60ch] text-base leading-relaxed text-mist md:text-lg">{page.lead}</p>
          </div>
          {split ? (
            <div className="min-w-0 lg:col-span-7">
              <VisualSlot visual={visual} surface="dark" headingContext={1} priority sizes="(min-width: 1200px) 660px, (min-width: 1024px) 56vw, 100vw" />
            </div>
          ) : null}
        </div>
        {visual && wide ? <VisualSlot visual={visual} surface="dark" headingContext={1} priority sizes="(min-width: 1200px) 1120px, 100vw" /> : null}
      </Container>
    </Section>
  );
}

/**
 * "Related" links (destination titles as anchor text, gold) followed by the closing CTA: a
 * raised panel with the soft gold light, on a navy or deep section.
 */
export function ClosingBand({ page, tone }: { page: PageContent; tone: SectionTone }) {
  const ink = inkFor(tone);
  const c = INK[ink];
  return (
    <>
      {page.related.length ? (
        <Section tone={tone} id="related" aria-labelledby="related-h" padding="none" className="pt-16 pb-12 md:pt-24 md:pb-16">
          <Container className="flex flex-col gap-8">
            <h2 id="related-h" className={cn("font-display text-2xl font-semibold tracking-tight", RULE, c.heading)}>
              Related
            </h2>
            <RelatedList links={page.related} ink={ink} />
          </Container>
        </Section>
      ) : null}
      <Section tone={tone} id="get-started" aria-labelledby="get-started-h" padding="none" className="pb-16 md:pb-24">
        <Container>
          <ConversionCta heading={page.closing.heading} body={page.closing.body} ctas={page.closing.ctas} headingId="get-started-h" tone={ink === "raised" ? "navy" : "raised"} />
        </Container>
      </Section>
    </>
  );
}

function RelatedList({ links, ink }: { links: InternalLink[]; ink: Ink }) {
  const c = INK[ink];
  const cols = links.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3";
  return (
    <ul className={cn("grid gap-x-8 gap-y-2 sm:grid-cols-2", cols)}>
      {links.map((l) => (
        <li key={l.href} className={cn("group relative flex flex-col gap-1.5 border-t py-5", c.rule)}>
          <Link
            href={l.href}
            className={cn(
              "inline-flex items-center gap-1.5 font-semibold underline-offset-4 group-hover:underline after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold",
              c.link,
            )}
          >
            {l.label}
            <ChevronRight aria-hidden className="size-4 transition-transform duration-[160ms] group-hover:translate-x-0.5" />
          </Link>
          {l.description ? <p className={cn("text-sm leading-relaxed", c.body)}>{l.description}</p> : null}
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------- bands */

/** A band is one tone block: a run of short text sections, one section with a visual, or custom content. */
export type Band =
  | { kind: "text"; sections: ContentSection[] }
  | { kind: "visual"; section: ContentSection }
  | { kind: "custom"; id: string; heading: string; lead?: string; render: (ink: Ink, tone: SectionTone) => ReactNode };

/** Bands after the navy header: deep, raised, navy, raised, then repeat (neighbours always differ). */
const TONE_CYCLE: SectionTone[] = ["deep", "raised", "navy", "raised"];

export function bandsFor(sections: ContentSection[]): Band[] {
  const bands: Band[] = [];
  let run: ContentSection[] = [];
  const flush = () => {
    if (!run.length) return;
    // Up to three text sections share a band; longer runs split evenly so tones keep changing.
    const chunks = Math.ceil(run.length / 3);
    const size = Math.ceil(run.length / chunks);
    for (let i = 0; i < run.length; i += size) bands.push({ kind: "text", sections: run.slice(i, i + size) });
    run = [];
  };
  for (const s of sections) {
    if (s.visual) {
      flush();
      bands.push({ kind: "visual", section: s });
    } else run.push(s);
  }
  flush();
  return bands;
}

function TextBand({ sections, tone }: { sections: ContentSection[]; tone: SectionTone }) {
  const ink = inkFor(tone);
  const c = INK[ink];
  return (
    <>
      {sections.map((s, i) => (
        <Section
          key={s.id}
          tone={tone}
          id={s.id}
          aria-labelledby={`${s.id}-h`}
          padding="none"
          className={cn(i === 0 ? "pt-16 md:pt-24" : "pt-0", i === sections.length - 1 ? "pb-16 md:pb-24" : "pb-12 md:pb-16")}
        >
          <Container>
            {wantsStepRow(s) ? (
              <div className={cn("flex flex-col gap-10", i > 0 && cn("border-t pt-12 md:pt-16", c.rule))}>
                <div className="grid gap-6 lg:grid-cols-12 lg:gap-10">
                  <h2
                    id={`${s.id}-h`}
                    className={cn("font-display text-[1.75rem] leading-[1.15] font-semibold tracking-[-0.02em] lg:col-span-4 lg:text-[2rem]", RULE, c.heading)}
                  >
                    {s.heading}
                  </h2>
                  {s.body?.length ? (
                    <div className="lg:col-span-7 lg:col-start-6">
                      <Paragraphs body={s.body} ink={ink} large />
                    </div>
                  ) : null}
                </div>
                <StepRow steps={s.steps!} ink={ink} idPrefix={s.id} />
                {s.note ? <SmallPrint note={s.note} ink={ink} /> : null}
              </div>
            ) : (
            <div className={cn("grid gap-6 lg:grid-cols-12 lg:gap-10", i > 0 && cn("border-t pt-12 md:pt-16", c.rule))}>
              <h2
                id={`${s.id}-h`}
                className={cn("font-display text-[1.75rem] leading-[1.15] font-semibold tracking-[-0.02em] lg:col-span-4 lg:text-[2rem]", RULE, c.heading)}
              >
                {s.heading}
              </h2>
              <div className="min-w-0 lg:col-span-7 lg:col-start-6">
                <SectionBody section={s} ink={ink} large />
              </div>
            </div>
            )}
          </Container>
        </Section>
      ))}
    </>
  );
}

function VisualBand({ section, tone, flip }: { section: ContentSection; tone: SectionTone; flip: boolean }) {
  const ink = inkFor(tone);
  const visual = section.visual!;
  const surface = ink;
  const wide = isWideVisual(visual);
  return (
    <Section tone={tone} id={section.id} aria-labelledby={`${section.id}-h`}>
      <Container>
        {wide ? (
          <div className="flex flex-col gap-10 md:gap-12">
            <div className="grid gap-6 lg:grid-cols-12 lg:gap-10">
              <SectionHeading id={`${section.id}-h`} title={section.heading} className="lg:col-span-5" />
              <div className="min-w-0 lg:col-span-7 lg:pt-2">
                <SectionBody section={section} ink={ink} large />
              </div>
            </div>
            <VisualSlot visual={visual} surface={surface} sizes="(min-width: 1200px) 1120px, 100vw" />
          </div>
        ) : (
          <div className="grid gap-10 lg:grid-cols-12 lg:items-center lg:gap-14">
            <div className={cn("flex flex-col gap-6 lg:col-span-5", flip && "lg:order-2")}>
              <SectionHeading id={`${section.id}-h`} title={section.heading} />
              <SectionBody section={section} ink={ink} large />
            </div>
            <VisualSlot visual={visual} surface={surface} className={cn("lg:col-span-7", flip && "lg:order-1")} />
          </div>
        )}
      </Container>
    </Section>
  );
}

function CustomBand({ band, tone }: { band: Extract<Band, { kind: "custom" }>; tone: SectionTone }) {
  const ink = inkFor(tone);
  return (
    <Section tone={tone} id={band.id} aria-labelledby={`${band.id}-h`}>
      <Container className="flex flex-col gap-10 md:gap-12">
        <SectionHeading id={`${band.id}-h`} title={band.heading} lead={band.lead} />
        {band.render(ink, tone)}
      </Container>
    </Section>
  );
}

/** Renders bands with alternating tones and returns the tone the closing band should use. */
export function Bands({ bands }: { bands: Band[] }) {
  let visualIndex = 0;
  return (
    <>
      {bands.map((band, i) => {
        const tone = TONE_CYCLE[i % TONE_CYCLE.length]!;
        if (band.kind === "text") return <TextBand key={band.sections[0]!.id} sections={band.sections} tone={tone} />;
        if (band.kind === "visual") return <VisualBand key={band.section.id} section={band.section} tone={tone} flip={visualIndex++ % 2 === 1} />;
        return <CustomBand key={band.id} band={band} tone={tone} />;
      })}
    </>
  );
}

/** The closing band (related + CTA) holds a raised CTA panel, so it is never raised itself. */
export function closingToneAfter(bandCount: number): SectionTone {
  if (bandCount === 0) return "deep";
  const last = TONE_CYCLE[(bandCount - 1) % TONE_CYCLE.length];
  return last === "deep" ? "navy" : "deep";
}

/* -------------------------------------------------------------- sequence */

/** Every section as one numbered vertical sequence (how it works). Leading "1. " in headings is shown as the marker. */
function SequenceBand({ sections }: { sections: ContentSection[] }) {
  const c = INK.dark;
  return (
    <Section tone="deep" id="steps" aria-label="Steps">
      <Container>
        <ol className="flex flex-col">
          {sections.map((s, i) => {
            const last = i === sections.length - 1;
            const title = s.heading.replace(/^\d+\.\s*/, "");
            return (
              <li key={s.id} className="relative grid grid-cols-[2.75rem_minmax(0,1fr)] gap-x-5 md:grid-cols-[3.5rem_minmax(0,1fr)] md:gap-x-10">
                {!last ? <span aria-hidden className="absolute top-14 bottom-2 left-[1.375rem] border-l border-gold/30 md:top-16 md:left-[1.75rem]" /> : null}
                <span
                  aria-hidden
                  className={cn(
                    "tabular relative flex size-11 items-center justify-center rounded-full border font-display text-base font-semibold md:size-14 md:text-lg",
                    i === 0 ? c.markerCurrent : cn("bg-navy-950", c.marker),
                  )}
                >
                  {i + 1}
                </span>
                <section id={s.id} aria-labelledby={`${s.id}-h`} className={cn("scroll-mt-24 pt-1.5 md:pt-3", last ? "pb-0" : "pb-14 md:pb-20")}>
                  <div className={cn("grid gap-6", s.visual ? "lg:gap-8" : "lg:grid-cols-12 lg:gap-10")}>
                    <div className={cn("flex flex-col gap-4", !s.visual && "lg:col-span-8")}>
                      <h2 id={`${s.id}-h`} className="font-display text-[1.75rem] leading-[1.15] font-semibold tracking-[-0.02em] text-snow lg:text-[2rem]">
                        <span className="sr-only">Step {i + 1}: </span>
                        {title}
                      </h2>
                      <SectionBody section={s} ink="dark" large />
                    </div>
                    {s.visual ? (
                      <VisualSlot
                        visual={s.visual}
                        surface="dark"
                        className={s.visual.key.startsWith("viz:timeline") ? "max-w-2xl" : "max-w-4xl"}
                        sizes="(min-width: 1200px) 900px, 100vw"
                      />
                    ) : null}
                  </div>
                </section>
              </li>
            );
          })}
        </ol>
      </Container>
    </Section>
  );
}

/* ------------------------------------------------------------------ page */

/**
 * Template for every non-home marketing page built from `PageContent`: breadcrumbs (+ JSON-LD),
 * navy header, content in alternating deep / raised / navy bands, related links and the
 * closing CTA. `sequence` renders all sections as one numbered vertical sequence instead.
 * `bands` overrides the content bands (index pages insert or replace bands).
 */
export function DetailPage({
  page,
  sequence = false,
  bands,
  jsonLd = [],
}: {
  page: PageContent;
  sequence?: boolean;
  bands?: Band[];
  jsonLd?: JsonLdObject[];
}) {
  const resolved = sequence ? [] : (bands ?? bandsFor(page.sections));
  const closingTone = sequence ? "navy" : closingToneAfter(resolved.length);
  const ld = [...(page.breadcrumbs?.length ? [breadcrumbJsonLd(page.breadcrumbs)] : []), ...jsonLd];
  return (
    <>
      <PageHeader page={page} />
      {sequence ? <SequenceBand sections={page.sections} /> : <Bands bands={resolved} />}
      <ClosingBand page={page} tone={closingTone} />
      {ld.length ? <JsonLd data={ld.length === 1 ? ld[0]! : ld} id="ld-page" /> : null}
    </>
  );
}
