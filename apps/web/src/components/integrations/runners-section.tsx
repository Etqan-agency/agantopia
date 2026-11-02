"use client";

import { Copy, Server } from "lucide-react";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import { CreateRunnerInput } from "@agentopia/shared";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SectionHeader } from "@/components/ui/page-header";
import { SkeletonRows } from "@/components/ui/skeleton";
import { StatusDot } from "@/components/ui/status-dot";
import { toast } from "@/components/ui/toaster";
import type { RunnerToolInfo } from "@/hooks/api-shapes";
import { useCreateRunner, useRevokeRunner, useRunners } from "@/hooks/use-api";
import { errorMessage, formatRelative } from "@/lib/utils";

const AUTH_LABEL: Record<string, string> = {
  subscription: "Your subscription (CLI sign-in)",
  cli: "CLI sign-in",
  env: "Environment key",
};

function toolText(t: RunnerToolInfo | undefined): string {
  if (!t) return "not reported";
  if (!t.installed) return "not installed";
  const auth = t.auth === "logged_in" ? "signed in" : t.auth === "not_logged_in" ? "not signed in" : "sign-in unknown";
  return `${t.version ?? "installed"}, ${auth}`;
}

const noop = () => () => {};

export function RunnersSection({ companyId }: { companyId: string }) {
  const origin = useSyncExternalStore(noop, () => window.location.origin, () => "http://localhost:3000");
  const q = useRunners(companyId);
  const create = useCreateRunner(companyId);
  const revoke = useRevokeRunner(companyId);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<{ name: string; token: string } | null>(null);
  const runners = (q.data ?? []).filter((r) => r.status !== "REVOKED");

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = CreateRunnerInput.safeParse({ name });
    if (!parsed.success) {
      setError("Give the runner a name, up to 80 characters.");
      return;
    }
    setError(null);
    try {
      const r = await create.mutateAsync(parsed.data);
      setToken({ name: r.runner.name, token: r.token });
      setName("");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <section aria-labelledby="runners-h" className="flex flex-col">
      <SectionHeader
        title={<span id="runners-h">Local runners</span>}
        description="A runner executes jobs on your own machine with your installed Claude Code or Codex CLI. It polls Agentopia with a bearer token and reports results back."
      />
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3 pb-5" noValidate>
        <FormField label="Runner name" error={error} className="min-w-60 flex-1">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Studio laptop" maxLength={80} />
        </FormField>
        <Button type="submit" variant="secondary" pending={create.isPending}>
          Create runner
        </Button>
      </form>
      {q.isLoading ? (
        <SkeletonRows rows={2} label="Loading runners" />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : runners.length === 0 ? (
        <EmptyState
          icon={<Server />}
          title="No runners yet"
          description="Create a runner, then start it with `pnpm runner --server <app url> --token <token>` using the token shown once."
        />
      ) : (
        <ul className="flex flex-col border-t border-rule">
          {runners.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-4 border-b border-rule py-3">
              <StatusDot state={r.status === "ONLINE" ? "done" : "offline"} label={r.status === "ONLINE" ? "Online" : "Offline"} showLabel />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-medium">{r.name}</span>
                <span className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-fg-muted">
                  <span>Auth: {AUTH_LABEL[r.capabilities?.auth ?? ""] ?? "Not reported"}</span>
                  <span>Claude Code: {toolText(r.capabilities?.tools?.claude)}</span>
                  <span>Codex: {toolText(r.capabilities?.tools?.codex)}</span>
                  {r.capabilities?.version ? <span>Runner {r.capabilities.version}</span> : null}
                </span>
              </span>
              <span className="flex flex-col items-end text-xs text-fg-muted">
                <span>{r.lastSeenAt ? `Last seen ${formatRelative(r.lastSeenAt)}` : "Never connected"}</span>
                {r.capabilities?.detectedAt ? <span>Tools detected {formatRelative(r.capabilities.detectedAt)}</span> : null}
              </span>
              <ConfirmDialog
                trigger={
                  <Button size="sm" variant="danger-outline">
                    Revoke
                  </Button>
                }
                title={`Revoke ${r.name}?`}
                description="Its token stops working immediately. Jobs it is running are cancelled."
                confirmLabel="Revoke runner"
                onConfirm={async () => {
                  try {
                    await revoke.mutateAsync(r.id);
                    toast.success(`${r.name} revoked`);
                  } catch (err) {
                    toast.error("Revoke failed", { description: errorMessage(err) });
                  }
                }}
              />
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!token} onOpenChange={(o) => !o && setToken(null)}>
        {token ? (
          <DialogContent title={`Token for ${token.name}`} description="Copy it now. It is shown only once and cannot be recovered.">
            <FormField label="Runner token">
              <Input readOnly value={token.token} spellCheck={false} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
            </FormField>
            <p className="mt-3 text-sm text-fg-muted">
              Start the runner on the machine where Claude Code or Codex is installed and signed in:{" "}
              <code data-testid="runner-command" className="rounded-sm bg-surface-sunken px-1 break-all">{`pnpm runner --server ${origin} --token ${token.token}`}</code>. Anyone with this
              token can claim jobs for this company; revoke the runner if it leaks.
            </p>
            <DialogFooter>
              <Button
                variant="secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(token.token);
                    toast.success("Token copied");
                  } catch {
                    toast.error("Copy failed", { description: "Select the token and copy it manually." });
                  }
                }}
              >
                <Copy aria-hidden />
                Copy token
              </Button>
              <Button onClick={() => setToken(null)}>I saved it</Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </section>
  );
}
