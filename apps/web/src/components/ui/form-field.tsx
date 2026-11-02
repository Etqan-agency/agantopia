"use client";

import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Label } from "./label";

type FieldChildProps = {
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

/**
 * Label + control + hint + error. Wires id, aria-invalid and aria-describedby
 * onto its single child control.
 */
export function FormField({
  label,
  hint,
  error,
  children,
  className,
  id: idProp,
  optional,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: ReactElement<FieldChildProps>;
  className?: string;
  id?: string;
  optional?: boolean;
}) {
  const auto = useId();
  const id = idProp ?? `f${auto}`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  const control = isValidElement(children)
    ? cloneElement(children, { id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })
    : children;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {optional ? <span className="ml-1 font-normal text-fg-muted">(optional)</span> : null}
      </Label>
      {control}
      {hint ? (
        <p id={hintId} className="text-xs leading-relaxed text-fg-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs font-medium text-brick-ink" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
