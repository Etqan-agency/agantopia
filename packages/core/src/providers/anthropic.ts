import Anthropic from "@anthropic-ai/sdk/index.js";
import {
  query,
  type CanUseTool,
  type Options,
  type PermissionResult,
  type SDKMessage,
} from "@anthropic-ai/claude-agent-sdk";
import type {
  ApprovalKindRequest,
  ExecutionArtifact,
  ExecutionHooks,
  ExecutionRequest,
  ExecutionResult,
  ProviderAdapter,
  UsageReport,
  VerifyResult,
} from "./types";
import { emptyUsage } from "./types";
import {
  abortStatus,
  composeUserPrompt,
  truncate,
  workspaceDiff,
} from "./util";
import { classifyProviderError } from "./classify";

/** Adds errorKind/limit to a failed result when the error text is a known provider condition (rate/usage limit, auth). */
function withErrorKind(
  r: ExecutionResult,
  httpStatus?: number
): ExecutionResult {
  if (r.status !== "FAILED" || !r.error) return r;
  const c = classifyProviderError("ANTHROPIC", { text: r.error, httpStatus });
  if (c.kind === "OTHER") return { ...r, errorKind: "OTHER" };
  return {
    ...r,
    errorKind: c.kind,
    limit: {
      resetAt: c.resetAt?.toISOString(),
      retryAfterAt: c.retryAfterAt?.toISOString(),
      source: c.source,
    },
  };
}

/** Minimal shape of the Agent SDK `query` function (injectable for tests). */
export type QueryFn = (params: {
  prompt: string;
  options?: Options;
}) => AsyncIterable<SDKMessage>;

/** Minimal client surface used by verify/listModels (injectable for tests). */
export interface AnthropicModelsClient {
  models: {
    list(params?: {
      limit?: number;
    }): PromiseLike<{ data: Array<{ id: string }> }>;
  };
}

export interface AnthropicAdapterOptions {
  queryImpl?: QueryFn;
  clientFactory?: (apiKey?: string) => AnthropicModelsClient;
}

const DESTRUCTIVE =
  /\b(rm\s+-[a-z]*r|rm\s+-[a-z]*f|git\s+(reset\s+--hard|clean\s+-[a-z]*f|push\s+(-f|--force))|drop\s+(table|database)|mkfs|dd\s+if=|truncate\s+)/i;
const PUBLISH =
  /\b(git\s+push|npm\s+publish|pnpm\s+publish|yarn\s+publish|docker\s+push|gh\s+(release|pr)\s+create|vercel\s+(deploy|--prod)|curl\s+.*-X\s*(POST|PUT|DELETE))/i;

/** Classifies a tool request into an approval kind. */
export function classifyToolUse(
  tool: string,
  input: Record<string, unknown>
): ApprovalKindRequest {
  const command = typeof input.command === "string" ? input.command : "";
  if (tool === "Bash" && DESTRUCTIVE.test(command)) return "DESTRUCTIVE";
  if (tool === "Bash" && PUBLISH.test(command)) return "PUBLISH";
  return "TOOL_USE";
}

function describeTool(tool: string, input: Record<string, unknown>): string {
  const target = (input.command ??
    input.file_path ??
    input.path ??
    input.url ??
    input.pattern) as unknown;
  return typeof target === "string"
    ? `Allow ${tool}: ${truncate(target, 160)}`
    : `Allow ${tool}`;
}

function toolResultText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((b) =>
        b &&
        typeof b === "object" &&
        "text" in b &&
        typeof (b as { text: unknown }).text === "string"
          ? (b as { text: string }).text
          : ""
      )
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

/** Maps a provider-reported usage block to a UsageReport. */
function usageFromResult(
  msg: Extract<SDKMessage, { type: "result" }>,
  model?: string
): UsageReport {
  const u = msg.usage as unknown as Record<string, number | null | undefined>; // SDK boundary: BetaUsage fields
  return {
    inputTokens: Number(u.input_tokens ?? 0),
    outputTokens: Number(u.output_tokens ?? 0),
    cacheReadTokens: Number(u.cache_read_input_tokens ?? 0),
    cacheWriteTokens: Number(u.cache_creation_input_tokens ?? 0),
    costUsd: typeof msg.total_cost_usd === "number" ? msg.total_cost_usd : null,
    costSource:
      typeof msg.total_cost_usd === "number"
        ? "provider_reported"
        : "unavailable",
    model,
  };
}

/**
 * Claude Agent SDK adapter. Uses only documented options (see
 * docs/integrations-research.md §1.5). Never uses bypassPermissions.
 */
