import { postJson } from '../lib/api';
import { Backdrop } from './design/Backdrop';
import { parseIntake } from '../lib/intakeParser';
import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  LayoutGrid,
  Loader2,
  MapPin,
  MessageSquare,
  Moon,
  Send,
  Sparkles,
  Sun,
  Users,
} from 'lucide-react';
import {
  CustomEventModule,
  EventRecord,
  EventType,
  HotelRoomBlockRecord,
} from '../types/domain';
import {
  generateContextualCustomModules,
  generateDefaultHotelBlocks,
} from '../lib/seedData';

interface IntakeChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface DraftEventBlueprint {
  id: string;
  title: string;
  event_type: EventType;
  location: string;
  event_days: number;
  guest_count: number;
  target_budget: number;
  date: string;
}

interface EntryModeAndAiIntakeViewProps {
  mode: 'chooser' | 'ai_chat_intake';
  existingEvents: EventRecord[];
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  initialPrompt?: string | null;
  onClearInitialPrompt?: () => void;
  onSelectMode: (
    nextMode: 'landing' | 'chooser' | 'ai_chat_intake' | 'workspace'
  ) => void;
  onSelectExistingEventAndEnter: (eventId: string) => void;
  onOpenManualNewEventModal: () => void;
  onCompleteAiEventSetup: (payload: {
    draft: DraftEventBlueprint;
    modules: CustomEventModule[];
    hotelBlocks: HotelRoomBlockRecord[];
  }) => void;
}

const QUICK_AI_PROMPTS = [
  {
    label: 'Funeral / Memorial Service (Boston)',
    prompt:
      "We are planning my grandfather Arthur's Funeral & Celebration of Life in Boston, MA on 2026-11-18 for 120 guests with a $14,500 budget. We need custom tabs for Who Speaks First (eulogy speaking order), pallbearers & memorial service, and cheap nearby hotels for out-of-town family.",
  },
  {
    label: '5-Day Indian Destination Wedding (Udaipur)',
    prompt:
      'Plan a 5-day Indian destination wedding in Udaipur, Rajasthan, India for 220 guests with an $85,000 budget. Include custom tabs for the 5-day ceremony rituals (Haldi, Mehendi, Sangeet, Baraat, Pheras), Sangeet speaking/performance order, and affordable nearby hotel blocks.',
  },
  {
    label: '2-Day USA Vineyard Wedding (Sonoma)',
    prompt:
      'Plan a 2-day vineyard wedding in Sonoma Valley, CA, USA for 150 guests with a $55,000 budget. Create custom tabs for the 2-day wedding weekend schedule, reception toast speaking order (who speaks first), and cheap nearby hotel room blocks.',
  },
];

