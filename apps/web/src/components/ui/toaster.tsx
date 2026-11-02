"use client";

import { Toaster as Sonner } from "sonner";

/** Sonner renders its own aria-live region; toasts are announced politely. */
export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "!rounded-md !border !border-rule-strong !bg-surface-raised !text-fg !font-sans !shadow-[0_12px_32px_-16px_rgb(0_0_0/0.35)]",
          description: "!text-fg-muted",
          error: "!border-l-4 !border-l-gold",
          success: "!border-l-4 !border-l-purple",
        },
      }}
    />
  );
}

export { toast } from "sonner";
