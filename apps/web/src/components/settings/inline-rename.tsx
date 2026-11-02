"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { errorMessage } from "@/lib/utils";

/** A name with a Rename button that turns into an inline form. */
export function InlineRename({
  value,
  label,
  onSave,
  display,
}: {
  value: string;
  /** Accessible name of the field, e.g. "Floor name". */
  label: string;
  onSave: (name: string) => Promise<unknown>;
  display?: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const name = draft.trim();
    if (!name || name.length > 80) {
      setError("Use 1 to 80 characters.");
      return;
    }
    setPending(true);
    try {
      await onSave(name);
      toast.success("Renamed", { description: name });
      setEditing(false);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  if (!editing) {
    return (
      <span className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 truncate">{display ?? value}</span>
        <Button
          size="sm"
          variant="link"
          onClick={() => {
            setDraft(value);
            setEditing(true);
          }}
          aria-label={`Rename ${value}`}
        >
          Rename
        </Button>
      </span>
    );
  }
  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2" noValidate>
      <Input
        aria-label={label}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        autoFocus
        maxLength={80}
        className="h-9 w-56"
        aria-invalid={error ? true : undefined}
        onKeyDown={(e) => {
          if (e.key === "Escape") setEditing(false);
        }}
      />
      <Button size="sm" type="submit" pending={pending}>
        Save
      </Button>
      <Button size="sm" type="button" variant="ghost" onClick={() => setEditing(false)}>
        Cancel
      </Button>
      {error ? (
        <span role="alert" className="w-full text-xs font-medium text-brick-ink">
          {error}
        </span>
      ) : null}
    </form>
  );
}
