import React, { useEffect, useState } from 'react';
import { postJson } from '../lib/api';
import { safeHttpUrl } from '../lib/url';
import { buildIcs, downloadTextFile, safeFilename } from '../lib/exporters';
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  History,
  Image as ImageIcon,
  Loader2,
  LogOut,
  Mail,
  Palette,
  Plus,
  RefreshCw,
  Send,
  Users,
  X,
} from 'lucide-react';
import {
  AuditLogRecord,
  CollaboratorRecord,
  EventRecord,
  GuestRsvpRecord,
  MoodboardPalette,
  RsvpStatus,
} from '../types/domain';
import {
  GoogleCalendarSyncResult,
  getAccessToken,
  googleSignIn,
  initAuth,
  isValidEmailAddress,
  logout,
  sendGoogleCalendarRsvpInvites,
  syncGoogleCalendarRsvpStatuses,
  type User,
} from '../lib/googleCalendarRsvp';

interface ThemeAndRsvpViewProps {
  event: EventRecord;
  moodboard: MoodboardPalette;
  onUpdateMoodboard: (palette: MoodboardPalette) => void;
  rsvps: GuestRsvpRecord[];
  onAddRsvp: (rsvp: Omit<GuestRsvpRecord, 'id' | 'event_id'>) => void;
  onUpdateRsvpStatus: (rsvpId: string, status: RsvpStatus) => void;
  onApplyGoogleCalendarSync?: (syncResult: GoogleCalendarSyncResult) => void;
  collaborators: CollaboratorRecord[];
  auditLogs: AuditLogRecord[];
}

