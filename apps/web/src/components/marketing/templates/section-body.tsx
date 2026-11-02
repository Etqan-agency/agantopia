import { Check } from "lucide-react";
import type { Bullet, ContentSection } from "@/content/marketing/types";
import { cn } from "@/lib/utils";

/**
 * Which dark tone a section's copy sits on: "dark" (navy or deep) or "raised" (navy-800).
 * Same values as the viz `Surface`, so a band can pass its ink straight to a viz component.
 */
export type Ink = "dark" | "raised";

const DARK_INK = {
  heading: "text-snow",
  body: "text-mist",
  strong: "text-snow",
  accent: "text-lavender",
  /** Inline links ("Related", "See all"): gold, underline on hover. */
  link: "text-gold",
  /** Check / feature icons and list dots. */
  icon: "text-gold",
  rule: "border-white/10",
  /** Numbered step marker (gold outline; the first step is the filled "current" one). */
  marker: "border-gold/60 text-gold",
  markerCurrent: "border-gold bg-gold text-navy",
} as const;

/** Text colours for copy on the dark marketing tones. */
export const INK: Record<Ink, typeof DARK_INK> = { dark: DARK_INK, raised: DARK_INK };

/** The ink for a section tone. */
export function inkFor(tone: string): Ink {
  return tone === "raised" ? "raised" : "dark";
}

/** Untitled bullets that are all short labels (e.g. prompt field names) read as a compact grid. */
function isLabelList(bullets: Bullet[]): boolean {
  return bullets.length >= 6 && bullets.every((b) => !b.title && b.body.length <= 32);
}

export function Paragraphs({ body, ink, large = false }: { body: string[]; ink: Ink; large?: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      {body.map((p, i) => (
        <p key={i} className={cn("max-w-[68ch] leading-relaxed", large ? "text-base md:text-lg" : "text-base", INK[ink].body)}>
          {p}
        </p>
      ))}
    </div>
  );
}

/**
 * Bullets as a definition-style list: titled bullets become term + description rows (side by
 * side when the column is wide enough), untitled ones a checked list, and short label lists a
 * compact multi-column grid.
 */
export function BulletList({ bullets, ink }: { bullets: Bullet[]; ink: Ink }) {
  const c = INK[ink];
  if (bullets.some((b) => b.title)) {
    return (
      <dl className={cn("@container flex max-w-[68ch] flex-col border-t", c.rule)}>
        {bullets.map((b, i) => (
          <div key={i} className={cn("grid gap-1 border-b py-4 @lg:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] @lg:gap-6", c.rule)}>
            <dt className={cn("font-semibold", c.strong)}>{b.title}</dt>
            <dd className={cn("leading-relaxed", c.body)}>{b.body}</dd>
          </div>
        ))}
      </dl>
    );
  }
  if (isLabelList(bullets)) {
    return (
      <div className="@container max-w-[68ch]">
        <ul className="grid gap-x-6 @md:grid-cols-2 @2xl:grid-cols-3">
          {bullets.map((b, i) => (
            <li key={i} className={cn("flex items-center gap-2.5 border-b py-2.5 text-sm font-medium", c.rule, c.strong)}>
              <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-gold" />
              {b.body}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <ul className="flex max-w-[68ch] flex-col gap-3">
      {bullets.map((b, i) => (
        <li key={i} className={cn("flex gap-3 leading-relaxed", c.body)}>
          <Check aria-hidden className={cn("mt-1 size-4 shrink-0", c.icon)} />
          <span>{b.body}</span>
        </li>
      ))}
    </ul>
  );
}

/** Ordered steps with real numbering (they are sequences). Step titles are h3. */
export function StepList({ steps, ink, idPrefix }: { steps: Bullet[]; ink: Ink; idPrefix: string }) {
  const c = INK[ink];
  return (
    <ol className="flex max-w-[68ch] flex-col">
      {steps.map((s, i) => (
        <li key={i} className="relative flex gap-4 pb-6 last:pb-0">
          {i < steps.length - 1 ? <span aria-hidden className={cn("absolute top-10 bottom-0 left-[17px] border-l", c.rule)} /> : null}
          <span aria-hidden className={cn("tabular flex size-9 shrink-0 items-center justify-center rounded-full border font-display text-sm font-semibold", i === 0 ? c.markerCurrent : c.marker)}>
            {i + 1}
          </span>
          <div className="flex flex-col gap-1 pt-1.5">
            {s.title ? (
              <h3 id={`${idPrefix}-step-${i + 1}`} className={cn("text-base font-semibold", c.strong)}>
                {s.title}
              </h3>
            ) : null}
            <p className={cn("leading-relaxed", c.body)}>{s.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function SmallPrint({ note, ink }: { note: string; ink: Ink }) {
  return <p className={cn("max-w-[68ch] border-l-2 border-gold/50 pl-4 text-sm leading-relaxed", INK[ink].body)}>{note}</p>;
}

/**
 * Three or four steps across the full content width (lg+), stacked below. Still an ordered list
 * with real numbering; the rule between markers shows the order.
 */
export function StepRow({ steps, ink, idPrefix }: { steps: Bullet[]; ink: Ink; idPrefix: string }) {
  const c = INK[ink];
  const cols = steps.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3";
  return (
    <ol className={cn("grid gap-8 sm:grid-cols-2 lg:gap-6", cols)}>
      {steps.map((s, i) => (
        <li key={i} className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span aria-hidden className={cn("tabular flex size-9 shrink-0 items-center justify-center rounded-full border font-display text-sm font-semibold", i === 0 ? c.markerCurrent : c.marker)}>
              {i + 1}
            </span>
            {i < steps.length - 1 ? <span aria-hidden className="hidden flex-1 border-t border-gold/30 lg:block" /> : null}
          </div>
          {s.title ? (
            <h3 id={`${idPrefix}-step-${i + 1}`} className={cn("text-base font-semibold", c.strong)}>
              {s.title}
            </h3>
          ) : null}
          <p className={cn("max-w-[40ch] leading-relaxed", c.body)}>{s.body}</p>
        </li>
      ))}
    </ol>
  );
}

/** Sections whose steps read better as a row across the page than as a column. */
export function wantsStepRow(section: ContentSection): boolean {
  const n = section.steps?.length ?? 0;
  return n >= 3 && n <= 4 && !section.bullets?.length && !section.visual;
}

/**
 * Everything in a content section except its heading and visual. Body, bullets and steps render
 * in the order the copy declares them (some sections lead with a list and close with a sentence);
 * the note always comes last.
 */
export function SectionBody({ section, ink, large = false }: { section: ContentSection; ink: Ink; large?: boolean }) {
  const order = Object.keys(section).filter((k): k is "body" | "bullets" | "steps" => k === "body" || k === "bullets" || k === "steps");
  return (
    <div className="flex min-w-0 flex-col gap-6">
      {order.map((k) => {
        if (k === "body" && section.body?.length) return <Paragraphs key={k} body={section.body} ink={ink} large={large} />;
        if (k === "bullets" && section.bullets?.length) return <BulletList key={k} bullets={section.bullets} ink={ink} />;
        if (k === "steps" && section.steps?.length) return <StepList key={k} steps={section.steps} ink={ink} idPrefix={section.id} />;
        return null;
      })}
      {section.note ? <SmallPrint note={section.note} ink={ink} /> : null}
    </div>
  );
}
