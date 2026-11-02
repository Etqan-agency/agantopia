"use client";

import { Ban, Play } from "lucide-react";
import Link from "next/link";
import { useId } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { LIMIT_KIND_LABEL, limitResetText } from "@/components/integrations/provider-cards";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/status-dot";
import { toast } from "@/components/ui/toaster";
import type { TaskDetail } from "@/hooks/api-shapes";
import { useTaskAction } from "@/hooks/use-api";
import { errorMessage } from "@/lib/utils";

/**
 * Shown while a task is parked as WAITING_FOR_PROVIDER_LIMIT. Times are only
 * what the provider reported; there is no countdown.
 */
export function ProviderLimitNotice({ companyId, task }: { companyId: string; task: TaskDetail }) {
  const action = useTaskAction(companyId, task.id);
  const reasonId = useId();
  const pl = task.providerLimit;
  const name = pl?.displayName ?? "The provider";
  const limited = pl?.limited ?? false;
  const reason = limited ? `${name} is still limited. Resume becomes available when the provider reports the limit has reset.` : null;
  const pending = action.isPending ? action.variables?.action : undefined;

  async function run(a: "resume" | "cancel") {
    try {
      await action.mutateAsync({ action: a });
      toast.success(a === "resume" ? "Task resumed" : "Task cancelled");
    } catch (err) {
      toast.error("That action did not go through", { description: errorMessage(err) });
    }
  }

  return (
    <section aria-labelledby="provider-limit-h" className="flex flex-col gap-3 border-l-2 border-gold bg-saffron-wash/50 px-4 py-4">
      <h2 id="provider-limit-h" className="flex items-center gap-2 text-sm font-semibold">
        <StatusDot state="waiting" size="sm" label="" />
        Waiting for {name} {pl?.limit.kind === "AUTH_EXPIRED" ? "sign-in" : "usage limit"}
      </h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-fg-muted">Provider</dt>
        <dd>{name}</dd>
        <dt className="text-fg-muted">Status</dt>
        <dd>{pl ? LIMIT_KIND_LABEL[pl.limit.kind] : "Limit details unavailable"}</dd>
        {pl?.limit.message || task.errorMessage ? (
          <>
            <dt className="text-fg-muted">Message</dt>
            <dd className="leading-relaxed">{pl?.limit.message ?? task.errorMessage}</dd>
          </>
        ) : null}
        <dt className="text-fg-muted">Reset</dt>
        <dd>{pl ? limitResetText(pl.limit) : "Reset time not reported by provider."}</dd>
        <dt className="text-fg-muted">Retries used</dt>
        <dd className="tabular">
          {task.limitRetries}/{task.maxLimitRetries ?? 5}
        </dd>
      </dl>
      {pl?.limit.kind === "AUTH_EXPIRED" ? (
        <p className="text-sm text-fg-muted">
          Sign in again on your machine, then use Reconnect on the{" "}
          <Link href="/integrations" className="text-sky-ink underline underline-offset-4">
            Integrations
          </Link>{" "}
          page.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() => void run("resume")}
          disabled={limited || action.isPending}
          pending={pending === "resume"}
          aria-describedby={reason ? reasonId : undefined}
        >
          <Play aria-hidden />
          Resume
        </Button>
        <ConfirmDialog
          trigger={
            <Button variant="ghost" disabled={action.isPending}>
              <Ban aria-hidden />
              Cancel
            </Button>
          }
          title="Cancel this task?"
          description="It stops waiting for the provider and the assigned employee goes back to idle. You can retry it later."
          confirmLabel="Cancel task"
          onConfirm={() => run("cancel")}
        />
      </div>
      {reason ? (
        <p id={reasonId} className="text-xs text-fg-muted">
          {reason}
        </p>
      ) : null}
    </section>
  );
}
