/**
 * Provider-neutral LLM layer (BYOK). Pure functions only (no I/O) so request building
 * and response parsing are unit-testable and shared between server and browser.
 */

export type ProviderId = 'gemini' | 'anthropic' | 'openai' | 'openrouter' | 'custom';

export interface ProviderMeta {
  id: ProviderId;
  label: string;
  defaultModel: string;
  suggestedModels: string[];
  baseUrl: string; // default API base
  needsKey: boolean;
  needsBaseUrl: boolean;
  keyHelpUrl: string;
  keyPlaceholder: string;
  blurb: string;
}

export const PROVIDERS: Record<ProviderId, ProviderMeta> = {
  gemini: {
    id: 'gemini',
    label: 'Google Gemini',
    // Google retires models quickly (e.g. 2.5 is closed to new users) - "Load my models" shows what your key can use.
    defaultModel: 'gemini-3.1-flash-lite',
    suggestedModels: ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-pro-latest'],
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    needsKey: true,
    needsBaseUrl: false,
    keyHelpUrl: 'https://aistudio.google.com/apikey',
    keyPlaceholder: 'AIza…',
    blurb: 'Free tier available. Supports image moodboards and Google Search grounding.',
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic Claude',
    defaultModel: 'claude-sonnet-5-5',
    suggestedModels: ['claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-opus-5-5'],
    baseUrl: 'https://api.anthropic.com/v1',
    needsKey: true,
    needsBaseUrl: false,
    keyHelpUrl: 'https://console.anthropic.com/settings/keys',
    keyPlaceholder: 'sk-ant-…',
    blurb: 'Strong reasoning and structured output. Supports image moodboards.',
  },
  openai: {
    id: 'openai',
    label: 'OpenAI GPT',
    defaultModel: 'gpt-4o-mini',
    suggestedModels: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini'],
    baseUrl: 'https://api.openai.com/v1',
    needsKey: true,
    needsBaseUrl: false,
    keyHelpUrl: 'https://platform.openai.com/api-keys',
    keyPlaceholder: 'sk-…',
    blurb: 'GPT models via the official API. Supports image moodboards.',
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    defaultModel: 'openai/gpt-4o-mini',
    suggestedModels: ['openai/gpt-4o-mini', 'google/gemini-2.5-flash', 'anthropic/claude-sonnet-4.5'],
    baseUrl: 'https://openrouter.ai/api/v1',
    needsKey: true,
    needsBaseUrl: false,
    keyHelpUrl: 'https://openrouter.ai/keys',
    keyPlaceholder: 'sk-or-…',
    blurb: 'One key, hundreds of models from many labs (including free ones).',
  },
  custom: {
    id: 'custom',
    label: 'Custom (OpenAI-compatible)',
    defaultModel: '',
    suggestedModels: [],
    baseUrl: '',
    needsKey: false,
    needsBaseUrl: true,
    keyHelpUrl: '',
    keyPlaceholder: 'Optional API key',
    blurb: 'Any OpenAI-compatible endpoint: Groq, Together, Mistral, DeepSeek, vLLM, LM Studio, Ollama…',
  },
};

export const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[];
export const isProviderId = (v: unknown): v is ProviderId =>
  typeof v === 'string' && (PROVIDER_IDS as string[]).includes(v);

export interface AiConfig {
  provider: ProviderId;
  apiKey?: string;
  model: string;
  baseUrl?: string;
}

// ---- Gemini-shaped generate parameters (what the app's endpoints already use) ----

export type ContentPart = { text?: string; inlineData?: { mimeType: string; data: string } };

export interface GenerateParams {
  model?: string;
  contents: string | { parts: ContentPart[] };
  config?: {
    systemInstruction?: string;
    responseMimeType?: string;
    responseSchema?: unknown;
    tools?: unknown[];
  };
}

export interface NormalizedRequest {
  system: string;
  parts: ({ type: 'text'; text: string } | { type: 'image'; mime: string; data: string })[];
  wantJson: boolean;
  schema?: Record<string, unknown>; // standard JSON Schema (lowercase types)
  geminiSchema?: unknown; // original Gemini-style schema
  grounding: boolean;
}

/** Converts Gemini `Type.X` ("OBJECT", "STRING"…) schemas to standard JSON Schema. */
export function toJsonSchema(schema: unknown): Record<string, unknown> {
  if (!schema || typeof schema !== 'object') return { type: 'object' };
  const s = schema as Record<string, any>;
  const out: Record<string, unknown> = {};
  if (typeof s.type === 'string') out.type = s.type.toLowerCase();
  if (s.description) out.description = s.description;
  if (Array.isArray(s.enum)) out.enum = s.enum;
  if (s.properties && typeof s.properties === 'object') {
    out.properties = Object.fromEntries(
      Object.entries(s.properties).map(([k, v]) => [k, toJsonSchema(v)])
    );
  }
  if (s.items) out.items = toJsonSchema(s.items);
  if (Array.isArray(s.required)) out.required = s.required;
  return out;
}

