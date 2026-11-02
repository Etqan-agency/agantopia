"use client";

import { ListTodo } from "lucide-react";
import { useMemo } from "react";
import type { TaskStatus } from "@agentopia/shared";
import { ApprovalsStrip } from "@/components/tasks/approvals-strip";
import { NewTaskDialog } from "@/components/tasks/new-task-dialog";
import { TaskCard } from "@/components/tasks/task-card";
import { ModeBadge } from "@/components/mode-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadMore } from "@/components/ui/load-more";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { lampFromTask, StatusDot } from "@/components/ui/status-dot";
import type { TaskListItem } from "@/hooks/api-shapes";
import { useTasks } from "@/hooks/use-api";
import { useCompany } from "@/hooks/use-company";
import { cn } from "@/lib/utils";

const COLUMNS: Array<{ id: string; label: string; statuses: TaskStatus[] }> = [
  { id: "backlog", label: "Backlog", statuses: ["BACKLOG", "PLANNING"] },
  { id: "assigned", label: "Assigned", statuses: ["ASSIGNED"] },
  { id: "in-progress", label: "In progress", statuses: ["IN_PROGRESS"] },
  { id: "waiting", label: "Waiting for approval", statuses: ["WAITING_APPROVAL"] },
  { id: "provider-limit", label: "Waiting for provider limit", statuses: ["WAITING_FOR_PROVIDER_LIMIT"] },
  { id: "review", label: "In review", statuses: ["REVIEW"] },
  { id: "completed", label: "Completed", statuses: ["COMPLETED"] },
  { id: "blocked", label: "Blocked", statuses: ["BLOCKED"] },
  { id: "failed", label: "Failed", statuses: ["FAILED"] },
  { id: "cancelled", label: "Cancelled", statuses: ["CANCELLED"] },
];

export default function TasksPage() {
  const { companyId, isDemo } = useCompany();
  const tasks = useTasks(companyId);

  const grouped = useMemo(() => {
    const map = new Map<string, TaskListItem[]>(COLUMNS.map((c) => [c.id, []]));
    for (const t of tasks.data ?? []) {
      const col = COLUMNS.find((c) => c.statuses.includes(t.status as TaskStatus));
      if (col) map.get(col.id)!.push(t);
    }
    for (const list of map.values()) list.sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt));
    return map;
  }, [tasks.data]);

  if (!companyId) return null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Tasks"
        description="Everything your employees are planning, doing, and waiting on. The lamp is lit while work is happening."
        meta={<ModeBadge isDemo={isDemo} />}
        actions={<NewTaskDialog companyId={companyId} isDemo={isDemo} />}
      />
      <ApprovalsStrip companyId={companyId} />

      {tasks.isLoading ? (
        <div role="status" aria-live="polite" className="flex gap-4 overflow-hidden">
          <span className="sr-only">Loading tasks</span>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex w-72 shrink-0 flex-col gap-3">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ))}
        </div>
      ) : tasks.error ? (
        <ErrorState title="Tasks could not be loaded" error={tasks.error} onRetry={() => void tasks.refetch()} />
      ) : !(tasks.data ?? []).length ? (
        <EmptyState
          icon={<ListTodo />}
          title="No tasks yet"
          description="Create a task and send it to the manager. It will be planned, assigned to the best-fit employee, executed, and reviewed."
          action={<NewTaskDialog companyId={companyId} isDemo={isDemo} />}
        />
      ) : (
        <>
          {/* Column jump links, desktop: the board is wider than the page, so the columns that hold
              tasks (often Completed) are reachable without scrolling sideways first. */}
          <nav aria-label="Jump to a column" className="-mb-2 hidden flex-wrap items-center gap-2 min-[900px]:flex">
            {COLUMNS.filter((c) => (grouped.get(c.id) ?? []).length).map((col) => (
              <button
                key={col.id}
                type="button"
                onClick={() =>
                  document
                    .getElementById(`col-${col.id}`)
                    ?.closest("section")
                    ?.scrollIntoView({ inline: "start", block: "nearest", behavior: "smooth" })
                }
                className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-full border border-rule-strong px-3 text-xs font-medium text-fg hover:bg-surface-sunken"
              >
                <StatusDot state={lampFromTask(col.statuses[0])} size="sm" label="" />
                {col.label}
                <span className="tabular text-fg-muted">{(grouped.get(col.id) ?? []).length}</span>
              </button>
            ))}
          </nav>

          {/* Columns, desktop */}
          <div
            role="region"
            aria-label="Task board, scrolls horizontally"
            tabIndex={0}
            className="relative -mx-4 hidden overflow-x-auto px-4 pb-4 min-[900px]:-mx-10 min-[900px]:block min-[900px]:px-10"
          >
            <div className="flex gap-5">
              {COLUMNS.map((col) => {
                const list = grouped.get(col.id) ?? [];
                return (
                  <section key={col.id} aria-labelledby={`col-${col.id}`} className={cn("flex shrink-0 scroll-ml-4 flex-col min-[900px]:scroll-ml-10", list.length ? "w-72" : "w-48")}>
                    <h2 id={`col-${col.id}`} className="flex items-center gap-2 border-b border-rule-strong pb-2 text-sm font-semibold">
                      <StatusDot state={lampFromTask(col.statuses[0])} size="sm" label="" />
                      {col.label}
                      <span className="tabular ml-auto text-xs font-normal text-fg-muted">{list.length}</span>
                    </h2>
                    {list.length ? (
                      <ul className="flex flex-col gap-2 pt-3">
                        {list.map((t) => (
                          <li key={t.id}>
                            <TaskCard task={t} />
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="pt-3 text-xs text-fg-muted">Nothing here</p>
                    )}
                  </section>
                );
              })}
            </div>
          </div>

          {/* Grouped list, mobile */}
          <div className="flex flex-col gap-6 min-[900px]:hidden">
            {COLUMNS.filter((c) => (grouped.get(c.id) ?? []).length).map((col) => {
              const list = grouped.get(col.id) ?? [];
              return (
                <section key={col.id} aria-labelledby={`m-col-${col.id}`}>
                  <h2 id={`m-col-${col.id}`} className="flex items-center gap-2 border-b border-rule-strong pb-2 text-sm font-semibold">
                    {col.label}
                    <span className="tabular ml-auto text-xs font-normal text-fg-muted">{list.length}</span>
                  </h2>
                  <ul className="flex flex-col gap-2 pt-3">
                    {list.map((t) => (
                      <li key={t.id}>
                        <TaskCard task={t} />
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
          <LoadMore query={tasks} shown={(tasks.data ?? []).length} noun="tasks" />
        </>
      )}
    </div>
  );
}
