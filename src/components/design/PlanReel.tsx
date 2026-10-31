import { AnimatePresence, motion, useInView, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { Check, Pause, Play } from 'lucide-react';
import { CountUp, EASE } from './primitives';
import { IsoEnvelope } from './Illustrations';

const SCENE_MS = 7200;
const PROMPT = '40th birthday in Austin for 60 guests, $9k budget, on March 14';
const CHIPS = [
  ['Type', 'Birthday'],
  ['Place', 'Austin, TX'],
  ['Guests', '60'],
  ['Budget', '$9,000'],
  ['Date', 'Mar 14'],
];
const SCENES = [
  { n: '01', title: 'Describe it', line: 'One sentence in. Structure out.' },
  { n: '02', title: 'It assembles', line: 'Timeline, checklist and tabs appear, tailored to your event.' },
  { n: '03', title: 'Money, honestly', line: 'Real maths, not guesses: tax, buffer and a forecast.' },
  { n: '04', title: 'Guests reply', line: 'Invites go out. Answers roll in.' },
];

function useTyping(text: string, active: boolean, ms = 38) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!active) return;
    setN(0);
    const t = setInterval(() => setN((v) => (v >= text.length ? v : v + 1)), ms);
    return () => clearInterval(t);
  }, [text, active, ms]);
  return text.slice(0, n);
}

