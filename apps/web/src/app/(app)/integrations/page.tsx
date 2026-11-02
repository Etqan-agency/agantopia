"use client";

import { ProviderCardsSection } from "@/components/integrations/provider-cards";
import { ProvidersSection } from "@/components/integrations/provider-list";
import { RunnersSection } from "@/components/integrations/runners-section";
import { UsageSection } from "@/components/integrations/usage-section";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompany } from "@/hooks/use-company";

export default function IntegrationsPage() {
  const { companyId } = useCompany();
  return (
    <div className="flex flex-col gap-12">
      <PageHeader
        title="Integrations"
        description="Run employees on your own Claude Code or Codex subscription through a local runner, or add an API key billed separately. See what each run cost and how that number was obtained."
      />
      {companyId ? (
        <>
          <ProviderCardsSection companyId={companyId} />
          <ProvidersSection companyId={companyId} />
          <RunnersSection companyId={companyId} />
          <UsageSection companyId={companyId} />
        </>
      ) : (
        <Skeleton className="h-40 w-full" />
      )}
    </div>
  );
}
