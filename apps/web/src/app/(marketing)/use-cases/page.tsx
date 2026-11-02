import type { Metadata } from "next";
import { IndexPage } from "@/components/marketing/templates";
import { USE_CASES } from "@/content/marketing/use-cases";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({ title: USE_CASES.metaTitle, description: USE_CASES.metaDescription, path: USE_CASES.path });

export default function UseCasesPage() {
  return <IndexPage page={USE_CASES} variant="use-cases" gridSectionId="examples" />;
}
