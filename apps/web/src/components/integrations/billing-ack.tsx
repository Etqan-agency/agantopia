"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

export const SEPARATE_BILLING_COPY = "A Claude or ChatGPT subscription is not an API key. API usage is billed separately by the provider.";

/** Mandatory acknowledgement before any API key connection is created. */
export function BillingAcknowledgement({
  checked,
  onCheckedChange,
  error,
  className,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  error?: string | null;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <p className="border-l-2 border-saffron bg-saffron-wash/60 px-3 py-2 text-sm leading-relaxed">{SEPARATE_BILLING_COPY}</p>
      <label htmlFor={id} className="flex min-h-11 cursor-pointer items-start gap-3 text-sm">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheckedChange(e.target.checked)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-0.5 size-4 shrink-0 accent-[var(--color-ink)]"
        />
        <span>I understand API usage is billed separately by the provider, not by my subscription.</span>
      </label>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm font-medium text-brick-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}
