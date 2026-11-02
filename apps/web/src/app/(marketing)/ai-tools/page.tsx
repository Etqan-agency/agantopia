import type { Metadata } from "next";
import { IndexPage } from "@/components/marketing/templates";
import { AI_TOOLS } from "@/content/marketing/ai-tools";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({ title: AI_TOOLS.metaTitle, description: AI_TOOLS.metaDescription, path: AI_TOOLS.path });

export default function AiToolsPage() {
  return <IndexPage page={AI_TOOLS} />;
}
