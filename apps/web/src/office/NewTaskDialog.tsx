"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CreateTaskInput, SPECIALTIES, SPECIALTY_LABEL, TASK_PRIORITIES } from "@agentopia/shared";

/** Minimal accessible dialog that posts a CreateTaskInput. */
export function NewTaskDialog({
  open,
  companyId,
  onClose,
  onCreated,
}: {
  open: boolean;
  companyId: string;
  onClose: () => void;
  onCreated?: (taskId: string | null) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setError(null);
      d.showModal();
    } else if (!open && d.open) d.close();
  }, [open]);

  async function submit(form: HTMLFormElement) {
    const fd = new FormData(form);
    const raw = {
      title: String(fd.get("title") ?? ""),
      description: String(fd.get("description") ?? ""),
      priority: String(fd.get("priority") ?? "NORMAL"),
      requiredSpecialty: fd.get("specialty") ? String(fd.get("specialty")) : undefined,
      submitToManager: fd.get("submitToManager") === "on",
    };
    const parsed = CreateTaskInput.safeParse(raw);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      setError(first ? `${first.path.join(".") || "Input"}: ${first.message}` : "Please check the form.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/companies/${encodeURIComponent(companyId)}/tasks`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = (await res.json().catch(() => null)) as { id?: string; task?: { id?: string }; error?: { message?: string } } | null;
      if (!res.ok) throw new Error(body?.error?.message ?? `Request failed (${res.status})`);
      form.reset();
      onCreated?.(body?.id ?? body?.task?.id ?? null);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the task.");
    } finally {
      setBusy(false);
    }
  }

  const field = "mt-1 w-full rounded-md border border-rule-strong bg-surface px-2.5 py-2 text-sm focus-visible:outline-2 focus-visible:outline-focus";
  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-title`}
      onClose={onClose}
      onCancel={onClose}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-rule bg-surface-raised p-0 text-fg backdrop:bg-ink/50"
    >
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(e.currentTarget);
        }}
        className="flex flex-col gap-3 p-5"
      >
        <h2 id={`${id}-title`} className="text-lg font-semibold">
          New task
        </h2>
        <label className="text-sm font-medium">
          Title
          <input name="title" required minLength={3} maxLength={200} className={field} autoFocus />
        </label>
        <label className="text-sm font-medium">
          Description
          <textarea name="description" required minLength={3} rows={4} className={field} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm font-medium">
            Priority
            <select name="priority" defaultValue="NORMAL" className={field}>
              {TASK_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p.charAt(0) + p.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Specialty
            <select name="specialty" defaultValue="" className={field}>
              <option value="">Any</option>
              {SPECIALTIES.map((s) => (
                <option key={s} value={s}>
                  {SPECIALTY_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="submitToManager" defaultChecked className="size-4 accent-violet" />
          Route through the manager (plan and delegate)
        </label>
        {error ? (
          <p role="alert" className="rounded-md bg-brick-wash px-3 py-2 text-sm text-brick-ink">
            {error}
          </p>
        ) : null}
        <div className="mt-1 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="min-h-10 rounded-md px-3 text-sm font-medium hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-focus">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="min-h-10 rounded-md bg-fg px-4 text-sm font-medium text-surface disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {busy ? "Creating…" : "Create task"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
