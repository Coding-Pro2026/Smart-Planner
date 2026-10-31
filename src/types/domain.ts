export type EventType =
  | 'wedding'
  | 'funeral'
  | 'birthday'
  | 'community'
  | 'cultural_festival'
  | 'corporate'
  | string;

export type CollaboratorRole = 'owner' | 'editor' | 'viewer' | 'vendor';

export type BudgetStatus = 'planned' | 'quoted' | 'contracted' | 'paid';

export type TaskStatus = 'todo' | 'in_progress' | 'completed' | 'delayed';

export type VendorStatus = 'shortlisted' | 'quoted' | 'negotiating' | 'booked' | 'declined';

export type RsvpStatus = 'confirmed' | 'pending' | 'declined';

export type AgentName =
  | 'Supervisor Agent'
  | 'Theme & Ideation Agent'
  | 'Budget Allocator Agent'
  | 'Logistics & Timeline Agent'
  | 'Vendor & Contract Agent';

export interface ModelRoutingConfig {
  fastTaskProfile: 'gemini-3.8-flash' | 'gemini-3.1-flash-lite';
  reasoningVisionProfile: 'gemini-3.8-flash';
  encryptionMode: 'session_memory' | 'aes_256_gcm_vault';
  strictDeterministicMath: boolean;
  autoCascadeDependencies: boolean;
}

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  roleTitle: string;
  auth_provider: 'session' | 'workspace_sso';
  encrypted_vault_envelope?: string;
  created_at: string;
}

export interface CollaboratorRecord {
  id: string;
  event_id: string;
  user_id: string;
  name: string;
  email: string;
  role: CollaboratorRole;
}

export interface BudgetItemRecord {
  id: string;
  event_id: string;
  category: string;
  name: string;
  unit_cost: number;
  quantity: number;
  tax_pct: number;
  contingency_pct: number;
  estimated_cost: number;
  actual_cost: number;
  is_per_guest: boolean;
  status: BudgetStatus;
  vendor_id?: string;
  notes?: string;
}

export interface TaskRecord {
  id: string;
  event_id: string;
  title: string;
  category: string;
  milestone_code: string; // e.g. T-180, T-90, T-30, T-0
  start_day_offset: number; // Days from project start (0 = kickoff)
  duration_days: number;
  buffer_days: number;
  start_date: string;
  due_date: string;
  status: TaskStatus;
  assigned_to: string;
  dependencies: string[]; // Array of upstream task IDs
  is_critical_path: boolean;
  early_start?: number;
  early_finish?: number;
  late_start?: number;
  late_finish?: number;
  slack_days?: number;
}

export interface ParsedVendorTerms {
  base_fee: number;
  service_charge_pct: number;
  gratuity_pct: number;
  tax_pct: number;
  total_true_cost: number;
  payment_schedule: string[];
  cancellation_policy: string;
  hidden_fees_detected: string[];
  risk_clauses: {
    clause: string;
    severity: 'low' | 'medium' | 'high';
    recommendation: string;
  }[];
  line_items: {
    description: string;
    amount: number;
    included: boolean;
  }[];
}

export interface VendorRecord {
  id: string;
  event_id: string;
  name: string;
  service_type: string;
  quote_amount: number;
  status: VendorStatus;
  contact_email: string;
  contract_filename: string;
  parsed_terms: ParsedVendorTerms;
}

export type GoogleAttendeeResponseStatus =
  | 'accepted'
  | 'declined'
  | 'tentative'
  | 'needsAction';

export interface GuestRsvpRecord {
  id: string;
  event_id: string;
  guest_name: string;
  contact: string;
  party_size: number;
  status: RsvpStatus;
  dietary_requirements: string;
  seating_table: string;
  vip_tag?: string;
  google_response_status?: GoogleAttendeeResponseStatus;
  invite_sent_at?: string;
}

