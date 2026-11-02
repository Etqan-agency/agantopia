"use client";

import { Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadMore } from "@/components/ui/load-more";
import { ErrorState } from "@/components/ui/error-state";
import { SectionHeader } from "@/components/ui/page-header";
import { SkeletonRows } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";
import type { KnowledgeEntryView } from "@/hooks/api-shapes";
import { useDecideKnowledge, useKnowledge } from "@/hooks/use-api";
import { errorMessage, formatDateTime } from "@/lib/utils";

const PROVENANCE: Record<string, string> = {
  OWNER: "Added by you",
  LEARNING_LLM: "Learning run, model summary",
  LEARNING_DETERMINISTIC: "Learning run, reference note",
  TASK_POSTMORTEM: "Task lesson, model summary",
  TASK_POSTMORTEM_DETERMINISTIC: "Task lesson",
};

/** Draft knowledge waiting for the owner. Nothing here is used by employees until approved. */
export function ApprovalQueue({ companyId }: { companyId: string }) {
  const q = useKnowledge(companyId, { status: "DRAFT" });
  const drafts = q.data ?? [];
  return (
    <section aria-labelledby="queue-h" className="flex flex-col">
      <SectionHeader
        title={
          <span id="queue-h" className="flex items-center gap-2">
            Approval queue {drafts.length ? <Badge tone="saffron">{drafts.length}</Badge> : null}
          </span>
        }
        description="Drafts from learning runs and task lessons. Employees only retrieve verified knowledge."
      />
      {q.isLoading ? (
        <SkeletonRows rows={3} label="Loading drafts" />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : drafts.length === 0 ? (
        <EmptyState icon={<Inbox />} title="Nothing to review" description="New drafts appear here after the next learning run." />
      ) : (
        <>
          <ul className="flex flex-col border-t border-rule">
            {drafts.map((k) => (
              <DraftItem key={k.id} companyId={companyId} entry={k} />
            ))}
          </ul>
          <LoadMore query={q} shown={drafts.length} noun="drafts" className="pt-4" />
        </>
      )}
    </section>
  );
}

function DraftItem({ companyId, entry: k }: { companyId: string; entry: KnowledgeEntryView }) {
  const decide = useDecideKnowledge(companyId);
  async function act(decision: "APPROVED" | "REJECTED") {
    try {
      await decide.mutateAsync({ id: k.id, decision });
      toast.success(decision === "APPROVED" ? "Approved" : "Rejected", { description: k.title });
    } catch (err) {
      toast.error("Decision failed", { description: errorMessage(err) });
    }
  }
  const confidence = Math.round((k.confidence ?? 0) * 100);
  return (
    <li className="flex flex-col gap-3 border-b border-rule py-4 min-[900px]:flex-row min-[900px]:gap-8">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{k.title}</span>
          {k.employee ? <Badge tone="outline">{k.employee.name}</Badge> : <Badge tone="outline">Company</Badge>}
        </div>
        <p className="max-w-prose text-sm leading-relaxed whitespace-pre-line">{k.content.length > 600 ? `${k.content.slice(0, 600)}…` : k.content}</p>
        <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-fg-muted">
          <div className="flex gap-1">
            <dt>Source</dt>
            <dd className="min-w-0">
              {k.sourceUrl ? (
                <a href={k.sourceUrl} target="_blank" rel="noreferrer noopener" className="break-all text-sky-ink underline-offset-2 hover:underline">
                  {k.sourceUrl}
                </a>
              ) : (
                "none"
              )}
            </dd>
          </div>
          <div className="flex gap-1">
            <dt>Retrieved</dt>
            <dd>{formatDateTime(k.retrievedAt)}</dd>
          </div>
          <div className="flex gap-1">
            <dt>Confidence</dt>
            <dd className="tabular">{confidence}%</dd>
          </div>
          <div className="flex gap-1">
            <dt>Origin</dt>
            <dd>{PROVENANCE[k.provenance] ?? k.provenance}</dd>
          </div>
        </dl>
      </div>
      <div className="flex shrink-0 items-start gap-2">
        <Button size="sm" onClick={() => act("APPROVED")} disabled={decide.isPending}>
          Approve
        </Button>
        <Button size="sm" variant="danger-outline" onClick={() => act("REJECTED")} disabled={decide.isPending}>
          Reject
        </Button>
      </div>
    </li>
  );
}
