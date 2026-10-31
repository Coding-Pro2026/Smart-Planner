import { addDaysIso, diffDays, isValidIsoDate, todayIso } from './dates';

/**
 * Offline natural-language intake parser. Pulls the structured fields of an
 * event out of a free-text description. Shared by the server (baseline before
 * / instead of Gemini) and the browser (when the server is unreachable).
 */

export interface IntakeDraft {
  id?: string;
  title?: string;
  event_type?: string;
  location?: string;
  event_days?: number;
  guest_count?: number;
  target_budget?: number;
  date?: string;
}

export interface ParsedIntake {
  id: string;
  title: string;
  event_type: string;
  location: string;
  event_days: number;
  guest_count: number;
  target_budget: number;
  date: string;
  /** Which fields were actually found in the text (vs defaulted). */
  detected: Partial<Record<'type' | 'location' | 'days' | 'guests' | 'budget' | 'date', boolean>>;
}

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

const pad = (n: number) => String(n).padStart(2, '0');

function monthIndex(token: string): number {
  const t = token.toLowerCase().replace(/\./g, '');
  return MONTHS.findIndex((m) => m === t || (t.length >= 3 && m.startsWith(t)));
}

function buildIso(y: number, m: number, d: number): string | null {
  const iso = `${y}-${pad(m + 1)}-${pad(d)}`;
  return isValidIsoDate(iso) ? iso : null;
}

