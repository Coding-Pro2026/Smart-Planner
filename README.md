# PlanGenie — GenAI Event Planning Assistant

Plan **weddings, birthdays, community events** (and memorials) with a budget engine, critical-path timeline,
vendor checklist & quote analyzer, guest/RSVP tracking and personalised ideas — driven by a multi-agent AI
assistant that **works with or without an API key**.

## Quick start

```bash
bun install        # or: npm install
npm run dev        # http://localhost:3000
```

No keys are required: every AI feature has a deterministic offline engine. Add keys only to upgrade it.

```bash
cp .env.example .env   # then set GEMINI_API_KEY to enable Gemini
```

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Enables Gemini for the assistant, intake chat, idea studio, quote analyzer, moodboard & hotel grounding. Automatic fallback to the local engine on any error/quota/timeout. |
| `GEMINI_MODEL_FAST` / `_LITE` / `_REASONING` | Override model ids (defaults: `gemini-2.5-flash`, `gemini-2.5-flash-lite`). |
| `VITE_GOOGLE_MAPS_API_KEY` | Optional interactive Maps SDK (keyless embed otherwise). |
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
npm test            # 18 verification checks (math, DAG, crypto, parsers, exports…)
npm run build       # production bundle
npm run verify      # all of the above
```

## Architecture

`server.ts` (Express + Vite middleware) exposes `/api/agents/*`; each endpoint tries Gemini (timeout, JSON-schema output,
validation) then falls back to the pure modules in `src/lib/` that are shared by server and browser
(`intakeParser`, `quoteParser`, `localAssistant`, `ideas`, `moodboardGenerator`, `insights`, `exporters`).
Money and dates are never computed by the LLM — the model only *proposes* structured actions.
