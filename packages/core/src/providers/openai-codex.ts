import OpenAI from "openai/index.js";
import {
  Codex,
  type CodexOptions,
  type ThreadEvent,
  type ThreadOptions,
} from "@openai/codex-sdk";
import type {
  ExecutionArtifact,
  ExecutionHooks,
  ExecutionRequest,
  ExecutionResult,
  ProviderAdapter,
  UsageReport,
  VerifyResult,
} from "./types";
import { emptyUsage } from "./types";
import { estimateCostUsd } from "./pricing";
import {
  abortStatus,
  composeUserPrompt,
  stringEnv,
  truncate,
  workspaceDiff,
} from "./util";
import { classifyProviderError } from "./classify";

/** Env for a subscription-mode Codex child: process env without OPENAI_API_KEY / CODEX_API_KEY, so the CLI uses the user's own `codex login`. */
export function codexSubscriptionEnv(
  base: NodeJS.ProcessEnv = process.env
): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(base))
    if (typeof v === "string") env[k] = v;
  delete env.OPENAI_API_KEY;
  delete env.CODEX_API_KEY;
  return env;
}

/** Minimal thread surface used by the adapter (injectable for tests). */
export interface CodexThreadLike {
  readonly id: string | null;
  runStreamed(
    input: string,
    turnOptions?: { signal?: AbortSignal }
  ): Promise<{ events: AsyncIterable<ThreadEvent> }>;
}
export interface CodexLike {
  startThread(options?: ThreadOptions): CodexThreadLike;
  resumeThread(id: string, options?: ThreadOptions): CodexThreadLike;
}
export interface OpenAIModelsClient {
  models: { list(): PromiseLike<{ data: Array<{ id: string }> }> };
}

export interface CodexAdapterOptions {
  codexFactory?: (options: CodexOptions) => CodexLike;
  clientFactory?: (apiKey?: string) => OpenAIModelsClient;
}

/** Wire-safe bounds (runner protocol: message text max 20000, progress text max 5000). */
const MESSAGE_TEXT_MAX = 19_000;
const PROGRESS_TEXT_MAX = 4_900;

/**
 * Converts Codex token usage into a UsageReport. API-key runs get an
 * estimated cost; under the user's own ChatGPT plan (`subscription`) nothing
 * is billed per token, so the cost is null / "unavailable" (as for Claude Code).
 */
export function codexUsage(
  u: {
    input_tokens: number;
    cached_input_tokens: number;
    output_tokens: number;
    cache_write_input_tokens?: number;
  },
  model?: string,
  mode: "subscription" | "api" = "api"
): UsageReport {
  const cached = u.cached_input_tokens ?? 0;
  const uncached = Math.max(0, (u.input_tokens ?? 0) - cached);
  if (mode === "subscription") {
    return {
      inputTokens: u.input_tokens ?? 0,
      outputTokens: u.output_tokens ?? 0,
      cacheReadTokens: cached,
      cacheWriteTokens: u.cache_write_input_tokens ?? 0,
      costUsd: null,
      costSource: "unavailable",
      tokenSource: "provider_reported",
      model,
    };
  }
  const cost = estimateCostUsd(model, {
    inputTokens: uncached,
    outputTokens: u.output_tokens ?? 0,
    cacheReadTokens: cached,
    cacheWriteTokens: u.cache_write_input_tokens ?? 0,
  });
  return {
    inputTokens: u.input_tokens ?? 0,
    outputTokens: u.output_tokens ?? 0,
    cacheReadTokens: cached,
    cacheWriteTokens: u.cache_write_input_tokens ?? 0,
    costUsd: cost,
    costSource: cost === null ? "unavailable" : "estimated",
    model,
  };
}

function addUsage(a: UsageReport, b: UsageReport): UsageReport {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
    costUsd:
      a.costUsd === null && b.costUsd === null
        ? null
        : (a.costUsd ?? 0) + (b.costUsd ?? 0),
    costSource: b.costSource === "unavailable" ? a.costSource : b.costSource,
    model: b.model ?? a.model,
    ...(b.tokenSource ?? a.tokenSource
      ? { tokenSource: b.tokenSource ?? a.tokenSource }
      : {}),
  };
}

