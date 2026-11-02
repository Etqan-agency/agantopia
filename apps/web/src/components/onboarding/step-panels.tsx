"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { CreateCompanyInput, TASK_STATUS_LABEL, type TaskStatus } from "@agentopia/shared";
import { api } from "@/lib/api-client";
import { SignupForm } from "@/components/auth/signup-form";
import { ProviderConnectForm, ProviderPermissionsForm } from "@/components/integrations/provider-form";
import { ProviderStatusBadge } from "@/components/integrations/provider-list";
import { RunnerSetupSteps } from "@/components/integrations/runner-setup";
import { Badge } from "@/components/ui/badge";
import { SimulatedTag } from "@/components/mode-badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SkeletonRows } from "@/components/ui/skeleton";
import { lampFromTask, StatusDot } from "@/components/ui/status-dot";
import { toast } from "@/components/ui/toaster";
import type { ProviderConnectionView, TaskDetail } from "@/hooks/api-shapes";
import { qk, useCreateCompany, useCreateProvider, useCreateTask, useProviders, useUpdateEmployee, useVerifyProvider } from "@/hooks/use-api";
import { FLOOR_COOKIE } from "@/hooks/floor-cookie";
import { errorMessage } from "@/lib/utils";
import type { FlowState } from "./onboarding-flow";

function StepHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="flex flex-col gap-2 border-b border-rule pb-5">
      <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
      {children ? <div className="max-w-prose text-sm leading-relaxed text-fg-muted">{children}</div> : null}
    </header>
  );
}

// ---------------------------------------------------------------------------
// 1. Account
// ---------------------------------------------------------------------------

export function AccountStep({ onDone }: { onDone: () => void }) {
  return (
    <section className="flex max-w-md flex-col gap-6">
      <StepHeader title="Create your account">
        You will own the company you set up next. Already have an account?{" "}
        <Link href="/login?next=/onboarding" className="rounded-sm text-sky-ink underline-offset-4 hover:underline">
          Sign in
        </Link>
        .
      </StepHeader>
      <SignupForm onDone={onDone} />
    </section>
  );
}

// ---------------------------------------------------------------------------
// 2. Company and floor
// ---------------------------------------------------------------------------

function browserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Cairo";
  } catch {
    return "Africa/Cairo";
  }
}

