"use client";

import { BuildingSection } from "@/components/settings/building-section";
import { CompanyIdentityForm, CompanyPoliciesForm, DangerZone } from "@/components/settings/company-forms";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompanyDetail } from "@/hooks/use-api";
import { useCompany } from "@/hooks/use-company";

export default function SettingsPage() {
  const { companyId } = useCompany();
  const q = useCompanyDetail(companyId);
  const company = q.data;
  const readOnly = company?.isDemo || company?.role === "MEMBER";

  return (
    <div className="flex flex-col gap-14">
      <PageHeader title="Settings" description="Company details, floors in your building, execution defaults and approval policies." />
      {!companyId || q.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : q.error || !company ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <>
          {readOnly ? (
            <p className="border-l-2 border-saffron bg-saffron-wash/60 px-3 py-2 text-sm">
              {company.isDemo ? "This is the demo company; its settings cannot be changed." : "Only the owner can change these settings."}
            </p>
          ) : null}
          <fieldset disabled={readOnly} className="flex flex-col gap-14 disabled:opacity-80">
            <CompanyIdentityForm key={`${company.id}-id`} company={company} />
            <BuildingSection timezone={company.timezone} />
            <CompanyPoliciesForm key={`${company.id}-policies`} company={company} />
            {readOnly ? null : <DangerZone company={company} />}
          </fieldset>
        </>
      )}
    </div>
  );
}
