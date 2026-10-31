import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { ArrowRight, ArrowUpRight, CalendarCheck, Cog, Moon, Play, ShieldCheck, Sun } from 'lucide-react';
import { EventRecord } from '../types/domain';
import { Backdrop } from './design/Backdrop';
import { CountUp, EASE, Magnetic, Reveal, RevealWords, Tilt3D } from './design/primitives';
import { Botanical, IsoCalendar, IsoEnvelope, IsoPin, Ring, Sparkle } from './design/Illustrations';
import { HeroBoard } from './design/HeroBoard';
import { FlowDiagram } from './design/FlowDiagram';
import { PlanReel } from './design/PlanReel';

interface ProductLandingPageViewProps {
  existingEvents: EventRecord[];
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onStartWithAiChat: (prompt?: string) => void;
  onEnterWorkspaceDirect: (eventId?: string) => void;
  onOpenChooser: () => void;
}

const PROMPTS = [
  { label: '40th birthday, Austin', prompt: 'Plan a 40th birthday party in Austin for 60 guests with a $9k budget on March 14' },
  { label: '2-day vineyard wedding', prompt: 'Plan a 2-day vineyard wedding in Sonoma Valley, CA for 150 guests with a $55,000 budget' },
  { label: 'Neighbourhood food fair', prompt: 'Plan a community food fair in Portland for 300 guests with a $12k budget in 3 months' },
];

const BLUEPRINTS = [
  { n: '01', title: 'Weddings', copy: 'From a quiet garden ceremony to a five-day celebration: rituals, toasts, room blocks.', stat: 150, unit: 'guests', tone: 'var(--terra)' },
  { n: '02', title: 'Birthdays', copy: 'Milestones with a plan behind the party: venue, music, cake, surprise video.', stat: 60, unit: 'guests', tone: 'var(--gold)' },
  { n: '03', title: 'Community', copy: 'Fairs, fundraisers and festivals: permits, volunteers, insurance, rain plans.', stat: 300, unit: 'guests', tone: 'var(--forest-2)' },
];

const MARQUEE = ['Weddings', 'Birthdays', 'Memorials', 'Festivals', 'Fundraisers', 'Reunions', 'Galas', 'Milestones'];

