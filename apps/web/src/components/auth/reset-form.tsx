"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { errorMessage } from "@/lib/utils";
import { FormAlert } from "./auth-frame";
import { authErrorMessage, fieldErrors, ResetSchema } from "./auth-schemas";

export function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const linkError = params.get("error");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!token || linkError) {
    return (
      <div className="flex flex-col gap-4">
        <FormAlert>This reset link is invalid or has expired. Request a new one to continue.</FormAlert>
        <Button asChild variant="secondary">
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      </div>
    );
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = ResetSchema.safeParse({ password: fd.get("password"), confirm: fd.get("confirm") });
    setFormError(null);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setPending(true);
    try {
      const { error } = await authClient.resetPassword({ newPassword: parsed.data.password, token: token! });
      if (error) {
        setFormError(authErrorMessage(error, "The password could not be changed. The link may have expired."));
        return;
      }
      toast.success("Password changed", { description: "Sign in with your new password." });
      router.replace("/login");
    } catch (err) {
      setFormError(errorMessage(err, "The server did not respond. Check your connection and try again."));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {formError ? <FormAlert>{formError}</FormAlert> : null}
      <FormField label="New password" hint="At least 8 characters." error={errors.password}>
        <Input name="password" type="password" autoComplete="new-password" required />
      </FormField>
      <FormField label="Repeat new password" error={errors.confirm}>
        <Input name="confirm" type="password" autoComplete="new-password" required />
      </FormField>
      <Button type="submit" pending={pending}>
        {pending ? "Saving…" : "Change password"}
      </Button>
    </form>
  );
}
