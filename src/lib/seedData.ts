import {
  AgentChatMessage,
  AuditLogRecord,
  BudgetItemRecord,
  CollaboratorRecord,
  CustomEventModule,
  EventRecord,
  GuestRsvpRecord,
  HotelRoomBlockRecord,
  MoodboardPalette,
  TaskRecord,
  UserRecord,
  VendorRecord,
} from '../types/domain';
import { computeCriticalPath } from './deterministicEngine';

export const SEED_USERS: UserRecord[] = [
  {
    id: 'usr_primary_01',
    email: 'claire.vance@plangenie.example',
    name: 'Claire Vance',
    roleTitle: 'Lead Event Architect',
    auth_provider: 'workspace_sso',
    created_at: '2026-09-15T09:00:00Z',
  },
  {
    id: 'usr_tenant_02',
    email: 'marcus.sterling@otherorg.example',
    name: 'Marcus Sterling',
    roleTitle: 'External Organizer',
    auth_provider: 'session',
    created_at: '2026-10-01T14:20:00Z',
  },
];

export const SEED_EVENTS: EventRecord[] = [
  {
    id: 'evt_wedding_01',
    owner_id: 'usr_primary_01',
    title: 'Aurelia & Julian — Villa Cortona Vineyard Wedding',
    event_type: 'wedding',
    date: '2027-05-15',
    kickoff_date: '2026-11-01',
    location: 'Napa Valley, CA — Cortona Estate Conservatory',
    guest_count: 140,
    target_budget: 68000,
    currency: 'USD',
  },
  {
    id: 'evt_birthday_02',
    owner_id: 'usr_primary_01',
    title: 'Elena Rostova — 40th Architectural Loft Soirée',
    event_type: 'birthday',
    date: '2026-12-18',
    kickoff_date: '2026-10-25',
    location: 'SoHo Mercer Penthouse, New York',
    guest_count: 65,
    target_budget: 18500,
    currency: 'USD',
  },
  {
    id: 'evt_community_03',
    owner_id: 'usr_primary_01',
    title: 'Oakridge Civic Botanical & Heritage Gala',
    event_type: 'community',
    date: '2027-03-20',
    kickoff_date: '2026-11-10',
    location: 'Oakridge Glass Conservatory & Civic Plaza',
    guest_count: 420,
    target_budget: 45000,
    currency: 'USD',
  },
  // Isolated foreign tenant record for RLS security testing
  {
    id: 'evt_isolated_tenant_99',
    owner_id: 'usr_tenant_02',
    title: 'Confidential Executive Summit (Tenant B)',
    event_type: 'community',
    date: '2027-06-01',
    kickoff_date: '2026-11-01',
    location: 'Geneva Private Pavilion',
    guest_count: 80,
    target_budget: 120000,
    currency: 'USD',
  },
];

export const SEED_COLLABORATORS: CollaboratorRecord[] = [
  {
    id: 'col_1',
    event_id: 'evt_wedding_01',
    user_id: 'usr_primary_01',
    name: 'Claire Vance',
    email: 'claire.vance@plangenie.example',
    role: 'owner',
  },
  {
    id: 'col_2',
    event_id: 'evt_wedding_01',
    user_id: 'usr_collab_02',
    name: 'Julian Vance-Mercer',
    email: 'julian@mercerstudio.example',
    role: 'editor',
  },
  {
    id: 'col_3',
    event_id: 'evt_wedding_01',
    user_id: 'usr_collab_03',
    name: 'Sienna Botanicals (Lead Florist)',
    email: 'contracts@siennabotanicals.example',
    role: 'vendor',
  },
  {
    id: 'col_4',
    event_id: 'evt_birthday_02',
    user_id: 'usr_primary_01',
    name: 'Claire Vance',
    email: 'claire.vance@plangenie.example',
    role: 'owner',
  },
  {
    id: 'col_5',
    event_id: 'evt_community_03',
    user_id: 'usr_primary_01',
    name: 'Claire Vance',
    email: 'claire.vance@plangenie.example',
    role: 'owner',
  },
];

export const SEED_BUDGET_ITEMS: BudgetItemRecord[] = [
  // Wedding Budget Items
  {
    id: 'b_wed_1',
    event_id: 'evt_wedding_01',
    category: 'Venue & Conservatory',
    name: 'Cortona Estate Exclusive Grounds & Rain Pavilion Buyout',
    unit_cost: 16500,
    quantity: 1,
    tax_pct: 8.5,
    contingency_pct: 5,
    estimated_cost: 18727.5,
    actual_cost: 18500,
    is_per_guest: false,
    status: 'contracted',
    vendor_id: 'vnd_wed_1',
    notes: 'Includes 12-hour estate access, bridal suite, and backup glasshouse.',
  },
  {
    id: 'b_wed_2',
    event_id: 'evt_wedding_01',
    category: 'Catering & Sommelier',
    name: 'Four-Course Farm-to-Table Plated Dinner & Estate Wine Pairing',
    unit_cost: 145,
    quantity: 140,
    tax_pct: 8.5,
    contingency_pct: 8,
    estimated_cost: 23649.5,
    actual_cost: 22900,
    is_per_guest: true,
    status: 'quoted',
    vendor_id: 'vnd_wed_2',
    notes: 'Scales dynamically with guest count simulator.',
  },
  {
    id: 'b_wed_3',
    event_id: 'evt_wedding_01',
    category: 'Floral & Tablescape',
    name: 'Olive Branch Hanging Installations, Linen & Beeswax Taper Styling',
    unit_cost: 6800,
    quantity: 1,
    tax_pct: 8.5,
    contingency_pct: 5,
    estimated_cost: 7718,
    actual_cost: 7450,
    is_per_guest: false,
    status: 'quoted',
    vendor_id: 'vnd_wed_3',
    notes: 'Matches Tuscan Terracotta & Sage palette.',
  },
  {
    id: 'b_wed_4',
    event_id: 'evt_wedding_01',
    category: 'Photography & Cinema',
    name: 'Documentary 35mm Film & Digital Dual-Shooter Package',
    unit_cost: 5400,
    quantity: 1,
    tax_pct: 0,
    contingency_pct: 4,
    estimated_cost: 5616,
    actual_cost: 5400,
    is_per_guest: false,
    status: 'contracted',
    notes: 'Includes engagement session and archival prints.',
  },
  {
    id: 'b_wed_5',
    event_id: 'evt_wedding_01',
    category: 'Music & Acoustics',
    name: 'Ceremony String Quartet & Reception Jazz Quintet + Sound Rig',
    unit_cost: 4200,
    quantity: 1,
    tax_pct: 6,
    contingency_pct: 5,
    estimated_cost: 4662,
    actual_cost: 4500,
    is_per_guest: false,
    status: 'planned',
    notes: 'Requires 2 dedicated 20A circuits near pergola.',
  },
  {
    id: 'b_wed_6',
    event_id: 'evt_wedding_01',
    category: 'Guest Hospitality',
    name: 'Luxury Shuttle Coaches & Welcome Artisan Gift Boxes',
    unit_cost: 28,
    quantity: 140,
    tax_pct: 8.5,
    contingency_pct: 5,
    estimated_cost: 4449.2,
    actual_cost: 4100,
    is_per_guest: true,
    status: 'planned',
    notes: 'Round-trip transport from downtown Napa hotels.',
  },

  // Birthday Budget Items
  {
    id: 'b_bday_1',
    event_id: 'evt_birthday_02',
    category: 'Venue & Production',
    name: 'Mercer Architectural Loft Evening Buyout & Architectural Lighting',
    unit_cost: 5200,
    quantity: 1,
    tax_pct: 8.875,
    contingency_pct: 5,
    estimated_cost: 5921.5,
    actual_cost: 5800,
    is_per_guest: false,
    status: 'contracted',
    vendor_id: 'vnd_bday_1',
  },
  {
    id: 'b_bday_2',
    event_id: 'evt_birthday_02',
    category: 'Culinary & Mixology',
    name: 'Omakase Canapé Stations & Bespoke Botanical Cocktail Bar',
    unit_cost: 115,
    quantity: 65,
    tax_pct: 8.875,
    contingency_pct: 6,
    estimated_cost: 8586.78,
    actual_cost: 8200,
    is_per_guest: true,
    status: 'quoted',
    vendor_id: 'vnd_bday_2',
  },
  {
    id: 'b_bday_3',
    event_id: 'evt_birthday_02',
    category: 'Floral & Scenography',
    name: 'Sculptural Ikebana Plinths & Travertine Table Styling',
    unit_cost: 2400,
    quantity: 1,
    tax_pct: 8.875,
    contingency_pct: 5,
    estimated_cost: 2733,
    actual_cost: 2650,
    is_per_guest: false,
    status: 'planned',
  },

  // Community Gala Budget Items
  {
    id: 'b_com_1',
    event_id: 'evt_community_03',
    category: 'Venue & Civic Permits',
    name: 'Conservatory Courtyard Permit, Stage Decking & ADA Ramps',
    unit_cost: 9500,
    quantity: 1,
    tax_pct: 0,
    contingency_pct: 8,
    estimated_cost: 10260,
    actual_cost: 9800,
    is_per_guest: false,
    status: 'contracted',
    vendor_id: 'vnd_com_1',
  },
  {
    id: 'b_com_2',
    event_id: 'evt_community_03',
    category: 'Catering & Zero-Waste',
    name: 'Harvest Communal Banquet & Compostable Tableware Program',
    unit_cost: 48,
    quantity: 420,
    tax_pct: 7.5,
    contingency_pct: 6,
    estimated_cost: 22881.6,
    actual_cost: 21500,
    is_per_guest: true,
    status: 'quoted',
    vendor_id: 'vnd_com_2',
  },
  {
    id: 'b_com_3',
    event_id: 'evt_community_03',
    category: 'AV & Acoustic Stage',
    name: 'Line-Array PA System, Stage Wash Lighting & Livestream Rig',
    unit_cost: 6800,
    quantity: 1,
    tax_pct: 7.5,
    contingency_pct: 5,
    estimated_cost: 7650,
    actual_cost: 7400,
    is_per_guest: false,
    status: 'quoted',
  },
];

