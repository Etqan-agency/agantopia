"use client";

import { useState, type ReactElement, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";

/**
 * Confirmation for destructive or irreversible actions. The confirm button
 * repeats the action's name ("Archive floor"), never "OK".
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  onConfirm,
  tone = "danger",
  children,
}: {
  /** A single element that forwards props and ref (e.g. a Button): it becomes the Radix trigger. */
  trigger: ReactElement;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  onConfirm: () => Promise<unknown> | void;
  tone?: "danger" | "primary";
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  async function confirm() {
    setPending(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={title} description={description}>
        {children}
        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Keep it
          </Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} onClick={confirm} pending={pending}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
