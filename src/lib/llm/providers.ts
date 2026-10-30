import { safeFetch } from "../net/ssrf";
import { redact } from "../logger";
import { DEFAULT_MODELS, LlmError, type ImageInput, type LlmConfig, type ModelTier } from "./types";

export interface RawRequest {
  tier: ModelTier;
  system: string;
  user: string;
  images?: ImageInput[];
  /** JSON Schema describing the required output object. */
  jsonSchema: Record<string, unknown>;
  schemaName: string;
  maxTokens?: number;
}

const FIXED_BASES: Partial<Record<LlmConfig["provider"], string>> = {
  openai: "https://api.openai.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
};

const model = (c: LlmConfig, tier: ModelTier) => (tier === "fast" ? c.fastModel : c.reasoningModel);

async function post(url: string, headers: Record<string, string>, body: unknown, userControlled: boolean): Promise<unknown> {
  const init = { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body), timeoutMs: 90_000 };
  let res: Response | Awaited<ReturnType<typeof safeFetch>>;
  try {
    res = userControlled
      ? await safeFetch(url, init)
      : await fetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(init.timeoutMs) });
  } catch (e) {
    throw new LlmError(`Could not reach the model provider: ${String(redact((e as Error).message))}`, 502, "network");
  }
  const text = await res.text();
  if (!res.ok) {
    let detail = "";
    try {
      const j = JSON.parse(text);
      detail = j?.error?.message ?? j?.message ?? j?.error ?? "";
      if (typeof detail !== "string") detail = JSON.stringify(detail);
    } catch {
      detail = text.slice(0, 200);
    }
    detail = String(redact(detail)).slice(0, 300);
    if (res.status === 401 || res.status === 403) throw new LlmError(`The provider rejected the API key (${res.status}). ${detail}`, 401, "auth");
    if (res.status === 429) throw new LlmError(`Provider rate limit or quota reached. ${detail}`, 429, "rate_limit");
    if (res.status === 404) throw new LlmError(`Model or endpoint not found. ${detail}`, 400, "bad_request");
    if (res.status >= 400 && res.status < 500) throw new LlmError(`Provider rejected the request (${res.status}). ${detail}`, 400, "bad_request");
    throw new LlmError(`Provider error (${res.status}). ${detail}`, 502, "provider");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new LlmError("Provider returned a non-JSON response", 502, "provider");
  }
}

function systemWithSchema(r: RawRequest): string {
  return `${r.system}\n\nRespond with ONE JSON object only (no prose, no markdown fences) that conforms to this JSON Schema:\n${JSON.stringify(r.jsonSchema)}`;
}

async function openAiCompatible(c: LlmConfig, r: RawRequest): Promise<string> {
  const base = FIXED_BASES[c.provider] ?? c.baseUrl ?? DEFAULT_MODELS[c.provider].baseUrl;
  if (!base) throw new LlmError("A base URL is required for this provider", 400, "bad_request");
  const user: unknown = r.images?.length
    ? [{ type: "text", text: r.user }, ...r.images.map((i) => ({ type: "image_url", image_url: { url: `data:${i.mime};base64,${i.base64}` } }))]
    : r.user;
  const data = (await post(
    `${base.replace(/\/+$/, "")}/chat/completions`,
    c.apiKey ? { authorization: `Bearer ${c.apiKey}` } : {},
    {
      model: model(c, r.tier),
      messages: [{ role: "system", content: systemWithSchema(r) }, { role: "user", content: user }],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: r.maxTokens ?? 2000,
    },
    !FIXED_BASES[c.provider],
  )) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new LlmError("Empty response from model", 502, "provider");
  return content;
}

async function anthropic(c: LlmConfig, r: RawRequest): Promise<string> {
  const content: unknown[] = [
    ...(r.images ?? []).map((i) => ({ type: "image", source: { type: "base64", media_type: i.mime, data: i.base64 } })),
    { type: "text", text: r.user },
  ];
  const data = (await post(
    "https://api.anthropic.com/v1/messages",
    { "x-api-key": c.apiKey ?? "", "anthropic-version": "2023-06-01" },
    {
      model: model(c, r.tier),
      max_tokens: r.maxTokens ?? 2000,
      temperature: 0.2,
      system: r.system,
      messages: [{ role: "user", content }],
      tools: [{ name: r.schemaName, description: "Return the structured result.", input_schema: r.jsonSchema }],
      tool_choice: { type: "tool", name: r.schemaName },
    },
    false,
  )) as { content?: { type: string; input?: unknown }[] };
  const block = data.content?.find((b) => b.type === "tool_use");
  if (!block?.input) throw new LlmError("Model did not return structured output", 502, "provider");
  return JSON.stringify(block.input);
}

async function google(c: LlmConfig, r: RawRequest): Promise<string> {
  const m = model(c, r.tier);
  if (!/^[\w.-]+$/.test(m)) throw new LlmError("Invalid Gemini model name", 400, "bad_request");
  const parts: unknown[] = [{ text: r.user }, ...(r.images ?? []).map((i) => ({ inlineData: { mimeType: i.mime, data: i.base64 } }))];
  const data = (await post(
    `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`,
    { "x-goog-api-key": c.apiKey ?? "" },
    {
      systemInstruction: { parts: [{ text: systemWithSchema(r) }] },
      contents: [{ role: "user", parts }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.2, maxOutputTokens: r.maxTokens ?? 2000 },
    },
    false,
  )) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
  if (!text) throw new LlmError("Empty response from model", 502, "provider");
  return text;
}

export async function completeRaw(c: LlmConfig, r: RawRequest): Promise<string> {
  if (!model(c, r.tier)) throw new LlmError("No model configured for this task", 400, "bad_request");
  if (DEFAULT_MODELS[c.provider].needsKey && !c.apiKey) throw new LlmError("An API key is required for this provider", 401, "auth");
  switch (c.provider) {
    case "anthropic":
      return anthropic(c, r);
    case "google":
      return google(c, r);
    default:
      return openAiCompatible(c, r);
  }
}
