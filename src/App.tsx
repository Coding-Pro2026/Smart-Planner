import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Building2,
  Calendar,
  Check,
  MapPin,
  MessageSquare,
  Moon,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  ShieldCheck,
  Sparkles,
  Sun,
  Users,
  X,
} from 'lucide-react';
import {
  calculateEventBudget,
  computeCriticalPath,
  forecastEventBudgetByLinearRegression,
  shiftTaskSchedule,
} from './lib/deterministicEngine';
import {
  buildEventSpecificInitialBudgetAndTasks,
  generateContextualCustomModules,
  generateDefaultHotelBlocks,
  getInitialTasks,
  SEED_AUDIT_LOGS,
  SEED_BUDGET_ITEMS,
  SEED_CHAT_MESSAGES,
  SEED_COLLABORATORS,
  SEED_CUSTOM_MODULES,
  SEED_EVENTS,
  SEED_HOTEL_BLOCKS,
  SEED_MOODBOARDS,
  SEED_RSVPS,
  SEED_VENDORS,
} from './lib/seedData';
import {
  AgentChatMessage,
  AuditLogRecord,
  BudgetItemRecord,
  CollaboratorRecord,
  CustomEventModule,
  CustomModuleType,
  EventRecord,
  EventType,
  GuestRsvpRecord,
  HotelRoomBlockRecord,
  ModelRoutingConfig,
  MoodboardPalette,
  ProposedToolAction,
  RsvpStatus,
  TaskRecord,
  TaskStatus,
  VendorRecord,
  VendorStatus,
} from './types/domain';
import { BudgetSimulatorView } from './components/BudgetSimulatorView';
import { BudgetForecastingWidget } from './components/BudgetForecastingWidget';
import { CpmTimelineView } from './components/CpmTimelineView';
import { VendorMatrixView } from './components/VendorMatrixView';
import { ThemeAndRsvpView } from './components/ThemeAndRsvpView';
import { CustomCategoriesAndHotelsView } from './components/CustomCategoriesAndHotelsView';
import { AgentOrchestratorPanel } from './components/AgentOrchestratorPanel';
import { ArchitectureBlueprintView } from './components/ArchitectureBlueprintView';
import { SecurityAuditModal } from './components/SecurityAuditModal';
import { EntryModeAndAiIntakeView } from './components/EntryModeAndAiIntakeView';
import { ProductLandingPageView } from './components/ProductLandingPageView';
import { EventVenueAndHotelsMap } from './components/EventVenueAndHotelsMap';
import { GoogleCalendarSyncResult } from './lib/googleCalendarRsvp';

type ActiveTab =
  | 'overview'
  | 'timeline'
  | 'budget'
  | 'forecasting'
  | 'custom_hotels'
  | 'vendors'
  | 'theme_rsvps'
  | 'architecture';

