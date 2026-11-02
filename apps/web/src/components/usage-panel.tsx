import type { UsageTotals } from "@/hooks/api-shapes";
import { cn, formatNumber, formatUsd } from "@/lib/utils";

/**
 * Usage with provenance. Provider-reported numbers come from the provider's own
 * usage fields; estimated numbers are computed by Agentopia from token counts
 * and a price table; subscription quota is never readable, so it says so.
 */
export function UsageTotalsPanel({
  providerReported,
  estimated,
  className,
}: {
  providerReported?: UsageTotals | null;
  estimated?: UsageTotals | null;
  className?: string;
}) {
  return (
    <dl className={cn("grid gap-x-10 gap-y-6 border-y border-rule py-5 sm:grid-cols-3", className)}>
      <UsageColumn
        title="Provider-reported"
        hint="Exact figures returned by the provider with each response."
        totals={providerReported}
      />
      <UsageColumn
        title="Estimated"
        hint="Calculated by Agentopia from token counts when the provider did not report cost."
        totals={estimated}
      />
      <div className="flex flex-col gap-1">
        <dt className="text-sm font-medium">Subscription quota</dt>
        <dd className="text-2xl font-semibold tracking-tight text-fg-muted">Unavailable</dd>
        <dd className="text-xs leading-relaxed text-fg-muted">
          Claude and ChatGPT subscription limits are not exposed to apps, so Agentopia cannot show them.
        </dd>
      </div>
    </dl>
  );
}

function UsageColumn({ title, hint, totals }: { title: string; hint: string; totals?: UsageTotals | null }) {
  const empty = !totals || totals.records === 0;
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-sm font-medium">{title}</dt>
      <dd className="tabular text-2xl font-semibold tracking-tight">{empty ? formatUsd(0) : formatUsd(totals.costUsd)}</dd>
      <dd className="tabular text-xs text-fg-muted">
        {empty
          ? "No usage recorded"
          : `${formatNumber(totals.inputTokens)} in, ${formatNumber(totals.outputTokens)} out, ${formatNumber(totals.records)} ${totals.records === 1 ? "record" : "records"}`}
      </dd>
      <dd className="text-xs leading-relaxed text-fg-muted">{hint}</dd>
    </div>
  );
}
