---
name: verify
description: Build and drive PlanGenie (Vite + React) in headless Chromium to verify UI changes end to end.
---

# Verifying PlanGenie UI changes

Surface: the browser. Don't just run tsc/tests.

## Launch
```bash
npx vite build && (nohup npx vite preview --port 4173 >/dev/null 2>&1 & echo $! > /tmp/pv.pid)
# stop later with: kill $(cat /tmp/pv.pid)   (never `pkill -f`, it can kill your own shell)
```
Playwright + Chromium are preinstalled: `require('playwright')` works from any dir.

## Get to a populated workspace
Landing page -> click the button whose name matches `/Villa Cortona/` (sample wedding). Tabs are `role="tab"`
(Overview, custom module tabs, Nearby Hotels, Schedule, Budget & Forecast, Guests & Google RSVP, Vendors,
Vendor Checklist, Idea Studio). Architecture view is the footer link "How PlanGenie Works".

## State seeding
Workspace lives in localStorage key `plangenie:v2:workspace` (events, tasks, vendors, rsvps, hotelBlocks,
customModules, budgetItems...). Edit it, reload, re-open the sample to force empty / error states
(e.g. give two tasks circular `dependencies` for the schedule error state).

## Gotchas
- `vite preview` has no API server: `/api/*` returns 404 (geocode, hotel search, quote parsing, Ask AI). Expected;
  those code paths show their error/fallback UI. Use `npm run dev` for real API behaviour.
- Tab names collide: use anchored regexes (`/^Schedule \(/`, `/^Vendors \(/`); the header trash button's label starts
  with "Delete" too, so scope delete clicks to `tbody`.
- Dark mode: `document.documentElement.classList.add('dark')`.
- Always check horizontal overflow at 375px: `document.documentElement.scrollWidth - innerWidth` should be <= 0.
  An `sr-only` element inside an `overflow-x-auto` wrapper needs the wrapper to be `relative`.
- With the side panel open the content column is only ~750px wide at 1280px viewport: use `2xl:` for 12-col grids.

## Flows worth driving
Task tick/undo, KPI keyboard navigation, filters + empty states, expense form + two-step delete, add guest
(native validation), hotel block (booked <= blocked), AI regenerate confirm modal (focus trap, Escape,
focus restore), AI settings + security audit dialogs, tab bar arrow/Home/End keys.