export interface MoodboardPalette {
  id: string;
  event_id: string;
  title: string;
  style_archetype: string;
  color_Swatches: {
    hex: string;
    name: string;
    usage: string;
  }[];
  decor_elements: string[];
  lighting_atmosphere: string;
  floral_botanical_notes: string[];
  culinary_dietary_pairings: string[];
}

export interface AuditLogRecord {
  id: string;
  event_id: string;
  actor_id: string;
  actor_name: string;
  action: string;
  module: 'BUDGET' | 'DAG_SCHEDULER' | 'VENDOR_OCR' | 'AGENT_GRAPH' | 'SECURITY_VAULT' | 'RSVP';
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface EventRecord {
  id: string;
  owner_id: string;
  title: string;
  event_type: EventType;
  date: string;
  kickoff_date: string;
  location: string;
  guest_count: number;
  target_budget: number;
  currency: string;
  event_days?: number;
  is_destination?: boolean;
  cultural_context?: string;
  google_calendar_event_id?: string;
  google_calendar_html_link?: string;
  google_calendar_last_synced_at?: string;
}

export type CustomModuleType =
  | 'speaking_order'
  | 'multi_day_itinerary'
  | 'cultural_rituals'
  | 'hotel_accommodation'
  | 'custom_checklist';

export interface HotelRoomBlockRecord {
  id: string;
  event_id: string;
  hotel_name: string;
  room_type: string;
  check_in_date: string;
  check_out_date: string;
  nights: number;
  rooms_blocked: number;
  rooms_booked: number;
  nightly_rate: number;
  group_code: string;
  shuttle_included: boolean;
  assigned_guests_notes: string;
  booking_status: 'inquiry' | 'held_block' | 'contracted' | 'confirmed';
}

export interface LiveNearbyHotelDeal {
  id: string;
  hotel_name: string;
  neighborhood_or_address: string;
  distance_from_venue: string;
  price_per_night: number;
  original_retail_price: number;
  savings_pct: number;
  star_rating: number;
  tier_label: 'Best Budget Deal' | 'Mid-Range Value' | 'Group Block Favorite';
  amenities: string[];
  booking_url: string;
  source_label: string;
  lat?: number;
  lng?: number;
  google_maps_url?: string;
  google_directions_url?: string;
  google_embed_query?: string;
}

export interface CheapHotelTestRunResult {
  timestamp: string;
  city_tested: string;
  budget_cap: number;
  latency_ms: number;
  source_pipeline: string;
  hotels_found: number;
  cheapest_hotel_name: string;
  cheapest_nightly_rate: number;
  average_savings_pct: number;
  assertions: {
    name: string;
    passed: boolean;
    detail: string;
  }[];
}

export interface CustomModuleItem {
  id: string;
  order_index: number;
  title: string;
  role_or_day: string;
  person_or_lead: string;
  notes: string;
  completed: boolean;
}

export interface CustomEventModule {
  id: string;
  event_id: string;
  category_title: string;
  module_type: CustomModuleType;
  description: string;
  location_context: string;
  items: CustomModuleItem[];
  suggested_budget_additions?: {
    category: string;
    name: string;
    unit_cost: number;
    quantity: number;
    is_per_guest: boolean;
  }[];
  suggested_task_additions?: {
    title: string;
    category: string;
    milestone_code: string;
    duration_days: number;
  }[];
}

export interface ProposedToolAction {
  id: string;
  tool_name:
    | 'add_budget_item'
    | 'create_task'
    | 'shift_schedule'
    | 'compare_vendor_quotes'
    | 'parse_moodboard_palette';
  agent: AgentName;
  summary: string;
  payload: Record<string, unknown>;
}

export interface AgentChatMessage {
  id: string;
  event_id: string;
  role: 'user' | 'assistant';
  sender_agent?: AgentName;
  delegated_agents?: AgentName[];
  content: string;
  timestamp: string;
  checkpoint_id?: string;
  proposed_actions?: ProposedToolAction[];
  proposal_status?: 'pending' | 'accepted' | 'rejected';
}