const RAW_SEED_TASKS: TaskRecord[] = [
  // Wedding DAG Tasks
  {
    id: 'tsk_wed_1',
    event_id: 'evt_wedding_01',
    title: 'Venue Contract Signing & Estate Deposit',
    category: 'Venue & Legal',
    milestone_code: 'T-180',
    start_day_offset: 0,
    duration_days: 7,
    buffer_days: 2,
    start_date: '2026-11-01',
    due_date: '2026-11-10',
    status: 'completed',
    assigned_to: 'Claire Vance',
    dependencies: [],
    is_critical_path: true,
  },
  {
    id: 'tsk_wed_2',
    event_id: 'evt_wedding_01',
    title: 'Architectural Floorplan & Rain Plan Engineering',
    category: 'Logistics',
    milestone_code: 'T-150',
    start_day_offset: 9,
    duration_days: 12,
    buffer_days: 2,
    start_date: '2026-11-10',
    due_date: '2026-11-24',
    status: 'completed',
    assigned_to: 'Claire Vance',
    dependencies: ['tsk_wed_1'],
    is_critical_path: true,
  },
  {
    id: 'tsk_wed_3',
    event_id: 'evt_wedding_01',
    title: 'Caterer Tasting & Sommelier Pairing Lock',
    category: 'Culinary',
    milestone_code: 'T-120',
    start_day_offset: 10,
    duration_days: 10,
    buffer_days: 1,
    start_date: '2026-11-11',
    due_date: '2026-11-22',
    status: 'in_progress',
    assigned_to: 'Julian Vance-Mercer',
    dependencies: ['tsk_wed_1'],
    is_critical_path: false,
  },
  {
    id: 'tsk_wed_4',
    event_id: 'evt_wedding_01',
    title: 'Floral Rigging & Suspended Olive Canopy Approval',
    category: 'Decor & Design',
    milestone_code: 'T-90',
    start_day_offset: 23,
    duration_days: 14,
    buffer_days: 2,
    start_date: '2026-11-24',
    due_date: '2026-12-10',
    status: 'in_progress',
    assigned_to: 'Sienna Botanicals',
    dependencies: ['tsk_wed_2'],
    is_critical_path: true,
  },
  {
    id: 'tsk_wed_5',
    event_id: 'evt_wedding_01',
    title: 'Guest RSVP Final Headcount & Dietary Matrix Freeze',
    category: 'Guest Relations',
    milestone_code: 'T-45',
    start_day_offset: 39,
    duration_days: 10,
    buffer_days: 2,
    start_date: '2026-12-10',
    due_date: '2026-12-22',
    status: 'todo',
    assigned_to: 'Julian Vance-Mercer',
    dependencies: ['tsk_wed_3', 'tsk_wed_4'],
    is_critical_path: true,
  },
  {
    id: 'tsk_wed_6',
    event_id: 'evt_wedding_01',
    title: 'Seating Chart & Escort Card Calligraphy Production',
    category: 'Stationery & Seating',
    milestone_code: 'T-21',
    start_day_offset: 51,
    duration_days: 8,
    buffer_days: 1,
    start_date: '2026-12-22',
    due_date: '2026-12-31',
    status: 'todo',
    assigned_to: 'Claire Vance',
    dependencies: ['tsk_wed_5'],
    is_critical_path: true,
  },
  {
    id: 'tsk_wed_7',
    event_id: 'evt_wedding_01',
    title: 'Day-Of Run-of-Show & Vendor Load-In Dispatch',
    category: 'Operations',
    milestone_code: 'T-0',
    start_day_offset: 60,
    duration_days: 3,
    buffer_days: 0,
    start_date: '2026-12-31',
    due_date: '2027-01-03',
    status: 'todo',
    assigned_to: 'Claire Vance',
    dependencies: ['tsk_wed_6'],
    is_critical_path: true,
  },

  // Birthday DAG Tasks
  {
    id: 'tsk_bday_1',
    event_id: 'evt_birthday_02',
    title: 'Loft Venue Agreement & Freight Elevator Reservation',
    category: 'Venue',
    milestone_code: 'T-45',
    start_day_offset: 0,
    duration_days: 5,
    buffer_days: 1,
    start_date: '2026-10-25',
    due_date: '2026-10-31',
    status: 'completed',
    assigned_to: 'Claire Vance',
    dependencies: [],
    is_critical_path: true,
  },
  {
    id: 'tsk_bday_2',
    event_id: 'evt_birthday_02',
    title: 'Omakase Menu & Bespoke Cocktail Recipe Lock',
    category: 'Culinary',
    milestone_code: 'T-30',
    start_day_offset: 6,
    duration_days: 8,
    buffer_days: 1,
    start_date: '2026-10-31',
    due_date: '2026-11-09',
    status: 'in_progress',
    assigned_to: 'Claire Vance',
    dependencies: ['tsk_bday_1'],
    is_critical_path: true,
  },
  {
    id: 'tsk_bday_3',
    event_id: 'evt_birthday_02',
    title: 'Ikebana Plinth Fabrication & Acoustic Vinyl DJ Setup',
    category: 'Scenography',
    milestone_code: 'T-14',
    start_day_offset: 15,
    duration_days: 7,
    buffer_days: 1,
    start_date: '2026-11-09',
    due_date: '2026-11-17',
    status: 'todo',
    assigned_to: 'Claire Vance',
    dependencies: ['tsk_bday_2'],
    is_critical_path: true,
  },

  // Community Gala DAG Tasks
  {
    id: 'tsk_com_1',
    event_id: 'evt_community_03',
    title: 'Municipal Park Permit & Fire Marshal Egress Approval',
    category: 'Permits & Safety',
    milestone_code: 'T-120',
    start_day_offset: 0,
    duration_days: 14,
    buffer_days: 3,
    start_date: '2026-11-10',
    due_date: '2026-11-27',
    status: 'completed',
    assigned_to: 'Claire Vance',
    dependencies: [],
    is_critical_path: true,
  },
  {
    id: 'tsk_com_2',
    event_id: 'evt_community_03',
    title: 'Sponsor Tier Fulfillment & Community Grant Allocation',
    category: 'Fundraising',
    milestone_code: 'T-90',
    start_day_offset: 5,
    duration_days: 10,
    buffer_days: 2,
    start_date: '2026-11-15',
    due_date: '2026-11-27',
    status: 'in_progress',
    assigned_to: 'Claire Vance',
    dependencies: [],
    is_critical_path: false,
  },
  {
    id: 'tsk_com_3',
    event_id: 'evt_community_03',
    title: 'Stage Truss Rigging & Zero-Waste Catering Logistics',
    category: 'Production',
    milestone_code: 'T-30',
    start_day_offset: 17,
    duration_days: 12,
    buffer_days: 2,
    start_date: '2026-11-27',
    due_date: '2026-12-11',
    status: 'todo',
    assigned_to: 'Claire Vance',
    dependencies: ['tsk_com_1', 'tsk_com_2'],
    is_critical_path: true,
  },
];

