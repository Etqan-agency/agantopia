"use client";

import { Trash } from "lucide-react";
import { useState, type FormEvent } from "react";
import { CreateLearningSourceInput, SPECIALTIES, SPECIALTY_LABEL, type Specialty } from "@agentopia/shared";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SpecialtyBadge } from "@/components/specialty";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SectionHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { SkeletonRows } from "@/components/ui/skeleton";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { toast } from "@/components/ui/toaster";
import type { LearningSourceView } from "@/hooks/api-shapes";
import { useCreateSource, useDeleteSource, useLearningSources } from "@/hooks/use-api";
import { errorMessage, formatRelative } from "@/lib/utils";

/**
 * The learning allowlist. Pass `employeeId` to scope the list and new sources
 * to one employee (employee profile), or leave it out for the company list.
 */
export function SourcesSection({ companyId, employeeId, defaultSpecialty }: { companyId: string; employeeId?: string; defaultSpecialty?: Specialty }) {
  const q = useLearningSources(companyId);
  const sources = (q.data ?? []).filter((s) => (employeeId ? s.employeeId === employeeId || s.employeeId === null : true));

  return (
    <section aria-labelledby={`sources-h-${employeeId ?? "c"}`} className="flex flex-col">
      <SectionHeader
        title={<span id={`sources-h-${employeeId ?? "c"}`}>Sources</span>}
        description="Only these documentation sites and repositories are ever read. Their content is treated as data, never as instructions."
      />
      <AddSourceForm companyId={companyId} employeeId={employeeId} defaultSpecialty={defaultSpecialty} />
      {q.isLoading ? (
        <SkeletonRows rows={3} label="Loading sources" />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : sources.length === 0 ? (
        <EmptyState title="No sources yet" description="Add an official docs URL or a GitHub repository for a specialty." />
      ) : (
        <SourcesTable companyId={companyId} sources={sources} />
      )}
    </section>
  );
}

function SourcesTable({ companyId, sources }: { companyId: string; sources: LearningSourceView[] }) {
  const del = useDeleteSource(companyId);
  const remove = async (s: LearningSourceView) => {
    try {
      await del.mutateAsync(s.id);
      toast.success(`Removed ${s.title}`);
    } catch (err) {
      toast.error("Remove failed", { description: errorMessage(err) });
    }
  };
  const removeButton = (s: LearningSourceView) => (
    <ConfirmDialog
      trigger={
        <Button size="icon-sm" variant="ghost" aria-label={`Remove ${s.title}`}>
          <Trash aria-hidden />
        </Button>
      }
      title={`Remove ${s.title}?`}
      description="Employees stop learning from it. Notes already verified from this source are kept."
      confirmLabel="Remove source"
      onConfirm={() => remove(s)}
    />
  );
  return (
    <>
      <div className="hidden min-[900px]:block">
        <Table>
          <THead>
            <TR>
              <TH>Source</TH>
              <TH>Kind</TH>
              <TH>Specialty</TH>
              <TH>Topics</TH>
              <TH>Last checked</TH>
              <TH>
                <span className="sr-only">Actions</span>
              </TH>
            </TR>
          </THead>
          <TBody>
            {sources.map((s) => (
              <TR key={s.id}>
                <TD className="max-w-80">
                  <div className="flex flex-col">
                    <span className="font-medium">{s.title}</span>
                    <a href={s.url} target="_blank" rel="noreferrer noopener" className="truncate text-xs text-sky-ink underline-offset-2 hover:underline">
                      {s.url}
                    </a>
                  </div>
                </TD>
                <TD>
                  <Badge tone="outline">{s.kind === "GITHUB" ? "GitHub" : "Docs"}</Badge>
                </TD>
                <TD>
                  <SpecialtyBadge specialty={s.specialty} />
                </TD>
                <TD className="max-w-56 text-xs text-fg-muted">{s.topics.join(", ") || "-"}</TD>
                <TD className="text-xs whitespace-nowrap text-fg-muted">{s.lastFetchedAt ? formatRelative(s.lastFetchedAt) : "Not yet"}</TD>
                <TD className="text-right">{removeButton(s)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
      <ul className="flex flex-col divide-y divide-rule border-y border-rule min-[900px]:hidden">
        {sources.map((s) => (
          <li key={s.id} className="flex items-start gap-3 py-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="font-medium">{s.title}</span>
              <a href={s.url} target="_blank" rel="noreferrer noopener" className="truncate text-xs text-sky-ink">
                {s.url}
              </a>
              <span className="flex flex-wrap gap-1.5">
                <Badge tone="outline">{s.kind === "GITHUB" ? "GitHub" : "Docs"}</Badge>
                <SpecialtyBadge specialty={s.specialty} />
              </span>
            </div>
            {removeButton(s)}
          </li>
        ))}
      </ul>
    </>
  );
}

function AddSourceForm({ companyId, employeeId, defaultSpecialty }: { companyId: string; employeeId?: string; defaultSpecialty?: Specialty }) {
  const create = useCreateSource(companyId);
  const [kind, setKind] = useState<"DOCS" | "GITHUB">("DOCS");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [specialty, setSpecialty] = useState<Specialty>(defaultSpecialty ?? "FRONTEND");
  const [topics, setTopics] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = CreateLearningSourceInput.safeParse({
      employeeId: employeeId ?? null,
      kind,
      url: url.trim(),
      title: title.trim(),
      specialty,
      topics: topics
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });
    const next: Record<string, string> = {};
    if (kind === "GITHUB" && url && !/^https:\/\/github\.com\/[^/]+\/[^/]+/.test(url.trim())) next.url = "Use a repository URL like https://github.com/owner/repo.";
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!next[key]) next[key] = key === "url" ? "Enter a full URL starting with https://." : key === "title" ? "Give the source a name." : issue.message;
      }
    }
    setErrors(next);
    if (!parsed.success || Object.keys(next).length) return;
    try {
      await create.mutateAsync(parsed.data);
      toast.success(`Added ${parsed.data.title}`);
      setUrl("");
      setTitle("");
      setTopics("");
    } catch (err) {
      setErrors({ form: errorMessage(err) });
    }
  }

  return (
    <form onSubmit={submit} noValidate className="mb-6 grid gap-4 border-y border-rule bg-surface-sunken/40 px-4 py-4 sm:grid-cols-2 min-[1100px]:grid-cols-[9rem_minmax(0,2fr)_minmax(0,1fr)_10rem_minmax(0,1fr)_auto] min-[1100px]:items-start">
      <FormField label="Kind">
        <Select
          value={kind}
          onValueChange={(v) => setKind(v as "DOCS" | "GITHUB")}
          options={[
            { value: "DOCS", label: "Docs site" },
            { value: "GITHUB", label: "GitHub repo" },
          ]}
        />
      </FormField>
      <FormField label="URL" error={errors.url}>
        <Input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={kind === "GITHUB" ? "https://github.com/owner/repo" : "https://react.dev/reference"} spellCheck={false} />
      </FormField>
      <FormField label="Name" error={errors.title}>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="React reference" maxLength={80} />
      </FormField>
      <FormField label="Specialty">
        <Select value={specialty} onValueChange={(v) => setSpecialty(v as Specialty)} options={SPECIALTIES.map((s) => ({ value: s, label: SPECIALTY_LABEL[s] }))} />
      </FormField>
      <FormField label="Topics" optional hint="Comma separated" error={errors.topics}>
        <Input value={topics} onChange={(e) => setTopics(e.target.value)} placeholder="hooks, server components" />
      </FormField>
      <div className="flex flex-col gap-1.5 sm:col-span-2 min-[1100px]:col-span-1">
        <span aria-hidden className="hidden text-sm min-[1100px]:block">
          &nbsp;
        </span>
        <Button type="submit" variant="secondary" pending={create.isPending}>
          Add source
        </Button>
      </div>
      {errors.form ? (
        <p role="alert" className="text-sm font-medium text-brick-ink sm:col-span-2 min-[1100px]:col-span-6">
          {errors.form}
        </p>
      ) : null}
    </form>
  );
}
