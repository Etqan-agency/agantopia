"use client";

import { BrandLogo } from "@/components/brand/logo";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { authClient } from "@/lib/auth-client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { isStep, STEPS, type StepId } from "./steps";
import { AccountStep, CompanyStep, ModelStep, ProviderStep, TestStep } from "./step-panels";

export type FlowState = {
  cid: string | null;
  mgr: string | null;
  pid: string | null;
  /** "live" once a real provider connection exists, "sim" when the user chose the simulated provider. */
  mode: "live" | "sim" | null;
};

/**
 * Five-step first run. Progress lives in the URL (?step=&cid=&mgr=&pid=&mode=)
 * so a reload or the back button lands on the same step with the same company.
 */
export function OnboardingFlow() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const session = authClient.useSession();
  const signedIn = Boolean(session.data?.user);

  const rawStep = params.get("step");
  const state: FlowState = {
    cid: params.get("cid"),
    mgr: params.get("mgr"),
    pid: params.get("pid"),
    mode: params.get("mode") === "live" ? "live" : params.get("mode") === "sim" ? "sim" : null,
  };

  let step: StepId = isStep(rawStep) ? rawStep : signedIn ? "company" : "account";
  if (!session.isPending && !signedIn) step = "account";
  if (signedIn && step === "account") step = "company";
  if (step !== "account" && step !== "company" && !state.cid) step = "company";

  const go = useCallback(
    (next: StepId, patch: Partial<FlowState> = {}) => {
      const sp = new URLSearchParams(params.toString());
      sp.set("step", next);
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === undefined) sp.delete(k);
        else sp.set(k, String(v));
      }
      router.push(`${pathname}?${sp.toString()}`, { scroll: true });
    },
    [params, pathname, router],
  );

  const index = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="min-h-dvh bg-surface text-fg">
      <header className="bg-chrome text-chrome-fg">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 min-[900px]:px-10">
          <BrandLogo href="/" size="sm" tone="dark-surface" />
          <ModeIndicator mode={state.mode} />
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-8 min-[900px]:grid-cols-[15rem_minmax(0,1fr)] min-[900px]:px-10 min-[900px]:py-14">
        <nav aria-label="Setup progress">
          <ol tabIndex={0} className="flex gap-2 overflow-x-auto min-[900px]:flex-col min-[900px]:gap-0">
            {STEPS.map((s, i) => {
              const done = i < index || (s.id === "account" && signedIn);
              const current = i === index;
              return (
                <li
                  key={s.id}
                  aria-current={current ? "step" : undefined}
                  className={cn(
                    "flex min-w-36 shrink-0 gap-3 border-t-2 py-3 min-[900px]:min-w-0 min-[900px]:border-t-0 min-[900px]:border-l-2 min-[900px]:py-3 min-[900px]:pl-4",
                    current ? "border-fg" : done ? "border-moss" : "border-rule",
                  )}
                >
                  <span className={cn("tabular text-sm", current ? "font-semibold text-fg" : "text-fg-muted")}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className={cn("text-sm", current ? "font-semibold" : done ? "text-fg" : "text-fg-muted")}>
                      {s.title}
                      {done && !current ? <span className="sr-only"> (done)</span> : null}
                    </span>
                    <span className="hidden text-xs text-fg-muted min-[900px]:block">{s.hint}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </nav>

        <main id="main" className="min-w-0">
          {session.isPending && step === "account" ? (
            <div className="flex flex-col gap-3" role="status">
              <span className="sr-only">Checking your session</span>
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-96 max-w-full" />
            </div>
          ) : step === "account" ? (
            <AccountStep onDone={() => go("company")} />
          ) : step === "company" ? (
            <CompanyStep onDone={(r) => go("provider", { cid: r.cid, mgr: r.mgr })} />
          ) : step === "provider" ? (
            <ProviderStep
              companyId={state.cid!}
              onDone={(r) => go("model", { pid: r.pid, mode: r.mode })}
            />
          ) : step === "model" ? (
            <ModelStep state={state} onBack={() => go("provider")} onDone={() => go("test")} />
          ) : (
            <TestStep state={state} />
          )}
        </main>
      </div>
    </div>
  );
}

function ModeIndicator({ mode }: { mode: FlowState["mode"] }) {
  return (
    <p className="flex items-center gap-2 text-sm text-chrome-muted" role="status" aria-live="polite">
      {mode === "live" ? (
        <>
          <Badge tone="moss" className="bg-success/15 text-success">Live</Badge>
          Real model calls through your own connection
        </>
      ) : mode === "sim" ? (
        <>
          <Badge tone="simulated" className="border-gold bg-gold/10 text-gold">Simulated</Badge>
          No model is called; results are labelled
        </>
      ) : (
        <>
          <Badge tone="outline" className="border-chrome-rule text-chrome-muted">Not connected</Badge>
          Nothing runs on a model yet
        </>
      )}
    </p>
  );
}