export function getInitialTasks(): TaskRecord[] {
  const byEvent = new Map<string, TaskRecord[]>();
  for (const t of RAW_SEED_TASKS) {
    const arr = byEvent.get(t.event_id) ?? [];
    arr.push(t);
    byEvent.set(t.event_id, arr);
  }

  const result: TaskRecord[] = [];
  for (const [eventId, list] of byEvent.entries()) {
    const evt = SEED_EVENTS.find((e) => e.id === eventId);
    const computed = computeCriticalPath(list, evt?.kickoff_date ?? '2026-11-01');
    result.push(...computed.tasks);
  }
  return result;
}

export const SEED_VENDORS: VendorRecord[] = [
  {
    id: 'vnd_wed_1',
    event_id: 'evt_wedding_01',
    name: 'Villa Cortona Estate & Conservatory',
    service_type: 'Venue & Grounds',
    quote_amount: 18500,
    status: 'booked',
    contact_email: 'events@villacortona-napa.example',
    contract_filename: 'Villa_Cortona_2027_Master_Agreement.pdf',
    parsed_terms: {
      base_fee: 15500,
      service_charge_pct: 12,
      gratuity_pct: 0,
      tax_pct: 8.5,
      total_true_cost: 18678.5,
      payment_schedule: [
        '50% Non-refundable retainer upon signing ($9,250)',
        '25% Milestone installment at T-90 days ($4,625)',
        '25% Final balance + security deposit at T-30 days ($4,625)',
      ],
      cancellation_policy:
        '100% forfeiture of retainer if cancelled within 120 days unless force majeure applies.',
      hidden_fees_detected: [
        'Mandatory $650 Historic Grounds Preservation Surcharge',
        'Overtime penalty of $1,200/hr past 11:00 PM curfew',
      ],
      risk_clauses: [
        {
          clause: 'Sound Decibel Cap (82 dB at property line after 9:30 PM)',
          severity: 'medium',
          recommendation: 'Add directional subwoofers inside the glass conservatory.',
        },
        {
          clause: 'External Generator Mandate if catering load exceeds 60 Amps',
          severity: 'high',
          recommendation: 'Verify catering oven draw with Harvest Table Culinary before T-60.',
        },
      ],
      line_items: [
        { description: '12-Hour Exclusive Estate & Vineyard Access', amount: 13500, included: true },
        { description: 'Glass Conservatory Rain Backup Reservation', amount: 2000, included: true },
        { description: 'Historic Grounds Preservation Surcharge', amount: 650, included: false },
      ],
    },
  },
  {
    id: 'vnd_wed_2',
    event_id: 'evt_wedding_01',
    name: 'Harvest Table Culinary & Sommelier Collective',
    service_type: 'Catering & Beverage',
    quote_amount: 22900,
    status: 'quoted',
    contact_email: 'proposals@harvesttablecollective.example',
    contract_filename: 'HarvestTable_140Guests_Quote_v2.pdf',
    parsed_terms: {
      base_fee: 17800,
      service_charge_pct: 22,
      gratuity_pct: 5,
      tax_pct: 8.5,
      total_true_cost: 24119,
      payment_schedule: [
        '30% Deposit upon contract execution',
        '70% Final headcount lock due at T-21 days',
      ],
      cancellation_policy: '50% refund available up to T-60 days; non-refundable within 30 days.',
      hidden_fees_detected: [
        '22% Mandatory Administrative Charge (does not go to waitstaff)',
        '$18/guest Cake Cutting & Corkage Fee if external vintage brought',
      ],
      risk_clauses: [
        {
          clause: 'Ingredient Market Price Escalation Clause (>8% CPI adjustment)',
          severity: 'high',
          recommendation: 'Request a 4% hard cap on seasonal menu price adjustments.',
        },
      ],
      line_items: [
        { description: '4-Course Plated Heritage Menu (140 Guests)', amount: 14000, included: true },
        { description: 'Reserve Napa Sommelier Pairing Flight', amount: 3800, included: true },
        { description: 'External Vintage Corkage & Glassware', amount: 1120, included: false },
      ],
    },
  },
  {
    id: 'vnd_wed_3',
    event_id: 'evt_wedding_01',
    name: 'Solstice Artisanal Kitchens (Competing Caterer)',
    service_type: 'Catering & Beverage',
    quote_amount: 21400,
    status: 'negotiating',
    contact_email: 'concierge@solsticekitchens.example',
    contract_filename: 'Solstice_Artisanal_140pax_Bid.pdf',
    parsed_terms: {
      base_fee: 17200,
      service_charge_pct: 18,
      gratuity_pct: 0,
      tax_pct: 8.5,
      total_true_cost: 21758,
      payment_schedule: [
        '25% Retainer on booking',
        '50% at T-60 days',
        '25% at T-14 days',
      ],
      cancellation_policy: 'Full credit transferrable to new date within 18 months.',
      hidden_fees_detected: [
        'Staff travel stipend ($480 flat fee for Napa Valley zone)',
      ],
      risk_clauses: [
        {
          clause: 'Tableware breakage billed at 2.5x replacement cost',
          severity: 'low',
          recommendation: 'Standard clause; inspect crate inventory at load-out.',
        },
      ],
      line_items: [
        { description: '4-Course Seasonal Tasting Menu (140 Guests)', amount: 13600, included: true },
        { description: 'Sommelier Wine & Botanical Aperitif Package', amount: 3600, included: true },
        { description: 'Zero Corkage Fee Waiver Included', amount: 0, included: true },
      ],
    },
  },
  {
    id: 'vnd_bday_1',
    event_id: 'evt_birthday_02',
    name: 'Mercer Penthouse Studios',
    service_type: 'Venue & Lighting',
    quote_amount: 5800,
    status: 'booked',
    contact_email: 'bookings@mercerpenthouse.example',
    contract_filename: 'Mercer_Loft_Soiree_Contract.pdf',
    parsed_terms: {
      base_fee: 4800,
      service_charge_pct: 10,
      gratuity_pct: 0,
      tax_pct: 8.875,
      total_true_cost: 5705.6,
      payment_schedule: ['50% upon signing', '50% 14 days prior'],
      cancellation_policy: 'Refundable up to 30 days prior less 10% admin fee.',
      hidden_fees_detected: ['Mandatory Freight Elevator Operator after 10 PM ($350)'],
      risk_clauses: [
        {
          clause: 'Open flame prohibition (LED or enclosed hurricane cylinders required)',
          severity: 'medium',
          recommendation: 'Use borosilicate glass sleeves for all taper candles.',
        },
      ],
      line_items: [
        { description: '8-Hour Penthouse & Terrace Buyout', amount: 4800, included: true },
        { description: 'Architectural Dimmable Track Wash', amount: 350, included: true },
      ],
    },
  },
  {
    id: 'vnd_com_1',
    event_id: 'evt_community_03',
    name: 'Civic Stageworks & Acoustic Engineering',
    service_type: 'AV & Stage Rigging',
    quote_amount: 7400,
    status: 'quoted',
    contact_email: 'bids@civicstageworks.example',
    contract_filename: 'Civic_Stageworks_Conservatory_Bid.pdf',
    parsed_terms: {
      base_fee: 6400,
      service_charge_pct: 8,
      gratuity_pct: 0,
      tax_pct: 7.5,
      total_true_cost: 7392,
      payment_schedule: ['40% Net-15 on PO approval', '60% Net-30 post-event'],
      cancellation_policy: 'Weather postponement rescheduled at no penalty with 48h notice.',
      hidden_fees_detected: ['Union Stagehand Double-Time after Midnight'],
      risk_clauses: [
        {
          clause: 'Municipal Wind Load Shutdown (>28 mph gusts for outdoor truss)',
          severity: 'medium',
          recommendation: 'Position main speaker arrays inside conservatory atrium.',
        },
      ],
      line_items: [
        { description: 'Modular Oak Stage Deck & ADA Ramp', amount: 3200, included: true },
        { description: 'Line-Array Acoustic Rig & 4 Wireless Mics', amount: 3200, included: true },
      ],
    },
  },
];

