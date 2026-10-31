/** Minimal user shape (Firebase Auth is not bundled; Google sign-in is optional). */
export interface User {
  email?: string | null;
  displayName?: string | null;
  uid?: string;
}
import {
  EventRecord,
  GoogleAttendeeResponseStatus,
  GuestRsvpRecord,
  RsvpStatus,
} from '../types/domain';

/**
 * Google Calendar access WITHOUT any developer credentials of ours.
 *
 * Two keyless-for-us paths:
 *  1. Template link / .ics / mailto (no Google API at all) — see buildGoogleCalendarTemplateUrl().
 *  2. Two-way sync using the USER'S OWN OAuth Client ID (created free in their own Google Cloud project),
 *     via Google Identity Services' browser token flow. The token lives only in memory; nothing is
 *     stored server-side, and PlanGenie never sees the user's Google credentials.
 */
export const SCOPES: string[] = ['https://www.googleapis.com/auth/calendar.events'];

const CLIENT_ID_KEY = 'plangenie:v2:google-client-id';
const GIS_SRC = 'https://accounts.google.com/gsi/client';

export function getGoogleClientId(): string {
  try {
    return window.localStorage.getItem(CLIENT_ID_KEY)?.trim() ?? '';
  } catch {
    return '';
  }
}

export function isValidGoogleClientId(v: string): boolean {
  return /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/i.test(v.trim());
}

export function setGoogleClientId(v: string): void {
  try {
    if (isValidGoogleClientId(v)) window.localStorage.setItem(CLIENT_ID_KEY, v.trim());
    else window.localStorage.removeItem(CLIENT_ID_KEY);
  } catch {
    /* ignore */
  }
}

interface GisTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}
interface GisTokenClient {
  requestAccessToken: (opts?: { prompt?: string }) => void;
}
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string;
            scope: string;
            callback: (r: GisTokenResponse) => void;
            error_callback?: (e: { type?: string; message?: string }) => void;
          }) => GisTokenClient;
          revoke: (token: string, done?: () => void) => void;
        };
      };
    };
  }
}

let memoryToken: { value: string; expiresAt: number } | null = null;
let gisLoading: Promise<void> | null = null;

function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  gisLoading ??= new Promise<void>((resolve, reject) => {
    const el = document.createElement('script');
    el.src = GIS_SRC;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => {
      gisLoading = null;
      reject(new Error('Could not load Google sign-in (blocked by network or an ad blocker).'));
    };
    document.head.appendChild(el);
  });
  return gisLoading;
}

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  if (memoryToken && memoryToken.expiresAt > Date.now()) {
    onAuthSuccess?.({ email: null, displayName: 'Google Calendar' }, memoryToken.value);
  } else {
    onAuthFailure?.();
  }
  return () => {};
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  const clientId = getGoogleClientId();
  if (!clientId) {
    throw new Error('Add your own Google OAuth Client ID first (see the setup steps), or use the no-account options below.');
  }
  await loadGis();
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) throw new Error('Google sign-in is unavailable.');
  return new Promise((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES.join(' '),
      callback: (r) => {
        if (r.error || !r.access_token) {
          reject(new Error(r.error_description || r.error || 'Google sign-in was cancelled.'));
          return;
        }
        memoryToken = { value: r.access_token, expiresAt: Date.now() + (Number(r.expires_in) || 3600) * 1000 - 30_000 };
        resolve({ user: { email: null, displayName: 'Google Calendar' }, accessToken: r.access_token });
      },
      error_callback: (e) => reject(new Error(e?.message || 'Google sign-in was cancelled or blocked (allow pop-ups).')),
    });
    client.requestAccessToken({ prompt: '' });
  });
};

export const getAccessToken = async (): Promise<string | null> => {
  return memoryToken && memoryToken.expiresAt > Date.now() ? memoryToken.value : null;
};

export const logout = async () => {
  const t = memoryToken?.value;
  memoryToken = null;
  if (t) window.google?.accounts?.oauth2?.revoke(t);
};

/**
 * "Add to Google Calendar" link: opens Google's own event editor pre-filled, with guests added.
 * Needs no API, no key and no sign-in from us. The user clicks Save in Google Calendar, which
 * then emails the invitations. (RSVP answers are tracked in Google Calendar; update statuses here.)
 */
export function buildGoogleCalendarTemplateUrl(
  event: Pick<EventRecord, 'title' | 'date' | 'location' | 'event_days' | 'event_type'>,
  guestEmails: string[] = []
): { url: string; includedGuests: number; truncated: boolean } {
  const ymd = (iso: string) => iso.replace(/-/g, '');
  const start = new Date(`${event.date}T00:00:00Z`);
  const days = Math.max(1, event.event_days ?? 1);
  const end = Number.isNaN(start.getTime()) ? start : new Date(start.getTime() + days * 86_400_000);
  const endIso = Number.isNaN(end.getTime()) ? event.date : end.toISOString().slice(0, 10);
  const base = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${ymd(event.date)}/${ymd(endIso)}`,
    location: event.location,
    details: `You're invited to ${event.title}. Please reply Yes/No to this invitation so we can plan perfectly.`,
  });
  const MAX = 1800; // stay under common URL length limits
  const emails: string[] = [];
  for (const e of guestEmails.map((x) => x.trim()).filter(isValidEmailAddress)) {
    const candidate = [...emails, e].join(',');
    if (`https://calendar.google.com/calendar/render?${base.toString()}&add=${encodeURIComponent(candidate)}`.length > MAX) break;
    emails.push(e);
  }
  if (emails.length) base.set('add', emails.join(','));
  const valid = guestEmails.filter(isValidEmailAddress).length;
  return {
    url: `https://calendar.google.com/calendar/render?${base.toString()}`,
    includedGuests: emails.length,
    truncated: emails.length < valid,
  };
}

