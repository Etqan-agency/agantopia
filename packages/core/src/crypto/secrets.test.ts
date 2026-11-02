import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, generateToken, hashToken, secretLast4 } from "./secrets";

describe("crypto/secrets", () => {
  it("round-trips and produces a versioned format with fresh IVs", () => {
    const a = encryptSecret("sk-test-1234567890");
    const b = encryptSecret("sk-test-1234567890");
    expect(a).toMatch(/^v1:[^:]+:[^:]+:[^:]+$/);
    expect(a).not.toEqual(b);
    expect(decryptSecret(a)).toBe("sk-test-1234567890");
  });

  it("rejects tampered ciphertext", () => {
    const c = encryptSecret("hello world");
    const parts = c.split(":");
    const ct = Buffer.from(parts[3]!, "base64");
    ct[0] = ct[0]! ^ 0xff;
    parts[3] = ct.toString("base64");
    expect(() => decryptSecret(parts.join(":"))).toThrow();
    expect(() => decryptSecret("v0:a:b:c")).toThrow();
  });

  it("rejects a wrong key", () => {
    const c = encryptSecret("abc");
    const prev = process.env.AGENTOPIA_ENCRYPTION_KEY;
    process.env.AGENTOPIA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    try {
      expect(() => decryptSecret(c)).toThrow();
    } finally {
      process.env.AGENTOPIA_ENCRYPTION_KEY = prev;
    }
  });

  it("helpers", () => {
    expect(secretLast4("sk-abcdef1234")).toBe("1234");
    expect(hashToken("x")).toMatch(/^[0-9a-f]{64}$/);
    const t = generateToken();
    expect(Buffer.from(t, "base64url")).toHaveLength(32);
    expect(t).not.toEqual(generateToken());
    // Never starts with "-" / "_": `--token <token>` would otherwise be parsed as a flag.
    for (let i = 0; i < 200; i++) expect(generateToken()).toMatch(/^[A-Za-z0-9]/);
  });
});
