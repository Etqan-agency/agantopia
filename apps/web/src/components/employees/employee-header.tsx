"use client";

import { RANK_LABEL, type Rank } from "@agentopia/shared";
import { ArrowLeft, Pause, Play } from "lucide-react";
import Link from "next/link";
import { AvatarSwatch } from "@/components/avatar-swatch";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SimulatedTag } from "@/components/mode-badge";
import { SpecialtyBadge } from "@/components/specialty";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { lampFromVisual, StatusDot, visualLabel } from "@/components/ui/status-dot";
import { toast } from "@/components/ui/toaster";
import type { EmployeeDetail } from "@/hooks/api-shapes";
import { useUpdateEmployee } from "@/hooks/use-api";
import { errorMessage } from "@/lib/utils";
import { PROVIDER_LABEL, STATUS_LABEL } from "./options";

export function EmployeeHeader({ companyId, employee: e }: { companyId: string; employee: EmployeeDetail }) {
  const update = useUpdateEmployee(companyId, e.id);
  const simulated = !e.provider || e.provider === "SIMULATED";
  const isManager = e.role === "MANAGER";

  async function setStatus(status: "ACTIVE" | "PAUSED" | "ARCHIVED") {
    try {
      await update.mutateAsync({ status });
      toast.success(status === "ACTIVE" ? `${e.name} resumed` : status === "PAUSED" ? `${e.name} paused` : `${e.name} archived`);
    } catch (err) {
      toast.error("The status could not be changed", { description: errorMessage(err) });
    }
  }

  return (
    <header className="flex flex-col gap-5 border-b border-rule pb-6">
      <Link href="/employees" className="inline-flex min-h-11 w-fit items-center gap-2 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden />
        Employees
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="flex min-w-0 items-start gap-4">
          <AvatarSwatch name={e.name} palette={e.avatar.palette} size="xl" />
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-col gap-0.5">
              <h1 className="font-display text-2xl font-semibold tracking-tight">{e.name}</h1>
              <p className="text-sm text-fg-muted">
                {e.title}
                {e.department ? `, ${e.department}` : ""}
                {isManager ? " (manager)" : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <SpecialtyBadge specialty={e.specialty} />
              <span>{RANK_LABEL[e.rank as Rank] ?? e.rank}</span>
              <StatusDot
                state={e.status === "ACTIVE" ? lampFromVisual(e.visualState) : "offline"}
                label={e.status === "ACTIVE" ? visualLabel(e.visualState) : STATUS_LABEL[e.status]}
                showLabel
              />
              <span className="text-fg-muted">
                {simulated ? "Simulated provider" : `${PROVIDER_LABEL[e.provider ?? ""] ?? e.provider}${e.model ? `, ${e.model}` : ""}`}
              </span>
              {simulated ? <SimulatedTag /> : null}
              {e.status !== "ACTIVE" ? <Badge tone="saffron">{STATUS_LABEL[e.status]}</Badge> : null}
            </div>
            {e.currentTaskId && e.currentTaskTitle ? (
              <p className="text-sm">
                <span className="text-fg-muted">Current task: </span>
                <Link href={`/tasks/${e.currentTaskId}`} className="text-sky-ink hover:underline">
                  {e.currentTaskTitle}
                </Link>
              </p>
            ) : null}
          </div>
        </div>
        {!isManager && e.status !== "ARCHIVED" ? (
          <div className="flex flex-wrap gap-2">
            {e.status === "ACTIVE" ? (
              <Button variant="secondary" onClick={() => setStatus("PAUSED")} pending={update.isPending}>
                <Pause aria-hidden />
                Pause
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => setStatus("ACTIVE")} pending={update.isPending}>
                <Play aria-hidden />
                Resume
              </Button>
            )}
            <ConfirmDialog
              trigger={<Button variant="danger-outline">Archive</Button>}
              title={`Archive ${e.name}?`}
              description="Archived employees leave their desk and receive no new tasks. Their history, knowledge and usage stay on record."
              confirmLabel="Archive employee"
              onConfirm={() => setStatus("ARCHIVED")}
            />
          </div>
        ) : null}
      </div>
    </header>
  );
}
