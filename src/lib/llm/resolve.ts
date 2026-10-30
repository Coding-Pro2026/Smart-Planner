import type { NextRequest } from "next/server";
import { db } from "../db";
import { isVaultBundle, vaultGetKey } from "../crypto";
import { env } from "../env";
import { HttpError } from "../http";
import { parseEndpoint } from "../net/ssrf";
import { DEFAULT_MODELS, llmConfigInputSchema, PROVIDERS, type LlmConfig, type Provider } from "./types";

/**
 * Session-only mode: the browser decrypts its locally encrypted key and forwards it per request in
 * `x-llm-*` headers (with `x-llm-mode: session`) over TLS. We hold it in memory for the duration of the call; it is never
 * persisted, logged, cached, or echoed back.
 * Vault mode: no key header => use the user's AES-GCM-encrypted key from the database.
 */
export async function resolveLlmConfig(req: NextRequest, userId: string): Promise<LlmConfig> {
  const h = (n: string) => req.headers.get(n) ?? undefined;
  const provider = h("x-llm-provider") as Provider | undefined;
  const headerKey = h("x-llm-key");

  if (h("x-llm-mode") === "session") {
    if (!provider) throw new HttpError(400, "x-llm-provider header is required in session mode");
    return finalize({ provider, apiKey: headerKey || undefined, baseUrl: h("x-llm-base-url"), fastModel: h("x-llm-fast-model") ?? DEFAULT_MODELS[provider]?.fast, reasoningModel: h("x-llm-reasoning-model") ?? DEFAULT_MODELS[provider]?.reasoning });
  }

  // Vault fallback.
  if (!env.vaultEnabled) throw new HttpError(400, "No model configured. Add an API key in Settings.");
  const user = await db.user.findUnique({ where: { id: userId }, select: { encryptedKeys: true, llmSettings: true } });
  const settings = (user?.llmSettings ?? {}) as Record<string, { baseUrl?: string; fastModel: string; reasoningModel: string }>;
  const wanted = provider ?? (Object.keys(settings)[0] as Provider | undefined);
  if (!wanted || !settings[wanted]) throw new HttpError(400, "No model configured. Add an API key in Settings.");
  let apiKey: string | undefined;
  if (isVaultBundle(user?.encryptedKeys)) apiKey = vaultGetKey(user.encryptedKeys, userId, wanted, env.masterKey) ?? undefined;
  const s = settings[wanted];
  return finalize({ provider: wanted, apiKey, baseUrl: s.baseUrl, fastModel: s.fastModel, reasoningModel: s.reasoningModel });
}

export function finalize(raw: { provider: Provider; apiKey?: string; baseUrl?: string; fastModel?: string; reasoningModel?: string }): LlmConfig {
  if (!PROVIDERS.includes(raw.provider)) throw new HttpError(400, "Unknown provider");
  const parsed = llmConfigInputSchema.safeParse({ ...raw, baseUrl: raw.baseUrl || undefined, apiKey: raw.apiKey || undefined });
  if (!parsed.success) throw new HttpError(400, `Invalid model configuration: ${parsed.error.issues[0]?.path.join(".")} ${parsed.error.issues[0]?.message}`);
  const c = parsed.data;
  const usesBase = c.provider === "ollama" || c.provider === "custom";
  if (usesBase) parseEndpoint(c.baseUrl ?? DEFAULT_MODELS[c.provider].baseUrl ?? ""); // SSRF gate at config time
  if (c.provider === "custom" && !c.baseUrl) throw new HttpError(400, "A base URL is required for a custom endpoint");
  if (DEFAULT_MODELS[c.provider].needsKey && !c.apiKey) throw new HttpError(400, "An API key is required for this provider");
  return { provider: c.provider, apiKey: c.apiKey, baseUrl: usesBase ? c.baseUrl : undefined, fastModel: c.fastModel, reasoningModel: c.reasoningModel };
}
