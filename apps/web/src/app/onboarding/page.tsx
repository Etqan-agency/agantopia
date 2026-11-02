import type { Metadata } from "next";
import { Suspense } from "react";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { SkeletonRows } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Set up your company" };

export default function OnboardingPage() {
  return (
    <Suspense fallback={<SkeletonRows rows={3} className="mx-auto max-w-2xl px-4 py-16" />}>
      <OnboardingFlow />
    </Suspense>
  );
}
