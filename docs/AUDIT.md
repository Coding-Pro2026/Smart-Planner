# PlanGenie — Security, Privacy & Legal Audit (BYOK release)

_Engineering review, not legal advice. Have counsel confirm before a commercial launch._

## 1. Scope
Bring-your-own-key AI (Gemini, Claude, OpenAI, OpenRouter, custom OpenAI-compatible), key-free Google Calendar,
OpenStreetMap-based maps/hotels, plus a re-check of everything from the previous security pass.

## 2. Findings & status

| # | Area | Finding | Severity | Status |
|---|------|---------|----------|--------|
| 1 | Maps | Keyless iframe `google.com/maps?output=embed` is an undocumented, unsupported embed. Google's supported Embed API requires a key under the Maps Platform Terms. | High (ToS) | **Fixed** – default is the official OpenStreetMap embed; Google Maps JS SDK only with the *user's own* key. Google *Maps URLs* (`/maps/search/?api=1`, `/maps/dir/?api=1`) remain as plain links – documented, keyless and permitted. |
| 2 | Hotels | The "deals" endpoint invented brand-name hotels (Hampton Inn, Hyatt Place, Radisson…), prices, ratings, "% savings" and amenities. Presenting fabricated commercial claims about real businesses risks false-advertising / consumer-protection / trademark issues and misleads users. | High (legal/trust) | **Fixed** – only real OpenStreetMap hotels are listed (name, address, coordinates, distance, stars *if tagged*). Prices are never invented; each hotel links to a live Google Hotels/Maps search. UI says so. |
| 3 | Hotels | Gemini "Google Search grounding" was used to scrape prices; its terms require showing Search Suggestions and the output was unverified. | Medium | **Removed**. |
| 4 | OSM | Nominatim policy (identifying User-Agent, ≤1 req/s, caching, no bulk/autocomplete) and ODbL attribution were not met. | Medium | **Fixed** – `src/server/geo.ts` serialises calls (≥1.1 s), caches 24 h, sends a contact-bearing User-Agent (`NOMINATIM_CONTACT`), and the UI shows "© OpenStreetMap contributors". For heavy traffic self-host Nominatim/Overpass or use a commercial geocoder. |
| 5 | SSRF | New: users can supply a *custom* AI base URL that the server calls. Unchecked, this is a server-side request forgery vector (cloud metadata, internal services, DNS rebinding). | Critical (if unmitigated) | **Mitigated** – https only; no credentials in URL; every resolved IP is validated at *connect time* (private, loopback, link-local/metadata, CGNAT, multicast, IPv4-mapped IPv6 blocked); no redirects; 4 MB response cap; timeouts. Base URL is honoured only for the `custom` provider, so official providers' keys can only reach official hosts. Local servers (Ollama) need explicit `ALLOW_PRIVATE_AI_URLS=true`. 17 automated tests cover this. |
| 6 | Secrets | User API keys transit our server. | High (handling) | **Mitigated** – sent over HTTPS in headers/body, used for one upstream call, never stored or logged; provider errors are scrubbed (`redactSecret`); the key is excluded from autosave/exports; default storage is `sessionStorage` (opt-in "remember" → `localStorage`). Keys are validated (printable, no whitespace) to prevent header injection. |
| 7 | Residual | The server could be used as a low-grade relay to POST fixed-shape JSON to arbitrary *public* HTTPS hosts via `custom`. | Low | **Accepted** – requests are path-pinned (`/chat/completions`, `/models`), rate-limited (90/min/IP), size/time-capped. |
| 8 | Residual | XSS would expose a remembered key in `localStorage`. | Medium | **Mitigated** – strict CSP, no `innerHTML`, React escaping, URL allow-listing; session-only default. |
| 9 | Google Calendar | Previous flow required a developer-owned Firebase/OAuth setup (and was disabled). | – | **Replaced** – (a) *Add to Google Calendar* template link + `.ics` + `mailto:` need no credentials at all; (b) optional two-way RSVP sync uses the **user's own** OAuth Client ID through Google Identity Services in the browser. The token stays in memory; no secret exists on our side. A Client ID is public by design. Because `calendar.events` is a sensitive scope, a shared client would need Google's OAuth verification; user-owned clients in "Testing" mode avoid that. |
| 10 | Privacy | Event details are sent to the AI provider the user chooses. | Medium | **Disclosed** in the AI Settings dialog; nothing is persisted server-side; provider billing/retention is governed by the user's own agreement with that provider. Add a privacy notice if you host this for others (GDPR/CCPA). |
| 11 | CSP/COOP | Google sign-in popups require `Cross-Origin-Opener-Policy: same-origin-allow-popups`; CSP extended only for `accounts.google.com`, `www.googleapis.com`, `maps.googleapis.com`, `openstreetmap.org`. | Info | **Done** and browser-verified under the production CSP. |
| 12 | Dependencies | `bun audit`: 0 vulnerabilities (firebase removed earlier). | – | Re-verified. CI fails on high+. |
| 13 | Model routing | Fictional model ids (`gemini-3.8-flash`) and an unauthenticated routing endpoint. | Low | **Removed**; models are chosen by the user from the provider's real list. |

## 3. Provider terms checklist
- Each provider is called server-side with the user's own key (no browser-direct Anthropic access needed).
- Don't ship a shared key in the client or repo; keep any server default key in platform secrets.
- OpenRouter: sends `X-Title: PlanGenie`; add `HTTP-Referer` if you want app attribution there.

## 4. Open items for a public launch
1. Add user authentication before storing any shared data server-side.
2. Publish a privacy policy + terms (describe BYOK data flow, OSM/Nominatim, Google Calendar).
3. Replace public Nominatim/Overpass with self-hosted or paid services if traffic grows.
4. Rate limiting is per instance; use a shared store/WAF at scale.
