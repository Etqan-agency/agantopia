import type { Metadata } from "next";
import { DetailPage } from "@/components/marketing/templates";
import { AI_TOOLS_CODEX } from "@/content/marketing/ai-tools";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({ title: AI_TOOLS_CODEX.metaTitle, description: AI_TOOLS_CODEX.metaDescription, path: AI_TOOLS_CODEX.path });

export default function CodexPage() {
  return <DetailPage page={AI_TOOLS_CODEX} />;
}
