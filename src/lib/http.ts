import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { CollaboratorRole } from "@prisma/client";
import { SESSION_COOKIE, verifySessionToken } from "./auth/session";
import { can, getEventRole, type Permission } from "./authz";
import { db } from "./db";
import { BudgetValidationError } from "./engine/budget";
import { ScheduleError } from "./engine/schedule";
import { ActionError } from "./services/actions";
import { LlmError } from "./llm/types";
import { SsrfError } from "./net/ssrf";
import { CryptoError } from "./crypto";
import { log } from "./logger";
import { rateLimit } from "./security/rate-limit";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
export const notFound = () => new HttpError(404, "Not found");

const MAX_BODY_BYTES = 1_000_000;

export interface Ctx<B> {
  req: NextRequest;
  user: { id: string; email: string };
  params: Record<string, string>;
  body: B;
}

interface Opts<S extends z.ZodType | undefined> {
  /** Skip session requirement (login / register). */
  public?: boolean;
  body?: S;
  rate?: { name: string; limit: number; windowMs: number };
  /** Accept multipart bodies (handler parses `req.formData()` itself). */
  raw?: boolean;
}

function assertSameOrigin(req: NextRequest) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  if (req.headers.get("sec-fetch-site") === "cross-site") throw new HttpError(403, "Cross-site request blocked");
  const origin = req.headers.get("origin");
  if (origin) {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    let originHost = "";
    try {
      originHost = new URL(origin).host;
    } catch {
      /* fallthrough */
    }
    if (!host || originHost !== host) throw new HttpError(403, "Cross-origin request blocked");
  }
}

export async function currentUser() {
  const id = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!id) return null;
  return db.user.findUnique({ where: { id }, select: { id: true, email: true } });
}

export function api<S extends z.ZodType | undefined = undefined>(
  opts: Opts<S>,
  handler: (c: Ctx<S extends z.ZodType ? z.infer<S> : undefined>) => Promise<unknown>,
) {
  return async (req: NextRequest, routeCtx: { params: Promise<Record<string, string>> }): Promise<NextResponse> => {
    try {
      assertSameOrigin(req);
      const params = (await routeCtx.params) ?? {};
      const user = opts.public ? null : await currentUser();
      if (!opts.public && !user) throw new HttpError(401, "Not signed in");

      if (opts.rate) {
        const ident = user?.id ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
        const r = await rateLimit(`${opts.rate.name}:${ident}`, opts.rate.limit, opts.rate.windowMs);
        if (!r.ok) {
          return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "retry-after": String(r.retryAfterSec) } });
        }
      }

      let body: unknown = undefined;
      if (opts.body) {
        const declared = Number(req.headers.get("content-length") ?? 0);
        if (declared > MAX_BODY_BYTES) throw new HttpError(413, "Request too large");
        const text = await req.text();
        if (text.length > MAX_BODY_BYTES) throw new HttpError(413, "Request too large");
        let json: unknown;
        try {
          json = text ? JSON.parse(text) : {};
        } catch {
          throw new HttpError(400, "Invalid JSON");
        }
        const parsed = opts.body.safeParse(json);
        if (!parsed.success) {
          return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues.slice(0, 10).map((i) => ({ path: i.path.join("."), message: i.message })) }, { status: 400 });
        }
        body = parsed.data;
      }
      const result = await handler({ req, user: user ?? { id: "", email: "" }, params, body: body as never });
      if (result instanceof NextResponse) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (e) {
      return toErrorResponse(e);
    }
  };
}

export function toErrorResponse(e: unknown): NextResponse {
  if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof BudgetValidationError || e instanceof ScheduleError || e instanceof ActionError || e instanceof RangeError) {
    return NextResponse.json({ error: (e as Error).message }, { status: 422 });
  }
  if (e instanceof SsrfError) return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  if (e instanceof LlmError) return NextResponse.json({ error: e.message, kind: e.kind }, { status: e.status });
  if (e instanceof CryptoError) {
    log.error("crypto failure", { message: (e as Error).message });
    return NextResponse.json({ error: "Key vault error" }, { status: 500 });
  }
  log.error("unhandled", e);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

/** Resolves the caller's role on an event or throws 404 (never reveals that the event exists). */
export async function requireEvent(userId: string, eventId: string, perm: Permission): Promise<CollaboratorRole> {
  const role = await getEventRole(userId, eventId);
  if (!role) throw notFound();
  if (!can(role, perm)) throw new HttpError(403, "You do not have permission to do that");
  return role;
}
