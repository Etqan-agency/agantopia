"use client";

import { useState, type FormEvent } from "react";
import { CreateProviderConnectionInput, ProviderSettingsSchema, type ProviderSettings } from "@agentopia/shared";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SwitchField } from "@/components/ui/switch";
import { toast } from "@/components/ui/toaster";
import type { ProviderConnectionView } from "@/hooks/api-shapes";
import { useCreateProvider, useUpdateProvider } from "@/hooks/use-api";
import { cn, errorMessage } from "@/lib/utils";
import { BillingAcknowledgement } from "./billing-ack";
import { RunnerSetupSteps } from "./runner-setup";

// ---------------------------------------------------------------------------
// Connect a provider
// ---------------------------------------------------------------------------

type ConnectKind = "ANTHROPIC_API" | "OPENAI_API" | "LOCAL_RUNNER" | "SIMULATED";

const KINDS: Array<{ id: ConnectKind; title: string; body: string }> = [
  {
    id: "LOCAL_RUNNER",
    title: "Use my subscription (local runner)",
    body: "Employees run through your own, unmodified Claude Code or Codex CLI on your machine, signed in with your plan.",
  },
  { id: "ANTHROPIC_API", title: "Anthropic API key", body: "Billed separately to your Anthropic Console account, not to a Claude subscription." },
  { id: "OPENAI_API", title: "OpenAI API key", body: "Billed separately to your OpenAI Platform account, not to a ChatGPT subscription." },
  { id: "SIMULATED", title: "Simulated provider", body: "Deterministic, clearly labelled results. No model is called and nothing is billed." },
];

const DEFAULT_LABEL: Record<ConnectKind, string> = {
  ANTHROPIC_API: "Anthropic API key",
  OPENAI_API: "OpenAI API key",
  LOCAL_RUNNER: "Claude Code (subscription)",
  SIMULATED: "Simulated",
};

export const PROVIDER_LABEL: Record<string, string> = { ANTHROPIC: "Anthropic", OPENAI: "OpenAI", SIMULATED: "Simulated" };
export const MODE_LABEL: Record<string, string> = { API: "API key", LOCAL_RUNNER: "Local runner", SIMULATED: "Simulated" };

/**
 * Creates a provider connection. The key is sent once and never shown again;
 * the server keeps only an encrypted copy and the last four characters.
 */
