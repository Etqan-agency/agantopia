"use client";

import { RANK_LABEL, SPECIALTY_LABEL, type Rank, type Specialty } from "@agentopia/shared";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SectionHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import type { EmployeeDetail } from "@/hooks/api-shapes";
import { useEmployees, useProviders, useUpdateEmployee } from "@/hooks/use-api";
import { errorMessage, formatDate } from "@/lib/utils";
import { modelsFor, usableConnections } from "./hire-sheet";
import { PROVIDER_LABEL, SIMULATED_VALUE } from "./options";

/** XP thresholds are a motivational indicator only; rank changes come from evidence. */
export function xpProgress(xp: number) {
  const step = 500;
  const level = Math.floor(xp / step);
  return { level, into: xp - level * step, step };
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[10rem_1fr] gap-4 border-b border-rule py-3 text-sm last:border-0 max-sm:grid-cols-1 max-sm:gap-1">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

export function XpMeter({ xp }: { xp: number }) {
  const { into, step } = xpProgress(xp);
  return (
    <div className="flex max-w-sm flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-4">
        <span className="tabular font-medium">{xp.toLocaleString()} XP</span>
        <span className="tabular text-xs text-fg-muted">
          {step - into} to the next marker
        </span>
      </div>
      <div
        role="meter"
        aria-label="Experience points, a motivational indicator"
        aria-valuemin={0}
        aria-valuemax={step}
        aria-valuenow={into}
        className="h-1.5 overflow-hidden rounded-full bg-surface-sunken"
      >
        <div className="h-full rounded-full bg-sky-ink" style={{ width: `${(into / step) * 100}%` }} />
      </div>
      <p className="text-xs leading-relaxed text-fg-muted">
        XP is a motivational indicator. It does not change rank; promotions are decided from recorded evidence.
      </p>
    </div>
  );
}

export function OverviewTab({ companyId, employee: e }: { companyId: string; employee: EmployeeDetail }) {
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <section>
        <SectionHeader title="Identity" className="border-b border-rule" />
        <dl>
          <Row label="Title">{e.title}</Row>
          <Row label="Department">{e.department || "-"}</Row>
          <Row label="Specialty">{SPECIALTY_LABEL[e.specialty as Specialty] ?? e.specialty}</Row>
          <Row label="Rank">{RANK_LABEL[e.rank as Rank] ?? e.rank}</Row>
          <Row label="Reports to">
            {e.reportsTo ? (
              <Link href={`/employees/${e.reportsTo.id}`} className="text-sky-ink hover:underline">
                {e.reportsTo.name}
              </Link>
            ) : (
              "The company owner"
            )}
          </Row>
          <Row label="Desk">{e.desk ? `${e.desk.roomName}` : "No desk assigned"}</Row>
          <Row label="Focus topics">{e.specializationTopics.length ? e.specializationTopics.join(", ") : "-"}</Row>
          <Row label="Prompt version">v{e.currentPromptVersion}</Row>
          <Row label="Hired">{formatDate(e.createdAt)}</Row>
        </dl>
      </section>
      <div className="flex flex-col gap-10">
        <section>
          <SectionHeader title="Experience" className="border-b border-rule" />
          <div className="pt-4">
            <XpMeter xp={e.xp} />
          </div>
        </section>
        <ProviderEditor companyId={companyId} employee={e} />
      </div>
    </div>
  );
}

function ProviderEditor({ companyId, employee: e }: { companyId: string; employee: EmployeeDetail }) {
  const providers = useProviders(companyId);
  const employees = useEmployees(companyId, { status: "ACTIVE" });
  const update = useUpdateEmployee(companyId, e.id);
  const connections = useMemo(() => usableConnections(providers.data), [providers.data]);
  const [connectionId, setConnectionId] = useState(e.providerConnectionId ?? SIMULATED_VALUE);
  const [model, setModel] = useState<string | undefined>(e.model ?? undefined);
  const [reportsTo, setReportsTo] = useState<string>(e.reportsToId ?? "__owner");
  const connection = connections.find((c) => c.id === connectionId);
  const models = modelsFor(connection);
  if (model && connection && !models.includes(model)) models.push(model);

  const dirty =
    connectionId !== (e.providerConnectionId ?? SIMULATED_VALUE) ||
    (model ?? null) !== (e.model ?? null) ||
    reportsTo !== (e.reportsToId ?? "__owner");

  async function save() {
    const sim = connectionId === SIMULATED_VALUE;
    try {
      await update.mutateAsync({
        providerConnectionId: sim ? null : connectionId,
        model: sim ? null : (model ?? null),
        reportsToId: reportsTo === "__owner" ? null : reportsTo,
      });
      toast.success("Changes saved");
    } catch (err) {
      toast.error("Changes could not be saved", { description: errorMessage(err) });
    }
  }

  const managerOptions = [
    { value: "__owner", label: "The company owner" },
    ...(employees.data ?? []).filter((x) => x.id !== e.id).map((x) => ({ value: x.id, label: `${x.name}, ${x.title}` })),
  ];

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        title="Provider and reporting"
        description="Which model this employee runs on. The simulated provider never calls a model and its output is labelled."
        className="border-b border-rule"
      />
      <FormField label="Provider connection">
        <Select
          value={connectionId}
          onValueChange={(v) => {
            setConnectionId(v);
            const c = connections.find((x) => x.id === v);
            setModel(c?.defaultModel ?? modelsFor(c)[0]);
          }}
          options={[
            { value: SIMULATED_VALUE, label: "Simulated provider" },
            ...connections.map((c) => ({
              value: c.id,
              label: (
                <span className="inline-flex flex-wrap items-center gap-1.5">
                  {c.label} ({PROVIDER_LABEL[c.provider] ?? c.provider})
                  {!c.simulated ? <span className="text-xs text-fg-muted">{c.authMode === "API_KEY" ? "API key" : "Subscription, local runner"}</span> : null}
                  {!c.simulated && c.authMode === "API_KEY" ? <Badge tone="outline">Billed separately</Badge> : null}
                </span>
              ),
            })),
          ]}
          disabled={providers.isLoading}
        />
      </FormField>
      <FormField label="Model">
        {connectionId === SIMULATED_VALUE ? (
          <Input value="Simulated" readOnly disabled />
        ) : (
          <Select
            value={model}
            onValueChange={setModel}
            placeholder={models.length ? "Choose a model" : connection?.authMode === "SUBSCRIPTION_CLI" ? "The CLI's default model" : "Verify the connection first"}
            options={models.map((m) => ({ value: m, label: m }))}
            disabled={!models.length}
          />
        )}
      </FormField>
      <FormField label="Reports to">
        <Select value={reportsTo} onValueChange={setReportsTo} options={managerOptions} disabled={employees.isLoading} />
      </FormField>
      <div>
        <Button onClick={save} disabled={!dirty} pending={update.isPending}>
          Save changes
        </Button>
      </div>
    </section>
  );
}
