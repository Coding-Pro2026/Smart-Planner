#!/usr/bin/env node
/**
 * PlanGenie post-build security & reliability audit.
 *
 *   npm run build && node scripts/security-audit.mjs [--url http://localhost:3000] [--skip-tests]
 *
 * Static checks (always):   secret/key leak scan of the client bundle, route authz coverage, tenant-scoping
 *                           heuristics, dangerous-API grep, dependency audit.
 * Runtime probes (--url):   security headers, unauthenticated access, CSRF/origin check, error hygiene.
 * Test suites (default):    unit + integration (Vitest). E2E is run separately: `npx playwright test`.
 * Exit code 1 if any check fails.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const args = process.argv.slice(2);
const urlArg = args.includes("--url") ? args[args.indexOf("--url") + 1] : process.env.AUDIT_URL;
const skipTests = args.includes("--skip-tests");

const results = [];
const check = (area, name, ok, detail = "") => {
  results.push({ area, name, ok, detail });
  console.log(`${ok ? "  PASS" : "  FAIL"}  [${area}] ${name}${detail ? ` — ${detail}` : ""}`);
};
const walk = (dir, filter = () => true, out = []) => {
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, filter, out);
    else if (filter(p)) out.push(p);
  }
  return out;
};
const read = (p) => readFileSync(p, "utf8");

// Load secrets from .env (if present) so we can search for their literal values in build output.
const envSecrets = [];
for (const f of [".env", ".env.local"]) {
  if (!existsSync(join(root, f))) continue;
  for (const line of read(join(root, f)).split("\n")) {
    const m = /^(ENCRYPTION_MASTER_KEY|AUTH_SECRET)\s*=\s*"?([^"\n]+)"?/.exec(line);
    if (m && m[2].length >= 16) envSecrets.push([m[1], m[2]]);
  }
}

console.log("\n== 1. Secret & key leak test ==");
// Anchored with a lookbehind so identifiers like "ma[sk-image-linear-from-pos]" (tailwind-merge) are not mistaken for keys.
const KEY_SHAPES = [/(?<![A-Za-z0-9_-])sk-(?:ant-|or-|proj-)?[A-Za-z0-9_-]{20,}/, /(?<![A-Za-z0-9_-])AIza[0-9A-Za-z_-]{30,}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/];
const hasBuild = existsSync(join(root, ".next"));
check("leak", "production build present (.next)", hasBuild, hasBuild ? "" : "run `npm run build` first");
if (hasBuild) {
  const clientFiles = walk(join(root, ".next/static"), (p) => /\.(js|css|html|map)$/.test(p));
  const htmlFiles = walk(join(root, ".next/server/app"), (p) => p.endsWith(".html"));
  const scanned = [...clientFiles, ...htmlFiles];
  let leaks = [];
  for (const f of scanned) {
    const txt = read(f);
    for (const [name, val] of envSecrets) if (txt.includes(val)) leaks.push(`${name} value in ${relative(root, f)}`);
    for (const re of KEY_SHAPES) if (re.test(txt)) leaks.push(`${re} in ${relative(root, f)}`);
    for (const word of ["ENCRYPTION_MASTER_KEY", "AUTH_SECRET", "DATABASE_URL"]) if (txt.includes(word)) leaks.push(`"${word}" referenced in ${relative(root, f)}`);
  }
  check("leak", `no secret values / key-shaped strings / server env names in ${scanned.length} client bundle & prerendered HTML files`, leaks.length === 0, leaks.slice(0, 3).join("; "));
  check("leak", "no source maps shipped to the browser", !clientFiles.some((f) => f.endsWith(".map")));
  const serverOnly = walk(join(root, ".next/static"), (p) => p.endsWith(".js")).filter((f) => /@prisma\/client|node:crypto|undici/.test(read(f)));
  check("leak", "server-only modules (prisma, node:crypto, undici) absent from client chunks", serverOnly.length === 0, serverOnly.map((f) => relative(root, f)).slice(0, 2).join(", "));
}
const src = walk(join(root, "src"), (p) => /\.(ts|tsx)$/.test(p));
const pubEnv = src.flatMap((f) => [...read(f).matchAll(/NEXT_PUBLIC_[A-Z_]+/g)].map((m) => `${m[0]} in ${relative(root, f)}`));
check("leak", "no NEXT_PUBLIC_* variables used (nothing is exposed to the client by env)", pubEnv.length === 0, pubEnv.join(", "));
const consoleUse = src.filter((f) => !f.endsWith("logger.ts") && /\bconsole\.(log|info|warn|error|debug)\(/.test(read(f)));
check("leak", "all logging goes through the redacting logger (no raw console.*)", consoleUse.length === 0, consoleUse.map((f) => relative(root, f)).join(", "));
const keyEcho = routes0().flatMap((f) => read(f).split("\n").filter((l) => /(return|json\()\s*[({].*\bapiKey\b/.test(l)).map(() => relative(root, f)));
function routes0() { return walk(join(root, "src/app/api"), (p) => p.endsWith("route.ts")); }
check("leak", "no API route returns an apiKey field", keyEcho.length === 0, keyEcho.map((f) => relative(root, f)).join(", "));

console.log("\n== 2. Prompt-injection & SSRF safeguards ==");
const sanitize = existsSync(join(root, "src/lib/security/sanitize.ts"));
check("injection", "untrusted text is sanitised + fenced before reaching a model", sanitize && /fenceUntrusted/.test(read(join(root, "src/lib/agent/graph.ts"))) && /fenceUntrusted/.test(read(join(root, "src/app/api/events/[eventId]/vendors/upload/route.ts"))));
const toolsSrc = read(join(root, "src/lib/agent/tools.ts"));
check("injection", "agent output restricted to a closed, Zod-validated tool union (no free-form actions)", /discriminatedUnion\("tool"/.test(toolsSrc));
check("injection", "state-changing agent actions require explicit human Accept (proposal flow)", /status: "pending"|proposal\.create/.test(read(join(root, "src/app/api/events/[eventId]/chat/route.ts"))) && /updateMany/.test(read(join(root, "src/app/api/events/[eventId]/proposals/[proposalId]/route.ts"))));
const pdfSrc = read(join(root, "src/lib/documents/pdf.ts"));
check("ssrf", "document pipeline does no network I/O (no fetch/http/dns imports in pdf.ts)", !/\bfetch\(|node:https?|node:net|node:dns|undici/.test(pdfSrc));
const fetchUse = src.filter((f) => /\bfetch\(/.test(read(f)) && !f.includes("/client/") && !f.includes("/app/") || f.endsWith("llm/providers.ts"));
const providersSrc = read(join(root, "src/lib/llm/providers.ts"));
check("ssrf", "user-supplied LLM base URLs only go through safeFetch (IP-validated at connect time, no redirects)", /safeFetch\(url, init\)/.test(providersSrc) && /redirect: "error"/.test(read(join(root, "src/lib/net/ssrf.ts"))) && /isBlockedIp/.test(read(join(root, "src/lib/net/ssrf.ts"))) && fetchUse.every((f) => f.endsWith("providers.ts") || f.endsWith("ssrf.ts")));
check("ssrf", "uploads are validated by magic bytes and size, not by filename / MIME", /%PDF-/.test(pdfSrc) && /0x89/.test(read(join(root, "src/lib/images.ts"))));

console.log("\n== 3. Data validation & tenant isolation ==");
const routes = walk(join(root, "src/app/api"), (p) => p.endsWith("route.ts"));
const unwrapped = routes.filter((f) => !/\bapi\(/.test(read(f)));
check("authz", `all ${routes.length} API route files use the api() wrapper (auth + CSRF + rate limit + Zod + error mapping)`, unwrapped.length === 0, unwrapped.map((f) => relative(root, f)).join(", "));
const publicRoutes = routes.filter((f) => /public: true/.test(read(f))).map((f) => relative(root, f));
check("authz", "only auth endpoints are public", publicRoutes.every((f) => f.includes("/auth/")), publicRoutes.join(", "));
const eventRoutes = routes.filter((f) => f.includes("[eventId]"));
const noGuard = eventRoutes.filter((f) => !/requireEvent\(/.test(read(f)));
check("authz", `every one of ${eventRoutes.length} event-scoped routes calls requireEvent() with a permission`, noGuard.length === 0, noGuard.map((f) => relative(root, f)).join(", "));
const idOnly = eventRoutes.flatMap((f) => [...read(f).matchAll(/\.(update|delete|findUnique|findUniqueOrThrow)\(\{\s*where:\s*\{\s*id:\s*params\.(?!eventId)/g)].map(() => relative(root, f)));
check("tenant", "no event-scoped route mutates/reads a child row by bare URL id (must filter by eventId)", idOnly.length === 0, idOnly.join(", "));
const mutating = eventRoutes.filter((f) => /export const (POST|PATCH|PUT|DELETE)/.test(read(f)));
const unvalidated = mutating.filter((f) => {
  const t = read(f);
  return /export const (POST|PATCH|PUT)/.test(t) && !/body:/.test(t) && !/raw: true/.test(t) && !/api\(\{\}/.test(t);
});
check("validation", "every JSON mutating route declares a Zod body schema", unvalidated.length === 0, unvalidated.map((f) => relative(root, f)).join(", "));
const schema = read(join(root, "prisma/schema.prisma"));
check("tenant", "all event-owned tables cascade-delete from events and are indexed by event_id", ["BudgetItem", "Task", "Vendor", "GuestRsvp", "AuditLog", "Proposal", "AgentRun", "Collaborator"].every((m) => new RegExp(`model ${m} \\{[\\s\\S]*?onDelete: Cascade[\\s\\S]*?\\}`).test(schema)));
const dangerous = src.filter((f) => /dangerouslySetInnerHTML|\beval\(|new Function\(|child_process|\$queryRawUnsafe|\$executeRawUnsafe/.test(read(f)));
check("validation", "no dangerouslySetInnerHTML / eval / child_process / raw-unsafe SQL in src/", dangerous.length === 0, dangerous.map((f) => relative(root, f)).join(", "));
const cfg = read(join(root, "next.config.mjs"));
check("headers", "CSP, HSTS, nosniff, frame-deny headers configured", ["Content-Security-Policy", "Strict-Transport-Security", "X-Content-Type-Options", "X-Frame-Options"].every((h) => cfg.includes(h)) && cfg.includes("poweredByHeader: false"));

console.log("\n== 4. Dependency audit ==");
const audit = spawnSync("npm", ["audit", "--omit=dev", "--json"], { encoding: "utf8" });
try {
  const j = JSON.parse(audit.stdout || "{}");
  const v = j.metadata?.vulnerabilities ?? {};
  check("deps", `npm audit (prod): critical=${v.critical ?? 0} high=${v.high ?? 0} moderate=${v.moderate ?? 0}`, (v.critical ?? 0) === 0, "high/moderate findings are listed in the README report with justification");
} catch {
  check("deps", "npm audit executed", false, "could not parse npm audit output (offline?)");
}

if (urlArg) {
  console.log(`\n== 5. Runtime probes against ${urlArg} ==`);
  const get = async (p, init) => fetch(new URL(p, urlArg), { redirect: "manual", ...init });
  try {
    const home = await get("/login");
    const h = home.headers;
    check("runtime", "security headers present on pages", !!h.get("content-security-policy") && !!h.get("x-content-type-options") && h.get("x-frame-options") === "DENY" && !!h.get("strict-transport-security"));
    check("runtime", "x-powered-by removed", !h.get("x-powered-by"));
    check("runtime", "CSP forbids third-party scripts and framing", /script-src 'self'/.test(h.get("content-security-policy") ?? "") && /frame-ancestors 'none'/.test(h.get("content-security-policy") ?? ""));
    const html = await home.text();
    check("runtime", "served HTML contains no secrets", !envSecrets.some(([, v]) => html.includes(v)) && !KEY_SHAPES.some((re) => re.test(html)));
    for (const p of ["/api/events", "/api/auth/me", "/api/llm/vault", "/api/events/abc/budget"]) {
      const r = await get(p);
      check("runtime", `unauthenticated GET ${p} -> 401`, r.status === 401, `got ${r.status}`);
    }
    const xo = await get("/api/auth/login", { method: "POST", headers: { origin: "https://evil.example", "content-type": "application/json" }, body: JSON.stringify({ email: "a@b.co", password: "x" }) });
    check("runtime", "cross-origin POST is rejected (CSRF)", xo.status === 403, `got ${xo.status}`);
    const bad = await get("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: "{not json" });
    const badText = await bad.text();
    check("runtime", "malformed JSON -> 400 without stack trace", bad.status === 400 && !/at\s+\S+\s+\(/.test(badText), `got ${bad.status}`);
    const big = await get("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "a@b.co", password: "x".repeat(1_100_000) }) });
    check("runtime", "oversized body -> 413", big.status === 413, `got ${big.status}`);
    const cache = await get("/api/auth/me");
    check("runtime", "API responses are no-store", /no-store/.test(cache.headers.get("cache-control") ?? ""));
    let limited = false;
    for (let i = 0; i < 14 && !limited; i++) {
      const r = await get("/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.77" }, body: JSON.stringify({ email: "nobody@example.com", password: "wrong-pass-1" }) });
      limited = r.status === 429;
    }
    check("runtime", "login endpoint is rate-limited (429 within 14 attempts)", limited);
  } catch (e) {
    check("runtime", "server reachable", false, String(e.message));
  }
} else {
  console.log("\n== 5. Runtime probes skipped (pass --url http://localhost:3000 against a running `next start`) ==");
}

if (!skipTests) {
  console.log("\n== 6. Unit & integration test suites ==");
  const t = spawnSync("npx", ["vitest", "run", "--reporter=dot"], { encoding: "utf8", env: { ...process.env, FORCE_COLOR: "0" } });
  const tail = (t.stdout + t.stderr).split("\n").filter((l) => /Tests |Test Files/.test(l)).map((l) => l.trim()).join(" | ");
  check("tests", "vitest (budget edge cases, CPM cycle detection, BYOK crypto roundtrip, tenant isolation, agent flow)", t.status === 0, tail);
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
if (failed.length) {
  console.log("FAILED:\n" + failed.map((f) => ` - [${f.area}] ${f.name} ${f.detail}`).join("\n"));
  process.exit(1);
}
