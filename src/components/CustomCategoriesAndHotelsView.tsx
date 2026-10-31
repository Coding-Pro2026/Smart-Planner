import React, { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BedDouble,
  Bus,
  Calendar,
  Check,
  Compass,
  ExternalLink,
  Globe,
  Hotel,
  Loader2,
  MapPin,
  Mic,
  Plus,
  Search,
  Sparkles,
  Star,
  Trash2,
} from 'lucide-react';
import {
  BudgetItemRecord,
  CustomEventModule,
  CustomModuleType,
  EventRecord,
  HotelRoomBlockRecord,
  LiveNearbyHotelDeal,
  TaskRecord,
} from '../types/domain';
import { postJson } from '../lib/api';
import { EventVenueAndHotelsMap } from './EventVenueAndHotelsMap';

interface CustomCategoriesAndHotelsViewProps {
  event: EventRecord;
  customModules: CustomEventModule[];
  hotelBlocks: HotelRoomBlockRecord[];
  focusedModuleId?: string | null;
  onSelectFocusedModule?: (modId: string | null) => void;
  onUpdateEventContext: (updates: Partial<EventRecord>) => void;
  onReplaceCustomModulesAndHotels: (
    modules: CustomEventModule[],
    hotels: HotelRoomBlockRecord[]
  ) => void;
  onToggleCustomItem: (moduleId: string, itemId: string) => void;
  onMoveCustomItem: (
    moduleId: string,
    itemId: string,
    direction: 'up' | 'down'
  ) => void;
  onAddCustomItem: (
    moduleId: string,
    item: {
      title: string;
      role_or_day: string;
      person_or_lead: string;
      notes: string;
    }
  ) => void;
  onDeleteCustomItem: (moduleId: string, itemId: string) => void;
  onAddCustomModule: (mod: {
    category_title: string;
    module_type: CustomModuleType;
    description: string;
  }) => void;
  onAddHotelBlock: (
    block: Omit<HotelRoomBlockRecord, 'id' | 'event_id'>
  ) => void;
  onUpdateHotelBookedCount: (blockId: string, nextBooked: number) => void;
  onAddBudgetItem: (item: Omit<BudgetItemRecord, 'id' | 'event_id'>) => void;
  onAddTask: (
    task: Omit<
      TaskRecord,
      | 'id'
      | 'event_id'
      | 'start_day_offset'
      | 'start_date'
      | 'due_date'
      | 'is_critical_path'
    >
  ) => void;
}

export const CustomCategoriesAndHotelsView: React.FC<
  CustomCategoriesAndHotelsViewProps
