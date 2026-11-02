"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CompanySettingsSchema, type CompanySettings } from "@agentopia/shared";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SectionHeader } from "@/components/ui/page-header";
import { SwitchField } from "@/components/ui/switch";
import { toast } from "@/components/ui/toaster";
import type { CompanyView } from "@/hooks/api-shapes";
import { useArchiveCompany, useUpdateCompany } from "@/hooks/use-api";
import { errorMessage } from "@/lib/utils";

export function CompanyIdentityForm({ company }: { company: CompanyView }) {
  const update = useUpdateCompany(company.id);
  const [name, setName] = useState(company.name);
  const [timezone, setTimezone] = useState(company.timezone);
  const [errors, setErrors] = useState<Record<string, string>>({});
  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!name.trim() || name.trim().length > 80) next.name = "Use 1 to 80 characters.";
    if (!timezone.trim()) next.timezone = "Enter an IANA timezone, e.g. Africa/Cairo.";
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      await update.mutateAsync({ name: name.trim(), timezone: timezone.trim() });
      toast.success("Company saved");
    } catch (err) {
      setErrors({ form: errorMessage(err) });
    }
  }
  return (
    <section aria-labelledby="company-h">
      <SectionHeader title={<span id="company-h">Company</span>} className="border-b border-rule" />
      <form onSubmit={submit} noValidate className="grid gap-5 pt-5 sm:grid-cols-2">
        <FormField label="Company name" error={errors.name}>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </FormField>
        <FormField label="Timezone" hint="Used for learning schedules and daily counts." error={errors.timezone}>
          <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} spellCheck={false} />
        </FormField>
        <div className="flex items-center gap-4 sm:col-span-2">
          <Button type="submit" pending={update.isPending}>
            Save company
          </Button>
          {errors.form ? (
            <p role="alert" className="text-sm font-medium text-brick-ink">
              {errors.form}
            </p>
          ) : null}
        </div>
      </form>
    </section>
  );
}

type Draft = {
  maxConcurrentExecutions: string;
  defaultMaxCostUsd: string;
  defaultTimeoutSec: string;
  retentionDays: string;
  requireApprovalForPaidExecution: boolean;
  requireApprovalForShell: boolean;
  requireApprovalForNetwork: boolean;
  allowPaidLearning: boolean;
};

