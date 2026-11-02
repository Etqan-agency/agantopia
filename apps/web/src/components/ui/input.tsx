import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const fieldBase =
  "w-full rounded-md border border-rule-strong bg-surface-raised px-3 text-sm text-fg placeholder:text-fg-muted/80 transition-colors hover:border-fg-muted focus-visible:border-focus focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-brick-ink";

export function Input({ className, type = "text", ...props }: ComponentProps<"input">) {
  return <input type={type} className={cn(fieldBase, "h-11", className)} {...props} />;
}
