import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Building2,
  ClipboardCheck,
  Lightbulb,
  Trash2,
  RotateCcw,
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
  BudgetCalculationResult,
  CpmScheduleResult,
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
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastStack, ToastMessage } from './components/ToastStack';
import { ReadinessCard } from './components/ReadinessCard';
import { ExportMenu } from './components/ExportMenu';
import { VendorChecklistView } from './components/VendorChecklistView';
import { IdeaStudioView } from './components/IdeaStudioView';
import { addDaysIso, diffDays, isValidIsoDate, todayIso } from './lib/dates';
import { clearAllPlanGenieData, loadJson, saveJson } from './lib/storage';
import { postJson } from './lib/api';
import { computeReadiness } from './lib/insights';
import type { IdeaCard } from './lib/ideas';

type ActiveTab =
  | 'overview'
  | 'timeline'
  | 'budget'
  | 'forecasting'
  | 'custom_hotels'
  | 'vendors'
  | 'checklist'
  | 'ideas'
  | 'theme_rsvps'
  | 'architecture';

interface SavedWorkspace {
  events: EventRecord[];
  selectedEventId: string;
  budgetItems: BudgetItemRecord[];
  tasks: TaskRecord[];
  vendors: VendorRecord[];
  rsvps: GuestRsvpRecord[];
  moodboards: MoodboardPalette[];
  customModules: CustomEventModule[];
  hotelBlocks: HotelRoomBlockRecord[];
  auditLogs: AuditLogRecord[];
  chatMessages: AgentChatMessage[];
  checklistState: Record<string, Record<string, boolean>>;
}

const isArr = (v: unknown): v is unknown[] => Array.isArray(v);

/** Loads and structurally validates the saved workspace; null => use seed data. */
function loadWorkspace(): SavedWorkspace | null {
  const raw = loadJson<Partial<SavedWorkspace>>(
    'workspace',
    (v): v is Partial<SavedWorkspace> => !!v && typeof v === 'object'
  );
  if (!raw) return null;
  const events = isArr(raw.events)
    ? (raw.events as EventRecord[]).filter(
        (e) =>
          e &&
          typeof e.id === 'string' &&
          typeof e.title === 'string' &&
          isValidIsoDate(e.date) &&
          isValidIsoDate(e.kickoff_date) &&
          Number.isFinite(e.guest_count) &&
          Number.isFinite(e.target_budget)
      )
    : [];
  if (events.length === 0) return null;
  const list = <T,>(v: unknown, fallback: T[]): T[] => (isArr(v) ? (v as T[]) : fallback);
  const eventIds = new Set(events.map((e) => e.id));
  const kickoffOf = (id: string) => events.find((e) => e.id === id)?.kickoff_date ?? todayIso();
  const STATUSES = ['todo', 'in_progress', 'completed', 'delayed'];
  const normTasks = list<TaskRecord>(raw.tasks, [])
    .filter((t) => t && typeof t.id === 'string' && typeof t.title === 'string' && eventIds.has(t.event_id))
    .map((t) => ({
      ...t,
      category: typeof t.category === 'string' ? t.category : 'General',
      milestone_code: typeof t.milestone_code === 'string' ? t.milestone_code : 'T-30',
      assigned_to: typeof t.assigned_to === 'string' ? t.assigned_to : 'Unassigned',
      status: (STATUSES.includes(t.status) ? t.status : 'todo') as TaskRecord['status'],
      dependencies: isArr(t.dependencies) ? t.dependencies.filter((d) => typeof d === 'string') : [],
      duration_days: Number.isFinite(t.duration_days) ? t.duration_days : 1,
      buffer_days: Number.isFinite(t.buffer_days) ? t.buffer_days : 0,
      start_day_offset: Number.isFinite(t.start_day_offset) ? t.start_day_offset : 0,
      start_date: isValidIsoDate(t.start_date) ? t.start_date : kickoffOf(t.event_id),
      due_date: isValidIsoDate(t.due_date) ? t.due_date : kickoffOf(t.event_id),
      is_critical_path: Boolean(t.is_critical_path),
    }));
  const byEvent = <T extends { event_id: string }>(v: unknown): T[] =>
    list<T>(v, []).filter((x) => x && eventIds.has(x.event_id));
  return {
    events,
    selectedEventId: events.some((e) => e.id === raw.selectedEventId)
      ? (raw.selectedEventId as string)
      : events[0].id,
    budgetItems: byEvent<BudgetItemRecord>(raw.budgetItems),
    tasks: normTasks,
    vendors: byEvent<VendorRecord>(raw.vendors),
    rsvps: byEvent<GuestRsvpRecord>(raw.rsvps),
    moodboards: byEvent<MoodboardPalette>(raw.moodboards).filter((m) => isArr(m.color_Swatches)),
    customModules: byEvent<CustomEventModule>(raw.customModules).filter((m) => isArr(m.items)),
    hotelBlocks: byEvent<HotelRoomBlockRecord>(raw.hotelBlocks),
    auditLogs: byEvent<AuditLogRecord>(raw.auditLogs),
    chatMessages: byEvent<AgentChatMessage>(raw.chatMessages),
    checklistState:
      raw.checklistState && typeof raw.checklistState === 'object' ? raw.checklistState : {},
  };
}

