"use client";

import { Ban, Check, RotateCcw, X } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { useTaskAction } from "@/hooks/use-api";
import { errorMessage } from "@/lib/utils";

const TERMINAL = ["COMPLETED", "FAILED", "CANCELLED"];

const DONE_LABEL = { cancel: "Task cancelled", retry: "Retry queued", approve: "Approved", reject: "Rejected", unblock: "Unblocked" } as const;

export function TaskControls({ companyId, taskId, status }: { companyId: string; taskId: string; status: string }) {
  const action = useTaskAction(companyId, taskId);
  const pending = action.isPending ? action.variables?.action : undefined;

  function run(a: "cancel" | "retry" | "approve" | "reject" | "unblock") {
    return action.mutateAsync({ action: a }).then(
      () => {
        toast.success(DONE_LABEL[a]);
      },
      (err) => {
        toast.error("That action did not go through", { description: errorMessage(err) });
      },
    );
  }

  const canDecide = status === "REVIEW" || status === "WAITING_APPROVAL";
  const canRetry = status === "FAILED" || status === "BLOCKED" || status === "CANCELLED";
  const canUnblock = status === "BLOCKED";
  const canCancel = !TERMINAL.includes(status);

  if (!canDecide && !canRetry && !canUnblock && !canCancel) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {canDecide ? (
        <>
          <Button onClick={() => void run("approve")} pending={pending === "approve"} disabled={action.isPending}>
            <Check aria-hidden />
            Approve
          </Button>
          <Button variant="danger-outline" onClick={() => void run("reject")} pending={pending === "reject"} disabled={action.isPending}>
            <X aria-hidden />
            Reject
          </Button>
        </>
      ) : null}
      {canUnblock ? (
        <Button variant="secondary" onClick={() => void run("unblock")} pending={pending === "unblock"} disabled={action.isPending}>
          Unblock
        </Button>
      ) : null}
      {canRetry ? (
        <Button variant="secondary" onClick={() => void run("retry")} pending={pending === "retry"} disabled={action.isPending}>
          <RotateCcw aria-hidden />
          Retry
        </Button>
      ) : null}
      {canCancel ? (
        <ConfirmDialog
          trigger={
            <Button variant="ghost" disabled={action.isPending}>
              <Ban aria-hidden />
              Cancel task
            </Button>
          }
          title="Cancel this task?"
          description="Running executions are stopped and the assigned employee goes back to idle. You can retry it later."
          confirmLabel="Cancel task"
          onConfirm={() => run("cancel")}
        />
      ) : null}
    </div>
  );
}
