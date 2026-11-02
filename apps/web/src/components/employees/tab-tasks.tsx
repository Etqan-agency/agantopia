"use client";

import Link from "next/link";
import { SimulatedTag } from "@/components/mode-badge";
import { PriorityBadge, TaskStatusLabel } from "@/components/task-status";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadMore } from "@/components/ui/load-more";
import { ErrorState } from "@/components/ui/error-state";
import { SectionHeader } from "@/components/ui/page-header";
import { SkeletonRows } from "@/components/ui/skeleton";
import type { EmployeeDetail, TaskListItem } from "@/hooks/api-shapes";
import { useEmployeeTasks } from "@/hooks/use-api";
import { formatRelative } from "@/lib/utils";

export function TasksTab({ companyId, employee }: { companyId: string; employee: EmployeeDetail }) {
  const tasks = useEmployeeTasks(companyId, employee.id);

  if (tasks.isLoading) return <SkeletonRows rows={5} label="Loading task history" />;
  if (tasks.isError) return <ErrorState title="Task history could not be loaded" error={tasks.error} onRetry={() => tasks.refetch()} />;
  const list = tasks.data ?? [];
  if (!list.length)
    return (
      <EmptyState
        title="No tasks yet"
        description={`When the manager delegates work to ${employee.name}, or you assign it directly, it appears here.`}
        action={
          <Link href="/tasks" className="text-sm text-sky-ink hover:underline">
            Open the task center
          </Link>
        }
      />
    );

  const projects = new Map<string, { name: string; tasks: TaskListItem[] }>();
  for (const t of list) {
    const key = t.project?.id ?? "__none";
    const g = projects.get(key) ?? { name: t.project?.name ?? "No project", tasks: [] };
    g.tasks.push(t);
    projects.set(key, g);
  }

  return (
    <div className="flex flex-col gap-10">
      {[...projects.entries()].map(([key, g]) => {
        const done = g.tasks.filter((t) => t.status === "COMPLETED").length;
        return (
          <section key={key}>
            <SectionHeader
              title={g.name}
              description={`${g.tasks.length} ${g.tasks.length === 1 ? "task" : "tasks"}, ${done} completed`}
              className="border-b border-rule"
            />
            <ul className="divide-y divide-rule">
              {g.tasks.map((t) => (
                <li key={t.id}>
                  <Link href={`/tasks/${t.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 hover:bg-surface-sunken/50">
                    <span className="min-w-0 flex-1 text-sm font-medium">{t.title}</span>
                    <PriorityBadge priority={t.priority} />
                    {t.isDemo ? <SimulatedTag /> : null}
                    <TaskStatusLabel status={t.status} />
                    <span className="w-28 text-right text-xs text-fg-muted">{formatRelative(t.completedAt ?? t.updatedAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <LoadMore query={tasks} shown={list.length} noun="tasks" />
    </div>
  );
}
