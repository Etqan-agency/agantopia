import { BentoFeatureGrid, UseCaseShowcase, type BentoItem, type UseCaseItem } from "@/components/marketing/viz";
import { HOME } from "@/content/marketing/home";
import { MARKETING_ROUTES } from "@/content/marketing/routes";
import type { ContentSection, PageContent } from "@/content/marketing/types";
import type { JsonLdObject } from "@/lib/seo";
import { bandsFor, DetailPage, type Band } from "./detail-page";

/** Child routes of an index page, in MARKETING_ROUTES order. */
export function childRoutes(path: string) {
  return MARKETING_ROUTES.filter((r) => r.parent === path);
}

/**
 * Index routes (/product, /ai-tools, /use-cases): the detail template plus a grid of child
 * pages. `variant="use-cases"` uses UseCaseShowcase (specialist chips + what gets reviewed) and
 * replaces the section named by `gridSectionId`, reusing its heading and bullet copy; the
 * default bento grid is inserted after the first content band under `page.childGrid`.
 */
export function IndexPage({
  page,
  variant = "bento",
  gridSectionId,
  jsonLd,
}: {
  page: PageContent;
  variant?: "bento" | "use-cases";
  gridSectionId?: string;
  jsonLd?: JsonLdObject[];
}) {
  const children = childRoutes(page.path);
  const replaced = gridSectionId ? page.sections.find((s) => s.id === gridSectionId) : undefined;

  const grid: Band = {
    kind: "custom",
    id: replaced?.id ?? "explore",
    heading: replaced?.heading ?? page.childGrid?.heading ?? "Explore",
    lead: replaced ? undefined : page.childGrid?.lead,
    render: (ink) => {
      const surface = ink;
      if (variant === "use-cases") return <UseCaseShowcase items={caseItems(children, replaced)} surface={surface} />;
      return <BentoFeatureGrid items={bentoItems(children)} surface={surface} />;
    },
  };

  let bands: Band[];
  if (replaced) {
    bands = page.sections.flatMap<Band>((s) => (s.id === replaced.id ? [grid] : bandsFor([s])));
    bands = mergeTextBands(bands);
  } else {
    const base = bandsFor(page.sections);
    bands = [...base.slice(0, 1), grid, ...base.slice(1)];
  }
  return <DetailPage page={page} bands={bands} jsonLd={jsonLd} />;
}

/** Rebuilds text runs after a replacement so adjacent text sections still share a band. */
function mergeTextBands(bands: Band[]): Band[] {
  const out: Band[] = [];
  for (const b of bands) {
    const prev = out[out.length - 1];
    if (b.kind === "text" && prev?.kind === "text" && prev.sections.length + b.sections.length <= 3) {
      out[out.length - 1] = { kind: "text", sections: [...prev.sections, ...b.sections] };
    } else out.push(b);
  }
  return out;
}

function bentoItems(children: ReturnType<typeof childRoutes>): BentoItem[] {
  // Two children (AI tools): wide + narrow. Six (features): the default zig-zag.
  return children.map((r, i) => ({
    title: r.title,
    body: r.description,
    href: r.path,
    span: children.length === 2 ? (i === 0 ? 2 : 1) : undefined,
  }));
}

/** Use-case cards: titles and bodies from the page's own bullets, specialists from the homepage copy. */
function caseItems(children: ReturnType<typeof childRoutes>, section: ContentSection | undefined): UseCaseItem[] {
  return children.map((r) => {
    const home = HOME.useCases.items.find((u) => u.href === r.path);
    const bullet = section?.bullets?.find((b) => b.title === r.title);
    return {
      id: home?.id ?? r.path,
      title: r.title,
      body: bullet?.body ?? r.description,
      href: r.path,
      specialists: home?.specialists ?? [],
    };
  });
}