export const SEED_RSVPS: GuestRsvpRecord[] = [
  {
    id: 'rsvp_1',
    event_id: 'evt_wedding_01',
    guest_name: 'Dr. Henrik & Camille Lindqvist',
    contact: 'henrik.lindqvist@nordicbio.example',
    party_size: 2,
    status: 'confirmed',
    dietary_requirements: 'Pescatarian, No Shellfish',
    seating_table: 'Table 01 — Olive Grove',
    vip_tag: 'Family of Bride',
  },
  {
    id: 'rsvp_2',
    event_id: 'evt_wedding_01',
    guest_name: 'Mateo & Sofia Rossi',
    contact: 'm.rossi@milanarch.example',
    party_size: 2,
    status: 'confirmed',
    dietary_requirements: 'Gluten-Free (Celiac Strict)',
    seating_table: 'Table 01 — Olive Grove',
    vip_tag: 'Best Man',
  },
  {
    id: 'rsvp_3',
    event_id: 'evt_wedding_01',
    guest_name: 'Eleanor Vance-Kerr',
    contact: 'eleanor@vancefoundation.example',
    party_size: 1,
    status: 'confirmed',
    dietary_requirements: 'Low Sodium',
    seating_table: 'Table 02 — Cypress Terrace',
    vip_tag: 'Grandmother',
  },
  {
    id: 'rsvp_4',
    event_id: 'evt_wedding_01',
    guest_name: 'Devon & Priya Patel',
    contact: 'priya.patel@vcpartners.example',
    party_size: 2,
    status: 'pending',
    dietary_requirements: 'Vegetarian / Nut-Free',
    seating_table: 'Table 03 — Pergola East',
  },
  {
    id: 'rsvp_5',
    event_id: 'evt_wedding_01',
    guest_name: 'Lucas Thorne',
    contact: 'lucas@thornephoto.example',
    party_size: 1,
    status: 'declined',
    dietary_requirements: 'None',
    seating_table: 'Unassigned',
  },
  {
    id: 'rsvp_6',
    event_id: 'evt_birthday_02',
    guest_name: 'Sora Takahashi',
    contact: 'sora@kengo-atelier.example',
    party_size: 2,
    status: 'confirmed',
    dietary_requirements: 'None',
    seating_table: 'Lounge Booth A',
    vip_tag: 'Keynote Toast',
  },
  {
    id: 'rsvp_7',
    event_id: 'evt_community_03',
    guest_name: 'Mayor Evelyn Reyes & Civic Delegation',
    contact: 'mayor.office@oakridge.example',
    party_size: 6,
    status: 'confirmed',
    dietary_requirements: '2 Vegan, 4 Standard',
    seating_table: 'Conservatory Head Table',
    vip_tag: 'Civic Patron',
  },
];

export const SEED_MOODBOARDS: MoodboardPalette[] = [
  {
    id: 'mb_wed_1',
    event_id: 'evt_wedding_01',
    title: 'Tuscan Conservatory & Beeswax Candlelight',
    style_archetype: 'Organic Architectural Editorial',
    color_Swatches: [
      { hex: '#5F6F52', name: 'Tuscan Olive Leaf', usage: 'Botanical runners & velvet menus' },
      { hex: '#C87D55', name: 'Siena Terracotta', usage: 'Artisanal ceramic chargers & vessels' },
      { hex: '#F4EFE6', name: 'Raw Travertine Linen', usage: 'Table drapery & deckle-edge paper' },
      { hex: '#2C3531', name: 'Cypress Charcoal', usage: 'Typography & wrought-iron candelabras' },
      { hex: '#D9B382', name: 'Warm Beeswax Gold', usage: 'Taper candles & brass flatware' },
    ],
    decor_elements: [
      'Unbleached Belgian linen banquet runners with raw hems',
      'Hand-thrown terracotta amphorae with pruned olive branches',
      'Slender beeswax taper candles in borosilicate glass sleeves',
      'Letterpress menus on 600gsm cotton rag stock',
    ],
    lighting_atmosphere: '2200K warm amber candlelight paired with recessed uplighting on stone arches.',
    floral_botanical_notes: [
      'Olea europaea (fruiting olive foliage)',
      'Cafe au Lait garden roses & dried lunaria pods',
      'Potted rosemary and thyme herb topiaries (replanted post-event)',
    ],
    culinary_dietary_pairings: [
      'Heirloom burrata with charred fig & aged balsamic welcome course',
      'Herb-crusted sea bass & wild mushroom risotto (celiac-safe)',
      'Rosemary & Meyer lemon olive oil cake',
    ],
  },
  {
    id: 'mb_bday_1',
    event_id: 'evt_birthday_02',
    title: 'SoHo Brutalist Loft & Ikebana Nocturne',
    style_archetype: 'Minimalist Gallery Nocturne',
    color_Swatches: [
      { hex: '#7A2E2E', name: 'Oxblood Bordeaux', usage: 'Sculptural floral focal stems' },
      { hex: '#D4A359', name: 'Smoked Amber', usage: 'Low-ball crystal & track wash' },
      { hex: '#E6E2DD', name: 'Honed Travertine', usage: 'Plinths & communal grazing monolith' },
      { hex: '#18181B', name: 'Gallery Obsidian', usage: 'Steel window frames & vinyl booth' },
    ],
    decor_elements: [
      'Monolithic travertine plinths for sculptural floral arrangements',
      'Brushed stainless steel bar fascia with backlit smoked glass',
      'Custom vinyl record listening lounge',
    ],
    lighting_atmosphere: 'High-contrast gallery pin-spots on tables with warm amber perimeter wash.',
    floral_botanical_notes: [
      'Burgundy anthurium and architectural branches',
      'Dried lotus pods and sculptural calla lilies',
    ],
    culinary_dietary_pairings: [
      'Yuzu-cured hamachi crudo on black ceramic stone',
      'Smoked rosemary & Japanese whisky highballs',
    ],
  },
  {
    id: 'mb_com_1',
    event_id: 'evt_community_03',
    title: 'Glasshouse Botanical Heritage Commons',
    style_archetype: 'Civic Botanical Agora',
    color_Swatches: [
      { hex: '#2D5A27', name: 'Conservatory Fern', usage: 'Hanging botanical baskets & banners' },
      { hex: '#D97724', name: 'Autumn Marigold', usage: 'Wayfinding signage & stage accents' },
      { hex: '#F7F4EB', name: 'Warm Limestone', usage: 'Communal table runners' },
      { hex: '#1E293B', name: 'Civic Slate', usage: 'Program booklets & donor wall' },
    ],
    decor_elements: [
      'Long reclaimed white oak communal tables (no disposable plastics)',
      'Overhead bistro Edison string grids woven through fern trusses',
      'Live botanical donor recognition wall',
    ],
    lighting_atmosphere: 'Natural golden hour conservatory light transitioning to 2700K festoon glow.',
    floral_botanical_notes: [
      'Native maidenhair ferns and potted heritage oaks',
      'Marigold and heirloom chrysanthemum stage borders',
    ],
    culinary_dietary_pairings: [
      'Zero-waste harvest grazing platters from local urban farms',
      'Spiced orchard cider & botanical mocktail shrub bar',
    ],
  },
];

export const SEED_AUDIT_LOGS: AuditLogRecord[] = [
  {
    id: 'aud_1',
    event_id: 'evt_wedding_01',
    actor_id: 'usr_primary_01',
    actor_name: 'Claire Vance',
    action: 'Initialized AES-256-GCM Envelope Vault & Tenant RLS Policy',
    module: 'SECURITY_VAULT',
    timestamp: '2026-10-30T19:40:00Z',
    metadata: { cipher: 'AES-256-GCM', kdf: 'HKDF-SHA256', rls: 'ENFORCED' },
  },
  {
    id: 'aud_2',
    event_id: 'evt_wedding_01',
    actor_id: 'usr_primary_01',
    actor_name: 'Vendor & Contract Agent',
    action: 'Extracted 2 risk clauses & hidden 22% fee from HarvestTable_140Guests_Quote_v2.pdf',
    module: 'VENDOR_OCR',
    timestamp: '2026-10-30T20:15:00Z',
    metadata: { vendor: 'Harvest Table Culinary', hiddenFeesFound: 2 },
  },
  {
    id: 'aud_3',
    event_id: 'evt_wedding_01',
    actor_id: 'usr_primary_01',
    actor_name: 'Logistics & Timeline Agent',
    action: 'Computed DAG Critical Path across 7 milestones (63 days total span)',
    module: 'DAG_SCHEDULER',
    timestamp: '2026-10-30T20:45:00Z',
    metadata: { criticalPathNodes: 6, cycleDetected: false },
  },
];

