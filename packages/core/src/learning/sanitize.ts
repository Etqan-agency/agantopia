/**
 * Redaction of credential-looking strings from fetched/learned content before
 * anything is stored. Fetched text is untrusted data: it is never executed and
 * never treated as instructions; this module only removes secrets.
 */
const SECRET_PATTERNS: RegExp[] = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /\bsk-ant-[A-Za-z0-9_-]{16,}/g,
  /\bsk-(?:proj-|live-|test-)?[A-Za-z0-9_-]{20,}/g,
  /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}/g,
  /\bgithub_pat_[A-Za-z0-9_]{30,}/g,
  /\bglpat-[A-Za-z0-9_-]{20,}/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bAIza[0-9A-Za-z_-]{35}\b/g,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/g,
  /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{16,}/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
];

/** `api_key = "..."`, `token: ...`, `password=...` style assignments with long values. */
const ASSIGNMENT = /\b((?:api[_-]?key|secret|access[_-]?token|auth[_-]?token|token|password|passwd)\s*[:=]\s*["']?)([A-Za-z0-9_\-/+=.]{16,})/gi;

export const REDACTED = "[REDACTED]";

/** Replace anything that looks like an API key, token or private key with `[REDACTED]`. */
export function redactSecrets(text: string): string {
  let out = text;
  for (const re of SECRET_PATTERNS) out = out.replace(re, REDACTED);
  out = out.replace(ASSIGNMENT, (_m, prefix: string) => `${prefix}${REDACTED}`);
  return out;
}
