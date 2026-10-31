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

export const SCOPES: string[] = [];

export const initAuth = (
  _onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  if (onAuthFailure) onAuthFailure();
  return () => {};
};

export const googleSignIn = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  throw new Error(
    'Firebase and Google Calendar API integrations are disabled.'
  );
};

export const getAccessToken = async (): Promise<string | null> => {
  return null;
};

export const logout = async () => {
  // No-op when Firebase Auth is disabled
};

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
