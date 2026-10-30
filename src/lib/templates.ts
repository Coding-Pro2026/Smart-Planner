import { addDays } from "./engine/dates";

/** Deterministic starter timelines (no LLM). `start`/`due` are days BEFORE event day (T-minus). */
interface Step { key: string; title: string; category: string; start: number; duration: number; deps: string[]; buffer?: number }

export const STARTER_STEPS: Record<"wedding" | "birthday" | "community", Step[]> = {
  wedding: [
    { key: "budget", title: "Set budget & draft guest list", category: "Planning", start: 365, duration: 10, deps: [] },
    { key: "venue", title: "Book venue & sign contract", category: "Venue", start: 355, duration: 30, deps: ["budget"] },
    { key: "photo", title: "Book photographer", category: "Photography", start: 325, duration: 14, deps: ["venue"] },
    { key: "caterer", title: "Book caterer & tasting", category: "Food & Beverage", start: 325, duration: 21, deps: ["venue"] },
    { key: "save", title: "Send save-the-dates", category: "Stationery", start: 300, duration: 7, deps: ["venue"] },
    { key: "attire", title: "Attire & beauty fittings", category: "Attire & Beauty", start: 280, duration: 90, deps: ["budget"] },
    { key: "florals", title: "Order florals & decor", category: "Decor & Flowers", start: 180, duration: 30, deps: ["venue"] },
    { key: "invites", title: "Send invitations", category: "Stationery", start: 120, duration: 14, deps: ["save"] },
    { key: "headcount", title: "Collect RSVPs & final headcount", category: "Guests", start: 35, duration: 14, deps: ["invites"] },
    { key: "seating", title: "Seating chart", category: "Guests", start: 21, duration: 7, deps: ["headcount"] },
    { key: "confirm", title: "Final vendor confirmations", category: "Logistics", start: 14, duration: 7, deps: ["caterer", "florals", "photo", "seating"] },
    { key: "ros", title: "Day-of run-of-show", category: "Logistics", start: 7, duration: 6, deps: ["confirm"] },
  ],
  birthday: [
    { key: "budget", title: "Set budget & guest list", category: "Planning", start: 90, duration: 3, deps: [] },
    { key: "venue", title: "Book venue", category: "Venue", start: 85, duration: 14, deps: ["budget"] },
    { key: "invites", title: "Send invitations", category: "Stationery", start: 60, duration: 7, deps: ["venue"] },
    { key: "food", title: "Order catering & cake", category: "Food & Beverage", start: 45, duration: 14, deps: ["venue"] },
    { key: "fun", title: "Book entertainment / music", category: "Music & Entertainment", start: 45, duration: 14, deps: ["venue"] },
    { key: "decor", title: "Buy & prepare decor", category: "Decor & Flowers", start: 21, duration: 14, deps: ["venue"] },
    { key: "rsvp", title: "Chase RSVPs & final headcount", category: "Guests", start: 14, duration: 7, deps: ["invites"] },
    { key: "confirm", title: "Confirm everything & run-of-show", category: "Logistics", start: 7, duration: 6, deps: ["food", "fun", "decor", "rsvp"] },
  ],
  community: [
    { key: "goals", title: "Define goals, budget & committee", category: "Planning", start: 120, duration: 7, deps: [] },
    { key: "venue", title: "Secure venue", category: "Venue", start: 112, duration: 14, deps: ["goals"] },
    { key: "permits", title: "Apply for permits / licences", category: "Compliance", start: 98, duration: 28, deps: ["venue"] },
    { key: "volunteers", title: "Recruit & brief volunteers", category: "Staffing", start: 90, duration: 30, deps: ["goals"] },
    { key: "marketing", title: "Marketing & promotion", category: "Marketing", start: 75, duration: 45, deps: ["venue"] },
    { key: "vendors", title: "Book vendors & equipment", category: "Equipment & AV", start: 70, duration: 30, deps: ["permits"] },
    { key: "insurance", title: "Arrange event insurance", category: "Insurance", start: 70, duration: 14, deps: ["permits"] },
    { key: "ros", title: "Run-of-show & safety plan", category: "Logistics", start: 21, duration: 14, deps: ["vendors", "volunteers"] },
    { key: "confirm", title: "Final confirmations", category: "Logistics", start: 7, duration: 6, deps: ["ros", "marketing", "insurance"] },
  ],
};

export function starterTasks(type: keyof typeof STARTER_STEPS, eventDate: string) {
  return STARTER_STEPS[type].map((s) => ({
    key: s.key, title: s.title, category: s.category, bufferDays: s.buffer ?? 0, deps: s.deps,
    startDate: addDays(eventDate, -s.start), dueDate: addDays(eventDate, -(s.start - s.duration)),
  }));
}