export const SEED_CHAT_MESSAGES: AgentChatMessage[] = [
  {
    id: 'msg_init_1',
    event_id: 'evt_wedding_01',
    role: 'assistant',
    sender_agent: 'Supervisor Agent',
    delegated_agents: [
      'Budget Allocator Agent',
      'Logistics & Timeline Agent',
      'Vendor & Contract Agent',
    ],
    content:
      'Welcome to PlanGenie. I have synchronized the deterministic budget ledger ($64,822.20 projected across 140 guests), verified the 7-node Critical Path DAG, and audited your competing catering quotes. Notice that Solstice Artisanal Kitchens saves $2,361 in true total cost compared to Harvest Table due to their 0% corkage waiver and lower 18% service charge. How would you like to adjust the plan?',
    timestamp: '2026-10-30T21:00:00Z',
    checkpoint_id: 'ckpt_graph_001',
  },
];

export function generateContextualCustomModules(params: {
  eventId: string;
  eventType: string;
  location: string;
  eventDays?: number;
  customNotes?: string;
}): CustomEventModule[] {
  const { eventId, eventType, location, eventDays, customNotes = '' } = params;
  const combined = `${eventType} ${location} ${customNotes}`.toLowerCase();
  const isFuneral =
    combined.includes('funeral') ||
    combined.includes('memorial') ||
    combined.includes('celebration of life') ||
    combined.includes('bereavement');
  const isIndianContext =
    combined.includes('india') ||
    combined.includes('udaipur') ||
    combined.includes('jaipur') ||
    combined.includes('mumbai') ||
    combined.includes('delhi') ||
    combined.includes('sangeet') ||
    combined.includes('mehendi') ||
    combined.includes('haldi') ||
    (eventType.toLowerCase().includes('wedding') && (eventDays ?? 0) >= 4);

  if (isFuneral) {
    return [
      {
        id: `cmod_spk_${Date.now()}_1`,
        event_id: eventId,
        category_title: 'Eulogy & Speaking Order (Who Speaks First)',
        module_type: 'speaking_order',
        description:
          'Ordered sequence of speakers, family eulogies, readings, and musical tributes during the service.',
        location_context: `${location} · Memorial Service Protocol`,
        items: [
          {
            id: `citem_${Date.now()}_1`,
            order_index: 1,
            title: 'Opening Welcome, Invocation & Words of Comfort',
            role_or_day: 'Speaker #1 (5 mins)',
            person_or_lead: 'Lead Officiant / Celebrant',
            notes: 'Welcome family & guests, quiet reflection, and opening prayer/poem.',
            completed: true,
          },
          {
            id: `citem_${Date.now()}_2`,
            order_index: 2,
            title: 'Primary Family Eulogy — Life Story & Legacy',
            role_or_day: 'Speaker #2 (8 mins)',
            person_or_lead: 'Eldest Child / Sibling',
            notes: 'Childhood memories, family milestones, and core values.',
            completed: false,
          },
          {
            id: `citem_${Date.now()}_3`,
            order_index: 3,
            title: 'Personal Tribute & Shared Memories',
            role_or_day: 'Speaker #3 (5 mins)',
            person_or_lead: 'Lifelong Friend / Colleague',
            notes: 'Stories of community impact, humor, and friendship.',
            completed: false,
          },
          {
            id: `citem_${Date.now()}_4`,
            order_index: 4,
            title: 'Selected Poem / Scripture Reading & Musical Interlude',
            role_or_day: 'Speaker #4 (4 mins)',
            person_or_lead: 'Grandchild / Niece',
            notes: 'Reading followed by acoustic cello / piano reflection.',
            completed: false,
          },
          {
            id: `citem_${Date.now()}_5`,
            order_index: 5,
            title: 'Closing Benediction & Processional Instructions',
            role_or_day: 'Speaker #5 (4 mins)',
            person_or_lead: 'Lead Officiant',
            notes: 'Dismissal by seating rows and invitation to the bereavement repast.',
            completed: false,
          },
        ],
        suggested_budget_additions: [
          {
            category: 'Memorial Service',
            name: 'Printed Order-of-Service Booklets & Framed Portrait Display',
            unit_cost: 4.5,
            quantity: 120,
            is_per_guest: true,
          },
          {
            category: 'Catering',
            name: 'Bereavement Repast Reception & Comfort Refreshments',
            unit_cost: 42,
            quantity: 120,
            is_per_guest: true,
          },
        ],
        suggested_task_additions: [
          {
            title: 'Confirm Eulogy Speaker Order & Collect Printed Readings',
            category: 'Memorial Program',
            milestone_code: 'T-7',
            duration_days: 3,
          },
          {
            title: 'Assign Pallbearers, Reserved Family Front Rows & Floral Tributes',
            category: 'Service Logistics',
            milestone_code: 'T-3',
            duration_days: 2,
          },
        ],
      },
      {
        id: `cmod_rit_${Date.now()}_2`,
        event_id: eventId,
        category_title: 'Pallbearers, Processional & Memorial Tributes',
        module_type: 'cultural_rituals',
        description:
          'Dignified coordination for family arrival, pallbearer escort, memory table, and repast hospitality.',
        location_context: `${location} · Service & Committal`,
        items: [
          {
            id: `citem_${Date.now()}_6`,
            order_index: 1,
            title: 'Immediate Family Private Viewing & Reserved Front Pew Seating',
            role_or_day: '30 mins prior',
            person_or_lead: 'Funeral Director & Ushers',
            notes: 'Reserve first 3 rows for immediate family and speakers.',
            completed: true,
          },
          {
            id: `citem_${Date.now()}_7`,
            order_index: 2,
            title: 'Pallbearer Processional & Floral Wreath Placement',
            role_or_day: 'Service Start',
            person_or_lead: '6 Designated Pallbearers',
            notes: 'Boutonnieres distributed 20 mins before processional.',
            completed: false,
          },
          {
            id: `citem_${Date.now()}_8`,
            order_index: 3,
            title: 'Memory Table, Guest Condolence Book & Livestream Link',
            role_or_day: 'Sanctuary Foyer',
            person_or_lead: 'AV Coordinator & Family Host',
            notes: 'Test remote Zoom/livestream audio feed for out-of-town relatives.',
            completed: false,
          },
        ],
      },
    ];
  }

  if (isIndianContext) {
    return [
      {
        id: `cmod_ind_${Date.now()}_1`,
        event_id: eventId,
        category_title: '5-Day Indian Wedding Ceremony & Ritual Itinerary',
        module_type: 'multi_day_itinerary',
        description:
          'Multi-day regional celebration schedule covering pre-wedding auspicious rituals, Sangeet, Baraat, Pheras, and Reception.',
        location_context: `${location} · 5-Day Indian Wedding Format`,
        items: [
          {
            id: `citem_${Date.now()}_1`,
            order_index: 1,
            title: 'Day 1: Ganesh Puja, Tilak & Welcome Mehfil Dinner',
            role_or_day: 'Day 1 of 5',
            person_or_lead: 'Family Pandit Ji & Both Families',
            notes: 'Auspicious invocation, welcome hampers in hotel rooms, acoustic sufi/folk night.',
            completed: true,
          },
          {
            id: `citem_${Date.now()}_2`,
            order_index: 2,
            title: 'Day 2: Morning Haldi Courtyard & Afternoon Mehendi Carnival',
            role_or_day: 'Day 2 of 5',
            person_or_lead: 'Bridal & Groom Squads + Mehendi Artists',
            notes: 'Marigold canopy decor, organic turmeric bowls, live folk dhol & chaat bazaar.',
            completed: false,
          },
          {
            id: `citem_${Date.now()}_3`,
            order_index: 3,
            title: 'Day 3: Grand Sangeet Night & Family Choreography Showcase',
            role_or_day: 'Day 3 of 5',
            person_or_lead: 'Choreographer & Stage Production Team',
            notes: 'LED stage backdrop, 8 rehearsed family dance acts, and DJ afterparty.',
            completed: false,
          },
          {
            id: `citem_${Date.now()}_4`,
            order_index: 4,
            title: 'Day 4: Royal Baraat Procession, Varmala & Sacred Mandap Pheras',
            role_or_day: 'Day 4 of 5 (Muhurat)',
            person_or_lead: 'Vedic Priest, Groom & Bride Families',
            notes: 'Vintage car/Ghodi Baraat, floral varmala exchange on lotus stage, 7 sacred pheras.',
            completed: false,
          },
          {
            id: `citem_${Date.now()}_5`,
            order_index: 5,
            title: 'Day 5: Vidaai Blessing & Grand Evening Reception Gala',
            role_or_day: 'Day 5 of 5',
            person_or_lead: 'Couple & Extended Guest List',
            notes: 'Formal stage greetings, multi-regional banquet, and elder blessings.',
            completed: false,
          },
        ],
        suggested_budget_additions: [
          {
            category: 'Multi-Day Decor',
            name: 'Haldi Marigold Pavilion, Mehendi Lounges & Floral Mandap',
            unit_cost: 18500,
            quantity: 1,
            is_per_guest: false,
          },
          {
            category: 'Entertainment & Baraat',
            name: 'Sangeet LED Stage, Sound Engineer, Dhol Troupe & Baraat Logistics',
            unit_cost: 9200,
            quantity: 1,
            is_per_guest: false,
          },
        ],
        suggested_task_additions: [
          {
            title: 'Lock 5-Day Hotel Room Blocks & Airport Shuttle Roster for Outstation Guests',
            category: 'Hospitality',
            milestone_code: 'T-60',
            duration_days: 10,
          },
          {
            title: 'Finalize Sangeet Dance Lineup, Audio Tracks & Pandit Muhurat Samagri',
            category: 'Cultural Rituals',
            milestone_code: 'T-30',
            duration_days: 7,
          },
        ],
      },
      {
        id: `cmod_ind_spk_${Date.now()}_2`,
        event_id: eventId,
        category_title: 'Sangeet Performances & Family Toast Order (Who Goes First)',
        module_type: 'speaking_order',
        description:
          'Sequence of family welcomes, Sangeet dance performances, and reception speeches.',
        location_context: `${location} · Sangeet & Reception Stage`,
        items: [
          {
            id: `citem_${Date.now()}_6`,
            order_index: 1,
            title: 'Parents of Bride & Groom Joint Welcome Blessing',
            role_or_day: 'Slot #1 (Opening)',
            person_or_lead: 'Parents of Both Families',
            notes: 'Warm welcome to outstation relatives and lamp lighting.',
            completed: true,
          },
          {
            id: `citem_${Date.now()}_7`,
            order_index: 2,
            title: 'Siblings & Cousins High-Energy Medley',
            role_or_day: 'Slot #2 (6 mins)',
            person_or_lead: 'Bride & Groom Siblings',
            notes: 'Track cue submitted to sound console.',
            completed: false,
          },
          {
            id: `citem_${Date.now()}_8`,
            order_index: 3,
            title: 'Best Friends Roast, Story & Toast',
            role_or_day: 'Slot #3 (5 mins)',
            person_or_lead: 'College & Childhood Friends',
            notes: 'Includes 2-minute photo montage on stage screen.',
            completed: false,
          },
          {
            id: `citem_${Date.now()}_9`,
            order_index: 4,
            title: 'Couple Finale Dance & Gratitude Speech',
            role_or_day: 'Slot #4 (Headline)',
            person_or_lead: 'Bride & Groom',
            notes: 'Cold pyro & confetti cue at chorus.',
            completed: false,
          },
        ],
      },
    ];
  }

  if (eventType.toLowerCase().includes('wedding')) {
    return [
      {
        id: `cmod_wed_us_${Date.now()}_1`,
        event_id: eventId,
        category_title: '2-Day Wedding Weekend Schedule (Regional Format)',
        module_type: 'multi_day_itinerary',
        description:
          'Tailored 2-day wedding schedule covering rehearsal walkthrough, welcome drinks, ceremony processional, and reception.',
        location_context: `${location} · ${eventDays || 2}-Day Wedding Format`,
        items: [
          {
            id: `citem_${Date.now()}_1`,
            order_index: 1,
            title: 'Day 1 (4:30 PM): Ceremony Walkthrough & Bridal Party Rehearsal',
            role_or_day: 'Day 1 · Rehearsal',
            person_or_lead: 'Officiant & Wedding Planner',
            notes: 'Practice processional pacing, music cues, and family front-row seating.',
            completed: true,
          },
          {
            id: `citem_${Date.now()}_2`,
            order_index: 2,
            title: 'Day 1 (6:30 PM): Rehearsal Dinner & Informal Open-Mic Toasts',
            role_or_day: 'Day 1 · Evening',
            person_or_lead: 'Hosting Family',
            notes: 'Welcome out-of-town guests and distribute day-of timeline cards.',
            completed: false,
          },
          {
            id: `citem_${Date.now()}_3`,
            order_index: 3,
            title: 'Day 2 (4:00 PM): Ceremony Processional, Vows & Recessional',
            role_or_day: 'Day 2 · Ceremony',
            person_or_lead: 'Officiant, Couple & String Quartet',
            notes: 'Sign marriage license with 2 witnesses immediately following recessional.',
            completed: false,
          },
          {
            id: `citem_${Date.now()}_4`,
            order_index: 4,
            title: 'Day 2 (5:00 PM – 11:00 PM): Cocktail Hour, Plated Dinner & First Dances',
            role_or_day: 'Day 2 · Reception',
            person_or_lead: 'Culinary Lead & Band/DJ',
            notes: 'Golden hour portraits during cocktail hour; grand entrance at 6:15 PM.',
            completed: false,
          },
        ],
        suggested_budget_additions: [
          {
            category: 'Rehearsal & Welcome',
            name: 'Day-1 Rehearsal Dinner & Out-of-Town Welcome Aperitifs',
            unit_cost: 65,
            quantity: 45,
            is_per_guest: false,
          },
        ],
        suggested_task_additions: [
          {
            title: 'Obtain County Marriage License & Confirm Officiant Vow Script',
            category: 'Legal & Ceremony',
            milestone_code: 'T-30',
            duration_days: 5,
          },
        ],
      },
      {
        id: `cmod_wed_spk_${Date.now()}_2`,
        event_id: eventId,
        category_title: 'Reception Speeches & Toasts Order (Who Speaks First)',
        module_type: 'speaking_order',
        description:
          'Exact speaking order for reception welcomes, Maid of Honor & Best Man toasts, and couple thank-you.',
        location_context: `${location} · Reception Toasts`,
        items: [
          {
            id: `citem_${Date.now()}_5`,
            order_index: 1,
            title: 'Welcome Toast & Blessing Before First Course',
            role_or_day: 'Speaker #1 (4 mins)',
            person_or_lead: 'Parents of the Couple',
            notes: 'Delivered once all guests are seated with champagne poured.',
            completed: true,
          },
          {
            id: `citem_${Date.now()}_6`,
            order_index: 2,
            title: 'Maid of Honor Speech',
            role_or_day: 'Speaker #2 (5 mins)',
            person_or_lead: 'Maid of Honor',
            notes: 'Between first course and main entrée service.',
            completed: false,
          },
          {
            id: `citem_${Date.now()}_7`,
            order_index: 3,
            title: 'Best Man Speech',
            role_or_day: 'Speaker #3 (5 mins)',
            person_or_lead: 'Best Man',
            notes: 'Immediately follows Maid of Honor toast.',
            completed: false,
          },
          {
            id: `citem_${Date.now()}_8`,
            order_index: 4,
            title: 'Newlyweds Gratitude Toast & Cake Cutting Cue',
            role_or_day: 'Speaker #4 (4 mins)',
            person_or_lead: 'Aurelia & Julian',
            notes: 'Transitions directly into first dance.',
            completed: false,
          },
        ],
      },
    ];
  }

  // Default for Birthday / Community / Custom Event Types
  return [
    {
      id: `cmod_gen_spk_${Date.now()}_1`,
      event_id: eventId,
      category_title: 'Speaking Order, Toasts & Stage Lineup (Who Speaks First)',
      module_type: 'speaking_order',
      description: `Ordered sequence of speakers, presenters, and special moments tailored for this ${eventType} in ${location}.`,
      location_context: `${location} · ${eventType}`,
      items: [
        {
          id: `citem_${Date.now()}_1`,
          order_index: 1,
          title: 'Opening Host Welcome & Evening Overview',
          role_or_day: 'Speaker #1 (5 mins)',
          person_or_lead: 'Event Host / Emcee',
          notes: 'Welcome guests and introduce the evening program.',
          completed: true,
        },
        {
          id: `citem_${Date.now()}_2`,
          order_index: 2,
          title: 'Keynote Tribute / Featured Toast',
          role_or_day: 'Speaker #2 (6 mins)',
          person_or_lead: 'Primary Guest Speaker',
          notes: 'Spotlight tribute with house audio and lighting cue.',
          completed: false,
        },
        {
          id: `citem_${Date.now()}_3`,
          order_index: 3,
          title: 'Closing Thank-You & Celebration Cue',
          role_or_day: 'Speaker #3 (4 mins)',
          person_or_lead: 'Guest of Honor / Organizer',
          notes: 'Transition to main entertainment or dessert service.',
          completed: false,
        },
      ],
    },
    {
      id: `cmod_gen_itn_${Date.now()}_2`,
      event_id: eventId,
      category_title: 'Location & Event-Specific Program Checklist',
      module_type: 'custom_checklist',
      description: `Custom logistical and regional requirements for ${location}.`,
      location_context: `${location} · ${eventDays || 1}-Day Format`,
      items: [
        {
          id: `citem_${Date.now()}_4`,
          order_index: 1,
          title: 'Venue Acoustic, Lighting & Curfew Compliance Check',
          role_or_day: 'T-14 Days',
          person_or_lead: 'Production Lead',
          notes: `Verify local municipal sound rules for ${location}.`,
          completed: false,
        },
        {
          id: `citem_${Date.now()}_5`,
          order_index: 2,
          title: 'VIP Arrival Protocol & Reserved Seating Markers',
          role_or_day: 'Day-Of',
          person_or_lead: 'Hospitality Coordinator',
          notes: 'Escort speakers and VIP guests to designated tables.',
          completed: false,
        },
      ],
    },
  ];
}

