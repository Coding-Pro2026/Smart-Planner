import { Prisma } from "@prisma/client";
import { api, HttpError } from "@/lib/http";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { isVaultBundle, maskKey, vaultDeleteKey, vaultPutKey } from "@/lib/crypto";
import { finalize } from "@/lib/llm/resolve";
import { pingModel } from "@/lib/llm/structured";
import { vaultPutInput } from "@/lib/schemas";
import { z } from "zod";

type Settings = Record<string, { baseUrl?: string; fastModel: string; reasoningModel: string; hint?: string }>;

function requireVault() {
  if (!env.vaultEnabled) throw new HttpError(404, "Vault mode is disabled on this server");
}

/** Lists saved providers. Returns only a masked hint — the key itself can never be read back. */
export const GET = api({}, async ({ user }) => {
  requireVault();
  const u = await db.user.findUnique({ where: { id: user.id }, select: { llmSettings: true } });
  const s = (u?.llmSettings ?? {}) as Settings;
  return { providers: Object.entries(s).map(([provider, v]) => ({ provider, baseUrl: v.baseUrl, fastModel: v.fastModel, reasoningModel: v.reasoningModel, hint: v.hint })) };
});

export const PUT = api({ body: vaultPutInput, rate: { name: "vault-put", limit: 10, windowMs: 60_000 } }, async ({ user, body }) => {
  requireVault();
  const cfg = finalize(body);
  await pingModel(cfg); // refuse to store a key that doesn't work
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { encryptedKeys: true, llmSettings: true } });
  const bundle = isVaultBundle(row.encryptedKeys) ? row.encryptedKeys : null;
  const settings = (row.llmSettings ?? {}) as Settings;
  const next = cfg.apiKey ? vaultPutKey(bundle, user.id, cfg.provider, cfg.apiKey, env.masterKey) : bundle;
  settings[cfg.provider] = { baseUrl: cfg.baseUrl, fastModel: cfg.fastModel, reasoningModel: cfg.reasoningModel, hint: cfg.apiKey ? maskKey(cfg.apiKey) : undefined };
  await db.user.update({ where: { id: user.id }, data: { encryptedKeys: next ? (next as unknown as Prisma.InputJsonObject) : Prisma.DbNull, llmSettings: settings as Prisma.InputJsonValue } });
  return { ok: true, hint: settings[cfg.provider]!.hint };
});

export const DELETE = api({ body: z.object({ provider: z.string().max(20) }) }, async ({ user, body }) => {
  requireVault();
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { encryptedKeys: true, llmSettings: true } });
  const settings = (row.llmSettings ?? {}) as Settings;
  delete settings[body.provider];
  const keys = isVaultBundle(row.encryptedKeys) ? vaultDeleteKey(row.encryptedKeys, body.provider) : null;
  await db.user.update({ where: { id: user.id }, data: { encryptedKeys: keys ? (keys as unknown as Prisma.InputJsonObject) : Prisma.DbNull, llmSettings: settings as Prisma.InputJsonValue } });
  return { ok: true };
});
