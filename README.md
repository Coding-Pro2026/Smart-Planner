# PlanGenie — GenAI Event Planning Assistant

Plan **weddings, birthdays, community events** (and memorials) with a budget engine, critical-path timeline,
vendor checklist & quote analyzer, guest/RSVP tracking and personalised ideas — driven by a multi-agent AI
assistant that **works with or without an API key**.

## Quick start

```bash
bun install        # or: npm install
npm run dev        # http://localhost:3000
```

No keys are required: every AI feature has a deterministic offline engine.

### Bring your own AI key (BYOK)
Click the **🔑 key button** (header, or bottom-left on the landing/intake screens), choose **Gemini, Claude, GPT,
OpenRouter or Custom (any OpenAI-compatible endpoint: Groq, Together, Mistral, DeepSeek, vLLM, LM Studio, Ollama…)**,
paste your key, click **Load my models** to pick from your provider's real model list, **Test connection**, **Save**.
That's it — the assistant, intake chat, Idea Studio, quote analyzer and moodboard all switch to your model.
Keys live in your browser (session-only unless you tick "Remember on this device"), travel over HTTPS to the server only
for your requests, and are never stored or logged. If your key fails, you're told and the built-in engine answers instead.

Optional server-side default (so visitors don't have to bring a key): set `GEMINI_API_KEY`, or `AI_PROVIDER` +
`AI_API_KEY` (+ `AI_MODEL`, `AI_BASE_URL`) in `.env`.

### Google Calendar without any API keys from us
- **Add to Google Calendar** opens Google's own pre-filled event editor with your guests — no sign-in or API.
- **.ics download** and **email (BCC)** invitations work with any calendar/mail app.
- **Optional two-way RSVP sync:** create your own free OAuth *Web* client in Google Cloud (steps shown in-app), paste the
  Client ID, and PlanGenie reads guests' Yes/No answers straight from your calendar. Token stays in memory.

### Maps
OpenStreetMap by default (keyless, attributed). Prefer Google's map? Paste *your own* Maps JavaScript API key in the map card.
Hotels are real OpenStreetMap listings with links to live rates — prices are never invented.

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` / `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, `AI_BASE_URL` | Optional **server-side default** AI (users can still bring their own). Automatic fallback to the local engine on any error. |
| `ALLOW_PRIVATE_AI_URLS` | `true` only on your own machine, to let a custom endpoint point at localhost (Ollama/LM Studio). Never in production. |
| `NOMINATIM_CONTACT` | Email/URL put in the OpenStreetMap User-Agent (required by their usage policy). |
| `VITE_GOOGLE_MAPS_API_KEY` | Optional build-time Google Maps key (users can also paste their own in the UI). |
| `PORT`, `RATE_LIMIT_PER_MIN` | Server port (3000) and per-IP AI request limit (90/min). |

## Features

- **Readiness score & smart alerts** — one 0-100 score across schedule, budget, vendors and guests, with next-best actions.
- **Budget engine** — cent-exact tax/contingency rollups, guest-count simulator, category multipliers, YoY OLS forecast.
- **Critical-path timeline** — dependency DAG, automatic cascade on delay, cycle detection surfaced as a banner.
- **Vendor checklist** — per-event-type checklist with recommended booking dates, auto-linked to your vendors.
- **Quote analyzer** — paste any quote; extracts fees, true all-in cost, payment schedule, hidden fees and risky clauses.
- **Idea Studio** — personalised themes, activities, food, decor, favours and money-savers (Gemini or offline).
- **AI co-pilot** — "delay the florist 2 weeks", "add a DJ for $1,200", "add cake $12 per guest", "how is my budget?";
  changes are *proposed* and only applied when you accept.
- **Plan with AI intake** — describe your event in plain English (type, place, guests, budget, date).
- **Guests & RSVPs** — tracking, dietary needs, email reminders (BCC) and `.ics` invites with no Google account.
- **Export** — calendar (.ics), plan summary (.md), budget/guest CSV (formula-injection safe), JSON backup, print/PDF.
- **Autosave** — everything persists in the browser (versioned, corruption-tolerant); reset from the footer.

## Scripts

```bash
npm run typecheck   # tsc --noEmit
npm test            # 20 app checks + 17 BYOK/SSRF checks
npm run build       # production bundle
npm run verify      # all of the above
```

## Architecture

`server.ts` (Express + Vite middleware) exposes `/api/agents/*`; each endpoint tries Gemini (timeout, JSON-schema output,
validation) then falls back to the pure modules in `src/lib/` that are shared by server and browser
(`intakeParser`, `quoteParser`, `localAssistant`, `ideas`, `moodboardGenerator`, `insights`, `exporters`).
Money and dates are never computed by the LLM — the model only *proposes* structured actions.

## Deployment

```bash
npm run build && npm start            # builds client + dist/server.mjs, serves on $PORT (default 3000)
# or
docker build -t plangenie . && docker run -p 3000:3000 --env-file .env plangenie
```

Checklist: set `GEMINI_API_KEY` (optional) and `ENCRYPTION_MASTER_KEY` as platform secrets (never in the repo),
terminate TLS at your proxy/platform and set `TRUST_PROXY=1`, point health checks at `GET /api/health`.
The app is stateless server-side (plans live in the user's browser), so it scales horizontally; note the rate limiter
is per-instance.

## Privacy Policy & Terms
Published in-app at `/privacy` and `/terms` (linked from every footer and the AI Settings dialog). Before going public, set
`VITE_LEGAL_OPERATOR`, `VITE_LEGAL_EMAIL` (and optionally `VITE_LEGAL_ADDRESS`, `VITE_LEGAL_GOVERNING_LAW`) at build time —
until then the pages show a configuration notice. For Docker pass them as `--build-arg`. They describe the app's real data flows
(browser-only storage, BYOK, OpenStreetMap, Google Fonts/Calendar); update them if you add analytics, accounts or server storage.
They are a template, not legal advice — have counsel review.

## Security notes

- No secrets in source; `.env*` is git-ignored; no key material is hard-coded (random per-process key if none configured).
- Strict CSP + HSTS in production, nosniff, frame and permissions policies; `X-Powered-By` removed.
- Request bodies capped (256 KB; 8 MB only for the moodboard image); per-IP rate limit on `/api`.
- BYOK: custom endpoints are SSRF-guarded (https only, every resolved IP checked at connect time, no redirects); keys are never stored or logged. See `docs/AUDIT.md`.
- All LLM output is schema-validated and clamped; third-party URLs are restricted to `http(s)`; the UI never uses `innerHTML`.
- Prompt input is sanitised against injection; the LLM only *proposes* actions that the user must accept.
- Client-supplied tenant headers are ignored unless `TRUST_TENANT_HEADER=true` behind an authenticating gateway.
- Known limitation: there is no user authentication — plans are stored per-browser. Add auth before storing shared/multi-user data server-side.
- CI runs `bun audit` (currently 0 vulnerabilities), typecheck, tests and build.
