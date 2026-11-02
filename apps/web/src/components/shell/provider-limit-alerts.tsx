"use client";

import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { providerDisplayName, resetSentence } from "@/components/tasks/event-label";
import { toast } from "@/components/ui/toaster";
import { useProviderStatus } from "@/hooks/use-api";
import { useCompany } from "@/hooks/use-company";
import { useCompanyEvents } from "@/hooks/use-events";

/** Events older than this are history replayed by the stream: no toast. */
const FRESH_MS = 15_000;

/** Toasts for live `provider.limit` / `provider.limit_cleared` events. Renders nothing. */
export function ProviderLimitToasts() {
  const { subscribe } = useCompanyEvents();
  useEffect(
    () =>
      subscribe((e) => {
        if (e.type !== "provider.limit" && e.type !== "provider.limit_cleared")
          return;
        if (Date.now() - Date.parse(e.createdAt) > FRESH_MS) return;
        const p = e.payload ?? {};
        const name = providerDisplayName(p.provider);
        if (e.type === "provider.limit_cleared") {
          toast.success(`${name} is available again`, {
            id: `limit-${String(p.provider)}`,
            description: "Waiting tasks can resume.",
          });
        } else if (p.kind === "AUTH_EXPIRED") {
          toast.error(`${name} sign-in expired. Tasks are waiting.`, {
            id: `limit-${String(p.provider)}`,
            description:
              "Sign in again on your machine, then Reconnect on Integrations.",
          });
        } else {
          const what = p.kind === "RATE_LIMITED" ? "rate limit" : "usage limit";
          toast.warning(`${name} ${what} reached. Tasks are waiting.`, {
            id: `limit-${String(p.provider)}`,
            description: resetSentence(p),
          });
        }
      }),
    [subscribe],
  );
  return null;
}

/** Small persistent banner in the rail while any provider is limited. */
export function ProviderLimitBanner() {
  const { companyId, isDemo } = useCompany();
  const q = useProviderStatus(companyId, { enabled: !isDemo });
  const limited = (q.data ?? []).filter((s) => s.limit.kind !== "OK");
  if (!limited.length) return null;
  const names = limited.map((s) => s.displayName).join(" and ");
  const auth = limited.every((s) => s.limit.kind === "AUTH_EXPIRED");
  return (
    <div role="status" className="mx-3 mb-3">
      <Link
        href="/integrations"
        className="flex items-start gap-2 rounded-md border border-gold/60 bg-chrome-raised px-3 py-2 text-xs leading-relaxed text-chrome-fg hover:bg-chrome-raised/70"
      >
        <TriangleAlert
          className="mt-0.5 size-3.5 shrink-0 text-gold"
          aria-hidden
        />
        <span>
          {names}{" "}
          {auth
            ? (limited.length > 1 ? "need" : "needs") + " you to sign in again"
            : limited.length > 1
              ? "are limited"
              : "is limited"}
          . Tasks are waiting.{" "}
          <span className="underline underline-offset-2">
            Open Integrations
          </span>
        </span>
      </Link>
    </div>
  );
}
