import type { Metadata } from "next";
import { HeroSection } from "@/components/marketing/hero/hero-section";
import { AiToolsSection } from "@/components/marketing/sections/ai-tools-section";
import { FaqSection } from "@/components/marketing/sections/faq-section";
import { FeatureShowcaseSection } from "@/components/marketing/sections/feature-showcase-section";
import { FinalCtaSection } from "@/components/marketing/sections/final-cta-section";
import { OfficeAliveSection } from "@/components/marketing/sections/office-alive-section";
import { OversightSection } from "@/components/marketing/sections/oversight-section";
import { WorkforceSection } from "@/components/marketing/sections/workforce-section";
import { HOME } from "@/content/marketing/home";
import { JsonLd, buildMetadata, softwareApplicationJsonLd } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({ title: HOME.metaTitle, description: HOME.metaDescription, path: "/" });

/**
 * Homepage: eight sections, every one a dark tone (no white). Neighbours always differ:
 * 1 hero (navy), 2 workforce (raised), 3 office comes alive (navy), 4 AI tools (deep),
 * 5 oversight (raised), 6 product up close (navy, the only screenshot section),
 * 7 FAQ (deep, first six questions), 8 final CTA (raised).
 * Learning, multiple companies and use cases moved off the homepage (owner feedback: too long);
 * each still has its own page under /features and /use-cases.
 */
export default function HomePage() {
  return (
    <>
      <HeroSection hero={HOME.hero} />
      <WorkforceSection content={HOME.workforce} />
      <OfficeAliveSection content={HOME.officeAlive} />
      <AiToolsSection content={HOME.tools} />
      <OversightSection content={HOME.oversight} tone="raised" />
      <FeatureShowcaseSection content={HOME.featureShowcase} />
      <FaqSection content={HOME.faq} tone="deep" limit={6} />
      <FinalCtaSection content={HOME.finalCta} />
      <JsonLd data={softwareApplicationJsonLd({ description: HOME.metaDescription, path: "/" })} id="ld-software" />
    </>
  );
}