export default function App() {
  // Start with the flagship Product Landing Page, with 1-click transition to AI Chat Intake, Chooser, or Direct Workspace
  const [entryMode, setEntryMode] = useState<
    'landing' | 'chooser' | 'ai_chat_intake' | 'workspace'
  >('landing');
  const [initialAiPrompt, setInitialAiPrompt] = useState<string | null>(null);

  // Light / Dark Mode Theme State (Persisted in localStorage)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('plangenie_theme') === 'dark';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('plangenie_theme', isDarkMode ? 'dark' : 'light');
    } catch {
      // Ignore storage errors
    }
  }, [isDarkMode]);

  const [events, setEvents] = useState<EventRecord[]>(() =>
    SEED_EVENTS.filter((e) => e.owner_id === 'usr_primary_01')
  );
  const [selectedEventId, setSelectedEventId] = useState<string>('evt_wedding_01');
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [focusedCustomModuleId, setFocusedCustomModuleId] = useState<string | null>(null);

  // Right-Hand Side Panel State for GenAI Help Assistant
  const [isAiSidebarOpen, setIsAiSidebarOpen] = useState<boolean>(true);

  // Relational Module States
  const [budgetItems, setBudgetItems] = useState<BudgetItemRecord[]>(SEED_BUDGET_ITEMS);
  const [tasks, setTasks] = useState<TaskRecord[]>(() => getInitialTasks());
  const [vendors, setVendors] = useState<VendorRecord[]>(SEED_VENDORS);
  const [rsvps, setRsvps] = useState<GuestRsvpRecord[]>(SEED_RSVPS);
  const [moodboards, setMoodboards] = useState<MoodboardPalette[]>(SEED_MOODBOARDS);
  const [customModules, setCustomModules] =
    useState<CustomEventModule[]>(SEED_CUSTOM_MODULES);
  const [hotelBlocks, setHotelBlocks] =
    useState<HotelRoomBlockRecord[]>(SEED_HOTEL_BLOCKS);
  const [collaborators] = useState<CollaboratorRecord[]>(SEED_COLLABORATORS);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>(SEED_AUDIT_LOGS);
  const [chatMessages, setChatMessages] = useState<AgentChatMessage[]>(SEED_CHAT_MESSAGES);

  // Interactive Budget Simulator State
  const [simulatedGuestMap, setSimulatedGuestMap] = useState<Record<string, number>>({});
  const [categoryMultipliersMap, setCategoryMultipliersMap] = useState<
    Record<string, Record<string, number>>
  >({});

  // Server Model Routing & Security Audit Modal State
  const [routingConfig, setRoutingConfig] = useState<ModelRoutingConfig>({
    fastTaskProfile: 'gemini-3.8-flash',
    reasoningVisionProfile: 'gemini-3.8-flash',
    encryptionMode: 'aes_256_gcm_vault',
    strictDeterministicMath: true,
    autoCascadeDependencies: true,
  });
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [isNewEventModalOpen, setIsNewEventModalOpen] = useState(false);
  const [isOrchestrating, setIsOrchestrating] = useState(false);

  // New Event Modal Form State
  const [newEvtTitle, setNewEvtTitle] = useState('');
  const [newEvtType, setNewEvtType] = useState<EventType>('funeral');
  const [newEvtDate, setNewEvtDate] = useState('2026-11-18');
  const [newEvtLocation, setNewEvtLocation] = useState(
    'Boston, MA — Mount Auburn Memorial Chapel'
  );
  const [newEvtDays, setNewEvtDays] = useState('1');
  const [newEvtGuests, setNewEvtGuests] = useState('120');
  const [newEvtBudget, setNewEvtBudget] = useState('14500');
  const [newEvtCustomNotes, setNewEvtCustomNotes] = useState(
    'Include eulogy speaking order (who speaks first), pallbearers & memorial service, and cheap nearby hotels.'
  );

  const currentEvent = useMemo(
    () => events.find((e) => e.id === selectedEventId) ?? events[0],
    [events, selectedEventId]
  );

  const eventBudgetItems = useMemo(
    () => budgetItems.filter((b) => b.event_id === currentEvent.id),
    [budgetItems, currentEvent.id]
  );

  const eventTasks = useMemo(
    () => tasks.filter((t) => t.event_id === currentEvent.id),
    [tasks, currentEvent.id]
  );

  const eventVendors = useMemo(
    () => vendors.filter((v) => v.event_id === currentEvent.id),
    [vendors, currentEvent.id]
  );

  const eventRsvps = useMemo(
    () => rsvps.filter((r) => r.event_id === currentEvent.id),
    [rsvps, currentEvent.id]
  );

  const eventMoodboard = useMemo(
    () =>
      moodboards.find((m) => m.event_id === currentEvent.id) ??
      moodboards[0],
    [moodboards, currentEvent.id]
  );

  const eventCollaborators = useMemo(
    () => collaborators.filter((c) => c.event_id === currentEvent.id),
    [collaborators, currentEvent.id]
  );

  const eventAuditLogs = useMemo(
    () => auditLogs.filter((a) => a.event_id === currentEvent.id),
    [auditLogs, currentEvent.id]
  );

  const eventMessages = useMemo(
    () => chatMessages.filter((m) => m.event_id === currentEvent.id),
    [chatMessages, currentEvent.id]
  );

  const eventCustomModules = useMemo(
    () => customModules.filter((m) => m.event_id === currentEvent.id),
    [customModules, currentEvent.id]
  );

  const eventHotelBlocks = useMemo(
    () => hotelBlocks.filter((h) => h.event_id === currentEvent.id),
    [hotelBlocks, currentEvent.id]
  );

  const simulatedGuests =
    simulatedGuestMap[currentEvent.id] ?? currentEvent.guest_count;
  const categoryMultipliers = categoryMultipliersMap[currentEvent.id] ?? {};

  // 1. Deterministic Budget Engine Calculation
  const budgetResult = useMemo(
    () =>
      calculateEventBudget(
        eventBudgetItems,
        currentEvent.target_budget,
        currentEvent.guest_count,
        simulatedGuests,
        categoryMultipliers
      ),
    [
      eventBudgetItems,
      currentEvent.target_budget,
      currentEvent.guest_count,
      simulatedGuests,
      categoryMultipliers,
    ]
  );

  // 2. Deterministic Critical Path Method (CPM) DAG Calculation
  const cpmResult = useMemo(
    () => computeCriticalPath(eventTasks, currentEvent.kickoff_date),
    [eventTasks, currentEvent.kickoff_date]
  );

  // 3. Linear Regression Forecast Summary
  const olsSummary = useMemo(
    () => forecastEventBudgetByLinearRegression(budgetResult, 2028, 0),
    [budgetResult]
  );

  const appendAuditLog = (
    action: string,
    module: AuditLogRecord['module'],
    actorName = 'Claire Vance',
    metadata: Record<string, unknown> = {}
  ) => {
    const newEntry: AuditLogRecord = {
      id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      event_id: currentEvent.id,
      actor_id: 'usr_primary_01',
      actor_name: actorName,
      action,
      module,
      timestamp: new Date().toISOString(),
      metadata,
    };
    setAuditLogs((prev) => [newEntry, ...prev]);
  };

  const daysToEvent = useMemo(() => {
    const now = new Date('2026-10-30T00:00:00Z');
    const target = new Date(`${currentEvent.date}T00:00:00Z`);
    return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  }, [currentEvent.date]);

  const confirmedRsvpGuests = useMemo(
    () =>
      eventRsvps
        .filter((r) => r.status === 'confirmed')
        .reduce((acc, r) => acc + r.party_size, 0),
    [eventRsvps]
  );

  const completedTasksCount = useMemo(
    () => cpmResult.tasks.filter((t) => t.status === 'completed').length,
    [cpmResult.tasks]
  );

  // Handlers for Budget
  const handleAddBudgetItem = (
    item: Omit<BudgetItemRecord, 'id' | 'event_id' | 'estimated_cost'>
  ) => {
    const base = item.unit_cost * item.quantity;
    const est =
      Math.round(base * (1 + (item.tax_pct + item.contingency_pct) / 100) * 100) / 100;
    const record: BudgetItemRecord = {
      ...item,
      id: `b_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      event_id: currentEvent.id,
      estimated_cost: est,
    };
    setBudgetItems((prev) => [...prev, record]);
    appendAuditLog(
      `Added budget line item "${item.name}" ($${est.toLocaleString()})`,
      'BUDGET'
    );
  };

  const handleDeleteBudgetItem = (id: string) => {
    const target = budgetItems.find((b) => b.id === id);
    setBudgetItems((prev) => prev.filter((b) => b.id !== id));
    if (target) {
      appendAuditLog(`Removed budget line item "${target.name}"`, 'BUDGET');
    }
  };

  const handleUpdateTargetBudget = (nextCap: number) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === currentEvent.id ? { ...e, target_budget: nextCap } : e))
    );
  };

  // Handlers for Schedule
  const handleShiftTask = (taskId: string, deltaDays: number) => {
    const target = eventTasks.find((t) => t.id === taskId);
    const shifted = shiftTaskSchedule(
      eventTasks,
      taskId,
      deltaDays,
      currentEvent.kickoff_date
    );
    setTasks((prev) => [
      ...prev.filter((t) => t.event_id !== currentEvent.id),
      ...shifted.tasks,
    ]);
    appendAuditLog(
      `Rescheduled "${target?.title ?? taskId}" by ${
        deltaDays > 0 ? `+${deltaDays}` : deltaDays
      } days`,
      'DAG_SCHEDULER'
    );
  };

  const handleToggleTaskStatus = (taskId: string, nextStatus: TaskStatus) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: nextStatus } : t))
    );
    appendAuditLog(`Marked task ${taskId} as "${nextStatus}"`, 'DAG_SCHEDULER');
  };

  const handleAddTask = (
    newTask: Omit<
      TaskRecord,
      'id' | 'event_id' | 'is_critical_path' | 'start_date' | 'due_date' | 'start_day_offset'
    > & { start_day_offset?: number }
  ) => {
    const record: TaskRecord = {
      ...newTask,
      start_day_offset: newTask.start_day_offset ?? 0,
      id: `tsk_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      event_id: currentEvent.id,
      is_critical_path: false,
      start_date: currentEvent.kickoff_date,
      due_date: currentEvent.kickoff_date,
    };
    const nextEventTasks = [...eventTasks, record];
    const computed = computeCriticalPath(nextEventTasks, currentEvent.kickoff_date);
    setTasks((prev) => [
      ...prev.filter((t) => t.event_id !== currentEvent.id),
      ...computed.tasks,
    ]);
    appendAuditLog(`Scheduled new task "${newTask.title}"`, 'DAG_SCHEDULER');
  };

  // Handlers for Vendors
  const handleAddParsedVendor = (vendor: Omit<VendorRecord, 'id' | 'event_id'>) => {
    const record: VendorRecord = {
      ...vendor,
      id: `vnd_${Date.now()}`,
      event_id: currentEvent.id,
    };
    setVendors((prev) => [record, ...prev]);
    appendAuditLog(
      `Analyzed vendor quote for ${vendor.name} ($${vendor.parsed_terms.total_true_cost.toLocaleString()})`,
      'VENDOR_OCR',
      'Vendor & Contract Agent'
    );
  };

  const handleUpdateVendorStatus = (vendorId: string, status: VendorStatus) => {
    setVendors((prev) =>
      prev.map((v) => (v.id === vendorId ? { ...v, status } : v))
    );
  };

  // Handlers for Moodboard & RSVPs
  const handleUpdateMoodboard = (palette: MoodboardPalette) => {
    setMoodboards((prev) => [
      palette,
      ...prev.filter((m) => m.event_id !== currentEvent.id),
    ]);
    appendAuditLog(
      `Updated moodboard palette "${palette.title}"`,
      'AGENT_GRAPH',
      'Theme & Ideation Agent'
    );
  };

  const handleAddRsvp = (rsvp: Omit<GuestRsvpRecord, 'id' | 'event_id'>) => {
    const record: GuestRsvpRecord = {
      ...rsvp,
      id: `rsvp_${Date.now()}`,
      event_id: currentEvent.id,
    };
    setRsvps((prev) => [record, ...prev]);
    appendAuditLog(`Logged RSVP for "${rsvp.guest_name}"`, 'RSVP');
  };

  const handleUpdateRsvpStatus = (rsvpId: string, status: RsvpStatus) => {
    setRsvps((prev) =>
      prev.map((r) => (r.id === rsvpId ? { ...r, status } : r))
    );
  };

  const handleApplyGoogleCalendarSync = (syncResult: GoogleCalendarSyncResult) => {
    setEvents((prev) =>
      prev.map((ev) =>
        ev.id === currentEvent.id
          ? {
              ...ev,
              google_calendar_event_id: syncResult.googleEventId,
              google_calendar_html_link: syncResult.htmlLink,
              google_calendar_last_synced_at: syncResult.syncedAt,
            }
          : ev
      )
    );

    setRsvps((prev) =>
      prev.map((rsvp) => {
        if (rsvp.event_id !== currentEvent.id) return rsvp;
        const normalizedEmail = rsvp.contact.trim().toLowerCase();
        const matched = syncResult.attendeeStatuses[normalizedEmail];
        if (!matched) return rsvp;
        return {
          ...rsvp,
          google_response_status: matched.responseStatus,
          status: matched.mappedStatus,
          invite_sent_at: syncResult.syncedAt,
        };
      })
    );

    appendAuditLog(
      `Synced Google Calendar RSVP statuses (${Object.keys(syncResult.attendeeStatuses).length} attendees)`,
      'RSVP'
    );
  };

  // Handlers for Custom Event Categories & Destination Hotel Room Blocks
  const handleUpdateEventContext = (updates: Partial<EventRecord>) => {
    setEvents((prev) =>
      prev.map((ev) =>
        ev.id === currentEvent.id ? { ...ev, ...updates } : ev
      )
    );
  };

  const handleReplaceCustomModulesAndHotels = (
    newModules: CustomEventModule[],
    newHotels: HotelRoomBlockRecord[]
  ) => {
    setCustomModules((prev) => [
      ...newModules,
      ...prev.filter((m) => m.event_id !== currentEvent.id),
    ]);
    setHotelBlocks((prev) => [
      ...newHotels,
      ...prev.filter((h) => h.event_id !== currentEvent.id),
    ]);
    if (newModules[0]) {
      setFocusedCustomModuleId(newModules[0].id);
    }
    appendAuditLog(
      `Generated ${newModules.length} custom regional/event categories & ${newHotels.length} hotel room blocks`,
      'AGENT_GRAPH'
    );
  };

  const handleToggleCustomItem = (moduleId: string, itemId: string) => {
    setCustomModules((prev) =>
      prev.map((m) =>
        m.id !== moduleId
          ? m
          : {
              ...m,
              items: m.items.map((it) =>
                it.id === itemId ? { ...it, completed: !it.completed } : it
              ),
            }
      )
    );
  };

  const handleMoveCustomItem = (
    moduleId: string,
    itemId: string,
    direction: 'up' | 'down'
  ) => {
    setCustomModules((prev) =>
      prev.map((m) => {
        if (m.id !== moduleId) return m;
        const idx = m.items.findIndex((it) => it.id === itemId);
        if (idx === -1) return m;
        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= m.items.length) return m;
        const copy = [...m.items];
        const [removed] = copy.splice(idx, 1);
        copy.splice(targetIdx, 0, removed);
        return {
          ...m,
          items: copy.map((it, i) => ({ ...it, order_index: i + 1 })),
        };
      })
    );
  };

  const handleAddCustomItem = (
    moduleId: string,
    item: {
      title: string;
      role_or_day: string;
      person_or_lead: string;
      notes: string;
    }
  ) => {
    setCustomModules((prev) =>
      prev.map((m) => {
        if (m.id !== moduleId) return m;
        return {
          ...m,
          items: [
            ...m.items,
            {
              id: `citem_${Date.now()}`,
              order_index: m.items.length + 1,
              title: item.title,
              role_or_day: item.role_or_day,
              person_or_lead: item.person_or_lead,
              notes: item.notes,
              completed: false,
            },
          ],
        };
      })
    );
  };

  const handleDeleteCustomItem = (moduleId: string, itemId: string) => {
    setCustomModules((prev) =>
      prev.map((m) =>
        m.id !== moduleId
          ? m
          : {
              ...m,
              items: m.items
                .filter((it) => it.id !== itemId)
                .map((it, i) => ({ ...it, order_index: i + 1 })),
            }
      )
    );
  };

  const handleAddCustomModule = (mod: {
    category_title: string;
    module_type: CustomModuleType;
    description: string;
  }) => {
    const newMod: CustomEventModule = {
      id: `cmod_manual_${Date.now()}`,
      event_id: currentEvent.id,
      category_title: mod.category_title,
      module_type: mod.module_type,
      description: mod.description,
      location_context: `${currentEvent.location} · Custom Category`,
      items: [],
    };
    setCustomModules((prev) => [newMod, ...prev]);
    setFocusedCustomModuleId(newMod.id);
  };

  const handleAddHotelBlock = (
    block: Omit<HotelRoomBlockRecord, 'id' | 'event_id'>
  ) => {
    const newBlock: HotelRoomBlockRecord = {
      ...block,
      id: `htl_${Date.now()}`,
      event_id: currentEvent.id,
    };
    setHotelBlocks((prev) => [newBlock, ...prev]);
    appendAuditLog(
      `Added hotel room block at "${block.hotel_name}" (${block.rooms_blocked} rooms)`,
      'BUDGET'
    );
  };

  const handleUpdateHotelBookedCount = (blockId: string, nextBooked: number) => {
    setHotelBlocks((prev) =>
      prev.map((b) =>
        b.id === blockId ? { ...b, rooms_booked: nextBooked } : b
      )
    );
  };

  // AI Assistant Handler (Right-Hand Side Panel)
  const handleSendOrchestratorMessage = async (userPrompt: string) => {
    const userMsg: AgentChatMessage = {
      id: `msg_u_${Date.now()}`,
      event_id: currentEvent.id,
      role: 'user',
      content: userPrompt,
      timestamp: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, userMsg]);
    setIsOrchestrating(true);

    try {
      const response = await fetch('/api/agents/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userPrompt,
          fastModel: routingConfig.fastTaskProfile,
          eventContext: currentEvent,
          budgetSummary: {
            totalProjectedSpend: budgetResult.totalProjectedSpend,
            targetBudget: budgetResult.targetBudget,
            burnRatePct: budgetResult.burnRatePct,
          },
          tasksSummary: cpmResult.tasks.map((t) => ({
            id: t.id,
            title: t.title,
            milestone_code: t.milestone_code,
            early_start: t.early_start,
            early_finish: t.early_finish,
            is_critical_path: t.is_critical_path,
          })),
          vendorsSummary: eventVendors.map((v) => ({
            name: v.name,
            service_type: v.service_type,
            total_true_cost: v.parsed_terms.total_true_cost,
          })),
        }),
      });
      const data = await response.json();

      const assistantMsg: AgentChatMessage = {
        id: `msg_a_${Date.now()}`,
        event_id: currentEvent.id,
        role: 'assistant',
        sender_agent: data.sender_agent || 'Supervisor Agent',
        delegated_agents: data.delegated_agents || ['Budget Allocator Agent'],
        content: data.content || 'Proposals generated below.',
        timestamp: new Date().toISOString(),
        checkpoint_id: data.checkpoint_id,
        proposed_actions: data.proposed_actions,
        proposal_status:
          data.proposed_actions && data.proposed_actions.length > 0 ? 'pending' : undefined,
      };

      setChatMessages((prev) => [...prev, assistantMsg]);
    } finally {
      setIsOrchestrating(false);
    }
  };

  const handleAcceptProposal = (messageId: string, actions: ProposedToolAction[]) => {
    for (const act of actions) {
      const p = act.payload;
      if (act.tool_name === 'add_budget_item') {
        handleAddBudgetItem({
          category: String(p.category || 'Production & Decor'),
          name: String(p.name || act.summary),
          unit_cost: Math.max(0, Number(p.unit_cost) || 1500),
          quantity: Math.max(1, Number(p.quantity) || 1),
          tax_pct: Math.max(0, Number(p.tax_pct) || 8.5),
          contingency_pct: Math.max(0, Number(p.contingency_pct) || 5),
          actual_cost:
            Math.max(0, Number(p.unit_cost) || 1500) * Math.max(1, Number(p.quantity) || 1),
          is_per_guest: Boolean(p.is_per_guest),
          status: 'planned',
        });
      } else if (act.tool_name === 'create_task') {
        const lastTask = cpmResult.tasks[cpmResult.tasks.length - 1];
        handleAddTask({
          title: String(p.title || act.summary),
          category: String(p.category || 'Operations'),
          milestone_code: String(p.milestone_code || 'T-30'),
          start_day_offset: 0,
          duration_days: Math.max(1, Number(p.duration_days) || 5),
          buffer_days: Math.max(0, Number(p.buffer_days) || 1),
          status: 'todo',
          assigned_to: String(p.assigned_to || 'Claire Vance'),
          dependencies: lastTask ? [lastTask.id] : [],
        });
      } else if (act.tool_name === 'shift_schedule') {
        const targetId = String(p.target_task_id || cpmResult.tasks[0]?.id || '');
        const delta = Number(p.delta_days) || 7;
        if (targetId) {
          handleShiftTask(targetId, delta);
        }
      }
    }

    setChatMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, proposal_status: 'accepted' } : m))
    );
    appendAuditLog(
      `Applied ${actions.length} AI Assistant update(s)`,
      'AGENT_GRAPH',
      'Supervisor Agent'
    );
  };

  const handleRejectProposal = (messageId: string) => {
    setChatMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, proposal_status: 'rejected' } : m))
    );
  };

  const handleUpdateRoutingConfig = async (next: ModelRoutingConfig) => {
    setRoutingConfig(next);
    await fetch('/api/vault/routing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    });
  };

  // Handler when user finishes "Plan with AI" chat and clicks "Enter Workspace with Custom Tabs"
  const handleCompleteAiEventSetup = (payload: {
    draft: {
      id: string;
      title: string;
      event_type: EventType;
      location: string;
      event_days: number;
      guest_count: number;
      target_budget: number;
      date: string;
    };
    modules: CustomEventModule[];
    hotelBlocks: HotelRoomBlockRecord[];
  }) => {
    const id = payload.draft.id || `evt_ai_${Date.now()}`;
    const newEvent: EventRecord = {
      id,
      owner_id: 'usr_primary_01',
      title: payload.draft.title,
      event_type: payload.draft.event_type,
      date: payload.draft.date || '2026-11-18',
      kickoff_date: '2026-11-01',
      location: payload.draft.location,
      guest_count: payload.draft.guest_count,
      target_budget: payload.draft.target_budget,
      currency: 'USD',
      event_days: payload.draft.event_days,
      is_destination: true,
    };

    const normalizedMods = payload.modules.map((m) => ({
      ...m,
      event_id: id,
    }));
    const normalizedHotels = payload.hotelBlocks.map((h) => ({
      ...h,
      event_id: id,
    }));

    const { budgetItems: tailoredBudgets, tasks: tailoredTasks } =
      buildEventSpecificInitialBudgetAndTasks({
        eventId: id,
        eventType: newEvent.event_type,
        location: newEvent.location,
        guestCount: newEvent.guest_count,
        targetBudget: newEvent.target_budget,
        eventDays: newEvent.event_days || 1,
      });

    setEvents((prev) => [newEvent, ...prev.filter((e) => e.id !== id)]);
    setCustomModules((prev) => [
      ...normalizedMods,
      ...prev.filter((m) => m.event_id !== id),
    ]);
    setHotelBlocks((prev) => [
      ...normalizedHotels,
      ...prev.filter((h) => h.event_id !== id),
    ]);
    setBudgetItems((prev) => [
      ...tailoredBudgets,
      ...prev.filter((b) => b.event_id !== id),
    ]);
    setTasks((prev) => [
      ...tailoredTasks,
      ...prev.filter((t) => t.event_id !== id),
    ]);

    setSelectedEventId(id);
    setFocusedCustomModuleId(normalizedMods[0]?.id ?? null);
    setActiveTab('custom_hotels');
    setEntryMode('workspace');
  };

  // Handler when user creates an event via the Manual Modal
  const handleCreateNewEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvtTitle.trim()) return;
    const id = `evt_custom_${Date.now()}`;
    const guestCount = Math.max(10, Number(newEvtGuests) || 100);
    const targetBudget = Math.max(1000, Number(newEvtBudget) || 25000);
    const eventDays = Math.max(1, Number(newEvtDays) || 1);

    const newEvent: EventRecord = {
      id,
      owner_id: 'usr_primary_01',
      title: newEvtTitle.trim(),
      event_type: newEvtType,
      date: newEvtDate,
      kickoff_date: '2026-11-01',
      location: newEvtLocation.trim() || 'Memorial Chapel & Reception Hall',
      guest_count: guestCount,
      target_budget: targetBudget,
      currency: 'USD',
      event_days: eventDays,
      is_destination: true,
    };

    setEvents((prev) => [newEvent, ...prev]);

    // 1. Immediately generate context-aware custom tabs, budget items & schedule tasks
    const generatedCustomMods = generateContextualCustomModules({
      eventId: id,
      eventType: newEvtType,
      location: newEvent.location,
      eventDays,
      customNotes: newEvtCustomNotes,
    });
    const generatedHotels = generateDefaultHotelBlocks({
      eventId: id,
      eventType: newEvtType,
      location: newEvent.location,
      eventDate: newEvtDate,
      eventDays,
    });
    const { budgetItems: initialBudgets, tasks: initialTasks } =
      buildEventSpecificInitialBudgetAndTasks({
        eventId: id,
        eventType: newEvtType,
        location: newEvent.location,
        guestCount,
        targetBudget,
        eventDays,
      });

    setCustomModules((prev) => [...generatedCustomMods, ...prev]);
    setHotelBlocks((prev) => [...generatedHotels, ...prev]);
    setBudgetItems((prev) => [...prev, ...initialBudgets]);
    setTasks((prev) => [...prev, ...initialTasks]);

    setSelectedEventId(id);
    setFocusedCustomModuleId(generatedCustomMods[0]?.id ?? null);
    setActiveTab('custom_hotels');
    setNewEvtTitle('');
    setIsNewEventModalOpen(false);

    // 2. Also call the Agentic AI endpoint to enrich custom tabs in the background if available
    try {
      const response = await fetch('/api/agents/generate-custom-modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: id,
          eventType: newEvtType,
          location: newEvent.location,
          eventDate: newEvtDate,
          eventDays,
          isDestination: true,
          customPrompt: newEvtCustomNotes,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data?.modules) && data.modules.length > 0) {
          setCustomModules((prev) => [
            ...data.modules,
            ...prev.filter((m) => m.event_id !== id),
          ]);
          setFocusedCustomModuleId(data.modules[0].id);
        }
        if (Array.isArray(data?.hotelBlocks) && data.hotelBlocks.length > 0) {
          setHotelBlocks((prev) => [
            ...data.hotelBlocks,
            ...prev.filter((h) => h.event_id !== id),
          ]);
        }
      }
    } catch {
      // Initial deterministic custom modules already populated
    }
  };

  // Render Flagship Product Landing Page with Interactive Video Reel & Animations
  if (entryMode === 'landing') {
    return (
      <ProductLandingPageView
        existingEvents={events}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode((prev) => !prev)}
        onStartWithAiChat={(prompt) => {
          if (prompt) setInitialAiPrompt(prompt);
          setEntryMode('ai_chat_intake');
        }}
        onEnterWorkspaceDirect={(evId) => {
          if (evId) {
            setSelectedEventId(evId);
            const nextMods = customModules.filter((m) => m.event_id === evId);
            setFocusedCustomModuleId(nextMods[0]?.id ?? null);
          }
          setEntryMode('workspace');
        }}
        onOpenChooser={() => setEntryMode('chooser')}
      />
    );
  }

  // Render "Plan with AI" vs "Plan Without AI" Start Screen or Standard AI Chat Intake
  if (entryMode === 'chooser' || entryMode === 'ai_chat_intake') {
    return (
      <EntryModeAndAiIntakeView
        mode={entryMode}
        existingEvents={events}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode((prev) => !prev)}
        initialPrompt={initialAiPrompt}
        onClearInitialPrompt={() => setInitialAiPrompt(null)}
        onSelectMode={(next) => setEntryMode(next)}
        onSelectExistingEventAndEnter={(evId) => {
          setSelectedEventId(evId);
          setEntryMode('workspace');
        }}
        onOpenManualNewEventModal={() => setIsNewEventModalOpen(true)}
        onCompleteAiEventSetup={handleCompleteAiEventSetup}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col pg-aurora-bg text-stone-900">
      {/* STRICT 3-ZONE TOP BAR CONTRACT */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-stone-200/80 px-6 lg:px-10 py-4 flex items-center justify-between gap-6">
        {/* Zone 1: Brand Wordmark + Switch to Landing / AI Intake */}
        <div className="flex items-center gap-3.5 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#B88B4A] via-[#C86D51] to-[#4A6B53] flex items-center justify-center text-white shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <a
            href="#overview"
            onClick={(e) => {
              e.preventDefault();
              setEntryMode('landing');
            }}
            className="text-xl font-bold tracking-tight bg-gradient-to-r from-[#8C6226] via-[#B88B4A] to-[#4A6B53] bg-clip-text text-transparent whitespace-nowrap"
          >
            PlanGenie
          </a>
          <button
            type="button"
            onClick={() => setEntryMode('landing')}
            className="px-3 py-1.5 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors whitespace-nowrap"
          >
            ← Landing Page
          </button>
          <button
            type="button"
            onClick={() => setEntryMode('chooser')}
            className="px-3 py-1.5 text-xs font-semibold text-[#4A6B53] bg-[#EDF3EE] hover:bg-[#DFECE1] rounded-xl transition-colors whitespace-nowrap"
          >
            Plan with AI / Mode Switcher
          </button>
        </div>

        {/* Zone 2: Primary Workspace Navigation Links */}
        <nav className="hidden xl:flex items-center gap-6 text-sm font-medium text-stone-500">
          <a
            href="#overview"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('overview');
            }}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'overview'
                ? 'border-indigo-600 text-stone-900 font-semibold'
                : 'border-transparent hover:text-stone-900'
            }`}
          >
            Dashboard
          </a>
          <a
            href="#custom"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('custom_hotels');
            }}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'custom_hotels'
                ? 'border-indigo-600 text-stone-900 font-semibold'
                : 'border-transparent hover:text-stone-900'
            }`}
          >
            Custom Tabs &amp; Hotels ({eventCustomModules.length})
          </a>
          <a
            href="#schedule"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('timeline');
            }}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'timeline'
                ? 'border-indigo-600 text-stone-900 font-semibold'
                : 'border-transparent hover:text-stone-900'
            }`}
          >
            Schedule
          </a>
          <a
            href="#budget"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('budget');
            }}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'budget' || activeTab === 'forecasting'
                ? 'border-indigo-600 text-stone-900 font-semibold'
                : 'border-transparent hover:text-stone-900'
            }`}
          >
            Budget &amp; Forecast
          </a>
          <a
            href="#guests"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('theme_rsvps');
            }}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'theme_rsvps' || activeTab === 'vendors'
                ? 'border-indigo-600 text-stone-900 font-semibold'
                : 'border-transparent hover:text-stone-900'
            }`}
          >
            Guests &amp; Vendors
          </a>
        </nav>

        {/* Zone 3: Action Buttons (Light/Dark Mode Toggle + New Event + Toggle Right-Hand AI Side Panel) */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsDarkMode((prev) => !prev)}
            aria-label="Toggle Dark or Light Mode"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors whitespace-nowrap"
          >
            {isDarkMode ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" />
                Light
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-indigo-600" />
                Dark
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsNewEventModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            New Event
          </button>

          <button
            type="button"
            onClick={() => setIsAiSidebarOpen((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl transition-all whitespace-nowrap shadow-xs ${
              isAiSidebarOpen
                ? 'bg-gradient-to-r from-[#4A6B53] to-[#3A5642] text-white'
                : 'bg-stone-900 text-white hover:bg-stone-800'
            }`}
          >
            {isAiSidebarOpen ? (
              <>
                <PanelRightClose className="w-4 h-4" />
                Hide AI Side Panel
              </>
            ) : (
              <>
                <PanelRightOpen className="w-4 h-4" />
                Open AI Assistant
              </>
            )}
          </button>
        </div>
      </header>

      {/* EVENT CONTEXT BAR + DYNAMIC EVENT-SPECIFIC CUSTOM TABS BAR */}
      <div className="bg-white border-b border-stone-200/70 px-6 lg:px-10 py-5">
        <div className="max-w-[1440px] mx-auto space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-3">
                <label htmlFor="event-switcher" className="sr-only">
                  Switch Event
                </label>
                <select
                  id="event-switcher"
                  value={currentEvent.id}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setSelectedEventId(nextId);
                    const nextMods = customModules.filter((m) => m.event_id === nextId);
                    setFocusedCustomModuleId(nextMods[0]?.id ?? null);
                  }}
                  className="px-3.5 py-2 text-base font-bold text-stone-900 bg-stone-100/80 hover:bg-stone-100 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600 cursor-pointer"
                >
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title} ({ev.event_type.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 text-xs text-stone-500">
                <span className="capitalize font-semibold text-indigo-700">
                  {currentEvent.event_type} ({currentEvent.event_days ?? 2}d)
                </span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-stone-400" />
                  {currentEvent.location}
                </span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 font-mono text-stone-700">
                  <Calendar className="w-3.5 h-3.5 text-stone-400" />
                  {currentEvent.date} ({daysToEvent} days away)
                </span>
                <span aria-hidden="true">·</span>
                <span>{currentEvent.guest_count} guests</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setEntryMode('ai_chat_intake')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Plan Another Event with AI Chat
              </button>
            </div>
          </div>

          {/* DYNAMIC EVENT-SPECIFIC CUSTOM TABS BAR (Improvised per Event Type & Location!) */}
          <div className="pt-3 border-t border-stone-100 flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 shrink-0 mr-1">
              Event Tabs:
            </span>

            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'overview'
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              Overview
            </button>

            {/* Dynamically Improvised Custom Category Tabs for this Event (e.g., Funeral Speaking Order, Pallbearers, 5-Day Indian Wedding) */}
            {eventCustomModules.map((mod) => {
              const isSelectedCustomTab =
                activeTab === 'custom_hotels' &&
                (focusedCustomModuleId === mod.id ||
                  (!focusedCustomModuleId && eventCustomModules[0]?.id === mod.id));
              return (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => {
                    setFocusedCustomModuleId(mod.id);
                    setActiveTab('custom_hotels');
                  }}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-colors whitespace-nowrap shrink-0 ${
                    isSelectedCustomTab
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-indigo-50/90 text-indigo-800 hover:bg-indigo-100 border border-indigo-200/60'
                  }`}
                >
                  <Sparkles className="w-3 h-3 shrink-0" />
                  {mod.category_title}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => {
                setActiveTab('custom_hotels');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/60 transition-colors whitespace-nowrap shrink-0"
            >
              <Building2 className="w-3.5 h-3.5 shrink-0" />
              Nearby Cheap Hotels ({eventHotelBlocks.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('timeline')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'timeline'
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              Schedule ({completedTasksCount}/{cpmResult.tasks.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('budget')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'budget' || activeTab === 'forecasting'
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              Budget &amp; Forecast
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('theme_rsvps')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'theme_rsvps'
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              Guests &amp; Google RSVP ({eventRsvps.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('vendors')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'vendors'
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              Vendors ({eventVendors.length})
            </button>
          </div>
        </div>
      </div>

      {/* WORKSPACE BODY + PERSISTENT RIGHT-HAND SIDE PANEL FOR GENAI HELP ASSISTANT */}
      <div className="flex-1 max-w-[1440px] w-full mx-auto px-6 lg:px-10 py-8 flex flex-col lg:flex-row items-start gap-7">
        {/* MAIN WORKSPACE COLUMN */}
        <main className="flex-1 min-w-0 w-full space-y-10">
          {/* VIEW 1: CLEAN BENTO BOX DASHBOARD GRID */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
              {/* BENTO CELL 1 (Span 7): Event-Specific Custom Tabs & Regional Protocol Spotlight */}
              <div className="md:col-span-7 bg-white border border-stone-200/80 rounded-3xl p-7 sm:p-8 flex flex-col justify-between gap-6 shadow-sm hover:shadow-lg transition-all duration-200 relative overflow-hidden">
                <div className="h-1.5 w-full bg-gradient-to-r from-[#B88B4A] via-[#C86D51] to-[#4A6B53] absolute top-0 left-0" />
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="text-xs font-bold text-[#8C6226]">
                        Improvised Event-Specific Tabs ({currentEvent.event_type.toUpperCase()})
                      </span>
                      <h2 className="text-lg font-bold text-stone-900 mt-1">
                        {eventCustomModules[0]?.category_title ||
                          'Speaking Order & Custom Event Schedule'}
                      </h2>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Tailored specifically for{' '}
                        <strong className="text-stone-800">{currentEvent.title}</strong> in{' '}
                        <strong className="text-stone-800">{currentEvent.location}</strong>.
                      </p>
                    </div>
                    <span className="font-mono text-xs font-bold text-[#4A6B53] shrink-0 tabular-nums">
                      {eventCustomModules.length} custom tabs
                    </span>
                  </div>

                  {/* Clickable Custom Module Pills */}
                  <div className="flex flex-wrap gap-2">
                    {eventCustomModules.map((mod) => (
                      <button
                        key={mod.id}
                        type="button"
                        onClick={() => {
                          setFocusedCustomModuleId(mod.id);
                          setActiveTab('custom_hotels');
                        }}
                        className="px-3 py-1.5 text-xs font-semibold text-[#4A6B53] bg-[#EDF3EE] hover:bg-[#DFECE1] rounded-xl transition-colors text-left"
                      >
                        {mod.category_title} ({mod.items.length}) →
                      </button>
                    ))}
                  </div>

                  <div className="divide-y divide-stone-100 border-t border-b border-stone-100">
                    {(eventCustomModules[0]?.items ?? []).slice(0, 4).map((item, idx) => (
                      <div
                        key={item.id}
                        className="py-2.5 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="font-mono text-[11px] font-bold text-[#8C6226] shrink-0 tabular-nums">
                            #{idx + 1}
                          </span>
                          <span className="font-medium text-stone-800 truncate">
                            {item.title}
                          </span>
                        </div>
                        <span className="font-mono text-[11px] text-stone-500 shrink-0">
                          {item.role_or_day}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('custom_hotels')}
                  className="w-full py-3 px-4 text-xs font-semibold text-white bg-gradient-to-r from-[#B88B4A] to-[#9E7336] hover:from-[#A5793B] hover:to-[#8B6229] rounded-2xl transition-all inline-flex items-center justify-center gap-1.5 shadow-xs"
                >
                  Open Custom Event Tabs &amp; Reorder Speaking Sequence{' '}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* BENTO CELL 2 (Span 5): Cheap Nearby Hotels & Group Room Blocks */}
              <div className="md:col-span-5 bg-white border border-stone-200/80 rounded-3xl p-7 sm:p-8 flex flex-col justify-between gap-6 shadow-sm hover:shadow-lg transition-all duration-200 relative overflow-hidden">
                <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 absolute top-0 left-0" />
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold text-emerald-700">
                        Live Online Hotel Deals &amp; Blocks
                      </span>
                      <h2 className="text-lg font-bold text-stone-900 mt-1">
                        Nearby Hotels in {currentEvent.location.split('—')[0].trim()}
                      </h2>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Affordable group room blocks &amp; live online hotel search
                      </p>
                    </div>
                    <span className="font-mono text-xs font-bold text-stone-900 tabular-nums">
                      {eventHotelBlocks.reduce((s, b) => s + b.rooms_booked, 0)}/
                      {eventHotelBlocks.reduce((s, b) => s + b.rooms_blocked, 0)} rms
                    </span>
                  </div>

                  <div className="divide-y divide-stone-100 border-t border-b border-stone-100">
                    {eventHotelBlocks.slice(0, 3).map((hb) => (
                      <div
                        key={hb.id}
                        className="py-3 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-stone-900 truncate">
                            {hb.hotel_name}
                          </div>
                          <div className="text-stone-500 truncate">
                            {hb.room_type} ({hb.nights} nights)
                          </div>
                        </div>
                        <div className="text-right font-mono shrink-0 tabular-nums">
                          <div className="font-bold text-stone-900">
                            ${hb.nightly_rate}/nt
                          </div>
                          <div className="text-[11px] text-emerald-700">
                            {hb.rooms_booked}/{hb.rooms_blocked} rooms
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('custom_hotels')}
                  className="w-full py-3 px-4 text-xs font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-2xl transition-all inline-flex items-center justify-center gap-1.5 shadow-xs"
                >
                  Search Cheap Nearby Hotels Online &amp; Manage Blocks{' '}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* BENTO CELL 3 (Span 4): Budget & Burn Rate */}
              <div className="md:col-span-4 bg-white border border-stone-200/80 rounded-3xl p-7 sm:p-8 flex flex-col justify-between gap-6 shadow-sm hover:shadow-lg transition-all duration-200 relative overflow-hidden">
                <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 absolute top-0 left-0" />
                <div className="space-y-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold text-amber-700">
                        Budget Overview
                      </span>
                      <h2 className="text-2xl font-bold text-stone-900 font-mono tabular-nums mt-1">
                        ${budgetResult.totalProjectedSpend.toLocaleString('en-US', {
                          maximumFractionDigits: 0,
                        })}
                      </h2>
                      <p className="text-xs text-stone-500 mt-0.5">
                        of ${currentEvent.target_budget.toLocaleString()} target budget
                      </p>
                    </div>
                    <span
                      className={`font-mono text-xs font-semibold tabular-nums ${
                        budgetResult.statusLevel === 'CRITICAL_OVER_BUDGET'
                          ? 'text-rose-600'
                          : 'text-emerald-700'
                      }`}
                    >
                      {budgetResult.burnRatePct}% used
                    </span>
                  </div>

                  <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        budgetResult.statusLevel === 'CRITICAL_OVER_BUDGET'
                          ? 'bg-gradient-to-r from-rose-500 to-orange-600'
                          : 'bg-gradient-to-r from-[#B88B4A] via-[#689F77] to-[#4A6B53]'
                      }`}
                      style={{ width: `${Math.min(100, budgetResult.burnRatePct)}%` }}
                    />
                  </div>

                  <div className="pt-4 border-t border-stone-100 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-stone-700 font-medium">
                      <span>Linear Regression Projection</span>
                      <span className="font-mono font-bold text-amber-800 tabular-nums">
                        +{olsSummary.weightedYoyGrowthPct}% / yr
                      </span>
                    </div>
                    <p className="text-stone-500 leading-relaxed">
                      Early rate lock-in saves an estimated{' '}
                      <strong className="font-mono text-emerald-700 tabular-nums">
                        ${olsSummary.totalEarlyLockInSavings.toLocaleString('en-US', {
                          maximumFractionDigits: 0,
                        })}
                      </strong>
                      .
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setActiveTab('budget')}
                    className="py-2.5 px-3 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-2xl transition-colors"
                  >
                    Line Items
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('forecasting')}
                    className="py-2.5 px-3 text-xs font-semibold text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 rounded-2xl transition-colors"
                  >
                    YoY Forecast →
                  </button>
                </div>
              </div>

              {/* BENTO CELL 4 (Span 4): Up Next on Your Schedule */}
              <div className="md:col-span-4 bg-white border border-stone-200/80 rounded-3xl p-7 sm:p-8 flex flex-col justify-between gap-6 shadow-sm hover:shadow-lg transition-all duration-200 relative overflow-hidden">
                <div className="h-1.5 w-full bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500 absolute top-0 left-0" />
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="text-xs font-bold text-indigo-600">
                        Schedule &amp; Milestones
                      </span>
                      <h2 className="text-lg font-bold text-stone-900 mt-1">
                        Next Tasks
                      </h2>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Critical path &amp; checklist
                      </p>
                    </div>
                    <span className="font-mono text-sm font-bold text-stone-900 tabular-nums">
                      {completedTasksCount}/{cpmResult.tasks.length}
                    </span>
                  </div>

                  <div className="divide-y divide-stone-100 border-t border-b border-stone-100">
                    {cpmResult.tasks.slice(0, 4).map((task) => {
                      const isDone = task.status === 'completed';
                      return (
                        <div
                          key={task.id}
                          className="py-2.5 flex items-center justify-between gap-3 text-xs"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              handleToggleTaskStatus(task.id, isDone ? 'todo' : 'completed')
                            }
                            className="flex items-center gap-2.5 text-left group min-w-0"
                          >
                            <span
                              className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                                isDone
                                  ? 'bg-emerald-600 border-emerald-600 text-white'
                                  : 'border-stone-300 group-hover:border-indigo-600'
                              }`}
                            >
                              {isDone && <Check className="w-3 h-3" />}
                            </span>
                            <span
                              className={`truncate font-medium ${
                                isDone ? 'line-through text-stone-400' : 'text-stone-800'
                              }`}
                            >
                              {task.title}
                            </span>
                          </button>
                          <span className="font-mono text-[11px] text-stone-400 shrink-0 tabular-nums">
                            {task.due_date.slice(5)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('timeline')}
                  className="w-full py-3 px-4 text-xs font-semibold text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-2xl transition-colors inline-flex items-center justify-center gap-1.5"
                >
                  Open Full Schedule <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* BENTO CELL 5 (Span 4): Guest RSVPs & Google Calendar Sync */}
              <div className="md:col-span-4 bg-white border border-stone-200/80 rounded-3xl p-7 sm:p-8 flex flex-col justify-between gap-6 shadow-sm hover:shadow-lg transition-all duration-200 relative overflow-hidden">
                <div className="h-1.5 w-full bg-gradient-to-r from-[#C86D51] via-[#D98A6C] to-[#B88B4A] absolute top-0 left-0" />
                <div className="space-y-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold text-rose-600">
                        Guests &amp; Google Calendar RSVP
                      </span>
                      <h2 className="text-2xl font-bold text-stone-900 font-mono tabular-nums mt-1">
                        {confirmedRsvpGuests}{' '}
                        <span className="text-sm font-sans font-normal text-stone-500">
                          / {currentEvent.guest_count} guests
                        </span>
                      </h2>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Confirmed RSVPs ({eventRsvps.length} households)
                      </p>
                    </div>
                    <Users className="w-4 h-4 text-rose-500 shrink-0 mt-1" />
                  </div>

                  <div className="pt-4 border-t border-stone-100 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-stone-700 truncate">
                        {eventMoodboard.title}
                      </span>
                      <span className="text-[11px] text-stone-400 shrink-0">Palette</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {eventMoodboard.color_Swatches.map((swatch) => (
                        <div key={swatch.hex} className="flex-1 space-y-1 text-center">
                          <div
                            className="h-6 w-full rounded-xl border border-stone-200/80 shadow-2xs"
                            style={{ backgroundColor: swatch.hex }}
                            title={`${swatch.name} (${swatch.hex})`}
                          />
                          <div className="font-mono text-[10px] text-stone-400">
                            {swatch.hex}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('theme_rsvps')}
                  className="w-full py-3 px-4 text-xs font-semibold text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-2xl transition-colors inline-flex items-center justify-center gap-1.5"
                >
                  {currentEvent.google_calendar_event_id
                    ? 'Sync Google Calendar RSVPs'
                    : 'Send Google Calendar Email RSVPs'}{' '}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* BENTO CELL 6 (Span 12): Interactive Google Maps Platform Venue & Hotel Explorer */}
              <div className="md:col-span-12">
                <EventVenueAndHotelsMap
                  event={currentEvent}
                  liveHotelDeals={eventHotelBlocks.map((hb, idx) => ({
                    id: hb.id,
                    hotel_name: hb.hotel_name,
                    neighborhood_or_address: currentEvent.location.split('—')[0].trim(),
                    distance_from_venue: hb.shuttle_included
                      ? '0.8 mi · Shuttle included'
                      : '1.2 mi from venue',
                    star_rating: 4.5 - (idx % 2) * 0.2,
                    price_per_night: hb.nightly_rate,
                    original_retail_price: Math.round(hb.nightly_rate * 1.25),
                    savings_pct: 20,
                    tier_label: 'Group Block Favorite' as const,
                    amenities: [hb.room_type, `Code: ${hb.group_code}`],
                    booking_url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      `${hb.hotel_name} ${currentEvent.location}`
                    )}`,
                    source_label: 'Event Room Block',
                  }))}
                  onSelectVenueLocation={(nextLoc) =>
                    handleUpdateEventContext({ location: nextLoc })
                  }
                />
              </div>

              {/* BENTO CELL 7 (Span 12): Full-Width Linear Regression Budget Forecasting Widget */}
              <div className="md:col-span-12">
                <BudgetForecastingWidget
                  event={currentEvent}
                  budgetResult={budgetResult}
                  onApplyEscalationReserve={handleAddBudgetItem}
                />
              </div>
            </div>
          )}

          {/* VIEW 2: SCHEDULE & TIMELINE */}
          {activeTab === 'timeline' && (
            <CpmTimelineView
              event={currentEvent}
              cpmResult={cpmResult}
              onShiftTask={handleShiftTask}
              onToggleTaskStatus={handleToggleTaskStatus}
              onAddTask={handleAddTask}
            />
          )}

          {/* VIEW 3: BUDGET & FORECAST */}
          {(activeTab === 'budget' || activeTab === 'forecasting') && (
            <BudgetSimulatorView
              key={activeTab}
              event={currentEvent}
              budgetResult={budgetResult}
              simulatedGuests={simulatedGuests}
              onSimulatedGuestsChange={(g) =>
                setSimulatedGuestMap((prev) => ({ ...prev, [currentEvent.id]: g }))
              }
              categoryMultipliers={categoryMultipliers}
              onCategoryMultiplierChange={(cat, mult) =>
                setCategoryMultipliersMap((prev) => ({
                  ...prev,
                  [currentEvent.id]: {
                    ...(prev[currentEvent.id] ?? {}),
                    [cat]: mult,
                  },
                }))
              }
              onResetSimulation={() => {
                setSimulatedGuestMap((prev) => ({
                  ...prev,
                  [currentEvent.id]: currentEvent.guest_count,
                }));
                setCategoryMultipliersMap((prev) => ({
                  ...prev,
                  [currentEvent.id]: {},
                }));
              }}
              onAddBudgetItem={handleAddBudgetItem}
              onDeleteBudgetItem={handleDeleteBudgetItem}
              onUpdateTargetBudget={handleUpdateTargetBudget}
              initialSubView={activeTab === 'forecasting' ? 'forecast' : 'current'}
            />
          )}

          {/* VIEW 4: CUSTOM EVENT CATEGORIES & DESTINATION HOTEL BOOKING */}
          {activeTab === 'custom_hotels' && (
            <CustomCategoriesAndHotelsView
              event={currentEvent}
              customModules={eventCustomModules}
              hotelBlocks={eventHotelBlocks}
              focusedModuleId={focusedCustomModuleId}
              onSelectFocusedModule={(id) => setFocusedCustomModuleId(id)}
              onUpdateEventContext={handleUpdateEventContext}
              onReplaceCustomModulesAndHotels={handleReplaceCustomModulesAndHotels}
              onToggleCustomItem={handleToggleCustomItem}
              onMoveCustomItem={handleMoveCustomItem}
              onAddCustomItem={handleAddCustomItem}
              onDeleteCustomItem={handleDeleteCustomItem}
              onAddCustomModule={handleAddCustomModule}
              onAddHotelBlock={handleAddHotelBlock}
              onUpdateHotelBookedCount={handleUpdateHotelBookedCount}
              onAddBudgetItem={handleAddBudgetItem}
              onAddTask={handleAddTask}
            />
          )}

          {/* VIEW 5: VENDORS & QUOTES */}
          {activeTab === 'vendors' && (
            <VendorMatrixView
              event={currentEvent}
              vendors={eventVendors}
              onAddParsedVendor={handleAddParsedVendor}
              onUpdateVendorStatus={handleUpdateVendorStatus}
            />
          )}

          {/* VIEW 6: GUESTS & THEME */}
          {activeTab === 'theme_rsvps' && (
            <ThemeAndRsvpView
              event={currentEvent}
              moodboard={eventMoodboard}
              onUpdateMoodboard={handleUpdateMoodboard}
              rsvps={eventRsvps}
              onAddRsvp={handleAddRsvp}
              onUpdateRsvpStatus={handleUpdateRsvpStatus}
              onApplyGoogleCalendarSync={handleApplyGoogleCalendarSync}
              collaborators={eventCollaborators}
              auditLogs={eventAuditLogs}
            />
          )}

          {/* VIEW 7: SYSTEM ARCHITECTURE */}
          {activeTab === 'architecture' && (
            <ArchitectureBlueprintView
              event={currentEvent}
              budgetResult={budgetResult}
              cpmResult={cpmResult}
              onNavigateTab={(tab) => setActiveTab(tab)}
              onOpenSecurityModal={() => setIsSecurityModalOpen(true)}
            />
          )}
        </main>

        {/* PERSISTENT RIGHT-HAND SIDE PANEL FOR GENAI HELP ASSISTANT */}
        {isAiSidebarOpen && (
          <aside className="w-full lg:w-[390px] xl:w-[420px] shrink-0 lg:sticky lg:top-24">
            <AgentOrchestratorPanel
              event={currentEvent}
              messages={eventMessages}
              budgetItems={eventBudgetItems}
              tasks={cpmResult.tasks}
              vendors={eventVendors}
              fastModel={routingConfig.fastTaskProfile}
              onSendMessage={handleSendOrchestratorMessage}
              onAcceptProposal={handleAcceptProposal}
              onRejectProposal={handleRejectProposal}
              isOrchestrating={isOrchestrating}
            />
          </aside>
        )}
      </div>

      {/* QUIET FOOTER WITH OPTIONAL ARCHITECTURE & SECURITY LINKS */}
      <footer className="bg-white border-t border-stone-200/80 px-6 lg:px-10 py-5 mt-12">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-4 text-xs text-stone-500">
          <div>PlanGenie — Smart Event Planning, Custom Cultural Tabs &amp; Live Hotel Deals</div>
          <div className="flex items-center gap-6">
            <button
              onClick={() => setActiveTab('architecture')}
              className="hover:text-stone-900 transition-colors"
            >
              How PlanGenie Works (Architecture)
            </button>
            <button
              onClick={() => setIsSecurityModalOpen(true)}
              className="inline-flex items-center gap-1.5 hover:text-stone-900 transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Security &amp; Verification Suite (9/9 Passed)
            </button>
          </div>
        </div>
      </footer>

      {/* SECURITY AUDIT MODAL */}
      <SecurityAuditModal
        isOpen={isSecurityModalOpen}
        onClose={() => setIsSecurityModalOpen(false)}
        routingConfig={routingConfig}
        onUpdateRoutingConfig={handleUpdateRoutingConfig}
      />

      {/* CREATE NEW EVENT MODAL (Supports Funeral, 5-Day Indian Wedding, USA Wedding, Birthday, or Any Custom Event Type) */}
      {isNewEventModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-3xl max-w-xl w-full overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-stone-900">
                  Create Event &amp; Improvise Custom Tabs
                </h3>
                <p className="text-xs text-stone-500">
                  Automatically builds custom tabs (e.g., Funeral Speaking Order, 5-Day Indian Wedding Rituals) &amp; nearby hotel blocks
                </p>
              </div>
              <button
                onClick={() => setIsNewEventModalOpen(false)}
                className="p-1 text-stone-400 hover:text-stone-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNewEvent} className="p-6 space-y-4 text-xs">
              {/* Quick Event Type Presets */}
              <div className="space-y-1.5">
                <span className="block font-medium text-stone-700">
                  Quick Event Template Preset:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setNewEvtTitle('Arthur Vance Memorial & Celebration of Life');
                      setNewEvtType('funeral');
                      setNewEvtLocation('Boston, MA — Mount Auburn Memorial Chapel');
                      setNewEvtDays('1');
                      setNewEvtGuests('120');
                      setNewEvtBudget('14500');
                      setNewEvtCustomNotes(
                        'Include Eulogy & Speaking Order (Who Speaks First), Pallbearers & Memorial Service, and bereavement hotel blocks.'
                      );
                    }}
                    className={`px-3 py-1.5 rounded-xl font-semibold transition-colors ${
                      newEvtType === 'funeral'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                    }`}
                  >
                    Funeral / Memorial Service
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewEvtTitle('Aarav & Diya 5-Day Udaipur Palace Wedding');
                      setNewEvtType('wedding');
                      setNewEvtLocation('Udaipur, Rajasthan, India — Taj Lake Palace');
                      setNewEvtDays('5');
                      setNewEvtGuests('220');
                      setNewEvtBudget('85000');
                      setNewEvtCustomNotes(
                        'Include 5-Day Indian Wedding rituals (Haldi, Mehendi, Sangeet, Baraat, Pheras), Sangeet speaking order, and cheap nearby Udaipur hotels.'
                      );
                    }}
                    className={`px-3 py-1.5 rounded-xl font-semibold transition-colors ${
                      newEvtType === 'wedding' && Number(newEvtDays) >= 4
                        ? 'bg-indigo-600 text-white'
                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                    }`}
                  >
                    5-Day Indian Destination Wedding
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewEvtTitle("Sophia & Liam's Sonoma Vineyard Wedding");
                      setNewEvtType('wedding');
                      setNewEvtLocation('Sonoma Valley, CA, USA');
                      setNewEvtDays('2');
                      setNewEvtGuests('150');
                      setNewEvtBudget('55000');
                      setNewEvtCustomNotes(
                        'Include 2-Day USA wedding weekend schedule, reception toast speaking order (who speaks first), and Sonoma hotel room blocks.'
                      );
                    }}
                    className={`px-3 py-1.5 rounded-xl font-semibold transition-colors ${
                      newEvtType === 'wedding' && Number(newEvtDays) <= 3
                        ? 'bg-indigo-600 text-white'
                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                    }`}
                  >
                    2-Day USA Wedding
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1.5">
                  Event Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Arthur Vance Memorial Service or 5-Day Udaipur Wedding"
                  value={newEvtTitle}
                  onChange={(e) => setNewEvtTitle(e.target.value)}
                  className="w-full px-3.5 py-2 border border-stone-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1.5">
                    Event Type (Any)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="funeral, wedding, birthday..."
                    value={newEvtType}
                    onChange={(e) => setNewEvtType(e.target.value)}
                    className="w-full px-3.5 py-2 border border-stone-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1.5">
                    Duration (Days)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={14}
                    value={newEvtDays}
                    onChange={(e) => setNewEvtDays(e.target.value)}
                    className="w-full px-3.5 py-2 border border-stone-300 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1.5">
                    Event Date
                  </label>
                  <input
                    type="date"
                    value={newEvtDate}
                    onChange={(e) => setNewEvtDate(e.target.value)}
                    className="w-full px-3.5 py-2 border border-stone-300 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1.5">
                  City / Location / Venue
                </label>
                <input
                  type="text"
                  value={newEvtLocation}
                  onChange={(e) => setNewEvtLocation(e.target.value)}
                  className="w-full px-3.5 py-2 border border-stone-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-stone-700 mb-1.5">
                    Expected Guests
                  </label>
                  <input
                    type="number"
                    min={10}
                    value={newEvtGuests}
                    onChange={(e) => setNewEvtGuests(e.target.value)}
                    className="w-full px-3.5 py-2 border border-stone-300 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1.5">
                    Target Budget ($)
                  </label>
                  <input
                    type="number"
                    min={1000}
                    step={500}
                    value={newEvtBudget}
                    onChange={(e) => setNewEvtBudget(e.target.value)}
                    className="w-full px-3.5 py-2 border border-stone-300 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1.5">
                  Custom Tabs &amp; Specific Requirements for AI to Improvise
                </label>
                <textarea
                  rows={2}
                  value={newEvtCustomNotes}
                  onChange={(e) => setNewEvtCustomNotes(e.target.value)}
                  placeholder="e.g., Who speaks first in the eulogy, pallbearers list, 5-day Indian ceremonies, cheap hotels nearby..."
                  className="w-full px-3.5 py-2 border border-stone-300 rounded-xl"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewEventModalOpen(false)}
                  className="px-4 py-2 font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-5 py-2 font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Create Event &amp; Improvise Custom Tabs
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
