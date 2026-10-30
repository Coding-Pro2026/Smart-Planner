import { NextResponse } from "next/server";
import { api, HttpError } from "@/lib/http";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { registerSchema } from "@/lib/schemas";

export const POST = api({ public: true, body: registerSchema, rate: { name: "register", limit: 10, windowMs: 60_000 } }, async ({ body }) => {
  if (await db.user.findUnique({ where: { email: body.email }, select: { id: true } })) throw new HttpError(409, "That email is already registered");
  const user = await db.user.create({ data: { email: body.email, passwordHash: await hashPassword(body.password) }, select: { id: true, email: true } });
  const res = NextResponse.json({ user });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(user.id), sessionCookieOptions);
  return res;
});
