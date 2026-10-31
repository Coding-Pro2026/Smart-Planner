import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from 'motion/react';
import { useEffect, useRef } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { CountUp, EASE } from './primitives';
import { IsoCalendar, IsoPin, Ring, Sparkle } from './Illustrations';

const ROWS = [
  { label: 'Venue contract', left: 0, w: 34, crit: true },
  { label: 'Catering tasting', left: 26, w: 30, crit: true },
  { label: 'Florist & decor', left: 18, w: 26, crit: false },
  { label: 'Invitations out', left: 48, w: 22, crit: false },
  { label: 'Final headcount', left: 66, w: 28, crit: true },
];
const AVATARS = ['#c86d51', '#8fa58a', '#b88b4a', '#2c4636', '#d9a38c', '#6f8f7a', '#a6784a'];

/** The hero's 3D planning board: layered cards in real perspective that follow the cursor and the scroll. */
export function HeroBoard() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rotY = useSpring(useTransform(px, [-0.5, 0.5], [-16, -2]), { stiffness: 70, damping: 16 });
  const rotX = useSpring(useTransform(py, [-0.5, 0.5], [12, 2]), { stiffness: 70, damping: 16 });
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const scrollRot = useTransform(scrollYProgress, [0, 1], [0, 16]);
  const scrollLift = useTransform(scrollYProgress, [0, 1], [0, -60]);

  useEffect(() => {
    if (reduce) return;
    const move = (e: PointerEvent) => {
      px.set(e.clientX / window.innerWidth - 0.5);
      py.set(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => window.removeEventListener('pointermove', move);
  }, [reduce, px, py]);

  const enter = (delay: number, z: number) => ({
    initial: { opacity: 0, y: 60, translateZ: z - 140 },
    animate: { opacity: 1, y: 0, translateZ: z },
    transition: { duration: 1.1, delay, ease: EASE },
  });

  return (
    <div ref={ref} className="relative mx-auto aspect-[6/5] w-full max-w-[640px]" style={{ perspective: 1700 }}>
      <motion.div className="absolute inset-0" style={{ rotateX: reduce ? 6 : rotX, rotateY: reduce ? -8 : rotY, rotateZ: scrollRot, y: scrollLift, transformStyle: 'preserve-3d' }}>
        {/* base plate */}
        <motion.div
          {...enter(0.1, 0)}
          className="absolute inset-[4%] rounded-[2rem] border border-[var(--line)] bg-[var(--card-solid)]"
          style={{ boxShadow: 'var(--shadow-3d)', backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(27,26,23,.10) 1px, transparent 0)', backgroundSize: '22px 22px' }}
        >
          <div className="flex items-center justify-between px-7 pt-6 text-[11px] font-mono uppercase tracking-[0.18em] text-[var(--muted)]">
            <span>Aurelia &amp; Julian</span>
            <span>15 · 05 · 2027</span>
          </div>
          <div className="mx-7 mt-2 h-px bg-[var(--line)]" />
        </motion.div>

        {/* timeline card */}
        <motion.div {...enter(0.35, 46)} className="absolute left-[6%] top-[15%] w-[51%] rounded-2xl border border-[var(--line)] bg-[var(--card-solid)] p-4" style={{ boxShadow: 'var(--shadow-3d)' }}>
          <div className="mb-3 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--muted)]">
            <span>Critical path</span>
            <span className="text-[var(--forest-2)]">T-196 d</span>
          </div>
          <div className="space-y-2.5">
            {ROWS.map((r, i) => (
              <div key={r.label} className="flex items-center gap-3">
                <span className="w-[74px] shrink-0 truncate text-[10px] text-[var(--ink-2)]">{r.label}</span>
                <div className="relative h-2.5 flex-1 rounded-full bg-[var(--line)]">
                  <motion.span
                    className="absolute top-0 h-full rounded-full"
                    style={{ left: `${r.left}%`, background: r.crit ? 'var(--forest)' : 'var(--sage)' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${r.w}%` }}
                    transition={{ duration: 1.1, delay: 0.9 + i * 0.12, ease: EASE }}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* budget card */}
        <motion.div {...enter(0.5, 96)} className="absolute right-[4%] top-[34%] w-[36%] rounded-2xl border border-[var(--line)] bg-[var(--card-solid)] p-4" style={{ boxShadow: 'var(--shadow-3d)' }}>
          <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--muted)]">Budget</div>
          <div className="relative mt-1 flex items-center justify-center text-[var(--ink)]">
            <Ring pct={95} size={118} stroke={9} delay={0.8} />
            <div className="absolute text-center leading-tight">
              <div className="font-display text-xl font-semibold">
                <CountUp value={64822} prefix="$" duration={2} />
              </div>
              <div className="text-[9px] text-[var(--muted)]">of $68,000</div>
            </div>
          </div>
        </motion.div>

        {/* guests card */}
        <motion.div {...enter(0.65, 70)} className="absolute bottom-[10%] left-[10%] w-[48%] rounded-2xl border border-[var(--line)] bg-[var(--card-solid)] p-4" style={{ boxShadow: 'var(--shadow-3d)' }}>
          <div className="flex items-end justify-between">
            <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--muted)]">RSVPs</div>
            <div className="font-display text-lg font-semibold text-[var(--ink)]">
              <CountUp value={142} /> <span className="text-xs font-normal text-[var(--muted)]">/ 160</span>
            </div>
          </div>
          <div className="mt-3 flex -space-x-2">
            {AVATARS.map((c, i) => (
              <motion.span
                key={c}
                className="h-7 w-7 rounded-full border-2 border-[var(--card-solid)]"
                style={{ background: c }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 1.2 + i * 0.07, type: 'spring', stiffness: 400, damping: 18 }}
              />
            ))}
            <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[var(--card-solid)] bg-[var(--paper-2)] text-[9px] font-semibold text-[var(--ink-2)]">+135</span>
          </div>
        </motion.div>

        {/* floating chips */}
        <motion.div {...enter(0.9, 150)} className="absolute left-[2%] top-[5%] flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--forest)] px-3 py-1.5 text-[11px] font-medium text-[#f6f0e4]" style={{ boxShadow: 'var(--shadow-3d)' }}>
          <Sparkle className="h-3 w-3 text-[#e7c27b]" /> Florist booked
        </motion.div>
        <motion.div {...enter(1.05, 160)} className="absolute bottom-[4%] right-[8%] flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--card-solid)] px-3 py-1.5 text-[11px] font-medium text-[var(--ink)]" style={{ boxShadow: 'var(--shadow-3d)' }}>
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Rain plan ready
        </motion.div>

        {/* isometric props */}
        <motion.div {...enter(1.1, 190)} className="pg-float absolute -right-[7%] -top-[13%] w-[17%]" style={{ ['--r' as string]: '4deg' }}>
          <IsoPin />
        </motion.div>
        <motion.div {...enter(1.25, 120)} className="pg-float absolute -left-[9%] -bottom-[7%] w-[20%]" style={{ ['--r' as string]: '-5deg', animationDelay: '-3s' }}>
          <IsoCalendar />
        </motion.div>
      </motion.div>
    </div>
  );
}
