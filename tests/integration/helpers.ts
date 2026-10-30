import { NextRequest } from "next/server";
import { vi } from "vitest";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth/session";

let currentCookie: string | undefined;
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (n: string) => (n === SESSION_COOKIE && currentCookie ? { value: currentCookie } : undefined) }),
}));

type Handler = (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

export async function login(userId: string | null) {
  currentCookie = userId ? await createSessionToken(userId) : undefined;
}

export async function call(handler: Handler, o: { method?: string; params?: Record<string, string>; body?: unknown; headers?: Record<string, string>; as?: string | null } = {}) {
  if (o.as !== undefined) await login(o.as);
  const method = o.method ?? (o.body === undefined ? "GET" : "POST");
  const req = new NextRequest("http://localhost:3000/api/test", {
    method,
    headers: { host: "localhost:3000", origin: "http://localhost:3000", "content-type": "application/json", ...o.headers },
    body: o.body === undefined ? undefined : JSON.stringify(o.body),
  });
  const res = await handler(req, { params: Promise.resolve(o.params ?? {}) });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json, headers: res.headers, text };
}
