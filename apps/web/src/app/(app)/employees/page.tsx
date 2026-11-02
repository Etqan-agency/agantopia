"use client";

import { RANK_LABEL, type Rank } from "@agentopia/shared";
import { Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AvatarSwatch } from "@/components/avatar-swatch";
import { HireEmployeeSheet } from "@/components/employees/hire-sheet";
import { PROVIDER_LABEL, SPECIALTY_OPTIONS, STATUS_LABEL, STATUS_OPTIONS } from "@/components/employees/options";
import { SpecialtyBadge } from "@/components/specialty";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { SkeletonRows } from "@/components/ui/skeleton";
import { lampFromVisual, StatusDot, visualLabel } from "@/components/ui/status-dot";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import type { EmployeeListItem } from "@/hooks/api-shapes";
import { useEmployees } from "@/hooks/use-api";
import { useCompany } from "@/hooks/use-company";

const ALL = "all";

export default function EmployeesPage() {
  const { companyId } = useCompany();
  const [status, setStatus] = useState<string>("ACTIVE");
  const [specialty, setSpecialty] = useState<string>(ALL);
  const filters = {
    status: status === ALL ? undefined : status,
    specialty: specialty === ALL ? undefined : specialty,
  };
  const employees = useEmployees(companyId, filters);
  const filtered = status !== "ACTIVE" || specialty !== ALL;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Employees"
        description="Everyone on this floor, what they are doing right now, and who they report to."
        actions={companyId ? <HireEmployeeSheet companyId={companyId} /> : null}
      />

      <div className="flex flex-wrap items-end gap-4" role="group" aria-label="Filters">
        <div className="flex w-44 flex-col gap-1.5">
          <Label htmlFor="filter-status">Status</Label>
          <Select
            id="filter-status"
            value={status}
            onValueChange={setStatus}
            options={[{ value: ALL, label: "All statuses" }, ...STATUS_OPTIONS]}
          />
        </div>
        <div className="flex w-48 flex-col gap-1.5">
          <Label htmlFor="filter-specialty">Specialty</Label>
          <Select
            id="filter-specialty"
            value={specialty}
            onValueChange={setSpecialty}
            options={[{ value: ALL, label: "All specialties" }, ...SPECIALTY_OPTIONS]}
          />
        </div>
        {employees.data ? (
          <p className="tabular pb-3 text-sm text-fg-muted" aria-live="polite">
            {employees.data.length} {employees.data.length === 1 ? "employee" : "employees"}
          </p>
        ) : null}
      </div>

      {employees.isLoading || !companyId ? (
        <SkeletonRows rows={6} label="Loading employees" />
      ) : employees.isError ? (
        <ErrorState title="Employees could not be loaded" error={employees.error} onRetry={() => employees.refetch()} />
      ) : !employees.data?.length ? (
        <EmptyState
          icon={<Users />}
          title={filtered ? "No employees match these filters" : "No employees yet"}
          description={
            filtered
              ? "Clear a filter to see more of the floor."
              : "Hire your first employee. The manager will start delegating tasks to them as soon as they have a desk."
          }
          action={!filtered ? <HireEmployeeSheet companyId={companyId} /> : null}
        />
      ) : (
        <>
          <RosterTable employees={employees.data} />
          <RosterList employees={employees.data} />
        </>
      )}
    </div>
  );
}

function Activity({ e }: { e: EmployeeListItem }) {
  const label = e.status === "PAUSED" ? "Paused" : visualLabel(e.visualState);
  return (
    <span className="flex min-w-0 flex-col">
      <StatusDot state={e.status === "ACTIVE" ? lampFromVisual(e.visualState) : "offline"} label={label} showLabel />
      {e.currentTaskTitle && e.currentTaskId ? (
        <Link href={`/tasks/${e.currentTaskId}`} className="truncate pl-[18px] text-xs text-sky-ink hover:underline">
          {e.currentTaskTitle}
        </Link>
      ) : null}
    </span>
  );
}

function providerText(e: EmployeeListItem) {
  if (!e.provider || e.provider === "SIMULATED") return "Simulated";
  return `${PROVIDER_LABEL[e.provider] ?? e.provider}${e.model ? `, ${e.model}` : ""}`;
}

function RosterTable({ employees }: { employees: EmployeeListItem[] }) {
  return (
    <div className="hidden min-[900px]:block">
      <Table>
        <THead>
          <TR>
            <TH>Name</TH>
            <TH>Activity</TH>
            <TH>Specialty</TH>
            <TH>Rank</TH>
            <TH>Provider</TH>
            <TH>Status</TH>
          </TR>
        </THead>
        <TBody>
          {employees.map((e) => (
            <TR key={e.id} className="hover:bg-surface-sunken/50">
              <TD>
                <Link href={`/employees/${e.id}`} className="group flex min-h-11 items-center gap-3 rounded-sm">
                  <AvatarSwatch name={e.name} palette={e.avatar.palette} />
                  <span className="flex min-w-0 flex-col">
                    <span className="font-medium group-hover:underline">
                      {e.name}
                      {e.role === "MANAGER" ? <span className="ml-2 text-xs font-normal text-fg-muted">Manager</span> : null}
                    </span>
                    <span className="truncate text-xs text-fg-muted">{e.title}</span>
                  </span>
                </Link>
              </TD>
              <TD className="max-w-64">
                <Activity e={e} />
              </TD>
              <TD>
                <SpecialtyBadge specialty={e.specialty} />
              </TD>
              <TD>{RANK_LABEL[e.rank as Rank] ?? e.rank}</TD>
              <TD className="text-fg-muted">{providerText(e)}</TD>
              <TD>
                {e.status === "ACTIVE" ? (
                  <span className="text-fg-muted">Active</span>
                ) : (
                  <Badge tone={e.status === "PAUSED" ? "saffron" : "neutral"}>{STATUS_LABEL[e.status]}</Badge>
                )}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}

function RosterList({ employees }: { employees: EmployeeListItem[] }) {
  return (
    <ul className="divide-y divide-rule border-y border-rule min-[900px]:hidden">
      {employees.map((e) => (
        <li key={e.id}>
          <Link href={`/employees/${e.id}`} className="flex items-start gap-3 py-3.5">
            <AvatarSwatch name={e.name} palette={e.avatar.palette} />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{e.name}</span>
                <SpecialtyBadge specialty={e.specialty} />
                {e.status !== "ACTIVE" ? <Badge tone="saffron">{STATUS_LABEL[e.status]}</Badge> : null}
              </span>
              <span className="text-xs text-fg-muted">
                {e.title}, {RANK_LABEL[e.rank as Rank] ?? e.rank}
              </span>
              <StatusDot
                state={e.status === "ACTIVE" ? lampFromVisual(e.visualState) : "offline"}
                label={e.currentTaskTitle ? `${visualLabel(e.visualState)}: ${e.currentTaskTitle}` : visualLabel(e.visualState)}
                showLabel
              />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
