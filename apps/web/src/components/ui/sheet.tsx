"use client";

import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { DialogOverlay } from "./dialog";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

/** Right-side drawer for longer forms (hiring, editing). */
export function SheetContent({
  className,
  children,
  title,
  description,
  footer,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & { title: ReactNode; description?: ReactNode; footer?: ReactNode }) {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-rule-strong bg-surface-raised text-fg shadow-[-24px_0_64px_-32px_rgb(0_0_0/0.4)] data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:animate-in data-[state=open]:slide-in-from-right",
          className,
        )}
        {...(description ? {} : { "aria-describedby": undefined })}
        {...props}
      >
        <header className="flex items-start justify-between gap-4 border-b border-rule px-6 pt-5 pb-4">
          <div className="flex flex-col gap-1">
            <DialogPrimitive.Title className="text-lg font-semibold">{title}</DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="text-sm text-fg-muted">{description}</DialogPrimitive.Description>
            ) : null}
          </div>
          <DialogPrimitive.Close
            className="-mt-1 -mr-2 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-fg-muted hover:bg-surface-sunken hover:text-fg"
            aria-label="Close"
          >
            <X className="size-4" aria-hidden />
          </DialogPrimitive.Close>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer ? <footer className="flex flex-wrap justify-end gap-2 border-t border-rule px-6 py-4">{footer}</footer> : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
