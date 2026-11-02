import { pino, type Logger, type LoggerOptions } from "pino";

/** Paths redacted from every log line (credentials must never reach logs). */
export const REDACT_PATHS = [
  "apiKey",
  "authorization",
  "encryptedSecret",
  "secret",
  "token",
  "*.apiKey",
  "*.secret",
  "*.authorization",
  "*.encryptedSecret",
  "*.token",
  "headers.authorization",
  "env.ANTHROPIC_API_KEY",
  "env.OPENAI_API_KEY",
  "env.CODEX_API_KEY",
];

/** Base pino options with redaction; apps may add a transport (e.g. pino-pretty). */
export function loggerOptions(extra: LoggerOptions = {}): LoggerOptions {
  return {
    level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "test" ? "silent" : "info"),
    redact: { paths: REDACT_PATHS, censor: "[redacted]" },
    ...extra,
  };
}

/** Creates a redacting logger. */
export function createLogger(name: string, extra: LoggerOptions = {}): Logger {
  return pino(loggerOptions({ name, ...extra }));
}

/** Shared core logger. */
export const logger: Logger = createLogger("agentopia-core");
export type { Logger };
