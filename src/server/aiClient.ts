import type { Request } from 'express';
import {
  AiConfig,
  GenerateParams,
  PROVIDERS,
  ProviderId,
  buildGenerateRequest,
  buildListModelsRequest,
  extractErrorMessage,
  isProviderId,
  normalizeRequest,
  parseGenerateResponse,
  parseModelList,
  redactSecret,
  ModelOption,
} from '../lib/llm/providers';
import { safeRequest, validateEndpointUrl } from './netGuard';

const allowPrivate = () => process.env.ALLOW_PRIVATE_AI_URLS === 'true';

export type Fetcher = typeof safeRequest;

export class AiProviderError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'AiProviderError';
  }
}

/** Gemini-shaped facade so existing endpoint code (`ai.models.generateContent`) works with any provider. */
export interface AiClient {
  provider: ProviderId;
  model: string;
  /** True when the key came from the user's request rather than server env. */
  userSupplied: boolean;
  models: { generateContent(params: GenerateParams): Promise<{ text: string; candidates?: any[] }> };
}

const MODEL_RE = /^[A-Za-z0-9._:/@+\- ]{1,120}$/;
const KEY_RE = /^[\x21-\x7e]{6,512}$/; // printable, no whitespace

/** Validates and normalises a config; throws a user-readable error. */
export function validateAiConfig(raw: Partial<AiConfig>): AiConfig {
  if (!isProviderId(raw.provider)) throw new Error('Unknown AI provider');
  const meta = PROVIDERS[raw.provider];
  const apiKey = raw.apiKey?.trim() || undefined;
  if (apiKey && !KEY_RE.test(apiKey)) throw new Error('The API key contains invalid characters');
  if (meta.needsKey && !apiKey) throw new Error(`${meta.label} needs an API key`);
  const model = (raw.model ?? '').trim() || meta.defaultModel;
  if (!model) throw new Error('Choose a model');
  if (!MODEL_RE.test(model)) throw new Error('The model name contains invalid characters');
  let baseUrl: string | undefined;
  if (raw.provider === 'custom') {
    if (!raw.baseUrl?.trim()) throw new Error('Custom provider needs a base URL (e.g. https://api.groq.com/openai/v1)');
    baseUrl = validateEndpointUrl(raw.baseUrl.trim(), allowPrivate()).toString().replace(/\/+$/, '');
  }
  return { provider: raw.provider, apiKey, model, baseUrl };
}

/** Reads BYOK headers (preferred) or falls back to server environment variables. */
export function resolveAiConfig(req: Request): { config: AiConfig; userSupplied: boolean } | null {
  const h = (n: string) => {
    const v = req.headers[n];
    return typeof v === 'string' ? v : undefined;
  };
  const provider = h('x-ai-provider');
  if (provider) {
    // Throws on invalid input: the caller reports it as a 400 so a typo is never silently ignored.
    return {
      config: validateAiConfig({
        provider: provider as ProviderId,
        apiKey: h('x-ai-key'),
        model: h('x-ai-model'),
        baseUrl: h('x-ai-base-url'),
      }),
      userSupplied: true,
    };
  }
  const env = process.env;
  try {
    if (env.AI_PROVIDER && (env.AI_API_KEY || env.AI_PROVIDER === 'custom')) {
      return {
        config: validateAiConfig({ provider: env.AI_PROVIDER as ProviderId, apiKey: env.AI_API_KEY, model: env.AI_MODEL, baseUrl: env.AI_BASE_URL }),
        userSupplied: false,
      };
    }
    if (env.GEMINI_API_KEY && !/YOUR_|PLACEHOLDER|REPLACE|XXXX/i.test(env.GEMINI_API_KEY) && env.GEMINI_API_KEY.length >= 20) {
      return {
        config: validateAiConfig({ provider: 'gemini', apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL_FAST || undefined }),
        userSupplied: false,
      };
    }
  } catch (err) {
    console.warn('[ai] invalid server AI configuration:', err instanceof Error ? err.message : err);
  }
  return null;
}

async function call(cfg: AiConfig, params: GenerateParams, fetcher: Fetcher, timeoutMs: number) {
  const norm = normalizeRequest(params);
  const send = async (jsonMode: boolean) => {
    const spec = buildGenerateRequest(cfg, norm, { jsonMode });
    const res = await fetcher(spec.url, {
      method: spec.method,
      headers: spec.headers,
      body: spec.body,
      timeoutMs,
      allowPrivate: allowPrivate(),
    });
    let data: any = null;
    try {
      data = res.text ? JSON.parse(res.text) : null;
    } catch {
      data = null;
    }
    return { res, data };
  };

  let { res, data } = await send(true);
  // Some OpenAI-compatible servers reject response_format; retry once without it.
  if (res.status === 400 && norm.wantJson && ['openrouter', 'custom'].includes(cfg.provider)) {
    ({ res, data } = await send(false));
  }
  if (res.status < 200 || res.status >= 300) {
    throw new AiProviderError(redactSecret(extractErrorMessage(data, res.status), cfg.apiKey), res.status);
  }
  if (data === null) throw new AiProviderError('The provider returned a non-JSON response');
  return parseGenerateResponse(cfg.provider, data);
}

export function createAiClient(
  cfg: AiConfig,
  userSupplied: boolean,
  fetcher: Fetcher = safeRequest,
  timeoutMs = 45_000
): AiClient {
  return {
    provider: cfg.provider,
    model: cfg.model,
    userSupplied,
    models: {
      generateContent: async (params) => {
        // Search grounding is Gemini-only; other providers answer without it.
        const p =
          cfg.provider !== 'gemini' && params.config?.tools
            ? { ...params, config: { ...params.config, tools: undefined } }
            : params;
        return call(cfg, p, fetcher, timeoutMs);
      },
    },
  };
}

export async function listModels(cfg: AiConfig, fetcher: Fetcher = safeRequest): Promise<ModelOption[]> {
  const spec = buildListModelsRequest(cfg);
  const res = await fetcher(spec.url, { method: 'GET', headers: spec.headers, timeoutMs: 15_000, allowPrivate: allowPrivate() });
  let data: any = null;
  try {
    data = JSON.parse(res.text);
  } catch {
    /* ignore */
  }
  if (res.status < 200 || res.status >= 300) {
    throw new AiProviderError(redactSecret(extractErrorMessage(data, res.status), cfg.apiKey), res.status);
  }
  return parseModelList(cfg.provider, data);
}

/** Cheap end-to-end check: one tiny generation. */
export async function testConnection(cfg: AiConfig, fetcher: Fetcher = safeRequest): Promise<{ sample: string }> {
  const client = createAiClient(cfg, true, fetcher, 25_000);
  const out = await client.models.generateContent({
    contents: 'Reply with the single word: ready',
    config: { systemInstruction: 'You are a connectivity check. Reply with one word.' },
  });
  return { sample: out.text.trim().slice(0, 60) };
}
