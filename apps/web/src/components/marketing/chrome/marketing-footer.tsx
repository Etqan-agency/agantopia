import Link from "next/link";
import { BrandLogo } from "@/components/brand/logo";
import { Container } from "@/components/marketing/primitives/container";
import { FOOTER_GROUPS } from "./nav-model";

/** Marketing footer: logo, four link groups from the route list, one honest line. */
export function MarketingFooter() {
  return (
    <footer className="border-t border-white/10 bg-navy text-snow">
      <Container className="flex flex-col gap-12 py-14 md:py-16">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.4fr)]">
          <div className="flex flex-col items-start gap-4">
            <BrandLogo href="/" size="md" tone="dark-surface" className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold" />
            <p className="max-w-[30ch] text-sm leading-relaxed text-mist">Nothing runs on a model until you connect Claude Code or Codex.</p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4">
            {FOOTER_GROUPS.map((group) => (
              <div key={group.id} className="flex flex-col gap-3">
                <h2 className="text-sm font-semibold text-gold">{group.label}</h2>
                <ul className="flex flex-col gap-1">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="inline-flex min-h-8 items-center rounded-sm text-sm text-mist transition-colors hover:text-snow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                      >
                        {link.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <p className="border-t border-white/10 pt-6 text-sm text-mist">© 2026 Agentopia</p>
      </Container>
    </footer>
  );
}
