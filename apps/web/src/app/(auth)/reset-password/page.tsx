import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthFrame } from "@/components/auth/auth-frame";
import { ResetForm } from "@/components/auth/reset-form";

export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <AuthFrame
      title="Choose a new password"
      footer={
        <Link href="/login" className="rounded-sm text-sky-ink underline underline-offset-4 hover:decoration-2">
          Back to sign in
        </Link>
      }
    >
      <Suspense>
        <ResetForm />
      </Suspense>
    </AuthFrame>
  );
}