export function isValidEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function mapGoogleResponseToRsvpStatus(
  responseStatus?: GoogleAttendeeResponseStatus
): RsvpStatus {
  if (responseStatus === 'accepted') return 'confirmed';
  if (responseStatus === 'declined') return 'declined';
  return 'pending';
}

export function mapRsvpStatusToGoogleResponse(
  status: RsvpStatus
): GoogleAttendeeResponseStatus {
  if (status === 'confirmed') return 'accepted';
  if (status === 'declined') return 'declined';
  return 'needsAction';
}

export interface GoogleCalendarSyncResult {
  googleEventId: string;
  htmlLink: string;
  syncedAt: string;
  attendeeStatuses: Record<
    string,
    {
      email: string;
      responseStatus: GoogleAttendeeResponseStatus;
      mappedStatus: RsvpStatus;
    }
  >;
}

/**
 * Creates or updates a Google Calendar Event on the user's primary calendar
 * with `sendUpdates=all` so Google Calendar dispatches official email invitations
 * with Accept / Decline RSVP buttons to all guest email addresses.
 */
export async function sendGoogleCalendarRsvpInvites(
  accessToken: string,
  event: EventRecord,
  rsvps: GuestRsvpRecord[]
): Promise<GoogleCalendarSyncResult> {
  const validGuestAttendees = rsvps
    .filter((r) => isValidEmailAddress(r.contact))
    .map((r) => ({
      email: r.contact.trim().toLowerCase(),
      displayName: `${r.guest_name} (Party of ${r.party_size})`,
      comment: `Table: ${r.seating_table} | Dietary: ${r.dietary_requirements}`,
      responseStatus:
        r.google_response_status ?? mapRsvpStatusToGoogleResponse(r.status),
    }));

  // Build next-day end date for all-day event in YYYY-MM-DD format
  const startDateObj = new Date(`${event.date}T00:00:00`);
  const endDateObj = new Date(startDateObj.getTime() + 86400 * 1000);
  const endDateStr = Number.isNaN(endDateObj.getTime())
    ? event.date
    : endDateObj.toISOString().slice(0, 10);

  const eventPayload = {
    summary: event.title,
    location: event.location,
    description: [
      `You are invited to ${event.title} (${event.event_type.toUpperCase()}).`,
      `Location: ${event.location}`,
      `Date: ${event.date}`,
      '',
      'Please click Yes (Accept) or No (Decline) in this Google Calendar email invitation so your RSVP status automatically updates in PlanGenie.',
    ].join('\n'),
    start: {
      date: event.date,
    },
    end: {
      date: endDateStr,
    },
    attendees: validGuestAttendees,
    guestsCanInviteOthers: false,
    guestsCanSeeOtherGuests: true,
  };

  const hasExistingEvent = Boolean(event.google_calendar_event_id);
  const endpoint = hasExistingEvent
    ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(
        event.google_calendar_event_id!
      )}?sendUpdates=all`
    : 'https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all';

  let response = await fetch(endpoint, {
    method: hasExistingEvent ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(eventPayload),
  });

  // If the previously linked event was deleted in Google Calendar, create a fresh one
  if (hasExistingEvent && response.status === 404) {
    response = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventPayload),
      }
    );
  }

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const errMsg =
      errBody?.error?.message ||
      `Google Calendar API returned status ${response.status}`;
    throw new Error(errMsg);
  }

  const data = await response.json();
  return parseCalendarEventResponse(data);
}

/**
 * Fetches the latest attendee RSVP statuses (`accepted`, `declined`, `tentative`, `needsAction`)
 * from the linked Google Calendar Event and maps them to PlanGenie RSVP records.
 */
export async function syncGoogleCalendarRsvpStatuses(
  accessToken: string,
  googleEventId: string
): Promise<GoogleCalendarSyncResult> {
  const endpoint = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(
    googleEventId
  )}`;

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const errMsg =
      errBody?.error?.message ||
      `Failed to fetch Google Calendar event (${response.status})`;
    throw new Error(errMsg);
  }

  const data = await response.json();
  return parseCalendarEventResponse(data);
}

function parseCalendarEventResponse(data: any): GoogleCalendarSyncResult {
  const attendeeStatuses: GoogleCalendarSyncResult['attendeeStatuses'] = {};
  const rawAttendees: any[] = Array.isArray(data?.attendees) ? data.attendees : [];

  for (const att of rawAttendees) {
    if (typeof att?.email === 'string') {
      const normalizedEmail = att.email.trim().toLowerCase();
      const responseStatus: GoogleAttendeeResponseStatus =
        att.responseStatus === 'accepted' ||
        att.responseStatus === 'declined' ||
        att.responseStatus === 'tentative'
          ? att.responseStatus
          : 'needsAction';
      attendeeStatuses[normalizedEmail] = {
        email: normalizedEmail,
        responseStatus,
        mappedStatus: mapGoogleResponseToRsvpStatus(responseStatus),
      };
    }
  }

  return {
    googleEventId: String(data.id || ''),
    htmlLink: String(data.htmlLink || 'https://calendar.google.com'),
    syncedAt: new Date().toISOString(),
    attendeeStatuses,
  };
}
