"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, type ReactNode } from "react";
import { SPECIALTY_LABEL, type Specialty } from "@agentopia/shared";
import { SimulatedTag } from "@/components/mode-badge";
import { PriorityBadge, PRIORITY_LABEL, TaskStatusLabel } from "@/components/task-status";
import { ApprovalActions } from "@/components/tasks/approval-actions";
import { ArtifactItem } from "@/components/tasks/artifact-item";
import { COST_SOURCE_LABEL } from "@/components/tasks/event-label";
import { ProviderLimitNotice } from "@/components/tasks/provider-limit-notice";
import { TaskControls } from "@/components/tasks/task-controls";
import { TaskTimeline } from "@/components/tasks/task-timeline";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";
import { lampFromTask, StatusDot } from "@/components/ui/status-dot";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import type { TaskDetail } from "@/hooks/api-shapes";
import { useEmployees, useTask } from "@/hooks/use-api";
import { useCompany } from "@/hooks/use-company";
import { formatDateTime, formatNumber, formatUsd } from "@/lib/utils";

type Execution = TaskDetail["executions"][number];

const EXEC_STATUS: Record<string, string> = {
  QUEUED: "Queued",
  RUNNING: "Running",
  WAITING_APPROVAL: "Waiting for approval",
  SUCCEEDED: "Succeeded",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
  TIMED_OUT: "Timed out",
};

const ERROR_KIND: Record<string, string> = {
  USAGE_LIMIT: "Usage limit",
  RATE_LIMIT: "Rate limit",
  AUTH_EXPIRED: "Authentication expired",
  RUNNER_OFFLINE: "Runner offline",
  UNSUPPORTED: "Unsupported",
};

const ASSIGNMENT_STATUS: Record<string, string> = {
  ACTIVE: "Active",
  HANDED_OFF: "Handed off",
  RETURNED: "Returned",
  CANCELLED: "Cancelled",
};

function isSimulatedExecution(x: Execution) {
  return x.provider?.toUpperCase() === "SIMULATED" || x.mode === "SIMULATED";
}

function tokens(usage: unknown) {
  const u = (usage && typeof usage === "object" ? usage : {}) as Record<string, unknown>;
  const n = (k: string) => (typeof u[k] === "number" ? (u[k] as number) : 0);
  return { input: n("inputTokens") || n("input_tokens"), output: n("outputTokens") || n("output_tokens") };
}

function handoffSummary(handoff: unknown): string | null {
  if (!handoff || typeof handoff !== "object") return null;
  const h = handoff as Record<string, unknown>;
  for (const k of ["summary", "deliverables", "inputs"]) {
    const v = h[k];
    if (typeof v === "string" && v.trim()) return v;
    if (Array.isArray(v) && v.length) return v.filter((x) => typeof x === "string").join("; ");
  }
  return null;
}

function Section({ title, description, children, actions }: { title: string; description?: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="flex flex-col">
      <SectionHeader title={title} description={description} actions={actions} className="border-b border-rule" />
      <div className="pt-4">{children}</div>
    </section>
  );
}

