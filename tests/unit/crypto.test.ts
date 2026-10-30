import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { CryptoError, isVaultBundle, maskKey, parseMasterKey, rotateMasterKey, vaultDeleteKey, vaultGetKey, vaultPutKey } from "@/lib/crypto";

const master = randomBytes(32);

describe("BYOK vault crypto", () => {
  it("roundtrips a key", () => {
    const b = vaultPutKey(null, "u1", "openai", "sk-test-1234567890", master);
    expect(isVaultBundle(b)).toBe(true);
    expect(vaultGetKey(b, "u1", "openai", master)).toBe("sk-test-1234567890");
  });

  it("never stores plaintext and uses a fresh IV per encryption", () => {
    const a = vaultPutKey(null, "u1", "openai", "sk-same", master);
    const b = vaultPutKey(a, "u1", "anthropic", "sk-same", master);
    expect(JSON.stringify(b)).not.toContain("sk-same");
    expect(b.keys.openai).not.toEqual(b.keys.anthropic);
  });

  it("fails with a tampered ciphertext", () => {
    const b = vaultPutKey(null, "u1", "openai", "sk-secret", master);
    const parts = b.keys.openai!.split(".");
    parts[2] = Buffer.from("tampered").toString("base64url");
    expect(() => vaultGetKey({ ...b, keys: { openai: parts.join(".") } }, "u1", "openai", master)).toThrow(CryptoError);
  });

  it("is bound to the owning user (ciphertext cannot be moved between accounts)", () => {
    const b = vaultPutKey(null, "alice", "openai", "sk-alice", master);
    expect(() => vaultGetKey(b, "mallory", "openai", master)).toThrow(CryptoError);
  });

  it("is bound to the provider slot", () => {
    const b = vaultPutKey(null, "u1", "openai", "sk-x", master);
    const swapped = { ...b, keys: { anthropic: b.keys.openai! } };
    expect(() => vaultGetKey(swapped, "u1", "anthropic", master)).toThrow(CryptoError);
  });

  it("rejects a wrong master key", () => {
    const b = vaultPutKey(null, "u1", "openai", "sk-x", master);
    expect(() => vaultGetKey(b, "u1", "openai", randomBytes(32))).toThrow(CryptoError);
  });

  it("rotates the master key without re-encrypting keys", () => {
    const b = vaultPutKey(null, "u1", "openai", "sk-rot", master);
    const next = randomBytes(32);
    const r = rotateMasterKey(b, "u1", master, next);
    expect(r.keys).toEqual(b.keys);
    expect(vaultGetKey(r, "u1", "openai", next)).toBe("sk-rot");
    expect(() => vaultGetKey(r, "u1", "openai", master)).toThrow(CryptoError);
  });

  it("deletes keys and returns null for unknown providers", () => {
    const b = vaultPutKey(null, "u1", "openai", "sk-x", master);
    expect(vaultGetKey(vaultDeleteKey(b, "openai"), "u1", "openai", master)).toBeNull();
  });

  it("validates master key format", () => {
    expect(() => parseMasterKey(undefined)).toThrow(CryptoError);
    expect(() => parseMasterKey(Buffer.from("short").toString("base64"))).toThrow(/32 bytes/);
    expect(parseMasterKey(master.toString("base64")).length).toBe(32);
  });

  it("masks keys", () => {
    expect(maskKey("sk-abcdefghijklmnop")).toBe("••••mnop");
    expect(maskKey("short")).toBe("••••");
  });
});
