import { TASK_STATUS_LABEL, type TaskPriority, type TaskStatus } from "@agentopia/shared";
import { Badge } from "@/components/ui/badge";
import { lampFromTask, StatusDot } from "@/components/ui/status-dot";

export const PRIORITY_LABEL: Record<TaskPriority, string> = { LOW: "Low", NORMAL: "Normal", HIGH: "High", URGENT: "Urgent" };

export function TaskStatusLabel({ status }: { status: TaskStatus | string }) {
  const label = TASK_STATUS_LABEL[status as TaskStatus] ?? status;
  return <StatusDot state={lampFromTask(status)} label={label} showLabel />;
}

export function PriorityBadge({ priority }: { priority: TaskPriority | string }) {
  if (priority === "NORMAL") return null;
  const tone = priority === "URGENT" ? "brick" : priority === "HIGH" ? "saffron" : "neutral";
  return <Badge tone={tone}>{PRIORITY_LABEL[priority as TaskPriority] ?? priority}</Badge>;
}
