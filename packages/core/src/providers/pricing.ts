/**
 * Per-1M-token price table used ONLY for usage estimates (UsageRecord.source =
 * ESTIMATED). These are editable estimates, not billing data: verify against
 * the vendor pricing pages before relying on them.
 *  - Anthropic rows: Claude API model table snapshot (2026-10-06) from the
 *    claude-api reference; cache read ≈ 0.1× input, cache write ≈ 1.25× input.
 *  - OpenAI rows: unverified estimates from public pricing (no live check in this session).
 * The Claude Agent SDK reports `total_cost_usd` itself, so Anthropic execution
 * costs are provider_reported; this table matters for Codex and for direct
 * Messages API calls (planning/review).
 */
export interface ModelPrice {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export const PRICING_PER_MTOK: Record<string, ModelPrice> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
  "gpt-5": { input: 1.25, output: 10, cacheRead: 0.125, cacheWrite: 0 },
  "gpt-5-codex": { input: 1.25, output: 10, cacheRead: 0.125, cacheWrite: 0 },
  "gpt-5-mini": { input: 0.25, output: 2, cacheRead: 0.025, cacheWrite: 0 },
};

/** Looks up a model price (exact id, then longest known prefix). */
export function priceFor(model: string | undefined | null): ModelPrice | null {
  if (!model) return null;
  const exact = PRICING_PER_MTOK[model];
  if (exact) return exact;
  const key = Object.keys(PRICING_PER_MTOK)
    .filter((k) => model.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return key ? PRICING_PER_MTOK[key]! : null;
}

/**
 * Estimates USD cost. `inputTokens` here means *uncached* input tokens.
 * Returns null when the model is unknown.
 */
export function estimateCostUsd(
  model: string | undefined | null,
  t: { inputTokens: number; outputTokens: number; cacheReadTokens?: number; cacheWriteTokens?: number },
): number | null {
  const p = priceFor(model);
  if (!p) return null;
  const cost =
    (t.inputTokens * p.input + t.outputTokens * p.output + (t.cacheReadTokens ?? 0) * p.cacheRead + (t.cacheWriteTokens ?? 0) * p.cacheWrite) / 1_000_000;
  return Math.round(cost * 1e6) / 1e6;
}
