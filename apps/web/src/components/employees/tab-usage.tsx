"use client";

import { SectionHeader } from "@/components/ui/page-header";
import { UsageTotalsPanel } from "@/components/usage-panel";
import type { EmployeeDetail } from "@/hooks/api-shapes";

export function UsageTab({ employee }: { employee: EmployeeDetail }) {
  const simulated = !employee.provider || employee.provider === "SIMULATED";
  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        title="Usage"
        description="All-time usage for this employee, across task executions and learning runs."
      />
      <UsageTotalsPanel providerReported={employee.usage?.providerReported} estimated={employee.usage?.estimated} />
      {simulated ? (
        <p className="text-sm text-fg-muted">
          This employee runs on the simulated provider, which never calls a model and has no cost.
        </p>
      ) : null}
    </div>
  );
}
