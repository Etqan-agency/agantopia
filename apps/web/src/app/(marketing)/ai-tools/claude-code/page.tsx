import type { Metadata } from "next";
import { DetailPage } from "@/components/marketing/templates";
import { AI_TOOLS_CLAUDE_CODE } from "@/content/marketing/ai-tools";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({ title: AI_TOOLS_CLAUDE_CODE.metaTitle, description: AI_TOOLS_CLAUDE_CODE.metaDescription, path: AI_TOOLS_CLAUDE_CODE.path });

export default function ClaudeCodePage() {
  return <DetailPage page={AI_TOOLS_CLAUDE_CODE} />;
}
