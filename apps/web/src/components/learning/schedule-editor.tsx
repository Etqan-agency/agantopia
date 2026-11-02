"use client";

import { Pause, Play } from "lucide-react";
import { useState, type FormEvent } from "react";
import { LearningConfigSchema, UpsertLearningScheduleInput, WEEKDAYS, type TokenStrategy, type Weekday } from "@agentopia/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SectionHeader } from "@/components/ui/page-header";
import { SwitchField } from "@/components/ui/switch";
import { toast } from "@/components/ui/toaster";
import type { LearningScheduleView } from "@/hooks/api-shapes";
import { useRunScheduleNow, useUpsertSchedule } from "@/hooks/use-api";
import { cn, errorMessage, formatDateTime, formatRelative } from "@/lib/utils";

const DAY_LABEL: Record<Weekday, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};
const DAY_NAME: Record<Weekday, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

export const TOKEN_STRATEGY_COPY = "Zero: no LLM tokens; deterministic indexing only. Low: bounded synthesis under caps";

type Draft = {
  enabled: boolean;
  days: Weekday[];
  time: string;
  timezone: string;
  maxDurationMinutes: string;
  tokenStrategy: TokenStrategy;
  sourceDocs: boolean;
  sourceGithub: boolean;
  specializationOnly: boolean;
  approvalRequired: boolean;
  skipUnchanged: boolean;
  pauseOnBudgetExhaustion: boolean;
  perRunTokenBudget: string;
  weeklyTokenBudget: string;
  weeklyCostBudgetUsd: string;
};

function toDraft(s: LearningScheduleView | null, fallbackTz: string): Draft {
  const d = LearningConfigSchema.parse(s ? {} : { timezone: fallbackTz });
  const src = s ?? d;
  return {
    enabled: src.enabled,
    days: [...src.days] as Weekday[],
    time: src.time,
    timezone: src.timezone,
    maxDurationMinutes: String(src.maxDurationMinutes),
    tokenStrategy: src.tokenStrategy,
    sourceDocs: src.sourceDocs,
    sourceGithub: src.sourceGithub,
    specializationOnly: src.specializationOnly,
    approvalRequired: src.approvalRequired,
    skipUnchanged: src.skipUnchanged,
    pauseOnBudgetExhaustion: src.pauseOnBudgetExhaustion,
    perRunTokenBudget: String(src.perRunTokenBudget),
    weeklyTokenBudget: String(src.weeklyTokenBudget),
    weeklyCostBudgetUsd: String(src.weeklyCostBudgetUsd),
  };
}