export function ProviderConnectForm({
  companyId,
  onCreated,
  allowedKinds,
  submitLabel = "Connect provider",
  className,
}: {
  companyId: string;
  onCreated?: (connection: ProviderConnectionView) => void;
  allowedKinds?: ConnectKind[];
  submitLabel?: string;
  className?: string;
}) {
  const create = useCreateProvider(companyId);
  const kinds = allowedKinds ? KINDS.filter((k) => allowedKinds.includes(k.id)) : KINDS;
  const [kind, setKind] = useState<ConnectKind>(kinds[0]?.id ?? "LOCAL_RUNNER");
  const [runnerProvider, setRunnerProvider] = useState<"ANTHROPIC" | "OPENAI">("ANTHROPIC");
  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [ack, setAck] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const needsKey = kind === "ANTHROPIC_API" || kind === "OPENAI_API";
  const defaultLabel = kind === "LOCAL_RUNNER" ? (runnerProvider === "OPENAI" ? "OpenAI Codex (subscription)" : "Claude Code (subscription)") : DEFAULT_LABEL[kind];

  async function submit(e: FormEvent) {
    e.preventDefault();
    const provider = kind === "ANTHROPIC_API" ? "ANTHROPIC" : kind === "OPENAI_API" ? "OPENAI" : kind === "LOCAL_RUNNER" ? runnerProvider : "SIMULATED";
    const body = {
      provider,
      ...(kind === "SIMULATED" ? { mode: "SIMULATED" as const } : {}),
      authMode: needsKey ? ("API_KEY" as const) : ("SUBSCRIPTION_CLI" as const),
      ...(needsKey ? { acknowledgeSeparateBilling: ack } : {}),
      label: label.trim() || defaultLabel,
      ...(needsKey ? { apiKey: apiKey.trim() } : {}),
    };
    const parsed = CreateProviderConnectionInput.safeParse(body);
    const next: Record<string, string> = {};
    if (needsKey && !apiKey.trim()) next.apiKey = "Paste an API key to connect.";
    if (needsKey && !ack) next.ack = "Confirm that API usage is billed separately before saving a key.";
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!next[key]) next[key] = key === "apiKey" ? "That does not look like an API key (10 to 500 characters)." : issue.message;
      }
    }
    setErrors(next);
    if (Object.keys(next).length || !parsed.success) return;
    try {
      const created = await create.mutateAsync(parsed.data);
      setApiKey("");
      setLabel("");
      setAck(false);
      toast.success("Provider connected", {
        description: needsKey ? "Verify it to load the available models." : kind === "LOCAL_RUNNER" ? "Start the local runner on your machine to run tasks." : undefined,
      });
      onCreated?.(created);
    } catch (err) {
      setErrors({ form: errorMessage(err) });
    }
  }

  return (
    <form onSubmit={submit} className={cn("flex flex-col gap-5", className)} noValidate>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Connection type</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {kinds.map((k) => (
            <label
              key={k.id}
              className={cn(
                "flex min-h-11 cursor-pointer gap-3 rounded-md border px-3 py-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus",
                kind === k.id ? "border-fg bg-surface-raised" : "border-rule-strong hover:bg-surface-sunken",
              )}
            >
              <input
                type="radio"
                name="provider-kind"
                value={k.id}
                checked={kind === k.id}
                onChange={() => {
                  setKind(k.id);
                  setErrors({});
                }}
                className="mt-1 size-4 accent-[var(--color-ink)]"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{k.title}</span>
                <span className="text-xs leading-relaxed text-fg-muted">{k.body}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {needsKey ? (
        <BillingAcknowledgement
          checked={ack}
          onCheckedChange={(v) => {
            setAck(v);
            if (v) setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => k !== "ack")));
          }}
          error={errors.ack}
        />
      ) : null}

      {kind === "LOCAL_RUNNER" ? (
        <>
          <FormField label="Tool on your machine" hint="Sign in through the tool's own flow; Agentopia never sees your password or token.">
            <Select
              value={runnerProvider}
              onValueChange={(v) => setRunnerProvider(v as "ANTHROPIC" | "OPENAI")}
              options={[
                { value: "ANTHROPIC", label: "Claude Code (your Claude plan)" },
                { value: "OPENAI", label: "Codex CLI (your ChatGPT plan)" },
              ]}
            />
          </FormField>
          <RunnerSetupSteps provider={runnerProvider} />
        </>
      ) : null}

      <FormField label="Name" optional hint={`Shown when assigning employees. Defaults to “${defaultLabel}”.`} error={errors.label}>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={defaultLabel} maxLength={80} autoComplete="off" />
      </FormField>

      {needsKey ? (
        <FormField
          label="API key"
          hint="Stored encrypted. Only the last four characters are ever shown again."
          error={errors.apiKey}
        >
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder={kind === "ANTHROPIC_API" ? "sk-ant-…" : "sk-…"}
          />
        </FormField>
      ) : null}

      {errors.form ? (
        <p role="alert" className="text-sm font-medium text-brick-ink">
          {errors.form}
        </p>
      ) : null}

      <div>
        <Button type="submit" pending={create.isPending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Model + execution permissions
// ---------------------------------------------------------------------------

const PERMISSION_MODES: Array<{ value: ProviderSettings["permissionMode"]; label: string }> = [
  { value: "default", label: "Ask before edits and commands" },
  { value: "acceptEdits", label: "Accept file edits, ask before commands" },
  { value: "dontAsk", label: "Never ask; deny anything not allowed" },
  { value: "plan", label: "Plan only; make no changes" },
];

const list = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

type Draft = {
  defaultModel: string;
  permissionMode: ProviderSettings["permissionMode"];
  allowedTools: string;
  disallowedTools: string;
  maxTurns: string;
  maxCostUsd: string;
  timeoutSec: string;
  concurrency: string;
  sandboxMode: ProviderSettings["sandboxMode"];
  reasoning: "" | "low" | "medium" | "high";
  autoApprove: boolean;
  retryLimit: string;
};

function toDraft(c: ProviderConnectionView): Draft {
  const s = ProviderSettingsSchema.parse(c.settings ?? {});
  return {
    defaultModel: c.defaultModel ?? "",
    permissionMode: s.permissionMode,
    allowedTools: s.allowedTools.join(", "),
    disallowedTools: s.disallowedTools.join(", "),
    maxTurns: String(s.maxTurns),
    maxCostUsd: String(s.maxCostUsd),
    timeoutSec: String(s.timeoutSec),
    concurrency: String(s.concurrency),
    sandboxMode: s.sandboxMode,
    reasoning: s.reasoning ?? "",
    autoApprove: s.autoApprove,
    retryLimit: String(s.retryLimit),
  };
}

/**
 * Model choice and execution limits for one connection. Fields map 1:1 to the
 * official SDK options (permission mode, tool allow/deny lists, turn and cost caps).
 */
export function ProviderPermissionsForm({
  companyId,
  connection,
  onSaved,
  submitLabel = "Save permissions",
  className,
}: {
  companyId: string;
  connection: ProviderConnectionView;
  onSaved?: (connection: ProviderConnectionView) => void;
  submitLabel?: string;
  className?: string;
}) {
  const update = useUpdateProvider(companyId);
  const [draft, setDraft] = useState<Draft>(() => toDraft(connection));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const simulated = connection.simulated || connection.provider === "SIMULATED";
  const models = connection.models ?? [];

  async function submit(e: FormEvent) {
    e.preventDefault();
    const candidate = {
      permissionMode: draft.permissionMode,
      allowedTools: list(draft.allowedTools),
      disallowedTools: list(draft.disallowedTools),
      maxTurns: Number(draft.maxTurns),
      maxCostUsd: Number(draft.maxCostUsd),
      timeoutSec: Number(draft.timeoutSec),
      concurrency: Number(draft.concurrency),
      sandboxMode: draft.sandboxMode,
      ...(draft.reasoning ? { reasoning: draft.reasoning } : {}),
      autoApprove: draft.autoApprove,
      retryLimit: Number(draft.retryLimit),
    };
    const parsed = ProviderSettingsSchema.safeParse(candidate);
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
      const saved = await update.mutateAsync({
        id: connection.id,
        settings: parsed.data,
        ...(draft.defaultModel ? { defaultModel: draft.defaultModel } : {}),
      });
      toast.success("Permissions saved");
      onSaved?.(saved);
    } catch (err) {
      setErrors({ form: errorMessage(err) });
    }
  }

  return (
    <form onSubmit={submit} className={cn("flex flex-col gap-5", className)} noValidate>
      <FormField
        label="Default model"
        hint={
          simulated
            ? "The simulated provider has no models to choose from."
            : models.length
              ? "Models reported by the provider at the last verification."
              : "Verify the connection to load the models your key can use."
        }
      >
        <Select
          value={draft.defaultModel || undefined}
          onValueChange={(v) => set("defaultModel", v)}
          placeholder={models.length ? "Choose a model" : "No verified models yet"}
          disabled={simulated || !models.length}
          options={models.map((m) => ({ value: m, label: m }))}
        />
      </FormField>

      <FormField label="Permission mode" hint="How the agent treats file edits and commands that are not pre-approved." error={errors.permissionMode}>
        <Select
          value={draft.permissionMode}
          onValueChange={(v) => set("permissionMode", v as Draft["permissionMode"])}
          options={PERMISSION_MODES}
        />
      </FormField>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Allowed tools" hint="Comma separated, e.g. Read, Edit, Grep." error={errors.allowedTools}>
          <Input value={draft.allowedTools} onChange={(e) => set("allowedTools", e.target.value)} spellCheck={false} />
        </FormField>
        <FormField label="Blocked tools" hint="Always denied, even when the mode would allow them." error={errors.disallowedTools}>
          <Input value={draft.disallowedTools} onChange={(e) => set("disallowedTools", e.target.value)} spellCheck={false} />
        </FormField>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <FormField label="Max cost per task (USD)" hint="0 to 100" error={errors.maxCostUsd}>
          <Input type="number" inputMode="decimal" min={0} max={100} step="0.05" value={draft.maxCostUsd} onChange={(e) => set("maxCostUsd", e.target.value)} />
        </FormField>
        <FormField label="Max turns" hint="1 to 200" error={errors.maxTurns}>
          <Input type="number" inputMode="numeric" min={1} max={200} value={draft.maxTurns} onChange={(e) => set("maxTurns", e.target.value)} />
        </FormField>
        <FormField label="Timeout (seconds)" hint="30 to 7200" error={errors.timeoutSec}>
          <Input type="number" inputMode="numeric" min={30} max={7200} value={draft.timeoutSec} onChange={(e) => set("timeoutSec", e.target.value)} />
        </FormField>
        <FormField label="Concurrent runs" hint="1 to 5" error={errors.concurrency}>
          <Input type="number" inputMode="numeric" min={1} max={5} value={draft.concurrency} onChange={(e) => set("concurrency", e.target.value)} />
        </FormField>
        <FormField label="Retries after failure" hint="0 to 3" error={errors.retryLimit}>
          <Input type="number" inputMode="numeric" min={0} max={3} value={draft.retryLimit} onChange={(e) => set("retryLimit", e.target.value)} />
        </FormField>
        <FormField label="Reasoning effort" optional>
          <Select
            value={draft.reasoning || "none"}
            onValueChange={(v) => set("reasoning", v === "none" ? "" : (v as Draft["reasoning"]))}
            options={[
              { value: "none", label: "Provider default" },
              { value: "low", label: "Low" },
              { value: "medium", label: "Medium" },
              { value: "high", label: "High" },
            ]}
          />
        </FormField>
      </div>

      <FormField label="Workspace access" hint="Applies to OpenAI (Codex) sandboxing; Claude uses the tool lists above.">
        <Select
          value={draft.sandboxMode}
          onValueChange={(v) => set("sandboxMode", v as Draft["sandboxMode"])}
          options={[
            { value: "workspace-write", label: "Read and write inside the project workspace" },
            { value: "read-only", label: "Read only" },
          ]}
        />
      </FormField>

      <SwitchField
        className="border-t border-rule"
        label="Approve tool requests automatically"
        description="When off, requests outside the allowed tools wait for you in the approvals inbox."
        checked={draft.autoApprove}
        onCheckedChange={(v) => set("autoApprove", v)}
      />

      {errors.form ? (
        <p role="alert" className="text-sm font-medium text-brick-ink">
          {errors.form}
        </p>
      ) : null}
      <div>
        <Button type="submit" pending={update.isPending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
