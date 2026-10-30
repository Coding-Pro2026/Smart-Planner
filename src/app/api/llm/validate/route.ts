import { api } from "@/lib/http";
import { finalize } from "@/lib/llm/resolve";
import { pingModel } from "@/lib/llm/structured";
import { validateKeyInput } from "@/lib/schemas";

/** Pings the provider with a minimal request. The key is used for this call only — never stored here. */
export const POST = api({ body: validateKeyInput, rate: { name: "llm-validate", limit: 10, windowMs: 60_000 } }, async ({ body }) => {
  const cfg = finalize(body);
  const { latencyMs } = await pingModel(cfg);
  return { ok: true, latencyMs };
});