/** Extracts a date from free text. Month/day without a year picks the next occurrence. */
export function extractDate(text: string, today: string = todayIso()): string | null {
  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso && isValidIsoDate(iso[0])) return iso[0];

  const nowYear = Number(today.slice(0, 4));
  const monthRe = MONTHS.map((m) => m.slice(0, 3)).join('|');
  // "March 20, 2027" / "Mar 20th"
  let m = text.match(new RegExp(`\\b(${monthRe})[a-z]*\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(20\\d{2}))?\\b`, 'i'));
  let mon: number, day: number, year: number | null;
  if (m) {
    mon = monthIndex(m[1]);
    day = Number(m[2]);
    year = m[3] ? Number(m[3]) : null;
  } else {
    // "20 March 2027" / "20th of March"
    m = text.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${monthRe})[a-z]*\\.?(?:,?\\s+(20\\d{2}))?\\b`, 'i'));
    if (m) {
      day = Number(m[1]);
      mon = monthIndex(m[2]);
      year = m[3] ? Number(m[3]) : null;
    } else {
      // Relative: "in 3 months", "in 6 weeks", "next month"
      const rel = text.match(/\bin\s+(\d{1,3})\s*(day|week|month|year)s?\b/i);
      if (rel) {
        const n = Number(rel[1]);
        const unit = rel[2].toLowerCase();
        const days = unit === 'day' ? n : unit === 'week' ? n * 7 : unit === 'month' ? n * 30 : n * 365;
        return addDaysIso(today, days);
      }
      if (/\bnext\s+month\b/i.test(text)) return addDaysIso(today, 30);
      if (/\bnext\s+week\b/i.test(text)) return addDaysIso(today, 7);
      if (/\bnext\s+year\b/i.test(text)) return addDaysIso(today, 365);
      return null;
    }
  }
  if (mon < 0) return null;
  if (year !== null) return buildIso(year, mon, day);
  let candidate = buildIso(nowYear, mon, day);
  if (candidate && diffDays(today, candidate) < 0) candidate = buildIso(nowYear + 1, mon, day);
  return candidate;
}

export function detectEventType(lower: string, fallback = 'wedding'): { type: string; found: boolean } {
  if (/\b(funeral|memorial|celebration of life|eulogy|bereavement|wake)\b/.test(lower)) return { type: 'funeral', found: true };
  if (/\b(wedding|shaadi|sangeet|nikah|bridal|engagement|reception)\b/.test(lower)) return { type: 'wedding', found: true };
  if (/\b(birthday|bday|anniversary|baby shower|bar mitzvah|bat mitzvah|quincea)/.test(lower)) return { type: 'birthday', found: true };
  if (/\b(community|gala|fundrais|festival|fair|summit|conference|corporate|meetup|charity|block party|neighbo)/.test(lower)) return { type: 'community', found: true };
  return { type: fallback, found: false };
}

const KNOWN_PLACES: [RegExp, string][] = [
  [/udaipur/, 'Udaipur, Rajasthan, India'],
  [/jaipur/, 'Jaipur, Rajasthan, India'],
  [/mumbai/, 'Mumbai, Maharashtra, India'],
  [/delhi/, 'New Delhi, India'],
  [/\bgoa\b/, 'Goa, India'],
  [/boston/, 'Boston, MA, USA'],
  [/chicago/, 'Chicago, IL, USA'],
  [/new york|nyc/, 'New York, NY, USA'],
  [/sonoma|napa/, 'Sonoma & Napa Valley, CA, USA'],
  [/austin/, 'Austin, TX, USA'],
  [/london/, 'London, UK'],
  [/paris/, 'Paris, France'],
  [/dubai/, 'Dubai, UAE'],
];

export function parseIntake(
  message: string,
  current: IntakeDraft = {},
  today: string = todayIso()
): ParsedIntake {
  const text = String(message ?? '').replace(/\s+/g, ' ').trim();
  const lower = text.toLowerCase();
  const detected: ParsedIntake['detected'] = {};

  const typeRes = detectEventType(lower, current.event_type || 'wedding');
  const type = typeRes.type;
  detected.type = typeRes.found;

  // Location
  let location = current.location || '';
  const locMatch = text.match(
    /\b(?:in|at|near)\s+([A-Z][A-Za-z.'-]*(?:[\s,]+[A-Z][A-Za-z.'-]*){0,4})/
  );
  const known = KNOWN_PLACES.find(([re]) => re.test(lower));
  if (known) {
    location = known[1];
    detected.location = true;
  } else if (locMatch?.[1] && !/^(January|February|March|April|May|June|July|August|September|October|November|December)\b/.test(locMatch[1])) {
    location = locMatch[1].replace(/[\s,]+$/, '');
    detected.location = true;
  }
  if (!location) location = type === 'funeral' ? 'Local memorial chapel' : 'Venue to be decided';

  // Days
  let days = Number(current.event_days) || 0;
  const daysMatch = text.match(/(\d{1,2})\s*[- ]?\s*day/i);
  if (daysMatch) {
    days = Math.max(1, Math.min(14, Number(daysMatch[1])));
    detected.days = true;
  } else if (!days) {
    const indian = /india|indian|sangeet|shaadi/.test(lower) || /india/i.test(location);
    days = type === 'wedding' ? (indian ? 5 : 2) : 1;
  }

  // Guests
  let guests = Number(current.guest_count) || 0;
  const guestMatch = text.match(/(\d[\d,]{0,5})\s*(?:\+\s*)?(?:guests?|people|attendees|persons|pax|invitees)/i);
  if (guestMatch) {
    guests = Math.max(1, Math.min(50_000, Number(guestMatch[1].replace(/,/g, ''))));
    detected.guests = true;
  } else if (!guests) {
    guests = type === 'funeral' ? 80 : type === 'wedding' ? 120 : type === 'birthday' ? 40 : 150;
  }

  // Budget
  let budget = Number(current.target_budget) || 0;
  const kMatch = text.match(/\$\s*(\d+(?:\.\d+)?)\s*k\b/i) || text.match(/\b(\d+(?:\.\d+)?)\s*k\s*(?:budget|usd|dollars)/i);
  const fullMatch = text.match(/\$\s*([\d,]{3,12})(?:\.\d+)?/) || text.match(/\b([\d,]{4,12})\s*(?:usd|dollars)\b/i);
  const budgetWord = text.match(/budget\s*(?:of|is|:)?\s*\$?\s*([\d,]{3,12})/i);
  if (kMatch) {
    budget = Math.round(Number(kMatch[1]) * 1000);
    detected.budget = true;
  } else if (budgetWord) {
    budget = Number(budgetWord[1].replace(/,/g, ''));
    detected.budget = true;
  } else if (fullMatch) {
    budget = Number(fullMatch[1].replace(/,/g, ''));
    detected.budget = true;
  } else if (!budget) {
    budget =
      type === 'funeral' ? 12000 : type === 'wedding' ? (days >= 4 ? 85000 : 45000) : type === 'birthday' ? 8000 : 20000;
  }
  budget = Math.max(500, Math.min(1e9, Math.round(budget)));

  // Date
  const parsedDate = extractDate(text, today);
  let date = parsedDate ?? (isValidIsoDate(current.date) ? current.date! : '');
  if (parsedDate) detected.date = true;
  if (!date) date = addDaysIso(today, type === 'funeral' ? 14 : type === 'wedding' ? 180 : type === 'birthday' ? 45 : 75);

  // Title
  let title = current.title || '';
  const place = location.split(',')[0].trim();
  if (!title || detected.type) {
    title =
      type === 'funeral'
        ? `Memorial & Celebration of Life (${place})`
        : type === 'wedding'
          ? days >= 4
            ? `${days}-Day Destination Wedding (${place})`
            : `${days}-Day Wedding Celebration (${place})`
          : type === 'birthday'
            ? `Birthday Celebration (${place})`
            : `Community Event (${place})`;
  }

  return {
    id: current.id || `evt_ai_${Date.now()}`,
    title,
    event_type: type,
    location,
    event_days: days,
    guest_count: guests,
    target_budget: budget,
    date,
    detected,
  };
}