function SceneDescribe() {
  const typed = useTyping(PROMPT, true);
  return (
    <div className="flex h-full flex-col justify-center gap-4 p-5 sm:gap-5 sm:p-12">
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--card-solid)] p-4 shadow-sm sm:p-5">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Plan with AI</div>
        <p className="font-display text-lg leading-snug text-[var(--ink)] sm:text-2xl">
          {typed}
          <span className="pg-caret ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[3px] bg-[var(--terra)]" />
        </p>
      </div>
      <div className="flex flex-wrap gap-2.5">
        {CHIPS.map(([k, v], i) => (
          <motion.div key={k} initial={{ opacity: 0, y: 14, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 2.4 + i * 0.35, type: 'spring', stiffness: 300, damping: 20 }} className="rounded-xl border border-[var(--line)] bg-[var(--paper-2)] px-3 py-1.5 sm:px-3.5 sm:py-2">
            <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--muted)]">{k}</div>
            <div className="text-sm font-semibold text-[var(--ink)]">{v}</div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function SceneAssemble() {
  const rows = [
    ['Book rooftop venue', 4, 30, true],
    ['Confirm DJ & sound', 22, 28, false],
    ['Order cake', 38, 22, false],
    ['Send invitations', 20, 24, true],
    ['Final headcount', 58, 30, true],
  ] as const;
  return (
    <div className="grid h-full grid-cols-1 content-center gap-4 p-5 sm:grid-cols-5 sm:gap-5 sm:p-9">
      <div className="rounded-2xl sm:col-span-3 border border-[var(--line)] bg-[var(--card-solid)] p-5">
        <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Timeline</div>
        <div className="space-y-3.5">
          {rows.map(([l, left, w, crit], i) => (
            <div key={l} className="flex items-center gap-3">
              <span className="w-28 shrink-0 truncate text-xs text-[var(--ink-2)]">{l}</span>
              <div className="relative h-3 flex-1 rounded-full bg-[var(--line)]">
                <motion.span className="absolute top-0 h-full rounded-full" style={{ left: `${left}%`, background: crit ? 'var(--forest)' : 'var(--sage)' }} initial={{ width: 0 }} animate={{ width: `${w}%` }} transition={{ delay: 0.5 + i * 0.35, duration: 1, ease: EASE }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--card-solid)] p-5 sm:col-span-2">
        <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Checklist</div>
        <ul className="space-y-2.5 sm:space-y-3">
          {['Toast speaking order', 'Playlist plan', 'Surprise video', 'Out-of-town hotels'].map((t, i) => (
            <motion.li key={t} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8 + i * 0.4 }} className="flex items-center gap-2.5 text-xs text-[var(--ink)]">
              <motion.span className="flex h-4 w-4 items-center justify-center rounded-full border border-[var(--forest)]" animate={{ backgroundColor: ['rgba(44,70,54,0)', 'rgba(44,70,54,1)'] }} transition={{ delay: 2.2 + i * 0.45, duration: 0.3 }}>
                <Check className="h-2.5 w-2.5 text-white" />
              </motion.span>
              {t}
            </motion.li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function SceneMoney() {
  const segs = [
    ['Venue', 32, '#2c4636'],
    ['Food & bar', 36, '#c86d51'],
    ['Music', 10, '#b88b4a'],
    ['Decor', 12, '#8fa58a'],
    ['Buffer', 10, '#d9cdb2'],
  ] as const;
  return (
    <div className="flex h-full flex-col justify-center gap-5 p-5 sm:gap-6 sm:p-12">
      <div className="flex items-end justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Projected spend</div>
          <div className="font-display text-3xl font-semibold text-[var(--ink)] sm:text-5xl">
            <CountUp value={8640} prefix="$" duration={2.4} />
          </div>
        </div>
        <div className="rounded-full bg-[var(--forest)] px-3 py-1 text-xs font-medium text-[#f6f0e4]">96% of target</div>
      </div>
      <div className="flex h-5 overflow-hidden rounded-full bg-[var(--line)]">
        {segs.map(([l, w, c], i) => (
          <motion.div key={l} style={{ background: c }} initial={{ width: 0 }} animate={{ width: `${w}%` }} transition={{ delay: 0.4 + i * 0.25, duration: 0.9, ease: EASE }} title={l} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-[var(--ink-2)]">
        {segs.map(([l, , c]) => (
          <span key={l} className="inline-flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-full" style={{ background: c }} />
            {l}
          </span>
        ))}
      </div>
      <svg viewBox="0 0 400 90" className="w-full" aria-hidden="true">
        <motion.path d="M0 70 C60 66 100 60 150 52 S250 30 300 22 S370 10 400 6" fill="none" stroke="var(--terra)" strokeWidth="3" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 1.6, duration: 2.2, ease: EASE }} />
        <motion.path d="M0 70 C60 66 100 60 150 52 S250 30 300 22 S370 10 400 6 L400 90 L0 90Z" fill="var(--terra)" opacity="0.1" initial={{ opacity: 0 }} animate={{ opacity: 0.12 }} transition={{ delay: 3.2 }} />
      </svg>
      <div className="text-xs text-[var(--muted)]">Booking early locks today’s rates — forecast shows what waiting costs.</div>
    </div>
  );
}

function SceneGuests() {
  return (
    <div className="relative grid h-full grid-cols-1 content-center items-center gap-4 p-5 sm:grid-cols-5 sm:gap-6 sm:p-12">
      <div className="sm:col-span-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Confirmed</div>
        <div className="font-display text-4xl font-semibold text-[var(--ink)] sm:text-5xl">
          <CountUp value={52} duration={3.4} /> <span className="text-2xl font-normal text-[var(--muted)]">/ 60</span>
        </div>
        <div className="mt-5 grid grid-cols-10 gap-1.5">
          {Array.from({ length: 60 }).map((_, i) => (
            <motion.span key={i} className="aspect-square rounded-full" style={{ background: i < 52 ? 'var(--forest)' : 'var(--line)' }} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.3 + i * 0.045, type: 'spring', stiffness: 380, damping: 20 }} />
          ))}
        </div>
      </div>
      <div className="hidden items-center justify-center sm:col-span-2 sm:flex">
        <motion.div initial={{ x: -120, y: 40, rotate: -14, opacity: 0 }} animate={{ x: 0, y: 0, rotate: 0, opacity: 1 }} transition={{ delay: 0.5, duration: 1.4, ease: EASE }} className="w-40">
          <IsoEnvelope />
        </motion.div>
      </div>
    </div>
  );
}

const SCENE_COMPONENTS = [SceneDescribe, SceneAssemble, SceneMoney, SceneGuests];

/** The "motion picture": an auto-playing, scripted film of the product built from live SVG + motion. */
export function PlanReel() {
  const wrap = useRef<HTMLDivElement>(null);
  const inView = useInView(wrap, { margin: '-20% 0px' });
  const reduce = useReducedMotion();
  const [scene, setScene] = useState(0);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(true);
  const running = playing && inView && !reduce;

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      setProgress((p) => {
        const next = p + 100 / SCENE_MS;
        if (next >= 1) {
          setScene((s) => (s + 1) % SCENES.length);
          return 0;
        }
        return next;
      });
    }, 100);
    return () => clearInterval(t);
  }, [running]);

  const go = (i: number) => {
    setScene(i);
    setProgress(0);
  };
  const Scene = SCENE_COMPONENTS[scene];

  return (
    <div ref={wrap} className="grid gap-8 lg:grid-cols-[1.55fr_1fr] lg:items-center">
      {/* the screen */}
      <div className="relative">
        <div className="absolute -inset-6 rounded-[2.5rem] bg-[radial-gradient(closest-side,rgba(200,109,81,0.35),transparent)] blur-2xl" aria-hidden="true" />
        <div className="relative overflow-hidden rounded-[1.6rem] border border-white/10 bg-[#0d0c0a] p-2 shadow-[0_50px_100px_-30px_rgba(0,0,0,0.8)]">
          <div className="flex items-center gap-2 px-3 py-2">
            <i className="h-2.5 w-2.5 rounded-full bg-[#ff6159]" />
            <i className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
            <i className="h-2.5 w-2.5 rounded-full bg-[#28c940]" />
            <span className="ml-3 rounded-md bg-white/5 px-3 py-0.5 font-mono text-[10px] text-white/40">plangenie.app / {SCENES[scene].title.toLowerCase().replace(/[^a-z]+/g, '-')}</span>
          </div>
          <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-[var(--paper)] sm:aspect-[16/10]">
            <AnimatePresence mode="wait">
              <motion.div
                key={scene}
                className="absolute inset-0"
                initial={{ opacity: 0, scale: 1.06, filter: 'blur(8px)' }}
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 0.97, filter: 'blur(6px)' }}
                transition={{ duration: 0.7, ease: EASE }}
              >
                <motion.div className="h-full" animate={reduce ? undefined : { scale: 1.035 }} transition={{ duration: SCENE_MS / 1000, ease: 'linear' }}>
                  <Scene />
                </motion.div>
              </motion.div>
            </AnimatePresence>
            {/* lower third */}
            <AnimatePresence mode="wait">
              <motion.div key={scene} className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-end justify-between" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: 0.5, duration: 0.6 }}>
                <div className="rounded-xl bg-[#0d0c0a]/85 px-4 py-2 text-[#f6f0e4] backdrop-blur">
                  <span className="mr-2 font-mono text-[10px] text-[#e7c27b]">{SCENES[scene].n}</span>
                  <span className="font-display text-sm">{SCENES[scene].title}</span>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* chapters */}
      <div>
        <ol className="space-y-2.5">
          {SCENES.map((s, i) => (
            <li key={s.n}>
              <button type="button" onClick={() => go(i)} aria-current={scene === i} className={`group relative w-full overflow-hidden rounded-2xl border px-5 py-4 text-left transition-colors ${scene === i ? 'border-white/25 bg-white/[0.07]' : 'border-white/10 hover:bg-white/[0.04]'}`}>
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-xs text-[#e7c27b]">{s.n}</span>
                  <span className="font-display text-lg text-[#f6f0e4]">{s.title}</span>
                </div>
                <AnimatePresence initial={false}>
                  {scene === i && (
                    <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pt-1 text-sm text-white/60">
                      {s.line}
                    </motion.p>
                  )}
                </AnimatePresence>
                <span className="absolute bottom-0 left-0 h-[2px] bg-[#c86d51]" style={{ width: scene === i ? `${progress * 100}%` : i < scene ? '100%' : '0%', transition: scene === i ? 'none' : 'width .4s' }} />
              </button>
            </li>
          ))}
        </ol>
        <button type="button" onClick={() => setPlaying((p) => !p)} className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-white/80 hover:bg-white/10">
          {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          {playing ? 'Pause reel' : 'Play reel'}
        </button>
      </div>
    </div>
  );
}
