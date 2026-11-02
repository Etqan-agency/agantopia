import type { Metadata } from "next";
import { DetailPage } from "@/components/marketing/templates";
import { ABOUT } from "@/content/marketing/about";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({ title: ABOUT.metaTitle, description: ABOUT.metaDescription, path: ABOUT.path });

export default function AboutPage() {
  return <DetailPage page={ABOUT} />;
}
