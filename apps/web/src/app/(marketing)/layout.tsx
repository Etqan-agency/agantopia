import type { ReactNode } from "react";
import { MarketingFooter } from "@/components/marketing/chrome/marketing-footer";
import { MarketingNavbar } from "@/components/marketing/chrome/marketing-navbar";
import { JsonLd, organizationJsonLd, webSiteJsonLd } from "@/lib/seo";

/**
 * Marketing shell: navy-first and fixed (does not follow the app theme toggle), with a skip
 * link, the sticky navbar, the footer and site-wide Organization + WebSite JSON-LD.
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-navy text-snow [color-scheme:dark]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-gold focus:px-4 focus:py-2 focus:text-navy focus:outline-2 focus:outline-snow"
      >
        Skip to content
      </a>
      <MarketingNavbar />
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      <MarketingFooter />
      <JsonLd data={[organizationJsonLd(), webSiteJsonLd()]} id="ld-site" />
    </div>
  );
}
