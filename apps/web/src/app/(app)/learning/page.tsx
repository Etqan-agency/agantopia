"use client";

import { ApprovalQueue } from "@/components/learning/approval-queue";
import { RetrievalTester } from "@/components/learning/retrieval-tester";
import { RunsSection } from "@/components/learning/runs-section";
import { ScheduleEditor } from "@/components/learning/schedule-editor";
import { SourcesSection } from "@/components/learning/sources-section";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompanyDetail, useKnowledge, useLearningRuns, useLearningSchedules, useLearningSources } from "@/hooks/use-api";
import { useCompany } from "@/hooks/use-company";

export default function LearningPage() {
  const { companyId } = useCompany();
  const schedules = useLearningSchedules(companyId);
  const company = useCompanyDetail(companyId);
  const companySchedule = schedules.data?.find((s) => s.employeeId === null) ?? null;
  // Same queries the sections below run (deduplicated by React Query). Rendering the
  // sections only once all three have settled stops them loading one after another and
  // pushing the retrieval tester down the page (layout shift, docs/qa-report.md item 1).
  const drafts = useKnowledge(companyId, { status: "DRAFT" });
  const sources = useLearningSources(companyId);
  const runs = useLearningRuns(companyId);
  const sectionsLoading = drafts.isLoading || sources.isLoading || runs.isLoading;

  return (
    <div className="flex flex-col gap-14">
      <PageHeader
        title="Learning"
        description="Employees study only their own specialty, from sources you allow, on a schedule and budget you set. Nothing they learn is used until you approve it."
      />
      {!companyId || schedules.isLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : schedules.error ? (
        <ErrorState error={schedules.error} onRetry={() => schedules.refetch()} />
      ) : (
        <ScheduleEditor
          key={companySchedule?.id ?? "new"}
          companyId={companyId}
          schedule={companySchedule}
          companyTimezone={company.data?.timezone ?? "Africa/Cairo"}
        />
      )}
      {companyId && sectionsLoading ? (
        <div role="status" aria-live="polite" className="flex flex-col gap-14">
          <span className="sr-only">Loading learning sections</span>
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : companyId ? (
        <>
          <ApprovalQueue companyId={companyId} />
          <SourcesSection companyId={companyId} />
          <RunsSection companyId={companyId} />
          <RetrievalTester companyId={companyId} />
        </>
      ) : null}
    </div>
  );
}