export function normalizeRequest(params: GenerateParams): NormalizedRequest {
  const parts: NormalizedRequest['parts'] = [];
  if (typeof params.contents === 'string') {
    parts.push({ type: 'text', text: params.contents });
  } else {
    for (const p of params.contents?.parts ?? []) {
      if (typeof p.text === 'string') parts.push({ type: 'text', text: p.text });
      else if (p.inlineData?.data) {
        parts.push({ type: 'image', mime: p.inlineData.mimeType || 'image/jpeg', data: p.inlineData.data });
      }
    }
  }
  const cfg = params.config ?? {};
  const wantJson = cfg.responseMimeType === 'application/json' || Boolean(cfg.responseSchema);
  const grounding = Array.isArray(cfg.tools) && cfg.tools.some((t: any) => t && 'googleSearch' in t);
  return {
    system: cfg.systemInstruction ?? '',
    parts,
    wantJson,
    schema: cfg.responseSchema ? toJsonSchema(cfg.responseSchema) : undefined,
    geminiSchema: cfg.responseSchema,
    grounding,
  };
}

export interface HttpRequestSpec {
  url: string;
  method: 'POST' | 'GET';
  headers: Record<string, string>;
  body?: string;
}

const trimSlash = (u: string) => u.replace(/\/+$/, '');

export function resolveBaseUrl(cfg: AiConfig): string {
  const meta = PROVIDERS[cfg.provider];
  return trimSlash(cfg.baseUrl?.trim() || meta.baseUrl);
}

function jsonInstruction(n: NormalizedRequest): string {
  if (!n.wantJson) return '';
  return (
    '\n\nRespond with ONLY a single valid JSON object (no markdown, no commentary)' +
    (n.schema ? ` that conforms to this JSON Schema:\n${JSON.stringify(n.schema)}` : '.')
  );
}

/** Builds the provider-specific HTTP request for a generate call. */
export function buildGenerateRequest(
  cfg: AiConfig,
  n: NormalizedRequest,
  opts: { jsonMode?: boolean } = {}
): HttpRequestSpec {
  const base = resolveBaseUrl(cfg);
  const model = cfg.model.replace(/^models\//, '');
  const json = (o: unknown) => JSON.stringify(o);

  if (cfg.provider === 'gemini') {
    const body: Record<string, unknown> = {
      contents: [
        {
          role: 'user',
          parts: n.parts.map((p) =>
            p.type === 'text' ? { text: p.text } : { inlineData: { mimeType: p.mime, data: p.data } }
          ),
        },
      ],
    };
    if (n.system) body.systemInstruction = { parts: [{ text: n.system }] };
    const generationConfig: Record<string, unknown> = {};
    if (n.wantJson) {
      generationConfig.responseMimeType = 'application/json';
      if (n.geminiSchema && !n.grounding) generationConfig.responseSchema = n.geminiSchema;
    }
    if (Object.keys(generationConfig).length) body.generationConfig = generationConfig;
    if (n.grounding) body.tools = [{ googleSearch: {} }];
    return {
      url: `${base}/models/${encodeURIComponent(model)}:generateContent`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.apiKey ?? '' },
      body: json(body),
    };
  }

  if (cfg.provider === 'anthropic') {
    const content = n.parts.map((p) =>
      p.type === 'text'
        ? { type: 'text', text: p.text }
        : { type: 'image', source: { type: 'base64', media_type: p.mime, data: p.data } }
    );
    const body: Record<string, unknown> = {
      model,
      max_tokens: 4096,
      messages: [{ role: 'user', content }],
    };
    if (n.system) body.system = n.system;
    if (n.wantJson) {
      // Forced tool use is the most reliable way to get schema-shaped JSON from Claude.
      body.tools = [
        {
          name: 'respond',
          description: 'Return the final structured answer.',
          input_schema: n.schema && (n.schema as any).type === 'object' ? n.schema : { type: 'object' },
        },
      ];
      body.tool_choice = { type: 'tool', name: 'respond' };
    }
    return {
      url: `${base}/messages`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': cfg.apiKey ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: json(body),
    };
  }

  // OpenAI, OpenRouter, custom: OpenAI-compatible chat completions
  const userContent =
    n.parts.length === 1 && n.parts[0].type === 'text'
      ? n.parts[0].text
      : n.parts.map((p) =>
          p.type === 'text'
            ? { type: 'text', text: p.text }
            : { type: 'image_url', image_url: { url: `data:${p.mime};base64,${p.data}` } }
        );
  const messages: { role: string; content: unknown }[] = [];
  const system = (n.system + jsonInstruction(n)).trim();
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: userContent });
  const body: Record<string, unknown> = { model, messages };
  // Official OpenAI newer models reject max_tokens; other vendors still expect it.
  if (cfg.provider === 'openai') body.max_completion_tokens = 4096;
  else body.max_tokens = 4096;
  if (n.wantJson && opts.jsonMode !== false) body.response_format = { type: 'json_object' };
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
  if (cfg.provider === 'openrouter') {
    headers['X-Title'] = 'PlanGenie';
  }
  return { url: `${base}/chat/completions`, method: 'POST', headers, body: json(body) };
}

