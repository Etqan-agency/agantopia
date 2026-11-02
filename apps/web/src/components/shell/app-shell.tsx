"use client";

import { Ellipsis } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { BrandLogo } from "@/components/brand/logo";
import { ModeBadge } from "@/components/mode-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { StatusDot } from "@/components/ui/status-dot";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useApprovals } from "@/hooks/use-api";
import { CompanyProvider, useCompany } from "@/hooks/use-company";
import { CompanyEventsProvider, useCompanyEvents } from "@/hooks/use-events";
import { cn } from "@/lib/utils";
import { FloorSwitcher } from "./floor-switcher";
import { ProviderLimitBanner, ProviderLimitToasts } from "./provider-limit-alerts";
import { isActive, NAV_ITEMS } from "./nav";
import { UserMenu } from "./user-menu";

/** Routes that render edge to edge (the office canvas). */
const FULL_BLEED_PREFIXES = ["/office"];

export function AppShell({ initialFloorId, children }: { initialFloorId?: string | null; children: ReactNode }) {
  return (
    <TooltipProvider>
      <CompanyProvider initialFloorId={initialFloorId}>
        <ShellWithEvents>{children}</ShellWithEvents>
      </CompanyProvider>
    </TooltipProvider>
  );
}

function ShellWithEvents({ children }: { children: ReactNode }) {
  const { companyId } = useCompany();
  return (
    <CompanyEventsProvider companyId={companyId}>
      <Shell>{children}</Shell>
    </CompanyEventsProvider>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isDemo, companyId, isLoading, error, refetch, me } = useCompany();
  const fullBleed = FULL_BLEED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const status = (error as { status?: number } | null)?.status;

  useEffect(() => {
    if (status === 401) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [status, pathname, router]);

  let content: ReactNode = children;
  if (error && status !== 401) {
    content = (
      <div className="px-4 py-8 min-[900px]:px-8">
        <ErrorState title="Your workspace could not be loaded" error={error} onRetry={refetch} />
      </div>
    );
  } else if (!isLoading && me && !companyId) {
    content = (
      <div className="mx-auto w-full max-w-3xl px-4 py-12 min-[900px]:px-8">
        <EmptyState
          title="You do not have a company yet"
          description="Create a company to get a floor in your building, a manager, and a place to hire employees. It takes about two minutes."
          action={
            <Button asChild>
              <Link href="/onboarding">Set up a company</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh bg-surface text-fg">
      <a
        href="#main"
        className="sr-only z-[60] rounded-md bg-fg px-4 py-2 text-surface focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <ProviderLimitToasts />
      <Rail isDemo={isDemo} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar isDemo={isDemo} />
        <main
          id="main"
          data-fullbleed={fullBleed || undefined}
          className={cn(
            "flex min-w-0 flex-1 flex-col pb-20 min-[900px]:pb-0",
            fullBleed ? "min-h-0" : "",
          )}
        >
          {fullBleed ? (
            content
          ) : (
            <div className="mx-auto w-full max-w-[1280px] px-4 py-6 min-[900px]:px-10 min-[900px]:py-9">{content}</div>
          )}
        </main>
      </div>
      <MobileBottomBar />
    </div>
  );
}

function usePendingApprovals() {
  const { companyId } = useCompany();
  const q = useApprovals(companyId, "PENDING");
  return q.data?.length ?? 0;
}

function StreamIndicator() {
  const { status } = useCompanyEvents();
  const label =
    status === "open" ? "Live updates on" : status === "reconnecting" ? "Reconnecting to live updates" : status === "connecting" ? "Connecting" : "Live updates off";
  return (
    <span className="inline-flex items-center gap-2 text-xs text-chrome-muted" role="status" aria-live="polite">
      <StatusDot state={status === "open" ? "done" : status === "reconnecting" ? "waiting" : "offline"} size="sm" label={label} />
      <span aria-hidden>{label}</span>
    </span>
  );
}

function Rail({ isDemo }: { isDemo: boolean }) {
  const pathname = usePathname();
  const approvals = usePendingApprovals();
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-chrome-rule bg-chrome text-chrome-fg min-[900px]:flex">
      <div className="flex items-center px-5 pt-4 pb-3">
        <BrandLogo href="/office" size="md" tone="dark-surface" />
      </div>
      <div className="px-3 pb-3">
        <FloorSwitcher />
      </div>
      <nav aria-label="Main" className="flex-1 overflow-y-auto border-t border-chrome-rule px-3 py-3">
        <ul className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-11 items-center gap-3 rounded-md px-3 text-sm transition-colors",
                    active ? "bg-chrome-raised text-chrome-fg" : "text-chrome-muted hover:bg-chrome-raised/60 hover:text-chrome-fg",
                  )}
                >
                  {active ? <span aria-hidden className="absolute top-2.5 bottom-2.5 left-0 w-1 rounded-full bg-violet" /> : null}
                  <Icon className="size-4" aria-hidden />
                  <span className="flex-1">{item.label}</span>
                  {item.href === "/tasks" && approvals > 0 ? (
                    <span className="tabular rounded-full bg-gold px-1.5 text-xs font-semibold text-navy" aria-label={`${approvals} pending approvals`}>
                      {approvals}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <ProviderLimitBanner />
      <div className="flex flex-col gap-3 border-t border-chrome-rule px-3 pt-3 pb-4">
        <div className="flex items-center justify-between gap-2 px-3">
          <StreamIndicator />
          <ModeBadge isDemo={isDemo} onDark />
        </div>
        <UserMenu />
      </div>
    </aside>
  );
}

function MobileTopBar({ isDemo }: { isDemo: boolean }) {
  return (
    <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-chrome-rule bg-chrome px-2 py-1.5 min-[900px]:hidden">
      <div className="min-w-0 flex-1">
        <FloorSwitcher compact />
      </div>
      <ModeBadge isDemo={isDemo} onDark />
      <UserMenu compact />
    </div>
  );
}

function MobileBottomBar() {
  const pathname = usePathname();
  const primary = NAV_ITEMS.filter((i) => i.mobile);
  const more = NAV_ITEMS.filter((i) => !i.mobile);
  const moreActive = more.some((i) => isActive(pathname, i.href));
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-chrome-rule bg-chrome pb-[env(safe-area-inset-bottom)] min-[900px]:hidden"
    >
      <ul className="grid grid-cols-5">
        {primary.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-14 flex-col items-center justify-center gap-1 text-[11px]",
                  active ? "text-chrome-fg" : "text-chrome-muted",
                )}
              >
                {active ? <span aria-hidden className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-violet" /> : null}
                <Icon className="size-5" aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
        <li>
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                "flex h-14 w-full cursor-pointer flex-col items-center justify-center gap-1 text-[11px]",
                moreActive ? "text-chrome-fg" : "text-chrome-muted",
              )}
            >
              <Ellipsis className="size-5" aria-hidden />
              More
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top">
              {more.map((item) => {
                const Icon = item.icon;
                return (
                  <DropdownMenuItem key={item.href} asChild>
                    <Link href={item.href} aria-current={isActive(pathname, item.href) ? "page" : undefined}>
                      <Icon aria-hidden />
                      {item.label}
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </li>
      </ul>
    </nav>
  );
}
