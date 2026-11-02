"use client";

import { Ban, CircleCheck, CircleDashed, Clock, Gauge, KeyRound, Link2, PlugZap, RefreshCw, Unplug, type LucideIcon } from "lucide-react";
import { useState } from "react";
import type { ProviderUiStatus } from "@agentopia/shared";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { SectionHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusDot } from "@/components/ui/status-dot";
import { toast } from "@/components/ui/toaster";
import type { ProviderLimitView, ProviderStatusView } from "@/hooks/api-shapes";
import { useCreateProvider, useProviderStatus, useReconnectProvider, useRevokeProvider } from "@/hooks/use-api";
import { errorMessage, formatDateTime, formatRelative } from "@/lib/utils";
import { ApiKeyDialog } from "./api-key-dialog";
import { RunnerSetupSteps } from "./runner-setup";

type Tone = "moss" | "brick" | "neutral" | "outline" | "saffron" | "sky" | "gold";

export const PROVIDER_STATUS_TONE: Record<ProviderUiStatus, Tone> = {
  CONNECTED: "sky",
  DISCONNECTED: "outline",
  READY: "moss",
  RUNNING: "gold",
  USAGE_LIMIT_REACHED: "saffron",
  WAITING_FOR_RESET: "saffron",
  AUTHENTICATION_EXPIRED: "brick",
  RUNNER_OFFLINE: "neutral",
  UNSUPPORTED: "brick",
};

/**
 * Each status gets its own icon and fill so statuses that share a hue (the two limit
 * states, the two red states) stay distinguishable without relying on colour. All
 * pairs use the semantic -ink/-wash tokens, so they hold AA in both themes.
 */
const PROVIDER_STATUS_LOOK: Record<ProviderUiStatus, { icon: LucideIcon | null; className?: string }> = {
  CONNECTED: { icon: Link2 },
  DISCONNECTED: { icon: CircleDashed },
  READY: { icon: CircleCheck },
  RUNNING: { icon: null },
  USAGE_LIMIT_REACHED: { icon: Gauge },
  // Same hue as the limit, but outlined: waiting is the calmer follow-up state.
  WAITING_FOR_RESET: { icon: Clock, className: "border border-saffron-ink/50 bg-transparent" },
  AUTHENTICATION_EXPIRED: { icon: KeyRound },
  RUNNER_OFFLINE: { icon: Unplug, className: "border border-dashed border-rule-strong" },
  // Same hue as auth expired, but outlined: nothing to fix by signing in.
  UNSUPPORTED: { icon: Ban, className: "border border-brick-ink/50 bg-transparent" },
};

export function ProviderStatusBadge({ status, label }: { status: ProviderUiStatus; label: string }) {
  const look = PROVIDER_STATUS_LOOK[status];
  const Icon = look.icon;
  return (
    <Badge tone={PROVIDER_STATUS_TONE[status]} className={look.className} data-testid="provider-status">
      {Icon ? <Icon aria-hidden /> : <span aria-hidden className="size-1.5 rounded-full bg-navy motion-safe:animate-lamp" />}
      {label}
    </Badge>
  );
}

const SUBSCRIPTION_METHOD: Record<"ANTHROPIC" | "OPENAI", string> = {
  ANTHROPIC: "Your Claude plan via the unmodified Claude Code CLI on your machine",
  OPENAI: "Your ChatGPT plan via the Codex CLI on your machine",
};

export const LIMIT_KIND_LABEL: Record<ProviderLimitView["kind"], string> = {
  OK: "No limit reported",
  RATE_LIMITED: "Rate limited",
  USAGE_LIMIT: "Usage limit reached",
  AUTH_EXPIRED: "Authentication expired",
};

/**
 * Provider-reported reset time, or the honest "not reported" sentence. A
 * classified retry time is Agentopia's own backoff and is labelled as such.
 * Never a countdown.
 */
export function limitResetText(limit: Pick<ProviderLimitView, "resetAt" | "retryAfterAt" | "source">): string {
  const reported = limit.source === "provider_reported";
  if (limit.resetAt && reported) return `Resets at ${formatDateTime(limit.resetAt)} (reported by the provider).`;
  if (limit.retryAfterAt && reported) return `The provider asked to retry after ${formatDateTime(limit.retryAfterAt)}.`;
  const retry = limit.retryAfterAt ? ` Agentopia retries automatically after ${formatDateTime(limit.retryAfterAt)}.` : "";
  return `Reset time not reported by provider.${retry}`;
}

