"use client";

import { PROMPT_FIELD_ORDER, PromptFieldsSchema, type PromptFields } from "@agentopia/shared";
import { RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { SkeletonRows } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toaster";
import type { EmployeeDetail, PromptVersion } from "@/hooks/api-shapes";
import { useCreatePromptVersion, usePromptVersions, useRollbackPrompt } from "@/hooks/use-api";
import { cn, errorMessage, formatDateTime } from "@/lib/utils";
import { diffStats, lineDiff } from "./line-diff";

const EMPTY: PromptFields = PromptFieldsSchema.parse({});

function fieldsOf(v: PromptVersion | null | undefined): PromptFields {
  return { ...EMPTY, ...((v?.fields as Partial<PromptFields> | undefined) ?? {}) };
}

export function PromptTab({ companyId, employee }: { companyId: string; employee: EmployeeDetail }) {
  const versions = usePromptVersions(companyId, employee.id);
  return (
    <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_20rem]">
      {/* Remount the editor whenever the current version changes so it shows the saved text. */}
      <PromptEditor key={employee.currentPromptVersion} companyId={companyId} employee={employee} />
      <aside className="flex flex-col gap-10">
        <VersionList
          companyId={companyId}
          employeeId={employee.id}
          current={employee.currentPromptVersion}
          query={versions}
        />
      </aside>
      <div className="xl:col-span-2">
        <VersionDiff versions={versions.data ?? []} current={employee.currentPromptVersion} />
      </div>
    </div>
  );
}

function PromptEditor({ companyId, employee }: { companyId: string; employee: EmployeeDetail }) {
  const saved = useMemo(() => fieldsOf(employee.prompt), [employee.prompt]);
  const [fields, setFields] = useState<PromptFields>(saved);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Partial<Record<keyof PromptFields, string>>>({});
  const create = useCreatePromptVersion(companyId, employee.id);
  const dirty = PROMPT_FIELD_ORDER.some(({ key }) => fields[key] !== saved[key]);

  async function save() {
    const parsed = PromptFieldsSchema.safeParse(fields);
    if (!parsed.success) {
      const next: typeof errors = {};
      for (const i of parsed.error.issues) {
        const k = i.path[0] as keyof PromptFields;
        next[k] = "This field is too long.";
      }
      setErrors(next);
      return;
    }
    setErrors({});
    try {
      const v = await create.mutateAsync({ fields: parsed.data, note: note.trim() || undefined });
      toast.success(`Prompt saved as version ${v?.version ?? employee.currentPromptVersion + 1}`);
      setNote("");
    } catch (err) {
      toast.error("The prompt could not be saved", { description: errorMessage(err) });
    }
  }

  return (
    <section className="flex flex-col gap-5">
      <SectionHeader
        title="Structured prompt"
        description="Eleven fields compiled into this employee's system prompt. Every save creates a new version; nothing is overwritten."
        className="border-b border-rule"
      />
      {PROMPT_FIELD_ORDER.map(({ key, label }) => (
        <FormField key={key} label={label} error={errors[key]}>
          <Textarea
            value={fields[key]}
            onChange={(e) => setFields((f) => ({ ...f, [key]: e.target.value }))}
            rows={key === "identity" || key === "scope" ? 2 : 4}
            className={cn(fields[key] !== saved[key] && "border-saffron-ink/60")}
          />
        </FormField>
      ))}
      <div className="sticky bottom-20 z-10 flex flex-wrap items-end gap-3 border-t border-rule bg-surface py-4 min-[900px]:bottom-0">
        <FormField label="Change note" optional className="min-w-56 flex-1">
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="What changed and why" />
        </FormField>
        <Button variant="secondary" onClick={() => setFields(saved)} disabled={!dirty}>
          Discard edits
        </Button>
        <Button onClick={save} disabled={!dirty} pending={create.isPending}>
          Save new version
        </Button>
      </div>
    </section>
  );
}

