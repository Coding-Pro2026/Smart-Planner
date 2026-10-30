"use client";
import { llmHeaders, loadConfig } from "./keystore";

export class ApiError extends Error {
  constructor(public status: number, message: string, public data?: unknown) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown; form?: FormData; llm?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers["content-type"] = "application/json";
  if (init.llm) Object.assign(headers, llmHeaders(await loadConfig()));
  const res = await fetch(`/api${path}`, {
    method: init.method ?? (init.body !== undefined || init.form ? "POST" : "GET"),
    headers,
    body: init.form ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined),
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`, data);
  return data as T;
}

export const fmtMoney = (n: number, currency = "USD") => new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
export const fmtMoney2 = (n: number, currency = "USD") => new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n);
export const cents = (c: number, currency = "USD") => fmtMoney2(c / 100, currency);

export const fileToBase64 = (f: File): Promise<string> =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] ?? "");
    r.onerror = () => rej(r.error);
    r.readAsDataURL(f);
  });
