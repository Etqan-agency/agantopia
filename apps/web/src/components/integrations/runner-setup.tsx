"use client";

import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

const noop = () => () => {};

const CLI: Record<"ANTHROPIC" | "OPENAI", { name: string; install: string; open: string; login: string }> = {
  ANTHROPIC: { name: "Claude Code", install: "npm install -g @anthropic-ai/claude-code", open: "claude", login: "/login" },
  OPENAI: { name: "Codex CLI", install: "npm install -g @openai/codex", open: "codex", login: "codex login" },
};

function Code({ children }: { children: string }) {
  return <code className="rounded-sm bg-surface-sunken px-1 py-0.5 font-mono text-xs break-all">{children}</code>;
}

/**
 * How to run employees on the person's own subscription. Agentopia never
 * touches vendor credentials: sign-in happens in the vendor's own CLI flow.
 */
export function RunnerSetupSteps({ provider, className }: { provider: "ANTHROPIC" | "OPENAI"; className?: string }) {
  const cli = CLI[provider];
  const server = useSyncExternalStore(noop, () => window.location.origin, () => "http://localhost:3000");
  return (
    <ol aria-label={`Set up ${cli.name} on your machine`} className={cn("flex list-decimal flex-col gap-2 pl-5 text-sm leading-relaxed", className)}>
      <li>
        Install or open the {cli.name} on your machine: <Code>{cli.install}</Code>
        {provider === "ANTHROPIC" ? (
          <>
            , then run <Code>{cli.open}</Code>
          </>
        ) : null}
        .
      </li>
      <li>
        Sign in through the vendor&apos;s own flow: {provider === "ANTHROPIC" ? <>type <Code>{cli.login}</Code> inside Claude Code</> : <>run <Code>{cli.login}</Code></>}.
        Agentopia never sees your password or token.
      </li>
      <li>
        Create a runner token under Local runners below, then start the runner: <Code>{`pnpm runner --server ${server} --token <runner token>`}</Code>
      </li>
    </ol>
  );
}