> = ({
  event,
  customModules,
  hotelBlocks,
  focusedModuleId,
  onSelectFocusedModule,
  onUpdateEventContext,
  onReplaceCustomModulesAndHotels,
  onToggleCustomItem,
  onMoveCustomItem,
  onAddCustomItem,
  onDeleteCustomItem,
  onAddCustomModule,
  onAddHotelBlock,
  onUpdateHotelBookedCount,
  onAddBudgetItem,
  onAddTask,
}) => {
  const [eventTypeInput, setEventTypeInput] = useState<string>(event.event_type);
  const [locationInput, setLocationInput] = useState<string>(event.location);
  const [daysInput, setDaysInput] = useState<string>(
    String(event.event_days ?? 2)
  );
  const [isDestinationInput, setIsDestinationInput] = useState<boolean>(
    event.is_destination ?? true
  );
  const [customAiPrompt, setCustomAiPrompt] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [syncedFeedback, setSyncedFeedback] = useState<string | null>(null);
  const [cotAnalysis, setCotAnalysis] = useState<{
    step_1_event_archetype_analysis: string;
    step_2_regional_and_cultural_nuances: string;
    step_3_speaking_and_ritual_sequence: string;
    step_4_sub_category_mapping: string;
  } | null>(null);

  // Live Online Cheap Hotel Search State
  const [liveHotelDeals, setLiveHotelDeals] = useState<LiveNearbyHotelDeal[]>(
    []
  );
  const [groundingSources, setGroundingSources] = useState<
    { title: string; uri: string }[]
  >([]);
  const [maxNightlyBudget, setMaxNightlyBudget] = useState<string>('180');
  const [isSearchingHotels, setIsSearchingHotels] = useState<boolean>(false);

  // Sync local inputs when event switches
  useEffect(() => {
    setEventTypeInput(event.event_type);
    setLocationInput(event.location);
    setDaysInput(String(event.event_days ?? 2));
    setIsDestinationInput(event.is_destination ?? true);

    const combined = `${event.event_type} ${event.location}`.toLowerCase();
    const isFun =
      combined.includes('funeral') ||
      combined.includes('memorial') ||
      combined.includes('celebration of life');
    const isInd =
      combined.includes('india') ||
      combined.includes('udaipur') ||
      combined.includes('jaipur') ||
      (event.event_days ?? 2) >= 4;

    setCotAnalysis(
      isFun
        ? {
            step_1_event_archetype_analysis: `Event analyzed as a solemn Funeral / Celebration of Life (${
              event.event_days ?? 1
            }d). Prioritizing dignified bereavement protocol, family processional order, and low-stress guest logistics.`,
            step_2_regional_and_cultural_nuances: `Tailored for ${event.location}: Sanctuary floral wreath placement, printed order-of-service programs, and bereavement repast reception.`,
            step_3_speaking_and_ritual_sequence: `Speaking Order ("Who Speaks First"): #1 Officiant invocation → #2 Eldest child / primary family eulogy → #3 Sibling & grandchild tributes → #4 Colleague remembrance → #5 Committal & pallbearer recessional.`,
            step_4_sub_category_mapping: `Mapped into ${customModules.length} nuanced sub-categories: ${customModules
              .map((m) => m.category_title)
              .join(' · ')}.`,
          }
        : isInd
        ? {
            step_1_event_archetype_analysis: `Event analyzed as a multi-day (${
              event.event_days ?? 5
            }-Day) Indian Destination Wedding requiring distinct ritual setups and hospitality blocks.`,
            step_2_regional_and_cultural_nuances: `Tailored for ${event.location}: Ganesh Puja welcome, Haldi, Mehendi, Sangeet night, Baraat procession, sacred Mandap Pheras, and Grand Reception.`,
            step_3_speaking_and_ritual_sequence: `Ritual & Speaking Sequence: Auspicious muhurat timing per day, plus Sangeet family performance order and reception toasts ("Who Goes First").`,
            step_4_sub_category_mapping: `Mapped into ${customModules.length} nuanced sub-categories: ${customModules
              .map((m) => m.category_title)
              .join(' · ')}.`,
          }
        : {
            step_1_event_archetype_analysis: `Event analyzed as a ${
              event.event_days ?? 2
            }-day ${event.event_type} for ${event.guest_count} guests.`,
            step_2_regional_and_cultural_nuances: `Tailored for ${event.location} regional venue timelines, acoustic guidelines, and out-of-town guest shuttle turnarounds.`,
            step_3_speaking_and_ritual_sequence: `Speaking Order ("Who Speaks First"): Welcome toast → Primary family / keynote remarks → Featured toasts → Closing celebration.`,
            step_4_sub_category_mapping: `Mapped into ${customModules.length} nuanced sub-categories: ${customModules
              .map((m) => m.category_title)
              .join(' · ')}.`,
          }
    );
  }, [
    event.id,
    event.event_type,
    event.location,
    event.event_days,
    event.is_destination,
    event.guest_count,
    customModules.length,
  ]);

  // Automatically fetch live online cheap hotels when event location changes
  const hotelRequestId = React.useRef(0);
  const fetchLiveNearbyHotels = async (targetLoc?: string) => {
    const locToSearch = targetLoc || event.location;
    const myRequest = ++hotelRequestId.current;
    setIsSearchingHotels(true);
    const res = await postJson<{
      deals?: LiveNearbyHotelDeal[];
      groundingSources?: { title: string; uri: string }[];
    }>(
      '/api/agents/search-nearby-hotels',
      {
        location: locToSearch,
        maxNightlyBudget: Number(maxNightlyBudget) || 180,
        eventType: event.event_type,
      },
      { timeoutMs: 45_000 }
    );
    // Ignore stale responses (user switched event / location while this was in flight)
    if (myRequest !== hotelRequestId.current) return;
    if (res.ok && res.data) {
      if (Array.isArray(res.data.deals)) setLiveHotelDeals(res.data.deals);
      if (Array.isArray(res.data.groundingSources)) setGroundingSources(res.data.groundingSources);
    }
    // On failure keep existing deals (offline-friendly)
    setIsSearchingHotels(false);
  };

  useEffect(() => {
    fetchLiveNearbyHotels(event.location);
  }, [event.id, event.location]);

  // Per-module new item inputs
  const [newItemTitleMap, setNewItemTitleMap] = useState<Record<string, string>>(
    {}
  );
  const [newItemRoleMap, setNewItemRoleMap] = useState<Record<string, string>>(
    {}
  );
  const [newItemPersonMap, setNewItemPersonMap] = useState<
    Record<string, string>
  >({});
  const [newItemNotesMap, setNewItemNotesMap] = useState<Record<string, string>>(
    {}
  );

  // New custom category form
  const [newCatTitle, setNewCatTitle] = useState('');
  const [newCatType, setNewCatType] =
    useState<CustomModuleType>('speaking_order');
  const [newCatDesc, setNewCatDesc] = useState('');

  // New hotel room block form
  const [hotelName, setHotelName] = useState('');
  const [roomType, setRoomType] = useState('Deluxe Courtyard King / Double');
  const [nights, setNights] = useState(String(event.event_days ?? 2));
  const [roomsBlocked, setRoomsBlocked] = useState('25');
  const [roomsBooked, setRoomsBooked] = useState('10');
  const [nightlyRate, setNightlyRate] = useState('145');
  const [groupCode, setGroupCode] = useState('VIP-GROUP');
  const [shuttleIncluded, setShuttleIncluded] = useState(true);
  const [guestNotes, setGuestNotes] = useState(
    'Out-of-town family & guest room block with venue shuttle.'
  );

  const triggerAiGenerate = async (overrideParams?: {
    eventType: string;
    location: string;
    eventDays: number;
    isDestination: boolean;
    customPrompt: string;
  }) => {
    const targetType = overrideParams?.eventType ?? eventTypeInput;
    const targetLoc = overrideParams?.location ?? locationInput;
    const targetDays =
      overrideParams?.eventDays ?? Math.max(1, Number(daysInput) || 1);
    const targetDest = overrideParams?.isDestination ?? isDestinationInput;
    const targetPrompt = overrideParams?.customPrompt ?? customAiPrompt;

    setIsGenerating(true);
    setSyncedFeedback(null);
    onUpdateEventContext({
      event_type: targetType,
      location: targetLoc,
      event_days: targetDays,
      is_destination: targetDest,
    });

    const res = await postJson<{
      chainOfThoughtAnalysis?: typeof cotAnalysis;
      modules?: CustomEventModule[];
      hotelBlocks?: HotelRoomBlockRecord[];
    }>(
      '/api/agents/generate-custom-modules',
      {
        eventId: event.id,
        eventType: targetType,
        location: targetLoc,
        eventDate: event.date,
        eventDays: targetDays,
        isDestination: targetDest,
        customPrompt: targetPrompt,
      },
      { timeoutMs: 60_000 }
    );
    setIsGenerating(false);

    if (!res.ok || !res.data || !Array.isArray(res.data.modules)) {
      setSyncedFeedback(
        `Couldn't generate custom categories right now (${res.ok ? 'empty response' : res.error}). Your existing tabs are unchanged.`
      );
      return;
    }
    const data = res.data;
    if (data.chainOfThoughtAnalysis) setCotAnalysis(data.chainOfThoughtAnalysis);
    const modules = data.modules!.map((m) => ({ ...m, event_id: event.id }));
    const hotels = Array.isArray(data.hotelBlocks)
      ? data.hotelBlocks.map((h) => ({ ...h, event_id: event.id }))
      : hotelBlocks;
    onReplaceCustomModulesAndHotels(modules, hotels);
    onSelectFocusedModule?.(null);
    setSyncedFeedback(
      `Improvised ${modules.length} custom event sub-categories and ${
        Array.isArray(data.hotelBlocks) ? data.hotelBlocks.length : hotels.length
      } hotel room blocks tailored for a ${targetDays}-day ${targetType} in ${targetLoc}.`
    );
    void fetchLiveNearbyHotels(targetLoc);
  };

  const applyPresetScenario = (preset: 'india_5d' | 'usa_2d' | 'funeral') => {
    if (preset === 'india_5d') {
      setEventTypeInput('wedding');
      setLocationInput('Udaipur, Rajasthan, India — Taj Lake Palace');
      setDaysInput('5');
      setIsDestinationInput(true);
      setCustomAiPrompt(
        '5-day Indian destination wedding with Haldi, Mehendi, Sangeet performances, Baraat, Mandap Pheras, and palace hotel blocks'
      );
      triggerAiGenerate({
        eventType: 'wedding',
        location: 'Udaipur, Rajasthan, India — Taj Lake Palace',
        eventDays: 5,
        isDestination: true,
        customPrompt:
          '5-day Indian destination wedding with Haldi, Mehendi, Sangeet performances, Baraat, Mandap Pheras, and palace hotel blocks',
      });
    } else if (preset === 'usa_2d') {
      setEventTypeInput('wedding');
      setLocationInput('Napa Valley, CA, USA — Cortona Vineyard');
      setDaysInput('2');
      setIsDestinationInput(true);
      setCustomAiPrompt(
        '2-day USA vineyard wedding with rehearsal dinner, ceremony processional, reception toast order, and resort room blocks'
      );
      triggerAiGenerate({
        eventType: 'wedding',
        location: 'Napa Valley, CA, USA — Cortona Vineyard',
        eventDays: 2,
        isDestination: true,
        customPrompt:
          '2-day USA vineyard wedding with rehearsal dinner, ceremony processional, reception toast order, and resort room blocks',
      });
    } else if (preset === 'funeral') {
      setEventTypeInput('funeral');
      setLocationInput('Boston, MA — Grace Memorial Chapel');
      setDaysInput('1');
      setIsDestinationInput(false);
      setCustomAiPrompt(
        'Funeral & Celebration of Life service with eulogy speaking order (who speaks first), pallbearers, floral tributes, and bereavement repast'
      );
      triggerAiGenerate({
        eventType: 'funeral',
        location: 'Boston, MA — Grace Memorial Chapel',
        eventDays: 1,
        isDestination: false,
        customPrompt:
          'Funeral & Celebration of Life service with eulogy speaking order (who speaks first), pallbearers, floral tributes, and bereavement repast',
      });
    }
  };

  const handleLockInLiveHotelDeal = (deal: LiveNearbyHotelDeal) => {
    const stayNights = Math.max(1, event.event_days ?? 2);
    const roomsToBlock = Math.max(10, Math.round(event.guest_count / 4));
    onAddHotelBlock({
      hotel_name: deal.hotel_name,
      room_type: `${deal.tier_label} — Standard King / Double (${deal.distance_from_venue})`,
      check_in_date: event.date,
      check_out_date: event.date,
      nights: stayNights,
      rooms_blocked: roomsToBlock,
      rooms_booked: Math.round(roomsToBlock * 0.4),
      nightly_rate: deal.price_per_night,
      group_code: `DEAL-${deal.savings_pct}OFF`,
      shuttle_included: true,
      assigned_guests_notes: `Locked online deal (${deal.savings_pct}% off retail $${deal.original_retail_price}/nt). Amenities: ${deal.amenities.join(', ')}.`,
      booking_status: 'held_block',
    });
    setSyncedFeedback(
      `Locked in group room block at "${deal.hotel_name}" for $${deal.price_per_night}/night (${deal.savings_pct}% below retail).`
    );
  };

  const handleSyncSuggestedToCore = (mod: CustomEventModule) => {
    let addedBudget = 0;
    let addedTasks = 0;

    if (Array.isArray(mod.suggested_budget_additions)) {
      for (const b of mod.suggested_budget_additions) {
        onAddBudgetItem({
          category: b.category,
          name: b.name,
          unit_cost: b.unit_cost,
          quantity: b.quantity,
          tax_pct: 8.5,
          contingency_pct: 5,
          estimated_cost: b.unit_cost * b.quantity,
          actual_cost: 0,
          is_per_guest: b.is_per_guest,
          status: 'planned',
        });
        addedBudget++;
      }
    }

    if (Array.isArray(mod.suggested_task_additions)) {
      for (const t of mod.suggested_task_additions) {
        onAddTask({
          title: t.title,
          category: t.category,
          milestone_code: t.milestone_code,
          duration_days: t.duration_days,
          buffer_days: 1,
          status: 'todo',
          assigned_to: 'Claire Vance',
          dependencies: [],
        });
        addedTasks++;
      }
    }

    setSyncedFeedback(
      `Added ${addedBudget} custom budget line item(s) and ${addedTasks} milestone task(s) from "${mod.category_title}" into your core Budget and Schedule.`
    );
  };

  const handleSyncHotelBlockToBudget = (block: HotelRoomBlockRecord) => {
    const totalRoomNights = block.rooms_blocked * block.nights;
    onAddBudgetItem({
      category: 'Hotel & Accommodation',
      name: `${block.hotel_name} — ${block.room_type} (${block.rooms_blocked} rooms × ${block.nights} nights)`,
      unit_cost: block.nightly_rate,
      quantity: totalRoomNights,
      tax_pct: 12.0,
      contingency_pct: 5.0,
      estimated_cost: block.nightly_rate * totalRoomNights,
      actual_cost: block.rooms_booked * block.nights * block.nightly_rate,
      is_per_guest: false,
      status: 'contracted',
    });
    setSyncedFeedback(
      `Synced "${block.hotel_name}" room block ($${(
        block.nightly_rate * totalRoomNights
      ).toLocaleString()} base across ${totalRoomNights} room-nights) to your core Budget.`
    );
  };

  const handleCreateCustomModuleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatTitle.trim()) return;
    onAddCustomModule({
      category_title: newCatTitle.trim(),
      module_type: newCatType,
      description:
        newCatDesc.trim() ||
        `Custom ${newCatType.replace('_', ' ')} category for ${event.title}`,
    });
    setNewCatTitle('');
    setNewCatDesc('');
  };

  const handleCreateHotelBlockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hotelName.trim()) return;
    onAddHotelBlock({
      hotel_name: hotelName.trim(),
      room_type: roomType.trim() || 'Standard Group Block',
      check_in_date: event.date,
      check_out_date: event.date,
      nights: Math.max(1, Number(nights) || 1),
      rooms_blocked: Math.max(1, Number(roomsBlocked) || 10),
      rooms_booked: Math.max(0, Number(roomsBooked) || 0),
      nightly_rate: Math.max(0, Number(nightlyRate) || 180),
      group_code: groupCode.trim() || 'GROUP-BLOCK',
      shuttle_included: shuttleIncluded,
      assigned_guests_notes:
        guestNotes.trim() || 'Out-of-town guest accommodation block.',
      booking_status: 'held_block',
    });
    setHotelName('');
  };

  const visibleModules = focusedModuleId
    ? customModules.filter((m) => m.id === focusedModuleId)
    : customModules;

  const totalRoomsBlocked = hotelBlocks.reduce(
    (sum, b) => sum + b.rooms_blocked,
    0
  );
  const totalRoomsBooked = hotelBlocks.reduce(
    (sum, b) => sum + b.rooms_booked,
    0
  );
  const totalHotelBlockCommitment = hotelBlocks.reduce(
    (sum, b) => sum + b.rooms_blocked * b.nights * b.nightly_rate,
    0
  );

  return (
    <div className="space-y-8">
      {/* Sub-navigation bar for all dynamic custom categories of this event */}
      <div className="bg-white border border-stone-200/80 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onSelectFocusedModule && onSelectFocusedModule(null)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-2xl transition-colors ${
              !focusedModuleId
                ? 'bg-stone-900 text-white'
                : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            All Custom Categories &amp; Hotels ({customModules.length})
          </button>
          {customModules.map((mod) => (
            <button
              key={mod.id}
              type="button"
              onClick={() =>
                onSelectFocusedModule && onSelectFocusedModule(mod.id)
              }
              className={`px-3.5 py-2 text-xs font-semibold rounded-2xl transition-colors ${
                focusedModuleId === mod.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-indigo-50/80 text-indigo-700 hover:bg-indigo-100'
              }`}
            >
              {mod.category_title}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => applyPresetScenario('funeral')}
            disabled={isGenerating}
            className="px-3 py-1.5 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors"
          >
            Switch to Funeral / Memorial
          </button>
          <button
            type="button"
            onClick={() => applyPresetScenario('india_5d')}
            disabled={isGenerating}
            className="px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors"
          >
            Switch to 5-Day Indian Wedding
          </button>
          <button
            type="button"
            onClick={() => applyPresetScenario('usa_2d')}
            disabled={isGenerating}
            className="px-3 py-1.5 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors"
          >
            Switch to 2-Day USA Wedding
          </button>
        </div>
      </div>

      {syncedFeedback && (
        <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between gap-3">
          <span>{syncedFeedback}</span>
          <button
            type="button"
            onClick={() => setSyncedFeedback(null)}
            className="text-xs font-semibold text-emerald-800 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* CHAIN-OF-THOUGHT EVENT ANALYSIS trace */}
      {cotAnalysis && (
        <div className="bg-white border border-stone-200/80 rounded-3xl p-6 sm:p-7 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-teal-700 uppercase tracking-wider">
                Agentic Chain-of-Thought Analysis ({event.event_type.toUpperCase()})
              </span>
              <h3 className="text-base font-bold text-stone-900 mt-0.5">
                How PlanGenie Deduced Your Custom Sub-Categories &amp; Ritual Checklists
              </h3>
            </div>
            <span className="font-mono text-[11px] font-semibold text-teal-700">
              4-Step Cultural &amp; Protocol Deduction
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2 border-t border-stone-100 text-xs">
            <div className="space-y-1">
              <div className="font-mono text-[11px] font-bold text-teal-700">
                01 · Event Archetype &amp; Tone
              </div>
              <p className="text-stone-600 leading-relaxed">
                {cotAnalysis.step_1_event_archetype_analysis}
              </p>
            </div>
            <div className="space-y-1">
              <div className="font-mono text-[11px] font-bold text-emerald-700">
                02 · Regional &amp; Cultural Nuances
              </div>
              <p className="text-stone-600 leading-relaxed">
                {cotAnalysis.step_2_regional_and_cultural_nuances}
              </p>
            </div>
            <div className="space-y-1">
              <div className="font-mono text-[11px] font-bold text-amber-700">
                03 · Speaking &amp; Ritual Sequence
              </div>
              <p className="text-stone-600 leading-relaxed">
                {cotAnalysis.step_3_speaking_and_ritual_sequence}
              </p>
            </div>
            <div className="space-y-1">
              <div className="font-mono text-[11px] font-bold text-sky-700">
                04 · Sub-Category Synthesis
              </div>
              <p className="text-stone-600 leading-relaxed">
                {cotAnalysis.step_4_sub_category_mapping}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 1: Custom Event-Type & Regional Categories (Speaking Order / Who Speaks First / Multi-Day Rituals) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {(visibleModules.length > 0 ? visibleModules : customModules).map(
          (mod) => {
            const completedCount = mod.items.filter((i) => i.completed).length;
            const colSpanClass =
              visibleModules.length === 1 ? 'lg:col-span-12' : 'lg:col-span-6';

            return (
              <div
                key={mod.id}
                className={`${colSpanClass} bg-white border border-stone-200/80 rounded-3xl p-7 sm:p-8 flex flex-col justify-between gap-6 shadow-sm hover:shadow-md transition-shadow duration-200`}
              >
                <div className="space-y-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600">
                        {mod.module_type === 'speaking_order' ? (
                          <Mic className="w-3.5 h-3.5" />
                        ) : (
                          <Calendar className="w-3.5 h-3.5" />
                        )}
                        <span>{mod.location_context}</span>
                      </div>
                      <h3 className="text-lg font-bold text-stone-900">
                        {mod.category_title}
                      </h3>
                      <p className="text-xs text-stone-500 leading-relaxed">
                        {mod.description}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-mono text-sm font-bold text-stone-900 tabular-nums">
                        {completedCount}/{mod.items.length}
                      </span>
                      <div className="text-[11px] text-stone-400">ready</div>
                    </div>
                  </div>

                  {/* Ordered Items List (with Up/Down Reordering for Who Speaks First / Multi-Day Sequence) */}
                  <div className="divide-y divide-stone-100 border-t border-b border-stone-100">
                    {mod.items.map((item, idx) => (
                      <div
                        key={item.id}
                        className="py-3.5 flex items-start justify-between gap-3 text-xs"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <button
                            type="button"
                            onClick={() => onToggleCustomItem(mod.id, item.id)}
                            className={`mt-0.5 w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                              item.completed
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : 'border-stone-300 hover:border-indigo-600'
                            }`}
                          >
                            {item.completed && <Check className="w-3 h-3" />}
                          </button>

                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-[11px] font-bold text-indigo-600 tabular-nums">
                                #{idx + 1}
                              </span>
                              <span
                                className={`font-semibold ${
                                  item.completed
                                    ? 'line-through text-stone-400'
                                    : 'text-stone-900'
                                }`}
                              >
                                {item.title}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-stone-500">
                              <span className="font-mono text-stone-700 font-medium">
                                {item.role_or_day}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>Lead: {item.person_or_lead}</span>
                            </div>

                            {item.notes && (
                              <p className="text-[11px] text-stone-500 leading-relaxed">
                                {item.notes}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Up / Down Order Controls + Delete */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              onMoveCustomItem(mod.id, item.id, 'up')
                            }
                            disabled={idx === 0}
                            title="Move earlier in order (e.g. Speak First)"
                            className="p-1 text-stone-400 hover:text-stone-800 disabled:opacity-25 rounded-lg"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onMoveCustomItem(mod.id, item.id, 'down')
                            }
                            disabled={idx === mod.items.length - 1}
                            title="Move later in order"
                            className="p-1 text-stone-400 hover:text-stone-800 disabled:opacity-25 rounded-lg"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onDeleteCustomItem(mod.id, item.id)
                            }
                            title="Remove item"
                            className="p-1 text-stone-400 hover:text-rose-600 rounded-lg"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add New Speaker / Ceremony Step inside this Module */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const title = (newItemTitleMap[mod.id] ?? '').trim();
                      if (!title) return;
                      onAddCustomItem(mod.id, {
                        title,
                        role_or_day:
                          (newItemRoleMap[mod.id] ?? '').trim() ||
                          (mod.module_type === 'speaking_order'
                            ? `Speaker #${mod.items.length + 1} (5 mins)`
                            : `Day ${mod.items.length + 1}`),
                        person_or_lead:
                          (newItemPersonMap[mod.id] ?? '').trim() ||
                          'Designated Speaker / Lead',
                        notes: (newItemNotesMap[mod.id] ?? '').trim(),
                      });
                      setNewItemTitleMap((prev) => ({ ...prev, [mod.id]: '' }));
                      setNewItemRoleMap((prev) => ({ ...prev, [mod.id]: '' }));
                      setNewItemPersonMap((prev) => ({
                        ...prev,
                        [mod.id]: '',
                      }));
                      setNewItemNotesMap((prev) => ({ ...prev, [mod.id]: '' }));
                    }}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1"
                  >
                    <input
                      type="text"
                      placeholder={
                        mod.module_type === 'speaking_order'
                          ? 'Add speaker / eulogy / toast...'
                          : 'Add ceremony / ritual step...'
                      }
                      value={newItemTitleMap[mod.id] ?? ''}
                      onChange={(e) =>
                        setNewItemTitleMap((prev) => ({
                          ...prev,
                          [mod.id]: e.target.value,
                        }))
                      }
                      className="sm:col-span-5 px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl"
                    />
                    <input
                      type="text"
                      placeholder="Slot / Day (e.g. Speaker #1 or Day 4)"
                      value={newItemRoleMap[mod.id] ?? ''}
                      onChange={(e) =>
                        setNewItemRoleMap((prev) => ({
                          ...prev,
                          [mod.id]: e.target.value,
                        }))
                      }
                      className="sm:col-span-3 px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl"
                    />
                    <input
                      type="text"
                      placeholder="Person / Lead"
                      value={newItemPersonMap[mod.id] ?? ''}
                      onChange={(e) =>
                        setNewItemPersonMap((prev) => ({
                          ...prev,
                          [mod.id]: e.target.value,
                        }))
                      }
                      className="sm:col-span-2 px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl"
                    />
                    <button
                      type="submit"
                      className="sm:col-span-2 inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-xl transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add
                    </button>
                  </form>
                </div>

                {/* 1-Click Sync Regional Additions into Core Budget & Schedule */}
                {((mod.suggested_budget_additions &&
                  mod.suggested_budget_additions.length > 0) ||
                  (mod.suggested_task_additions &&
                    mod.suggested_task_additions.length > 0)) && (
                  <div className="pt-4 border-t border-stone-100 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-[11px] text-stone-500">
                      Includes {mod.suggested_budget_additions?.length ?? 0} budget item(s) &amp;{' '}
                      {mod.suggested_task_additions?.length ?? 0} timeline task(s)
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSyncSuggestedToCore(mod)}
                      className="py-2 px-3.5 text-xs font-semibold text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 rounded-xl transition-colors"
                    >
                      + Sync to Core Budget &amp; Schedule
                    </button>
                  </div>
                )}
              </div>
            );
          }
        )}
      </div>

      {/* SECTION 1.5: GOOGLE MAPS PLATFORM INTERACTIVE VENUE & HOTEL EXPLORER */}
      <EventVenueAndHotelsMap
        event={event}
        liveHotelDeals={liveHotelDeals}
        onSelectVenueLocation={(nextLoc) => {
          setLocationInput(nextLoc);
          onUpdateEventContext({ location: nextLoc });
          void fetchLiveNearbyHotels(nextLoc);
        }}
        onLockInHotelDeal={handleLockInLiveHotelDeal}
      />

      {/* SECTION 2: LIVE ONLINE NEARBY CHEAP HOTEL FINDER (Google Search Grounding + OpenStreetMap Live Feed) */}
      <div className="bg-white border border-stone-200/80 rounded-3xl p-7 sm:p-8 shadow-sm hover:shadow-md transition-shadow duration-200 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
              <Globe className="w-4 h-4" />
              <span>Nearby Hotel Finder · Sorted by Lowest Nightly Price</span>
            </div>
            <h3 className="text-xl font-bold text-stone-900">
              Nearby Budget-Friendly Hotels Around {event.location.split('—')[0].trim()}
            </h3>
            <p className="text-xs text-stone-500 leading-relaxed">
              Estimated group rates for affordable rooms near the venue (live search grounding is used when a Gemini key is configured). Always confirm the price on the booking site. Click{' '}
              <strong className="text-stone-800">Lock In Group Block</strong> on any hotel to add it to your event room blocks.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              fetchLiveNearbyHotels(locationInput);
            }}
            className="flex flex-wrap items-end gap-2.5"
          >
            <div>
              <label className="block text-[11px] font-medium text-stone-500 mb-1">
                Max Nightly Target ($)
              </label>
              <input
                type="number"
                min={40}
                max={1000}
                value={maxNightlyBudget}
                onChange={(e) => setMaxNightlyBudget(e.target.value)}
                className="w-28 px-3 py-2 text-xs font-mono bg-stone-50 border border-stone-200 rounded-xl tabular-nums"
              />
            </div>
            <button
              type="submit"
              disabled={isSearchingHotels}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 rounded-xl transition-colors"
            >
              {isSearchingHotels ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Searching Online...
                </>
              ) : (
                <>
                  <Search className="w-3.5 h-3.5" />
                  Refresh Live Hotel Deals
                </>
              )}
            </button>
          </form>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
          {liveHotelDeals.map((deal) => (
            <div
              key={deal.id}
              className="border border-stone-200/90 rounded-2xl p-5 flex flex-col justify-between gap-4 hover:border-stone-300 transition-colors"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[11px] font-semibold text-emerald-700">
                    {deal.tier_label} · Save {deal.savings_pct}%
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-amber-600 tabular-nums">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                    {deal.star_rating.toFixed(1)}
                  </span>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-stone-900">
                    {deal.hotel_name}
                  </h4>
                  <p className="text-xs text-stone-500 mt-0.5">
                    {deal.neighborhood_or_address} ·{' '}
                    <span className="font-medium text-stone-700">
                      {deal.distance_from_venue}
                    </span>
                  </p>
                </div>

                <div className="flex items-baseline gap-2 pt-1">
                  <span className="text-2xl font-bold font-mono text-stone-900 tabular-nums">
                    ${deal.price_per_night}
                  </span>
                  <span className="text-xs font-mono line-through text-stone-400 tabular-nums">
                    ${deal.original_retail_price}
                  </span>
                  <span className="text-[11px] text-stone-500">/ night group rate</span>
                </div>

                <div className="text-[11px] text-stone-600 space-y-1 pt-2 border-t border-stone-100">
                  {deal.amenities.map((am, i) => (
                    <div key={i}>· {am}</div>
                  ))}
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleLockInLiveHotelDeal(deal)}
                  className="w-full py-2.5 px-3 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-xl transition-colors"
                >
                  + Lock In Cheap Group Block
                </button>
                <a
                  href={deal.booking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2 px-3 text-xs font-medium text-indigo-700 hover:underline inline-flex items-center justify-center gap-1"
                >
                  Check Live Availability Online <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ))}
        </div>

        {groundingSources.length > 0 && (
          <div className="pt-3 border-t border-stone-100 flex flex-wrap items-center gap-3 text-[11px] text-stone-400">
            <span>Verified Online Sources:</span>
            {groundingSources.map((src, i) => (
              <a
                key={i}
                href={src.uri}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:underline inline-flex items-center gap-1"
              >
                {src.title} <ExternalLink className="w-2.5 h-2.5" />
              </a>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 3: Contracted Hotel Room Blocks & Guest Accommodation Booking */}
      <div className="bg-white border border-stone-200/80 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
        <div className="p-7 sm:p-8 border-b border-stone-100 flex flex-wrap items-start justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600">
              <Hotel className="w-4 h-4" />
              <span>Reserved Event Room Blocks &amp; Shuttle Logistics</span>
            </div>
            <h3 className="text-xl font-bold text-stone-900">
              Active Hotel Room Blocks ({hotelBlocks.length})
            </h3>
            <p className="text-xs text-stone-500">
              Track guest room pickups, group discount codes, and sync room block totals to your event budget
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-right">
            <div>
              <div className="text-[11px] text-stone-400">Rooms Booked / Blocked</div>
              <div className="text-lg font-bold font-mono text-stone-900 tabular-nums">
                {totalRoomsBooked} / {totalRoomsBlocked} rooms
              </div>
            </div>
            <div>
              <div className="text-[11px] text-stone-400">Total Block Value</div>
              <div className="text-lg font-bold font-mono text-indigo-600 tabular-nums">
                ${totalHotelBlockCommitment.toLocaleString('en-US', {
                  maximumFractionDigits: 0,
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Add Hotel Room Block Form */}
        <form
          onSubmit={handleCreateHotelBlockSubmit}
          className="px-7 sm:px-8 py-5 bg-stone-50/70 border-b border-stone-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end"
        >
          <div className="lg:col-span-3">
            <label className="block text-[11px] font-medium text-stone-600 mb-1">
              Hotel / Resort Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g., Taj Lake Palace or Hampton Inn"
              value={hotelName}
              onChange={(e) => setHotelName(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-stone-200 rounded-xl"
            />
          </div>
          <div className="lg:col-span-3">
            <label className="block text-[11px] font-medium text-stone-600 mb-1">
              Room Tier / Wing
            </label>
            <input
              type="text"
              value={roomType}
              onChange={(e) => setRoomType(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-stone-200 rounded-xl"
            />
          </div>
          <div className="lg:col-span-1">
            <label className="block text-[11px] font-medium text-stone-600 mb-1">
              Nights
            </label>
            <input
              type="number"
              min={1}
              max={14}
              value={nights}
              onChange={(e) => setNights(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono bg-white border border-stone-200 rounded-xl tabular-nums"
            />
          </div>
          <div className="lg:col-span-1">
            <label className="block text-[11px] font-medium text-stone-600 mb-1">
              Blocked
            </label>
            <input
              type="number"
              min={1}
              max={500}
              value={roomsBlocked}
              onChange={(e) => setRoomsBlocked(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono bg-white border border-stone-200 rounded-xl tabular-nums"
            />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-[11px] font-medium text-stone-600 mb-1">
              Nightly Group Rate ($)
            </label>
            <input
              type="number"
              min={0}
              value={nightlyRate}
              onChange={(e) => setNightlyRate(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono bg-white border border-stone-200 rounded-xl tabular-nums"
            />
          </div>
          <div className="lg:col-span-2">
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-xl transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Hotel Block
            </button>
          </div>
        </form>

        {/* Hotel Blocks List */}
        <div className="divide-y divide-stone-100">
          {hotelBlocks.map((block) => {
            const pickupPct =
              block.rooms_blocked > 0
                ? Math.round((block.rooms_booked / block.rooms_blocked) * 100)
                : 0;
            const totalBlockCost =
              block.rooms_blocked * block.nights * block.nightly_rate;

            return (
              <div
                key={block.id}
                className="p-7 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6 hover:bg-stone-50/50 transition-colors"
              >
                <div className="space-y-2 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <BedDouble className="w-4 h-4 text-indigo-600 shrink-0" />
                    <h4 className="text-base font-bold text-stone-900">
                      {block.hotel_name}
                    </h4>
                    <span className="font-mono text-xs text-stone-500">
                      · Code: <strong className="text-stone-800">{block.group_code}</strong>
                    </span>
                  </div>

                  <div className="text-xs font-medium text-stone-700">
                    {block.room_type} —{' '}
                    <span className="font-mono text-stone-900 tabular-nums">
                      ${block.nightly_rate}/night × {block.nights} night(s)
                    </span>
                  </div>

                  <p className="text-xs text-stone-500 leading-relaxed">
                    {block.assigned_guests_notes}
                  </p>

                  <div className="flex flex-wrap items-center gap-4 pt-1 text-[11px] text-stone-500">
                    {block.shuttle_included && (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                        <Bus className="w-3.5 h-3.5" />
                        Airport &amp; Venue Shuttle Included
                      </span>
                    )}
                    <span>Status: {block.booking_status.replace('_', ' ')}</span>
                  </div>
                </div>

                <div className="flex flex-wrap sm:flex-nowrap items-center gap-5 shrink-0">
                  <div className="space-y-1.5 min-w-[160px]">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-stone-500">Room Pickup</span>
                      <span className="font-mono font-bold text-stone-900 tabular-nums">
                        {block.rooms_booked}/{block.rooms_blocked} ({pickupPct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 rounded-full transition-all"
                        style={{ width: `${Math.min(100, pickupPct)}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateHotelBookedCount(
                            block.id,
                            Math.max(0, block.rooms_booked - 1)
                          )
                        }
                        className="px-2 py-1 text-[11px] font-semibold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-lg"
                      >
                        -1 Room
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateHotelBookedCount(
                            block.id,
                            Math.min(block.rooms_blocked, block.rooms_booked + 1)
                          )
                        }
                        className="px-2.5 py-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg"
                      >
                        +1 Book Guest Room
                      </button>
                    </div>
                  </div>

                  <div className="text-right space-y-2">
                    <div>
                      <div className="text-[11px] text-stone-400">Block Subtotal</div>
                      <div className="text-base font-bold font-mono text-stone-900 tabular-nums">
                        ${totalBlockCost.toLocaleString('en-US', {
                          maximumFractionDigits: 0,
                        })}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSyncHotelBlockToBudget(block)}
                      className="py-2 px-3 text-xs font-semibold text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors whitespace-nowrap"
                    >
                      + Add Block to Budget
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 4: AI Cultural & Event-Type Re-Generator + Custom Category Creator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 bg-white border border-stone-200/80 rounded-3xl p-7 sm:p-8 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600">
            <Compass className="w-4 h-4" />
            <span>Re-Improvise Event Type &amp; Location with AI</span>
          </div>
          <h3 className="text-base font-bold text-stone-900">
            Generate Custom Tabs for Any Event Type or Country
          </h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              triggerAiGenerate();
            }}
            className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
          >
            <div className="sm:col-span-4">
              <label className="block text-[11px] font-medium text-stone-600 mb-1">
                Event Type
              </label>
              <input
                type="text"
                value={eventTypeInput}
                onChange={(e) => setEventTypeInput(e.target.value)}
                placeholder="e.g., funeral, wedding, sangeet..."
                className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl"
              />
            </div>
            <div className="sm:col-span-5">
              <label className="block text-[11px] font-medium text-stone-600 mb-1">
                Location / City
              </label>
              <input
                type="text"
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
                placeholder="e.g., Boston, MA or Udaipur, India"
                className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-[11px] font-medium text-stone-600 mb-1">
                Duration (Days)
              </label>
              <input
                type="number"
                min={1}
                max={14}
                value={daysInput}
                onChange={(e) => setDaysInput(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-stone-50 border border-stone-200 rounded-xl tabular-nums"
              />
            </div>
            <div className="sm:col-span-8">
              <input
                type="text"
                value={customAiPrompt}
                onChange={(e) => setCustomAiPrompt(e.target.value)}
                placeholder="Specific customs (e.g. who speaks first, pallbearers, 5-day Haldi/Mehendi/Sangeet)..."
                className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl"
              />
            </div>
            <div className="sm:col-span-4">
              <button
                type="submit"
                disabled={isGenerating}
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-xl transition-colors"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    AI Improvise Tabs
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        <div className="lg:col-span-5 bg-white border border-stone-200/80 rounded-3xl p-7 sm:p-8 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-stone-900">
            Create Manual Custom Tab / Category
          </h3>
          <form
            onSubmit={handleCreateCustomModuleSubmit}
            className="space-y-3"
          >
            <div>
              <label className="block text-[11px] font-medium text-stone-600 mb-1">
                Tab / Category Title
              </label>
              <input
                type="text"
                required
                placeholder="e.g., Eulogy & Speaking Order (Who Speaks First)"
                value={newCatTitle}
                onChange={(e) => setNewCatTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <select
                value={newCatType}
                onChange={(e) =>
                  setNewCatType(e.target.value as CustomModuleType)
                }
                className="px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl"
              >
                <option value="speaking_order">Speaking Order (Who First)</option>
                <option value="multi_day_itinerary">Multi-Day Schedule</option>
                <option value="cultural_rituals">Cultural / Memorial Rituals</option>
                <option value="custom_checklist">Custom Checklist</option>
              </select>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Custom Tab
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
