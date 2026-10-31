import { EventRecord, VendorRecord } from '../types/domain';

export interface ChecklistTemplateItem {
  key: string;
  label: string;
  serviceMatch: string[]; // keywords matched against vendor.service_type / name
  leadWeeks: number; // recommended weeks before event to book
  budgetSharePct: number; // typical share of the total budget
  essential: boolean;
}

export interface ChecklistRow extends ChecklistTemplateItem {
  matchedVendor?: VendorRecord;
  state: 'booked' | 'in_progress' | 'open';
  bookByDate: string;
  overdue: boolean;
}

const WEDDING: ChecklistTemplateItem[] = [
  { key: 'venue', label: 'Venue & ceremony space', serviceMatch: ['venue', 'estate', 'hall', 'resort'], leadWeeks: 52, budgetSharePct: 25, essential: true },
  { key: 'catering', label: 'Catering & bar', serviceMatch: ['cater', 'food', 'bar', 'culinary'], leadWeeks: 40, budgetSharePct: 30, essential: true },
  { key: 'photo', label: 'Photographer & videographer', serviceMatch: ['photo', 'video', 'film'], leadWeeks: 40, budgetSharePct: 10, essential: true },
  { key: 'music', label: 'Band / DJ / music', serviceMatch: ['music', 'dj', 'band', 'entertain'], leadWeeks: 32, budgetSharePct: 7, essential: true },
  { key: 'florals', label: 'Florals & decor', serviceMatch: ['floral', 'flower', 'decor', 'design'], leadWeeks: 24, budgetSharePct: 8, essential: false },
  { key: 'officiant', label: 'Officiant / celebrant', serviceMatch: ['officiant', 'celebrant', 'priest', 'pandit'], leadWeeks: 24, budgetSharePct: 1, essential: true },
  { key: 'attire', label: 'Attire & alterations', serviceMatch: ['attire', 'dress', 'tailor', 'suit', 'bridal'], leadWeeks: 28, budgetSharePct: 6, essential: false },
  { key: 'cake', label: 'Cake & desserts', serviceMatch: ['cake', 'dessert', 'bakery', 'pastry'], leadWeeks: 12, budgetSharePct: 2, essential: false },
  { key: 'transport', label: 'Guest transport / shuttles', serviceMatch: ['transport', 'shuttle', 'limo', 'car'], leadWeeks: 12, budgetSharePct: 3, essential: false },
  { key: 'stationery', label: 'Invitations & stationery', serviceMatch: ['invit', 'stationer', 'print'], leadWeeks: 20, budgetSharePct: 2, essential: false },
  { key: 'rentals', label: 'Rentals, lighting & AV', serviceMatch: ['rental', 'light', 'av ', 'audio', 'tent'], leadWeeks: 16, budgetSharePct: 6, essential: false },
];

const BIRTHDAY: ChecklistTemplateItem[] = [
  { key: 'venue', label: 'Venue or space', serviceMatch: ['venue', 'loft', 'penthouse', 'room', 'hall'], leadWeeks: 10, budgetSharePct: 25, essential: true },
  { key: 'catering', label: 'Food & drinks', serviceMatch: ['cater', 'food', 'bar', 'bakery'], leadWeeks: 6, budgetSharePct: 35, essential: true },
  { key: 'cake', label: 'Birthday cake', serviceMatch: ['cake', 'dessert', 'bakery'], leadWeeks: 3, budgetSharePct: 4, essential: true },
  { key: 'music', label: 'DJ / playlist / live act', serviceMatch: ['music', 'dj', 'band', 'entertain'], leadWeeks: 6, budgetSharePct: 10, essential: false },
  { key: 'photo', label: 'Photographer / photo booth', serviceMatch: ['photo', 'booth', 'video'], leadWeeks: 6, budgetSharePct: 8, essential: false },
  { key: 'decor', label: 'Decor, balloons & florals', serviceMatch: ['decor', 'balloon', 'floral', 'flower'], leadWeeks: 4, budgetSharePct: 10, essential: false },
  { key: 'invites', label: 'Invitations & RSVP tracking', serviceMatch: ['invit', 'print', 'stationer'], leadWeeks: 5, budgetSharePct: 2, essential: true },
  { key: 'activities', label: 'Entertainment / activities', serviceMatch: ['activity', 'magic', 'game', 'entertain'], leadWeeks: 5, budgetSharePct: 6, essential: false },
];