export function CompanyStep({ onDone }: { onDone: (r: { cid: string; mgr: string }) => void }) {
  const create = useCreateCompany();
  const qc = useQueryClient();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [timezone, setTimezone] = useState(browserTimezone);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = CreateCompanyInput.safeParse({
      name: fd.get("name"),
      floorName: String(fd.get("floorName") ?? "").trim() || undefined,
      timezone: timezone.trim(),
    });
    if (!parsed.success) {
      const out: Record<string, string> = {};
      for (const i of parsed.error.issues) {
        const k = String(i.path[0]);
        out[k] ??= k === "name" || k === "floorName" ? "Use 1 to 80 characters." : i.message;
      }
      setErrors(out);
      return;
    }
    setErrors({});
    try {
      const res = await create.mutateAsync(parsed.data);
      document.cookie = `${FLOOR_COOKIE}=${encodeURIComponent(res.floorId)}; Path=/; Max-Age=31536000; SameSite=Lax`;
      await qc.invalidateQueries({ queryKey: qk.me });
      toast.success(`${res.company.name} is open`, { description: "Your manager is at their desk." });
      onDone({ cid: res.company.id, mgr: res.managerId });
    } catch (err) {
      setErrors({ form: errorMessage(err, "The company could not be created.") });
    }
  }

  return (
    <section className="flex max-w-lg flex-col gap-6">
      <StepHeader title="Name your company">
        A company gets its own floor in your building with a manager&apos;s office, team rooms and an AI manager. You can
        add more floors and companies later.
      </StepHeader>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        {errors.form ? <ErrorState title="The company could not be created" error={errors.form} /> : null}
        <FormField label="Company name" error={errors.name}>
          <Input name="name" autoComplete="organization" placeholder="Lantern Labs" required />
        </FormField>
        <FormField label="Floor name" hint="Shown in the floor switcher." error={errors.floorName} optional>
          <Input name="floorName" defaultValue="First floor" />
        </FormField>
        <FormField
          label="Timezone"
          hint="Learning schedules run on this clock. Use an IANA name such as Africa/Cairo or Europe/Berlin."
          error={errors.timezone}
        >
          <Input name="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} spellCheck={false} />
        </FormField>
        <div>
          <Button type="submit" pending={create.isPending}>
            {create.isPending ? "Creating company…" : "Create company"}
          </Button>
        </div>
      </form>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 3. Provider
// ---------------------------------------------------------------------------

export function ProviderStep({
  companyId,
  onDone,
}: {
  companyId: string;
  onDone: (r: { pid: string; mode: "live" | "sim" }) => void;
}) {
  const providers = useProviders(companyId);
  const createSim = useCreateProvider(companyId);
  const verify = useVerifyProvider(companyId);
  const [created, setCreated] = useState<ProviderConnectionView | null>(null);

  const existing = (providers.data ?? []).filter((p) => p.status !== "REVOKED");
  const current = created ? (existing.find((p) => p.id === created.id) ?? created) : null;

  async function chooseSimulated() {
    try {
      const sim =
        existing.find((p) => p.simulated) ??
        (await createSim.mutateAsync({ provider: "SIMULATED", mode: "SIMULATED", label: "Simulated" }));
      onDone({ pid: sim.id, mode: "sim" });
    } catch (err) {
      toast.error("The simulated provider could not be set up", { description: errorMessage(err) });
    }
  }

  async function runVerify(id: string) {
    try {
      const res = await verify.mutateAsync(id);
      setCreated(res.connection);
      if (res.status === "VERIFIED") toast.success("Key verified", { description: `${res.models.length} models available.` });
      else toast.error("The key was not accepted", { description: res.error ?? "Check the key and try again." });
    } catch (err) {
      toast.error("Verification failed", { description: errorMessage(err) });
    }
  }

  return (
    <section className="flex max-w-2xl flex-col gap-6">
      <StepHeader title="Connect a provider">
        <p>
          By default employees run through your own, unmodified Claude Code or Codex CLI on your machine, using the plan
          you already have. A small local runner picks up their tasks. An API key is optional and billed separately by
          the provider.
        </p>
      </StepHeader>

      {current ? (
        <div className="flex flex-col gap-4 border-y border-rule py-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-base font-semibold">{current.label}</span>
            {current.mode === "LOCAL_RUNNER" ? <Badge tone="sky">Subscription</Badge> : <ProviderStatusBadge status={current.status} />}
            {current.authMode === "API_KEY" ? <Badge tone="outline">Billed separately</Badge> : null}
            {current.secretLast4 ? <span className="tabular text-sm text-fg-muted">Key ending {current.secretLast4}</span> : null}
          </div>
          {current.mode === "LOCAL_RUNNER" ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm leading-relaxed text-fg-muted">
                Subscription connections are checked by the runner when it comes online. Do this on your machine (you can
                also do it after setup; the Integrations page shows the live status):
              </p>
              <RunnerSetupSteps provider={current.provider === "OPENAI" ? "OPENAI" : "ANTHROPIC"} />
            </div>
          ) : current.status === "INVALID" && current.verifyError ? (
            <p className="text-sm text-brick-ink" role="alert">
              {current.verifyError}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {current.mode !== "LOCAL_RUNNER" && current.status !== "VERIFIED" ? (
              <Button onClick={() => runVerify(current.id)} pending={verify.isPending}>
                {verify.isPending ? "Verifying…" : "Verify key"}
              </Button>
            ) : null}
            <Button
              variant={current.status === "VERIFIED" || current.mode === "LOCAL_RUNNER" ? "primary" : "secondary"}
              disabled={current.mode !== "LOCAL_RUNNER" && current.status !== "VERIFIED"}
              onClick={() => onDone({ pid: current.id, mode: "live" })}
            >
              Continue
            </Button>
            <Button variant="ghost" onClick={() => setCreated(null)}>
              {current.mode === "LOCAL_RUNNER" ? "Choose differently" : "Use a different key"}
            </Button>
          </div>
        </div>
      ) : (
        <>
          {existing.filter((p) => !p.simulated).length ? (
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-medium">Connections on this company</h2>
              <ul className="divide-y divide-rule border-y border-rule">
                {existing
                  .filter((p) => !p.simulated)
                  .map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <span className="flex items-center gap-3 text-sm">
                        {p.label} <ProviderStatusBadge status={p.status} />
                      </span>
                      <Button size="sm" variant="secondary" onClick={() => setCreated(p)}>
                        Use this connection
                      </Button>
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}
          <ProviderConnectForm
            companyId={companyId}
            allowedKinds={["LOCAL_RUNNER", "ANTHROPIC_API", "OPENAI_API"]}
            onCreated={(c) => {
              setCreated(c);
              if (c.mode === "API") void runVerify(c.id);
            }}
          />
        </>
      )}

      <div className="flex flex-col gap-2 border-t border-dashed border-rule-strong pt-5">
        <p className="text-sm leading-relaxed text-fg-muted">
          Not ready yet? Employees can run on the simulated provider: deterministic, labelled results and no cost. You can
          connect your subscription later from Integrations.
        </p>
        <div>
          <Button variant="secondary" onClick={chooseSimulated} pending={createSim.isPending}>
            Skip (simulated)
          </Button>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 4. Model and permissions
// ---------------------------------------------------------------------------

export function ModelStep({ state, onBack, onDone }: { state: FlowState; onBack: () => void; onDone: () => void }) {
  const providers = useProviders(state.cid);
  const updateManager = useUpdateEmployee(state.cid ?? "", state.mgr ?? "");
  const connection = providers.data?.find((p) => p.id === state.pid) ?? null;

  async function assignManager(conn: ProviderConnectionView) {
    if (!state.mgr) return onDone();
    try {
      await updateManager.mutateAsync({ providerConnectionId: conn.id, model: conn.defaultModel ?? null });
      onDone();
    } catch (err) {
      toast.error("The manager could not be connected", { description: errorMessage(err) });
    }
  }

  if (providers.isLoading) return <SkeletonRows rows={4} />;
  if (providers.error) return <ErrorState error={providers.error} onRetry={() => providers.refetch()} />;
  if (!connection) {
    return (
      <section className="flex max-w-lg flex-col gap-4">
        <StepHeader title="Choose a model and permissions">That connection is no longer available.</StepHeader>
        <div>
          <Button variant="secondary" onClick={onBack}>
            Back to providers
          </Button>
        </div>
      </section>
    );
  }

  if (connection.simulated) {
    return (
      <section className="flex max-w-2xl flex-col gap-6">
        <StepHeader title="Simulated provider">
          The simulated provider has no models and needs no permissions: it never touches files, the network or a
          shell. Its results are deterministic and every one is labelled simulated.
        </StepHeader>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => assignManager(connection)} pending={updateManager.isPending}>
            Continue with the simulated provider
          </Button>
          <Button variant="ghost" onClick={onBack}>
            Connect a key instead
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="flex max-w-2xl flex-col gap-6">
      <StepHeader title="Choose a model and permissions">
        These limits apply to every employee using {connection.label}. Tool use outside the allowed list stops and asks
        for your approval. You can change all of this later on the Integrations page.
      </StepHeader>
      <ProviderPermissionsForm
        companyId={state.cid!}
        connection={connection}
        submitLabel="Save and continue"
        onSaved={(saved) => void assignManager(saved)}
      />
      <div>
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 5. Test task
// ---------------------------------------------------------------------------

const TERMINAL: TaskStatus[] = ["COMPLETED", "FAILED", "CANCELLED", "BLOCKED"];

const TEST_TASK = {
  title: "Write a welcome note for the team",
  description:
    "Write a three-sentence welcome note for new employees joining this company. Keep it plain and friendly, and say what the company is for in one sentence.",
};

export function TestStep({ state }: { state: FlowState }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tid = params.get("tid");
  const create = useCreateTask(state.cid ?? "");
  const simulated = state.mode !== "live";

  const task = useQuery({
    queryKey: ["company", state.cid, "tasks", "detail", tid, "onboarding"],
    queryFn: () => api.get<TaskDetail>(`/api/companies/${state.cid}/tasks/${tid}`),
    enabled: Boolean(state.cid && tid),
    refetchInterval: (q) => (q.state.data && TERMINAL.includes(q.state.data.status as TaskStatus) ? false : 2000),
  });

  async function start() {
    try {
      const created = await create.mutateAsync({
        ...TEST_TASK,
        priority: "NORMAL",
        maxCostUsd: 0.05,
        // Straight to the manager's own desk: a new company has no specialists yet to delegate to.
        submitToManager: false,
        assigneeId: state.mgr ?? undefined,
      });
      const sp = new URLSearchParams(params.toString());
      sp.set("tid", created.id);
      router.replace(`${pathname}?${sp.toString()}`);
    } catch (err) {
      toast.error("The test task could not be created", { description: errorMessage(err) });
    }
  }

  const status = task.data?.status as TaskStatus | undefined;

  return (
    <section className="flex max-w-2xl flex-col gap-6">
      <StepHeader title="Run a small test task">
        One short writing task, assigned straight to your manager with a cost cap of five cents.{" "}
        {simulated ? "It runs on the simulated provider, so it costs nothing and the result is labelled." : "It calls your model, so it will use a few hundred tokens."}
      </StepHeader>

      <div className="flex flex-col gap-2 border-l-2 border-rule-strong pl-4">
        <p className="text-sm font-medium">{TEST_TASK.title}</p>
        <p className="text-sm leading-relaxed text-fg-muted">{TEST_TASK.description}</p>
      </div>

      {!tid ? (
        <div className="flex flex-wrap gap-2">
          <Button onClick={start} pending={create.isPending}>
            Run test task
          </Button>
          <Button asChild variant="ghost">
            <Link href="/office">Skip and open the office</Link>
          </Button>
        </div>
      ) : task.error ? (
        <ErrorState title="The test task could not be loaded" error={task.error} onRetry={() => task.refetch()} />
      ) : (
        <div className="flex flex-col gap-4 border-y border-rule py-5" aria-live="polite">
          <div className="flex flex-wrap items-center gap-3">
            {status ? (
              <StatusDot state={lampFromTask(status)} label={TASK_STATUS_LABEL[status]} showLabel />
            ) : (
              <StatusDot state="idle" label="Queued" showLabel />
            )}
            {simulated || task.data?.isDemo ? <SimulatedTag /> : null}
          </div>
          {task.data?.resultSummary ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{task.data.resultSummary}</p>
          ) : task.data?.errorMessage ? (
            <p className="text-sm text-brick-ink">{task.data.errorMessage}</p>
          ) : status && !TERMINAL.includes(status) ? (
            <p className="text-sm text-fg-muted">The manager is working on it. This page updates every two seconds.</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/office">Open the office</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href={`/tasks/${tid}`}>See the task timeline</Link>
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
