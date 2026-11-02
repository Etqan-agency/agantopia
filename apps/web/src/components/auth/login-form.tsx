"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/utils";
import { FormAlert } from "./auth-frame";
import { authErrorMessage, fieldErrors, LoginSchema, safeNext } from "./auth-schemas";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = LoginSchema.safeParse({ email: fd.get("email"), password: fd.get("password") });
    setFormError(null);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setPending(true);
    try {
      const { error } = await authClient.signIn.email({ email: parsed.data.email, password: parsed.data.password });
      if (error) {
        setFormError(
          error.status === 401 || error.code === "INVALID_EMAIL_OR_PASSWORD"
            ? "That email and password do not match an account."
            : authErrorMessage(error, "Sign in failed."),
        );
        return;
      }
      router.replace(next);
      router.refresh();
    } catch (err) {
      setFormError(errorMessage(err, "The server did not respond. Check your connection and try again."));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {formError ? <FormAlert>{formError}</FormAlert> : null}
      <FormField label="Email" error={errors.email}>
        <Input name="email" type="email" autoComplete="email" spellCheck={false} required />
      </FormField>
      <FormField label="Password" error={errors.password}>
        <Input name="password" type="password" autoComplete="current-password" required />
      </FormField>
      <div className="-mt-1 flex justify-end">
        <Link href="/forgot-password" className="rounded-sm text-sm text-sky-ink underline-offset-4 hover:underline">
          Forgot password?
        </Link>
      </div>
      <Button type="submit" pending={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