function timezones(): string[] {
  try {
    return (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
  } catch {
    return [];
  }
}

/**
 * Company default learning schedule (employeeId null). Employees inherit it
 * unless they have their own schedule.
 */
export function ScheduleEditor({
  companyId,
  schedule,
  companyTimezone,
  employeeId = null,
  title = "Default schedule",
  description = "Applies to every employee without a schedule of their own. Times are local to the timezone below, including across daylight saving changes.",
}: {
  companyId: string;
  schedule: LearningScheduleView | null;
  companyTimezone: string;
  employeeId?: string | null;
  title?: string;
  description?: string;
}) {
  const upsert = useUpsertSchedule(companyId);
  const runNow = useRunScheduleNow(companyId);
  const [draft, setDraft] = useState<Draft>(() => toDraft(schedule, companyTimezone));
  // True once the person edits the form; cleared after a successful save. Server updates
  // (every run bumps updatedAt) only resync the form while there are no unsaved edits.
  const [dirty, setDirty] = useState(false);
  const syncKey = schedule ? `${schedule.id}:${schedule.updatedAt}` : "";
  const [syncedKey, setSyncedKey] = useState(syncKey);
  if (syncKey !== syncedKey) {
    setSyncedKey(syncKey);
    if (!dirty) setDraft(toDraft(schedule, companyTimezone));
  }
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setDirty(true);
    setDraft((d) => ({ ...d, [k]: v }));
  };
  const paused = schedule?.paused ?? false;

  function toggleDay(day: Weekday) {
    set("days", draft.days.includes(day) ? draft.days.filter((d) => d !== day) : WEEKDAYS.filter((d) => d === day || draft.days.includes(d)));
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    // A cleared number field must not save as 0 (Number("") === 0). A weekly cost budget of 0
    // would make every LOW run skip as "weekly budget exhausted", so ask for a value instead.
    const blank: Record<string, string> = {};
    const num = (k: "maxDurationMinutes" | "perRunTokenBudget" | "weeklyTokenBudget" | "weeklyCostBudgetUsd") => {
      const raw = draft[k].trim();
      if (raw === "") {
        blank[k] = "Enter a value.";
        return undefined;
      }
      return Number(raw);
    };
    const maxDurationMinutes = num("maxDurationMinutes");
    const perRunTokenBudget = num("perRunTokenBudget");
    const weeklyTokenBudget = num("weeklyTokenBudget");
    const weeklyCostBudgetUsd = num("weeklyCostBudgetUsd");
    if (Object.keys(blank).length) {
      setErrors(blank);
      return;
    }
    const parsed = UpsertLearningScheduleInput.safeParse({
      employeeId,
      enabled: draft.enabled,
      days: draft.days,
      time: draft.time,
      timezone: draft.timezone.trim(),
      maxDurationMinutes,
      tokenStrategy: draft.tokenStrategy,
      sourceDocs: draft.sourceDocs,
      sourceGithub: draft.sourceGithub,
      specializationOnly: draft.specializationOnly,
      approvalRequired: draft.approvalRequired,
      skipUnchanged: draft.skipUnchanged,
      pauseOnBudgetExhaustion: draft.pauseOnBudgetExhaustion,
      perRunTokenBudget,
      weeklyTokenBudget,
      weeklyCostBudgetUsd,
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (next[key]) continue;
        next[key] =
          key === "days"
            ? "Pick at least one day."
            : key === "time"
              ? "Use 24-hour time, e.g. 09:00."
              : key === "maxDurationMinutes"
                ? "Between 5 and 20 minutes."
                : issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    try {
      const saved = await upsert.mutateAsync(parsed.data);
      // Saved: show what the server stored and let later server updates resync the form again.
      if (saved && typeof saved === "object" && "id" in saved) setDraft(toDraft(saved, companyTimezone));
      setDirty(false);
      toast.success("Schedule saved");
    } catch (err) {
      setErrors({ form: errorMessage(err) });
    }
  }

  async function setPaused(next: boolean) {
    try {
      await upsert.mutateAsync({ employeeId, paused: next });
      toast.success(next ? "Learning paused" : "Learning resumed");
    } catch (err) {
      toast.error(next ? "Pause failed" : "Resume failed", { description: errorMessage(err) });
    }
  }

  const tzList = timezones();
  const listId = `tz-${employeeId ?? "company"}`;

  return (
    <section aria-labelledby={`sched-${employeeId ?? "company"}`} className="flex flex-col">
      <SectionHeader
        title={
          <span id={`sched-${employeeId ?? "company"}`} className="flex items-center gap-2">
            {title}
            {paused ? <Badge tone="saffron">Paused</Badge> : !draft.enabled ? <Badge>Off</Badge> : null}
          </span>
        }
        description={description}
        actions={
          schedule ? (
            <>
              <Button
                size="sm"
                variant="secondary"
                pending={runNow.isPending}
                onClick={async () => {
                  try {
                    await runNow.mutateAsync({ scheduleId: schedule.id, employeeId: employeeId ?? undefined });
                    toast.success("Learning run queued", { description: "It respects the same time and token budgets." });
                  } catch (err) {
                    toast.error("Could not start a run", { description: errorMessage(err) });
                  }
                }}
              >
                <Play aria-hidden />
                Run now
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPaused(!paused)} disabled={upsert.isPending}>
                {paused ? <Play aria-hidden /> : <Pause aria-hidden />}
                {paused ? "Resume" : "Pause"}
              </Button>
            </>
          ) : null
        }
      />
      {paused && schedule?.pauseReason ? (
        <p className="mb-4 border-l-2 border-saffron bg-saffron-wash/60 px-3 py-2 text-sm">Paused: {schedule.pauseReason}</p>
      ) : null}

      <form onSubmit={save} noValidate className="grid gap-x-12 gap-y-6 border-t border-rule pt-5 min-[1100px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <SwitchField
            label="Learning on"
            description="When off, no scheduled runs start. Manual runs still work."
            checked={draft.enabled}
            onCheckedChange={(v) => set("enabled", v)}
            className="pt-0"
          />
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-sm font-medium">Days</legend>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((d) => {
                const on = draft.days.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    title={DAY_NAME[d]}
                    onClick={() => toggleDay(d)}
                    className={cn(
                      "h-11 min-w-12 cursor-pointer rounded-md border px-3 text-sm transition-colors",
                      on ? "border-fg bg-fg text-surface" : "border-rule-strong bg-surface-raised text-fg hover:bg-surface-sunken",
                    )}
                  >
                    {DAY_LABEL[d]}
                  </button>
                );
              })}
            </div>
            {errors.days ? (
              <p role="alert" className="text-xs font-medium text-brick-ink">
                {errors.days}
              </p>
            ) : null}
          </fieldset>
          <div className="grid gap-5 sm:grid-cols-3">
            <FormField label="Time" error={errors.time}>
              <Input type="time" value={draft.time} onChange={(e) => set("time", e.target.value)} step={60} />
            </FormField>
            <FormField label="Timezone" error={errors.timezone} className="sm:col-span-2">
              <Input value={draft.timezone} onChange={(e) => set("timezone", e.target.value)} list={listId} spellCheck={false} />
            </FormField>
            <datalist id={listId}>
              {tzList.map((tz) => (
                <option key={tz} value={tz} />
              ))}
            </datalist>
          </div>
          <FormField label="Maximum run length (minutes)" hint="5 to 20. A run stops at this limit and keeps what it finished." error={errors.maxDurationMinutes}>
            <Input type="number" min={5} max={20} inputMode="numeric" value={draft.maxDurationMinutes} onChange={(e) => set("maxDurationMinutes", e.target.value)} className="w-32" />
          </FormField>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-sm font-medium">Token strategy</legend>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-describedby={`ts-${listId}`}>
              {(["ZERO", "LOW"] as const).map((t) => (
                <label
                  key={t}
                  className={cn(
                    "flex h-11 cursor-pointer items-center gap-2 rounded-md border px-4 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus",
                    draft.tokenStrategy === t ? "border-fg bg-surface-raised font-medium" : "border-rule-strong",
                  )}
                >
                  <input
                    type="radio"
                    name={`token-${listId}`}
                    checked={draft.tokenStrategy === t}
                    onChange={() => set("tokenStrategy", t)}
                    className="size-4 accent-[var(--color-ink)]"
                  />
                  {t === "ZERO" ? "Zero" : "Low"}
                </label>
              ))}
            </div>
            <p id={`ts-${listId}`} className="text-xs leading-relaxed text-fg-muted">
              {TOKEN_STRATEGY_COPY}
            </p>
          </fieldset>
        </div>

        <div className="flex flex-col">
          <h3 className="text-sm font-medium">Sources and rules</h3>
          <div className="flex flex-col divide-y divide-rule">
            <SwitchField label="Official documentation" description="Docs sites on the allowlist below." checked={draft.sourceDocs} onCheckedChange={(v) => set("sourceDocs", v)} />
            <SwitchField label="GitHub repositories" description="Public repositories on the allowlist; read only, nothing is executed." checked={draft.sourceGithub} onCheckedChange={(v) => set("sourceGithub", v)} />
            <SwitchField label="Specialty topics only" description="Ignore material outside each employee's specialty." checked={draft.specializationOnly} onCheckedChange={(v) => set("specializationOnly", v)} />
            <SwitchField label="Require my approval" description="New notes stay drafts until you approve them in the queue." checked={draft.approvalRequired} onCheckedChange={(v) => set("approvalRequired", v)} />
            <SwitchField label="Skip unchanged sources" description="Use ETags and commit hashes to avoid re-reading what has not changed." checked={draft.skipUnchanged} onCheckedChange={(v) => set("skipUnchanged", v)} />
            <SwitchField label="Pause when the budget runs out" description="Otherwise runs continue in zero-token mode." checked={draft.pauseOnBudgetExhaustion} onCheckedChange={(v) => set("pauseOnBudgetExhaustion", v)} />
          </div>
          <h3 className="mt-5 text-sm font-medium">Budgets</h3>
          <div className="mt-3 grid gap-5 sm:grid-cols-3">
            <FormField label="Tokens per run" error={errors.perRunTokenBudget}>
              <Input type="number" min={0} max={200000} inputMode="numeric" value={draft.perRunTokenBudget} onChange={(e) => set("perRunTokenBudget", e.target.value)} />
            </FormField>
            <FormField label="Tokens per week" error={errors.weeklyTokenBudget}>
              <Input type="number" min={0} max={1000000} inputMode="numeric" value={draft.weeklyTokenBudget} onChange={(e) => set("weeklyTokenBudget", e.target.value)} />
            </FormField>
            <FormField label="Cost per week (USD)" error={errors.weeklyCostBudgetUsd}>
              <Input type="number" min={0} max={50} step="0.05" inputMode="decimal" value={draft.weeklyCostBudgetUsd} onChange={(e) => set("weeklyCostBudgetUsd", e.target.value)} />
            </FormField>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 border-t border-rule pt-5 min-[1100px]:col-span-2">
          <Button type="submit" pending={upsert.isPending}>
            Save schedule
          </Button>
          {errors.form ? (
            <p role="alert" className="text-sm font-medium text-brick-ink">
              {errors.form}
            </p>
          ) : null}
          {schedule?.lastRunAt ? <span className="text-sm text-fg-muted">Last run {formatRelative(schedule.lastRunAt)}</span> : null}
        </div>
      </form>

      {schedule ? (
        <div className="mt-6">
          <h3 className="text-sm font-medium">Next runs</h3>
          {paused || !schedule.enabled ? (
            <p className="mt-1 text-sm text-fg-muted">No runs are scheduled while learning is {paused ? "paused" : "off"}.</p>
          ) : schedule.nextRuns?.length ? (
            <ol className="mt-2 flex flex-wrap gap-2">
              {schedule.nextRuns.slice(0, 6).map((t) => (
                <li key={t} className="tabular rounded-sm border border-rule-strong px-2 py-1 text-sm">
                  <time dateTime={t}>{formatDateTime(t)}</time>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-1 text-sm text-fg-muted">Save the schedule to see upcoming runs.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
