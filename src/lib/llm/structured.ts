import { z } from "zod";
import { completeRaw } from "./providers";
import { LlmError, type ImageInput, type LlmConfig, type ModelTier } from "./types";

export function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema, { target: "draft-7" }) as Record<string, unknown>;
  return rest;
}

function extractJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(t);
  } catch {
    const s = t.indexOf("{");
    const e = t.lastIndexOf("}");
    if (s >= 0 && e > s) return JSON.parse(t.slice(s, e + 1));
    throw new Error("No JSON object found");
  }
}

export interface StructuredRequest<T> {
  tier: ModelTier;
  system: string;
  user: string;
  schema: z.ZodType<T>;
  schemaName: string;
  images?: ImageInput[];
  maxTokens?: number;
}

/**
 * Ask a model for a JSON object, validate it against a Zod schema, and retry once with the
 * validation errors fed back. Anything that still fails validation is rejected — never "fixed up".
 */
export async function generateStructured<T>(cfg: LlmConfig, req: StructuredRequest<T>): Promise<T> {
  const jsonSchema = toJsonSchema(req.schema);
  let user = req.user;
  let lastIssue = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await completeRaw(cfg, { tier: req.tier, system: req.system, user, images: req.images, jsonSchema, schemaName: req.schemaName, maxTokens: req.maxTokens });
    try {
      const parsed = req.schema.safeParse(extractJson(raw));
      if (parsed.success) return parsed.data;
      lastIssue = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
    } catch (e) {
      lastIssue = (e as Error).message;
    }
    user = `${req.user}\n\nYour previous answer was invalid (${lastIssue}). Return corrected JSON only.`;
  }
  throw new LlmError(`The model could not produce valid structured output (${lastIssue})`, 502, "schema");
}

/** Minimal connectivity + credential check used before a key is saved. */
export async function pingModel(cfg: LlmConfig): Promise<{ latencyMs: number }> {
  const started = Date.now();
  const schema = z.object({ ok: z.boolean() });
  await generateStructured(cfg, { tier: "fast", system: "You are a health check.", user: 'Return {"ok": true}.', schema, schemaName: "ping", maxTokens: 20 });
  return { latencyMs: Date.now() - started };
}
