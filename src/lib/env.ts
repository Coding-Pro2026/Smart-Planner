import { parseMasterKey } from "./crypto";

const flag = (v: string | undefined) => v === "true" || v === "1";

export const env = {
  get databaseUrl() {
    return process.env.DATABASE_URL ?? "";
  },
  get authSecret(): Uint8Array {
    const s = process.env.AUTH_SECRET;
    if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set to at least 32 characters");
    return new TextEncoder().encode(s);
  },
  get masterKey(): Buffer {
    return parseMasterKey(process.env.ENCRYPTION_MASTER_KEY);
  },
  get allowPrivateLlmEndpoints() {
    return flag(process.env.ALLOW_PRIVATE_LLM_ENDPOINTS);
  },
  get vaultEnabled() {
    return !flag(process.env.DISABLE_KEY_VAULT) && !!process.env.ENCRYPTION_MASTER_KEY;
  },
  get isProd() {
    return process.env.NODE_ENV === "production";
  },
};
