import { NextResponse } from "next/server";
import { api, HttpError } from "@/lib/http";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { loginSchema } from "@/lib/schemas";

let dummyHash: Promise<string> | undefined;

export const POST = api({ public: true, body: loginSchema, rate: { name: "login", limit: 10, windowMs: 60_000 } }, async ({ body }) => {
  const user = await db.user.findUnique({ where: { email: body.email } });
  // Always run one scrypt verification so response time doesn't reveal whether the account exists.
  dummyHash ??= hashPassword("dummy-password-for-timing");
  const ok = await verifyPassword(body.password, user?.passwordHash ?? (await dummyHash));
  if (!user || !user.passwordHash || !ok) throw new HttpError(401, "Invalid email or password");
  const res = NextResponse.json({ user: { id: user.id, email: user.email } });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(user.id), sessionCookieOptions);
  return res;
});