function VersionList({
  companyId,
  employeeId,
  current,
  query,
}: {
  companyId: string;
  employeeId: string;
  current: number;
  query: ReturnType<typeof usePromptVersions>;
}) {
  const rollback = useRollbackPrompt(companyId, employeeId);
  return (
    <section>
      <SectionHeader title="Versions" className="border-b border-rule" />
      {query.isLoading ? (
        <SkeletonRows rows={3} label="Loading versions" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : !query.data?.length ? (
        <EmptyState title="No versions yet" description="Saving the prompt creates version 1." />
      ) : (
        <ol className="divide-y divide-rule">
          {query.data.map((v) => (
            <li key={v.id} className="flex items-start justify-between gap-3 py-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="flex items-center gap-2 text-sm font-medium">
                  Version {v.version}
                  {v.version === current ? <Badge tone="moss">Current</Badge> : null}
                </span>
                <time className="text-xs text-fg-muted" dateTime={v.createdAt}>
                  {formatDateTime(v.createdAt)}
                </time>
                {v.note ? <p className="text-xs text-fg-muted">{v.note}</p> : null}
              </div>
              {v.version !== current ? (
                <ConfirmDialog
                  tone="primary"
                  trigger={
                    <Button size="sm" variant="ghost" aria-label={`Roll back to version ${v.version}`}>
                      <RotateCcw aria-hidden />
                      Roll back
                    </Button>
                  }
                  title={`Roll back to version ${v.version}?`}
                  description={`This creates a new version that copies version ${v.version}. The current version stays in the history.`}
                  confirmLabel="Roll back"
                  onConfirm={async () => {
                    try {
                      await rollback.mutateAsync(v.version);
                      toast.success(`Rolled back to version ${v.version}`);
                    } catch (err) {
                      toast.error("Rollback failed", { description: errorMessage(err) });
                    }
                  }}
                />
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function VersionDiff({ versions, current }: { versions: PromptVersion[]; current: number }) {
  const options = versions.map((v) => ({ value: String(v.version), label: `Version ${v.version}${v.version === current ? " (current)" : ""}` }));
  const [from, setFrom] = useState<string | undefined>(undefined);
  const [to, setTo] = useState<string | undefined>(undefined);
  const toV = to ?? (versions[0] ? String(versions[0].version) : undefined);
  const fromV = from ?? (versions[1] ? String(versions[1].version) : undefined);
  const a = versions.find((v) => String(v.version) === fromV);
  const b = versions.find((v) => String(v.version) === toV);

  if (versions.length < 2) {
    return (
      <section>
        <SectionHeader title="Compare versions" className="border-b border-rule" />
        <p className="text-sm text-fg-muted">A comparison appears once there are two versions.</p>
      </section>
    );
  }

  const fa = fieldsOf(a);
  const fb = fieldsOf(b);
  const changed = PROMPT_FIELD_ORDER.map(({ key, label }) => ({ key, label, lines: lineDiff(fa[key], fb[key]) })).filter(
    (f) => fa[f.key] !== fb[f.key],
  );

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader title="Compare versions" className="border-b border-rule" />
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex w-52 flex-col gap-1.5">
          <Label htmlFor="diff-from">From</Label>
          <Select id="diff-from" value={fromV} onValueChange={setFrom} options={options} />
        </div>
        <div className="flex w-52 flex-col gap-1.5">
          <Label htmlFor="diff-to">To</Label>
          <Select id="diff-to" value={toV} onValueChange={setTo} options={options} />
        </div>
      </div>
      {!changed.length ? (
        <p className="text-sm text-fg-muted">These versions are identical.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {changed.map((f) => {
            const s = diffStats(f.lines);
            return (
              <div key={f.key} className="flex flex-col gap-2">
                <h3 className="flex items-baseline gap-3 text-sm font-medium">
                  {f.label}
                  <span className="tabular text-xs font-normal text-fg-muted">
                    {s.added} added, {s.removed} removed
                  </span>
                </h3>
                <pre className="overflow-x-auto rounded-md border border-rule bg-surface-raised py-2 text-xs leading-relaxed whitespace-pre-wrap">
                  {f.lines.map((l, i) => (
                    <div
                      key={i}
                      className={cn(
                        "px-3",
                        l.kind === "add" && "bg-moss-wash text-moss-ink",
                        l.kind === "remove" && "bg-brick-wash text-brick-ink line-through decoration-brick-ink/40",
                      )}
                    >
                      <span aria-hidden className="mr-2 inline-block w-3 select-none">
                        {l.kind === "add" ? "+" : l.kind === "remove" ? "−" : " "}
                      </span>
                      <span className="sr-only">{l.kind === "add" ? "Added: " : l.kind === "remove" ? "Removed: " : ""}</span>
                      {l.text || " "}
                    </div>
                  ))}
                </pre>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
