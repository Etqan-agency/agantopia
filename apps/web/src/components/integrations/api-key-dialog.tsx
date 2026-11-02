"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { useCreateProvider, useVerifyProvider } from "@/hooks/use-api";
import { errorMessage } from "@/lib/utils";
import { BillingAcknowledgement } from "./billing-ack";

const CONSOLE: Record<"ANTHROPIC" | "OPENAI", string> = { ANTHROPIC: "Anthropic Console", OPENAI: "OpenAI Platform dashboard" };

/**
 * "Use an API key instead (billed separately)". The acknowledgement is
 * mandatory: the server refuses the key without it as well.
 */
export function ApiKeyDialog({
  companyId,
  provider,
  displayName,
  open,
  onOpenChange,
}: {
  companyId: string;
  provider: "ANTHROPIC" | "OPENAI";
  displayName: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const create = useCreateProvider(companyId);
  const verify = useVerifyProvider(companyId);
  const [key, setKey] = useState("");
  const [ack, setAck] = useState(false);
  const [errors, setErrors] = useState<{ key?: string; ack?: string; form?: string }>({});

  function close(o: boolean) {
    if (!o) {
      setKey("");
      setAck(false);
      setErrors({});
    }
    onOpenChange(o);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const k = key.trim();
    const next: typeof errors = {};
    if (k.length < 10 || k.length > 500) next.key = "That does not look like an API key (10 to 500 characters).";
    if (!ack) next.ack = "Confirm that API usage is billed separately before saving a key.";
    setErrors(next);
    if (next.key || next.ack) return;
    try {
      const created = await create.mutateAsync({
        provider,
        authMode: "API_KEY",
        acknowledgeSeparateBilling: true,
        apiKey: k,
        label: `${displayName} API key`,
      });
      close(false);
      toast.success(`${displayName} API key saved`, { description: "Billed separately by the provider. Verifying it now." });
      try {
        const r = await verify.mutateAsync(created.id);
        if (r.status === "VERIFIED") toast.success("API key verified", { description: `${r.models.length} models available.` });
        else toast.error("The key was not accepted", { description: r.error ?? "Check the key and try again." });
      } catch (err) {
        toast.error("Verification failed", { description: errorMessage(err) });
      }
    } catch (err) {
      setErrors({ form: errorMessage(err) });
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        title={`Use an API key for ${displayName}`}
        description={`Create a key in the ${CONSOLE[provider]}. Agentopia stores it encrypted and only shows the last four characters.`}
      >
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <BillingAcknowledgement checked={ack} onCheckedChange={setAck} error={errors.ack} />
          <FormField label="API key" error={errors.key}>
            <Input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder={provider === "ANTHROPIC" ? "sk-ant-…" : "sk-…"}
            />
          </FormField>
          {errors.form ? (
            <p role="alert" className="text-sm font-medium text-brick-ink">
              {errors.form}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button type="submit" pending={create.isPending}>
              Save API key
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