export const EntryModeAndAiIntakeView: React.FC<EntryModeAndAiIntakeViewProps> = ({
  mode,
  existingEvents,
  isDarkMode,
  onToggleDarkMode,
  initialPrompt,
  onClearInitialPrompt,
  onSelectMode,
  onSelectExistingEventAndEnter,
  onOpenManualNewEventModal,
  onCompleteAiEventSetup,
}) => {
  const [messages, setMessages] = useState<IntakeChatMessage[]>([
    {
      id: 'welcome_ai_1',
      role: 'assistant',
      content:
        "Welcome to PlanGenie! Tell me about the event you want to plan — such as the event name, type (e.g., Funeral / Memorial, 5-Day Indian Wedding, 2-Day USA Wedding, Birthday, Corporate Summit), city/location, guest count, and any special needs like 'Who Speaks First' or nearby cheap hotels.\n\nI will dynamically improvise custom tabs, budget items, schedule milestones, and nearby hotel blocks tailored to your exact event.",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  const [blueprint, setBlueprint] = useState<DraftEventBlueprint | null>(null);
  const [improvisedModules, setImprovisedModules] = useState<CustomEventModule[]>([]);
  const [improvisedHotels, setImprovisedHotels] = useState<HotelRoomBlockRecord[]>([]);

  useEffect(() => {
    if (mode === 'ai_chat_intake' && initialPrompt && initialPrompt.trim()) {
      const promptToRun = initialPrompt;
      onClearInitialPrompt?.();
      handleSendChatMessage(promptToRun);
    }
  }, [mode, initialPrompt]);

  const handleSendChatMessage = async (textToUse?: string) => {
    const raw = (textToUse ?? inputPrompt).trim();
    if (!raw || isThinking) return;

    const userMsg: IntakeChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: raw,
      timestamp: new Date().toISOString(),
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    if (!textToUse) setInputPrompt('');
    setIsThinking(true);

    try {
      const res = await postJson<{
        assistantReply?: string;
        eventDraft?: DraftEventBlueprint;
        modules?: CustomEventModule[];
        hotelBlocks?: HotelRoomBlockRecord[];
      }>(
        '/api/agents/ai-intake-chat',
        {
          message: raw,
          conversationHistory: nextHistory.slice(-12).map((m) => ({
            role: m.role,
            content: m.content,
          })),
          currentDraft: blueprint || {},
        },
        { timeoutMs: 40_000 }
      );

      if (!res.ok || !res.data?.eventDraft) {
        throw new Error(res.ok ? 'empty response' : res.error);
      }
      const data = res.data;
      setBlueprint(data.eventDraft!);
      if (Array.isArray(data.modules)) setImprovisedModules(data.modules);
      if (Array.isArray(data.hotelBlocks)) setImprovisedHotels(data.hotelBlocks);

      const aiMsg: IntakeChatMessage = {
        id: `a_${Date.now()}`,
        role: 'assistant',
        content:
          data.assistantReply ||
          'I have updated your event blueprint and improvised custom tabs on the right. Click "Enter Workspace with Custom Tabs" whenever you are ready!',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      // Server unreachable: run the same parser locally so the flow never dead-ends.
      const parsed = parseIntake(raw, blueprint ?? {});
      const draft: DraftEventBlueprint = {
        id: parsed.id,
        title: parsed.title,
        event_type: parsed.event_type,
        location: parsed.location,
        event_days: parsed.event_days,
        guest_count: parsed.guest_count,
        target_budget: parsed.target_budget,
        date: parsed.date,
      };

      const mods = generateContextualCustomModules({
        eventId: draft.id,
        eventType: draft.event_type,
        location: draft.location,
        eventDays: draft.event_days,
        customNotes: raw,
      });
      const hotels = generateDefaultHotelBlocks({
        eventId: draft.id,
        eventType: draft.event_type,
        location: draft.location,
        eventDate: draft.date,
        eventDays: draft.event_days,
      });

      setBlueprint(draft);
      setImprovisedModules(mods);
      setImprovisedHotels(hotels);

      setMessages((prev) => [
        ...prev,
        {
          id: `a_fallback_${Date.now()}`,
          role: 'assistant',
          content: `I have prepared "${draft.title}" (${draft.event_type}, ${draft.event_days}d in ${draft.location}, ${draft.guest_count} guests, $${draft.target_budget.toLocaleString()}, on ${draft.date}) with ${mods.length} custom tabs (${mods
            .map((m) => m.category_title)
            .join(', ')}) and ${hotels.length} hotel blocks. Click "Enter Workspace with Custom Tabs" to continue!`,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  // MODE 1: START SCREEN CHOOSER ("Plan with AI" vs "Plan Without AI")
  if (mode === 'chooser') {
    return (
      <div className="min-h-screen pg-grain relative text-stone-900 flex flex-col justify-between">
        <Backdrop variant="workspace" />
        {/* Clean Warm Header with Light/Dark Mode Toggle */}
        <header className="bg-[#FAF6EC]/95 backdrop-blur-md border-b border-stone-200/80 px-4 sm:px-6 lg:px-10 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onSelectMode('landing')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 transition-colors mr-1"
            >
              <ArrowLeft className="w-4 h-4" />
              Landing Page
            </button>
            <div className="w-9 h-9 rounded-xl bg-[#B88B4A] flex items-center justify-center text-white shadow-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-tight text-stone-900">
                PlanGenie
              </span>
              <span className="hidden sm:inline-block text-xs text-stone-400 mx-2">·</span>
              <span className="hidden sm:inline-block text-xs font-medium text-stone-600">
                Event planning, arranged
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onToggleDarkMode}
              aria-label="Toggle Dark or Light Mode"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-stone-700 bg-stone-200/70 hover:bg-stone-200 rounded-xl transition-colors"
            >
              {isDarkMode ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400" />
                  Light Mode
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-stone-700" />
                  Dark Mode
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => onSelectMode('workspace')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#4A6B53] hover:bg-[#3B5943] rounded-full transition-all shadow-xs"
            >
              Go to Existing Workspace <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        {/* Main Chooser Bento Grid */}
        <main className="max-w-[1160px] w-full mx-auto px-6 py-12 sm:py-16 space-y-10">
          <div className="max-w-2xl space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#4A6B53]">
              Welcome to PlanGenie Studio
            </span>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-stone-900 leading-tight">
              How would you like to plan your event?
            </h1>
            <p className="text-sm sm:text-base text-stone-600 leading-relaxed">
              Start in our conversational AI architect that dynamically improvises custom tabs
              for your event type and region, or open the workspace directly.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-7 items-stretch">
            {/* OPTION 1: PLAN WITH AI */}
            <div className="md:col-span-6 bg-white border-2 border-[#B88B4A]/70 rounded-3xl p-8 flex flex-col justify-between gap-8 shadow-md hover:shadow-xl transition-all relative overflow-hidden">
              <div className="h-1.5 w-full bg-gradient-to-r from-[#B88B4A] via-[#D4A86A] to-[#4A6B53] absolute top-0 left-0" />
              <div className="space-y-5">
                <div className="w-12 h-12 rounded-2xl bg-[#B88B4A] flex items-center justify-center text-white shadow-sm">
                  <Sparkles className="w-6 h-6" />
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-bold text-[#B88B4A]">
                    Recommended · Conversational AI Event Architect
                  </span>
                  <h2 className="text-2xl font-bold text-stone-900">
                    Plan with AI Assistant
                  </h2>
                  <p className="text-sm text-stone-600 leading-relaxed">
                    Start with a standard chat interface. Tell the AI your event name, type
                    (e.g., <strong>Funeral / Memorial</strong>,{' '}
                    <strong>5-Day Indian Destination Wedding</strong>,{' '}
                    <strong>2-Day USA Wedding</strong>, or <strong>Birthday</strong>), city, and
                    guest count.
                  </p>
                </div>

                <div className="pt-4 border-t border-stone-100 space-y-2.5 text-xs text-stone-600">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#B88B4A] shrink-0 mt-0.5" />
                    <span>
                      <strong>Improvises Custom Event Tabs:</strong> Automatically builds tabs
                      like <em>Who Speaks First (Eulogy Order)</em>,{' '}
                      <em>Pallbearers &amp; Processional</em>, or{' '}
                      <em>5-Day Indian Wedding Rituals</em>.
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#4A6B53] shrink-0 mt-0.5" />
                    <span>
                      <strong>Finds Nearby Hotels:</strong> Finds affordable
                      hotels near your venue and sets up room blocks.
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#C86D51] shrink-0 mt-0.5" />
                    <span>
                      <strong>Tailored Budget &amp; Schedule:</strong> Populates event-specific
                      line items and timeline tasks before entering the workspace.
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onSelectMode('ai_chat_intake')}
                className="w-full py-4 px-6 text-sm font-bold text-white bg-[#B88B4A] hover:bg-[#9E7438] rounded-full transition-all inline-flex items-center justify-center gap-2 shadow-sm"
              >
                <MessageSquare className="w-4 h-4" />
                Start Planning with AI Chat <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* OPTION 2: PLAN WITHOUT AI */}
            <div className="md:col-span-6 bg-white border border-stone-200/90 rounded-3xl p-8 flex flex-col justify-between gap-8 shadow-md hover:shadow-xl transition-all relative overflow-hidden">
              <div className="h-1.5 w-full bg-gradient-to-r from-[#4A6B53] to-[#6B9075] absolute top-0 left-0" />
              <div className="space-y-5">
                <div className="w-12 h-12 rounded-2xl bg-[#4A6B53] flex items-center justify-center text-white shadow-sm">
                  <LayoutGrid className="w-6 h-6" />
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-bold text-[#4A6B53]">
                    Direct Manual Control
                  </span>
                  <h2 className="text-2xl font-bold text-stone-900">
                    Plan Without AI (Direct Workspace)
                  </h2>
                  <p className="text-sm text-stone-600 leading-relaxed">
                    Go straight into the planning dashboard to manage schedules,
                    budgets, Google Calendar RSVPs, hotel blocks, and custom tabs manually.
                  </p>
                </div>

                <div className="pt-4 border-t border-stone-100 space-y-2">
                  <div className="text-xs font-semibold text-stone-700">
                    Jump into an Event or Create Manually:
                  </div>
                  <div className="divide-y divide-stone-100 border border-stone-200/80 rounded-2xl overflow-hidden">
                    {existingEvents.map((ev) => (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={() => onSelectExistingEventAndEnter(ev.id)}
                        className="w-full px-4 py-3 text-left hover:bg-stone-50 flex items-center justify-between gap-3 transition-colors text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-stone-900 truncate">
                            {ev.title}
                          </div>
                          <div className="text-stone-500 truncate capitalize">
                            {ev.event_type} · {ev.location}
                          </div>
                        </div>
                        <span className="font-mono text-[11px] font-semibold text-[#4A6B53] shrink-0">
                          Open →
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    onSelectMode('workspace');
                    onOpenManualNewEventModal();
                  }}
                  className="py-3.5 px-4 text-xs font-semibold text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-full transition-colors inline-flex items-center justify-center gap-1.5"
                >
                  Create Event via Form
                </button>
                <button
                  type="button"
                  onClick={() => onSelectMode('workspace')}
                  className="py-3.5 px-4 text-xs font-semibold text-white bg-[#4A6B53] hover:bg-[#3B5943] rounded-full transition-all inline-flex items-center justify-center gap-1.5 shadow-xs"
                >
                  Open Dashboard <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </main>

        <footer className="bg-[#FAF6EC]/80 backdrop-blur-md border-t border-stone-200/80 px-6 lg:px-10 py-4 text-xs text-stone-600 text-center">
          PlanGenie — Switch between AI Chat Intake, Light/Dark Mode, and the Full Event Workspace at any time.
        </footer>
      </div>
    );
  }

  // MODE 2: STANDARD CHAT INTERFACE ("Plan with AI")
  return (
    <div className="min-h-screen pg-grain relative text-stone-900 flex flex-col">
      <Backdrop variant="workspace" />
      {/* Top Bar */}
      <header className="bg-[#FAF6EC]/95 backdrop-blur-md border-b border-stone-200/80 px-4 sm:px-6 lg:px-10 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => onSelectMode('chooser')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <span className="text-stone-300">|</span>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#B88B4A] flex items-center justify-center text-white">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <span className="text-base font-bold text-stone-900">
              Plan with AI — Conversational Event Setup
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onToggleDarkMode}
            aria-label="Toggle Dark or Light Mode"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-stone-700 bg-stone-200/70 hover:bg-stone-200 rounded-xl transition-colors"
          >
            {isDarkMode ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                Light
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-stone-700" />
                Dark
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => onSelectMode('workspace')}
            className="px-3.5 py-2 text-xs font-medium text-stone-600 hover:text-stone-900 bg-stone-200/70 hover:bg-stone-200 rounded-xl transition-colors"
          >
            Skip to Workspace Without AI
          </button>

          {blueprint && (
            <button
              type="button"
              onClick={() =>
                onCompleteAiEventSetup({
                  draft: blueprint,
                  modules: improvisedModules,
                  hotelBlocks: improvisedHotels,
                })
              }
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-[#B88B4A] hover:bg-[#9E7438] rounded-full transition-all shadow-xs"
            >
              Enter Workspace with Custom Tabs ({improvisedModules.length}){' '}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* Main Split View: Standard Chat Interface (Left 7 cols) + Live Improvised Event & Custom Tabs Preview (Right 5 cols) */}
      <main className="flex-1 max-w-[1280px] w-full mx-auto px-6 lg:px-10 py-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* LEFT 7 COLUMNS: Standard Conversational Chat Interface */}
        <div className="lg:col-span-7 bg-white border border-stone-200/80 rounded-3xl flex flex-col justify-between overflow-hidden shadow-md min-h-[620px] relative">
          <div className="h-1.5 w-full bg-gradient-to-r from-[#B88B4A] via-[#D4A86A] to-[#4A6B53]" />
          {/* Chat Messages Stream */}
          <div className="p-6 sm:p-8 space-y-5 overflow-y-auto flex-1 max-h-[500px]">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div className="text-[11px] font-semibold text-stone-400 mb-1 px-1">
                  {msg.role === 'user' ? 'You' : 'PlanGenie AI Architect'}
                </div>
                <div
                  className={`max-w-[88%] rounded-2xl px-4 py-3.5 text-xs sm:text-sm leading-relaxed whitespace-pre-line ${
                    msg.role === 'user'
                      ? 'bg-[#4A6B53] text-white shadow-xs'
                      : 'bg-stone-100/90 text-stone-800 border border-stone-200/70'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {isThinking && (
              <div className="flex items-center gap-2.5 text-xs text-[#4A6B53] font-medium px-2 py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Improvising custom event tabs, speaking order &amp; nearby hotel blocks...
              </div>
            )}
          </div>

          {/* Starter Prompts & Input Bar */}
          <div className="p-5 sm:p-6 bg-stone-50/70 border-t border-stone-200/80 space-y-3">
            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold text-stone-500">
                Try an example event prompt or type your own below:
              </div>
              <div className="flex flex-wrap gap-2">
                {QUICK_AI_PROMPTS.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    disabled={isThinking}
                    onClick={() => handleSendChatMessage(item.prompt)}
                    className="px-3 py-1.5 text-xs font-medium text-[#3B5943] bg-[#EEF4EF] hover:bg-[#DFECE2] border border-[#B7D0BE] rounded-xl transition-colors text-left"
                  >
                    + {item.label}
                  </button>
                ))}
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendChatMessage();
              }}
              className="flex items-center gap-2.5"
            >
              <input
                type="text"
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                placeholder="Describe your event name, type (e.g., Funeral, 5-day Indian Wedding), city, guests, budget..."
                className="flex-1 px-4 py-3 text-xs sm:text-sm bg-white border border-stone-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#4A6B53]"
              />
              <button
                type="submit"
                disabled={isThinking || !inputPrompt.trim()}
                className="px-5 py-3 text-xs sm:text-sm font-semibold text-white bg-[#B88B4A] hover:bg-[#9E7438] disabled:opacity-50 rounded-2xl transition-all inline-flex items-center gap-1.5 shrink-0"
              >
                <Send className="w-4 h-4" />
                Send
              </button>
            </form>
          </div>
        </div>

        {/* RIGHT 5 COLUMNS: Live AI Event Blueprint & Custom Tabs Preview */}
        <div className="lg:col-span-5 bg-white border border-stone-200/80 rounded-3xl p-7 sm:p-8 flex flex-col justify-between gap-6 shadow-md relative overflow-hidden">
          <div className="h-1.5 w-full bg-gradient-to-r from-[#4A6B53] via-[#6B9075] to-[#B88B4A] absolute top-0 left-0" />
          {!blueprint ? (
            <div className="my-auto text-center space-y-4 py-12">
              <div className="w-12 h-12 rounded-2xl bg-[#B88B4A] text-white flex items-center justify-center mx-auto shadow-sm">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="space-y-1.5 max-w-xs mx-auto">
                <h2 className="text-base font-bold text-stone-900">
                  Your Custom Event Blueprint Will Appear Here
                </h2>
                <p className="text-xs text-stone-500 leading-relaxed">
                  Send a message in the chat (or click one of the example prompts) to watch
                  PlanGenie improvise custom tabs for your event type and location.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-5">
                <div>
                  <span className="text-xs font-bold text-[#4A6B53]">
                    AI-Generated Event Blueprint
                  </span>
                  <h2 className="text-xl font-bold text-stone-900 mt-1">
                    {blueprint.title}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 mt-1.5">
                    <span className="font-semibold text-stone-800 capitalize">
                      {blueprint.event_type} ({blueprint.event_days}d)
                    </span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-stone-400" />
                      {blueprint.location}
                    </span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1 font-mono">
                      <Users className="w-3.5 h-3.5 text-stone-400" />
                      {blueprint.guest_count} guests
                    </span>
                    <span>·</span>
                    <span className="font-mono font-semibold text-[#4A6B53]">
                      ${blueprint.target_budget.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Quick Editable Overrides */}
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-stone-100 text-xs">
                  <div>
                    <label className="block text-[11px] font-medium text-stone-500 mb-1">
                      Event Name
                    </label>
                    <input
                      type="text"
                      value={blueprint.title}
                      onChange={(e) =>
                        setBlueprint({ ...blueprint, title: e.target.value })
                      }
                      className="w-full px-3 py-1.5 border border-stone-200 rounded-xl font-medium text-stone-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-stone-500 mb-1">
                      Event Type
                    </label>
                    <input
                      type="text"
                      value={blueprint.event_type}
                      onChange={(e) =>
                        setBlueprint({ ...blueprint, event_type: e.target.value })
                      }
                      className="w-full px-3 py-1.5 border border-stone-200 rounded-xl font-medium text-stone-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-stone-500 mb-1">
                      City / Location
                    </label>
                    <input
                      type="text"
                      value={blueprint.location}
                      onChange={(e) =>
                        setBlueprint({ ...blueprint, location: e.target.value })
                      }
                      className="w-full px-3 py-1.5 border border-stone-200 rounded-xl font-medium text-stone-900"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-stone-500 mb-1">
                        Days
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={14}
                        value={blueprint.event_days}
                        onChange={(e) =>
                          setBlueprint({
                            ...blueprint,
                            event_days: Math.max(1, Number(e.target.value) || 1),
                          })
                        }
                        className="w-full px-2.5 py-1.5 border border-stone-200 rounded-xl font-mono text-stone-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-stone-500 mb-1">
                        Budget ($)
                      </label>
                      <input
                        type="number"
                        min={500}
                        step={500}
                        value={blueprint.target_budget}
                        onChange={(e) =>
                          setBlueprint({
                            ...blueprint,
                            target_budget: Math.max(500, Number(e.target.value) || 10000),
                          })
                        }
                        className="w-full px-2.5 py-1.5 border border-stone-200 rounded-xl font-mono text-stone-900"
                      />
                    </div>
                  </div>
                </div>

                {/* Improvised Custom Tabs Preview */}
                <div className="pt-4 border-t border-stone-100 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-stone-900">
                      Improvised Custom Tabs for Your Workspace
                    </span>
                    <span className="font-mono text-[#B88B4A] font-semibold">
                      {improvisedModules.length} tabs
                    </span>
                  </div>
                  <div className="divide-y divide-stone-100 border border-stone-200/80 rounded-2xl overflow-hidden">
                    {improvisedModules.map((mod, idx) => (
                      <div key={mod.id} className="p-3 text-xs space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-stone-900">
                            Tab {idx + 1}: {mod.category_title}
                          </span>
                          <span className="font-mono text-[11px] text-stone-500 shrink-0">
                            {mod.items.length} items
                          </span>
                        </div>
                        <p className="text-stone-500 line-clamp-2">{mod.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Nearby Hotel Room Blocks Preview */}
                <div className="pt-3 border-t border-stone-100 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-stone-900 inline-flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-[#4A6B53]" />
                      Nearby Hotel Room Blocks Prepared
                    </span>
                    <span className="font-mono text-stone-600">
                      {improvisedHotels.length} hotels
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {improvisedHotels.map((hb) => (
                      <div
                        key={hb.id}
                        className="flex items-center justify-between text-xs text-stone-700"
                      >
                        <span className="truncate font-medium">{hb.hotel_name}</span>
                        <span className="font-mono font-semibold text-[#4A6B53] shrink-0">
                          ${hb.nightly_rate}/nt ({hb.rooms_blocked} rms)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  onCompleteAiEventSetup({
                    draft: blueprint,
                    modules: improvisedModules,
                    hotelBlocks: improvisedHotels,
                  })
                }
                className="w-full py-4 px-5 text-xs sm:text-sm font-bold text-white bg-[#B88B4A] hover:bg-[#9E7438] rounded-full transition-all inline-flex items-center justify-center gap-2 shadow-sm"
              >
                Enter Workspace with Custom Tabs <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  );
};