export const SEED_CUSTOM_MODULES: CustomEventModule[] = [
  ...generateContextualCustomModules({
    eventId: 'evt_wedding_01',
    eventType: 'wedding',
    location: 'Napa Valley, CA — Cortona Estate Conservatory',
    eventDays: 2,
  }),
  ...generateContextualCustomModules({
    eventId: 'evt_birthday_02',
    eventType: 'birthday',
    location: 'SoHo Mercer Penthouse, New York',
    eventDays: 1,
  }),
  ...generateContextualCustomModules({
    eventId: 'evt_community_03',
    eventType: 'community',
    location: 'Oakridge Glass Conservatory & Civic Plaza',
    eventDays: 1,
  }),
];

export function generateDefaultHotelBlocks(params: {
  eventId: string;
  eventType: string;
  location: string;
  eventDate: string;
  eventDays?: number;
}): HotelRoomBlockRecord[] {
  const { eventId, eventType, location, eventDate, eventDays = 2 } = params;
  const combined = `${eventType} ${location}`.toLowerCase();
  const isIndia =
    combined.includes('india') ||
    combined.includes('udaipur') ||
    combined.includes('jaipur') ||
    combined.includes('mumbai') ||
    combined.includes('goa') ||
    eventDays >= 4;

  if (isIndia) {
    return [
      {
        id: `htl_${Date.now()}_1`,
        event_id: eventId,
        hotel_name: `Taj Heritage Palace & Courtyard (${location.split(',')[0]})`,
        room_type: 'Royal Courtyard Suite & Haveli Rooms (5-Night Buyout Block)',
        check_in_date: eventDate,
        check_out_date: eventDate,
        nights: 5,
        rooms_blocked: 65,
        rooms_booked: 52,
        nightly_rate: 240,
        group_code: 'ROYAL-WED-5D',
        shuttle_included: true,
        assigned_guests_notes:
          'Bride & Groom immediate families, VIP elders, and international outstation guests (includes airport & station transfers + welcome hampers).',
        booking_status: 'contracted',
      },
      {
        id: `htl_${Date.now()}_2`,
        event_id: eventId,
        hotel_name: `Trident Lakeview Resort (${location.split(',')[0]})`,
        room_type: 'Deluxe Garden King / Twin Rooms',
        check_in_date: eventDate,
        check_out_date: eventDate,
        nights: 4,
        rooms_blocked: 45,
        rooms_booked: 34,
        nightly_rate: 145,
        group_code: 'SANGEET-GRP',
        shuttle_included: true,
        assigned_guests_notes:
          'College friends, extended cousins, and Sangeet choreography crew (shuttle loop every 30 mins to Mandap venue).',
        booking_status: 'held_block',
      },
    ];
  }

  return [
    {
      id: `htl_${Date.now()}_1`,
      event_id: eventId,
      hotel_name: 'Auberge du Soleil & Cortona Vineyard Villas',
      room_type: 'Vineyard View King Suite (Bridal Party & Family Block)',
      check_in_date: '2027-05-14',
      check_out_date: '2027-05-16',
      nights: Math.max(1, eventDays),
      rooms_blocked: 25,
      rooms_booked: 19,
      nightly_rate: 340,
      group_code: 'AURELIA-JULIAN-27',
      shuttle_included: true,
      assigned_guests_notes:
        'Immediate families, wedding party, and VIP out-of-town guests. Welcome bags delivered at check-in desk.',
      booking_status: 'contracted',
    },
    {
      id: `htl_${Date.now()}_2`,
      event_id: eventId,
      hotel_name: 'Solage Calistoga Boutique Inn & Spa',
      room_type: 'Standard Garden Studio & Double Queen',
      check_in_date: '2027-05-14',
      check_out_date: '2027-05-16',
      nights: Math.max(1, eventDays),
      rooms_blocked: 30,
      rooms_booked: 22,
      nightly_rate: 215,
      group_code: 'CORTONA-GUESTS',
      shuttle_included: true,
      assigned_guests_notes:
        'Out-of-state guests; chartered coach departs hotel lobby at 3:15 PM on Ceremony day.',
      booking_status: 'held_block',
    },
  ];
}

