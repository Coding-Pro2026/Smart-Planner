/**
 * Returns the URL only if it is a well-formed http(s) URL; otherwise undefined.
 * Blocks `javascript:`, `data:`, `vbscript:` etc. from untrusted sources
 * (LLM output, OpenStreetMap tags) before they reach an <a href>.
 */
export function safeHttpUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 2048) return undefined;
  try {
    const u = new URL(trimmed);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}