function Tile({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return (
    <Reveal className={className}>
      <Tilt3D max={4} className="h-full" style={{ borderRadius: '1.75rem' }}>
        <div className="pg-glass relative h-full overflow-hidden rounded-[1.75rem] p-7 sm:p-8">{children}</div>
      </Tilt3D>
    </Reveal>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
      <span className="h-px w-8 bg-[var(--terra)]" />
      {children}
    </div>
  );
}

export const ProductLandingPageView: React.FC<ProductLandingPageViewProps> = ({
  existingEvents,
  isDarkMode,
  onToggleDarkMode,
  onStartWithAiChat,
  onEnterWorkspaceDirect,
  onOpenChooser,
}) => {
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const copyY = useTransform(scrollYProgress, [0, 1], [0, 90]);
  const copyOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="pg-grain relative min-h-screen overflow-x-clip text-[var(--ink)] selection:bg-[var(--terra)] selection:text-white">
      <Backdrop variant="hero" />

      {/* floating nav pill */}
      <motion.header initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.9, ease: EASE, delay: 0.2 }} className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
        <div className="pg-glass flex w-full max-w-[920px] items-center justify-between gap-3 rounded-full py-2 pl-5 pr-2 shadow-[0_18px_50px_-24px_rgba(44,70,54,0.5)]">
          <a href="#top" className="flex items-center gap-2 font-display text-xl font-semibold tracking-tight">
            <Sparkle className="h-4 w-4 text-[var(--terra)]" />
            PlanGenie
          </a>
          <nav className="hidden items-center gap-1 text-sm font-medium text-[var(--ink-2)] md:flex" aria-label="Sections">
            {[['Journey', 'journey'], ['Reel', 'reel'], ['Atelier', 'atelier'], ['Blueprints', 'blueprints']].map(([l, id]) => (
              <button key={id} type="button" onClick={() => go(id)} className="rounded-full px-4 py-2 transition-colors hover:bg-[var(--line)]">
                {l}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={onToggleDarkMode} aria-label="Toggle dark or light mode" className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--ink-2)] transition-colors hover:bg-[var(--line)]">
              {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button type="button" onClick={onOpenChooser} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-[var(--paper)] transition-transform hover:scale-[1.03]">
              Start planning <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </motion.header>

      {/* ============ HERO ============ */}
      <section ref={heroRef} id="top" className="relative mx-auto grid min-h-[100svh] max-w-[1280px] items-center gap-6 px-5 pb-16 pt-32 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-4 lg:pt-28">
        <Botanical className="pointer-events-none absolute -left-16 top-20 hidden h-[460px] text-[var(--forest)] opacity-[0.16] lg:block" delay={0.4} />
        <motion.div style={{ y: copyY, opacity: copyOpacity }} className="relative z-10">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mb-7 inline-flex items-center gap-2.5 rounded-full border border-[var(--line)] bg-[var(--card)] py-1.5 pl-2 pr-4 text-xs font-medium text-[var(--ink-2)] backdrop-blur">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--terra)] opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--terra)]" />
            </span>
            Works offline · bring your own AI key
          </motion.div>
          <h1 className="text-[clamp(2.9rem,7.6vw,6.4rem)] leading-[0.95] tracking-[-0.03em]">
            <RevealWords text="Plan the day." delay={0.4} />
            <br />
            <RevealWords text="Keep the magic." delay={0.75} accent={['magic']} />
          </h1>
          <motion.p initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.25, duration: 0.8 }} className="mt-7 max-w-[34rem] text-lg leading-relaxed text-[var(--ink-2)]">
            A planning studio for weddings, birthdays and community events. Real budget maths, a timeline that re-flows when plans change, and an assistant that proposes while you decide.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.45, duration: 0.8 }} className="mt-9 flex flex-wrap items-center gap-4">
            <Magnetic>
              <button type="button" onClick={() => onStartWithAiChat()} className="group inline-flex items-center gap-2.5 rounded-full bg-[var(--terra)] px-7 py-4 text-base font-semibold text-white shadow-[0_20px_40px_-14px_rgba(200,109,81,0.7)] transition-shadow hover:shadow-[0_26px_50px_-14px_rgba(200,109,81,0.85)]">
                Begin a plan
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
            </Magnetic>
            <button type="button" onClick={() => go('reel')} className="group inline-flex items-center gap-3 rounded-full px-2 py-2 text-base font-semibold text-[var(--ink)]">
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--card)] transition-colors group-hover:bg-[var(--ink)] group-hover:text-[var(--paper)]">
                <Play className="h-4 w-4 translate-x-[1px]" />
              </span>
              Watch the reel
            </button>
          </motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.8 }} className="mt-10 flex flex-wrap gap-2">
            <span className="mr-1 self-center font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Try</span>
            {PROMPTS.map((p) => (
              <button key={p.label} type="button" onClick={() => onStartWithAiChat(p.prompt)} className="rounded-full border border-[var(--line)] bg-[var(--card)] px-3.5 py-1.5 text-xs font-medium text-[var(--ink-2)] backdrop-blur transition-colors hover:border-[var(--terra)] hover:text-[var(--ink)]">
                {p.label}
              </button>
            ))}
          </motion.div>
        </motion.div>
        <div className="relative z-10 pt-6 lg:pt-0">
          <HeroBoard />
        </div>
        <motion.button type="button" onClick={() => go('journey')} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.4 }} className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--muted)] lg:flex" aria-label="Scroll to journey">
          Scroll
          <motion.span className="h-8 w-px bg-[var(--ink-2)]" animate={{ scaleY: [0.2, 1, 0.2], originY: 0 }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }} />
        </motion.button>
      </section>

      {/* ============ MARQUEE ============ */}
      <div className="relative border-y border-[var(--line)] bg-[var(--card)] py-5 backdrop-blur" aria-hidden="true">
        <div className="pg-marquee flex whitespace-nowrap font-display text-4xl italic text-[var(--ink)] sm:text-5xl">
          {[...MARQUEE, ...MARQUEE].map((w, i) => (
            <span key={i} className="flex items-center">
              <span className="px-8">{w}</span>
              <Sparkle className="h-4 w-4 text-[var(--terra)]" />
            </span>
          ))}
        </div>
      </div>

      {/* ============ JOURNEY DIAGRAM ============ */}
      <section id="journey" className="mx-auto max-w-[1280px] px-5 py-28 sm:px-8">
        <Reveal>
          <Eyebrow>The journey</Eyebrow>
          <h2 className="max-w-3xl text-[clamp(2.2rem,5vw,4rem)] leading-[1.02]">
            From first idea to <em className="text-[var(--terra)]">last dance</em>, one thread.
          </h2>
        </Reveal>
        <div className="mt-14">
          <FlowDiagram />
        </div>
      </section>

      {/* ============ THE REEL ============ */}
      <section id="reel" className="relative overflow-hidden rounded-t-[2.5rem] bg-[#0d0c0a] py-24 text-[#f6f0e4] sm:rounded-t-[3.5rem]">
        <div aria-hidden="true" className="absolute inset-0 opacity-60" style={{ background: 'radial-gradient(ellipse at 20% 0%, rgba(200,109,81,.25), transparent 55%), radial-gradient(ellipse at 90% 100%, rgba(44,70,54,.55), transparent 50%)' }} />
        <div className="relative mx-auto max-w-[1280px] px-5 sm:px-8">
          <Reveal>
            <div className="mb-4 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-white/50">
              <span className="h-px w-8 bg-[#e7c27b]" />
              The reel · 28 seconds
            </div>
            <h2 className="mb-12 max-w-4xl text-[clamp(2.2rem,5vw,4rem)] leading-[1.02] text-[#f6f0e4]">
              Watch a plan <em className="text-[#e7c27b]">assemble itself.</em>
            </h2>
          </Reveal>
          <PlanReel />
        </div>
      </section>

      {/* ============ ATELIER (features) ============ */}
      <section id="atelier" className="relative mx-auto max-w-[1280px] px-5 py-28 sm:px-8">
        <Reveal>
          <Eyebrow>The atelier</Eyebrow>
          <h2 className="max-w-3xl text-[clamp(2.2rem,5vw,4rem)] leading-[1.02]">Tools with a point of view.</h2>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-12">
          <Tile className="md:col-span-7">
            <div className="flex h-full flex-col justify-between gap-8">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Critical-path timeline</div>
                <h3 className="mt-2 font-display text-3xl font-semibold">Move one date. The rest follows.</h3>
                <p className="mt-2 max-w-md text-sm text-[var(--ink-2)]">Delay the venue by two weeks and every dependent task slides with it, with the new critical path highlighted.</p>
              </div>
              <svg viewBox="0 0 520 120" className="w-full" aria-hidden="true">
                {[[20, 20, 130], [120, 50, 150], [100, 80, 120], [280, 20, 110], [330, 50, 150]].map(([x, y, w], i) => (
                  <motion.rect key={i} x={x} y={y} rx="7" height="22" fill={i === 0 || i === 1 || i === 4 ? 'var(--forest)' : 'var(--sage)'} initial={{ width: 0 }} whileInView={{ width: w }} viewport={{ once: true }} transition={{ delay: 0.2 + i * 0.15, duration: 0.9, ease: EASE }} />
                ))}
                <motion.path d="M150 31 L120 61 M270 61 L330 61" stroke="var(--terra)" strokeWidth="2" strokeDasharray="4 4" fill="none" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ delay: 1, duration: 1 }} />
              </svg>
            </div>
          </Tile>

          <Tile className="md:col-span-5">
            <div className="flex h-full flex-col justify-between gap-6">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Budget engine</div>
                <h3 className="mt-2 font-display text-3xl font-semibold">Cent-exact, never guessed.</h3>
              </div>
              <div className="flex items-center gap-6 text-[var(--ink)]">
                <div className="relative">
                  <Ring pct={72} size={128} stroke={11} />
                  <div className="absolute inset-0 flex items-center justify-center font-display text-2xl font-semibold"><CountUp value={72} suffix="%" /></div>
                </div>
                <ul className="space-y-1.5 text-sm text-[var(--ink-2)]">
                  <li>Tax &amp; buffer built in</li>
                  <li>Guest-count simulator</li>
                  <li>Year-ahead price forecast</li>
                </ul>
              </div>
            </div>
          </Tile>

          <Tile className="md:col-span-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Quote decoder</div>
            <h3 className="mt-2 font-display text-3xl font-semibold">Read the fine print for you.</h3>
            <div className="mt-6 space-y-2 rounded-2xl border border-[var(--line)] bg-[var(--card-solid)] p-4 font-mono text-[12px] text-[var(--ink-2)]">
              <div className="flex justify-between"><span>Tent package</span><span>$5,000</span></div>
              <div className="relative flex justify-between">
                <motion.span className="absolute inset-x-[-4px] inset-y-0 -z-0 rounded bg-[var(--terra)]/20" initial={{ scaleX: 0, originX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ delay: 0.6, duration: 0.7 }} />
                <span className="relative">Service charge 20%</span><span className="relative font-semibold text-[var(--terra)]">+$1,000 hidden</span>
              </div>
              <div className="flex justify-between"><span>Cleaning fee</span><span>$300</span></div>
              <div className="mt-2 flex justify-between border-t border-[var(--line)] pt-2 font-semibold text-[var(--ink)]"><span>True cost</span><span>$7,625</span></div>
            </div>
          </Tile>

          <Tile className="md:col-span-7">
            <div className="grid h-full items-center gap-6 sm:grid-cols-[1fr_auto]">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Bring your own AI</div>
                <h3 className="mt-2 font-display text-3xl font-semibold">Your model. Your key. Your call.</h3>
                <p className="mt-2 max-w-md text-sm text-[var(--ink-2)]">Gemini, Claude, GPT, OpenRouter or any compatible endpoint. Paste a key, pick a model. No key? The built-in engine still plans.</p>
                <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--forest)] px-3.5 py-1.5 text-xs font-medium text-[#f6f0e4]"><ShieldCheck className="h-3.5 w-3.5" /> Stored in your browser only</div>
              </div>
              <div className="relative mx-auto h-44 w-44">
                <div className="absolute inset-[34%] flex items-center justify-center rounded-full bg-[var(--ink)] text-[var(--paper)]"><Cog className="h-6 w-6" /></div>
                <motion.div className="absolute inset-0" animate={{ rotate: 360 }} transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}>
                  {['Gemini', 'Claude', 'GPT', 'Router', 'Custom'].map((n, i) => (
                    <div key={n} className="absolute left-1/2 top-1/2" style={{ transform: `rotate(${i * 72}deg) translateY(-84px)` }}>
                      <motion.span className="-ml-6 -mt-3 inline-block rounded-full border border-[var(--line)] bg-[var(--card-solid)] px-2.5 py-1 text-[10px] font-semibold" style={{ rotate: -i * 72 }} animate={{ rotate: [-i * 72, -i * 72 - 360] }} transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}>{n}</motion.span>
                    </div>
                  ))}
                </motion.div>
              </div>
            </div>
          </Tile>

          <Tile className="md:col-span-6">
            <div className="grid items-center gap-4 sm:grid-cols-[1fr_9rem]">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Maps &amp; hotels</div>
                <h3 className="mt-2 font-display text-3xl font-semibold">Real places. No invented prices.</h3>
                <p className="mt-2 text-sm text-[var(--ink-2)]">Nearby hotels come from open map data, with links to live rates.</p>
              </div>
              <IsoPin className="pg-float mx-auto w-32" />
            </div>
          </Tile>

          <Tile className="md:col-span-6">
            <div className="grid items-center gap-4 sm:grid-cols-[1fr_11rem]">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Calendar &amp; exports</div>
                <h3 className="mt-2 font-display text-3xl font-semibold">Into Google Calendar, no sign-in.</h3>
                <p className="mt-2 text-sm text-[var(--ink-2)]">One click adds the event with your guests. Or take an .ics, CSV or PDF.</p>
              </div>
              <div className="relative mx-auto h-32 w-44">
                <IsoCalendar className="pg-float absolute left-0 top-0 w-24" />
                <IsoEnvelope className="pg-float absolute bottom-0 right-0 w-28" />
              </div>
            </div>
          </Tile>
        </div>
      </section>

      {/* ============ BLUEPRINTS ============ */}
      <section id="blueprints" className="mx-auto max-w-[1280px] px-5 pb-28 sm:px-8">
        <Reveal>
          <Eyebrow>Blueprints</Eyebrow>
          <h2 className="max-w-3xl text-[clamp(2.2rem,5vw,4rem)] leading-[1.02]">Start from a shape that fits.</h2>
        </Reveal>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {BLUEPRINTS.map((b, i) => (
            <Reveal key={b.n} delay={i * 0.1}>
              <button type="button" onClick={() => onOpenChooser()} className="group relative block h-full w-full overflow-hidden rounded-[1.75rem] border border-[var(--line)] bg-[var(--card)] p-8 text-left backdrop-blur transition-transform duration-500 hover:-translate-y-2">
                <div className="font-display text-[7rem] font-semibold italic leading-none opacity-90 transition-transform duration-700 group-hover:translate-x-2" style={{ color: b.tone }}>{b.n}</div>
                <h3 className="mt-2 font-display text-3xl font-semibold">{b.title}</h3>
                <p className="mt-2 text-sm text-[var(--ink-2)]">{b.copy}</p>
                <div className="mt-6 flex items-center justify-between text-sm font-semibold">
                  <span className="font-mono text-xs text-[var(--muted)]">Typical · <CountUp value={b.stat} /> {b.unit}</span>
                  <span className="inline-flex items-center gap-1 text-[var(--ink)]">Start <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></span>
                </div>
              </button>
            </Reveal>
          ))}
        </div>

        {existingEvents.length > 0 && (
          <Reveal className="mt-14">
            <div className="mb-4 font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">Pick up where you left off</div>
            <ul className="divide-y divide-[var(--line)] overflow-hidden rounded-[1.5rem] border border-[var(--line)] bg-[var(--card)] backdrop-blur">
              {existingEvents.slice(0, 5).map((ev) => (
                <li key={ev.id}>
                  <button type="button" onClick={() => onEnterWorkspaceDirect(ev.id)} className="group flex w-full items-center justify-between gap-4 px-6 py-4 text-left transition-colors hover:bg-[var(--line)]">
                    <span className="min-w-0">
                      <span className="block truncate font-display text-lg font-semibold">{ev.title}</span>
                      <span className="block truncate text-xs text-[var(--muted)]">{ev.location} · {ev.date}</span>
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-[var(--ink-2)] group-hover:text-[var(--ink)]">Open <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
                  </button>
                </li>
              ))}
            </ul>
          </Reveal>
        )}
      </section>

      {/* ============ CTA ============ */}
      <section className="relative overflow-hidden bg-[var(--forest)] px-5 py-28 text-center text-[#f6f0e4] sm:px-8">
        <Botanical className="pointer-events-none absolute -left-6 bottom-0 h-72 text-[#e7c27b] opacity-30" />
        <Botanical className="pointer-events-none absolute -right-6 bottom-0 h-72 text-[#e7c27b] opacity-30" flip delay={0.3} />
        <Reveal>
          <h2 className="mx-auto max-w-4xl text-[clamp(2.6rem,7vw,5.6rem)] leading-[0.98] text-[#f6f0e4]">
            Your next celebration <em className="text-[#e7c27b]">starts here.</em>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-white/70">Free, private and ready in a minute. Your plans never leave your browser.</p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Magnetic>
              <button type="button" onClick={() => onStartWithAiChat()} className="inline-flex items-center gap-2.5 rounded-full bg-[#f6f0e4] px-8 py-4 text-base font-semibold text-[#1f3328] shadow-2xl">
                Begin a plan <ArrowRight className="h-4 w-4" />
              </button>
            </Magnetic>
            <button type="button" onClick={() => onEnterWorkspaceDirect()} className="inline-flex items-center gap-2 rounded-full border border-white/25 px-7 py-4 text-base font-semibold text-white/90 transition-colors hover:bg-white/10">
              <CalendarCheck className="h-4 w-4" /> Open the sample workspace
            </button>
          </div>
        </Reveal>
      </section>

      <footer className="bg-[#0d0c0a] px-5 py-10 text-sm text-white/55 sm:px-8">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-display text-lg text-[#f6f0e4]"><Sparkle className="h-4 w-4 text-[#e7c27b]" /> PlanGenie</div>
          <div className="flex items-center gap-6">
            <a href="/privacy" className="hover:text-white">Privacy</a>
            <a href="/terms" className="hover:text-white">Terms</a>
            <button type="button" onClick={() => onStartWithAiChat()} className="hover:text-white">Plan with AI</button>
          </div>
          <div className="text-xs">Maps © OpenStreetMap contributors</div>
        </div>
      </footer>
    </div>
  );
};
