import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Envelope encryption for Vault mode.
 *
 *   ENCRYPTION_MASTER_KEY (env, 32 bytes) --wraps--> per-user DEK (random 32 bytes) --encrypts--> API keys
 *
 * Every ciphertext uses a fresh random 96-bit IV and is bound to the owning user via AES-GCM
 * additional authenticated data, so a ciphertext copied to another user's row fails to decrypt.
 * Wire format: `v1.<iv>.<ciphertext>.<tag>` (base64url segments).
 */

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;

export class CryptoError extends Error {}

export function parseMasterKey(b64: string | undefined): Buffer {
  if (!b64) throw new CryptoError("ENCRYPTION_MASTER_KEY is not set");
  const key = Buffer.from(b64, "base64");
  if (key.length !== KEY_BYTES) {
    throw new CryptoError(`ENCRYPTION_MASTER_KEY must decode to ${KEY_BYTES} bytes (got ${key.length})`);
  }
  return key;
}

function seal(plaintext: Buffer, key: Buffer, aad: string): string {
  if (key.length !== KEY_BYTES) throw new CryptoError("Invalid key length");
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), ct.toString("base64url"), tag.toString("base64url")].join(".");
}

function open(payload: string, key: Buffer, aad: string): Buffer {
  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") throw new CryptoError("Malformed ciphertext");
  const [, ivS, ctS, tagS] = parts as [string, string, string, string];
  const iv = Buffer.from(ivS, "base64url");
  const tag = Buffer.from(tagS, "base64url");
  if (iv.length !== IV_BYTES || tag.length !== 16) throw new CryptoError("Malformed ciphertext");
  try {
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAAD(Buffer.from(aad, "utf8"));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(Buffer.from(ctS, "base64url")), decipher.final()]);
  } catch {
    // Never leak why (wrong key / tampered / wrong user) — all look identical.
    throw new CryptoError("Decryption failed");
  }
}

export interface VaultBundle {
  v: 1;
  /** DEK wrapped by the master key. */
  dek: string;
  /** provider id -> ciphertext of the API key (encrypted with the DEK). */
  keys: Record<string, string>;
}

export function newVaultBundle(userId: string, masterKey: Buffer): VaultBundle {
  const dek = randomBytes(KEY_BYTES);
  return { v: 1, dek: seal(dek, masterKey, `dek:${userId}`), keys: {} };
}

function unwrapDek(bundle: VaultBundle, userId: string, masterKey: Buffer): Buffer {
  return open(bundle.dek, masterKey, `dek:${userId}`);
}

export function vaultPutKey(
  bundle: VaultBundle | null,
  userId: string,
  provider: string,
  apiKey: string,
  masterKey: Buffer,
): VaultBundle {
  const b = bundle ?? newVaultBundle(userId, masterKey);
  const dek = unwrapDek(b, userId, masterKey);
  return { ...b, keys: { ...b.keys, [provider]: seal(Buffer.from(apiKey, "utf8"), dek, `key:${userId}:${provider}`) } };
}

export function vaultGetKey(bundle: VaultBundle, userId: string, provider: string, masterKey: Buffer): string | null {
  const ct = bundle.keys[provider];
  if (!ct) return null;
  const dek = unwrapDek(bundle, userId, masterKey);
  return open(ct, dek, `key:${userId}:${provider}`).toString("utf8");
}

export function vaultDeleteKey(bundle: VaultBundle, provider: string): VaultBundle {
  const keys = { ...bundle.keys };
  delete keys[provider];
  return { ...bundle, keys };
}

/** Rotate the master key: re-wrap the DEK only; key ciphertexts are untouched. */
export function rotateMasterKey(bundle: VaultBundle, userId: string, oldKey: Buffer, newKey: Buffer): VaultBundle {
  const dek = unwrapDek(bundle, userId, oldKey);
  return { ...bundle, dek: seal(dek, newKey, `dek:${userId}`) };
}

export function isVaultBundle(x: unknown): x is VaultBundle {
  if (!x || typeof x !== "object") return false;
  const b = x as Record<string, unknown>;
  return b.v === 1 && typeof b.dek === "string" && !!b.keys && typeof b.keys === "object";
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function maskKey(key: string): string {
  return key.length <= 8 ? "••••" : `••••${key.slice(-4)}`;
}
