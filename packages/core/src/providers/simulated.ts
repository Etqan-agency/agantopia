import type { ExecutionHooks, ExecutionRequest, ExecutionResult, ProviderAdapter } from "./types";
import { emptyUsage } from "./types";
import { abortStatus, sleep } from "./util";

export interface SimulatedOptions {
  /** Delay between simulated steps (ms). Default 150. */
  stepDelayMs?: number;
}

const PREFIX = "Simulated run (no provider was called)";

/**
 * Deterministic simulation adapter for demos and tests. It never calls a
 * provider and never claims real work. Brief markers:
 *  - `[simulate:fail]`  → FAILED
 *  - `[simulate:block]` → asks for approval first; denied → FAILED
 */
export function createSimulatedAdapter(opts: SimulatedOptions = {}): ProviderAdapter {
  const delay = opts.stepDelayMs ?? 150;
  return {
    kind: "SIMULATED",
    async verify() {
      return { ok: true, status: "VERIFIED", message: "Simulation needs no credentials", models: ["simulated"] };
    },
    async listModels() {
      return ["simulated"];
    },
    async run(req: ExecutionRequest, hooks: ExecutionHooks): Promise<ExecutionResult> {
      const usage = emptyUsage("unavailable", "simulated");
      const sessionId = `sim-${req.executionSessionId}`;
      const done = (status: ExecutionResult["status"], summary: string, error?: string): ExecutionResult => ({
        status,
        summary,
        providerSessionId: sessionId,
        usage,
        artifacts: status === "SUCCEEDED" ? [{ name: "summary.md", kind: "TEXT", content: summary, mimeType: "text/markdown" }] : [],
        error,
        numTurns: 0,
      });
      try {
        await hooks.onEvent({ type: "session", providerSessionId: sessionId });
        await hooks.onEvent({ type: "message", role: "assistant", text: `${PREFIX}. Reading the task brief.` });
        await sleep(delay, req.signal);
        if (req.taskBrief.includes("[simulate:block]")) {
          const decision = await hooks.requestApproval({
            kind: "TOOL_USE",
            title: "Simulated: allow writing files in the workspace",
            payload: { tool: "Write", simulated: true },
          });
          if (!decision.approved) {
            await hooks.onUsage(usage);
            return done("FAILED", `${PREFIX}. Approval was denied${decision.note ? `: ${decision.note}` : ""}.`, "approval denied");
          }
        }
        await hooks.onEvent({ type: "tool_use", tool: "Read", input: { simulated: true, path: "README.md" }, toolUseId: "sim-1" });
        await sleep(delay, req.signal);
        await hooks.onEvent({ type: "tool_result", tool: "Read", output: "(simulated) no file was read" });
        await hooks.onEvent({ type: "progress", text: "Drafting a simulated deliverable" });
        await sleep(delay, req.signal);
        await hooks.onUsage(usage);
        if (req.taskBrief.includes("[simulate:fail]")) {
          await hooks.onEvent({ type: "message", role: "assistant", text: `${PREFIX}. Simulated failure requested by the brief.` });
          return done("FAILED", `${PREFIX}. The brief requested a simulated failure.`, "simulated failure");
        }
        const firstLine = req.taskBrief.split("\n").find((l) => l.trim())?.trim().slice(0, 160) ?? "the task";
        const summary = `${PREFIX}.\n\nThis is a placeholder deliverable for: ${firstLine}\n\nNo files were changed and no model was used. Connect an Anthropic or OpenAI provider to have this employee do real work.`;
        await hooks.onEvent({ type: "message", role: "assistant", text: summary });
        return done("SUCCEEDED", summary);
      } catch (e) {
        if (req.signal.aborted) return done(abortStatus(req.signal), `${PREFIX}. Stopped: ${String(req.signal.reason ?? "aborted")}.`, String(req.signal.reason ?? "aborted"));
        throw e;
      }
    },
  };
}
