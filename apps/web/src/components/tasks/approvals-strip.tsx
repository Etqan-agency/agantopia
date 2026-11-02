"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusDot } from "@/components/ui/status-dot";
import { useApprovals } from "@/hooks/use-api";
import { formatRelative } from "@/lib/utils";
import { ApprovalActions } from "./approval-actions";

const KIND_LABEL: Record<string, string> = {
  TOOL_USE: "Tool use",
  COST: "Cost",
  PUBLISH: "Publish",
  CREDENTIAL: "Credential",
  DESTRUCTIVE: "Destructive action",
};

/** Pending approvals inbox shown above the task board. Hidden when empty. */
export function ApprovalsStrip({ companyId }: { companyId: string }) {
  const q = useApprovals(companyId, "PENDING");
  if (q.isLoading) return <Skeleton className="h-20 w-full" />;
  if (q.error) return <ErrorState title="Approvals could not be loaded" error={q.error} onRetry={() => void q.refetch()} />;
  const items = q.data ?? [];
  if (!items.length) return null;
  return (
    <section aria-labelledby="approvals-heading" className="border-l-2 border-saffron bg-saffron-wash/40 px-4 py-4">
      <h2 id="approvals-heading" className="flex items-center gap-2 text-sm font-semibold">
        <StatusDot state="waiting" label="" />
        {items.length === 1 ? "1 request is waiting for your approval" : `${items.length} requests are waiting for your approval`}
      </h2>
      <ul className="mt-3 flex flex-col divide-y divide-rule">
        {items.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{a.title}</span>
                <Badge tone={a.kind === "DESTRUCTIVE" || a.kind === "CREDENTIAL" ? "brick" : "saffron"}>{KIND_LABEL[a.kind] ?? a.kind}</Badge>
              </div>
              <p className="text-xs text-fg-muted">
                {a.task ? (
                  <>
                    For{" "}
                    <Link href={`/tasks/${a.task.id}`} className="text-sky-ink underline-offset-4 hover:underline">
                      {a.task.title}
                    </Link>
                    ,{" "}
                  </>
                ) : null}
                requested {formatRelative(a.requestedAt)}
                {a.expiresAt ? `, expires ${formatRelative(a.expiresAt)}` : ""}
              </p>
            </div>
            <ApprovalActions companyId={companyId} approvalId={a.id} title={a.title} />
          </li>
        ))}
      </ul>
    </section>
  );
}