export function createAnthropicAdapter(
  opts: AnthropicAdapterOptions = {}
): ProviderAdapter {
  const queryImpl: QueryFn = opts.queryImpl ?? (query as QueryFn);
  const clientFactory =
    opts.clientFactory ??
    ((apiKey?: string) =>
      new Anthropic(apiKey ? { apiKey } : {}) as AnthropicModelsClient);

  async function listModels(secret?: string): Promise<string[]> {
    const page = await clientFactory(secret).models.list({ limit: 100 });
    return page.data.map((m) => m.id);
  }

  return {
    kind: "ANTHROPIC",
    listModels,
    async verify(secret?: string): Promise<VerifyResult> {
      try {
        const models = await listModels(secret);
        return { ok: true, status: "VERIFIED", models };
      } catch (e) {
        const status = (e as { status?: number }).status;
        const message =
          status === 401 || status === 403
            ? "The API key was rejected by Anthropic"
            : `Verification failed: ${(e as Error).message}`;
        return { ok: false, status: "INVALID", message };
      }
    },
    async run(
      req: ExecutionRequest,
      hooks: ExecutionHooks
    ): Promise<ExecutionResult> {
      const ac = new AbortController();
      const onAbort = () => ac.abort(req.signal.reason);
      if (req.signal.aborted) onAbort();
      else req.signal.addEventListener("abort", onAbort, { once: true });

      const s = req.settings;
      const canUseTool: CanUseTool = async (
        toolName,
        input
      ): Promise<PermissionResult> => {
        if (s.autoApprove && classifyToolUse(toolName, input) === "TOOL_USE")
          return { behavior: "allow", updatedInput: input };
        const decision = await hooks.requestApproval({
          kind: classifyToolUse(toolName, input),
          title: describeTool(toolName, input),
          payload: { tool: toolName, input },
        });
        return decision.approved
          ? { behavior: "allow", updatedInput: input }
          : {
              behavior: "deny",
              message: decision.note
                ? `Denied by the owner: ${decision.note}`
                : "Denied by the owner",
            };
      };

      const env: Record<string, string | undefined> = { ...process.env };
      if (req.secret) env.ANTHROPIC_API_KEY = req.secret;
      let stderrTail = "";
      const options: Options = {
        cwd: req.workspacePath,
        systemPrompt: req.systemPrompt,
        model: req.model,
        permissionMode: s.permissionMode,
        allowedTools: s.allowedTools,
        disallowedTools: s.disallowedTools,
        maxTurns: s.maxTurns,
        maxBudgetUsd: s.maxCostUsd,
        abortController: ac,
        env,
        settingSources: [],
        includePartialMessages: false,
        canUseTool,
        stderr: (d: string) => {
          stderrTail = (stderrTail + d).slice(-2000);
        },
      };
      if (req.resumeSessionId) options.resume = req.resumeSessionId;
      if (s.reasoning) options.effort = s.reasoning;

      const toolNames = new Map<string, string>();
      let providerSessionId: string | null = req.resumeSessionId ?? null;
      let model = req.model;
      let lastText = "";
      let usage: UsageReport = emptyUsage("unavailable", model);
      let result: Extract<SDKMessage, { type: "result" }> | null = null;
      let thrown: Error | null = null;

      try {
        for await (const msg of queryImpl({
          prompt: composeUserPrompt(req.taskBrief, req.memoryContext),
          options,
        })) {
          if (msg.type === "system" && msg.subtype === "init") {
            providerSessionId = msg.session_id;
            model = msg.model || model;
            await hooks.onEvent({
              type: "session",
              providerSessionId: msg.session_id,
            });
          } else if (msg.type === "assistant") {
            for (const block of msg.message.content) {
              if (block.type === "text" && block.text.trim()) {
                lastText = block.text;
                await hooks.onEvent({
                  type: "message",
                  role: "assistant",
                  text: block.text,
                });
              } else if (block.type === "tool_use") {
                toolNames.set(block.id, block.name);
                await hooks.onEvent({
                  type: "tool_use",
                  tool: block.name,
                  input: block.input,
                  toolUseId: block.id,
                });
              }
            }
          } else if (
            msg.type === "user" &&
            Array.isArray(msg.message.content)
          ) {
            for (const block of msg.message.content) {
              if (block.type === "tool_result") {
                await hooks.onEvent({
                  type: "tool_result",
                  tool: toolNames.get(block.tool_use_id),
                  output: truncate(toolResultText(block.content), 4000),
                  isError: block.is_error === true,
                });
              }
            }
          } else if (msg.type === "result") {
            result = msg;
            providerSessionId = msg.session_id || providerSessionId;
            usage = usageFromResult(msg, model);
            await hooks.onUsage(usage);
          }
        }
      } catch (e) {
        thrown = e as Error;
      } finally {
        req.signal.removeEventListener("abort", onAbort);
      }

      const artifacts: ExecutionArtifact[] = [];
      const summaryText =
        (result && result.subtype === "success" ? result.result : "") ||
        lastText;
      if (summaryText.trim())
        artifacts.push({
          name: "summary.md",
          kind: "TEXT",
          content: summaryText,
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

      const base = {
        providerSessionId,
        usage,
        artifacts,
        numTurns: result?.num_turns,
      };
      if (req.signal.aborted) {
        return {
          ...base,
          status: abortStatus(req.signal),
          summary: summaryText || "Stopped before completion",
          error: String(req.signal.reason ?? "aborted"),
        };
      }
      if (thrown && !result) {
        return withErrorKind(
          {
            ...base,
            status: "FAILED",
            summary: summaryText,
            error: truncate(
              `${thrown.message}${stderrTail ? `\n${stderrTail}` : ""}`,
              2000
            ),
          },
          (thrown as { status?: number }).status
        );
      }
      if (!result)
        return {
          ...base,
          status: "FAILED",
          summary: summaryText,
          error: "The Agent SDK ended without a result message",
        };
      if (result.subtype !== "success" || result.is_error) {
        const err =
          result.subtype === "error_max_budget_usd"
            ? "Stopped: per-execution budget reached"
            : result.subtype === "error_max_turns"
            ? "Stopped: maximum turns reached"
            : result.subtype === "success"
            ? result.result || "The run reported an error"
            : result.errors.join("; ") || result.subtype;
        return withErrorKind({
          ...base,
          status: "FAILED",
          summary: summaryText,
          error: err,
          ...(result.subtype === "error_max_budget_usd"
            ? { terminal: true }
            : {}),
        });
      }
      return { ...base, status: "SUCCEEDED", summary: summaryText };
    },
  };
}