export function CompanyPoliciesForm({ company }: { company: CompanyView }) {
  const update = useUpdateCompany(company.id);
  const s = CompanySettingsSchema.parse(company.settings ?? {});
  const [d, setD] = useState<Draft>({
    maxConcurrentExecutions: String(s.maxConcurrentExecutions),
    defaultMaxCostUsd: String(s.defaultMaxCostUsd),
    defaultTimeoutSec: String(s.defaultTimeoutSec),
    retentionDays: String(s.retentionDays),
    requireApprovalForPaidExecution: s.requireApprovalForPaidExecution,
    requireApprovalForShell: s.requireApprovalForShell,
    requireApprovalForNetwork: s.requireApprovalForNetwork,
    allowPaidLearning: s.allowPaidLearning,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    // A cleared number field must not save as 0 (Number("") === 0): flag it instead.
    const blank: Record<string, string> = {};
    const num = (k: "maxConcurrentExecutions" | "defaultMaxCostUsd" | "defaultTimeoutSec" | "retentionDays") => {
      const raw = d[k].trim();
      if (raw === "") {
        blank[k] = "Enter a value.";
        return undefined;
      }
      return Number(raw);
    };
    const values = {
      maxConcurrentExecutions: num("maxConcurrentExecutions"),
      defaultMaxCostUsd: num("defaultMaxCostUsd"),
      defaultTimeoutSec: num("defaultTimeoutSec"),
      retentionDays: num("retentionDays"),
    };
    if (Object.keys(blank).length) {
      setErrors(blank);
      return;
    }
    const parsed = CompanySettingsSchema.partial().safeParse({
      ...values,
      requireApprovalForPaidExecution: d.requireApprovalForPaidExecution,
      requireApprovalForShell: d.requireApprovalForShell,
      requireApprovalForNetwork: d.requireApprovalForNetwork,
      allowPaidLearning: d.allowPaidLearning,
    } satisfies Partial<CompanySettings>);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    try {
      await update.mutateAsync({ settings: parsed.data });
      toast.success("Policies saved");
    } catch (err) {
      setErrors({ form: errorMessage(err) });
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-12">
      <section aria-labelledby="exec-h">
        <SectionHeader
          title={<span id="exec-h">Execution</span>}
          description="Defaults for new tasks. A provider connection's own limits apply on top of these."
          className="border-b border-rule"
        />
        <div className="grid gap-5 pt-5 sm:grid-cols-3">
          <FormField label="Tasks running at once" hint="1 to 10 for the whole company." error={errors.maxConcurrentExecutions}>
            <Input type="number" min={1} max={10} inputMode="numeric" value={d.maxConcurrentExecutions} onChange={(e) => set("maxConcurrentExecutions", e.target.value)} />
          </FormField>
          <FormField label="Default max cost per task (USD)" hint="0 to 100" error={errors.defaultMaxCostUsd}>
            <Input type="number" min={0} max={100} step="0.05" inputMode="decimal" value={d.defaultMaxCostUsd} onChange={(e) => set("defaultMaxCostUsd", e.target.value)} />
          </FormField>
          <FormField label="Default timeout (seconds)" hint="30 to 7200" error={errors.defaultTimeoutSec}>
            <Input type="number" min={30} max={7200} inputMode="numeric" value={d.defaultTimeoutSec} onChange={(e) => set("defaultTimeoutSec", e.target.value)} />
          </FormField>
        </div>
      </section>

      <section aria-labelledby="approvals-h">
        <SectionHeader
          title={<span id="approvals-h">Approval policies</span>}
          description="When an employee needs one of these, the task waits in your approvals inbox."
          className="border-b border-rule"
        />
        <div className="flex flex-col divide-y divide-rule">
          <SwitchField
            label="Approve every paid run"
            description="Ask before any task calls a billed API. Simulated runs never ask."
            checked={d.requireApprovalForPaidExecution}
            onCheckedChange={(v) => set("requireApprovalForPaidExecution", v)}
          />
          <SwitchField
            label="Approve shell commands"
            description="Ask before an employee runs a command in the project workspace."
            checked={d.requireApprovalForShell}
            onCheckedChange={(v) => set("requireApprovalForShell", v)}
          />
          <SwitchField
            label="Approve network access"
            description="Ask before an employee fetches from or publishes to the internet."
            checked={d.requireApprovalForNetwork}
            onCheckedChange={(v) => set("requireApprovalForNetwork", v)}
          />
        </div>
      </section>

      <section aria-labelledby="learning-billing-h">
        <SectionHeader
          title={<span id="learning-billing-h">Learning</span>}
          description="By default learning writes zero-token notes and never spends your subscription or a paid key."
          className="border-b border-rule"
        />
        <div className="flex flex-col divide-y divide-rule">
          <SwitchField
            label="Allow learning to use an API-key connection (billed separately)"
            description="Only an API-key connection you added is used, never your Claude or ChatGPT subscription. The provider bills those calls separately."
            checked={d.allowPaidLearning}
            onCheckedChange={(v) => set("allowPaidLearning", v)}
          />
        </div>
      </section>

      <section aria-labelledby="privacy-h">
        <SectionHeader title={<span id="privacy-h">Retention and privacy</span>} className="border-b border-rule" />
        <div className="grid gap-6 pt-5 min-[900px]:grid-cols-[16rem_minmax(0,1fr)]">
          <FormField label="Keep task history for (days)" hint="1 to 3650. Events, artifacts and logs older than this are deleted." error={errors.retentionDays}>
            <Input type="number" min={1} max={3650} inputMode="numeric" value={d.retentionDays} onChange={(e) => set("retentionDays", e.target.value)} />
          </FormField>
          <div className="max-w-prose text-sm leading-relaxed text-fg-muted">
            <p>
              Task briefs, retrieved knowledge and project files are sent to the provider an employee runs on, under that provider&apos;s terms.
              API keys are encrypted at rest and never shown again after you save them.
            </p>
            <p className="mt-2">Simulated runs never leave this server. Usage records are kept so cost history stays accurate.</p>
          </div>
        </div>
      </section>

      <div className="flex items-center gap-4 border-t border-rule pt-5">
        <Button type="submit" pending={update.isPending}>
          Save policies
        </Button>
        {errors.form ? (
          <p role="alert" className="text-sm font-medium text-brick-ink">
            {errors.form}
          </p>
        ) : null}
      </div>
    </form>
  );
}

export function DangerZone({ company }: { company: CompanyView }) {
  const archive = useArchiveCompany();
  const router = useRouter();
  return (
    <section aria-labelledby="danger-h" className="border-t-2 border-brick-ink/60 pt-5">
      <h2 id="danger-h" className="text-base font-semibold text-brick-ink">
        Danger zone
      </h2>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-prose text-sm leading-relaxed text-fg-muted">
          Archiving {company.name} stops its learning schedules, removes its floor from the building, and hides it everywhere. Its data is kept.
        </p>
        <ConfirmDialog
          trigger={<Button variant="danger">Archive company</Button>}
          title={`Archive ${company.name}?`}
          description="Running tasks are left as they are, schedules stop, and the floor is archived. You will be taken to set up another company."
          confirmLabel="Archive company"
          onConfirm={async () => {
            try {
              await archive.mutateAsync(company.id);
              toast.success(`${company.name} archived`);
              router.push("/onboarding");
            } catch (err) {
              toast.error("Archive failed", { description: errorMessage(err) });
            }
          }}
        />
      </div>
    </section>
  );
}
