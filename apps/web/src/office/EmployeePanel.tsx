"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { RANK_LABEL, SPECIALTY_LABEL, type EmployeeView, type Rank, type Specialty } from "@agentopia/shared";
import type { LiveEmployee } from "./describe";
import { StateBadge } from "./StateBadge";

/** Side panel for the selected employee. */
export function EmployeePanel({
  employee,
  live,
  taskTitle,
  links,
  onClose,
}: {
  employee: EmployeeView;
  live: LiveEmployee | undefined;
  taskTitle: string | null;
  /** False in the visitor demo: profile and task pages need an account. */
  links: boolean;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
  }, [employee.id]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const state = live?.visualState ?? employee.visualState;
  const taskId = live ? live.currentTaskId : employee.currentTaskId;
  const specialty = SPECIALTY_LABEL[employee.specialty as Specialty] ?? employee.specialty;
  const rank = RANK_LABEL[employee.rank as Rank] ?? employee.rank;

  return (
    <aside aria-labelledby="employee-panel-title" className="rounded-lg border border-rule bg-surface-raised p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="employee-panel-title" className="truncate text-base font-semibold">
            {employee.name}
          </h2>
          <p className="truncate text-sm text-fg-muted">{employee.title}</p>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="grid size-9 shrink-0 place-items-center rounded-md text-fg-muted hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-focus"
          aria-label="Close employee panel"
        >
          <span aria-hidden>×</span>
        </button>
      </div>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-fg-muted">State</dt>
        <dd>
          <StateBadge state={state} />
        </dd>
        <dt className="text-fg-muted">Specialty</dt>
        <dd>{specialty}</dd>
        <dt className="text-fg-muted">Rank</dt>
        <dd>
          {rank}
          {employee.role === "MANAGER" ? " · Manager" : ""}
        </dd>
        <dt className="text-fg-muted">Provider</dt>
        <dd>{employee.provider ?? "None connected"}</dd>
        <dt className="text-fg-muted">Current task</dt>
        <dd className="min-w-0">
          {taskId ? (
            links ? (
              <Link href={`/tasks/${taskId}`} className="underline decoration-saffron underline-offset-2">
                {taskTitle ?? "Open task"}
              </Link>
            ) : (
              <span>{taskTitle ?? "A simulated task"}</span>
            )
          ) : (
            <span className="text-fg-muted">None</span>
          )}
        </dd>
      </dl>
      {links ? (
        <Link
          href={`/employees/${employee.id}`}
          className="mt-4 inline-flex min-h-10 items-center rounded-md bg-fg px-3 text-sm font-medium text-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          Open profile
        </Link>
      ) : null}
    </aside>
  );
}