const SETUP_STATUSES: ProviderUiStatus[] = ["RUNNER_OFFLINE", "AUTHENTICATION_EXPIRED", "UNSUPPORTED", "CONNECTED"];

export function ProviderCardsSection({ companyId }: { companyId: string }) {
  const q = useProviderStatus(companyId);
  return (
    <section aria-labelledby="ai-providers-h" className="flex flex-col">
      <SectionHeader
        title={<span id="ai-providers-h">AI providers</span>}
        description="Employees run through your own, unmodified Claude Code or Codex CLI on your machine, using the plan you already pay for. API keys are optional and billed separately."
      />
      {q.isLoading ? (
        <div className="grid gap-5 min-[900px]:grid-cols-2" role="status" aria-live="polite">
          <span className="sr-only">Loading providers</span>
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <div className="grid gap-5 min-[900px]:grid-cols-2">
          {(q.data ?? []).map((s) => (
            <ProviderCard key={s.provider} companyId={companyId} status={s} />
          ))}
        </div>
      )}
    </section>
  );
}

function ProviderCard({ companyId, status: s }: { companyId: string; status: ProviderStatusView }) {
  const create = useCreateProvider(companyId);
  const reconnect = useReconnectProvider(companyId);
  const revoke = useRevokeProvider(companyId);
  const [keyOpen, setKeyOpen] = useState(false);
  const [justConnected, setJustConnected] = useState(false);
  const headingId = `provider-card-${s.provider}`;
  const isSubscription = s.authMode === "SUBSCRIPTION_CLI";
  const limited = s.limit.kind !== "OK";
  const showSetup = !s.connectionId ? false : isSubscription && (justConnected || SETUP_STATUSES.includes(s.status));
  const tool = s.runner?.tool ?? null;
  const executionAvailable = s.status === "READY" || s.status === "RUNNING";

  async function connectSubscription() {
    try {
      await create.mutateAsync({ provider: s.provider, authMode: "SUBSCRIPTION_CLI", label: `${s.displayName} (subscription)` });
      setJustConnected(true);
      toast.success(`${s.displayName} connected with your subscription`, { description: "Start the local runner on your machine to run tasks." });
    } catch (err) {
      toast.error("Could not connect", { description: errorMessage(err) });
    }
  }

  async function runReconnect() {
    if (!s.connectionId) return;
    try {
      const r = await reconnect.mutateAsync(s.connectionId);
      if (r.verify) {
        if (r.verify.status === "VERIFIED") toast.success(`${s.displayName} API key verified`);
        else toast.error(`${s.displayName} API key was not accepted`, { description: r.verify.error ?? undefined });
      } else if (r.cleared) {
        toast.success(`${s.displayName} is signed in again`, { description: "The authentication limit was cleared." });
      } else {
        setJustConnected(true);
        toast(`Reconnect ${s.displayName}`, { description: r.instructions ?? "Start the runner on your machine." });
      }
    } catch (err) {
      toast.error("Reconnect failed", { description: errorMessage(err) });
    }
  }

  return (
    <article aria-labelledby={headingId} className="flex flex-col gap-4 rounded-lg border border-rule-strong bg-surface-raised p-5">
      <header className="flex flex-wrap items-center gap-3">
        <h3 id={headingId} className="text-base font-semibold">
          {s.displayName}
        </h3>
        <ProviderStatusBadge status={s.status} label={s.statusLabel} />
        {s.authMode === "API_KEY" ? <Badge tone="outline">Billed separately</Badge> : null}
      </header>
      <p className="text-sm leading-relaxed text-fg-muted">
        {s.status === "DISCONNECTED" ? `Not connected yet. Connect your own ${s.provider === "ANTHROPIC" ? "Claude" : "ChatGPT"} plan below, or add an API key.` : s.detail}
      </p>

      <dl className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-4 gap-y-2.5 border-y border-rule py-4 text-sm">
        <dt className="text-fg-muted">Authentication</dt>
        <dd>
          {s.authMode ? s.authMethodLabel : SUBSCRIPTION_METHOD[s.provider]}
          {!s.authMode ? <span className="block text-xs text-fg-muted">Or an API key, billed separately.</span> : null}
        </dd>

        <dt className="text-fg-muted">Local runner</dt>
        <dd>
          {s.authMode === "API_KEY" ? (
            <span className="text-fg-muted">Not used: API key runs go through Agentopia&apos;s worker.</span>
          ) : s.runner ? (
            <span className="flex flex-col gap-0.5">
              <span className="flex flex-wrap items-center gap-2">
                <StatusDot state={s.runner.status === "ONLINE" ? "done" : "offline"} label={s.runner.status === "ONLINE" ? "Online" : "Offline"} showLabel />
                <span className="font-medium">{s.runner.name}</span>
              </span>
              <span className="text-xs text-fg-muted">{s.runner.lastSeenAt ? `Last seen ${formatRelative(s.runner.lastSeenAt)}` : "Never connected"}</span>
              <span className="text-xs text-fg-muted">
                {tool
                  ? `${tool.installed ? `CLI ${tool.version ?? "version unknown"}${tool.bundled ? " (bundled)" : ""}` : "CLI not found"}, ${
                      tool.auth === "logged_in" ? "signed in" : tool.auth === "not_logged_in" ? "not signed in" : "sign-in state unknown"
                    }`
                  : "Tool detection not reported yet"}
              </span>
            </span>
          ) : (
            <span className="text-fg-muted">No runner yet</span>
          )}
        </dd>

        <dt className="text-fg-muted">Execution</dt>
        <dd>{executionAvailable ? "Available" : s.connectionId ? "Not available right now" : "Connect to run tasks"}</dd>

        <dt className="text-fg-muted">Usage limit</dt>
        <dd className="flex flex-col gap-0.5">
          <span>{LIMIT_KIND_LABEL[s.limit.kind]}</span>
          {limited && s.limit.message ? <span className="text-xs text-fg-muted">{s.limit.message}</span> : null}
          {limited ? <span className="text-xs text-fg-muted">{limitResetText(s.limit)}</span> : null}
          {s.waitingTasks > 0 ? (
            <span className="text-xs text-fg-muted">
              {s.waitingTasks} {s.waitingTasks === 1 ? "task is" : "tasks are"} waiting for the limit to reset.
            </span>
          ) : null}
        </dd>

        <dt className="text-fg-muted">Usage</dt>
        <dd className="text-fg-muted">
          {s.usage.kind === "reported"
            ? `Provider-reported${s.usage.utilization !== undefined ? `: ${s.usage.utilization}% used` : ""}${s.usage.windowLabel ? ` (${s.usage.windowLabel})` : ""}`
            : s.usage.note}
        </dd>
      </dl>

      {showSetup ? (
        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-semibold">Set up on your machine</h4>
          <RunnerSetupSteps provider={s.provider} />
        </div>
      ) : null}

      <div className="mt-auto flex flex-wrap gap-2">
        {!isSubscription ? (
          <Button size="sm" onClick={connectSubscription} pending={create.isPending}>
            <PlugZap aria-hidden />
            Connect with my subscription
          </Button>
        ) : null}
        {s.connectionId ? (
          <Button size="sm" variant="secondary" onClick={runReconnect} pending={reconnect.isPending}>
            <RefreshCw aria-hidden />
            Reconnect
          </Button>
        ) : null}
        {s.authMode !== "API_KEY" ? (
          <Button size="sm" variant="ghost" onClick={() => setKeyOpen(true)}>
            Use an API key instead (billed separately)
          </Button>
        ) : null}
        {s.connectionId ? (
          <ConfirmDialog
            trigger={
              <Button size="sm" variant="danger-outline">
                Revoke
              </Button>
            }
            title={`Revoke the ${s.displayName} connection?`}
            description={
              isSubscription
                ? "Employees on this connection stop running until you connect again. Your sign-in on your machine is not touched."
                : "The stored key is destroyed. Employees on this connection stop running until you connect again."
            }
            confirmLabel="Revoke connection"
            onConfirm={async () => {
              try {
                await revoke.mutateAsync(s.connectionId!);
                setJustConnected(false);
                toast.success(`${s.displayName} connection revoked`);
              } catch (err) {
                toast.error("Revoke failed", { description: errorMessage(err) });
              }
            }}
          />
        ) : null}
      </div>

      <ApiKeyDialog companyId={companyId} provider={s.provider} displayName={s.displayName} open={keyOpen} onOpenChange={setKeyOpen} />
    </article>
  );
}
