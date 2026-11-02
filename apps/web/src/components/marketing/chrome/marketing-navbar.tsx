"use client";

import { ChevronDown, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavigationMenu } from "radix-ui";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand/logo";
import { Container } from "@/components/marketing/primitives/container";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { NAV, NAV_PRIMARY, NAV_SIGN_IN, type NavLinkItem } from "./nav-model";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";

function isCurrent(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Sticky navy marketing bar (64px, fixed height). Desktop (>= 900px): radix NavigationMenu
 * with keyboard-accessible dropdowns. Mobile: a menu button that opens the Sheet with grouped
 * links and both CTAs; it closes on navigation. A soft shadow appears once the page scrolls.
 */
export function MarketingNavbar() {
  const pathname = usePathname() ?? "/";
  const [scrolled, setScrolled] = useState(false);
  // The sheet is open only for the path it was opened on, so any navigation closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const sheetOpen = openOn === pathname;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      data-scrolled={scrolled || undefined}
      className="sticky top-0 z-40 h-16 border-b border-white/10 bg-navy text-snow transition-shadow duration-[240ms] data-[scrolled]:shadow-[0_10px_30px_-18px_rgb(0_0_0/0.7)]"
    >
      <Container className="flex h-full items-center gap-4 lg:gap-6">
        <BrandLogo href="/" size="md" tone="dark-surface" className={FOCUS} />

        <NavigationMenu.Root aria-label="Main" className="relative hidden min-[900px]:block" delayDuration={80}>
          <NavigationMenu.List className="flex items-center gap-0.5">
            {NAV.map((entry) =>
              entry.kind === "link" ? (
                <NavigationMenu.Item key={entry.id}>
                  <NavigationMenu.Link asChild active={isCurrent(pathname, entry.href)}>
                    <Link
                      href={entry.href}
                      className={cn(
                        "inline-flex h-10 items-center whitespace-nowrap rounded-full px-2 text-sm lg:px-3 font-medium text-mist transition-colors hover:text-snow data-[active]:text-snow",
                        FOCUS,
                      )}
                      aria-current={isCurrent(pathname, entry.href) ? "page" : undefined}
                    >
                      {entry.label}
                    </Link>
                  </NavigationMenu.Link>
                </NavigationMenu.Item>
              ) : (
                <NavigationMenu.Item key={entry.id} value={entry.id} className="relative">
                  <NavigationMenu.Trigger
                    className={cn(
                      "group inline-flex h-10 cursor-pointer items-center gap-1 whitespace-nowrap rounded-full px-2 text-sm lg:px-3 font-medium text-mist transition-colors hover:text-snow data-[state=open]:text-snow",
                      entry.columns.flat().some((l) => isCurrent(pathname, l.href)) && "text-snow",
                      FOCUS,
                    )}
                  >
                    {entry.label}
                    <ChevronDown aria-hidden className="size-3.5 transition-transform duration-[160ms] group-data-[state=open]:rotate-180" />
                  </NavigationMenu.Trigger>
                  <NavigationMenu.Content
                    className={cn(
                      "absolute top-full left-0 mt-2 rounded-lg border border-white/10 bg-navy-800 p-2 shadow-frame data-[motion]:animate-in data-[motion]:fade-in-0",
                      entry.columns.length > 1 ? "w-[36rem]" : "w-[20rem]",
                    )}
                  >
                    <div className={cn("grid gap-1", entry.columns.length > 1 && "grid-cols-2")}>
                      {entry.columns.map((col, i) => (
                        <ul key={i} className="flex flex-col gap-0.5">
                          {col.map((item) => (
                            <li key={item.href}>
                              <MenuLink item={item} current={isCurrent(pathname, item.href)} />
                            </li>
                          ))}
                        </ul>
                      ))}
                    </div>
                  </NavigationMenu.Content>
                </NavigationMenu.Item>
              ),
            )}
          </NavigationMenu.List>
        </NavigationMenu.Root>

        <div className="ml-auto hidden items-center gap-2 min-[900px]:flex">
          <Button asChild variant="chrome" size="md" className="rounded-full px-3 text-snow hover:bg-snow/10">
            <Link href={NAV_SIGN_IN.href} data-cta={NAV_SIGN_IN.dataCta} className={FOCUS}>
              {NAV_SIGN_IN.label}
            </Link>
          </Button>
          <Button asChild variant="brand" size="md">
            <Link href={NAV_PRIMARY.href} data-cta={NAV_PRIMARY.dataCta} className={FOCUS}>
              {NAV_PRIMARY.label}
            </Link>
          </Button>
        </div>

        <Sheet open={sheetOpen} onOpenChange={(open) => setOpenOn(open ? pathname : null)}>
          <SheetTrigger asChild>
            <Button variant="chrome" size="icon" aria-label="Open menu" className={cn("ml-auto rounded-full text-snow hover:bg-snow/10 min-[900px]:hidden", FOCUS)}>
              <Menu className="size-5" aria-hidden />
            </Button>
          </SheetTrigger>
          <SheetContent
            title="Menu"
            className="max-w-sm border-white/10 bg-navy text-snow [&>div]:px-4 [&>footer]:border-white/10 [&>header]:border-white/10 [&>header]:px-4 [&>header_button]:text-mist [&>header_button:hover]:bg-snow/10 [&>header_button:hover]:text-snow"
            footer={
              <div className="flex w-full flex-col gap-2">
                <Button asChild variant="brand" size="lg" className="w-full">
                  <Link href={NAV_PRIMARY.href} data-cta="mobile-nav-primary" onClick={() => setOpenOn(null)}>
                    {NAV_PRIMARY.label}
                  </Link>
                </Button>
                <Button asChild variant="outline-light" size="lg" className="w-full">
                  <Link href={NAV_SIGN_IN.href} data-cta="mobile-nav-sign-in" onClick={() => setOpenOn(null)}>
                    {NAV_SIGN_IN.label}
                  </Link>
                </Button>
              </div>
            }
          >
            <nav aria-label="Main" className="flex flex-col gap-6">
              {NAV.map((entry) =>
                entry.kind === "link" ? (
                  <Link
                    key={entry.id}
                    href={entry.href}
                    onClick={() => setOpenOn(null)}
                    aria-current={isCurrent(pathname, entry.href) ? "page" : undefined}
                    className={cn("-mx-2 flex min-h-11 items-center rounded-md px-2 text-base font-semibold hover:bg-snow/[0.06]", FOCUS)}
                  >
                    {entry.label}
                  </Link>
                ) : (
                  <section key={entry.id} aria-labelledby={`mnav-${entry.id}`} className="flex flex-col gap-1">
                    <h2 id={`mnav-${entry.id}`} className="text-sm font-semibold text-mist">
                      {entry.label}
                    </h2>
                    <ul className="flex flex-col">
                      {entry.columns.flat().map((item) => (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={() => setOpenOn(null)}
                            aria-current={isCurrent(pathname, item.href) ? "page" : undefined}
                            className={cn(
                              "-mx-2 flex min-h-11 items-center rounded-md px-2 text-base text-snow hover:bg-snow/[0.06] aria-[current=page]:text-lavender",
                              FOCUS,
                            )}
                          >
                            {item.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                ),
              )}
            </nav>
          </SheetContent>
        </Sheet>
      </Container>
    </header>
  );
}

function MenuLink({ item, current }: { item: NavLinkItem; current: boolean }) {
  return (
    <NavigationMenu.Link asChild active={current}>
      <Link
        href={item.href}
        aria-current={current ? "page" : undefined}
        className={cn("flex flex-col gap-0.5 rounded-md px-3 py-2.5 transition-colors hover:bg-snow/[0.06] focus-visible:bg-snow/[0.06]", FOCUS, "focus-visible:outline-offset-0")}
      >
        <span className={cn("text-sm font-medium", current ? "text-lavender" : "text-snow")}>{item.title}</span>
        <span className="text-xs leading-relaxed text-mist">{item.description}</span>
      </Link>
    </NavigationMenu.Link>
  );
}
