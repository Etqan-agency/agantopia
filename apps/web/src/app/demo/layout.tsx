import type { ReactNode } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { BrandLogo } from "@/components/brand/logo";
import { buildMetadata } from "@/lib/seo";

// /demo is listed in the sitemap, so it carries a canonical URL like the marketing pages.
export const metadata: Metadata = buildMetadata({
  title: "Demo building · Agentopia",
  description: "Explore a simulated Agentopia office. Everything in the demo building is simulated in your browser.",
  path: "/demo",
});

/**
 * Standalone visitor layout: outside the authenticated app shell. The header matches the
 * marketing navbar (navy, dark-surface logo, Simulated pill); the office below follows the
 * app surface and stays light by default.
 */
export default function DemoLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface text-fg">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-navy px-4 py-2.5 text-snow min-[900px]:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <BrandLogo href="/" tone="dark-surface" className="rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold" />
          <p className="flex min-w-0 items-center gap-2 text-sm text-mist">
            <span className="shrink-0 rounded-full border border-dashed border-gold bg-gold/10 px-2 py-0.5 text-xs font-medium text-gold">Simulated</span>
            <span className="truncate">Demo building. Everything here is simulated</span>
          </p>
        </div>
        <nav aria-label="Account" className="flex items-center gap-2 text-sm">
          <Link
            href="/login"
            className="inline-flex min-h-9 items-center rounded-full px-3 font-medium text-snow hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            Sign in
          </Link>
          <Link
            href="/signup?next=/onboarding"
            className="inline-flex min-h-9 items-center rounded-full bg-violet px-4 font-medium text-white hover:bg-violet-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            Sign up
          </Link>
        </nav>
      </header>
      <main id="main" className="flex min-h-0 flex-1 flex-col">
        {children}
      </main>
    </div>
  );
}
