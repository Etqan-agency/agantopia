"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CreateTaskInput, SPECIALTIES, SPECIALTY_LABEL, TASK_PRIORITIES, type TaskPriority } from "@agentopia/shared";
import { PRIORITY_LABEL } from "@/components/task-status";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SwitchField } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toaster";
import { useCreateTask, useEmployees, useProjects } from "@/hooks/use-api";
import { errorMessage } from "@/lib/utils";

const NONE = "__none";

type Errors = Partial<Record<"title" | "description" | "maxCostUsd" | "assigneeId" | "form", string>>;

export function NewTaskDialog({ companyId, isDemo }: { companyId: string; isDemo?: boolean }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const create = useCreateTask(companyId);
  const projects = useProjects(open ? companyId : null);
  const employees = useEmployees(open ? companyId : null, { status: "ACTIVE" });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("NORMAL");
  const [projectId, setProjectId] = useState(NONE);
  const [specialty, setSpecialty] = useState(NONE);
  const [maxCost, setMaxCost] = useState("");
  const [submitToManager, setSubmitToManager] = useState(true);
  const [assigneeId, setAssigneeId] = useState<string | undefined>(undefined);
  const [errors, setErrors] = useState<Errors>({});

  function reset() {
    setTitle("");
    setDescription("");
    setPriority("NORMAL");
    setProjectId(NONE);
    setSpecialty(NONE);
    setMaxCost("");
    setSubmitToManager(true);
    setAssigneeId(undefined);
    setErrors({});
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next: Errors = {};
    const cost = maxCost.trim() === "" ? undefined : Number(maxCost);
    if (cost !== undefined && Number.isNaN(cost)) next.maxCostUsd = "Enter a number in US dollars, for example 0.50.";
    if (!submitToManager && !assigneeId) next.assigneeId = "Choose who should do this task, or send it to the manager.";
    const parsed = CreateTaskInput.safeParse({
      title,
      description,
      priority,
      projectId: projectId === NONE ? undefined : projectId,
      requiredSpecialty: specialty === NONE ? undefined : specialty,
      maxCostUsd: cost,
      submitToManager,
      assigneeId: submitToManager ? undefined : assigneeId,
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === "title") next.title = "Write a title between 3 and 200 characters.";
        else if (key === "description") next.description = "Describe the task in at least 3 characters.";
        else if (key === "maxCostUsd") next.maxCostUsd = "Max cost must be between $0 and $100.";
        else next.form = issue.message;
      }
    }
    setErrors(next);
    if (Object.keys(next).length || !parsed.success) return;
    create.mutate(parsed.data, {
      onSuccess: (task) => {
        toast.success("Task created", { description: submitToManager ? "The manager will plan and assign it." : undefined });
        setOpen(false);
        reset();
        if (task?.id) router.push(`/tasks/${task.id}`);
      },
      onError: (err) => setErrors({ form: errorMessage(err, "The task was not created.") }),
    });
  }

  const employeeOptions = (employees.data ?? []).map((e) => ({ value: e.id, label: `${e.name}, ${e.title}` }));

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setErrors({});
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden />
          New task
        </Button>
      </DialogTrigger>
      <DialogContent
        title="New task"
        description={isDemo ? "This is a demo company: the task will run on the simulated provider." : "Describe the outcome you want. The manager plans and delegates unless you assign it directly."}
        className="max-w-xl"
      >
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
          <FormField label="Title" error={errors.title}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} autoComplete="off" required />
          </FormField>
          <FormField label="Description" error={errors.description} hint="Include the deliverable and how you will judge it done.">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} required />
          </FormField>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="Priority">
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as TaskPriority)}
                options={TASK_PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))}
              />
            </FormField>
            <FormField label="Project" optional>
              <Select
                value={projectId}
                onValueChange={setProjectId}
                options={[{ value: NONE, label: "No project" }, ...(projects.data ?? []).map((p) => ({ value: p.id, label: p.name }))]}
              />
            </FormField>
            <FormField label="Required specialty" optional hint="Leave empty to let the manager infer it.">
              <Select
                value={specialty}
                onValueChange={setSpecialty}
                options={[{ value: NONE, label: "Any specialty" }, ...SPECIALTIES.map((s) => ({ value: s, label: SPECIALTY_LABEL[s] }))]}
              />
            </FormField>
            <FormField label="Max cost (USD)" optional error={errors.maxCostUsd} hint="Execution stops when this is reached.">
              <Input value={maxCost} onChange={(e) => setMaxCost(e.target.value)} inputMode="decimal" placeholder="1.00" />
            </FormField>
          </div>
          <SwitchField
            label="Send to the manager"
            description="The manager plans the work, splits it into subtasks if needed, and assigns the best-fit employee."
            checked={submitToManager}
            onCheckedChange={setSubmitToManager}
            className="border-y border-rule"
          />
          {submitToManager ? null : (
            <FormField label="Assignee" error={errors.assigneeId}>
              <Select
                value={assigneeId}
                onValueChange={setAssigneeId}
                placeholder={employees.isLoading ? "Loading employees…" : "Choose an employee"}
                options={employeeOptions}
                disabled={employees.isLoading || !employeeOptions.length}
              />
            </FormField>
          )}
          {errors.form ? (
            <p role="alert" className="text-sm font-medium text-brick-ink">
              {errors.form}
            </p>
          ) : null}
          <DialogFooter className="mt-0">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" pending={create.isPending}>
              Create task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
