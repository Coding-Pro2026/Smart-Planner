import { PROVIDERS, ProviderId, isProviderId } from './llm/providers';

/**
 * Browser-side store for the user's own ("bring your own") AI settings.
 * - Default: sessionStorage (cleared when the tab closes)
 * - Optional "remember on this device": localStorage
 * The key is NEVER written to the workspace autosave, exported files, or logs.
 */

export interface StoredAiConfig {
  provider: ProviderId;
  apiKey: string;
  model: string;
  baseUrl: string;
  remember: boolean;
}

const KEY = 'plangenie:v2:ai';
export const AI_CONFIG_EVENT = 'plangenie-ai-config';
export const AI_WARNING_EVENT = 'plangenie-ai-warning';

function parse(raw: string | null): StoredAiConfig | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (!v || !isProviderId(v.provider) || typeof v.model !== 'string') return null;
    return {
      provider: v.provider,
      apiKey: typeof v.apiKey === 'string' ? v.apiKey : '',
      model: v.model,
      baseUrl: typeof v.baseUrl === 'string' ? v.baseUrl : '',
      remember: Boolean(v.remember),
    };
  } catch {
    return null;
  }
}

export function loadAiConfig(): StoredAiConfig | null {
  try {
    return parse(window.sessionStorage.getItem(KEY)) ?? parse(window.localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

export function saveAiConfig(cfg: StoredAiConfig): boolean {
  try {
    const json = JSON.stringify(cfg);
    window.sessionStorage.removeItem(KEY);
    window.localStorage.removeItem(KEY);
    (cfg.remember ? window.localStorage : window.sessionStorage).setItem(KEY, json);
    window.dispatchEvent(new Event(AI_CONFIG_EVENT));
    return true;
  } catch {
    return false;
  }
}

export function clearAiConfig(): void {
  try {
    window.sessionStorage.removeItem(KEY);
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(AI_CONFIG_EVENT));
}

export function isAiConfigured(cfg: StoredAiConfig | null = loadAiConfig()): boolean {
  if (!cfg) return false;
  const meta = PROVIDERS[cfg.provider];
  if (meta.needsKey && !cfg.apiKey) return false;
  if (meta.needsBaseUrl && !cfg.baseUrl) return false;
  return Boolean(cfg.model || meta.defaultModel);
}

/** Headers attached to AI endpoints so the server can call the user's chosen provider. */
export function aiHeaders(): Record<string, string> {
  const cfg = loadAiConfig();
  if (!cfg || !isAiConfigured(cfg)) return {};
  const h: Record<string, string> = {
    'x-ai-provider': cfg.provider,
    'x-ai-model': cfg.model || PROVIDERS[cfg.provider].defaultModel,
  };
  if (cfg.apiKey) h['x-ai-key'] = cfg.apiKey;
  if (cfg.provider === 'custom' && cfg.baseUrl) h['x-ai-base-url'] = cfg.baseUrl;
  return h;
}

export function aiLabel(cfg: StoredAiConfig | null = loadAiConfig()): string {
  if (!cfg || !isAiConfigured(cfg)) return 'Add AI key';
  const short = (cfg.model || PROVIDERS[cfg.provider].defaultModel).split('/').pop() ?? '';
  return `${PROVIDERS[cfg.provider].label.replace('Custom (OpenAI-compatible)', 'Custom')} · ${short.slice(0, 22)}`;
}
