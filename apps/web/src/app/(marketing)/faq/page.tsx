import type { Metadata } from "next";
import { FaqPage } from "@/components/marketing/templates";
import { FAQ_PAGE } from "@/content/marketing/faq";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({ title: FAQ_PAGE.metaTitle, description: FAQ_PAGE.metaDescription, path: FAQ_PAGE.path });

export default function FaqRoutePage() {
  return <FaqPage page={FAQ_PAGE} />;
}