export const SEED_HOTEL_BLOCKS: HotelRoomBlockRecord[] = [
  ...generateDefaultHotelBlocks({
    eventId: 'evt_wedding_01',
    eventType: 'wedding',
    location: 'Napa Valley, CA — Cortona Estate Conservatory',
    eventDate: '2027-05-15',
    eventDays: 2,
  }),
  {
    id: 'htl_bday_01',
    event_id: 'evt_birthday_02',
    hotel_name: 'The Mercer SoHo Boutique Hotel',
    room_type: 'Loft King Suite (Out-of-Town VIP Guests)',
    check_in_date: '2026-12-18',
    check_out_date: '2026-12-20',
    nights: 2,
    rooms_blocked: 12,
    rooms_booked: 9,
    nightly_rate: 310,
    group_code: 'ROSTOVA-40',
    shuttle_included: false,
    assigned_guests_notes: 'Walking distance (1 block) from SoHo Mercer Penthouse venue.',
    booking_status: 'confirmed',
  },
  {
    id: 'htl_com_01',
    event_id: 'evt_community_03',
    hotel_name: 'Oakridge Grand Civic Hotel',
    room_type: 'Keynote Speaker & Honoree Executive Rooms',
    check_in_date: '2027-03-19',
    check_out_date: '2027-03-21',
    nights: 2,
    rooms_blocked: 15,
    rooms_booked: 12,
    nightly_rate: 175,
    group_code: 'CIVIC-GALA-27',
    shuttle_included: true,
    assigned_guests_notes: 'Reserved for keynote speakers, botanical fellows, and sponsors.',
    booking_status: 'contracted',
  },
];

