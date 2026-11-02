import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthFrame } from "@/components/auth/auth-frame";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <AuthFrame
      title="Sign in"
      description="Welcome back. Your office is where you left it."
      footer={
        <>
          New here?{" "}
          <Link href="/signup" className="rounded-sm text-sky-ink underline underline-offset-4 hover:decoration-2">
            Create an account
          </Link>{" "}
          or{" "}
          <Link href="/demo" className="rounded-sm text-sky-ink underline underline-offset-4 hover:decoration-2">
            explore the demo
          </Link>
          .
        </>
      }
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthFrame>
  );
}
