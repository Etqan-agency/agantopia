"use client";

import { CreateKnowledgeInput, type KnowledgeStatus } from "@agentopia/shared";
import { Check, Trash, X } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadMore } from "@/components/ui/load-more";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SectionHeader } from "@/components/ui/page-header";
import { SkeletonRows } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toaster";
import type { EmployeeDetail, KnowledgeEntryView } from "@/hooks/api-shapes";
import { useCreateKnowledge, useDecideKnowledge, useDeleteKnowledge, useKnowledge } from "@/hooks/use-api";
import { errorMessage, formatDateTime } from "@/lib/utils";

const KIND_LABEL: Record<string, string> = {
  OWNER_INSTRUCTION: "Owner instruction",
  PROJECT_DOC: "Project document",
  LEARNED_NOTE: "Learned note",
  TASK_LESSON: "Task lesson",
};

const GROUPS: Array<{ value: string; label: string; statuses: KnowledgeStatus[] }> = [
  { value: "verified", label: "Verified", statuses: ["VERIFIED"] },
  { value: "draft", label: "Drafts", statuses: ["DRAFT"] },
  { value: "rejected", label: "Rejected", statuses: ["REJECTED", "EXPIRED", "STALE"] },
];

export function KnowledgeTab({ companyId, employee }: { companyId: string; employee: EmployeeDetail }) {
  const knowledge = useKnowledge(companyId, { employeeId: employee.id });
  const entries = (knowledge.data ?? []).filter((k) => k.status !== "DELETED");

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Knowledge"
        description="Only verified entries are retrieved into this employee's prompts, always as data and never as instructions to obey blindly."
        className="border-b border-rule"
        actions={<AddInstructionDialog companyId={companyId} employee={employee} />}
      />
      {knowledge.isLoading ? (
        <SkeletonRows rows={4} label="Loading knowledge" />
      ) : knowledge.isError ? (
        <ErrorState title="Knowledge could not be loaded" error={knowledge.error} onRetry={() => knowledge.refetch()} />
      ) : (
        <Tabs defaultValue="verified">
          <TabsList aria-label="Knowledge by status">
            {GROUPS.map((g) => (
              <TabsTrigger key={g.value} value={g.value}>
                {g.label}
                <span className="tabular text-xs text-fg-muted">{entries.filter((e) => g.statuses.includes(e.status)).length}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          {GROUPS.map((g) => {
            const list = entries.filter((e) => g.statuses.includes(e.status));
            return (
              <TabsContent key={g.value} value={g.value}>
                {!list.length ? (
                  <EmptyState
                    title={g.value === "verified" ? "No verified knowledge yet" : g.value === "draft" ? "No drafts waiting" : "Nothing rejected"}
                    description={
                      g.value === "verified"
                        ? "Add an owner instruction, or approve drafts produced by learning runs."
                        : g.value === "draft"
                          ? "Learning runs and task lessons create drafts here for your approval."
                          : undefined
                    }
                  />
                ) : (
                  <ul className="divide-y divide-rule border-y border-rule">
                    {list.map((k) => (
                      <KnowledgeItem key={k.id} companyId={companyId} entry={k} />
                    ))}
                  </ul>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      )}
      <LoadMore query={knowledge} shown={knowledge.data?.length ?? 0} noun="entries" />
    </div>
  );
}

function KnowledgeItem({ companyId, entry: k }: { companyId: string; entry: KnowledgeEntryView }) {
  const del = useDeleteKnowledge(companyId);
  const decide = useDecideKnowledge(companyId);
  async function onDecide(decision: "APPROVED" | "REJECTED") {
    try {
      await decide.mutateAsync({ id: k.id, decision });
      toast.success(decision === "APPROVED" ? "Knowledge approved" : "Knowledge rejected");
    } catch (err) {
      toast.error("The decision could not be saved", { description: errorMessage(err) });
    }
  }
  return (
    <li className="flex flex-col gap-2 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
            {k.title}
            <Badge tone="outline">{KIND_LABEL[k.kind] ?? k.kind}</Badge>
            {k.status === "DRAFT" ? <span className="tabular text-xs font-normal text-fg-muted">Confidence {Math.round(k.confidence * 100)}%</span> : null}
          </span>
          <span className="text-xs text-fg-muted">
            {k.sourceUrl ? (
              <a href={k.sourceUrl} target="_blank" rel="noreferrer" className="text-sky-ink hover:underline">
                {k.sourceUrl}
              </a>
            ) : (
              "Added by the owner"
            )}
            {k.retrievedAt ? `, retrieved ${formatDateTime(k.retrievedAt)}` : `, ${formatDateTime(k.createdAt)}`}
          </span>
        </div>
        <div className="flex gap-1">
          {k.status === "DRAFT" ? (
            <>
              <Button size="sm" variant="secondary" onClick={() => onDecide("APPROVED")} disabled={decide.isPending}>
                <Check aria-hidden />
                Approve
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onDecide("REJECTED")} disabled={decide.isPending}>
                <X aria-hidden />
                Reject
              </Button>
            </>
          ) : null}
          <ConfirmDialog
            trigger={
              <Button size="icon-sm" variant="ghost" aria-label={`Delete ${k.title}`}>
                <Trash aria-hidden />
              </Button>
            }
            title="Delete this knowledge entry?"
            description="It will no longer be retrieved into any prompt."
            confirmLabel="Delete entry"
            onConfirm={async () => {
              try {
                await del.mutateAsync(k.id);
                toast.success("Entry deleted");
              } catch (err) {
                toast.error("The entry could not be deleted", { description: errorMessage(err) });
              }
            }}
          />
        </div>
      </div>
      <p className="line-clamp-4 max-w-prose text-sm leading-relaxed whitespace-pre-line text-fg-muted">{k.content}</p>
    </li>
  );
}

function AddInstructionDialog({ companyId, employee }: { companyId: string; employee: EmployeeDetail }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [errors, setErrors] = useState<{ title?: string; content?: string; form?: string }>({});
  const create = useCreateKnowledge(companyId);

  async function submit() {
    const parsed = CreateKnowledgeInput.safeParse({ employeeId: employee.id, kind: "OWNER_INSTRUCTION", title, content });
    if (!parsed.success) {
      const e: typeof errors = {};
      for (const i of parsed.error.issues) {
        if (i.path[0] === "title") e.title = "Enter a title between 1 and 80 characters.";
        else if (i.path[0] === "content") e.content = "Write the instruction (up to 20,000 characters).";
        else e.form = i.message;
      }
      setErrors(e);
      return;
    }
    try {
      await create.mutateAsync(parsed.data);
      toast.success("Instruction added", { description: "Owner instructions are verified immediately." });
      setOpen(false);
      setTitle("");
      setContent("");
      setErrors({});
    } catch (err) {
      setErrors({ form: errorMessage(err, "The instruction could not be added.") });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">Add instruction</Button>
      </DialogTrigger>
      <DialogContent
        title={`Add an instruction for ${employee.name}`}
        description="Owner instructions are verified immediately and retrieved when relevant to a task."
      >
        <div className="flex flex-col gap-4">
          {errors.form ? (
            <p role="alert" className="text-sm text-brick-ink">
              {errors.form}
            </p>
          ) : null}
          <FormField label="Title" error={errors.title}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
          </FormField>
          <FormField label="Instruction" error={errors.content}>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={6} />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} pending={create.isPending}>
            Add instruction
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
