"use client";

import { Switch as SwitchPrimitive } from "radix-ui";
import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border border-rule-strong bg-surface-sunken transition-colors after:absolute after:-inset-2.5 after:content-[''] disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-moss-ink data-[state=checked]:bg-moss",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-4.5 translate-x-0.5 rounded-full bg-surface-raised shadow-sm ring-1 ring-rule-strong transition-transform data-[state=checked]:translate-x-[18px] data-[state=checked]:ring-moss-ink" />
    </SwitchPrimitive.Root>
  );
}

/** Switch with a clickable label and optional description, laid out as a row. */
export function SwitchField({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  className,
}: {
  label: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("flex items-start justify-between gap-6 py-3", className)}>
      <div className="flex flex-col gap-0.5">
        <label htmlFor={id} className="cursor-pointer text-sm font-medium">
          {label}
        </label>
        {description ? (
          <p id={`${id}-d`} className="text-xs leading-relaxed text-fg-muted">
            {description}
          </p>
        ) : null}
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-describedby={description ? `${id}-d` : undefined}
        className="mt-0.5"
      />
    </div>
  );
}
