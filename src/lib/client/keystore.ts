"use client";
import type { Provider } from "@/lib/llm/types";

/**
 * Session-only BYOK storage.
 *  - The API key is encrypted with AES-256-GCM using a NON-EXTRACTABLE CryptoKey that lives in
 *    IndexedDB (script can use it but cannot read its bytes).
 *  - The ciphertext lives in sessionStorage, so closing the tab wipes it.
 *  - Vault mode keeps only non-secret settings locally; the key lives encrypted on the server.
 * Honest limit: any script running in this origin (XSS) could still ask the browser to decrypt, which is
 * why we ship a strict CSP and no third-party scripts.
 */
export interface ClientLlmConfig {
  mode: "session" | "vault";
  provider: Provider;
  apiKey?: string;
  baseUrl?: string;
  fastModel: string;
  reasoningModel: string;
}

const DB = "plangenie-keystore";
const STORE = "keys";
const SS_KEY = "pg_llm_v1";
const LS_VAULT = "pg_llm_vault_v1";

const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b instanceof Uint8Array ? b : new Uint8Array(b))));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

function openDb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((res, rej) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
async function wrapKey(): Promise<CryptoKey> {
  const existing = await idb<CryptoKey | undefined>("readonly", (s) => s.get("wrap"));
  if (existing) return existing;
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  await idb("readwrite", (s) => s.put(key, "wrap"));
  return key;
}

export async function saveConfig(cfg: ClientLlmConfig): Promise<void> {
  if (cfg.mode === "vault") {
    sessionStorage.removeItem(SS_KEY);
    const safe = { ...cfg };
    delete safe.apiKey; // vault mode never keeps the key in the browser
    localStorage.setItem(LS_VAULT, JSON.stringify(safe));
    return;
  }
  localStorage.removeItem(LS_VAULT);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await wrapKey(), new TextEncoder().encode(JSON.stringify(cfg)));
  sessionStorage.setItem(SS_KEY, JSON.stringify({ iv: b64(iv), ct: b64(ct) }));
}

export async function loadConfig(): Promise<ClientLlmConfig | null> {
  try {
    const v = localStorage.getItem(LS_VAULT);
    if (v) return JSON.parse(v) as ClientLlmConfig;
    const raw = sessionStorage.getItem(SS_KEY);
    if (!raw) return null;
    const { iv, ct } = JSON.parse(raw) as { iv: string; ct: string };
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, await wrapKey(), unb64(ct));
    return JSON.parse(new TextDecoder().decode(pt)) as ClientLlmConfig;
  } catch {
    return null;
  }
}

export function clearConfig(): void {
  sessionStorage.removeItem(SS_KEY);
  localStorage.removeItem(LS_VAULT);
}

/** Headers attached to LLM-backed requests. Key only ever travels in a header, never a URL or body log. */
export function llmHeaders(cfg: ClientLlmConfig | null): Record<string, string> {
  if (!cfg) return {};
  if (cfg.mode === "vault") return { "x-llm-provider": cfg.provider };
  const h: Record<string, string> = {
    "x-llm-mode": "session",
    "x-llm-provider": cfg.provider,
    "x-llm-fast-model": cfg.fastModel,
    "x-llm-reasoning-model": cfg.reasoningModel,
  };
  if (cfg.apiKey) h["x-llm-key"] = cfg.apiKey;
  if (cfg.baseUrl) h["x-llm-base-url"] = cfg.baseUrl;
  return h;
}