const MOOD_PRESETS: Record<string, { archetype: string; swatches: [string, string, string][] }> = {
  wedding: { archetype: 'Timeless Romance', swatches: [['#F4E4E1', 'Blush', 'Linens & florals'], ['#8FA58A', 'Sage', 'Greenery & stationery'], ['#B88B4A', 'Antique Gold', 'Accents & candles'], ['#3E3A36', 'Charcoal', 'Signage & type']] },
  birthday: { archetype: 'Golden Hour Party', swatches: [['#F2C94C', 'Sunshine', 'Balloons & lights'], ['#E07A5F', 'Terracotta', 'Table accents'], ['#3D405B', 'Midnight', 'Backdrops'], ['#F4F1DE', 'Cream', 'Linens']] },
  community: { archetype: 'Neighbourhood Festival', swatches: [['#2A9D8F', 'Teal', 'Banners & stage'], ['#E9C46A', 'Saffron', 'Signage'], ['#F4A261', 'Apricot', 'Food stalls'], ['#264653', 'Deep Blue', 'Wayfinding']] },
  funeral: { archetype: 'Quiet Remembrance', swatches: [['#E8E4DC', 'Ivory', 'Linens'], ['#9AA5A0', 'Sage Grey', 'Florals'], ['#6B705C', 'Olive', 'Greenery'], ['#3A3A3A', 'Slate', 'Programs']] },
};

function defaultMoodboardFor(event: EventRecord): MoodboardPalette {
  const t = event.event_type.toLowerCase();
  const key = t.includes('wedding')
    ? 'wedding'
    : t.includes('birthday')
      ? 'birthday'
      : t.includes('funeral') || t.includes('memorial')
        ? 'funeral'
        : 'community';
  const preset = MOOD_PRESETS[key];
  return {
    id: `mood_default_${event.id}`,
    event_id: event.id,
    title: `${event.title} — Starter Palette`,
    style_archetype: preset.archetype,
    color_Swatches: preset.swatches.map(([hex, name, usage]) => ({ hex, name, usage })),
    decor_elements: ['Upload an inspiration image or describe your style to personalise this palette'],
    lighting_atmosphere: 'Warm, layered lighting with candles or string lights.',
    floral_botanical_notes: ['Choose seasonal blooms for best value.'],
    culinary_dietary_pairings: ['Offer vegetarian, vegan and gluten-free options by default.'],
  };
}

/** Clamp user/AI supplied numbers so the strict engines never throw in the UI. */
function sanitizeBudgetItems(items: BudgetItemRecord[]): BudgetItemRecord[] {
  const n = (v: unknown) => (Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : 0);
  return items.map((i) => ({
    ...i,
    unit_cost: n(i.unit_cost),
    quantity: n(i.quantity),
    tax_pct: n(i.tax_pct),
    contingency_pct: n(i.contingency_pct),
    actual_cost: n(i.actual_cost),
  }));
}

