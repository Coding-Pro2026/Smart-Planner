# PlanGenie — GenAI event planning assistant

Plan weddings, birthdays and community events with budgets, dependency-aware timelines, vendor-quote analysis and an AI
assistant. **Bring your own model**: OpenAI, Anthropic, Google Gemini, OpenRouter, or a local Ollama / any OpenAI-compatible server.

## The one design rule

> **The LLM suggests and extracts. Code calculates and decides.**

| Concern | Who does it |
|---|---|
| Ideas, themes, checklists, categorising items, reading PDFs / mood boards | LLM → forced through strict **Zod** schemas |
| Totals, tax, contingency, % used, threshold alerts, quote all-in totals | `src/lib/engine/budget.ts`, `quotes.ts` (integer cents, no floats) |
| Dates, T-minus offsets, dependency cascade, critical path, cycle detection | `src/lib/engine/schedule.ts`, `dates.ts` (CPM on a DAG) |
| Changing the plan | Agent produces a **proposal**; a human clicks Accept; code re-validates and applies in one DB transaction |

## What's in the box

* **Dashboard** – days to event, budget burn, RSVPs, tasks done, overspend / critical-path alerts.
* **Budget** – line items with live server-side math; **simulator** sliders (guests, target, per-category price level) run the *same* engine in the browser.
* **Timeline** – Gantt with critical path (red), dependency links, event-day marker, **drag a bar to shift it** → preview of every downstream task that moves → Accept/Reject.
* **Vendors** – upload a PDF quote → extracted line items, hidden fees, payment schedule, cancellation terms, risk clauses (LLM + regex backstop) → totals **recomputed by code** and compared with the printed total → side-by-side **comparison matrix** that highlights items one vendor didn't quote.
* **Assistant** – Supervisor → (Theme · Budget · Logistics · Vendor) specialists, parallel fan-out, deterministic merge, checkpoint per node (`agent_runs`). Attach a mood-board image for a hex palette.
* **Guests / Team** – RSVPs & dietary needs; roles `owner / editor / viewer / vendor`; audit log.
* Works **without any AI key**: starter timeline + benchmark budget are deterministic templates.

## Quick start

```bash
cp .env.example .env            # then fill the two secrets:
npm run gen:master-key          # -> ENCRYPTION_MASTER_KEY
openssl rand -base64 48         # -> AUTH_SECRET
# Postgres 14+ must be reachable at DATABASE_URL
npm install
npx prisma db push
npm run dev                     # http://localhost:3000
```

Then open **Settings → AI keys**, pick a provider, paste a key and *Test connection & save*.
For Ollama: provider "Ollama (local)", base URL `http://localhost:11434/v1`, and set `ALLOW_PRIVATE_LLM_ENDPOINTS=true` in `.env` (local dev only).

## BYOK key handling

* **Session-only (recommended):** the key is encrypted in the browser with AES-256-GCM using a *non-extractable* WebCrypto key held in IndexedDB; ciphertext lives in `sessionStorage` (gone when the tab closes). It's sent per AI request in an `x-llm-key` header over TLS, held in memory for that call, and never stored, cached, logged or echoed.
* **Vault:** keys are stored in Postgres with **envelope encryption**: a random per-user DEK encrypts each key (AES-256-GCM, fresh 96-bit IV per value); the DEK is wrapped by `ENCRYPTION_MASTER_KEY`. Ciphertexts are bound (as GCM AAD) to the user and provider, so rows can't be swapped between accounts. The API only ever returns a masked hint (`••••abcd`). Rotate the master key with `rotateMasterKey()` (re-wraps DEKs only).
* A key is **pinged with a minimal request before it is saved**.
* Honest limit: session-only protects against disk/DB/log leaks, not against XSS in the same origin — hence the strict CSP and zero third-party scripts.

## Tests

```bash
npm test                         # 108 unit + integration tests (needs Postgres, see TEST_DATABASE_URL)
npx playwright test              # 9 browser E2E tests against a production build + fake LLM server
npm run build && npm run audit:security -- --url http://localhost:3000   # automated security audit
```

## Layout

```
prisma/schema.prisma              users, events, collaborators, budget_items, tasks, vendors, guest_rsvps, audit_logs (+ proposals, agent_runs)
src/lib/engine/                   budget.ts · schedule.ts (CPM) · quotes.ts · dates.ts     ← deterministic core, pure & isomorphic
src/lib/crypto.ts                 AES-256-GCM envelope encryption
src/lib/llm/                      provider adapters (OpenAI-compatible, Anthropic, Gemini), Zod structured output + retry, key resolution
src/lib/agent/                    tools.ts (typed tool contracts) · graph.ts (supervisor → specialists → merge, checkpoints) · context.ts
src/lib/security/                 prompt-injection sanitiser/fencing, rate limiter · src/lib/net/ssrf.ts (connect-time IP validation)
src/lib/services/                 transactional business logic (schedule persistence, budget, applying accepted proposals)
src/app/api/**                    thin routes, all via the `api()` wrapper (session, CSRF/origin, rate limit, body cap, Zod, error mapping)
src/app/**, src/components/**     Next.js 15 UI (TanStack Query, dnd-kit, Framer Motion)
scripts/security-audit.mjs        automated audit (leak scan, authz coverage, runtime probes, test run)
security/zap-baseline.yaml        OWASP ZAP automation plan · .github/workflows/ci.yml (typecheck, lint, tests, audit, Trivy)
tests/{unit,integration,e2e}
```

## Deliberate deviations from the original brief

| Brief | What was built | Why |
|---|---|---|
| FastAPI worker service | Everything in Next.js route handlers | No heavy long-running jobs yet; a second runtime doubles ops surface. The engines are pure modules and can be moved to a worker unchanged. |
| LangChain / LangGraph | A small typed graph runner with the same shape (nodes, fan-out, checkpoints) | Fewer dependencies, every edge unit-testable with a fake model. Swap-in is mechanical if you want LangGraph Studio/tracing. |
| Redis (Upstash) | Rate limiter behind a `RateLimitStore` interface, in-memory impl | Correct for one instance; implement the 1-method interface for Upstash before scaling horizontally. |
| pgvector RAG | Not included | Nothing in the current features needs retrieval; add when you want cross-event "memory" or vendor knowledge bases. |
| Supabase/NextAuth | Own email+password (scrypt) + signed httpOnly JWT cookie | Zero external services for local testing. |
| Real-time sync | TanStack Query refetch-on-focus + invalidation | Add SSE/Redis pub-sub later. |
| Scanned-PDF OCR | Text PDFs only (clear error for scans) | Vision-on-pages is a natural next step. |
| Kanban | Gantt + status table | Gantt covers the brief's "Kanban/Gantt". |
