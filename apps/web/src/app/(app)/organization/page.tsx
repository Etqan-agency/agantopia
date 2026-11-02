"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo } from "react";
import { OrgList } from "@/components/organization/org-list";
import { buildOrgTree } from "@/components/organization/tree";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";
import { useEmployees } from "@/hooks/use-api";
import { useCompany } from "@/hooks/use-company";

const OrgChart = dynamic(() => import("@/components/organization/org-chart"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

export default function OrganizationPage() {
  const { companyId } = useCompany();
  const q = useEmployees(companyId);
  const employees = useMemo(() => (q.data ?? []).filter((e) => e.status !== "ARCHIVED"), [q.data]);
  const tree = useMemo(() => buildOrgTree(employees), [employees]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Organization"
        description="Who reports to whom. The manager sits at the top; each line is a reporting relationship. Select a person to open their profile."
      />
      {q.isLoading || !companyId ? (
        <SkeletonRows rows={5} label="Loading organization" />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : employees.length === 0 ? (
        <EmptyState
          title="Nobody works here yet"
          description="Hire your first employee and they will appear under the manager."
          action={
            <Button asChild>
              <Link href="/employees">Go to employees</Link>
            </Button>
          }
        />
      ) : (
        <>
          <section aria-label="Org chart" className="hidden h-[min(70dvh,640px)] overflow-hidden rounded-lg border border-rule min-[900px]:block">
            <OrgChart employees={employees} />
          </section>
          <section aria-labelledby="lines-h">
            <SectionHeader title={<span id="lines-h">Reporting lines</span>} description="The same structure as a list." />
            <OrgList nodes={tree} />
          </section>
        </>
      )}
    </div>
  );
}
