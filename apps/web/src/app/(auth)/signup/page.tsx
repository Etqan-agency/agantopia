import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthFrame } from "@/components/auth/auth-frame";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <AuthFrame
      title="Create your account"
      description="Next you will name your company and its first floor."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="rounded-sm text-sky-ink underline underline-offset-4 hover:decoration-2">
            Sign in
          </Link>
        </>
      }
    >
      <Suspense>
        <SignupForm />
      </Suspense>
    </AuthFrame>
  );
}
