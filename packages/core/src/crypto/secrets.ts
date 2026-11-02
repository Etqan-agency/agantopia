import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const VERSION = "v1";

function getKey(): Buffer {
  const raw = process.env.AGENTOPIA_ENCRYPTION_KEY;
  if (!raw) throw new Error("AGENTOPIA_ENCRYPTION_KEY is not set");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("AGENTOPIA_ENCRYPTION_KEY must be base64 for exactly 32 bytes");
  return key;
}

/** Encrypts a secret with AES-256-GCM. Output: `v1:<iv b64>:<tag b64>:<ciphertext b64>`. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(":");
}

/** Decrypts a value produced by `encryptSecret`. Throws on tampering or a wrong key. */
export function decryptSecret(cipher: string): string {
  const parts = cipher.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) throw new Error("Unsupported secret format");
  const [, ivB64, tagB64, ctB64] = parts as [string, string, string, string];
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]).toString("utf8");
}

/** Last four characters of a secret for display (never the full value). */
export function secretLast4(s: string): string {
  return s.length <= 4 ? s : s.slice(-4);
}

/** SHA-256 hex digest of a bearer token (runner tokens are stored hashed). */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * 32 random bytes encoded as base64url (runner tokens, one-time secrets).
 * The first character is always alphanumeric: a token starting with "-" or "_" is read as a
 * flag by `--token <token>` (Node's parseArgs rejects it as ambiguous), so it would be unusable
 * from the documented command line.
 */
export function generateToken(): string {
  for (;;) {
    const t = randomBytes(32).toString("base64url");
    if (/^[A-Za-z0-9]/.test(t)) return t;
  }
}
