"use client";

import { SimulatedTag } from "@/components/mode-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { SkeletonRows } from "@/components/ui/skeleton";
import { lampFromVisual, StatusDot, type LampState } from "@/components/ui/status-dot";
import type { TaskTimelineEvent } from "@/hooks/api-shapes";
import { useTaskEvents } from "@/hooks/use-api";
import { formatDateTime } from "@/lib/utils";
import { EVENT_TO_VISUAL } from "@agentopia/shared";
import { eventDetail, eventLabel, limitEventSentence } from "./event-label";

function lampFor(e: TaskTimelineEvent): LampState {
  if (e.type === "task.completed") return "done";
  if (e.type === "task.waiting_provider_limit" || e.type === "provider.limit") return "waiting";
  if (e.type === "provider.limit_cleared") return "done";
  if (e.type === "task.cancelled") return "offline";
  const visual = EVENT_TO_VISUAL[e.type];
  return visual ? lampFromVisual(visual) : "idle";
}

export function TaskTimeline({
  companyId,
  taskId,
  employeeNames,
  simulated,
}: {
  companyId: string;
  taskId: string;
  employeeNames: Map<string, string>;
  simulated: boolean;
}) {
  const q = useTaskEvents(companyId, taskId);
  if (q.isLoading) return <SkeletonRows rows={4} label="Loading timeline" />;
  if (q.error) return <ErrorState title="The timeline could not be loaded" error={q.error} onRetry={() => void q.refetch()} />;
  const events = (q.data ?? []).slice().sort((a, b) => Number(a.seq) - Number(b.seq));
  if (!events.length) return <EmptyState title="No events yet" description="Events appear here as the task is planned, assigned, and worked on." />;

  return (
    <ol className="relative flex flex-col border-l border-rule-strong pl-6" aria-label="Task timeline">
      {events.map((e) => {
        const detail = limitEventSentence(e.type, e.payload) ?? eventDetail(e.payload);
        const who = e.employeeId ? employeeNames.get(e.employeeId) : undefined;
        return (
          <li key={e.id} className="relative pb-5 last:pb-0">
            <span className="absolute top-1 -left-[31px] flex size-3 items-center justify-center rounded-full bg-surface">
              <StatusDot state={lampFor(e)} size="sm" label="" />
            </span>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-sm font-medium">{eventLabel(e.type)}</span>
              {who ? <span className="text-sm text-fg-muted">{who}</span> : null}
              {e.simulated || simulated ? <SimulatedTag /> : null}
              <time dateTime={e.createdAt} className="ml-auto text-xs text-fg-muted tabular">
                {formatDateTime(e.createdAt)}
              </time>
            </div>
            {detail ? <p className="mt-1 max-w-prose text-sm leading-relaxed whitespace-pre-wrap text-fg-muted">{detail}</p> : null}
          </li>
        );
      })}
    </ol>
  );
}
