import type { ProviderAdapter, ProviderKind } from "./types";
import { createAnthropicAdapter } from "./anthropic";
import { createCodexAdapter } from "./openai-codex";
import { createSimulatedAdapter } from "./simulated";

const cache = new Map<ProviderKind, ProviderAdapter>();

/** Returns the (cached) default adapter for a provider kind. */
export function getProviderAdapter(kind: ProviderKind): ProviderAdapter {
  let a = cache.get(kind);
  if (!a) {
    a = kind === "ANTHROPIC" ? createAnthropicAdapter() : kind === "OPENAI" ? createCodexAdapter() : createSimulatedAdapter();
    cache.set(kind, a);
  }
  return a;
}

export * from "./types";
export { createAnthropicAdapter, classifyToolUse, type QueryFn, type AnthropicAdapterOptions } from "./anthropic";
export { createCodexAdapter, codexUsage, codexSubscriptionEnv, type CodexAdapterOptions, type CodexLike, type CodexThreadLike } from "./openai-codex";
export { createSimulatedAdapter, type SimulatedOptions } from "./simulated";
export { PRICING_PER_MTOK, priceFor, estimateCostUsd, type ModelPrice } from "./pricing";
export { createClaudeCliAdapter, buildClaudeArgs, claudeChildEnv, claudeCliUsage, type ClaudeCliAdapterOptions, type SpawnLike, type ChildLike } from "./claude-cli";
export * from "./classify";
