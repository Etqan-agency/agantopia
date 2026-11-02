import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DetailPage } from "@/components/marketing/templates";
import { USE_CASE_PAGES } from "@/content/marketing/use-cases";
import { buildMetadata } from "@/lib/seo";

const PREFIX = "/use-cases/";
const DETAIL_PAGES = USE_CASE_PAGES.filter((p) => p.path.startsWith(PREFIX));

function pageFor(slug: string) {
  return DETAIL_PAGES.find((p) => p.path === `${PREFIX}${slug}`);
}

/** Only the four use-case detail pages in content/marketing/use-cases.ts exist; anything else is a 404. */
export const dynamicParams = false;

export function generateStaticParams() {
  return DETAIL_PAGES.map((p) => ({ slug: p.path.slice(PREFIX.length) }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = pageFor((await params).slug);
  if (!page) return {};
  return buildMetadata({ title: page.metaTitle, description: page.metaDescription, path: page.path });
}

export default async function UseCasePage({ params }: Props) {
  const page = pageFor((await params).slug);
  if (!page) notFound();
  return <DetailPage page={page} />;
}