export function buildEventSpecificInitialBudgetAndTasks(params: {
  eventId: string;
  eventType: string;
  location: string;
  guestCount: number;
  targetBudget: number;
  eventDays: number;
  kickoffDate?: string;
}): {
  budgetItems: BudgetItemRecord[];
  tasks: TaskRecord[];
} {
  const {
    eventId,
    eventType,
    location,
    guestCount,
    targetBudget,
    eventDays,
    kickoffDate = '2026-11-01',
  } = params;

  const combined = `${eventType} ${location}`.toLowerCase();
  const isFuneral =
    combined.includes('funeral') ||
    combined.includes('memorial') ||
    combined.includes('celebration of life') ||
    combined.includes('bereavement');
  const isIndianWedding =
    combined.includes('india') ||
    combined.includes('udaipur') ||
    combined.includes('jaipur') ||
    combined.includes('mumbai') ||
    combined.includes('sangeet') ||
    (eventType.toLowerCase().includes('wedding') && eventDays >= 4);

  if (isFuneral) {
    const t1 = `tsk_${Date.now()}_1`;
    const t2 = `tsk_${Date.now()}_2`;
    const t3 = `tsk_${Date.now()}_3`;
    const computed = computeCriticalPath(
      [
        {
          id: t1,
          event_id: eventId,
          title: 'Confirm Eulogy & Speaking Order (Who Speaks First) with Family',
          category: 'Memorial Program',
          milestone_code: 'T-7',
          start_day_offset: 0,
          duration_days: 2,
          buffer_days: 0,
          start_date: kickoffDate,
          due_date: kickoffDate,
          status: 'in_progress',
          assigned_to: 'Claire Vance',
          dependencies: [],
          is_critical_path: true,
        },
        {
          id: t2,
          event_id: eventId,
          title: 'Assign 6 Pallbearers, Front-Pew Family Seating & Processional Cues',
          category: 'Service Logistics',
          milestone_code: 'T-4',
          start_day_offset: 2,
          duration_days: 2,
          buffer_days: 0,
          start_date: kickoffDate,
          due_date: kickoffDate,
          status: 'todo',
          assigned_to: 'Claire Vance',
          dependencies: [t1],
          is_critical_path: true,
        },
        {
          id: t3,
          event_id: eventId,
          title: 'Print Order-of-Service Booklets, Set Up Memory Table & Repast Catering',
          category: 'Bereavement Hospitality',
          milestone_code: 'T-1',
          start_day_offset: 4,
          duration_days: 2,
          buffer_days: 0,
          start_date: kickoffDate,
          due_date: kickoffDate,
          status: 'todo',
          assigned_to: 'Claire Vance',
          dependencies: [t2],
          is_critical_path: true,
        },
      ],
      kickoffDate
    );

    return {
      budgetItems: [
        {
          id: `b_${Date.now()}_1`,
          event_id: eventId,
          category: 'Memorial Chapel & Sanctuary',
          name: 'Sanctuary / Chapel Reservation, Officiant Honorarium & Livestream AV',
          unit_cost: Math.round(targetBudget * 0.28),
          quantity: 1,
          tax_pct: 5.0,
          contingency_pct: 5.0,
          estimated_cost: Math.round(targetBudget * 0.3),
          actual_cost: Math.round(targetBudget * 0.28),
          is_per_guest: false,
          status: 'planned',
        },
        {
          id: `b_${Date.now()}_2`,
          event_id: eventId,
          category: 'Bereavement Repast Catering',
          name: 'Post-Service Family Reception & Comfort Refreshments',
          unit_cost: Math.max(18, Math.round((targetBudget * 0.36) / guestCount)),
          quantity: guestCount,
          tax_pct: 8.0,
          contingency_pct: 5.0,
          estimated_cost: Math.round(targetBudget * 0.4),
          actual_cost: Math.round(targetBudget * 0.36),
          is_per_guest: true,
          status: 'planned',
        },
        {
          id: `b_${Date.now()}_3`,
          event_id: eventId,
          category: 'Floral Tributes & Programs',
          name: 'Sanctuary Standing Wreaths, Casket Spray & Printed Order-of-Service Booklets',
          unit_cost: Math.round(targetBudget * 0.18),
          quantity: 1,
          tax_pct: 8.0,
          contingency_pct: 5.0,
          estimated_cost: Math.round(targetBudget * 0.2),
          actual_cost: Math.round(targetBudget * 0.18),
          is_per_guest: false,
          status: 'planned',
        },
      ],
      tasks: computed.tasks,
    };
  }

  if (isIndianWedding) {
    const t1 = `tsk_${Date.now()}_1`;
    const t2 = `tsk_${Date.now()}_2`;
    const t3 = `tsk_${Date.now()}_3`;
    const computed = computeCriticalPath(
      [
        {
          id: t1,
          event_id: eventId,
          title: '5-Day Palace Venue Buyout & Outstation Hotel Room Block Lock',
          category: 'Venue & Hospitality',
          milestone_code: 'T-120',
          start_day_offset: 0,
          duration_days: 7,
          buffer_days: 1,
          start_date: kickoffDate,
          due_date: kickoffDate,
          status: 'in_progress',
          assigned_to: 'Claire Vance',
          dependencies: [],
          is_critical_path: true,
        },
        {
          id: t2,
          event_id: eventId,
          title: 'Haldi Marigold Courtyard, Mehendi Bazaar & Royal Mandap Fabrication',
          category: 'Multi-Day Decor',
          milestone_code: 'T-60',
          start_day_offset: 8,
          duration_days: 10,
          buffer_days: 2,
          start_date: kickoffDate,
          due_date: kickoffDate,
          status: 'todo',
          assigned_to: 'Claire Vance',
          dependencies: [t1],
          is_critical_path: true,
        },
        {
          id: t3,
          event_id: eventId,
          title: 'Sangeet Performance Order, Baraat Dhol Permit & Vedic Pandit Muhurat',
          category: 'Cultural Rituals',
          milestone_code: 'T-21',
          start_day_offset: 20,
          duration_days: 7,
          buffer_days: 1,
          start_date: kickoffDate,
          due_date: kickoffDate,
          status: 'todo',
          assigned_to: 'Claire Vance',
          dependencies: [t2],
          is_critical_path: true,
        },
      ],
      kickoffDate
    );

    return {
      budgetItems: [
        {
          id: `b_${Date.now()}_1`,
          event_id: eventId,
          category: '5-Day Venue & Palace Lawns',
          name: `${eventDays}-Day Heritage Venue Buyout, Mandap Lawn & Sangeet Ballroom`,
          unit_cost: Math.round(targetBudget * 0.3),
          quantity: 1,
          tax_pct: 12.0,
          contingency_pct: 5.0,
          estimated_cost: Math.round(targetBudget * 0.34),
          actual_cost: Math.round(targetBudget * 0.3),
          is_per_guest: false,
          status: 'planned',
        },
        {
          id: `b_${Date.now()}_2`,
          event_id: eventId,
          category: 'Multi-Day Catering & Chaat Bazaar',
          name: '5-Day Royal Feasts (Mehendi Chaat, Sangeet Gala & Wedding Banquet)',
          unit_cost: Math.max(45, Math.round((targetBudget * 0.34) / guestCount)),
          quantity: guestCount,
          tax_pct: 10.0,
          contingency_pct: 5.0,
          estimated_cost: Math.round(targetBudget * 0.38),
          actual_cost: Math.round(targetBudget * 0.34),
          is_per_guest: true,
          status: 'planned',
        },
        {
          id: `b_${Date.now()}_3`,
          event_id: eventId,
          category: 'Haldi, Mehendi, Sangeet & Baraat Production',
          name: 'Floral Mandap, Sangeet LED Stage, Mehendi Artists & Baraat Dhol Troupe',
          unit_cost: Math.round(targetBudget * 0.18),
          quantity: 1,
          tax_pct: 10.0,
          contingency_pct: 5.0,
          estimated_cost: Math.round(targetBudget * 0.2),
          actual_cost: Math.round(targetBudget * 0.18),
          is_per_guest: false,
          status: 'planned',
        },
      ],
      tasks: computed.tasks,
    };
  }

  // Standard Wedding / Birthday / Community / Custom Event
  const t1Id = `tsk_${Date.now()}_1`;
  const t2Id = `tsk_${Date.now()}_2`;
  const initialNewTasks = computeCriticalPath(
    [
      {
        id: t1Id,
        event_id: eventId,
        title: `Venue Contract & ${eventType} Schedule Lock`,
        category: 'Venue',
        milestone_code: 'T-90',
        start_day_offset: 0,
        duration_days: 7,
        buffer_days: 1,
        start_date: kickoffDate,
        due_date: kickoffDate,
        status: 'in_progress',
        assigned_to: 'Claire Vance',
        dependencies: [],
        is_critical_path: true,
      },
      {
        id: t2Id,
        event_id: eventId,
        title: 'Confirm Speaking Order (Who Speaks First) & Catering Menu',
        category: 'Program & Culinary',
        milestone_code: 'T-30',
        start_day_offset: 8,
        duration_days: 10,
        buffer_days: 2,
        start_date: kickoffDate,
        due_date: kickoffDate,
        status: 'todo',
        assigned_to: 'Claire Vance',
        dependencies: [t1Id],
        is_critical_path: true,
      },
    ],
    kickoffDate
  );

  return {
    budgetItems: [
      {
        id: `b_${Date.now()}_1`,
        event_id: eventId,
        category: 'Venue & Production',
        name: `${location.split(',')[0]} Venue Reservation & Audio/Visual Setup`,
        unit_cost: Math.round(targetBudget * 0.32),
        quantity: 1,
        tax_pct: 8.5,
        contingency_pct: 5,
        estimated_cost: Math.round(targetBudget * 0.36),
        actual_cost: Math.round(targetBudget * 0.32),
        is_per_guest: false,
        status: 'planned',
      },
      {
        id: `b_${Date.now()}_2`,
        event_id: eventId,
        category: 'Catering & Hospitality',
        name: 'Guest Dining, Refreshments & Service Staff',
        unit_cost: Math.round((targetBudget * 0.35) / guestCount),
        quantity: guestCount,
        tax_pct: 8.5,
        contingency_pct: 5,
        estimated_cost: Math.round(targetBudget * 0.4),
        actual_cost: Math.round(targetBudget * 0.35),
        is_per_guest: true,
        status: 'planned',
      },
    ],
    tasks: initialNewTasks.tasks,
  };
}



