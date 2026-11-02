import Link from "next/link";
import { SPECIALTY_LABEL, type Specialty } from "@agentopia/shared";
import { AvatarSwatch } from "@/components/avatar-swatch";
import { SimulatedTag } from "@/components/mode-badge";
import { PriorityBadge, TaskStatusLabel } from "@/components/task-status";
import { lampFromTask, StatusDot } from "@/components/ui/status-dot";
import type { TaskListItem } from "@/hooks/api-shapes";
import { cn, formatRelative } from "@/lib/utils";

export function TaskCard({ task, showStatus = false, className }: { task: TaskListItem; showStatus?: boolean; className?: string }) {
  return (
    <Link
      href={`/tasks/${task.id}`}
      className={cn(
        "group flex flex-col gap-2 rounded-md border border-rule bg-surface-raised px-3 py-3 transition-colors hover:border-rule-strong",
        task.isDemo && "border-dashed",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        {showStatus ? null : <StatusDot state={lampFromTask(task.status)} size="sm" className="mt-1.5" />}
        <span className="line-clamp-3 flex-1 text-sm font-medium group-hover:underline">{task.title}</span>
      </div>
      {showStatus ? <TaskStatusLabel status={task.status} /> : null}
      <div className="flex flex-wrap items-center gap-1.5">
        <PriorityBadge priority={task.priority} />
        {task.isDemo ? <SimulatedTag /> : null}
        {task.requiredSpecialty ? (
          <span className="text-xs text-fg-muted">{SPECIALTY_LABEL[task.requiredSpecialty as Specialty]}</span>
        ) : null}
        {task.project ? <span className="truncate text-xs text-fg-muted">{task.project.name}</span> : null}
      </div>
      <div className="flex items-center gap-2 text-xs text-fg-muted">
        {task.assignee ? (
          <>
            <AvatarSwatch name={task.assignee.name} palette={task.assignee.avatar?.palette} size="sm" />
            <span className="truncate">{task.assignee.name}</span>
          </>
        ) : (
          <span>Unassigned</span>
        )}
        <span className="ml-auto shrink-0">{formatRelative(task.updatedAt ?? task.createdAt)}</span>
      </div>
    </Link>
  );
}
