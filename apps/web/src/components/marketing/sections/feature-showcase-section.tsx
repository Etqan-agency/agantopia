import { Container, MotionReveal, ScreenshotFrame, Section, SectionHeading } from "@/components/marketing/primitives";
import { DEFAULT_FEATURE_TABS, FeatureShowcaseTabs } from "@/components/marketing/viz";
import { SCREENSHOTS, type ScreenshotKey } from "@/content/marketing/screenshots";
import type { HomeContent } from "@/content/marketing/types";

/** Which real product screenshot illustrates each tab. */
const SHOT_FOR_TAB: Record<string, { key: ScreenshotKey; label: string }> = {
  manage: { key: "employees", label: "Employees" },
  delegate: { key: "tasks", label: "Tasks" },
  collaborate: { key: "office", label: "Office" },
  learn: { key: "learning", label: "Learning" },
  review: { key: "task-detail", label: "Task detail" },
};

const SIZES = "(min-width: 1200px) 680px, (min-width: 1024px) 56vw, 100vw";

/**
 * Feature tabs (Manage, Delegate, Collaborate, Learn, Review), each with a real screenshot from
 * the manifest. Only the active panel is mounted, so only its image loads. Navy.
 */
export function FeatureShowcaseSection({ content }: { content: HomeContent["featureShowcase"] }) {
  const tabs = DEFAULT_FEATURE_TABS.map((tab) => {
    const shot = SHOT_FOR_TAB[tab.id];
    if (!shot) return tab;
    const s = SCREENSHOTS[shot.key];
    return {
      ...tab,
      media: <ScreenshotFrame src={s.src} alt={s.alt} width={s.width} height={s.height} label={shot.label} caption={s.caption} sizes={SIZES} zoom />,
    };
  });
  return (
    <Section tone="navy" id="features" aria-labelledby="features-h">
      <Container className="flex flex-col gap-10 md:gap-14">
        <MotionReveal>
          <SectionHeading id="features-h" title={content.heading} lead={content.lead} />
        </MotionReveal>
        <FeatureShowcaseTabs tabs={tabs} label="Product areas" />
      </Container>
    </Section>
  );
}