function emptyCpm(tasks: TaskRecord[]): CpmScheduleResult {
  return {
    tasks,
    topologicalOrder: tasks.map((t) => t.id),
    criticalPathIds: [],
    totalProjectDurationDays: 0,
    bottleneckCount: 0,
  };
}

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

  // ---- Persisted workspace (localStorage, versioned, corruption-safe) ----
  const [saved] = useState<SavedWorkspace | null>(() => loadWorkspace());
  const [events, setEvents] = useState<EventRecord[]>(
    () => saved?.events ?? SEED_EVENTS.filter((e) => e.owner_id === 'usr_primary_01')
  );
  const [selectedEventId, setSelectedEventId] = useState<string>(
    () => saved?.selectedEventId ?? 'evt_wedding_01'
  );
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [focusedCustomModuleId, setFocusedCustomModuleId] = useState<string | null>(null);

  // Right-Hand Side Panel State for GenAI Help Assistant
  const [isAiSidebarOpen, setIsAiSidebarOpen] = useState<boolean>(true);

  // Relational Module States
  const [budgetItems, setBudgetItems] = useState<BudgetItemRecord[]>(
    () => saved?.budgetItems ?? SEED_BUDGET_ITEMS
  );
  const [tasks, setTasks] = useState<TaskRecord[]>(() => saved?.tasks ?? getInitialTasks());
  const [vendors, setVendors] = useState<VendorRecord[]>(() => saved?.vendors ?? SEED_VENDORS);
  const [rsvps, setRsvps] = useState<GuestRsvpRecord[]>(() => saved?.rsvps ?? SEED_RSVPS);
  const [moodboards, setMoodboards] = useState<MoodboardPalette[]>(
    () => saved?.moodboards ?? SEED_MOODBOARDS
  );
  const [customModules, setCustomModules] = useState<CustomEventModule[]>(
    () => saved?.customModules ?? SEED_CUSTOM_MODULES
  );
  const [hotelBlocks, setHotelBlocks] = useState<HotelRoomBlockRecord[]>(
    () => saved?.hotelBlocks ?? SEED_HOTEL_BLOCKS
  );
  const [collaborators] = useState<CollaboratorRecord[]>(SEED_COLLABORATORS);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>(
    () => saved?.auditLogs ?? SEED_AUDIT_LOGS
  );
  const [chatMessages, setChatMessages] = useState<AgentChatMessage[]>(
    () => saved?.chatMessages ?? SEED_CHAT_MESSAGES
  );
  const [checklistState, setChecklistState] = useState<Record<string, Record<string, boolean>>>(
    () => saved?.checklistState ?? {}
  );

  // Always-fresh mirror of `tasks` so a batch of handlers (e.g. accepting 3 AI
  // proposals at once) never works from a stale closure and drops updates.
  const tasksRef = useRef<TaskRecord[]>(tasks);
  tasksRef.current = tasks;
  const selectedEventIdRef = useRef<string>(selectedEventId);
  selectedEventIdRef.current = selectedEventId;

  // Wall-clock "today" (refreshed on mount; no hard-coded date).
  const [today] = useState<string>(() => todayIso());

  // Toast notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const pushToast = useCallback((kind: ToastMessage['kind'], text: string) => {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-3), { id, kind, text }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }, []);
  const dismissToast = useCallback(
    (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id)),
    []
  );

  // Debounced autosave
  useEffect(() => {
    const handle = setTimeout(() => {
      saveJson('workspace', {
        events,
        selectedEventId,
        budgetItems,
        tasks,
        vendors,
        rsvps,
        moodboards,
        customModules,
        hotelBlocks,
        auditLogs: auditLogs.slice(0, 300),
        chatMessages: chatMessages.slice(-200),
        checklistState,
      } satisfies SavedWorkspace);
    }, 400);
    return () => clearTimeout(handle);
  }, [
    events,
    selectedEventId,
    budgetItems,
    tasks,
    vendors,
    rsvps,
    moodboards,
    customModules,
    hotelBlocks,
    auditLogs,
    chatMessages,
    checklistState,
  ]);

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

  // Escape closes the "new event" dialog
  useEffect(() => {
    if (!isNewEventModalOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setIsNewEventModalOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isNewEventModalOpen]);


  // New Event Modal Form State
  const [newEvtTitle, setNewEvtTitle] = useState('');
  const [newEvtType, setNewEvtType] = useState<EventType>('wedding');
  const [newEvtDate, setNewEvtDate] = useState(() => addDaysIso(todayIso(), 150));
  const [newEvtLocation, setNewEvtLocation] = useState('Napa Valley, CA');
  const [newEvtDays, setNewEvtDays] = useState('1');
  const [newEvtGuests, setNewEvtGuests] = useState('120');
  const [newEvtBudget, setNewEvtBudget] = useState('45000');
  const [newEvtCustomNotes, setNewEvtCustomNotes] = useState(
    'Include a toast speaking order, a rain-plan checklist, and cheap nearby hotels for out-of-town guests.'
  );

  const currentEvent = useMemo(
    () => events.find((e) => e.id === selectedEventId) ?? events[0],
    [events, selectedEventId]
  );
  // `events` can never be empty (deleting the last event is blocked), so this holds.

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
      defaultMoodboardFor(currentEvent),
    [moodboards, currentEvent]
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

  // 1. Deterministic Budget Engine Calculation (never throws into the UI)
  const budgetResult = useMemo<BudgetCalculationResult>(
    () =>
      calculateEventBudget(
        sanitizeBudgetItems(eventBudgetItems),
        Math.max(0, Number(currentEvent.target_budget) || 0),
        Math.max(1, Number(currentEvent.guest_count) || 1),
        Math.max(1, Number(simulatedGuests) || 1),
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

  // 2. Deterministic Critical Path Method (CPM) DAG Calculation.
  // A cyclic dependency is reported to the user instead of crashing the app.
  const { cpmResult, cpmError } = useMemo<{
    cpmResult: CpmScheduleResult;
    cpmError: string | null;
  }>(() => {
    try {
      return { cpmResult: computeCriticalPath(eventTasks, currentEvent.kickoff_date), cpmError: null };
    } catch (err) {
      return {
        cpmResult: emptyCpm(eventTasks),
        cpmError: err instanceof Error ? err.message : 'Task schedule could not be computed.',
      };
    }
  }, [eventTasks, currentEvent.kickoff_date]);

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

  const daysToEventRaw = useMemo(
    () => diffDays(today, currentEvent.date),
    [today, currentEvent.date]
  );
  const daysToEvent = Math.max(0, daysToEventRaw);

  const readiness = useMemo(
    () =>
      computeReadiness({
        event: currentEvent,
        tasks: cpmResult.tasks,
        budget: budgetResult,
        vendors: eventVendors,
        rsvps: eventRsvps,
        manualChecklist: checklistState[currentEvent.id] ?? {},
        today,
      }),
    [currentEvent, cpmResult.tasks, budgetResult, eventVendors, eventRsvps, checklistState, today]
  );

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
    const num = (v: number) => (Number.isFinite(v) ? Math.max(0, v) : 0);
    item = {
      ...item,
      unit_cost: num(item.unit_cost),
      quantity: num(item.quantity),
      tax_pct: num(item.tax_pct),
      contingency_pct: num(item.contingency_pct),
      actual_cost: num(item.actual_cost),
    };
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

  // Handlers for Schedule. They read/write through `tasksRef` so several calls
  // in the same tick (e.g. accepting multiple AI proposals) compose correctly.
  const commitEventTasks = (eventId: string, nextEventTasks: TaskRecord[]) => {
    const next = [...tasksRef.current.filter((t) => t.event_id !== eventId), ...nextEventTasks];
    tasksRef.current = next;
    setTasks(next);
  };

  const handleShiftTask = (taskId: string, deltaDays: number): boolean => {
    const current = tasksRef.current.filter((t) => t.event_id === currentEvent.id);
    const target = current.find((t) => t.id === taskId);
    if (!target) {
      pushToast('error', 'That task no longer exists, so the schedule was not changed.');
      return false;
    }
    if (!Number.isFinite(deltaDays) || deltaDays === 0) return false;
    try {
      const shifted = shiftTaskSchedule(current, taskId, deltaDays, currentEvent.kickoff_date);
      commitEventTasks(currentEvent.id, shifted.tasks);
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Could not reschedule that task.');
      return false;
    }
    appendAuditLog(
      `Rescheduled "${target.title}" by ${deltaDays > 0 ? `+${deltaDays}` : deltaDays} days`,
      'DAG_SCHEDULER'
    );
    return true;
  };

  const handleToggleTaskStatus = (taskId: string, nextStatus: TaskStatus) => {
    const next = tasksRef.current.map((t) => (t.id === taskId ? { ...t, status: nextStatus } : t));
    tasksRef.current = next;
    setTasks(next);
    const title = tasksRef.current.find((t) => t.id === taskId)?.title ?? taskId;
    appendAuditLog(`Marked "${title}" as "${nextStatus}"`, 'DAG_SCHEDULER');
  };

  const handleAddTask = (
    newTask: Omit<
      TaskRecord,
      'id' | 'event_id' | 'is_critical_path' | 'start_date' | 'due_date' | 'start_day_offset'
    > & { start_day_offset?: number }
  ): boolean => {
    const current = tasksRef.current.filter((t) => t.event_id === currentEvent.id);
    const validIds = new Set(current.map((t) => t.id));
    const record: TaskRecord = {
      ...newTask,
      title: newTask.title.trim() || 'Untitled task',
      duration_days: Math.max(1, Math.round(Number(newTask.duration_days) || 1)),
      buffer_days: Math.max(0, Math.round(Number(newTask.buffer_days) || 0)),
      dependencies: (newTask.dependencies ?? []).filter((d) => validIds.has(d)),
      start_day_offset: Math.max(0, newTask.start_day_offset ?? 0),
      id: `tsk_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      event_id: currentEvent.id,
      is_critical_path: false,
      start_date: currentEvent.kickoff_date,
      due_date: currentEvent.kickoff_date,
    };
    try {
      const computed = computeCriticalPath([...current, record], currentEvent.kickoff_date);
      commitEventTasks(currentEvent.id, computed.tasks);
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Could not add that task.');
      return false;
    }
    appendAuditLog(`Scheduled new task "${record.title}"`, 'DAG_SCHEDULER');
    return true;
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
    const eventId = currentEvent.id;
    const userMsg: AgentChatMessage = {
      id: `msg_u_${Date.now()}`,
      event_id: eventId,
      role: 'user',
      content: userPrompt,
      timestamp: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, userMsg]);
    setIsOrchestrating(true);

    try {
      const res = await postJson<{
        sender_agent?: AgentChatMessage['sender_agent'];
        delegated_agents?: AgentChatMessage['delegated_agents'];
        content?: string;
        checkpoint_id?: string;
        proposed_actions?: ProposedToolAction[];
      }>('/api/agents/orchestrate', {
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
          status: t.status,
          due_date: t.due_date,
          early_start: t.early_start,
          early_finish: t.early_finish,
          is_critical_path: t.is_critical_path,
        })),
        vendorsSummary: eventVendors.map((v) => ({
          name: v.name,
          service_type: v.service_type,
          total_true_cost: v.parsed_terms?.total_true_cost,
        })),
      });

      let assistantMsg: AgentChatMessage;
      if (res.ok && res.data) {
        const data = res.data;
        const actions = Array.isArray(data.proposed_actions) ? data.proposed_actions : [];
        assistantMsg = {
          id: `msg_a_${Date.now()}`,
          event_id: eventId,
          role: 'assistant',
          sender_agent: data.sender_agent || 'Supervisor Agent',
          delegated_agents: data.delegated_agents || ['Supervisor Agent'],
          content: data.content || 'Proposals generated below.',
          timestamp: new Date().toISOString(),
          checkpoint_id: data.checkpoint_id,
          proposed_actions: actions,
          proposal_status: actions.length > 0 ? 'pending' : undefined,
        };
      } else {
        assistantMsg = {
          id: `msg_a_${Date.now()}`,
          event_id: eventId,
          role: 'assistant',
          sender_agent: 'Supervisor Agent',
          delegated_agents: ['Supervisor Agent'],
          content: `I couldn't reach the planning service (${
            res.ok ? 'empty response' : res.error
          }). Your plan is unchanged — please try again in a moment.`,
          timestamp: new Date().toISOString(),
        };
      }
      setChatMessages((prev) => [...prev, assistantMsg]);
    } finally {
      setIsOrchestrating(false);
    }
  };

  const handleAcceptProposal = (messageId: string, actions: ProposedToolAction[]) => {
    let applied = 0;
    let skipped = 0;
    for (const act of actions) {
      const p = (act.payload ?? {}) as Record<string, unknown>;
      if (act.tool_name === 'add_budget_item') {
        const unit = Math.max(0, Number(p.unit_cost));
        const qty = Math.max(1, Math.round(Number(p.quantity)));
        if (!Number.isFinite(unit) || unit <= 0) {
          skipped++;
          continue;
        }
        const quantity = Number.isFinite(qty) ? qty : 1;
        handleAddBudgetItem({
          category: String(p.category || 'Production & Decor'),
          name: String(p.name || act.summary),
          unit_cost: unit,
          quantity,
          tax_pct: Number.isFinite(Number(p.tax_pct)) ? Math.max(0, Number(p.tax_pct)) : 8.5,
          contingency_pct: Number.isFinite(Number(p.contingency_pct))
            ? Math.max(0, Number(p.contingency_pct))
            : 5,
          actual_cost: 0,
          is_per_guest: Boolean(p.is_per_guest),
          status: 'planned',
        });
        applied++;
      } else if (act.tool_name === 'create_task') {
        const evTasks = tasksRef.current.filter((t) => t.event_id === currentEvent.id);
        const ids = new Set(evTasks.map((t) => t.id));
        const requested = Array.isArray(p.dependencies)
          ? (p.dependencies as unknown[]).map(String).filter((d) => ids.has(d))
          : [];
        const ok = handleAddTask({
          title: String(p.title || act.summary),
          category: String(p.category || 'Operations'),
          milestone_code: String(p.milestone_code || 'T-30'),
          start_day_offset: 0,
          duration_days: Math.max(1, Number(p.duration_days) || 5),
          buffer_days: Math.max(0, Number(p.buffer_days) || 1),
          status: 'todo',
          assigned_to: String(p.assigned_to || 'Claire Vance'),
          dependencies: requested,
        });
        ok ? applied++ : skipped++;
      } else if (act.tool_name === 'shift_schedule') {
        const evTasks = tasksRef.current.filter((t) => t.event_id === currentEvent.id);
        const requestedId = String(p.target_task_id || '');
        const byTitle = evTasks.find(
          (t) => t.title.toLowerCase() === String(p.task_title || '').toLowerCase()
        );
        const target = evTasks.find((t) => t.id === requestedId) ?? byTitle ?? evTasks[0];
        const delta = Math.round(Number(p.delta_days) || 7);
        if (target && handleShiftTask(target.id, delta)) applied++;
        else skipped++;
      } else {
        // compare_vendor_quotes / parse_moodboard_palette are advisory only.
        applied++;
      }
    }

    setChatMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, proposal_status: 'accepted' } : m))
    );
    if (applied > 0) {
      appendAuditLog(
        `Applied ${applied} AI Assistant update(s)`,
        'AGENT_GRAPH',
        'Supervisor Agent'
      );
      pushToast('success', `Applied ${applied} update${applied > 1 ? 's' : ''} from the AI assistant`);
    }
    if (skipped > 0) {
      pushToast('error', `${skipped} proposal${skipped > 1 ? 's were' : ' was'} skipped (invalid or no longer applicable)`);
    }
  };

  const handleRejectProposal = (messageId: string) => {
    setChatMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, proposal_status: 'rejected' } : m))
    );
  };

  const handleUpdateRoutingConfig = async (next: ModelRoutingConfig) => {
    setRoutingConfig(next);
    const res = await postJson('/api/vault/routing', next);
    if (!res.ok) pushToast('error', `Could not save routing profile: ${res.error}`);
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
    pushToast('success', `Created "${payload.draft.title}" with custom tabs`);
    const newEvent: EventRecord = {
      id,
      owner_id: 'usr_primary_01',
      title: payload.draft.title,
      event_type: payload.draft.event_type,
      date: isValidIsoDate(payload.draft.date)
        ? payload.draft.date
        : addDaysIso(today, 150),
      kickoff_date: today,
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
        kickoffDate: today,
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
    if (!isValidIsoDate(newEvtDate)) {
      pushToast('error', 'Please choose a valid event date.');
      return;
    }
    const id = `evt_custom_${Date.now()}`;
    const guestCount = Math.min(50_000, Math.max(1, Math.round(Number(newEvtGuests)) || 100));
    const targetBudget = Math.min(1e9, Math.max(500, Number(newEvtBudget) || 25000));
    const eventDays = Math.min(14, Math.max(1, Math.round(Number(newEvtDays)) || 1));
    const evtType = newEvtType.trim() || 'community';
    if (diffDays(today, newEvtDate) < 0) {
      pushToast('info', 'That date is in the past — double-check it on the Overview.');
    }

    const newEvent: EventRecord = {
      id,
      owner_id: 'usr_primary_01',
      title: newEvtTitle.trim(),
      event_type: evtType,
      date: newEvtDate,
      kickoff_date: today,
      location: newEvtLocation.trim() || 'Venue to be decided',
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
      eventType: evtType,
      location: newEvent.location,
      eventDays,
      customNotes: newEvtCustomNotes,
    });
    const generatedHotels = generateDefaultHotelBlocks({
      eventId: id,
      eventType: evtType,
      location: newEvent.location,
      eventDate: newEvtDate,
      eventDays,
    });
    const { budgetItems: initialBudgets, tasks: initialTasks } =
      buildEventSpecificInitialBudgetAndTasks({
        eventId: id,
        eventType: evtType,
        location: newEvent.location,
        guestCount,
        targetBudget,
        eventDays,
        kickoffDate: today,
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

    pushToast('success', `Created "${newEvent.title}" — custom tabs, budget and timeline are ready.`);

    // 2. Also call the Agentic AI endpoint to enrich custom tabs in the background if available
    const res = await postJson<{
      modules?: CustomEventModule[];
      hotelBlocks?: HotelRoomBlockRecord[];
    }>('/api/agents/generate-custom-modules', {
      eventId: id,
      eventType: evtType,
      location: newEvent.location,
      eventDate: newEvtDate,
      eventDays,
      isDestination: true,
      customPrompt: newEvtCustomNotes,
    });
    if (!res.ok || !res.data) return; // deterministic modules are already in place
    const aiModules = Array.isArray(res.data.modules)
      ? res.data.modules.filter((m) => m && Array.isArray(m.items)).map((m) => ({ ...m, event_id: id }))
      : [];
    const aiHotels = Array.isArray(res.data.hotelBlocks)
      ? res.data.hotelBlocks.map((h) => ({ ...h, event_id: id }))
      : [];
    if (aiModules.length > 0) {
      setCustomModules((prev) => [...aiModules, ...prev.filter((m) => m.event_id !== id)]);
      if (selectedEventIdRef.current === id) setFocusedCustomModuleId(aiModules[0].id);
    }
    if (aiHotels.length > 0) {
      setHotelBlocks((prev) => [...aiHotels, ...prev.filter((h) => h.event_id !== id)]);
    }
  };

  const handleDeleteCurrentEvent = () => {
    if (events.length <= 1) {
      pushToast('error', 'You need at least one event. Create another before deleting this one.');
      return;
    }
    const victim = currentEvent;
    if (!window.confirm(`Delete "${victim.title}" and all of its budget, tasks, vendors and guests? This cannot be undone.`)) {
      return;
    }
    const remaining = events.filter((e) => e.id !== victim.id);
    setEvents(remaining);
    setBudgetItems((prev) => prev.filter((x) => x.event_id !== victim.id));
    setTasks((prev) => {
      const next = prev.filter((x) => x.event_id !== victim.id);
      tasksRef.current = next;
      return next;
    });
    setVendors((prev) => prev.filter((x) => x.event_id !== victim.id));
    setRsvps((prev) => prev.filter((x) => x.event_id !== victim.id));
    setMoodboards((prev) => prev.filter((x) => x.event_id !== victim.id));
    setCustomModules((prev) => prev.filter((x) => x.event_id !== victim.id));
    setHotelBlocks((prev) => prev.filter((x) => x.event_id !== victim.id));
    setChatMessages((prev) => prev.filter((x) => x.event_id !== victim.id));
    setAuditLogs((prev) => prev.filter((x) => x.event_id !== victim.id));
    setChecklistState((prev) => {
      const { [victim.id]: _removed, ...rest } = prev;
      return rest;
    });
    setSelectedEventId(remaining[0].id);
    setFocusedCustomModuleId(null);
    setActiveTab('overview');
    pushToast('info', `Deleted "${victim.title}"`);
  };

  const handleResetWorkspace = () => {
    if (!window.confirm('Reset PlanGenie to the original sample data? Your changes will be lost.')) return;
    clearAllPlanGenieData();
    window.location.reload();
  };

  const handleToggleChecklist = (key: string, next: boolean) => {
    setChecklistState((prev) => ({
      ...prev,
      [currentEvent.id]: { ...(prev[currentEvent.id] ?? {}), [key]: next },
    }));
  };

  const handleIdeaToBudget = (idea: IdeaCard) => {
    const perGuest = Math.max(1, idea.estCostPerGuest ?? 5);
    handleAddBudgetItem({
      category: idea.category === 'Food & Drink' ? 'Catering' : idea.category === 'Decor' ? 'Production & Decor' : 'Guest Experience',
      name: idea.title.slice(0, 90),
      unit_cost: perGuest,
      quantity: currentEvent.guest_count,
      tax_pct: 8,
      contingency_pct: 5,
      actual_cost: 0,
      is_per_guest: true,
      status: 'planned',
    });
    pushToast('success', `Added "${idea.title}" to the budget`);
  };

  const handleIdeaToTask = (idea: IdeaCard) => {
    const ok = handleAddTask({
      title: `Plan: ${idea.title}`.slice(0, 100),
      category: idea.category,
      milestone_code: 'T-30',
      duration_days: 3,
      buffer_days: 1,
      status: 'todo',
      assigned_to: 'Claire Vance',
      dependencies: [],
    });
    if (ok) pushToast('success', `Added "${idea.title}" to the timeline`);
  };

  const navigateTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-stone-200/80 px-4 sm:px-6 lg:px-10 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        {/* Zone 1: Brand Wordmark + Switch to Landing / AI Intake */}
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2 min-w-0">
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
        <nav className="hidden 2xl:flex items-center gap-6 text-sm font-medium text-stone-500">
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
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
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
                <span className="hidden sm:inline">Hide AI Side Panel</span><span className="sm:hidden">Hide AI</span>
              </>
            ) : (
              <>
                <PanelRightOpen className="w-4 h-4" />
                <span className="hidden sm:inline">Open AI Assistant</span><span className="sm:hidden">AI</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* EVENT CONTEXT BAR + DYNAMIC EVENT-SPECIFIC CUSTOM TABS BAR */}
      <div className="bg-white border-b border-stone-200/70 px-6 lg:px-10 py-5">
        <div className="max-w-[1440px] mx-auto space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1.5 min-w-0 max-w-full">
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
                  className="max-w-full w-full sm:w-auto px-3.5 py-2 text-sm sm:text-base font-bold text-stone-900 bg-stone-100/80 hover:bg-stone-100 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600 cursor-pointer"
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
                  {currentEvent.event_type} ({currentEvent.event_days ?? 1}d)
                </span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-stone-400" />
                  {currentEvent.location}
                </span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 font-mono text-stone-700">
                  <Calendar className="w-3.5 h-3.5 text-stone-400" />
                  {currentEvent.date} (
                  {daysToEventRaw < 0
                    ? `${Math.abs(daysToEventRaw)} days ago`
                    : daysToEventRaw === 0
                      ? 'today'
                      : `${daysToEventRaw} days away`}
                  )
                </span>
                <span aria-hidden="true">·</span>
                <span>{currentEvent.guest_count} guests</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <ExportMenu
                bundle={{
                  event: currentEvent,
                  budget: budgetResult,
                  tasks: cpmResult.tasks,
                  vendors: eventVendors,
                  rsvps: eventRsvps,
                  budgetItems: eventBudgetItems,
                }}
                onToast={pushToast}
              />
              <button
                type="button"
                onClick={handleDeleteCurrentEvent}
                aria-label="Delete this event"
                title="Delete this event"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
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

            <button
              type="button"
              onClick={() => setActiveTab('checklist')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'checklist'
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              Vendor Checklist
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ideas')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'ideas'
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              <Lightbulb className="w-3.5 h-3.5" />
              Idea Studio
            </button>
          </div>
        </div>
      </div>

      {/* WORKSPACE BODY + PERSISTENT RIGHT-HAND SIDE PANEL FOR GENAI HELP ASSISTANT */}
      <div className="flex-1 max-w-[1440px] w-full mx-auto px-6 lg:px-10 py-8 flex flex-col lg:flex-row items-start gap-7">
        {/* MAIN WORKSPACE COLUMN */}
        <main className="flex-1 min-w-0 w-full space-y-10" id="main-content">
          {cpmError && (
            <div
              role="alert"
              className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl px-5 py-3 text-xs"
            >
              <strong>Schedule needs attention:</strong> {cpmError} Remove the circular dependency to
              restore the critical-path calculation.
            </div>
          )}
          <ErrorBoundary
            label="This view"
            resetKey={`${activeTab}:${currentEvent.id}`}
            offerDataReset
            onResetData={handleResetWorkspace}
          >
          {/* VIEW 1: CLEAN BENTO BOX DASHBOARD GRID */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
              <div className="md:col-span-12">
                <ReadinessCard
                  report={readiness}
                  daysToEvent={daysToEventRaw}
                  onNavigate={(tab) => navigateTab(tab)}
                />
              </div>
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
                            {(task.due_date ?? '').slice(5)}
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

          {/* VIEW 5b: VENDOR CHECKLIST */}
          {activeTab === 'checklist' && (
            <VendorChecklistView
              event={currentEvent}
              vendors={eventVendors}
              manualDone={checklistState[currentEvent.id] ?? {}}
              today={today}
              targetBudget={currentEvent.target_budget}
              onToggle={handleToggleChecklist}
              onOpenVendors={() => setActiveTab('vendors')}
            />
          )}

          {/* VIEW 5c: IDEA STUDIO */}
          {activeTab === 'ideas' && (
            <IdeaStudioView
              event={currentEvent}
              onAddBudgetItem={handleIdeaToBudget}
              onAddTask={handleIdeaToTask}
              onToast={pushToast}
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
          </ErrorBoundary>
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
              type="button"
              onClick={handleResetWorkspace}
              className="inline-flex items-center gap-1.5 hover:text-stone-900 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset sample data
            </button>
            <button
              onClick={() => setIsSecurityModalOpen(true)}
              className="inline-flex items-center gap-1.5 hover:text-stone-900 transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Security &amp; Verification Suite
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
        <div
          className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4"
          onMouseDown={(e) => e.target === e.currentTarget && setIsNewEventModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Create a new event"
            className="bg-white border border-stone-200 rounded-3xl max-w-xl w-full max-h-[92vh] overflow-y-auto shadow-xl"
          >
            <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-stone-900">
                  Create a New Event
                </h3>
                <p className="text-xs text-stone-500">
                  Pick a preset or fill in the details — PlanGenie builds a tailored budget, timeline, custom tabs &amp; nearby hotel blocks
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
                      setNewEvtTitle("Maya's 30th Birthday Rooftop Party");
                      setNewEvtDate(addDaysIso(today, 60));
                      setNewEvtType('birthday');
                      setNewEvtLocation('Austin, TX — Downtown Rooftop Terrace');
                      setNewEvtDays('1');
                      setNewEvtGuests('60');
                      setNewEvtBudget('9000');
                      setNewEvtCustomNotes(
                        'Include a toast speaking order, surprise-video checklist, music playlist plan, and affordable hotels for out-of-town friends.'
                      );
                    }}
                    className={`px-3 py-1.5 rounded-xl font-semibold transition-colors ${
                      newEvtType === 'birthday'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                    }`}
                  >
                    Birthday Party
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewEvtTitle('Riverside Neighbourhood Block Party & Food Fair');
                      setNewEvtDate(addDaysIso(today, 90));
                      setNewEvtType('community');
                      setNewEvtLocation('Portland, OR — Riverside Park Pavilion');
                      setNewEvtDays('1');
                      setNewEvtGuests('300');
                      setNewEvtBudget('12000');
                      setNewEvtCustomNotes(
                        'Include volunteer roster, permits & insurance checklist, food-truck lineup, stage schedule and rain plan.'
                      );
                    }}
                    className={`px-3 py-1.5 rounded-xl font-semibold transition-colors ${
                      newEvtType === 'community'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                    }`}
                  >
                    Community Event
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewEvtTitle('Arthur Vance Memorial & Celebration of Life');
                      setNewEvtDate(addDaysIso(today, 21));
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
                      setNewEvtDate(addDaysIso(today, 240));
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
                      setNewEvtDate(addDaysIso(today, 180));
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
                    placeholder="wedding, birthday, community..."
                    list="event-type-options"
                    value={newEvtType}
                    onChange={(e) => setNewEvtType(e.target.value)}
                    className="w-full px-3.5 py-2 border border-stone-300 rounded-xl"
                  />
                </div>
                <datalist id="event-type-options">
                  <option value="wedding" />
                  <option value="birthday" />
                  <option value="community" />
                  <option value="corporate" />
                  <option value="cultural_festival" />
                  <option value="funeral" />
                </datalist>
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
                    min={1}
                    max={50000}
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
                    min={500}
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
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
