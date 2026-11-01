import React, { useEffect, useRef, useState } from 'react';
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
  buildGoogleCalendarTemplateUrl,
  getAccessToken,
  getGoogleClientId,
  googleSignIn,
  isValidGoogleClientId,
  setGoogleClientId,
  initAuth,
  isValidEmailAddress,
  logout,
  sendGoogleCalendarRsvpInvites,
  syncGoogleCalendarRsvpStatuses,
  type User,
} from '../lib/googleCalendarRsvp';
import { Badge, Button, Card, CardHeader, EmptyState, Field, HEX_RE, Modal, Notice, PageHeader, cx, focusRing, inputCls } from './ui/kit';

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

  // Google Calendar OAuth & Sync State (uses the USER'S OWN OAuth client; none of ours)
  const [clientId, setClientId] = useState<string>(() => getGoogleClientId());
  const [showSetup, setShowSetup] = useState(false);
  const [clientDraft, setClientDraft] = useState('');
  const [setupError, setSetupError] = useState<string | null>(null);
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

  const handleAddToGoogleCalendar = () => {
    const { url, includedGuests, truncated } = buildGoogleCalendarTemplateUrl(
      event,
      rsvps.map((r) => r.contact)
    );
    window.open(url, '_blank', 'noopener,noreferrer');
    setCalendarFeedback({
      type: 'success',
      message: `Opened Google Calendar with the event${includedGuests ? ` and ${includedGuests} guest(s)` : ''} pre-filled — click Save there to send the invitations.${truncated ? ' (Too many guests for one link: add the rest in Google Calendar, or use the .ics file.)' : ''}`,
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

  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);
  const handleCopyHex = (hex: string) => {
    navigator.clipboard?.writeText(hex).catch(() => undefined);
    setCopiedHex(hex);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopiedHex(null), 1500);
  };

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMoodboardError('Please choose an image file (JPG, PNG or WebP).');
      return;
    }
    if (file.size > 3_500_000) {
      setMoodboardError('That image is over 3.5 MB — please choose a smaller one.');
      return;
    }
    setMoodboardError(null);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setUploadedPreviewUrl(reader.result);
      }
    };
    reader.onerror = () => setMoodboardError('That image could not be read. Please try another file.');
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
      contact: guestContact.trim(), // never invent an address: invites are only sent to valid, user-entered emails
      party_size: Math.min(20, Math.max(1, Math.round(Number(partySize)) || 1)),
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

  const filters = ['ALL', 'confirmed', 'pending', 'declined'] as const;
  const googleBadge = (status: string | undefined, contact: string) => {
    if (status === 'accepted') return <Badge tone="good">Accepted</Badge>;
    if (status === 'declined') return <Badge tone="bad">Declined</Badge>;
    if (status === 'tentative') return <Badge tone="warn">Maybe</Badge>;
    if (status === 'needsAction') return <Badge>Invited · awaiting reply</Badge>;
    return <span className="text-sm text-stone-600">{isValidEmailAddress(contact) ? 'Ready to invite' : 'Needs valid email'}</span>;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Calendar className="h-4 w-4" />}
        eyebrow="Guests & RSVPs"
        title="Invite guests and track RSVPs"
        description={
          <>
            Put <strong className="font-medium text-stone-900">{event.title}</strong> ({event.date}) on Google Calendar and invite your guests. No account linking is needed. Optionally connect your own free Google Cloud OAuth client for two-way sync.
          </>
        }
        stat={{ value: confirmedHeadcount, label: `confirmed guests · ${rsvps.length} households` }}
        actions={
          needsAuth || !accessToken ? (
            !clientId ? (
              <Button aria-expanded={showSetup} onClick={() => setShowSetup((v) => !v)}>
                Enable two-way sync (optional)
              </Button>
            ) : (
              <Button onClick={handleGoogleLogin} disabled={isLoggingIn} aria-busy={isLoggingIn}>
                <svg aria-hidden="true" viewBox="0 0 48 48" className="h-4 w-4 shrink-0">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
                {isLoggingIn ? 'Signing in…' : 'Sign in with Google'}
              </Button>
            )
          ) : (
            <>
              <Button variant="primary" onClick={() => setIsConfirmInviteModalOpen(true)} disabled={isSendingInvites || validEmailGuests.length === 0}>
                <Send aria-hidden="true" className="h-4 w-4" />
                {event.google_calendar_event_id ? `Update & resend invites (${validEmailGuests.length})` : `Send calendar invites (${validEmailGuests.length})`}
              </Button>
              {event.google_calendar_event_id && (
                <Button onClick={handleSyncFromGoogleCalendar} disabled={isSyncingCalendar} aria-busy={isSyncingCalendar}>
                  <RefreshCw aria-hidden="true" className={cx('h-4 w-4', isSyncingCalendar && 'animate-spin motion-reduce:animate-none')} />
                  {isSyncingCalendar ? 'Syncing…' : 'Sync responses'}
                </Button>
              )}
              {event.google_calendar_html_link && (
                <a
                  href={safeHttpUrl(event.google_calendar_html_link) ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cx('inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-[#3B5943] hover:bg-[#EEF4EF] dark:text-emerald-300', focusRing)}
                >
                  Open in Calendar <ExternalLink aria-hidden="true" className="h-4 w-4" />
                </a>
              )}
              <Button variant="ghost" onClick={handleGoogleLogout} title={`Signed in as ${googleUser?.email || 'Google user'}`}>
                <LogOut aria-hidden="true" className="h-4 w-4" /> Sign out
              </Button>
            </>
          )
        }
      >
        <dl className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-stone-100 pt-4 text-sm text-stone-600">
          <div>
            <dt className="inline">Account: </dt>
            <dd className="inline font-medium text-stone-900">{googleUser?.email || 'Not connected'}</dd>
          </div>
          <div>
            <dt className="inline">Eligible email guests: </dt>
            <dd className="inline font-mono font-medium tabular-nums text-stone-900">{validEmailGuests.length} of {rsvps.length}</dd>
          </div>
          {event.google_calendar_last_synced_at && (
            <div>
              <dt className="inline">Last synced: </dt>
              <dd className="inline font-mono font-medium tabular-nums text-stone-900">
                {new Date(event.google_calendar_last_synced_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </dd>
            </div>
          )}
        </dl>

        {showSetup && !clientId && (
          <div className="mt-4 space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-5 text-sm leading-5 text-stone-600">
            <h4 className="font-semibold text-stone-900">Enable two-way sync with your own Google OAuth client (free, ~3 min)</h4>
            <ol className="list-decimal space-y-1 pl-5">
              <li>In <a className="font-medium text-[#3B5943] underline dark:text-emerald-300" href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noopener noreferrer">Google Cloud Console</a>, create a project and enable the <strong>Google Calendar API</strong>.</li>
              <li>Under <strong>Google Auth platform → Clients</strong>, create an <strong>OAuth client ID</strong> of type <strong>Web application</strong>.</li>
              <li>Add <code className="font-mono">{typeof window !== 'undefined' ? window.location.origin : ''}</code> as an <strong>Authorized JavaScript origin</strong>.</li>
              <li>Keep the app in “Testing”, add your own Google account as a test user, and paste the Client ID below.</li>
            </ol>
            <div className="flex flex-wrap gap-2">
              <input
                aria-label="Google OAuth Client ID"
                value={clientDraft}
                onChange={(e) => setClientDraft(e.target.value)}
                placeholder="1234567890-abc123.apps.googleusercontent.com"
                className={cx(inputCls, 'min-w-[240px] flex-1 font-mono text-xs')}
              />
              <Button
                variant="primary"
                onClick={() => {
                  if (!isValidGoogleClientId(clientDraft)) {
                    setSetupError('That does not look like a Google OAuth Client ID (…apps.googleusercontent.com).');
                    return;
                  }
                  setGoogleClientId(clientDraft);
                  setClientId(clientDraft.trim());
                  setClientDraft('');
                  setSetupError(null);
                  setShowSetup(false);
                }}
              >
                Save Client ID
              </Button>
            </div>
            {setupError && <p role="alert" className="font-medium text-rose-700 dark:text-rose-300">{setupError}</p>}
            <p className="text-xs leading-4">A Client ID is not a secret. Sign-in happens directly between your browser and Google; PlanGenie only asks for permission to manage events on your calendar and keeps the token in memory.</p>
          </div>
        )}
        {clientId && (
          <p className="mt-4 text-sm text-stone-600">
            Using your Google OAuth client.{' '}
            <button type="button" className={cx('rounded font-medium underline hover:text-stone-900', focusRing)} onClick={() => { setGoogleClientId(''); setClientId(''); setNeedsAuth(true); }}>
              Remove
            </button>
          </p>
        )}
      </PageHeader>

      <Card aria-labelledby="rsvp-nogoogle" className="space-y-4 p-6">
        <CardHeader id="rsvp-nogoogle" eyebrow="No Google account needed" title="Invite guests your way" />
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={handleAddToGoogleCalendar}>Add to Google Calendar</Button>
          <Button disabled={pendingEmails.length === 0} onClick={handleMailtoReminder}>
            Email {pendingEmails.length} guest{pendingEmails.length === 1 ? '' : 's'} awaiting reply
          </Button>
          <Button onClick={handleCopyInviteText}>Copy invite message</Button>
          <Button onClick={handleDownloadInviteIcs}>Download invite (.ics)</Button>
        </div>
        {calendarFeedback && (
          <Notice kind={calendarFeedback.type} onDismiss={() => setCalendarFeedback(null)}>
            {calendarFeedback.message}
          </Notice>
        )}
      </Card>

      <Card aria-labelledby="rsvp-list" className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-100 p-6">
          <div>
            <h3 id="rsvp-list" className="flex items-center gap-2 text-base font-semibold leading-6 text-stone-900">
              <Users aria-hidden="true" className="h-4 w-4" /> Guest list & seating
            </h3>
            <p className="text-sm text-stone-600">
              <span className="font-mono font-medium tabular-nums text-stone-900">{confirmedHeadcount}</span> confirmed across {rsvps.length} households
            </p>
          </div>
          <div role="group" aria-label="Filter guests by RSVP status" className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-stone-100 p-1">
            {filters.map((st) => (
              <button
                key={st}
                type="button"
                aria-pressed={rsvpFilter === st}
                onClick={() => setRsvpFilter(st)}
                className={cx(
                  'h-8 shrink-0 whitespace-nowrap rounded-lg px-3 text-sm font-medium capitalize transition-[background-color,box-shadow,color] motion-reduce:transition-none',
                  rsvpFilter === st ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-700 hover:text-stone-900',
                  focusRing
                )}
              >
                {st === 'ALL' ? `All (${rsvps.length})` : st}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleAddRsvpSubmit} className="grid grid-cols-1 items-end gap-4 border-b border-stone-100 bg-stone-50 p-6 sm:grid-cols-2 2xl:grid-cols-12">
          <Field label="Guest / household" className="2xl:col-span-3">
            <input type="text" required maxLength={80} placeholder="e.g. Jordan & Taylor Reed" value={guestName} onChange={(e) => setGuestName(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Email (for calendar invite)" className="2xl:col-span-3">
            <input type="email" required maxLength={120} placeholder="guest@example.com" value={guestContact} onChange={(e) => setGuestContact(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Party size" className="2xl:col-span-2">
            <input type="number" min={1} max={20} value={partySize} onChange={(e) => setPartySize(e.target.value)} className={cx(inputCls, 'font-mono tabular-nums')} />
          </Field>
          <Field label="Dietary notes" className="2xl:col-span-2">
            <input type="text" maxLength={120} value={dietary} onChange={(e) => setDietary(e.target.value)} className={inputCls} />
          </Field>
          <div className="2xl:col-span-2">
            <Button type="submit" variant="primary" className="w-full">
              <Plus aria-hidden="true" className="h-4 w-4" /> Add guest
            </Button>
          </div>
        </form>

        {filteredRsvps.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<Users className="h-5 w-5" />}
              title={rsvps.length === 0 ? 'No guests yet' : 'No guests match this filter'}
              body={rsvps.length === 0 ? 'Add your first household above to start tracking RSVPs and dietary needs.' : 'Try a different status to see the rest of your list.'}
              action={rsvps.length > 0 ? <Button onClick={() => setRsvpFilter('ALL')}>Show all guests</Button> : undefined}
            />
          </div>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">Guest RSVP list</caption>
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50 text-xs font-medium uppercase tracking-[0.06em] text-stone-600">
                  <th scope="col" className="px-6 py-3">Guest & email</th>
                  <th scope="col" className="px-3 py-3 text-right">Party</th>
                  <th scope="col" className="px-4 py-3">Dietary</th>
                  <th scope="col" className="px-4 py-3">Table</th>
                  <th scope="col" className="px-4 py-3">Calendar invite</th>
                  <th scope="col" className="px-6 py-3 text-right">RSVP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-sm">
                {filteredRsvps.map((rsvp) => (
                  <tr key={rsvp.id} className="transition-colors hover:bg-stone-50 motion-reduce:transition-none">
                    <td className="px-6 py-3.5">
                      <div className="font-semibold text-stone-900">{rsvp.guest_name}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-stone-600">
                        <Mail aria-hidden="true" className="h-3 w-3" />
                        <span>{rsvp.contact || 'No email'}</span>
                        {rsvp.vip_tag && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-medium text-[#8C6226] dark:text-amber-300">{rsvp.vip_tag}</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3.5 text-right font-mono font-semibold tabular-nums text-stone-900">{rsvp.party_size}</td>
                    <td className="px-4 py-3.5 text-stone-700">{rsvp.dietary_requirements}</td>
                    <td className="px-4 py-3.5 text-stone-600">{rsvp.seating_table}</td>
                    <td className="px-4 py-3.5">{googleBadge(rsvp.google_response_status, rsvp.contact)}</td>
                    <td className="px-6 py-3.5 text-right">
                      <select
                        aria-label={`RSVP status for ${rsvp.guest_name}`}
                        value={rsvp.status}
                        onChange={(e) => onUpdateRsvpStatus(rsvp.id, e.target.value as RsvpStatus)}
                        className={cx(inputCls, '!h-8 !w-auto capitalize')}
                      >
                        <option value="confirmed">Confirmed</option>
                        <option value="pending">Pending</option>
                        <option value="declined">Declined</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 items-stretch gap-6 2xl:grid-cols-12">
        <Card aria-labelledby="mood-studio" className="flex flex-col justify-between gap-5 p-6 2xl:col-span-5">
          <CardHeader id="mood-studio" eyebrow="Moodboard" title="Vision studio" />
          <p className="-mt-3 text-sm leading-5 text-stone-600">Upload an image or describe your aesthetic to extract colours, decor and menu pairings.</p>

          <div className="relative flex aspect-[4/3] flex-col justify-end overflow-hidden rounded-xl border border-stone-200 bg-stone-900 p-5">
            {uploadedPreviewUrl ? (
              <img src={uploadedPreviewUrl} alt="Uploaded event moodboard preview" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div
                aria-hidden="true"
                className="absolute inset-0"
                style={{
                  background: `radial-gradient(circle at 20% 20%, ${HEX_RE.test(moodboard.color_Swatches[0]?.hex ?? '') ? moodboard.color_Swatches[0].hex : '#5F6F52'} 0%, ${HEX_RE.test(moodboard.color_Swatches[1]?.hex ?? '') ? moodboard.color_Swatches[1].hex : '#C87D55'} 48%, #1e293b 100%)`,
                }}
              />
            )}
            <div className="relative z-10 -m-5 bg-gradient-to-t from-black/85 via-black/50 to-transparent p-5 pt-12 text-white">
              <p className="font-mono text-xs text-white/85">{moodboard.style_archetype}</p>
              <h4 className="mt-0.5 text-lg font-semibold leading-6">{moodboard.title}</h4>
            </div>
          </div>

          <form onSubmit={handleRunMoodboardAgent} className="space-y-3" aria-busy={isAnalyzing}>
            <div className="flex items-center gap-2">
              <label className={cx('inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 text-sm font-medium text-stone-900 transition-colors hover:border-stone-400 hover:bg-stone-50 focus-within:ring-2 focus-within:ring-[#4A6B53] focus-within:ring-offset-2')}>
                <ImageIcon aria-hidden="true" className="h-4 w-4" />
                Upload image
                <input type="file" accept="image/*" onChange={handleImageFileUpload} className="sr-only" />
              </label>
              <input type="text" maxLength={200} aria-label="Describe the vibe" placeholder="Or describe the vibe, e.g. Kyoto autumn candlelight" value={visionPrompt} onChange={(e) => setVisionPrompt(e.target.value)} className={inputCls} />
            </div>
            <Button type="submit" variant="primary" disabled={isAnalyzing} className="w-full">
              {isAnalyzing ? (
                <>
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" /> Extracting palette & decor…
                </>
              ) : (
                'Generate palette & decor ideas'
              )}
            </Button>
            {moodboardError && <Notice kind="error">{moodboardError}</Notice>}
          </form>
        </Card>

        <Card aria-labelledby="mood-palette" className="flex flex-col justify-between gap-6 p-6 2xl:col-span-7">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 id="mood-palette" className="flex items-center gap-2 text-base font-semibold leading-6 text-stone-900">
                <Palette aria-hidden="true" className="h-4 w-4" /> Colour palette
              </h3>
              <span className="text-sm text-stone-600">Select a swatch to copy its hex</span>
            </div>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              {moodboard.color_Swatches.map((swatch, i) => (
                <li key={`${swatch.hex}-${i}`}>
                  <button
                    type="button"
                    onClick={() => handleCopyHex(swatch.hex)}
                    aria-label={`Copy ${swatch.name} ${swatch.hex}`}
                    className={cx('group w-full overflow-hidden rounded-xl border border-stone-200 text-left transition-[border-color,box-shadow] hover:border-stone-400 hover:shadow-md motion-reduce:transition-none', focusRing)}
                  >
                    <span aria-hidden="true" className="block h-14 w-full" style={{ backgroundColor: HEX_RE.test(swatch.hex) ? swatch.hex : 'transparent' }} />
                    <span className="block space-y-0.5 bg-white p-2.5">
                      <span className="flex items-center justify-between font-mono text-xs font-semibold text-stone-900">
                        {swatch.hex}
                        {copiedHex === swatch.hex ? <Check aria-hidden="true" className="h-3.5 w-3.5 text-[#3B5943] dark:text-emerald-300" /> : <Copy aria-hidden="true" className="h-3.5 w-3.5 text-stone-500 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />}
                      </span>
                      <span className="block truncate text-xs font-medium text-stone-800">{swatch.name}</span>
                      <span className="block truncate text-xs text-stone-600">{swatch.usage}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p role="status" className="sr-only">{copiedHex ? `Copied ${copiedHex}` : ''}</p>
          </div>

          <div className="grid grid-cols-1 gap-5 border-t border-stone-100 pt-5 text-sm leading-5 2xl:grid-cols-3">
            <div className="space-y-2">
              <h4 className="font-semibold text-stone-900">Scenography & decor</h4>
              <ul className="list-disc space-y-1.5 pl-4 text-stone-600">{moodboard.decor_elements.map((item, i) => <li key={i}>{item}</li>)}</ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-stone-900">Botanical & lighting</h4>
              <p className="text-stone-600">{moodboard.lighting_atmosphere}</p>
              <ul className="list-disc space-y-1 pl-4 text-stone-600">{moodboard.floral_botanical_notes.map((item, i) => <li key={i}>{item}</li>)}</ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-stone-900">Culinary & dietary</h4>
              <ul className="list-disc space-y-1.5 pl-4 text-stone-600">{moodboard.culinary_dietary_pairings.map((item, i) => <li key={i}>{item}</li>)}</ul>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-6 2xl:grid-cols-12">
        <Card aria-labelledby="team" className="space-y-4 p-6 2xl:col-span-5">
          <CardHeader id="team" eyebrow="Access" title="Event team & collaborators" />
          {collaborators.length === 0 ? (
            <EmptyState icon={<Users className="h-5 w-5" />} title="Just you for now" body="Collaborators added to this event will appear here with their roles." />
          ) : (
            <ul className="divide-y divide-stone-100 text-sm">
              {collaborators.map((col) => (
                <li key={col.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-stone-900">{col.name}</p>
                    <p className="truncate text-stone-600">{col.email}</p>
                  </div>
                  <Badge>{col.role}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card aria-labelledby="activity" className="space-y-4 p-6 2xl:col-span-7">
          <CardHeader id="activity" eyebrow="History" title="Recent activity" />
          {auditLogs.length === 0 ? (
            <EmptyState icon={<History className="h-5 w-5" />} title="No activity yet" body="Budget updates, schedule shifts and RSVP syncs are recorded here." />
          ) : (
            <ul className="max-h-60 divide-y divide-stone-100 overflow-y-auto text-sm" tabIndex={0} aria-label="Activity log">
              {auditLogs.map((log) => (
                <li key={log.id} className="flex items-start justify-between gap-4 py-2.5">
                  <div className="min-w-0">
                    <p className="font-medium text-stone-900">{log.action}</p>
                    <p className="text-xs text-stone-600">
                      {log.actor_name} <span aria-hidden="true">·</span> <span className="font-mono">{log.module}</span>
                    </p>
                  </div>
                  <time dateTime={log.timestamp} className="shrink-0 whitespace-nowrap font-mono text-xs tabular-nums text-stone-600">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Modal
        open={isConfirmInviteModalOpen}
        onClose={() => setIsConfirmInviteModalOpen(false)}
        locked={isSendingInvites}
        eyebrow="Confirm Google Calendar action"
        title={event.google_calendar_event_id ? 'Update calendar event & resend RSVP invitations?' : 'Create calendar event & email RSVP invitations?'}
        footer={
          <>
            <Button data-autofocus onClick={() => setIsConfirmInviteModalOpen(false)} disabled={isSendingInvites}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleConfirmAndSendInvites} disabled={isSendingInvites} aria-busy={isSendingInvites}>
              {isSendingInvites ? (
                <>
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" /> Sending invites…
                </>
              ) : (
                <>
                  <Send aria-hidden="true" className="h-4 w-4" /> Confirm & send invites
                </>
              )}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p>
            This will {event.google_calendar_event_id ? 'update' : 'create'} <strong className="text-stone-900">{event.title}</strong> on{' '}
            <strong className="font-mono text-stone-900">{event.date}</strong> at <strong className="text-stone-900">{event.location}</strong> in your primary Google Calendar and email invitations to{' '}
            <strong className="font-mono text-stone-900">{validEmailGuests.length} household(s)</strong>:
          </p>
          <ul className="max-h-40 divide-y divide-stone-100 overflow-y-auto border-y border-stone-100 py-1">
            {validEmailGuests.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-3 py-2">
                <span className="truncate font-medium text-stone-800">{g.guest_name} (party of {g.party_size})</span>
                <span className="shrink-0 font-mono text-xs text-stone-600">{g.contact}</span>
              </li>
            ))}
          </ul>
        </div>
      </Modal>
    </div>
  );
};
