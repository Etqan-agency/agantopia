"use client";

import { CircleAlert } from "lucide-react";
import { cn, errorMessage } from "@/lib/utils";
import { Button } from "./button";

/** Explains what failed and how to recover. Never apologizes, never vague. */
export function ErrorState({
  title = "This could not be loaded",
  error,
  onRetry,
  className,
}: {
  title?: string;
  error?: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  const status = (error as { status?: number } | null)?.status;
  const hint =
    status === 401
      ? "Your session has ended. Sign in again to continue."
      : status === 403
        ? "Your account is not a member of this company."
        : status === 404
          ? "It may have been archived or removed."
          : undefined;
  return (
    <div role="alert" className={cn("flex items-start gap-3 border-l-2 border-brick-ink bg-brick-wash/50 px-4 py-4", className)}>
      <CircleAlert className="mt-0.5 size-4 shrink-0 text-brick-ink" aria-hidden />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-fg">{title}</p>
        <p className="text-sm text-fg-muted">{hint ?? errorMessage(error, "The server did not respond.")}</p>
        {onRetry ? (
          <div className="pt-2">
            <Button size="sm" variant="secondary" onClick={onRetry}>
              Try again
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
