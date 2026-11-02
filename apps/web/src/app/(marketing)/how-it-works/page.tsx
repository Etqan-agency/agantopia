import type { Metadata } from "next";
import { DetailPage } from "@/components/marketing/templates";
import { HOW_IT_WORKS } from "@/content/marketing/how-it-works";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({ title: HOW_IT_WORKS.metaTitle, description: HOW_IT_WORKS.metaDescription, path: HOW_IT_WORKS.path });

export default function HowItWorksPage() {
  return <DetailPage page={HOW_IT_WORKS} sequence />;
}
