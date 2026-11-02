"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { AuthFrame, FormAlert } from "@/components/auth/auth-frame";
import { authErrorMessage, fieldErrors, ForgotSchema } from "@/components/auth/auth-schemas";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/utils";

export default function ForgotPasswordPage() {
  const [error, setError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = ForgotSchema.safeParse({ email: new FormData(e.currentTarget).get("email") });
    setFormError(null);
    if (!parsed.success) {
      setError(fieldErrors(parsed.error).email);
      return;
    }
    setError(undefined);
    setPending(true);
    try {
      const { error: err } = await authClient.requestPasswordReset({
        email: parsed.data.email,
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (err) {
        setFormError(authErrorMessage(err, "The reset email could not be sent."));
        return;
      }
      setSentTo(parsed.data.email);
    } catch (err) {
      setFormError(errorMessage(err, "The server did not respond. Check your connection and try again."));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthFrame
      title="Reset your password"
      description="Enter the email you signed up with and we will send a link to choose a new password."
      footer={
        <Link href="/login" className="rounded-sm text-sky-ink underline underline-offset-4 hover:decoration-2">
          Back to sign in
        </Link>
      }
    >
      {sentTo ? (
        <p role="status" className="border-l-2 border-moss bg-moss-wash/60 px-3 py-3 text-sm leading-relaxed">
          If an account exists for <strong className="font-medium">{sentTo}</strong>, a reset link is on its way. In local
          development the link is printed in the server log instead of being emailed.
        </p>
      ) : (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {formError ? <FormAlert>{formError}</FormAlert> : null}
          <FormField label="Email" error={error}>
            <Input name="email" type="email" autoComplete="email" spellCheck={false} required />
          </FormField>
          <Button type="submit" pending={pending}>
            {pending ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthFrame>
  );
}
