"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { SectionHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { SkeletonRows } from "@/components/ui/skeleton";
import { Switch, SwitchField } from "@/components/ui/switch";
import { toast } from "@/components/ui/toaster";
import type { EmployeeDetail, Proficiency } from "@/hooks/api-shapes";
import { useSetEmployeeSkills, useSkills } from "@/hooks/use-api";
import { errorMessage } from "@/lib/utils";
import { PROFICIENCY_LABEL } from "./options";

type Assigned = Record<string, { proficiency: Proficiency; enabled: boolean }>;

function fromEmployee(e: EmployeeDetail): Assigned {
  const out: Assigned = {};
  for (const s of e.skills) out[s.skillId] = { proficiency: s.proficiency, enabled: s.enabled };
  return out;
}

export function SkillsTab({ companyId, employee }: { companyId: string; employee: EmployeeDetail }) {
  const skills = useSkills(companyId);
  const save = useSetEmployeeSkills(companyId, employee.id);
  const initial = useMemo(() => fromEmployee(employee), [employee]);
  const [assigned, setAssigned] = useState<Assigned>(initial);
  const [showAll, setShowAll] = useState(false);
  const dirty = JSON.stringify(assigned) !== JSON.stringify(initial);

  const list = (skills.data ?? []).filter(
    (s) => s.enabled && (showAll || s.applicableRoles.includes(employee.specialty) || assigned[s.id]),
  );

  async function submit() {
    try {
      await save.mutateAsync({
        skills: Object.entries(assigned).map(([skillId, v]) => ({ skillId, proficiency: v.proficiency, enabled: v.enabled })),
      });
      toast.success("Skills saved");
    } catch (err) {
      toast.error("Skills could not be saved", { description: errorMessage(err) });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Skills"
        description="Skills add instructions to this employee's prompt for matching work."
        className="border-b border-rule"
        actions={
          <Button onClick={submit} disabled={!dirty} pending={save.isPending}>
            Save skills
          </Button>
        }
      />
      <p className="max-w-prose border-l-2 border-saffron pl-4 text-sm leading-relaxed text-fg-muted">
        Assigned proficiency is not demonstrated experience. It tells the manager what to expect; the Progression tab shows
        what this employee has actually delivered.
      </p>
      <SwitchField
        label="Show skills for other specialties"
        checked={showAll}
        onCheckedChange={setShowAll}
        className="max-w-md"
      />
      {skills.isLoading ? (
        <SkeletonRows rows={4} label="Loading skills" />
      ) : skills.isError ? (
        <ErrorState title="Skills could not be loaded" error={skills.error} onRetry={() => skills.refetch()} />
      ) : !list.length ? (
        <EmptyState title="No skills available for this specialty" description="Turn on other specialties above to see the full library." />
      ) : (
        <ul className="divide-y divide-rule border-y border-rule">
          {list.map((s) => {
            const a = assigned[s.id];
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-4 py-4">
                <Switch
                  checked={!!a}
                  aria-label={`Assign ${s.name}`}
                  onCheckedChange={(on) =>
                    setAssigned((prev) => {
                      const next = { ...prev };
                      if (on) next[s.id] = { proficiency: "PROFICIENT", enabled: true };
                      else delete next[s.id];
                      return next;
                    })
                  }
                />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {s.name}
                    {s.companyId === null ? <Badge tone="outline">Template</Badge> : null}
                  </span>
                  <span className="text-sm text-fg-muted">{s.description}</span>
                </div>
                {a ? (
                  <div className="w-40">
                    <Select
                      aria-label={`Proficiency for ${s.name}`}
                      value={a.proficiency}
                      onValueChange={(v) => setAssigned((prev) => ({ ...prev, [s.id]: { ...a, proficiency: v as Proficiency } }))}
                      options={(Object.keys(PROFICIENCY_LABEL) as Proficiency[]).map((p) => ({ value: p, label: PROFICIENCY_LABEL[p] }))}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