export interface ParsedLlmResponse {
  text: string;
  candidates?: unknown[];
}

/** Extracts the text (or tool JSON) from a provider response. Throws a readable error if empty/blocked. */
export function parseGenerateResponse(provider: ProviderId, data: any): ParsedLlmResponse {
  if (provider === 'gemini') {
    const cand = data?.candidates?.[0];
    const text = (cand?.content?.parts ?? [])
      .map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
      .join('');
    if (!text) {
      const reason = data?.promptFeedback?.blockReason || cand?.finishReason || 'empty response';
      throw new Error(`Gemini returned no content (${reason})`);
    }
    return { text, candidates: data.candidates };
  }
  if (provider === 'anthropic') {
    const blocks: any[] = Array.isArray(data?.content) ? data.content : [];
    const tool = blocks.find((b) => b?.type === 'tool_use');
    if (tool?.input && typeof tool.input === 'object') return { text: JSON.stringify(tool.input) };
    const text = blocks.map((b) => (b?.type === 'text' ? b.text : '')).join('');
    if (!text) throw new Error(`Claude returned no content (${data?.stop_reason ?? 'empty'})`);
    return { text };
  }
  const choice = data?.choices?.[0];
  const content = choice?.message?.content;
  const text = Array.isArray(content)
    ? content.map((c: any) => (typeof c?.text === 'string' ? c.text : '')).join('')
    : typeof content === 'string'
      ? content
      : '';
  if (!text) throw new Error(`Model returned no content (${choice?.finish_reason ?? 'empty'})`);
  return { text };
}

/** Pulls a human-readable message out of any provider's error body. */
export function extractErrorMessage(data: unknown, status: number): string {
  const d = data as any;
  const msg =
    d?.error?.message ??
    (typeof d?.error === 'string' ? d.error : undefined) ??
    d?.message ??
    d?.detail;
  const base = typeof msg === 'string' && msg ? msg : `HTTP ${status}`;
  return `${status}: ${base}`.slice(0, 300);
}

/** Extracts the first balanced JSON object/array from text (handles code fences/prose). */
export function extractJson(text: string): string {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  if (t.startsWith('{') || t.startsWith('[')) return t;
  const start = t.search(/[{[]/);
  if (start < 0) return t;
  const open = t[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < t.length; i++) {
    const c = t[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === open) depth++;
    else if (c === close && --depth === 0) return t.slice(start, i + 1);
  }
  return t.slice(start);
}

/** Request spec for listing available models. */
export function buildListModelsRequest(cfg: AiConfig): HttpRequestSpec {
  const base = resolveBaseUrl(cfg);
  if (cfg.provider === 'gemini') {
    return { url: `${base}/models?pageSize=200`, method: 'GET', headers: { 'x-goog-api-key': cfg.apiKey ?? '' } };
  }
  if (cfg.provider === 'anthropic') {
    return {
      url: `${base}/models?limit=100`,
      method: 'GET',
      headers: { 'x-api-key': cfg.apiKey ?? '', 'anthropic-version': '2023-06-01' },
    };
  }
  const headers: Record<string, string> = {};
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
  return { url: `${base}/models`, method: 'GET', headers };
}

export interface ModelOption {
  id: string;
  label?: string;
}

export function parseModelList(provider: ProviderId, data: any): ModelOption[] {
  let out: ModelOption[] = [];
  if (provider === 'gemini') {
    out = (data?.models ?? [])
      .filter((m: any) => (m?.supportedGenerationMethods ?? []).includes('generateContent'))
      .filter((m: any) => !/(tts|image|transcribe|lyria|robotics|computer-use|embedding|nano-banana)/i.test(String(m.name)))
      .map((m: any) => ({ id: String(m.name).replace(/^models\//, ''), label: m.displayName }));
  } else if (provider === 'anthropic') {
    out = (data?.data ?? []).map((m: any) => ({ id: String(m.id), label: m.display_name }));
  } else if (provider === 'openai') {
    out = (data?.data ?? [])
      .map((m: any) => ({ id: String(m.id) }))
      .filter((m: ModelOption) => /^(gpt|o\d|chatgpt)/i.test(m.id) && !/(embed|whisper|tts|dall|image|audio|realtime|moderation|transcribe|search)/i.test(m.id));
  } else {
    out = (data?.data ?? data?.models ?? []).map((m: any) => ({ id: String(m.id ?? m.name), label: m.name !== m.id ? m.name : undefined }));
  }
  const seen = new Set<string>();
  return out
    .filter((m) => m.id && m.id !== 'undefined' && !seen.has(m.id) && seen.add(m.id))
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, 400);
}

/** Replaces any occurrence of the secret in a string so it can never leak into logs/errors. */
export function redactSecret(text: string, secret?: string): string {
  let out = text;
  if (secret && secret.length >= 6) out = out.split(secret).join('[redacted-key]');
  return out.replace(/(sk-[A-Za-z0-9_-]{8})[A-Za-z0-9_-]{8,}/g, '$1…').replace(/(AIza[0-9A-Za-z_-]{6})[0-9A-Za-z_-]{10,}/g, '$1…');
}