/**
 * OpenAI Codex SDK adapter. `approvalPolicy: "never"` because the SDK stream
 * has no interactive approval round-trip; Agentopia asks the owner once before
 * the run instead (unless acceptEdits/autoApprove). Network stays disabled.
 */
export function createCodexAdapter(
  opts: CodexAdapterOptions = {}
): ProviderAdapter {
  const codexFactory =
    opts.codexFactory ?? ((o: CodexOptions) => new Codex(o) as CodexLike);
  const clientFactory =
    opts.clientFactory ??
    ((apiKey?: string) =>
      new OpenAI(apiKey ? { apiKey } : {}) as unknown as OpenAIModelsClient);

  async function listModels(secret?: string): Promise<string[]> {
    const page = await clientFactory(secret).models.list();
    return page.data.map((m) => m.id);
  }

  return {
    kind: "OPENAI",
    listModels,
    async verify(secret?: string): Promise<VerifyResult> {
      try {
        return {
          ok: true,
          status: "VERIFIED",
          models: await listModels(secret),
        };
      } catch (e) {
        const status = (e as { status?: number }).status;
        return {
          ok: false,
          status: "INVALID",
          message:
            status === 401
              ? "The API key was rejected by OpenAI"
              : `Verification failed: ${(e as Error).message}`,
        };
      }
    },
    async run(
      req: ExecutionRequest,
      hooks: ExecutionHooks
    ): Promise<ExecutionResult> {
      const s = req.settings;
      let usage = emptyUsage("unavailable", req.model);
      const artifacts: ExecutionArtifact[] = [];
      let providerSessionId: string | null = req.resumeSessionId ?? null;

      if (
        s.permissionMode !== "acceptEdits" &&
        !s.autoApprove &&
        s.sandboxMode !== "read-only"
      ) {
        const d = await hooks.requestApproval({
          kind: "TOOL_USE",
          title: "Allow Codex to edit the workspace",
          payload: {
            sandboxMode: s.sandboxMode,
            workspace: req.workspacePath,
            network: false,
          },
        });
        if (!d.approved)
          return {
            status: "FAILED",
            summary: "",
            usage,
            artifacts,
            error: `Approval denied${d.note ? `: ${d.note}` : ""}`,
            providerSessionId,
          };
      }

      // Subscription mode: the user's own CLI + `codex login` (ChatGPT). No key is injected and env keys are stripped.
      const subscription = req.authMode === "SUBSCRIPTION_CLI" && !req.secret;
      const codexOptions: CodexOptions = subscription
        ? { env: codexSubscriptionEnv() }
        : { env: stringEnv() };
      if (subscription && req.binaryPath)
        codexOptions.codexPathOverride = req.binaryPath;
      if (!subscription && req.secret) codexOptions.apiKey = req.secret;
      const codex = codexFactory(codexOptions);
      const threadOptions: ThreadOptions = {
        workingDirectory: req.workspacePath,
        skipGitRepoCheck: true,
        sandboxMode: s.sandboxMode,
        approvalPolicy: "never",
        networkAccessEnabled: false,
        model: req.model,
      };
      if (s.reasoning) threadOptions.modelReasoningEffort = s.reasoning;
      const thread = req.resumeSessionId
        ? codex.resumeThread(req.resumeSessionId, threadOptions)
        : codex.startThread(threadOptions);

      // The system prompt is prepended: Codex threads take a single input string.
      const input = `${req.systemPrompt}\n\n---\n\n${composeUserPrompt(
        req.taskBrief,
        req.memoryContext
      )}`;
      let lastMessage = "";
      let failure: string | null = null;
      let turns = 0;
      try {
        const { events } = await thread.runStreamed(input, {
          signal: req.signal,
        });
        for await (const ev of events) {
          switch (ev.type) {
            case "thread.started":
              providerSessionId = ev.thread_id;
              await hooks.onEvent({
                type: "session",
                providerSessionId: ev.thread_id,
              });
              break;
            case "turn.completed": {
              turns += 1;
              const u = codexUsage(
                ev.usage,
                req.model,
                subscription ? "subscription" : "api"
              );
              usage = addUsage(usage, u);
              await hooks.onUsage(usage);
              break;
            }
            case "turn.failed":
              failure = ev.error.message;
              break;
            case "error":
              failure = ev.message;
              break;
            case "item.completed": {
              const item = ev.item;
              if (item.type === "agent_message") {
                lastMessage = item.text;
                await hooks.onEvent({
                  type: "message",
                  role: "assistant",
                  text: truncate(item.text, MESSAGE_TEXT_MAX),
                });
              } else if (item.type === "command_execution") {
                await hooks.onEvent({
                  type: "tool_use",
                  tool: "shell",
                  input: { command: item.command },
                  toolUseId: item.id,
                });
                await hooks.onEvent({
                  type: "tool_result",
                  tool: "shell",
                  output: truncate(item.aggregated_output ?? "", 4000),
                  isError:
                    item.status === "failed" || (item.exit_code ?? 0) !== 0,
                });
              } else if (item.type === "file_change") {
                await hooks.onEvent({
                  type: "tool_use",
                  tool: "apply_patch",
                  input: { changes: item.changes },
                  toolUseId: item.id,
                });
              } else if (item.type === "mcp_tool_call") {
                await hooks.onEvent({
                  type: "tool_use",
                  tool: `${item.server}.${item.tool}`,
                  input: item.arguments,
                  toolUseId: item.id,
                });
              } else if (item.type === "web_search") {
                await hooks.onEvent({
                  type: "tool_use",
                  tool: "web_search",
                  input: { query: item.query },
                  toolUseId: item.id,
                });
              } else if (item.type === "reasoning") {
                await hooks.onEvent({
                  type: "progress",
                  text: truncate(item.text, 1000),
                });
              } else if (item.type === "todo_list") {
                await hooks.onEvent({
                  type: "progress",
                  text: truncate(
                    item.items
                      .map((t) => `${t.completed ? "[x]" : "[ ]"} ${t.text}`)
                      .join("\n"),
                    PROGRESS_TEXT_MAX
                  ),
                });
              } else if (item.type === "error") {
                failure = item.message;
              }
              break;
            }
            default:
              break;
          }
        }
      } catch (e) {
        if (!req.signal.aborted) failure = (e as Error).message;
      }
      providerSessionId = providerSessionId ?? thread.id;

      if (lastMessage.trim())
        artifacts.push({
          name: "summary.md",
          kind: "TEXT",
          content: lastMessage,
          mimeType: "text/markdown",
        });
      const diff = await workspaceDiff(req.workspacePath).catch(() => null);
      if (diff)
        artifacts.push({
          name: "workspace.diff",
          kind: "DIFF",
          content: diff,
          mimeType: "text/x-diff",
        });
      const base = { providerSessionId, usage, artifacts, numTurns: turns };
      if (req.signal.aborted)
        return {
          ...base,
          status: abortStatus(req.signal),
          summary: lastMessage,
          error: String(req.signal.reason ?? "aborted"),
        };
      if (failure) {
        const c = classifyProviderError("OPENAI", { text: failure });
        if (c.kind !== "OTHER") {
          return {
            ...base,
            status: "FAILED",
            summary: lastMessage,
            error: truncate(c.message, 2000),
            errorKind: c.kind,
            limit: {
              resetAt: c.resetAt?.toISOString(),
              retryAfterAt: c.retryAfterAt?.toISOString(),
              source: c.source,
            },
          };
        }
        return {
          ...base,
          status: "FAILED",
          summary: lastMessage,
          error: truncate(failure, 2000),
          errorKind: "OTHER",
        };
      }
      return { ...base, status: "SUCCEEDED", summary: lastMessage };
    },
  };
}
