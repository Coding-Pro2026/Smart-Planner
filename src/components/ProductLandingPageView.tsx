import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  Building2,
  Calculator,
  Calendar,
  Check,
  ClipboardCheck,
  GitBranch,
  HeartHandshake,
  LayoutGrid,
  MapPin,
  MessageSquare,
  Moon,
  Pause,
  Play,
  Send,
  Sparkles,
  Sun,
  TrendingUp,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { EventRecord } from '../types/domain';

interface ProductLandingPageViewProps {
  existingEvents: EventRecord[];
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onStartWithAiChat: (initialPrompt?: string) => void;
  onEnterWorkspaceDirect: (eventId?: string) => void;
  onOpenChooser: () => void;
}

interface VideoChapter {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  durationSec: number;
  videoUrl: string;
  fallbackGradient: string;
  promptToTry: string;
  liveDemoOverlay: {
    eventBadge: string;
    eventTitle: string;
    location: string;
    generatedTabs: string[];
    liveMetricLabel: string;
    liveMetricValue: string;
    steps: { label: string; detail: string; tag: string }[];
  };
}

const PRODUCT_VIDEO_CHAPTERS: VideoChapter[] = [
  {
    id: 'chap_ai_tabs',
    number: '01',
    title: 'Agentic Custom Event Tab Improvisation',
    subtitle:
      'Watch PlanGenie detect a Funeral or 5-Day Indian Wedding and improvise custom tabs like Who Speaks First (Eulogy Order) & Pallbearers.',
    durationSec: 12,
    videoUrl:
      'https://assets.mixkit.co/videos/preview/mixkit-candle-light-in-a-dark-room-43254-large.mp4',
    fallbackGradient: 'from-stone-900 via-stone-800 to-emerald-950',
    promptToTry:
      "We are planning my grandfather Arthur's Funeral & Celebration of Life in Boston, MA on 2026-11-18 for 120 guests with a $14,500 budget. We need custom tabs for Who Speaks First (eulogy speaking order), pallbearers & memorial service, and cheap nearby hotels.",
    liveDemoOverlay: {
      eventBadge: 'FUNERAL & CELEBRATION OF LIFE · 1 DAY',
      eventTitle: 'Arthur Vance Memorial & Celebration of Life',
      location: 'Boston, MA — Mount Auburn Chapel',
      generatedTabs: [
        'Tab 1: Eulogy & Speaking Order (Who Speaks First)',
        'Tab 2: Pallbearers & Processional Protocol',
        'Tab 3: Bereavement Repast & Nearby Hotels',
      ],
      liveMetricLabel: 'Custom Tabs Improvised',
      liveMetricValue: '3 Bespoke Modules + 9 Tasks',
      steps: [
        {
          label: 'Speaker #1 (Opens Service — 5 mins)',
          detail: 'Rev. Thomas Sterling — Welcome & Invocation',
          tag: 'Who Speaks First',
        },
        {
          label: 'Speaker #2 (Primary Family Eulogy — 8 mins)',
          detail: 'Claire Vance (Eldest Granddaughter) — Life Tribute',
          tag: 'Order #2',
        },
        {
          label: 'Speaker #3 (Colleague Remembrance — 5 mins)',
          detail: 'Dr. Henrik Lindqvist — Academic Legacy',
          tag: 'Order #3',
        },
      ],
    },
  },
  {
    id: 'chap_hotels_india',
    number: '02',
    title: '5-Day Cultural Rituals & Nearby Hotels',
    subtitle:
      'See how multi-day regional events automatically generate Haldi, Mehendi, Sangeet & Baraat tabs while finding real nearby hotels (OpenStreetMap) for room blocks.',
    durationSec: 12,
    videoUrl:
      'https://assets.mixkit.co/videos/preview/mixkit-people-toasting-with-champagne-at-a-party-42653-large.mp4',
    fallbackGradient: 'from-emerald-950 via-stone-900 to-amber-950',
    promptToTry:
      'Plan a 5-day Indian destination wedding in Udaipur, Rajasthan, India for 220 guests with an $85,000 budget. Include custom tabs for the 5-day ceremony rituals (Haldi, Mehendi, Sangeet, Baraat, Pheras), Sangeet speaking/performance order, and affordable nearby hotel blocks.',
    liveDemoOverlay: {
      eventBadge: '5-DAY INDIAN DESTINATION WEDDING',
      eventTitle: 'Aarav & Diya Udaipur Palace Wedding',
      location: 'Udaipur, Rajasthan, India',
      generatedTabs: [
        'Tab 1: 5-Day Ceremony Schedule (Haldi, Mehendi, Sangeet, Baraat)',
        'Tab 2: Sangeet Dance & Family Toast Order',
        'Tab 3: Nearby Hotels & Room-Block Inquiries',
      ],
      liveMetricLabel: 'Lowest Nearby Hotel Found',
      liveMetricValue: '$54/nt (Save 31% Group Block)',
      steps: [
        {
          label: 'Ginger Hotel & Suites Udaipur (0.7 mi)',
          detail: 'Complimentary Breakfast + 30-Room Block Locked',
          tag: '$54 / night',
        },
        {
          label: 'Lemon Tree Premier Courtyard (1.2 mi)',
          detail: 'Baraat Welcome Desk + Airport Transfers Included',
          tag: '$76 / night',
        },
        {
          label: 'Day 1–5 Ritual & Production Sync',
          detail: 'Ganesh Puja → Haldi → Mehendi → Sangeet → Pheras',
          tag: '5-Day DAG',
        },
      ],
    },
  },
  {
    id: 'chap_rsvp_budget',
    number: '03',
    title: 'Google Calendar Email RSVPs & Smart Cost Forecasting',
    subtitle:
      'Add events and guests to Google Calendar in one click (no account linking) and forecast multi-year vendor inflation using Ordinary Least Squares regression.',
    durationSec: 12,
    videoUrl:
      'https://assets.mixkit.co/videos/preview/mixkit-hands-of-a-woman-working-on-a-laptop-41645-large.mp4',
    fallbackGradient: 'from-stone-900 via-amber-950 to-emerald-950',
    promptToTry:
      'Plan a 2-day vineyard wedding in Sonoma Valley, CA, USA for 150 guests with a $55,000 budget. Create custom tabs for the 2-day wedding weekend schedule, reception toast speaking order (who speaks first), and cheap nearby hotel room blocks.',
    liveDemoOverlay: {
      eventBadge: '2-DAY USA VINEYARD WEDDING · GOOGLE CALENDAR SYNC',
      eventTitle: "Claire & Julian's Autumn Conservatory Wedding",
      location: 'Napa Valley, CA — Stonebridge Glasshouse',
      generatedTabs: [
        'Tab 1: 2-Day Wedding Weekend Run-of-Show',
        'Tab 2: Reception Toasts & Speaking Order',
        'Tab 3: Google Calendar Email RSVP Tracker',
      ],
      liveMetricLabel: 'Early Lock-In Savings (OLS)',
      liveMetricValue: '$4,820 Projected Savings',
      steps: [
        {
          label: 'Dr. Henrik & Camille Lindqvist (henrik@nordicbio.example)',
          detail: 'Google Calendar Invite Accepted via Email',
          tag: 'Accepted',
        },
        {
          label: 'Mateo & Sofia Rossi (m.rossi@milanarch.example)',
          detail: 'Google Calendar Invite Accepted · Gluten-Free',
          tag: 'Accepted',
        },
        {
          label: 'Deterministic Budget & Escalation Guard',
          detail: 'Zero LLM math hallucination · +6.4% YoY OLS Slope',
          tag: 'Verified',
        },
      ],
    },
  },
];

