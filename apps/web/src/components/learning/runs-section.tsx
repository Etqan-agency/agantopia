"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { SectionHeader } from "@/components/ui/page-header";
import { SkeletonRows } from "@/components/ui/skeleton";
import { StatusDot, type LampState } from "@/components/ui/status-dot";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { toast } from "@/components/ui/toaster";
import type { LearningRunView } from "@/hooks/api-shapes";
import { useCancelRun, useLearningRuns } from "@/hooks/use-api";
import { errorMessage, formatDateTime, formatDuration, formatNumber, formatUsd } from "@/lib/utils";

const RUN_STATUS: Record<string, { label: string; lamp: LampState }> = {
  QUEUED: { label: "Queued", lamp: "idle" },
  RUNNING: { label: "Running", lamp: "live" },
  COMPLETED: { label: "Completed", lamp: "done" },
  TIMED_OUT: { label: "Stopped at time limit", lamp: "waiting" },
  BUDGET_EXHAUSTED: { label: "Budget used up", lamp: "waiting" },
  FAILED: { label: "Failed", lamp: "blocked" },
  CANCELLED: { label: "Cancelled", lamp: "offline" },
};

function RunStatus({ status }: { status: string }) {
  const s = RUN_STATUS[status] ?? { label: status, lamp: "idle" as LampState };
  return <StatusDot state={s.lamp} label={s.label} showLabel />;
}

export function RunsSection({ companyId, employeeId, title = "Recent runs" }: { companyId: string; employeeId?: string; title?: string }) {
  const q = useLearningRuns(companyId, employeeId);
  const cancel = useCancelRun(companyId);
  const runs = q.data ?? [];
  const cancelRun = async (r: LearningRunView) => {
    try {
      await cancel.mutateAsync(r.id);
      toast.success("Run cancelled");
    } catch (err) {
      toast.error("Cancel failed", { description: errorMessage(err) });
    }
  };
  const canCancel = (r: LearningRunView) => r.status === "QUEUED" || r.status === "RUNNING";

  return (
    <section aria-labelledby={`runs-h-${employeeId ?? "c"}`} className="flex flex-col">
      <SectionHeader
        title={<span id={`runs-h-${employeeId ?? "c"}`}>{title}</span>}
        description="Duration, tokens and cost for each run. Zero-token runs report 0 tokens because no model is called."
      />
      {q.isLoading ? (
        <SkeletonRows rows={3} label="Loading runs" />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : runs.length === 0 ? (
        <EmptyState title="No runs yet" description="Runs appear here after the schedule fires or you start one with Run now." />
      ) : (
        <>
          <div className="hidden min-[900px]:block">
            <Table>
              <THead>
                <TR>
                  {employeeId ? null : <TH>Employee</TH>}
                  <TH>Status</TH>
                  <TH>Started</TH>
                  <TH className="text-right">Duration</TH>
                  <TH className="text-right">Tokens</TH>
                  <TH className="text-right">Cost</TH>
                  <TH className="text-right">Changed / drafted</TH>
                  <TH>
                    <span className="sr-only">Actions</span>
                  </TH>
                </TR>
              </THead>
              <TBody>
                {runs.map((r) => (
                  <TR key={r.id}>
                    {employeeId ? null : <TD className="font-medium">{r.employee?.name ?? "-"}</TD>}
                    <TD>
                      <div className="flex flex-col gap-1">
                        <RunStatus status={r.status} />
                        <span className="flex gap-1.5">
                          <Badge tone="outline">{r.tokenStrategy === "ZERO" ? "Zero" : "Low"}</Badge>
                          {r.trigger === "manual" ? <Badge>Manual</Badge> : null}
                        </span>
                        {r.error ? <span className="text-xs text-brick-ink">{r.error}</span> : null}
                      </div>
                    </TD>
                    <TD className="text-sm whitespace-nowrap">{formatDateTime(r.startedAt ?? r.createdAt)}</TD>
                    <TD className="tabular text-right">{formatDuration(r.durationMs)}</TD>
                    <TD className="tabular text-right">{formatNumber(r.tokensUsed)}</TD>
                    <TD className="tabular text-right">{formatUsd(r.costUsd)}</TD>
                    <TD className="tabular text-right">
                      {r.sourcesChanged} / {r.entriesDrafted}
                    </TD>
                    <TD className="text-right">
                      {canCancel(r) ? (
                        <Button size="sm" variant="ghost" onClick={() => cancelRun(r)} disabled={cancel.isPending}>
                          Cancel
                        </Button>
                      ) : null}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
          <ul className="flex flex-col divide-y divide-rule border-y border-rule min-[900px]:hidden">
            {runs.map((r) => (
              <li key={r.id} className="flex flex-col gap-1.5 py-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <RunStatus status={r.status} />
                  {canCancel(r) ? (
                    <Button size="sm" variant="ghost" onClick={() => cancelRun(r)}>
                      Cancel
                    </Button>
                  ) : null}
                </div>
                {employeeId ? null : <span className="font-medium">{r.employee?.name ?? "-"}</span>}
                <span className="tabular text-fg-muted">
                  {formatDateTime(r.startedAt ?? r.createdAt)}, {formatDuration(r.durationMs)}, {formatNumber(r.tokensUsed)} tokens, {formatUsd(r.costUsd)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
