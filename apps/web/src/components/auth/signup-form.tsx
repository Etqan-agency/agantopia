"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/utils";
import { FormAlert } from "./auth-frame";
import { authErrorMessage, fieldErrors, safeNext, SignupSchema } from "./auth-schemas";

export function SignupForm({ onDone }: { onDone?: () => void }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"), "/onboarding");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = SignupSchema.safeParse({ name: fd.get("name"), email: fd.get("email"), password: fd.get("password") });
    setFormError(null);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setPending(true);
    try {
      const { error } = await authClient.signUp.email(parsed.data);
      if (error) {
        setFormError(
          error.code === "USER_ALREADY_EXISTS" || error.status === 422
            ? "An account with this email already exists. Sign in instead."
            : authErrorMessage(error, "The account could not be created."),
        );
        return;
      }
      if (onDone) onDone();
      else {
        router.replace(next);
        router.refresh();
      }
    } catch (err) {
      setFormError(errorMessage(err, "The server did not respond. Check your connection and try again."));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {formError ? <FormAlert>{formError}</FormAlert> : null}
      <FormField label="Your name" error={errors.name}>
        <Input name="name" autoComplete="name" required />
      </FormField>
      <FormField label="Email" error={errors.email}>
        <Input name="email" type="email" autoComplete="email" spellCheck={false} required />
      </FormField>
      <FormField label="Password" hint="At least 8 characters." error={errors.password}>
        <Input name="password" type="password" autoComplete="new-password" required />
      </FormField>
      <Button type="submit" pending={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
