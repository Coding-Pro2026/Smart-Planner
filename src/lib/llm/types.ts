import { z } from "zod";

export const PROVIDERS = ["openai", "anthropic", "google", "openrouter", "ollama", "custom"] as const;
export type Provider = (typeof PROVIDERS)[number];
export type ModelTier = "fast" | "reasoning";

export interface LlmConfig {
  provider: Provider;
  /** Never serialised, logged, or returned to clients. Optional only for keyless local servers. */
  apiKey?: string;
  baseUrl?: string;
  fastModel: string;
  reasoningModel: string;
}

export interface ImageInput {
  mime: "image/png" | "image/jpeg" | "image/webp";
  base64: string;
}

export const DEFAULT_MODELS: Record<Provider, { fast: string; reasoning: string; baseUrl?: string; needsKey: boolean; label: string }> = {
  openai: { fast: "gpt-4o-mini", reasoning: "gpt-4o", needsKey: true, label: "OpenAI" },
  anthropic: { fast: "claude-haiku-5-5", reasoning: "claude-sonnet-5-5", needsKey: true, label: "Anthropic" },
  google: { fast: "gemini-2.5-flash", reasoning: "gemini-2.5-pro", needsKey: true, label: "Google Gemini" },
  openrouter: { fast: "openai/gpt-4o-mini", reasoning: "anthropic/claude-sonnet-5-5", needsKey: true, label: "OpenRouter" },
  ollama: { fast: "llama3.1", reasoning: "llama3.1", baseUrl: "http://localhost:11434/v1", needsKey: false, label: "Ollama (local)" },
  custom: { fast: "", reasoning: "", needsKey: false, label: "OpenAI-compatible endpoint" },
};

const modelName = z.string().trim().min(1).max(120).regex(/^[\w.:/@+-]+$/, "Invalid model name");

export const llmConfigInputSchema = z.object({
  provider: z.enum(PROVIDERS),
  apiKey: z.string().trim().min(1).max(500).optional(),
  baseUrl: z.string().trim().url().max(300).optional(),
  fastModel: modelName,
  reasoningModel: modelName,
});
export type LlmConfigInput = z.infer<typeof llmConfigInputSchema>;

export class LlmError extends Error {
  constructor(message: string, public readonly status: number = 502, public readonly kind: "auth" | "rate_limit" | "bad_request" | "provider" | "schema" | "network" = "provider") {
    super(message);
  }
}