export const ThemeAndRsvpView: React.FC<ThemeAndRsvpViewProps> = ({
  event,
  moodboard,
  onUpdateMoodboard,
  rsvps,
  onAddRsvp,
  onUpdateRsvpStatus,
  onApplyGoogleCalendarSync,
  collaborators,
  auditLogs,
}) => {
  const [visionPrompt, setVisionPrompt] = useState('');
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [moodboardError, setMoodboardError] = useState<string | null>(null);
  const [copiedHex, setCopiedHex] = useState<string | null>(null);

  // Guest RSVP Form State
  const [rsvpFilter, setRsvpFilter] = useState<'ALL' | RsvpStatus>('ALL');
  const [guestName, setGuestName] = useState('');
  const [guestContact, setGuestContact] = useState('');
  const [partySize, setPartySize] = useState('2');
  const [dietary, setDietary] = useState('None');
  const [seatingTable, setSeatingTable] = useState('Table 04 — Conservatory');

  // Google Calendar OAuth & Sync State
  const [needsAuth, setNeedsAuth] = useState(true);
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isConfirmInviteModalOpen, setIsConfirmInviteModalOpen] = useState(false);
  const [isSendingInvites, setIsSendingInvites] = useState(false);
  const [isSyncingCalendar, setIsSyncingCalendar] = useState(false);
  const [calendarFeedback, setCalendarFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setAccessToken(token);
        setNeedsAuth(false);
      },
      () => {
        setGoogleUser(null);
        setAccessToken(null);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setCalendarFeedback(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setGoogleUser(result.user);
        setAccessToken(result.accessToken);
        setNeedsAuth(false);
      }
    } catch (err: any) {
      setCalendarFeedback({
        type: 'error',
        message: err?.message || 'Google sign-in was cancelled or failed.',
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLogout = async () => {
    await logout();
    setGoogleUser(null);
    setAccessToken(null);
    setNeedsAuth(true);
    setCalendarFeedback(null);
  };

  const validEmailGuests = rsvps.filter((r) => isValidEmailAddress(r.contact));

  const handleConfirmAndSendInvites = async () => {
    const token = accessToken || (await getAccessToken());
    if (!token) {
      setNeedsAuth(true);
      setIsConfirmInviteModalOpen(false);
      return;
    }

    setIsSendingInvites(true);
    setCalendarFeedback(null);
    try {
      const syncResult = await sendGoogleCalendarRsvpInvites(token, event, rsvps);
      if (onApplyGoogleCalendarSync) {
        onApplyGoogleCalendarSync(syncResult);
      }
      setIsConfirmInviteModalOpen(false);
      setCalendarFeedback({
        type: 'success',
        message: `Google Calendar event updated and email invitations sent to ${validEmailGuests.length} guest household(s). Guests can click Yes or No in their email to update their RSVP status here.`,
      });
    } catch (err: any) {
      setCalendarFeedback({
        type: 'error',
        message:
          err?.message ||
          'Failed to create or update Google Calendar event. Please sign in again.',
      });
    } finally {
      setIsSendingInvites(false);
    }
  };

  const handleSyncFromGoogleCalendar = async () => {
    const token = accessToken || (await getAccessToken());
    if (!token) {
      setNeedsAuth(true);
      return;
    }
    if (!event.google_calendar_event_id) {
      setCalendarFeedback({
        type: 'error',
        message:
          'Send Google Calendar invitations first so this event is linked to your calendar.',
      });
      return;
    }

    setIsSyncingCalendar(true);
    setCalendarFeedback(null);
    try {
      const syncResult = await syncGoogleCalendarRsvpStatuses(
        token,
        event.google_calendar_event_id
      );
      if (onApplyGoogleCalendarSync) {
        onApplyGoogleCalendarSync(syncResult);
      }
      const attendeeCount = Object.keys(syncResult.attendeeStatuses).length;
      setCalendarFeedback({
        type: 'success',
        message: `Synced latest RSVP responses from Google Calendar for ${attendeeCount} invited guest(s).`,
      });
    } catch (err: any) {
      setCalendarFeedback({
        type: 'error',
        message:
          err?.message || 'Unable to sync RSVP responses from Google Calendar.',
      });
    } finally {
      setIsSyncingCalendar(false);
    }
  };

  const pendingEmails = rsvps
    .filter((r) => r.status === 'pending' && isValidEmailAddress(r.contact))
    .map((r) => r.contact.trim());

  const inviteText = `You're invited to ${event.title}!\n\nWhen: ${event.date}\nWhere: ${event.location}\n\nPlease reply with your attendance (and any dietary needs) so we can plan perfectly. We can't wait to celebrate with you!`;

  const handleMailtoReminder = () => {
    if (pendingEmails.length === 0) return;
    const subject = encodeURIComponent(`Please RSVP: ${event.title}`);
    const body = encodeURIComponent(inviteText);
    // BCC keeps guests' addresses private; keep the URL within common mail-client limits.
    const bcc = encodeURIComponent(pendingEmails.slice(0, 40).join(','));
    window.location.href = `mailto:?bcc=${bcc}&subject=${subject}&body=${body}`;
    setCalendarFeedback({
      type: 'success',
      message:
        pendingEmails.length > 40
          ? `Opened your email app with the first 40 of ${pendingEmails.length} guests — send again for the rest.`
          : `Opened your email app with ${pendingEmails.length} guest(s) in BCC.`,
    });
  };

  const handleCopyInviteText = async () => {
    try {
      await navigator.clipboard.writeText(inviteText);
      setCalendarFeedback({ type: 'success', message: 'Invite message copied to your clipboard.' });
    } catch {
      setCalendarFeedback({ type: 'error', message: 'Clipboard is not available — select and copy the text manually.' });
    }
  };

  const handleDownloadInviteIcs = () => {
    const ok = downloadTextFile(
      safeFilename(`${event.title}-invite`, 'ics'),
      buildIcs({ event, tasks: [], vendors: [], rsvps: [], budget: null, budgetItems: [] }),
      'text/calendar'
    );
    setCalendarFeedback(
      ok
        ? { type: 'success', message: 'Calendar invite downloaded — attach it to your invitations.' }
        : { type: 'error', message: 'Download is not supported in this browser.' }
    );
  };

  const handleCopyHex = (hex: string) => {
    navigator.clipboard?.writeText(hex).catch(() => undefined);
    setCopiedHex(hex);
    setTimeout(() => setCopiedHex(null), 1500);
  };

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMoodboardError('Please choose an image file (JPG, PNG or WebP).');
      return;
    }
    if (file.size > 5_000_000) {
      setMoodboardError('That image is over 5 MB — please choose a smaller one.');
      return;
    }
    setMoodboardError(null);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setUploadedPreviewUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRunMoodboardAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    setMoodboardError(null);
    const res = await postJson<MoodboardPalette>(
      '/api/agents/analyze-moodboard',
      {
        eventId: event.id,
        eventType: event.event_type,
        prompt:
          visionPrompt.trim() ||
          `${event.event_type} at ${event.location} with warm, elegant styling`,
        imageBase64: uploadedPreviewUrl,
        mimeType: uploadedPreviewUrl?.match(/^data:([^;]+);/)?.[1] ?? 'image/jpeg',
      },
      { timeoutMs: 60_000 }
    );
    setIsAnalyzing(false);
    if (res.ok && res.data && Array.isArray(res.data.color_Swatches)) {
      onUpdateMoodboard({ ...res.data, event_id: event.id });
    } else {
      setMoodboardError(res.ok ? 'No palette was returned. Please try again.' : res.error);
    }
  };

  const handleAddRsvpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) return;
    onAddRsvp({
      guest_name: guestName.trim(),
      contact: guestContact.trim() || 'guest@invitation.example',
      party_size: Math.max(1, Number(partySize) || 1),
      status: 'pending',
      dietary_requirements: dietary.trim() || 'None',
      seating_table: seatingTable.trim() || 'General Seating',
    });
    setGuestName('');
    setGuestContact('');
  };

  const filteredRsvps =
    rsvpFilter === 'ALL' ? rsvps : rsvps.filter((r) => r.status === rsvpFilter);

  const confirmedHeadcount = rsvps
    .filter((r) => r.status === 'confirmed')
    .reduce((acc, r) => acc + r.party_size, 0);

  return (
    <div className="space-y-8">
      {/* Section 1: Google Calendar RSVP Invitation & Two-Way Response Sync Bento Card */}
      <div className="bg-white border border-stone-200/80 rounded-3xl p-7 sm:p-8 shadow-sm hover:shadow-md transition-shadow duration-200 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600">
              <Calendar className="w-4 h-4" />
              <span>Google Calendar Events Integration</span>
            </div>
            <h2 className="text-xl font-bold text-stone-900">
              Send Email Invitations &amp; Sync Guest RSVPs
            </h2>
            <p className="text-xs text-stone-500 leading-relaxed">
              Publish <strong className="text-stone-800">{event.title}</strong> ({event.date}) to your Google Calendar and automatically email invitations to your guest list. When guests click{' '}
              <strong className="text-emerald-700">Yes</strong> or{' '}
              <strong className="text-rose-700">No</strong> in their email invitation, click{' '}
              <strong className="text-stone-800">Sync Responses</strong> to update their RSVP status here.
            </p>
          </div>

          {/* Auth & Sync Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {needsAuth || !accessToken ? (
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoggingIn}
                className="gsi-material-button inline-flex items-center gap-3 px-4 py-2.5 bg-white hover:bg-stone-50 text-stone-800 text-xs font-semibold border border-stone-300 rounded-2xl shadow-2xs transition-colors cursor-pointer disabled:opacity-60"
              >
                <div className="w-4 h-4 shrink-0">
                  <svg
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 48 48"
                    style={{ display: 'block', width: '100%', height: '100%' }}
                  >
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                    <path fill="none" d="M0 0h48v48H0z" />
                  </svg>
                </div>
                <span>
                  {isLoggingIn ? 'Signing in...' : 'Sign in with Google'}
                </span>
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsConfirmInviteModalOpen(true)}
                  disabled={isSendingInvites || validEmailGuests.length === 0}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-2xl transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  {event.google_calendar_event_id
                    ? `Update & Resend Invites (${validEmailGuests.length})`
                    : `Send Calendar Invites (${validEmailGuests.length})`}
                </button>

                {event.google_calendar_event_id && (
                  <button
                    type="button"
                    onClick={handleSyncFromGoogleCalendar}
                    disabled={isSyncingCalendar}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-stone-800 bg-stone-100 hover:bg-stone-200 disabled:opacity-50 rounded-2xl transition-colors"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${isSyncingCalendar ? 'animate-spin' : ''}`}
                    />
                    {isSyncingCalendar ? 'Syncing RSVPs...' : 'Sync Responses'}
                  </button>
                )}

                {event.google_calendar_html_link && (
                  <a
                    href={safeHttpUrl(event.google_calendar_html_link) ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 rounded-2xl transition-colors"
                  >
                    Open in Calendar <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}

                <button
                  type="button"
                  onClick={handleGoogleLogout}
                  title={`Signed in as ${googleUser?.email || 'Google User'}`}
                  className="inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium text-stone-500 hover:text-stone-900 rounded-xl transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Connection status bar */}
        <div className="pt-4 border-t border-stone-100 flex flex-wrap items-center justify-between gap-4 text-xs text-stone-500">
          <div className="flex flex-wrap items-center gap-4">
            <span>
              Account:{' '}
              <strong className="text-stone-800">
                {googleUser?.email || 'Not connected'}
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Eligible Email Guests:{' '}
              <strong className="font-mono text-stone-800 tabular-nums">
                {validEmailGuests.length} of {rsvps.length}
              </strong>
            </span>
            {event.google_calendar_last_synced_at && (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  Last Synced:{' '}
                  <strong className="font-mono text-stone-800 tabular-nums">
                    {new Date(event.google_calendar_last_synced_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </strong>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Keyless alternatives: work without any Google/Firebase configuration */}
        <div className="pt-4 border-t border-stone-100 space-y-3">
          <div>
            <h4 className="text-xs font-bold text-stone-900">Invite guests without Google</h4>
            <p className="text-[11px] text-stone-500">
              No account needed — email your guests directly, or share a calendar file they can open in any app.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pendingEmails.length === 0}
              onClick={handleMailtoReminder}
              className="px-3.5 py-2 text-xs font-semibold text-[#4A6B53] bg-[#EDF3EE] hover:bg-[#DFECE1] disabled:opacity-50 rounded-xl"
            >
              Email {pendingEmails.length} guest{pendingEmails.length === 1 ? '' : 's'} awaiting reply
            </button>
            <button
              type="button"
              onClick={handleCopyInviteText}
              className="px-3.5 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl"
            >
              Copy invite message
            </button>
            <button
              type="button"
              onClick={handleDownloadInviteIcs}
              className="px-3.5 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl"
            >
              Download invite (.ics)
            </button>
          </div>
        </div>

        {calendarFeedback && (
          <div
            className={`p-4 rounded-2xl border text-xs flex items-start justify-between gap-3 ${
              calendarFeedback.type === 'success'
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                : 'bg-rose-50/70 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {calendarFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed">{calendarFeedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setCalendarFeedback(null)}
              className="text-stone-400 hover:text-stone-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Section 2: Guest RSVPs & Dietary Seating Matrix */}
      <div className="bg-white border border-stone-200/80 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
        <div className="p-7 sm:p-8 border-b border-stone-100 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" />
              Guest RSVP List &amp; Seating Assignments
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Confirmed Party Headcount:{' '}
              <span className="font-mono font-semibold text-stone-900 tabular-nums">
                {confirmedHeadcount} guests
              </span>{' '}
              across {rsvps.length} households
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-2xl">
            {(['ALL', 'confirmed', 'pending', 'declined'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setRsvpFilter(st)}
                className={`px-3 py-1.5 text-xs font-medium rounded-xl capitalize transition-colors whitespace-nowrap shrink-0 ${
                  rsvpFilter === st
                    ? 'bg-white text-stone-900 shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {st === 'ALL' ? `All (${rsvps.length})` : st}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Add Guest Form (with explicit Email input for Google Calendar RSVP Invites) */}
        <form
          onSubmit={handleAddRsvpSubmit}
          className="px-7 sm:px-8 py-5 bg-stone-50/70 border-b border-stone-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end"
        >
          <div className="lg:col-span-3">
            <label className="block text-[11px] font-medium text-stone-600 mb-1">
              Guest / Household Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g., Jordan & Taylor Reed"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-stone-200/90 rounded-xl"
            />
          </div>
          <div className="lg:col-span-3">
            <label className="block text-[11px] font-medium text-stone-600 mb-1">
              Guest Email (for Google Calendar Invite)
            </label>
            <input
              type="email"
              required
              placeholder="e.g., guest@example.com"
              value={guestContact}
              onChange={(e) => setGuestContact(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-stone-200/90 rounded-xl"
            />
          </div>
          <div className="lg:col-span-1">
            <label className="block text-[11px] font-medium text-stone-600 mb-1">
              Party Size
            </label>
            <input
              type="number"
              min={1}
              max={20}
              value={partySize}
              onChange={(e) => setPartySize(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono bg-white border border-stone-200/90 rounded-xl tabular-nums"
            />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-[11px] font-medium text-stone-600 mb-1">
              Dietary Notes
            </label>
            <input
              type="text"
              value={dietary}
              onChange={(e) => setDietary(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-stone-200/90 rounded-xl"
            />
          </div>
          <div className="lg:col-span-3">
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-xl transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Guest to Invite List
            </button>
          </div>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-stone-100 bg-stone-50/40 text-[11px] font-semibold text-stone-500">
                <th className="py-3.5 px-7">Guest Party &amp; Email</th>
                <th className="py-3.5 px-3 text-right">Party Size</th>
                <th className="py-3.5 px-4">Dietary Notes</th>
                <th className="py-3.5 px-4">Seating Table</th>
                <th className="py-3.5 px-4">Google Calendar Invite</th>
                <th className="py-3.5 px-7 text-right">RSVP Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-xs">
              {filteredRsvps.map((rsvp) => {
                const googleStatus = rsvp.google_response_status;
                return (
                  <tr key={rsvp.id} className="hover:bg-stone-50/60 transition-colors">
                    <td className="py-3.5 px-7">
                      <div className="font-semibold text-stone-900">{rsvp.guest_name}</div>
                      <div className="text-[11px] text-stone-500 flex items-center gap-1.5 mt-0.5">
                        <Mail className="w-3 h-3 text-stone-400" />
                        <span>{rsvp.contact}</span>
                        {rsvp.vip_tag && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-indigo-700 font-medium">{rsvp.vip_tag}</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono tabular-nums font-semibold text-stone-900">
                      {rsvp.party_size}
                    </td>
                    <td className="py-3.5 px-4 text-stone-700">{rsvp.dietary_requirements}</td>
                    <td className="py-3.5 px-4 text-stone-600">{rsvp.seating_table}</td>
                    <td className="py-3.5 px-4">
                      {googleStatus === 'accepted' && (
                        <span className="text-emerald-700 font-medium">
                          Accepted via Calendar Email
                        </span>
                      )}
                      {googleStatus === 'declined' && (
                        <span className="text-rose-700 font-medium">
                          Declined via Calendar Email
                        </span>
                      )}
                      {googleStatus === 'tentative' && (
                        <span className="text-amber-700 font-medium">
                          Maybe (Tentative)
                        </span>
                      )}
                      {googleStatus === 'needsAction' && (
                        <span className="text-indigo-700 font-medium">
                          Email Sent · Awaiting Reply
                        </span>
                      )}
                      {!googleStatus && (
                        <span className="text-stone-400">
                          {isValidEmailAddress(rsvp.contact)
                            ? 'Ready to invite'
                            : 'Needs valid email'}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-7 text-right">
                      <select
                        value={rsvp.status}
                        onChange={(e) =>
                          onUpdateRsvpStatus(rsvp.id, e.target.value as RsvpStatus)
                        }
                        className="px-3 py-1.5 text-xs font-medium border border-stone-200 rounded-xl bg-white capitalize"
                      >
                        <option value="confirmed">Confirmed</option>
                        <option value="pending">Pending</option>
                        <option value="declined">Declined</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 3: Theme & Ideation Agent (Moodboard Vision Studio) in Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left 5 cols: Visual Moodboard Canvas & Vision Upload */}
        <div className="lg:col-span-5 bg-white border border-stone-200/80 rounded-3xl p-7 sm:p-8 flex flex-col justify-between space-y-5 shadow-sm hover:shadow-md transition-shadow duration-200">
          <div>
            <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <Palette className="w-4 h-4 text-indigo-600" />
              Event Moodboard &amp; Vision Studio
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Upload a moodboard image or describe your aesthetic to extract color swatches, decor, and menu pairings
            </p>
          </div>

          <div className="relative rounded-2xl overflow-hidden border border-stone-200 bg-stone-900 aspect-4/3 flex flex-col justify-end p-5">
            {uploadedPreviewUrl ? (
              <img
                src={uploadedPreviewUrl}
                alt="Uploaded event moodboard preview"
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div
                className="absolute inset-0"
                style={{
                  background: `radial-gradient(circle at 20% 20%, ${
                    moodboard.color_Swatches[0]?.hex ?? '#5F6F52'
                  } 0%, ${moodboard.color_Swatches[1]?.hex ?? '#C87D55'} 48%, #1e293b 100%)`,
                }}
              >
                <svg
                  className="w-full h-full opacity-25"
                  viewBox="0 0 400 300"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle cx="200" cy="150" r="110" stroke="white" strokeWidth="1" />
                  <path d="M90 300 C90 180 310 180 310 300" stroke="white" strokeWidth="1.5" />
                  <line x1="0" y1="220" x2="400" y2="220" stroke="white" strokeWidth="0.75" />
                </svg>
              </div>
            )}
            <div className="relative z-10 bg-gradient-to-t from-black/85 via-black/50 to-transparent -m-5 p-5 pt-12 text-white">
              <div className="text-[11px] font-mono text-white/80">
                {moodboard.style_archetype}
              </div>
              <h3 className="text-lg font-semibold mt-0.5">{moodboard.title}</h3>
            </div>
          </div>

          <form onSubmit={handleRunMoodboardAgent} className="space-y-3">
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl cursor-pointer transition-colors whitespace-nowrap shrink-0">
                <ImageIcon className="w-3.5 h-3.5" />
                Upload Image
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileUpload}
                  className="hidden"
                />
              </label>
              <input
                type="text"
                placeholder="Or describe vibe (e.g., Kyoto Autumn Candlelight)..."
                value={visionPrompt}
                onChange={(e) => setVisionPrompt(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-stone-200 rounded-xl"
              />
            </div>
            <button
              type="submit"
              disabled={isAnalyzing}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl transition-colors"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Extracting Palette &amp; Decor...
                </>
              ) : (
                'Generate Palette & Decor Ideas'
              )}
            </button>
            {moodboardError && (
              <p role="alert" className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                {moodboardError}
              </p>
            )}
          </form>
        </div>

        {/* Right 7 cols: Extracted Swatches, Decor, Floral & Culinary Matrix */}
        <div className="lg:col-span-7 bg-white border border-stone-200/80 rounded-3xl p-7 sm:p-8 flex flex-col justify-between space-y-6 shadow-sm hover:shadow-md transition-shadow duration-200">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-stone-900">
                Event Color Palette (Click Hex to Copy)
              </h3>
              <span className="text-xs text-stone-500 font-mono">
                {moodboard.color_Swatches.length} Swatches
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {moodboard.color_Swatches.map((swatch) => (
                <button
                  key={swatch.hex}
                  type="button"
                  onClick={() => handleCopyHex(swatch.hex)}
                  className="text-left group border border-stone-200/80 rounded-2xl overflow-hidden hover:border-stone-400 transition-colors"
                >
                  <div
                    className="h-14 w-full"
                    style={{ backgroundColor: swatch.hex }}
                  />
                  <div className="p-2.5 space-y-0.5 bg-white">
                    <div className="flex items-center justify-between font-mono text-xs font-semibold text-stone-900">
                      <span>{swatch.hex}</span>
                      {copiedHex === swatch.hex ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Copy className="w-3 h-3 text-stone-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                    <div className="text-xs font-medium text-stone-800 truncate">
                      {swatch.name}
                    </div>
                    <div className="text-[11px] text-stone-500 truncate">
                      {swatch.usage}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-5 border-t border-stone-100 text-xs">
            <div className="space-y-2">
              <h4 className="font-semibold text-stone-900">Scenography &amp; Decor</h4>
              <ul className="space-y-1.5 text-stone-600">
                {moodboard.decor_elements.map((item, i) => (
                  <li key={i}>· {item}</li>
                ))}
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-stone-900">Botanical &amp; Lighting</h4>
              <p className="text-stone-600">{moodboard.lighting_atmosphere}</p>
              <ul className="space-y-1 text-stone-600 pt-1">
                {moodboard.floral_botanical_notes.map((item, i) => (
                  <li key={i}>· {item}</li>
                ))}
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-stone-900">Culinary &amp; Dietary</h4>
              <ul className="space-y-1.5 text-stone-600">
                {moodboard.culinary_dietary_pairings.map((item, i) => (
                  <li key={i}>· {item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Section 4: Collaborator RBAC & Immutable Audit Log Trail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-5 bg-white border border-stone-200/80 rounded-3xl p-7 sm:p-8 space-y-4 shadow-sm hover:shadow-md transition-shadow duration-200">
          <div>
            <h3 className="text-sm font-bold text-stone-900">
              Event Team &amp; Collaborators
            </h3>
            <p className="text-xs text-stone-500">
              Role-based access permissions for this event
            </p>
          </div>
          <div className="divide-y divide-stone-100 text-xs">
            {collaborators.map((col) => (
              <div key={col.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium text-stone-900">{col.name}</div>
                  <div className="text-stone-500">{col.email}</div>
                </div>
                <span className="font-mono uppercase text-[11px] font-semibold text-stone-700">
                  {col.role}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-7 bg-white border border-stone-200/80 rounded-3xl p-7 sm:p-8 space-y-4 shadow-sm hover:shadow-md transition-shadow duration-200">
          <div>
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-600" />
              Recent Activity Log
            </h3>
            <p className="text-xs text-stone-500">
              Every budget update, schedule shift, and Google Calendar RSVP sync is recorded
            </p>
          </div>
          <div className="divide-y divide-stone-100 text-xs max-h-60 overflow-y-auto">
            {auditLogs.map((log) => (
              <div key={log.id} className="py-2.5 flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium text-stone-900">{log.action}</div>
                  <div className="text-[11px] text-stone-500">
                    <span>{log.actor_name}</span>
                    <span aria-hidden="true"> · </span>
                    <span className="font-mono">{log.module}</span>
                  </div>
                </div>
                <span className="font-mono text-[11px] text-stone-400 whitespace-nowrap shrink-0 tabular-nums">
                  {new Date(log.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MANDATORY USER CONFIRMATION MODAL FOR SENDING GOOGLE CALENDAR INVITES */}
      {isConfirmInviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-3xl max-w-lg w-full p-7 shadow-xl space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-xs font-semibold text-indigo-600">
                  Confirm Google Calendar Action
                </span>
                <h3 className="text-lg font-bold text-stone-900 mt-0.5">
                  {event.google_calendar_event_id
                    ? 'Update Calendar Event & Resend RSVP Invitations?'
                    : 'Create Google Calendar Event & Email RSVP Invitations?'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsConfirmInviteModalOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-xl"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-stone-600 leading-relaxed">
              <p>
                This will {event.google_calendar_event_id ? 'update' : 'create'}{' '}
                <strong className="text-stone-900">{event.title}</strong> on{' '}
                <strong className="font-mono text-stone-900">{event.date}</strong> at{' '}
                <strong className="text-stone-900">{event.location}</strong> in your primary Google Calendar and send email invitations to{' '}
                <strong className="font-mono text-stone-900">
                  {validEmailGuests.length} guest household(s)
                </strong>
                :
              </p>

              <div className="max-h-40 overflow-y-auto divide-y divide-stone-100 border-t border-b border-stone-100 py-1">
                {validEmailGuests.map((g) => (
                  <div
                    key={g.id}
                    className="py-2 flex items-center justify-between gap-3"
                  >
                    <span className="font-medium text-stone-800 truncate">
                      {g.guest_name} (Party of {g.party_size})
                    </span>
                    <span className="font-mono text-[11px] text-stone-500 shrink-0">
                      {g.contact}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmInviteModalOpen(false)}
                disabled={isSendingInvites}
                className="px-4 py-2.5 text-xs font-semibold text-stone-600 hover:text-stone-900 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAndSendInvites}
                disabled={isSendingInvites}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-2xl transition-colors"
              >
                {isSendingInvites ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Sending Invites...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Confirm &amp; Send Calendar Invites
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