export const ProductLandingPageView: React.FC<ProductLandingPageViewProps> = ({
  existingEvents,
  isDarkMode,
  onToggleDarkMode,
  onStartWithAiChat,
  onEnterWorkspaceDirect,
  onOpenChooser,
}) => {
  const [activeChapterIdx, setActiveChapterIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [progressPct, setProgressPct] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const currentChapter = PRODUCT_VIDEO_CHAPTERS[activeChapterIdx];

  useEffect(() => {
    if (!isPlaying) return;
    const intervalMs = 120;
    const step = (intervalMs / (currentChapter.durationSec * 1000)) * 100;

    const timer = window.setInterval(() => {
      setProgressPct((prev) => {
        if (prev + step >= 100) {
          setActiveChapterIdx((idx) => (idx + 1) % PRODUCT_VIDEO_CHAPTERS.length);
          return 0;
        }
        return prev + step;
      });
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [isPlaying, activeChapterIdx, currentChapter.durationSec]);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.load();
    if (isPlaying) {
      vid.play().catch(() => {
        // Fallback if browser blocks autoplay
      });
    }
  }, [activeChapterIdx, isPlaying]);

  const handleSelectChapter = (idx: number) => {
    setActiveChapterIdx(idx);
    setProgressPct(0);
    setIsPlaying(true);
  };

  const scrollToVideoDemo = () => {
    const el = document.getElementById('product-video');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      setIsPlaying(true);
    }
  };

  return (
    <div className="min-h-screen pg-aurora-bg text-stone-900 flex flex-col selection:bg-[#B88B4A] selection:text-white">
      {/* STRICT 3-ZONE TOP NAVIGATION BAR (Warm Cream, Honey Gold & Botanical Sage — Zero Purple) */}
      <header className="sticky top-0 z-40 bg-[#FAF6EC]/95 dark:bg-stone-900/90 backdrop-blur-md border-b border-stone-200/80 px-4 sm:px-6 lg:px-10 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        {/* Zone 1: Brand Wordmark */}
        <a
          href="#top"
          className="flex items-center gap-2.5 text-xl font-extrabold tracking-tight text-stone-900 whitespace-nowrap shrink-0"
        >
          <span className="w-8 h-8 rounded-xl bg-[#B88B4A] flex items-center justify-center text-white shadow-2xs">
            <Sparkles className="w-4 h-4" />
          </span>
          <span>PlanGenie</span>
        </a>

        {/* Zone 2: Section Navigation Links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-stone-600">
          <a href="#features" className="hover:text-stone-900 transition-colors">
            Features
          </a>
          <a href="#product-video" className="hover:text-stone-900 transition-colors">
            Video Demo
          </a>
          <a href="#case-studies" className="hover:text-stone-900 transition-colors">
            Event Blueprints
          </a>
          <a href="#get-started" className="hover:text-stone-900 transition-colors">
            Plan with AI
          </a>
        </nav>

        {/* Zone 3: Theme Toggle + Warm Honey Gold Primary CTA */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onToggleDarkMode}
            aria-label="Toggle Dark or Light Mode"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-stone-700 bg-stone-200/70 hover:bg-stone-200 rounded-xl transition-colors"
          >
            {isDarkMode ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" />
                Light
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-stone-700" />
                Dark
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onOpenChooser}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#B88B4A] hover:bg-[#9E7438] rounded-full transition-all shadow-sm"
          >
            Start Planning
          </button>
        </div>
      </header>

      {/* SECTION 1: WARM CHAMPAGNE HERO ("Plan Smarter, Celebrate Better") + UPLOADED PHOTO & LIVE FLOATING WIDGETS */}
      <section
        id="top"
        className="max-w-[1280px] w-full mx-auto px-6 lg:px-10 pt-8 pb-12 sm:pt-12 sm:pb-16 space-y-10"
      >
        <div className="bg-[#F4EBDC] dark:bg-stone-900/95 border border-[#E5D9C3] dark:border-stone-800 rounded-[32px] p-8 sm:p-12 lg:p-14 shadow-md overflow-hidden relative">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Left 5 Columns: Exact Editorial Typography & Dual Buttons from Reference */}
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="lg:col-span-5 space-y-6"
            >
              <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#4A6B53]">
                <Sparkles className="w-4 h-4 text-[#B88B4A]" />
                AI-Powered Event Architecture
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-extrabold tracking-tight text-stone-900 leading-[1.08]">
                Plan Smarter,
                <br />
                Celebrate Better
              </h1>

              <p className="text-base sm:text-lg text-stone-700 leading-relaxed">
                Your AI-powered assistant for weddings, birthdays, memorials, and
                community events — complete with custom regional tabs, nearby
                hotels, and Google Calendar RSVPs.
              </p>

              <div className="flex flex-wrap items-center gap-3.5 pt-2">
                <button
                  type="button"
                  onClick={onOpenChooser}
                  className="px-7 py-3.5 text-sm font-bold text-white bg-[#B88B4A] hover:bg-[#9E7438] rounded-full transition-all shadow-sm inline-flex items-center gap-2"
                >
                  Start Planning for Free <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={scrollToVideoDemo}
                  className="px-7 py-3.5 text-sm font-bold text-stone-900 bg-transparent hover:bg-stone-900/5 border-2 border-stone-800 dark:border-stone-300 rounded-full transition-colors inline-flex items-center gap-2"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Watch a Demo
                </button>
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-5 text-xs text-stone-600 font-medium">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#4A6B53]" />
                  Plan with AI or Without AI
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#4A6B53]" />
                  Custom Event Tabs
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#4A6B53]" />
                  Nearby Hotel Blocks
                </span>
              </div>
            </motion.div>

            {/* Right 7 Columns: Uploaded Hero Photo + Animated Interactive Floating Cards */}
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
              className="lg:col-span-7 relative"
            >
              {/* Main Hero Image Carrier */}
              <div className="relative rounded-3xl overflow-hidden border-2 border-white/80 dark:border-stone-700 shadow-2xl bg-stone-900 aspect-16/10">
                <img
                  src="/assets/aistudio/image_be5b1ec6-175a-4e49-8ff4-915b785e72c5_f9e4d459.png"
                  alt="PlanGenie AI Event Planning Workspace Preview"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-stone-950/35 via-transparent to-transparent pointer-events-none" />
              </div>

              {/* Floating Card 1 (Top Left): Your Wedding Checklist: 68% Complete */}
              <motion.div
                initial={{ opacity: 0, y: -14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.45 }}
                className="hidden sm:flex items-center gap-3.5 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md border border-stone-200/90 rounded-2xl px-4 py-3 shadow-lg absolute -top-4 left-6 max-w-[270px]"
              >
                <div className="w-9 h-9 rounded-xl bg-[#F4EBDC] text-[#B88B4A] flex items-center justify-center shrink-0">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-stone-900 truncate">
                    Your Event Checklist:
                  </div>
                  <div className="text-[11px] font-semibold text-stone-600">
                    68% Complete · Custom Tabs Ready
                  </div>
                  <div className="w-full h-1.5 bg-stone-200 rounded-full overflow-hidden mt-1.5">
                    <div className="h-full bg-[#B88B4A] rounded-full w-[68%]" />
                  </div>
                </div>
              </motion.div>

              {/* Floating Card 2 (Bottom Left): Smart Budget Estimator: On Track */}
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.42, duration: 0.45 }}
                className="hidden sm:flex items-center gap-3.5 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md border border-stone-200/90 rounded-2xl px-4 py-3 shadow-lg absolute -bottom-4 left-6 max-w-[260px]"
              >
                <div className="w-9 h-9 rounded-xl bg-[#EEF4EF] text-[#4A6B53] flex items-center justify-center shrink-0">
                  <Calculator className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-stone-900 truncate">
                    Smart Budget Estimator:
                  </div>
                  <div className="text-[11px] font-semibold text-[#4A6B53]">
                    On Track · $4,820 Early Lock Saved
                  </div>
                  <div className="w-full h-1.5 bg-stone-200 rounded-full overflow-hidden mt-1.5">
                    <div className="h-full bg-[#4A6B53] rounded-full w-[76%]" />
                  </div>
                </div>
              </motion.div>

              {/* Floating Card 3 (Bottom Right): Botanical Sage AI Chat Widget from Reference */}
              <motion.div
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.52, duration: 0.45 }}
                className="hidden md:block bg-white/95 dark:bg-stone-900/95 backdrop-blur-md border border-stone-200/90 rounded-2xl overflow-hidden shadow-xl absolute -bottom-6 right-4 w-[285px]"
              >
                <div className="bg-[#4A6B53] text-white px-4 py-2.5 flex items-center justify-between text-xs font-bold">
                  <span className="inline-flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#F4EBDC]" />
                    PlanGenie AI Assistant
                  </span>
                  <span className="text-[10px] font-normal text-emerald-100">Online</span>
                </div>
                <div className="p-3.5 space-y-2.5 text-xs">
                  <div className="bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 rounded-xl px-3 py-2 leading-snug">
                    I&apos;ve improvised your custom tabs &amp; found 3 nearby hotels in
                    your budget ($54–$109/nt).
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => onStartWithAiChat()}
                      className="bg-[#4A6B53] hover:bg-[#3B5943] text-white font-semibold px-3 py-1.5 rounded-xl transition-colors inline-flex items-center gap-1"
                    >
                      Yes, see suggestions! <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>

          {/* 4 SIGNATURE FEATURE CARDS ROW (Matching the 4 Cards at the Bottom of the Reference Laptop Screen) */}
          <div
            id="features"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-14 pt-10 border-t border-[#E5D9C3]/80 dark:border-stone-800"
          >
            {/* Card 1: Interactive Timelines */}
            <motion.div
              whileHover={{ y: -4 }}
              onClick={() => onEnterWorkspaceDirect()}
              className="bg-white dark:bg-stone-900 border border-stone-200/90 rounded-2xl p-6 text-center space-y-3 shadow-xs hover:shadow-md transition-all cursor-pointer"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#F4EBDC] text-[#B88B4A] flex items-center justify-center mx-auto">
                <GitBranch className="w-6 h-6" />
              </div>
              <h2 className="text-base font-bold text-stone-900">
                Interactive Timelines
              </h2>
              <p className="text-xs text-stone-600 leading-relaxed">
                Critical-path dependency scheduling that automatically shifts downstream
                milestones when dates change.
              </p>
            </motion.div>

            {/* Card 2: Smart Budgeting */}
            <motion.div
              whileHover={{ y: -4 }}
              onClick={() => onEnterWorkspaceDirect()}
              className="bg-white dark:bg-stone-900 border border-stone-200/90 rounded-2xl p-6 text-center space-y-3 shadow-xs hover:shadow-md transition-all cursor-pointer"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#EEF4EF] text-[#4A6B53] flex items-center justify-center mx-auto">
                <Calculator className="w-6 h-6" />
              </div>
              <h2 className="text-base font-bold text-stone-900">Smart Budgeting</h2>
              <p className="text-xs text-stone-600 leading-relaxed">
                Deterministic per-guest scaling, tax/contingency guards, and multi-year
                linear regression cost forecasting.
              </p>
            </motion.div>

            {/* Card 3: Vendor & Hotel Matchmaking */}
            <motion.div
              whileHover={{ y: -4 }}
              onClick={() => onEnterWorkspaceDirect()}
              className="bg-white dark:bg-stone-900 border border-stone-200/90 rounded-2xl p-6 text-center space-y-3 shadow-xs hover:shadow-md transition-all cursor-pointer"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#FDF2EC] text-[#C86D51] flex items-center justify-center mx-auto">
                <HeartHandshake className="w-6 h-6" />
              </div>
              <h2 className="text-base font-bold text-stone-900">
                Vendor &amp; Hotel Matchmaking
              </h2>
              <p className="text-xs text-stone-600 leading-relaxed">
                Finds real nearby hotels with live-rate links and audits vendor quote
                contracts for hidden fees.
              </p>
            </motion.div>

            {/* Card 4: Collaborative Checklists & Custom Tabs */}
            <motion.div
              whileHover={{ y: -4 }}
              onClick={() => onStartWithAiChat()}
              className="bg-white dark:bg-stone-900 border border-stone-200/90 rounded-2xl p-6 text-center space-y-3 shadow-xs hover:shadow-md transition-all cursor-pointer"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#F4EBDC] text-[#B88B4A] flex items-center justify-center mx-auto">
                <ClipboardCheck className="w-6 h-6" />
              </div>
              <h2 className="text-base font-bold text-stone-900">
                Collaborative Checklists
              </h2>
              <p className="text-xs text-stone-600 leading-relaxed">
                Improvises custom tabs (Funeral Speaking Order, 5-Day Indian Weddings) and
                syncs Google Calendar email RSVPs.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* SECTION 2: INTERACTIVE 16:9 PRODUCT VIDEO WALKTHROUGH STAGE */}
      <section
        id="product-video"
        className="max-w-[1280px] w-full mx-auto px-6 lg:px-10 py-10 space-y-8"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-wider text-[#4A6B53]">
              Interactive Product Video Walkthrough
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-stone-900">
              See PlanGenie improvise custom tabs &amp; hotel blocks in real time.
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onStartWithAiChat(currentChapter.promptToTry)}
            className="px-5 py-2.5 text-xs font-bold text-white bg-[#4A6B53] hover:bg-[#3B5943] rounded-full transition-colors inline-flex items-center gap-1.5 shadow-xs"
          >
            Try Chapter {currentChapter.number} in AI Chat <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="bg-white border border-stone-200/90 rounded-3xl overflow-hidden shadow-xl">
          {/* Video Stage Top Chapter Switcher Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-stone-200/80 border-b border-stone-200/80 bg-[#FAF6EC]/70">
            {PRODUCT_VIDEO_CHAPTERS.map((chap, idx) => {
              const isActive = idx === activeChapterIdx;
              return (
                <button
                  key={chap.id}
                  type="button"
                  onClick={() => handleSelectChapter(idx)}
                  className={`p-5 text-left transition-all relative ${
                    isActive ? 'bg-white' : 'hover:bg-white/60 opacity-75 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs font-mono font-bold text-[#B88B4A] mb-1">
                    <span>CHAPTER {chap.number}</span>
                    {isActive && (
                      <span className="text-[11px] text-[#4A6B53] font-sans font-semibold">
                        ● Playing Live Reel
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-bold text-stone-900 truncate">
                    {chap.title}
                  </div>
                  <p className="text-xs text-stone-500 line-clamp-1 mt-0.5">
                    {chap.subtitle}
                  </p>
                  <div className="w-full h-1 bg-stone-200/80 rounded-full overflow-hidden mt-3">
                    <div
                      className="h-full bg-[#B88B4A] transition-all duration-150"
                      style={{
                        width: isActive ? `${progressPct}%` : idx < activeChapterIdx ? '100%' : '0%',
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </div>

          {/* 16:9 Cinema Video + Animated Product UI Simulation Stage */}
          <div
            className={`relative min-h-[450px] lg:min-h-[500px] bg-gradient-to-br ${currentChapter.fallbackGradient} text-white overflow-hidden flex flex-col justify-between p-6 sm:p-10`}
          >
            <video
              ref={videoRef}
              key={currentChapter.videoUrl}
              src={currentChapter.videoUrl}
              autoPlay
              loop
              muted={isMuted}
              playsInline
              className="absolute inset-0 w-full h-full object-cover opacity-35 mix-blend-luminosity pointer-events-none"
            />

            <div className="absolute inset-0 bg-gradient-to-r from-stone-950/90 via-stone-950/75 to-stone-950/60 pointer-events-none" />

            {/* Top Video Controls */}
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsPlaying((prev) => !prev)}
                  className="w-10 h-10 rounded-2xl bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/20 flex items-center justify-center text-white transition-colors"
                  aria-label={isPlaying ? 'Pause Product Video' : 'Play Product Video'}
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4 ml-0.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setIsMuted((prev) => !prev)}
                  className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/15 flex items-center justify-center text-white transition-colors"
                  aria-label={isMuted ? 'Unmute Video' : 'Mute Video'}
                >
                  {isMuted ? (
                    <VolumeX className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>

                <div className="text-xs">
                  <div className="font-mono font-bold text-[#E5C185]">
                    PRODUCT WALKTHROUGH · CHAPTER {currentChapter.number}
                  </div>
                  <div className="text-stone-300 font-medium">{currentChapter.title}</div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onStartWithAiChat(currentChapter.promptToTry)}
                className="px-4 py-2.5 text-xs font-bold text-white bg-[#B88B4A] hover:bg-[#9E7438] rounded-full transition-colors inline-flex items-center gap-1.5 shadow-md"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Launch This Scenario in AI Chat →
              </button>
            </div>

            {/* Animated Interactive Product UI Walkthrough Inside the Video Stage */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentChapter.id}
                initial={{ opacity: 0, y: 18, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -16, scale: 0.98 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center my-auto py-6"
              >
                {/* Left 5 Cols: Event Context & Dynamically Improvised Tabs */}
                <div className="lg:col-span-5 bg-stone-900/85 backdrop-blur-xl border border-white/15 rounded-3xl p-6 space-y-4 shadow-2xl">
                  <div className="space-y-1">
                    <span className="text-[11px] font-mono font-bold text-[#E5C185]">
                      {currentChapter.liveDemoOverlay.eventBadge}
                    </span>
                    <h3 className="text-xl font-bold text-white">
                      {currentChapter.liveDemoOverlay.eventTitle}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-stone-300">
                      <MapPin className="w-3.5 h-3.5 text-[#E5C185] shrink-0" />
                      {currentChapter.liveDemoOverlay.location}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/10 space-y-2">
                    <div className="text-xs font-semibold text-stone-300">
                      AI-Improvised Custom Navigation Tabs:
                    </div>
                    <div className="space-y-2">
                      {currentChapter.liveDemoOverlay.generatedTabs.map((tab, tIdx) => (
                        <motion.div
                          key={tab}
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.12 * (tIdx + 1) }}
                          className="px-3.5 py-2.5 rounded-2xl bg-[#4A6B53]/35 border border-[#86EFAC]/30 text-xs font-semibold text-emerald-100 flex items-center justify-between gap-2"
                        >
                          <span className="truncate">{tab}</span>
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right 7 Cols: Live Animated Execution Steps */}
                <div className="lg:col-span-7 bg-stone-900/85 backdrop-blur-xl border border-white/15 rounded-3xl p-6 space-y-4 shadow-2xl">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3.5">
                    <div>
                      <span className="text-xs font-semibold text-emerald-400">
                        Live Agentic Workspace Output
                      </span>
                      <h4 className="text-base font-bold text-white mt-0.5">
                        {currentChapter.subtitle}
                      </h4>
                    </div>
                    <div className="text-right font-mono">
                      <div className="text-[11px] text-stone-400">
                        {currentChapter.liveDemoOverlay.liveMetricLabel}
                      </div>
                      <div className="text-sm font-bold text-[#E5C185]">
                        {currentChapter.liveDemoOverlay.liveMetricValue}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {currentChapter.liveDemoOverlay.steps.map((st, sIdx) => (
                      <motion.div
                        key={st.label}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 * (sIdx + 1) }}
                        className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-4 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-white truncate">{st.label}</div>
                          <div className="text-stone-300 truncate mt-0.5">{st.detail}</div>
                        </div>
                        <span className="font-mono text-[11px] font-bold text-[#E5C185] shrink-0">
                          {st.tag}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-white/15 text-xs text-stone-300">
              <div>
                Click any chapter tab above to preview how PlanGenie adapts to Funerals,
                5-Day Indian Destination Weddings, and USA Vineyard Weddings.
              </div>
              <div className="font-mono text-[#E5C185]">
                Deterministic Budget &amp; DAG Math · Live OSM + Google Search Hotel Deals
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: READY-TO-LAUNCH EVENT BLUEPRINTS WITH VIDEO PREVIEWS */}
      <section
        id="case-studies"
        className="max-w-[1280px] w-full mx-auto px-6 lg:px-10 py-12 space-y-8"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2 max-w-xl">
            <span className="text-xs font-bold uppercase tracking-wider text-[#B88B4A]">
              Ready-to-Launch Blueprints
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-stone-900">
              Explore live event blueprints in 1 click.
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-stone-600 max-w-md">
            Each showcase below is pre-loaded with custom tabs, hotel blocks, critical-path
            schedules, and budget items.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {existingEvents.slice(0, 3).map((ev, idx) => {
            const videoUrls = [
              'https://assets.mixkit.co/videos/preview/mixkit-people-toasting-with-champagne-at-a-party-42653-large.mp4',
              'https://assets.mixkit.co/videos/preview/mixkit-candle-light-in-a-dark-room-43254-large.mp4',
              'https://assets.mixkit.co/videos/preview/mixkit-Sparklers-at-a-night-party-43251-large.mp4',
            ];
            const metrics = [
              '3 Custom Cultural Tabs · 2 Hotel Blocks',
              'Eulogy Speaking Order · Bereavement Block',
              'VIP Lounge Protocol · Zero Schedule Drift',
            ];
            return (
              <motion.div
                key={ev.id}
                whileHover={{ y: -4 }}
                className="bg-white border border-stone-200/90 rounded-3xl overflow-hidden flex flex-col justify-between shadow-sm hover:shadow-xl transition-all"
              >
                <div>
                  <div className="relative h-44 bg-stone-900 overflow-hidden">
                    <video
                      src={videoUrls[idx % videoUrls.length]}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="w-full h-full object-cover opacity-75"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-stone-950/30 to-transparent" />
                    <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-white text-xs">
                      <span className="font-mono uppercase font-bold text-[#E5C185]">
                        {ev.event_type} · {ev.event_days ?? 2}d
                      </span>
                      <span className="font-mono font-bold">
                        ${ev.target_budget.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="p-6 space-y-3">
                    <h3 className="text-lg font-bold text-stone-900">{ev.title}</h3>
                    <div className="flex items-center gap-1.5 text-xs text-stone-500">
                      <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      <span className="truncate">{ev.location}</span>
                    </div>
                    <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs text-stone-600">
                      <span>{ev.guest_count} guests</span>
                      <span className="font-mono text-[#4A6B53] font-semibold">
                        {metrics[idx % metrics.length]}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="px-6 pb-6">
                  <button
                    type="button"
                    onClick={() => onEnterWorkspaceDirect(ev.id)}
                    className="w-full py-3 px-4 text-xs font-semibold text-white bg-[#4A6B53] hover:bg-[#3B5943] rounded-2xl transition-colors inline-flex items-center justify-center gap-1.5"
                  >
                    Open Event Workspace <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* SECTION 4: CONVERSION SECTION — PLAN WITH AI VS PLAN WITHOUT AI */}
      <section
        id="get-started"
        className="max-w-[1280px] w-full mx-auto px-6 lg:px-10 py-12"
      >
        <div className="bg-[#F4EBDC] dark:bg-stone-900 border-2 border-[#D8C6A8] dark:border-stone-800 rounded-3xl p-8 sm:p-12 shadow-md relative overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#4A6B53]">
                Ready to Plan Your Event?
              </span>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-stone-900 tracking-tight">
                Choose how you want to start: Plan with AI Chat or Plan Without AI.
              </h2>
              <p className="text-sm sm:text-base text-stone-700 leading-relaxed">
                Use our conversational AI intake to describe your event in plain English and
                have custom tabs generated automatically, or jump straight into the manual
                Bento Box workspace.
              </p>
            </div>

            <div className="lg:col-span-5 flex flex-col sm:flex-row lg:flex-col gap-3">
              <button
                type="button"
                onClick={() => onStartWithAiChat()}
                className="w-full py-4 px-6 text-sm font-bold text-white bg-[#B88B4A] hover:bg-[#9E7438] rounded-full transition-all inline-flex items-center justify-center gap-2 shadow-sm"
              >
                <MessageSquare className="w-4 h-4" />
                Plan with AI (Conversational Chat Intake) <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => onEnterWorkspaceDirect()}
                className="w-full py-4 px-6 text-sm font-bold text-stone-900 bg-white hover:bg-stone-100 border border-stone-300 rounded-full transition-colors inline-flex items-center justify-center gap-2"
              >
                <LayoutGrid className="w-4 h-4" />
                Plan Without AI (Direct Workspace)
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* QUIET FOOTER */}
      <footer className="bg-[#FAF6EC]/90 dark:bg-stone-900/90 backdrop-blur-md border-t border-stone-200/80 px-6 lg:px-10 py-6 mt-auto">
        <div className="max-w-[1280px] mx-auto flex flex-wrap items-center justify-between gap-4 text-xs text-stone-600">
          <div className="font-semibold text-stone-900">
            PlanGenie — Smart Event Planning, Custom Cultural Tabs, Nearby Hotels &amp; Calendar Invites
          </div>
          <div className="flex items-center gap-6">
            <a href="/privacy" className="hover:text-stone-900 transition-colors">Privacy</a>
            <a href="/terms" className="hover:text-stone-900 transition-colors">Terms</a>
            <button
              type="button"
              onClick={() => onStartWithAiChat()}
              className="hover:text-stone-900 transition-colors"
            >
              Plan with AI
            </button>
            <button
              type="button"
              onClick={() => onEnterWorkspaceDirect()}
              className="hover:text-stone-900 transition-colors"
            >
              Direct Workspace
            </button>
            <button
              type="button"
              onClick={onToggleDarkMode}
              className="hover:text-stone-900 transition-colors"
            >
              {isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
