"use client";

import { Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SectionHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { SkeletonRows } from "@/components/ui/skeleton";
import { useEmployees, useMemorySearch } from "@/hooks/use-api";
import { formatDate } from "@/lib/utils";

const KIND: Record<string, string> = {
  OWNER_INSTRUCTION: "Owner instruction",
  PROJECT_DOC: "Project doc",
  LEARNED_NOTE: "Learned note",
  TASK_LESSON: "Task lesson",
};

const clip = (t: string) => (t.length > 500 ? `${t.slice(0, 500)}…` : t);

/** Shows exactly what an employee would retrieve for a query, with citations. */
export function RetrievalTester({ companyId }: { companyId: string }) {
  const employees = useEmployees(companyId);
  const [q, setQ] = useState("");
  const [employeeId, setEmployeeId] = useState<string>("all");
  const [params, setParams] = useState<{ q: string; employeeId?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const search = useMemorySearch(companyId, params);

  function submit(e: FormEvent) {
    e.preventDefault();
    const query = q.trim();
    if (!query) {
      setError("Type what an employee might be looking for.");
      return;
    }
    setError(null);
    setParams({ q: query, employeeId: employeeId === "all" ? undefined : employeeId });
  }

  const hits = search.data ?? [];
  return (
    <section aria-labelledby="tester-h" className="flex flex-col">
      <SectionHeader
        title={<span id="tester-h">Retrieval tester</span>}
        description="Run the same search employees use before a task. Only verified entries visible to that employee are returned."
      />
      <form onSubmit={submit} noValidate className="flex flex-wrap items-end gap-3 pb-5">
        <FormField label="Query" error={error} className="min-w-64 flex-[2]">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="How do we handle form validation?" maxLength={300} />
        </FormField>
        <FormField label="As employee" className="min-w-52 flex-1">
          <Select
            value={employeeId}
            onValueChange={setEmployeeId}
            options={[{ value: "all", label: "Company-wide only" }, ...(employees.data ?? []).map((e) => ({ value: e.id, label: e.name }))]}
          />
        </FormField>
        <Button type="submit" variant="secondary">
          <Search aria-hidden />
          Search memory
        </Button>
      </form>
      <div aria-live="polite">
        {!params ? null : search.isLoading ? (
          <SkeletonRows rows={3} label="Searching" />
        ) : search.error ? (
          <ErrorState error={search.error} onRetry={() => search.refetch()} />
        ) : hits.length === 0 ? (
          <EmptyState title="No verified knowledge matches" description="Try other words, or approve drafts from the queue so they become searchable." />
        ) : (
          <ol className="flex flex-col border-t border-rule">
            {hits.map((h, i) => (
              <li key={h.id} className="flex gap-4 border-b border-rule py-4">
                <span className="tabular w-6 shrink-0 pt-0.5 text-sm text-fg-muted">{i + 1}</span>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{h.title}</span>
                    <Badge tone="outline">{KIND[h.kind] ?? h.kind}</Badge>
                    {typeof (h.score ?? h.rank) === "number" ? (
                      <span className="tabular text-xs text-fg-muted">score {(h.score ?? h.rank ?? 0).toFixed(3)}</span>
                    ) : null}
                  </div>
                  <p className="max-w-prose text-sm leading-relaxed whitespace-pre-line">{clip(h.excerpt ?? h.content ?? "")}</p>
                  <p className="text-xs text-fg-muted">
                    {h.sourceUrl ? (
                      <>
                        Cited from{" "}
                        <a href={h.sourceUrl} target="_blank" rel="noreferrer noopener" className="break-all text-sky-ink underline-offset-2 hover:underline">
                          {h.sourceUrl}
                        </a>
                        {h.retrievedAt ? `, retrieved ${formatDate(h.retrievedAt)}` : ""}
                      </>
                    ) : (
                      "No external source; written inside Agentopia."
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
