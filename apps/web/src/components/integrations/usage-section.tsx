"use client";

import { Fragment, useState } from "react";
import { UsageTotalsPanel } from "@/components/usage-panel";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SectionHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import type { UsageTotals } from "@/hooks/api-shapes";
import { useUsage } from "@/hooks/use-api";
import { formatNumber, formatUsd } from "@/lib/utils";
import { LIMIT_KIND_LABEL, limitResetText } from "./provider-cards";

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

function cell(t: UsageTotals) {
  return t.records ? formatUsd(t.costUsd) : "-";
}

function tokens(a: UsageTotals, b: UsageTotals) {
  return formatNumber(a.inputTokens + a.outputTokens + b.inputTokens + b.outputTokens);
}

export function UsageSection({ companyId }: { companyId: string }) {
  const [from, setFrom] = useState(() => isoDay(new Date(Date.now() - 29 * 86400000)));
  const [to, setTo] = useState(() => isoDay(new Date()));
  // `to` is inclusive for the person; send the end of that day.
  const q = useUsage(companyId, { from: from ? `${from}T00:00:00.000Z` : undefined, to: to ? `${to}T23:59:59.999Z` : undefined });
  const rows = [
    { key: "byEmployee", title: "By employee", data: (q.data?.byEmployee ?? []).map((r) => ({ ...r, id: r.employeeId ?? "none", name: r.name ?? "Unattributed" })) },
    {
      key: "byProvider",
      title: "By provider",
      data: (q.data?.byProvider ?? []).map((r) => ({ ...r, id: `${r.provider}-${r.model ?? ""}`, name: r.model ? `${r.provider}, ${r.model}` : r.provider })),
    },
  ];

  return (
    <section aria-labelledby="usage-h" className="flex flex-col">
      <SectionHeader
        title={<span id="usage-h">Usage</span>}
        description="Every figure says where it came from. Nothing is shown as exact unless the provider reported it."
      />
      <div className="flex flex-wrap gap-4 pb-5">
        <FormField label="From">
          <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="w-44" />
        </FormField>
        <FormField label="To">
          <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="w-44" />
        </FormField>
      </div>
      {q.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <>
          <UsageTotalsPanel providerReported={q.data?.providerReported} estimated={q.data?.estimated} />
          <dl className="mt-6 grid grid-cols-[minmax(8rem,auto)_1fr] gap-x-4 gap-y-2 border-y border-rule py-4 text-sm">
            <dt className="text-fg-muted">Subscription usage</dt>
            <dd className="text-fg-muted">{q.data?.subscription?.note ?? "Usage details unavailable from provider."}</dd>
            {(q.data?.providerLimits ?? []).map((p) => (
              <Fragment key={p.provider}>
                <dt className="text-fg-muted">{p.displayName} limit</dt>
                <dd>
                  {LIMIT_KIND_LABEL[p.limit.kind]}
                  {p.limit.kind !== "OK" ? <span className="block text-xs text-fg-muted">{limitResetText(p.limit)}</span> : null}
                </dd>
              </Fragment>
            ))}
          </dl>
          <div className="mt-8 grid gap-10 min-[1100px]:grid-cols-2">
            {rows.map((group) => (
              <div key={group.key} className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">{group.title}</h3>
                {group.data.length === 0 ? (
                  <EmptyState title="No usage in this range" description="Usage appears after an employee runs a task or a learning run spends tokens." />
                ) : (
                  <>
                    <div className="hidden min-[900px]:block">
                      <Table>
                        <THead>
                          <TR>
                            <TH>Name</TH>
                            <TH className="text-right">Provider-reported</TH>
                            <TH className="text-right">Estimated</TH>
                            <TH className="text-right">Tokens</TH>
                            <TH className="text-right">Subscription quota</TH>
                          </TR>
                        </THead>
                        <TBody>
                          {group.data.map((r) => (
                            <TR key={r.id}>
                              <TD className="font-medium">{r.name}</TD>
                              <TD className="tabular text-right">{cell(r.providerReported)}</TD>
                              <TD className="tabular text-right">{cell(r.estimated)}</TD>
                              <TD className="tabular text-right">{tokens(r.providerReported, r.estimated)}</TD>
                              <TD className="text-right text-fg-muted">Unavailable</TD>
                            </TR>
                          ))}
                        </TBody>
                      </Table>
                    </div>
                    <ul className="flex flex-col divide-y divide-rule border-y border-rule min-[900px]:hidden">
                      {group.data.map((r) => (
                        <li key={r.id} className="flex flex-col gap-1 py-3 text-sm">
                          <span className="font-medium">{r.name}</span>
                          <span className="tabular text-fg-muted">
                            Provider-reported {cell(r.providerReported)}, estimated {cell(r.estimated)}, {tokens(r.providerReported, r.estimated)} tokens
                          </span>
                          <span className="text-xs text-fg-muted">Subscription quota: unavailable</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
