import { PROVIDER_UI_STATUS_LABEL, type ProviderUiStatus } from "@agentopia/shared";
import { Terminal } from "lucide-react";
import { useId } from "react";
import { DemoBadge, Pill, type PillVariant } from "@/components/marketing/primitives";
import { AI_TOOLS, AI_TOOLS_CLAUDE_CODE } from "@/content/marketing/ai-tools";
import { cn } from "@/lib/utils";
import { SURFACE, type Surface } from "./surface";

/** Same mapping as PROVIDER_STATUS_TONE in components/integrations/provider-cards.tsx, in Pill tones. */
export const STATUS_PILL: Record<ProviderUiStatus, PillVariant> = {
  CONNECTED: "violet",
  DISCONNECTED: "neutral",
  READY: "success",
  RUNNING: "gold",
  USAGE_LIMIT_REACHED: "gold-outline",
  WAITING_FOR_RESET: "gold-outline",
  AUTHENTICATION_EXPIRED: "danger",
  RUNNER_OFFLINE: "neutral",
  UNSUPPORTED: "danger",
};

/** One line per status, from the AI tools page copy. */
const STATUS_DETAIL: Record<ProviderUiStatus, string> = {
  CONNECTED: "Connected. Start the local runner on your machine to run tasks.",
  DISCONNECTED: "Not connected yet.",
  READY: "A runner is online and the CLI is installed and signed in.",
  RUNNING: "Work is in progress.",
  USAGE_LIMIT_REACHED: "The provider reported a limit; tasks wait.",
  WAITING_FOR_RESET: "The provider reported a limit; tasks wait.",
  AUTHENTICATION_EXPIRED: "Sign in to the CLI again.",
  RUNNER_OFFLINE: "Start the runner on your machine.",
  UNSUPPORTED: "The CLI is missing, or an API key is present in subscription mode.",
};

/** The seven statuses the site explains, in display order. */
export const SHOWCASE_STATUSES: ProviderUiStatus[] = [
  "READY",
  "RUNNING",
  "RUNNER_OFFLINE",
  "AUTHENTICATION_EXPIRED",
  "USAGE_LIMIT_REACHED",
  "WAITING_FOR_RESET",
  "UNSUPPORTED",
];

export type ShowcaseProvider = {
  provider: "ANTHROPIC" | "OPENAI";
  status: ProviderUiStatus;
  mode?: "subscription" | "api_key";
};

const NAME = { ANTHROPIC: "Claude Code", OPENAI: "OpenAI Codex" } as const;
const SUBSCRIPTION_METHOD = {
  ANTHROPIC: "Your Claude plan via the unmodified Claude Code CLI on your machine",
  OPENAI: "Your ChatGPT plan via the Codex CLI on your machine",
} as const;
const API_METHOD = { ANTHROPIC: "Anthropic API key, encrypted, shown by its last four characters", OPENAI: "OpenAI API key, encrypted, shown by its last four characters" } as const;

const LIMITED: ProviderUiStatus[] = ["USAGE_LIMIT_REACHED", "WAITING_FOR_RESET"];
const RUNNER_ONLINE: ProviderUiStatus[] = ["READY", "RUNNING", "USAGE_LIMIT_REACHED", "WAITING_FOR_RESET", "AUTHENTICATION_EXPIRED", "UNSUPPORTED", "CONNECTED"];

function sectionSteps(page: typeof AI_TOOLS, id: string) {
  return page.sections.find((s) => s.id === id)?.steps ?? [];
}

/** Connect → sign in → run, assembled from the AI tools pages. */
export function connectSteps(): { title: string; body: string }[] {
  const setup = sectionSteps(AI_TOOLS_CLAUDE_CODE, "setup");
  const runner = sectionSteps(AI_TOOLS, "runner");
  return [
    { title: "Connect", body: "In Integrations, choose Connect with my subscription for Claude Code or OpenAI Codex." },
    { title: runner[1]?.title ?? "Sign in to the CLI", body: runner[1]?.body ?? "" },
    { title: "Start the runner", body: setup[2]?.body ?? "" },
  ];
}