function TaskLinkList({ items, empty }: { items: Array<{ id: string; title: string; status: string }>; empty: string }) {
  if (!items.length) return <p className="text-sm text-fg-muted">{empty}</p>;
  return (
    <ul className="flex flex-col divide-y divide-rule">
      {items.map((t) => (
        <li key={t.id}>
          <Link href={`/tasks/${t.id}`} className="flex min-h-11 items-center gap-3 py-2 text-sm hover:underline">
            <StatusDot state={lampFromTask(t.status)} size="sm" />
            <span className="min-w-0 flex-1 truncate">{t.title}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { companyId } = useCompany();
  const q = useTask(companyId, id);
  const employees = useEmployees(companyId);
  const names = useMemo(() => new Map((employees.data ?? []).map((e) => [e.id, e.name])), [employees.data]);

  if (!companyId) return null;

  if (q.isLoading) {
    return (
      <div className="flex flex-col gap-6" role="status" aria-live="polite">
        <span className="sr-only">Loading task</span>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-2/3" />
        <SkeletonRows rows={6} />
      </div>
    );
  }
  if (q.error || !q.data) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink />
        <ErrorState title="This task could not be loaded" error={q.error} onRetry={() => void q.refetch()} />
      </div>
    );
  }

  const task = q.data;
  const simulated = task.isDemo || task.executions.some(isSimulatedExecution);
  const pendingApprovals = task.approvals.filter((a) => a.status === "PENDING");
  const assigneeName = task.assignee?.name ?? (task.assigneeId ? names.get(task.assigneeId) : undefined);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <BackLink />
        <PageHeader
          title={task.title}
          meta={
            <>
              <TaskStatusLabel status={task.status} />
              <PriorityBadge priority={task.priority} />
              {simulated ? <SimulatedTag /> : null}
            </>
          }
          actions={
            task.status === "WAITING_FOR_PROVIDER_LIMIT" ? null : <TaskControls companyId={companyId} taskId={task.id} status={task.status} />
          }
        />
      </div>

      <div className="grid gap-10 min-[1100px]:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-10">
          <section className="flex flex-col gap-3">
            <h2 className="sr-only">Description</h2>
            <p className="max-w-prose text-sm leading-relaxed whitespace-pre-wrap">{task.description}</p>
            {simulated ? (
              <p className="max-w-prose border-l-2 border-dashed border-saffron-ink/60 pl-3 text-sm text-fg-muted">
                This task ran on the simulated provider. Its messages, artifacts, and results are generated placeholders, not model output.
              </p>
            ) : null}
          </section>

          {task.status === "WAITING_FOR_PROVIDER_LIMIT" ? <ProviderLimitNotice companyId={companyId} task={task} /> : null}

          {task.status !== "WAITING_FOR_PROVIDER_LIMIT" && (task.resultSummary || task.errorMessage) ? (
            <Section title="Result">
              {task.resultSummary ? <p className="max-w-prose text-sm leading-relaxed whitespace-pre-wrap">{task.resultSummary}</p> : null}
              {task.errorMessage ? (
                <p role="alert" className="mt-3 max-w-prose border-l-2 border-brick-ink pl-3 text-sm text-brick-ink">
                  {task.errorMessage}
                </p>
              ) : null}
            </Section>
          ) : null}

          {pendingApprovals.length ? (
            <Section title="Waiting for your approval">
              <ul className="flex flex-col divide-y divide-rule">
                {pendingApprovals.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-3 py-3">
                    <StatusDot state="waiting" />
                    <span className="min-w-0 flex-1 text-sm font-medium">{a.title}</span>
                    <ApprovalActions companyId={companyId} approvalId={a.id} title={a.title} />
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          <Section title="Timeline">
            <TaskTimeline companyId={companyId} taskId={task.id} employeeNames={names} simulated={task.isDemo} />
          </Section>

          <Section title="Execution attempts" description="Each attempt is one run of the assigned employee against the provider.">
            {task.executions.length ? (
              <>
                <div className="hidden min-[900px]:block">
                  <Table>
                    <THead>
                      <TR>
                        <TH>Attempt</TH>
                        <TH>Employee</TH>
                        <TH>Provider</TH>
                        <TH>Status</TH>
                        <TH className="text-right">Tokens in / out</TH>
                        <TH className="text-right">Cost</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {task.executions.map((x) => {
                        const t = tokens(x.usage);
                        return (
                          <TR key={x.id}>
                            <TD className="tabular">{x.attempt}</TD>
                            <TD>{names.get(x.employeeId) ?? "Employee"}</TD>
                            <TD>
                              <span className="flex flex-wrap items-center gap-1.5">
                                {isSimulatedExecution(x) ? <SimulatedTag /> : <span className="capitalize">{x.provider.toLowerCase()}</span>}
                                {x.model ? <span className="text-xs text-fg-muted">{x.model}</span> : null}
                              </span>
                            </TD>
                            <TD>
                              {EXEC_STATUS[x.status] ?? x.status}
                              {x.errorKind && ERROR_KIND[x.errorKind] ? <span className="block text-xs text-fg-muted">{ERROR_KIND[x.errorKind]}</span> : null}
                              {x.error ? <p className="mt-1 max-w-xs text-xs text-brick-ink">{x.error}</p> : null}
                            </TD>
                            <TD className="tabular text-right">
                              {formatNumber(t.input)} / {formatNumber(t.output)}
                            </TD>
                            <TD className="text-right">
                              <span className="tabular">{x.costUsd === null ? "-" : formatUsd(x.costUsd)}</span>
                              <span className="block text-xs text-fg-muted">{COST_SOURCE_LABEL[x.costSource ?? "unavailable"] ?? x.costSource}</span>
                            </TD>
                          </TR>
                        );
                      })}
                    </TBody>
                  </Table>
                </div>
                <ul className="flex flex-col divide-y divide-rule min-[900px]:hidden">
                  {task.executions.map((x) => {
                    const t = tokens(x.usage);
                    return (
                      <li key={x.id} className="flex flex-col gap-1 py-3 text-sm">
                        <span className="font-medium">
                          Attempt {x.attempt}, {EXEC_STATUS[x.status] ?? x.status}
                        </span>
                        <span className="text-fg-muted">
                          {names.get(x.employeeId) ?? "Employee"}, {isSimulatedExecution(x) ? "simulated" : x.provider.toLowerCase()}
                          {x.model ? `, ${x.model}` : ""}
                        </span>
                        <span className="tabular text-fg-muted">
                          {formatNumber(t.input)} in, {formatNumber(t.output)} out, {x.costUsd === null ? "cost unavailable" : `${formatUsd(x.costUsd)} (${(COST_SOURCE_LABEL[x.costSource ?? "unavailable"] ?? "").toLowerCase()})`}
                        </span>
                        {x.error ? <span className="text-xs text-brick-ink">{x.error}</span> : null}
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <p className="text-sm text-fg-muted">No attempts yet. One starts when an employee picks up the task.</p>
            )}
          </Section>

          <Section title="Artifacts">
            {task.artifacts.length ? (
              <ul className="flex flex-col divide-y divide-rule">
                {task.artifacts.map((a) => (
                  <ArtifactItem key={a.id} companyId={companyId} artifact={a} simulated={simulated} />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-fg-muted">No artifacts yet. Deliverables appear here when an attempt finishes.</p>
            )}
          </Section>
        </div>

        <aside className="flex flex-col gap-8" aria-label="Task details">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 border-y border-rule py-4 text-sm">
            <dt className="text-fg-muted">Assignee</dt>
            <dd>
              {task.assigneeId ? (
                <Link href={`/employees/${task.assigneeId}`} className="text-sky-ink underline-offset-4 hover:underline">
                  {assigneeName ?? "Employee"}
                </Link>
              ) : (
                "Unassigned"
              )}
            </dd>
            <dt className="text-fg-muted">Priority</dt>
            <dd>{PRIORITY_LABEL[task.priority] ?? task.priority}</dd>
            <dt className="text-fg-muted">Project</dt>
            <dd>{task.project?.name ?? "None"}</dd>
            <dt className="text-fg-muted">Specialty</dt>
            <dd>{task.requiredSpecialty ? SPECIALTY_LABEL[task.requiredSpecialty as Specialty] : "Any"}</dd>
            <dt className="text-fg-muted">Attempts</dt>
            <dd className="tabular">
              {task.attempt} of {task.maxAttempts}
            </dd>
            <dt className="text-fg-muted">Max cost</dt>
            <dd className="tabular">{task.maxCostUsd === null ? "Company default" : formatUsd(task.maxCostUsd)}</dd>
            <dt className="text-fg-muted">Created</dt>
            <dd>{formatDateTime(task.createdAt)}</dd>
            {task.startedAt ? (
              <>
                <dt className="text-fg-muted">Started</dt>
                <dd>{formatDateTime(task.startedAt)}</dd>
              </>
            ) : null}
            {task.completedAt ? (
              <>
                <dt className="text-fg-muted">Finished</dt>
                <dd>{formatDateTime(task.completedAt)}</dd>
              </>
            ) : null}
          </dl>

          {task.parent ? (
            <Section title="Parent task">
              <TaskLinkList items={[task.parent]} empty="" />
            </Section>
          ) : null}
          <Section title="Depends on">
            <TaskLinkList items={task.dependencies} empty="No dependencies." />
          </Section>
          {task.dependents.length ? (
            <Section title="Blocks">
              <TaskLinkList items={task.dependents} empty="" />
            </Section>
          ) : null}
          <Section title="Subtasks">
            <TaskLinkList items={task.children} empty="No subtasks. The manager adds them when it splits the work." />
          </Section>
          <Section title="Assignments and handoffs">
            {task.assignments.length ? (
              <ol className="flex flex-col divide-y divide-rule">
                {task.assignments.map((a) => {
                  const summary = handoffSummary(a.handoff);
                  return (
                    <li key={a.id} className="flex flex-col gap-1 py-3 text-sm">
                      <span className="flex flex-wrap items-center gap-2">
                        <Link href={`/employees/${a.employeeId}`} className="font-medium hover:underline">
                          {a.employee?.name ?? names.get(a.employeeId) ?? "Employee"}
                        </Link>
                        <Badge tone={a.status === "ACTIVE" ? "saffron" : "neutral"}>{ASSIGNMENT_STATUS[a.status] ?? a.status}</Badge>
                      </span>
                      <span className="text-fg-muted">
                        {a.assignedById ? `Assigned by ${names.get(a.assignedById) ?? "the manager"}` : "Assigned by you"}, {formatDateTime(a.createdAt)}
                      </span>
                      {a.reason ? <span className="leading-relaxed">{a.reason}</span> : null}
                      {summary ? <span className="leading-relaxed text-fg-muted">Handoff: {summary}</span> : null}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="text-sm text-fg-muted">Not assigned yet.</p>
            )}
          </Section>
        </aside>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/tasks" className="inline-flex min-h-11 w-fit items-center gap-2 text-sm text-fg-muted hover:text-fg">
      <ArrowLeft className="size-4" aria-hidden />
      All tasks
    </Link>
  );
}
