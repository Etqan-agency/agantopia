"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

/** Explains that real execution needs an account (visitor demo only). */
export function DemoAccountDialog({ open, action, onClose }: { open: boolean; action: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby="demo-account-title"
      onClose={onClose}
      onCancel={onClose}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-rule bg-surface-raised p-5 text-fg backdrop:bg-ink/50"
    >
      <h2 id="demo-account-title" className="text-lg font-semibold">
        {action} needs an account
      </h2>
      <p className="mt-2 text-sm text-fg-muted">
        Everything in this demo building is simulated in your browser: no AI provider is called and no work is done. To give real tasks to
        your own employees, create an account and connect a provider (Claude or Codex) during onboarding.
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="min-h-10 rounded-md px-3 text-sm font-medium hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-focus">
          Keep exploring
        </button>
        <Link
          href="/signup?next=/onboarding"
          className="inline-flex min-h-10 items-center rounded-md bg-fg px-4 text-sm font-medium text-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          Create an account
        </Link>
      </div>
    </dialog>
  );
}
