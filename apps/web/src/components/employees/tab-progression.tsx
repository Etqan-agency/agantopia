"use client";

import { OverrideRankInput, RANK_LABEL, type Rank } from "@agentopia/shared";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { SectionHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { SkeletonRows } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toaster";
import type { CareerEvidence, EmployeeDetail } from "@/hooks/api-shapes";
import { useEvidence, useOverrideRank } from "@/hooks/use-api";
import { cn, errorMessage, formatDateTime } from "@/lib/utils";
import { RANK_OPTIONS } from "./options";
import { XpMeter } from "./tab-overview";

const EVIDENCE_LABEL: Record<string, string> = {
  TASK_COMPLETED: "Task completed",
  REVIEW_APPROVED: "Review approved",
  REVIEW_REJECTED: "Review rejected",
  TASK_FAILED: "Task failed",
  ASSESSMENT: "Assessment",
  KNOWLEDGE_VERIFIED: "Knowledge verified",
  OWNER_OVERRIDE: "Owner override",
  RANK_CHANGE: "Rank change",
  INITIALIZED_AS: "Hired",
};

const NEGATIVE = new Set(["REVIEW_REJECTED", "TASK_FAILED"]);

export function ProgressionTab({ companyId, employee: e }: { companyId: string; employee: EmployeeDetail }) {
  const evidence = useEvidence(companyId, e.id);
  const items: CareerEvidence[] = evidence.data ?? e.evidence ?? [];

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-wrap items-start justify-between gap-6 border-b border-rule pb-6">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-fg-muted">Current rank</p>
          <p className="text-xl font-semibold">{RANK_LABEL[e.rank as Rank] ?? e.rank}</p>
          <p className="max-w-prose text-sm text-fg-muted">
            Rank changes only from the evidence below. An owner override is recorded with its reason.
          </p>
        </div>
        <div className="flex flex-col items-start gap-4">
          <XpMeter xp={e.xp} />
          <RankOverrideDialog companyId={companyId} employee={e} />
        </div>
      </section>

      <section>
        <SectionHeader title="Evidence" description="Everything that counts toward this employee's progression, newest first." />
        {evidence.isLoading && !e.evidence ? (
          <SkeletonRows rows={4} label="Loading evidence" />
        ) : evidence.isError && !e.evidence ? (
          <ErrorState error={evidence.error} onRetry={() => evidence.refetch()} />
        ) : !items.length ? (
          <EmptyState title="No evidence yet" description="Completed tasks, reviews and verified knowledge will appear here." />
        ) : (
          <ol className="relative ml-1.5 flex flex-col border-l border-rule-strong">
            {[...items]
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .map((ev) => (
                <li key={ev.id} className="relative pb-6 pl-6 last:pb-0">
                  <span
                    aria-hidden
                    className={cn(
                      "absolute top-1.5 -left-[5px] size-2.5 rounded-full border-2 border-surface",
                      NEGATIVE.has(ev.kind) ? "bg-brick-ink" : ev.kind === "OWNER_OVERRIDE" || ev.kind === "RANK_CHANGE" ? "bg-gold" : "bg-lamp-done",
                    )}
                  />
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-sm font-medium">{EVIDENCE_LABEL[ev.kind] ?? ev.kind}</span>
                    <time className="text-xs text-fg-muted" dateTime={ev.createdAt}>
                      {formatDateTime(ev.createdAt)}
                    </time>
                    {ev.fromRank && ev.toRank ? (
                      <span className="text-xs text-fg-muted">
                        {RANK_LABEL[ev.fromRank as Rank]} to {RANK_LABEL[ev.toRank as Rank]}
                      </span>
                    ) : null}
                    {typeof ev.score === "number" ? <span className="tabular text-xs text-fg-muted">Score {ev.score.toFixed(2)}</span> : null}
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-fg-muted">{ev.summary}</p>
                  {ev.taskId ? (
                    <a href={`/tasks/${ev.taskId}`} className="text-xs text-sky-ink hover:underline">
                      View task
                    </a>
                  ) : null}
                </li>
              ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function RankOverrideDialog({ companyId, employee: e }: { companyId: string; employee: EmployeeDetail }) {
  const [open, setOpen] = useState(false);
  const [rank, setRank] = useState<string>(e.rank);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const override = useOverrideRank(companyId, e.id);

  async function submit() {
    const parsed = OverrideRankInput.safeParse({ rank, reason });
    if (!parsed.success) {
      setError("Give a reason of at least 3 characters. It is stored in the audit log.");
      return;
    }
    if (parsed.data.rank === e.rank) {
      setError("Choose a different rank.");
      return;
    }
    setError(null);
    try {
      await override.mutateAsync(parsed.data);
      toast.success(`Rank changed to ${RANK_LABEL[parsed.data.rank]}`);
      setOpen(false);
      setReason("");
    } catch (err) {
      setError(errorMessage(err, "The rank could not be changed."));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">Override rank</Button>
      </DialogTrigger>
      <DialogContent
        title="Override rank"
        description="Overrides skip the evidence rules. The reason is recorded as evidence and in the audit log."
      >
        <div className="flex flex-col gap-4">
          <FormField label="New rank">
            <Select value={rank} onValueChange={setRank} options={RANK_OPTIONS} />
          </FormField>
          <FormField label="Reason" error={error}>
            <Textarea value={reason} onChange={(ev) => setReason(ev.target.value)} maxLength={500} rows={3} />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} pending={override.isPending}>
            Change rank
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
