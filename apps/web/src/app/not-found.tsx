import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AUTH_LINKS } from "@/content/marketing/routes";

export const metadata: Metadata = {
  title: { absolute: "Page not found · Agentopia" },
  description: "This page does not exist. Head back to the Agentopia homepage or watch the scripted office demo.",
};

/** Fallback while the `brand` variant lands in button.tsx (contract §3). */
const brandButton = "rounded-full bg-violet text-white hover:bg-violet-deep";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col bg-navy text-snow">
      <header className="mx-auto flex w-full max-w-[1200px] items-center px-4 py-6 sm:px-6 lg:px-10">
        <Link href="/" className="inline-flex items-center gap-2.5 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4">
          <Image src="/brand/agentopia-mark.png" alt="" width={32} height={32} priority />
          <span className="font-display text-lg font-semibold tracking-[-0.02em]">Agentopia</span>
        </Link>
      </header>

      <section aria-labelledby="not-found-h" className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col justify-center px-4 pb-24 sm:px-6 lg:px-10">
        <p className="text-sm font-medium text-mist">Error 404</p>
        <h1 id="not-found-h" className="mt-3 max-w-[18ch] font-display text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
          This room is not on the floor plan.
        </h1>
        <p className="mt-5 max-w-[52ch] text-base leading-relaxed text-mist sm:text-lg">
          The page you asked for does not exist or has moved. Go back to the homepage, or watch the scripted office demo to
          see how a task moves from desk to desk.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Button asChild size="lg" className={brandButton}>
            <Link href="/" data-cta="404-home">
              Back to the homepage
            </Link>
          </Button>
          <Button asChild size="lg" variant="ghost" className="rounded-full border border-snow/40 text-snow hover:bg-snow/10">
            <Link href="/demo" data-cta="404-demo">
              Watch the office work
            </Link>
          </Button>
          <Link href={AUTH_LINKS.signIn} data-cta="404-sign-in" className="px-2 text-sm font-medium text-snow underline-offset-4 hover:underline">
            Sign in
          </Link>
        </div>
      </section>
    </main>
  );
}
