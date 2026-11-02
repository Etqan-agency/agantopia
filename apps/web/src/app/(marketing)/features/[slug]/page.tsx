import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DetailPage } from "@/components/marketing/templates";
import { FEATURE_PAGES } from "@/content/marketing/features";
import { buildMetadata } from "@/lib/seo";

const PREFIX = "/features/";

function pageFor(slug: string) {
  return FEATURE_PAGES.find((p) => p.path === `${PREFIX}${slug}`);
}

/** Only the six feature pages in content/marketing/features.ts exist; anything else is a 404. */
export const dynamicParams = false;

export function generateStaticParams() {
  return FEATURE_PAGES.map((p) => ({ slug: p.path.slice(PREFIX.length) }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = pageFor((await params).slug);
  if (!page) return {};
  return buildMetadata({ title: page.metaTitle, description: page.metaDescription, path: page.path });
}

export default async function FeaturePage({ params }: Props) {
  const page = pageFor((await params).slug);
  if (!page) notFound();
  return <DetailPage page={page} />;
}
