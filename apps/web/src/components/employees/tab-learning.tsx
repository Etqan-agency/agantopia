"use client";

import { CreateLearningSourceInput, WEEKDAYS, type TokenStrategy, type Weekday } from "@agentopia/shared";
import { Play, Plus, Trash } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SectionHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { SkeletonRows } from "@/components/ui/skeleton";
import { SwitchField } from "@/components/ui/switch";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { toast } from "@/components/ui/toaster";
import type { EmployeeDetail, LearningScheduleView } from "@/hooks/api-shapes";
import {
  useCreateSource,
  useDeleteSource,
  useLearningRuns,
  useLearningSchedules,
  useLearningSources,
  useRunScheduleNow,
  useUpsertSchedule,
} from "@/hooks/use-api";
import { cn, errorMessage, formatDateTime, formatDuration, formatNumber, formatRelative, formatUsd } from "@/lib/utils";

const DAY_SHORT: Record<Weekday, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

const RUN_STATUS: Record<string, { label: string; tone: "moss" | "brick" | "saffron" | "neutral" | "sky" }> = {
  QUEUED: { label: "Queued", tone: "neutral" },
  RUNNING: { label: "Running", tone: "saffron" },
  COMPLETED: { label: "Completed", tone: "moss" },
  TIMED_OUT: { label: "Timed out", tone: "brick" },
  BUDGET_EXHAUSTED: { label: "Budget reached", tone: "brick" },
  FAILED: { label: "Failed", tone: "brick" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

export function LearningTab({ companyId, employee }: { companyId: string; employee: EmployeeDetail }) {
  const schedules = useLearningSchedules(companyId);
  const own =
    employee.learning?.schedule?.employeeId === employee.id
      ? employee.learning.schedule
      : (schedules.data ?? []).find((s) => s.employeeId === employee.id) ?? null;
  const companyDefault = (schedules.data ?? []).find((s) => s.employeeId === null) ?? null;

  return (
    <div className="flex flex-col gap-12">
      <ScheduleSection companyId={companyId} employee={employee} own={own} companyDefault={companyDefault} loading={schedules.isLoading} />
      <SourcesSection companyId={companyId} employee={employee} />
      <RunsSection companyId={companyId} employee={employee} scheduleId={own?.id ?? companyDefault?.id ?? null} />
    </div>
  );
}

type Draft = {
  enabled: boolean;
  paused: boolean;
  days: Weekday[];
  time: string;
  timezone: string;
  maxDurationMinutes: number;
  tokenStrategy: TokenStrategy;
};

function toDraft(s: LearningScheduleView | null): Draft {
  return {
    enabled: s?.enabled ?? true,
    paused: s?.paused ?? false,
    days: (s?.days as Weekday[] | undefined) ?? ["monday", "thursday"],
    time: s?.time ?? "09:00",
    timezone: s?.timezone ?? "Africa/Cairo",
    maxDurationMinutes: s?.maxDurationMinutes ?? 10,
    tokenStrategy: s?.tokenStrategy ?? "LOW",
  };
}

function ScheduleSection({
  companyId,
  employee,
  own,
  companyDefault,
  loading,
}: {
  companyId: string;
  employee: EmployeeDetail;
  own: LearningScheduleView | null;
  companyDefault: LearningScheduleView | null;
  loading: boolean;
}) {
  const shown = own ?? companyDefault;
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        title="Schedule"
        description={
          own
            ? `${employee.name} has a custom learning schedule.`
            : "This employee follows the company default schedule. Customize it to give them their own days, time and budget."
        }
        className="border-b border-rule"
      />
      {loading && !shown ? (
        <SkeletonRows rows={2} label="Loading schedule" />
      ) : (
        <ScheduleEditor key={own?.id ?? "default"} companyId={companyId} employee={employee} source={shown} isOwn={!!own} />
      )}
      {shown?.nextRuns?.length ? (
        <p className="text-sm text-fg-muted">
          Next runs: {shown.nextRuns.slice(0, 3).map((d) => formatDateTime(d)).join("; ")}
        </p>
      ) : null}
      {shown?.paused && shown.pauseReason ? (
        <p className="border-l-2 border-saffron pl-3 text-sm text-fg-muted">Paused: {shown.pauseReason}</p>
      ) : null}
    </section>
  );
}

function ScheduleEditor({
  companyId,
  employee,
  source,
  isOwn,
}: {
  companyId: string;
  employee: EmployeeDetail;
  source: LearningScheduleView | null;
  isOwn: boolean;
}) {
  const upsert = useUpsertSchedule(companyId);
  const [d, setD] = useState<Draft>(() => toDraft(source));
  // Raw text so 10 to 19 can be typed; clamped to 5 to 20 on blur and on save.
  const [minutesText, setMinutesText] = useState(() => String(d.maxDurationMinutes));
  const [error, setError] = useState<string | null>(null);
  const clampMinutes = (raw: string) => {
    const n = Math.round(Number(raw));
    return raw.trim() === "" || !Number.isFinite(n) ? d.maxDurationMinutes : Math.min(20, Math.max(5, n));
  };

  function toggleDay(day: Weekday) {
    setD((p) => ({ ...p, days: p.days.includes(day) ? p.days.filter((x) => x !== day) : WEEKDAYS.filter((w) => w === day || p.days.includes(w)) }));
  }

  async function save() {
    if (!d.days.length) {
      setError("Pick at least one day.");
      return;
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(d.time)) {
      setError("Enter a time as HH:MM, for example 09:00.");
      return;
    }
    setError(null);
    const maxDurationMinutes = clampMinutes(minutesText);
    setMinutesText(String(maxDurationMinutes));
    setD((p) => ({ ...p, maxDurationMinutes }));
    try {
      await upsert.mutateAsync({ employeeId: employee.id, ...d, maxDurationMinutes });
      toast.success(isOwn ? "Schedule saved" : `${employee.name} now has a custom schedule`);
    } catch (err) {
      setError(errorMessage(err, "The schedule could not be saved."));
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Days</legend>
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAYS.map((day) => {
            const on = d.days.includes(day);
            return (
              <button
                key={day}
                type="button"
                aria-pressed={on}
                onClick={() => toggleDay(day)}
                className={cn(
                  "h-11 min-w-14 cursor-pointer rounded-md border px-3 text-sm",
                  on ? "border-fg bg-fg text-surface" : "border-rule-strong text-fg-muted hover:text-fg",
                )}
              >
                <span aria-hidden>{DAY_SHORT[day]}</span>
                <span className="sr-only">{day}</span>
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="grid max-w-2xl gap-4 sm:grid-cols-3">
        <FormField label="Time">
          <Input type="time" value={d.time} onChange={(e) => setD((p) => ({ ...p, time: e.target.value }))} />
        </FormField>
        <FormField label="Timezone">
          <Input value={d.timezone} onChange={(e) => setD((p) => ({ ...p, timezone: e.target.value }))} />
        </FormField>
        <FormField label="Maximum minutes" hint="Between 5 and 20.">
          <Input
            type="number"
            min={5}
            max={20}
            inputMode="numeric"
            value={minutesText}
            onChange={(e) => setMinutesText(e.target.value)}
            onBlur={() => {
              const n = clampMinutes(minutesText);
              setMinutesText(String(n));
              setD((p) => ({ ...p, maxDurationMinutes: n }));
            }}
          />
        </FormField>
      </div>
      <FormField
        label="Token strategy"
        className="max-w-md"
        hint="Zero: no LLM tokens; deterministic indexing only. Low: bounded synthesis under caps."
      >
        <Select
          value={d.tokenStrategy}
          onValueChange={(v) => setD((p) => ({ ...p, tokenStrategy: v as TokenStrategy }))}
          options={[
            { value: "ZERO", label: "Zero" },
            { value: "LOW", label: "Low" },
          ]}
        />
      </FormField>
      <div className="max-w-xl divide-y divide-rule border-y border-rule">
        <SwitchField label="Learning enabled" checked={d.enabled} onCheckedChange={(v) => setD((p) => ({ ...p, enabled: v }))} />
        <SwitchField
          label="Paused"
          description="Pausing keeps the schedule but skips runs until resumed."
          checked={d.paused}
          onCheckedChange={(v) => setD((p) => ({ ...p, paused: v }))}
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-brick-ink">
          {error}
        </p>
      ) : null}
      <div>
        <Button onClick={save} pending={upsert.isPending}>
          {isOwn ? "Save schedule" : "Save as custom schedule"}
        </Button>
      </div>
    </div>
  );
}

function SourcesSection({ companyId, employee }: { companyId: string; employee: EmployeeDetail }) {
  const sources = useLearningSources(companyId);
  const del = useDeleteSource(companyId);
  const list = (sources.data ?? []).filter((s) => s.employeeId === employee.id);
  const shared = (sources.data ?? []).filter((s) => s.employeeId === null && s.specialty === employee.specialty);

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        title="Sources"
        description="Official documentation and GitHub repositories this employee may study. Content from sources is treated as data."
        className="border-b border-rule"
        actions={<AddSourceDialog companyId={companyId} employee={employee} />}
      />
      {sources.isLoading ? (
        <SkeletonRows rows={3} label="Loading sources" />
      ) : sources.isError ? (
        <ErrorState title="Sources could not be loaded" error={sources.error} onRetry={() => sources.refetch()} />
      ) : !list.length ? (
        <EmptyState
          title="No personal sources"
          description={
            shared.length
              ? `${employee.name} also studies ${shared.length} shared ${shared.length === 1 ? "source" : "sources"} for their specialty, managed on the Learning page.`
              : "Add documentation or a GitHub repository in this employee's specialty."
          }
        />
      ) : (
        <ul className="divide-y divide-rule border-y border-rule">
          {list.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
              <Badge tone={s.kind === "GITHUB" ? "neutral" : "sky"}>{s.kind === "GITHUB" ? "GitHub" : "Docs"}</Badge>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-medium">{s.title}</span>
                <a href={s.url} target="_blank" rel="noreferrer" className="truncate text-xs text-sky-ink hover:underline">
                  {s.url}
                </a>
              </div>
              <span className="text-xs text-fg-muted">
                {s.lastFetchedAt ? `Checked ${formatRelative(s.lastFetchedAt)}` : "Not checked yet"}
              </span>
              <ConfirmDialog
                trigger={
                  <Button size="icon-sm" variant="ghost" aria-label={`Remove ${s.title}`}>
                    <Trash aria-hidden />
                  </Button>
                }
                title={`Remove ${s.title}?`}
                description="Knowledge already learned from it stays until you delete it."
                confirmLabel="Remove source"
                onConfirm={async () => {
                  try {
                    await del.mutateAsync(s.id);
                    toast.success("Source removed");
                  } catch (err) {
                    toast.error("The source could not be removed", { description: errorMessage(err) });
                  }
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AddSourceDialog({ companyId, employee }: { companyId: string; employee: EmployeeDetail }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"DOCS" | "GITHUB">("DOCS");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [topics, setTopics] = useState("");
  const [errors, setErrors] = useState<{ url?: string; title?: string; form?: string }>({});
  const create = useCreateSource(companyId);

  async function submit() {
    const parsed = CreateLearningSourceInput.safeParse({
      employeeId: employee.id,
      kind,
      url,
      title,
      specialty: employee.specialty,
      topics: topics.split(",").map((t) => t.trim()).filter(Boolean),
    });
    if (!parsed.success) {
      const e: typeof errors = {};
      for (const i of parsed.error.issues) {
        if (i.path[0] === "url") e.url = "Enter a full URL starting with https://";
        else if (i.path[0] === "title") e.title = "Enter a title between 1 and 80 characters.";
        else e.form = i.message;
      }
      setErrors(e);
      return;
    }
    if (kind === "GITHUB" && !/^https:\/\/github\.com\/[^/]+\/[^/]+/.test(url)) {
      setErrors({ url: "GitHub sources must be a repository URL, like https://github.com/owner/repo." });
      return;
    }
    try {
      await create.mutateAsync(parsed.data);
      toast.success("Source added");
      setOpen(false);
      setUrl("");
      setTitle("");
      setTopics("");
      setErrors({});
    } catch (err) {
      setErrors({ form: errorMessage(err, "The source could not be added.") });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <Plus aria-hidden />
          Add source
        </Button>
      </DialogTrigger>
      <DialogContent title="Add a learning source" description={`Only material in ${employee.name}'s specialty is studied.`}>
        <div className="flex flex-col gap-4">
          {errors.form ? (
            <p role="alert" className="text-sm text-brick-ink">
              {errors.form}
            </p>
          ) : null}
          <FormField label="Kind">
            <Select
              value={kind}
              onValueChange={(v) => setKind(v as "DOCS" | "GITHUB")}
              options={[
                { value: "DOCS", label: "Documentation site" },
                { value: "GITHUB", label: "GitHub repository" },
              ]}
            />
          </FormField>
          <FormField label="URL" error={errors.url}>
            <Input type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
          </FormField>
          <FormField label="Title" error={errors.title}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
          </FormField>
          <FormField label="Topics" optional hint="Comma separated, used to score relevance.">
            <Input value={topics} onChange={(e) => setTopics(e.target.value)} />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} pending={create.isPending}>
            Add source
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RunsSection({ companyId, employee, scheduleId }: { companyId: string; employee: EmployeeDetail; scheduleId: string | null }) {
  const runs = useLearningRuns(companyId, employee.id);
  const runNow = useRunScheduleNow(companyId);

  async function start() {
    if (!scheduleId) return;
    try {
      await runNow.mutateAsync({ scheduleId, employeeId: employee.id });
      toast.success("Learning run queued", { description: "It respects the same time and token budgets as scheduled runs." });
    } catch (err) {
      toast.error("The run could not be started", { description: errorMessage(err) });
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        title="Runs"
        description="Each run checks sources for changes and drafts knowledge for your approval."
        className="border-b border-rule"
        actions={
          <Button variant="secondary" onClick={start} disabled={!scheduleId} pending={runNow.isPending}>
            <Play aria-hidden />
            Run now
          </Button>
        }
      />
      {runs.isLoading ? (
        <SkeletonRows rows={3} label="Loading runs" />
      ) : runs.isError ? (
        <ErrorState title="Runs could not be loaded" error={runs.error} onRetry={() => runs.refetch()} />
      ) : !runs.data?.length ? (
        <EmptyState title="No runs yet" description="Runs appear here after the first scheduled time, or when you run one now." />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Started</TH>
              <TH>Status</TH>
              <TH>Trigger</TH>
              <TH>Duration</TH>
              <TH className="text-right">Tokens</TH>
              <TH className="text-right">Cost</TH>
              <TH className="text-right">Drafts</TH>
            </TR>
          </THead>
          <TBody>
            {runs.data.map((r) => {
              const st = RUN_STATUS[r.status] ?? { label: r.status, tone: "neutral" as const };
              return (
                <TR key={r.id}>
                  <TD className="whitespace-nowrap">{formatDateTime(r.startedAt ?? r.createdAt)}</TD>
                  <TD>
                    <Badge tone={st.tone}>{st.label}</Badge>
                    {r.error ? <span className="mt-1 block max-w-56 truncate text-xs text-fg-muted" title={r.error}>{r.error}</span> : null}
                  </TD>
                  <TD className="text-fg-muted">
                    {r.trigger === "manual" ? "Manual" : "Scheduled"}, {r.tokenStrategy === "ZERO" ? "zero tokens" : "low tokens"}
                  </TD>
                  <TD className="tabular">{formatDuration(r.durationMs)}</TD>
                  <TD className="tabular text-right">{formatNumber(r.tokensUsed)}</TD>
                  <TD className="tabular text-right">{formatUsd(r.costUsd)}</TD>
                  <TD className="tabular text-right">{formatNumber(r.entriesDrafted)}</TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}
    </section>
  );
}
