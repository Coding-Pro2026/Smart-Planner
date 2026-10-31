/**
 * Resilient JSON fetch helper: timeout, HTTP error normalisation and a
 * guaranteed-typed result so UI code never has to wrap fetch in try/catch.
 */

import { AI_WARNING_EVENT, aiHeaders } from './aiConfig';

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

export async function postJson<T = unknown>(
  url: string,
  body: unknown,
  opts: { timeoutMs?: number; headers?: Record<string, string>; signal?: AbortSignal } = {}
): Promise<ApiResult<T>> {
  return requestJson<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(opts.headers ?? {}) },
    body: JSON.stringify(body ?? {}),
    timeoutMs: opts.timeoutMs,
    externalSignal: opts.signal,
  });
}

export async function getJson<T = unknown>(
  url: string,
  opts: { timeoutMs?: number } = {}
): Promise<ApiResult<T>> {
  return requestJson<T>(url, { method: 'GET', timeoutMs: opts.timeoutMs });
}

async function requestJson<T>(
  url: string,
  init: RequestInit & { timeoutMs?: number; externalSignal?: AbortSignal }
): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? 45_000);
  let cancelled = false;
  const onExternalAbort = () => {
    cancelled = true;
    controller.abort();
  };
  init.externalSignal?.addEventListener('abort', onExternalAbort);
  try {
    // BYOK: attach the user's own AI settings to AI endpoints only (never to other requests).
    const headers = url.startsWith('/api/agents/')
      ? { ...(init.headers as Record<string, string> | undefined), ...aiHeaders() }
      : init.headers;
    const res = await fetch(url, { ...init, headers, signal: controller.signal });
    const fallback = res.headers.get('x-ai-fallback');
    if (fallback) {
      window.dispatchEvent(new CustomEvent(AI_WARNING_EVENT, { detail: fallback }));
    }
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    if (!res.ok) {
      const msg =
        data && typeof data === 'object' && 'error' in data
          ? String((data as { error: unknown }).error)
          : `Request failed (${res.status})`;
      return { ok: false, error: msg, status: res.status };
    }
    return { ok: true, data: data as T };
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === 'AbortError';
    return {
      ok: false,
      error: cancelled
        ? 'Cancelled.'
        : aborted
        ? 'The request timed out. Please try again.'
        : 'Network unavailable — working offline with the built-in planning engine.',
    };
  } finally {
    clearTimeout(timer);
    init.externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}
