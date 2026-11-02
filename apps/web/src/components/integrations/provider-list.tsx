"use client";

import { KeyRound, Plus, RefreshCw } from "lucide-react";
import { useState, type FormEvent } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SimulatedTag } from "@/components/mode-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SectionHeader } from "@/components/ui/page-header";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { SkeletonRows } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";
import type { ProviderConnectionView } from "@/hooks/api-shapes";
import { useProviders, useRevokeProvider, useUpdateProvider, useVerifyProvider } from "@/hooks/use-api";
import { errorMessage, formatRelative } from "@/lib/utils";
import { MODE_LABEL, PROVIDER_LABEL, ProviderConnectForm, ProviderPermissionsForm } from "./provider-form";

const STATUS: Record<ProviderConnectionView["status"], { label: string; tone: "moss" | "brick" | "neutral" | "outline" }> = {
  VERIFIED: { label: "Verified", tone: "moss" },
  INVALID: { label: "Invalid", tone: "brick" },
  UNVERIFIED: { label: "Not verified", tone: "neutral" },
  REVOKED: { label: "Revoked", tone: "outline" },
};

export function ProviderStatusBadge({ status }: { status: ProviderConnectionView["status"] }) {
  const s = STATUS[status] ?? STATUS.UNVERIFIED;
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function ProvidersSection({ companyId }: { companyId: string }) {
  const q = useProviders(companyId);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ProviderConnectionView | null>(null);
  const active = (q.data ?? []).filter((c) => c.status !== "REVOKED");
  const revoked = (q.data ?? []).filter((c) => c.status === "REVOKED");

  return (
    <section aria-labelledby="providers-h" className="flex flex-col">
      <SectionHeader
        title={<span id="providers-h">Provider connections</span>}
        description="Each employee runs on one connection. Subscription connections store no credentials; API keys are encrypted at rest, never returned by the API, and billed separately."
        actions={
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus aria-hidden />
            Add connection
          </Button>
        }
      />
      {q.isLoading ? (
        <SkeletonRows rows={3} label="Loading connections" />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : active.length === 0 ? (
        <EmptyState
          icon={<KeyRound />}
          title="No provider connected"
          description="Connect your Claude Code or Codex subscription through the local runner, an API key (billed separately), or the simulated provider so employees can work."
          action={<Button onClick={() => setAdding(true)}>Add connection</Button>}
        />
      ) : (
        <ul className="flex flex-col border-t border-rule">
          {active.map((c) => (
            <ProviderRow key={c.id} companyId={companyId} connection={c} onEdit={() => setEditing(c)} />
          ))}
        </ul>
      )}
      {revoked.length ? (
        <p className="pt-3 text-xs text-fg-muted">
          {revoked.length} revoked {revoked.length === 1 ? "connection is" : "connections are"} kept for usage history.
        </p>
      ) : null}

      <Sheet open={adding} onOpenChange={setAdding}>
        <SheetContent title="Add a provider connection" description="Pick how employees on this connection call a model.">
          <ProviderConnectForm
            companyId={companyId}
            onCreated={(c) => {
              setAdding(false);
              if (c.mode === "API") setEditing(c);
            }}
          />
        </SheetContent>
      </Sheet>

      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        {editing ? (
          <SheetContent title={`Model and permissions: ${editing.label}`} description="Limits apply to every task run on this connection.">
            <VerifyBlock companyId={companyId} connection={editing} onVerified={setEditing} />
            <ProviderPermissionsForm
              key={`${editing.id}-${editing.models?.length ?? 0}`}
              companyId={companyId}
              connection={editing}
              onSaved={() => setEditing(null)}
              className="mt-6 border-t border-rule pt-6"
            />
          </SheetContent>
        ) : null}
      </Sheet>
    </section>
  );
}

function VerifyBlock({
  companyId,
  connection,
  onVerified,
}: {
  companyId: string;
  connection: ProviderConnectionView;
  onVerified: (c: ProviderConnectionView) => void;
}) {
  const verify = useVerifyProvider(companyId);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3" aria-live="polite">
      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-2 text-sm">
          Status <ProviderStatusBadge status={connection.status} />
        </span>
        {connection.verifyError ? <span className="text-xs text-brick-ink">{connection.verifyError}</span> : null}
      </div>
      <Button
        variant="secondary"
        size="sm"
        pending={verify.isPending}
        onClick={async () => {
          try {
            const r = await verify.mutateAsync(connection.id);
            if (r.status === "VERIFIED") toast.success("Connection verified", { description: `${r.models.length} models available.` });
            else toast.error("Verification failed", { description: r.error ?? "The provider rejected the credentials." });
            if (r.connection) onVerified(r.connection);
          } catch (err) {
            toast.error("Verification failed", { description: errorMessage(err) });
          }
        }}
      >
        <RefreshCw aria-hidden />
        Verify
      </Button>
    </div>
  );
}

function ProviderRow({ companyId, connection: c, onEdit }: { companyId: string; connection: ProviderConnectionView; onEdit: () => void }) {
  const verify = useVerifyProvider(companyId);
  const revoke = useRevokeProvider(companyId);
  const [rotating, setRotating] = useState(false);

  async function runVerify() {
    try {
      const r = await verify.mutateAsync(c.id);
      if (r.status === "VERIFIED") toast.success(`${c.label} verified`, { description: `${r.models.length} models available.` });
      else toast.error(`${c.label} did not verify`, { description: r.error ?? "The provider rejected the credentials." });
    } catch (err) {
      toast.error("Verification failed", { description: errorMessage(err) });
    }
  }

  return (
    <li className="flex flex-col gap-3 border-b border-rule py-4 min-[900px]:flex-row min-[900px]:items-center min-[900px]:gap-6">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{c.label}</span>
          {!c.simulated && c.authMode === "SUBSCRIPTION_CLI" ? <Badge tone="sky">Subscription</Badge> : <ProviderStatusBadge status={c.status} />}
          {c.simulated ? <SimulatedTag /> : null}
          {!c.simulated && c.authMode === "API_KEY" ? <Badge tone="outline">Billed separately</Badge> : null}
        </div>
        <p className="text-sm text-fg-muted">
          {PROVIDER_LABEL[c.provider] ?? c.provider}, {c.authMethodLabel ?? MODE_LABEL[c.mode] ?? c.mode}
          {c.secretLast4 ? <span className="tabular">, key ••••{c.secretLast4}</span> : null}
          {c.defaultModel ? `, model ${c.defaultModel}` : ""}
        </p>
        <p className="text-xs text-fg-muted">
          {!c.simulated && c.authMode === "SUBSCRIPTION_CLI"
            ? "Checked by the local runner"
            : c.lastVerifiedAt
              ? `Verified ${formatRelative(c.lastVerifiedAt)}`
              : "Never verified"}
          {c.verifyError ? <span className="text-brick-ink">. {c.verifyError}</span> : null}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {!c.simulated && c.authMode === "API_KEY" ? (
          <Button size="sm" variant="secondary" onClick={runVerify} pending={verify.isPending}>
            Verify
          </Button>
        ) : null}
        <Button size="sm" variant="secondary" onClick={onEdit}>
          Model and permissions
        </Button>
        {c.mode === "API" ? (
          <Button size="sm" variant="ghost" onClick={() => setRotating(true)}>
            Rotate key
          </Button>
        ) : null}
        <ConfirmDialog
          trigger={
            <Button size="sm" variant="danger-outline">
              Revoke
            </Button>
          }
          title={`Revoke ${c.label}?`}
          description="The stored key is destroyed. Employees on this connection stop running until you assign another one. Usage history is kept."
          confirmLabel="Revoke connection"
          onConfirm={async () => {
            try {
              await revoke.mutateAsync(c.id);
              toast.success(`${c.label} revoked`);
            } catch (err) {
              toast.error("Revoke failed", { description: errorMessage(err) });
            }
          }}
        />
      </div>
      <RotateKeyDialog companyId={companyId} connection={c} open={rotating} onOpenChange={setRotating} />
    </li>
  );
}

function RotateKeyDialog({
  companyId,
  connection,
  open,
  onOpenChange,
}: {
  companyId: string;
  connection: ProviderConnectionView;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const update = useUpdateProvider(companyId);
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const k = key.trim();
    if (k.length < 10 || k.length > 500) {
      setError("That does not look like an API key (10 to 500 characters).");
      return;
    }
    try {
      await update.mutateAsync({ id: connection.id, apiKey: k });
      toast.success("Key rotated", { description: "Verify the connection to confirm the new key works." });
      setKey("");
      setError(null);
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={`Rotate key for ${connection.label}`} description="The old key is replaced immediately. Revoke it in the provider's console afterwards.">
        <form onSubmit={submit} noValidate>
          <FormField label="New API key" error={error} hint="A Claude or ChatGPT subscription is not an API key.">
            <Input type="password" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" spellCheck={false} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" pending={update.isPending}>
              Rotate key
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