const COMMUNITY: ChecklistTemplateItem[] = [
  { key: 'venue', label: 'Venue & permits', serviceMatch: ['venue', 'park', 'center', 'hall', 'permit'], leadWeeks: 20, budgetSharePct: 22, essential: true },
  { key: 'insurance', label: 'Event insurance & liability cover', serviceMatch: ['insur', 'liabil'], leadWeeks: 10, budgetSharePct: 3, essential: true },
  { key: 'catering', label: 'Food vendors / caterer', serviceMatch: ['cater', 'food', 'truck'], leadWeeks: 10, budgetSharePct: 28, essential: true },
  { key: 'av', label: 'Sound, stage & AV', serviceMatch: ['sound', 'stage', 'av ', 'audio', 'light'], leadWeeks: 10, budgetSharePct: 12, essential: true },
  { key: 'security', label: 'Security & first aid', serviceMatch: ['secur', 'medic', 'first aid'], leadWeeks: 8, budgetSharePct: 5, essential: true },
  { key: 'rentals', label: 'Tents, tables, chairs & restrooms', serviceMatch: ['rental', 'tent', 'table', 'chair', 'restroom'], leadWeeks: 8, budgetSharePct: 10, essential: true },
  { key: 'marketing', label: 'Marketing, signage & printing', serviceMatch: ['market', 'sign', 'print', 'design'], leadWeeks: 8, budgetSharePct: 6, essential: false },
  { key: 'entertain', label: 'Performers / speakers', serviceMatch: ['perform', 'speaker', 'music', 'entertain'], leadWeeks: 12, budgetSharePct: 10, essential: false },
  { key: 'volunteers', label: 'Volunteer coordination & sign-ups', serviceMatch: ['volunteer'], leadWeeks: 6, budgetSharePct: 0, essential: false },
];

const MEMORIAL: ChecklistTemplateItem[] = [
  { key: 'venue', label: 'Chapel / service venue', serviceMatch: ['chapel', 'venue', 'church', 'funeral home'], leadWeeks: 1, budgetSharePct: 28, essential: true },
  { key: 'officiant', label: 'Officiant / celebrant', serviceMatch: ['officiant', 'celebrant', 'clergy'], leadWeeks: 1, budgetSharePct: 4, essential: true },
  { key: 'catering', label: 'Reception refreshments', serviceMatch: ['cater', 'food'], leadWeeks: 1, budgetSharePct: 36, essential: true },
  { key: 'florals', label: 'Flowers & tributes', serviceMatch: ['floral', 'flower', 'wreath'], leadWeeks: 1, budgetSharePct: 18, essential: false },
  { key: 'av', label: 'Livestream & AV', serviceMatch: ['av ', 'stream', 'audio', 'video'], leadWeeks: 1, budgetSharePct: 6, essential: false },
  { key: 'print', label: 'Programs & memorial prints', serviceMatch: ['print', 'program'], leadWeeks: 1, budgetSharePct: 3, essential: false },
];

export function getChecklistTemplate(eventType: string): ChecklistTemplateItem[] {
  const t = (eventType || '').toLowerCase();
  if (t.includes('wedding')) return WEDDING;
  if (t.includes('birthday')) return BIRTHDAY;
  if (t.includes('funeral') || t.includes('memorial')) return MEMORIAL;
  return COMMUNITY;
}

function subtractWeeks(eventIso: string, weeks: number): string {
  const d = new Date(`${eventIso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return eventIso;
  d.setUTCDate(d.getUTCDate() - weeks * 7);
  return d.toISOString().slice(0, 10);
}

/**
 * Builds the vendor checklist for an event, auto-linking real vendor records
 * by keyword and honouring manual overrides (checked / unchecked by the user).
 */
export function buildVendorChecklist(
  event: Pick<EventRecord, 'event_type' | 'date'>,
  vendors: VendorRecord[],
  manualDone: Record<string, boolean>,
  today: string
): ChecklistRow[] {
  return getChecklistTemplate(event.event_type).map((tpl) => {
    const matchedVendor = vendors.find((v) => {
      const hay = `${v.service_type} ${v.name}`.toLowerCase();
      return tpl.serviceMatch.some((kw) => hay.includes(kw));
    });
    const manual = manualDone[tpl.key];
    const booked = manual === true || (manual === undefined && matchedVendor?.status === 'booked');
    const inProgress =
      !booked &&
      manual !== false &&
      !!matchedVendor &&
      ['quoted', 'negotiating', 'shortlisted'].includes(matchedVendor.status);
    const bookByDate = subtractWeeks(event.date, tpl.leadWeeks);
    const state: ChecklistRow['state'] = booked ? 'booked' : inProgress ? 'in_progress' : 'open';
    return {
      ...tpl,
      matchedVendor,
      state,
      bookByDate,
      overdue: state !== 'booked' && bookByDate < today,
    };
  });
}
