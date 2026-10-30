/**
 * Fixed-window rate limiter behind an interface so Upstash/Redis can replace the in-memory store
 * for multi-instance deployments without touching call sites.
 */
export interface RateLimitStore {
  hit(key: string, windowMs: number): Promise<{ count: number; resetAt: number }>;
}

export class MemoryRateLimitStore implements RateLimitStore {
  private buckets = new Map<string, { count: number; resetAt: number }>();
  async hit(key: string, windowMs: number) {
    const now = Date.now();
    if (this.buckets.size > 10_000) for (const [k, b] of this.buckets) if (b.resetAt <= now) this.buckets.delete(k);
    const cur = this.buckets.get(key);
    if (!cur || cur.resetAt <= now) {
      const fresh = { count: 1, resetAt: now + windowMs };
      this.buckets.set(key, fresh);
      return fresh;
    }
    cur.count += 1;
    return cur;
  }
}

let store: RateLimitStore = new MemoryRateLimitStore();
export const setRateLimitStore = (s: RateLimitStore) => (store = s);

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<{ ok: boolean; retryAfterSec: number }> {
  const { count, resetAt } = await store.hit(key, windowMs);
  return { ok: count <= limit, retryAfterSec: Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)) };
}
