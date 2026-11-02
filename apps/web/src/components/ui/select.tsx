"use client";

import { Check, ChevronDown } from "lucide-react";
import { Select as SelectPrimitive } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { fieldBase } from "./input";

export type SelectOption = { value: string; label: ReactNode; disabled?: boolean };

/**
 * Radix Select with a flat options API. Radix forbids empty-string values, so
 * pass `placeholder` for "nothing selected" and keep `value` undefined.
 */
export function Select({
  value,
  onValueChange,
  options,
  placeholder,
  disabled,
  className,
  id,
  name,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  "aria-label": ariaLabel,
}: {
  value?: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  "aria-label"?: string;
}) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled} name={name}>
      <SelectPrimitive.Trigger
        id={id}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        aria-label={ariaLabel}
        className={cn(fieldBase, "flex h-11 items-center justify-between gap-2 text-left data-[placeholder]:text-fg-muted", className)}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon>
          <ChevronDown className="size-4 text-fg-muted" aria-hidden />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

function SelectContent({ className, children, ...props }: ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Content
      position="popper"
      sideOffset={4}
      className={cn(
        "z-50 max-h-[min(24rem,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-rule-strong bg-surface-raised text-fg shadow-[0_8px_24px_-12px_rgb(0_0_0/0.3)] data-[state=open]:animate-in data-[state=open]:fade-in-0",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  );
}

function SelectItem({ className, children, ...props }: ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        "relative flex min-h-10 cursor-pointer select-none items-center rounded-sm py-2 pr-8 pl-3 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-sunken",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="absolute right-2 inline-flex items-center">
        <Check className="size-4" aria-hidden />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}