function ProviderCard({ p, surface, idPrefix }: { p: ShowcaseProvider; surface: Surface; idPrefix: string }) {
  const s = SURFACE[surface];
  const apiKey = p.mode === "api_key";
  const limited = LIMITED.includes(p.status);
  const runnerOnline = RUNNER_ONLINE.includes(p.status);
  const headingId = `${idPrefix}-${p.provider}-${p.status}-${p.mode ?? "subscription"}`;
  return (
    <article aria-labelledby={headingId} className={cn("flex flex-col gap-4 rounded-md border p-5", s.inset)}>
      <header className="flex flex-wrap items-center gap-2.5">
        <h4 id={headingId} className="text-base font-semibold">
          {NAME[p.provider]}
        </h4>
        <Pill variant={STATUS_PILL[p.status]} dot={p.status === "RUNNING"} data-status={p.status}>
          {PROVIDER_UI_STATUS_LABEL[p.status]}
        </Pill>
        {apiKey ? (
          <Pill variant="neutral">
            Billed separately
          </Pill>
        ) : null}
      </header>
      <p className={cn("text-sm leading-relaxed", s.muted)}>{STATUS_DETAIL[p.status]}</p>
      <dl className={cn("grid grid-cols-1 gap-x-4 gap-y-1 border-y py-4 text-sm sm:grid-cols-[minmax(7rem,auto)_1fr] sm:gap-y-2.5", s.rule)}>
        <dt className={s.muted}>Connection</dt>
        <dd className="max-sm:mb-2">{apiKey ? "API key, billed separately" : "My subscription (local runner)"}</dd>
        <dt className={s.muted}>Authentication</dt>
        <dd className="max-sm:mb-2">{apiKey ? API_METHOD[p.provider] : SUBSCRIPTION_METHOD[p.provider]}</dd>
        <dt className={s.muted}>Local runner</dt>
        <dd className="max-sm:mb-2">
          {apiKey ? (
            <span className={s.muted}>Not used: API key runs go through Agentopia&apos;s worker.</span>
          ) : (
            <span className="inline-flex items-center gap-2">
              <span aria-hidden className={cn("size-2 rounded-full", runnerOnline ? "bg-success" : "bg-mist/60")} />
              {runnerOnline ? "Online" : "Offline"}
            </span>
          )}
        </dd>
        <dt className={s.muted}>Usage limit</dt>
        <dd className="flex flex-col gap-0.5 max-sm:mb-2">
          <span>{limited ? "Usage limit reached" : p.status === "AUTHENTICATION_EXPIRED" ? "Authentication expired" : "No limit reported"}</span>
          {limited ? <span className={cn("text-xs", s.muted)}>Reset time not reported by provider. Tasks wait instead of switching to a paid key.</span> : null}
        </dd>
        <dt className={s.muted}>Usage</dt>
        <dd className={s.muted}>Usage details unavailable from provider.</dd>
      </dl>
    </article>
  );
}

/**
 * Provider cards for Claude Code and OpenAI Codex in the shape of the real Integrations page:
 * connection mode, status pill (same tones as the product), usage line, plus a legend of every
 * status and a local-runner panel with the three-step connect flow. Copy follows
 * content/marketing/ai-tools.ts. Defaults to Ready and Waiting for reset side by side.
 *
 * @example
 * <IntegrationShowcase />
 * <IntegrationShowcase providers={[{ provider: "ANTHROPIC", status: "RUNNING" }, { provider: "OPENAI", status: "READY", mode: "api_key" }]} />
 */
export function IntegrationShowcase({
  providers = [
    { provider: "ANTHROPIC", status: "READY", mode: "subscription" },
    { provider: "OPENAI", status: "WAITING_FOR_RESET", mode: "subscription" },
  ],
  showLegend = true,
  showRunner = true,
  surface = "dark",
  illustrative = true,
  className,
}: {
  providers?: ShowcaseProvider[];
  showLegend?: boolean;
  showRunner?: boolean;
  surface?: Surface;
  illustrative?: boolean;
  className?: string;
}) {
  const s = SURFACE[surface];
  const steps = connectSteps();
  const uid = useId();
  const runnerId = `${uid}-runner`;
  const statusId = `${uid}-status`;
  return (
    <div className={cn("flex flex-col gap-5 rounded-lg border p-4 sm:p-6", s.panel, className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-lg font-semibold tracking-tight">AI providers</h3>
        {illustrative ? <DemoBadge kind="illustrative" /> : null}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {providers.map((p) => (
          <ProviderCard key={`${p.provider}-${p.status}-${p.mode ?? "subscription"}`} p={p} surface={surface} idPrefix={uid} />
        ))}
      </div>

      {showRunner || showLegend ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          {showRunner ? (
            <section aria-labelledby={runnerId} className={cn("flex flex-col gap-3 rounded-md border p-5", s.inset)}>
              <h4 id={runnerId} className="flex items-center gap-2 text-sm font-semibold">
                <Terminal aria-hidden className={cn("size-4", s.icon)} />
                Local runner: connect in three steps
              </h4>
              <ol className="flex flex-col gap-3">
                {steps.map((st, i) => (
                  <li key={st.title} className="flex gap-3">
                    <span
                      aria-hidden
                      className={cn(
                        "inline-flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular",
                        s.marker,
                      )}
                    >
                      {i + 1}
                    </span>
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{st.title}</span>
                      <span className={cn("text-sm leading-relaxed", s.muted)}>{st.body}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
          {showLegend ? (
            <section aria-labelledby={statusId} className={cn("flex flex-col gap-3 rounded-md border p-5", s.inset)}>
              <h4 id={statusId} className="text-sm font-semibold">
                Statuses you may see
              </h4>
              <dl className="flex flex-col gap-2.5">
                {SHOWCASE_STATUSES.map((st) => (
                  <div key={st} className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                    <dt>
                      <Pill variant={STATUS_PILL[st]} dot={st === "RUNNING"}>
                        {PROVIDER_UI_STATUS_LABEL[st]}
                      </Pill>
                    </dt>
                    <dd className={cn("text-sm", s.muted)}>{STATUS_DETAIL[st]}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
