import { motion, useMotionValueEvent, useScroll, useTransform } from 'motion/react';
import { useLayoutEffect, useRef, useState } from 'react';
import { CalendarRange, Coins, FileSearch, MapPin, PenLine, Users, type LucideIcon } from 'lucide-react';

interface Step {
  title: string;
  body: string;
  Icon: LucideIcon;
}
const STEPS: Step[] = [
  { title: 'Brief', body: 'Describe the day in plain English. Type, place, guests, budget and date are pulled out for you.', Icon: PenLine },
  { title: 'Budget', body: 'Per-guest maths with tax and a safety buffer, simulated before you commit.', Icon: Coins },
  { title: 'Timeline', body: 'A critical-path schedule that re-flows everything when one date moves.', Icon: CalendarRange },
  { title: 'Vendors', body: 'Paste any quote. Hidden fees and risky clauses come out on the table.', Icon: FileSearch },
  { title: 'Guests', body: 'Invites, RSVPs, dietary needs and seating, tracked in one place.', Icon: Users },
  { title: 'The day', body: 'Export the run sheet, add it to your calendar and relax.', Icon: MapPin },
];
const PATH = 'M70 215 C170 215 190 175 300 175 S440 255 560 235 S700 165 820 180 S980 255 1130 205';
const FRACS = [0, 0.19, 0.39, 0.58, 0.79, 1];

/** Scroll-drawn journey diagram: the line draws as you scroll and each stage lights up when reached. */
export function FlowDiagram() {
  const wrap = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const [pts, setPts] = useState<{ x: number; y: number }[]>([]);
  const [reached, setReached] = useState(0);
  const { scrollYProgress } = useScroll({ target: wrap, offset: ['start 70%', 'end 45%'] });
  const draw = useTransform(scrollYProgress, [0, 1], [0, 1]);

  useLayoutEffect(() => {
    const p = pathRef.current;
    if (!p) return;
    const len = p.getTotalLength();
    setPts(FRACS.map((f) => {
      const pt = p.getPointAtLength(len * f);
      return { x: pt.x, y: pt.y };
    }));
  }, []);

  useMotionValueEvent(draw, 'change', (v) => setReached(FRACS.filter((f) => v >= f - 0.01).length));

  return (
    <div ref={wrap}>
      {/* desktop: horizontal wave */}
      <div className="relative hidden md:block">
        <svg viewBox="0 0 1200 430" className="w-full overflow-visible" role="img" aria-label="Planning journey from brief to the day">
          <path ref={pathRef} d={PATH} fill="none" stroke="var(--line)" strokeWidth="2" strokeDasharray="2 9" strokeLinecap="round" />
          <motion.path d={PATH} fill="none" stroke="var(--terra)" strokeWidth="3.5" strokeLinecap="round" style={{ pathLength: draw }} />
          {pts.map((pt, i) => {
            const on = i < reached;
            const above = i % 2 === 0;
            const { Icon } = STEPS[i];
            return (
              <g key={STEPS[i].title}>
                <motion.circle cx={pt.x} cy={pt.y} r={28} fill="var(--card-solid)" stroke={on ? 'var(--terra)' : 'var(--line)'} strokeWidth="2" style={{ transformBox: 'fill-box', transformOrigin: 'center' }} animate={{ scale: on ? 1.08 : 0.8 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }} />
                {on && <motion.circle cx={pt.x} cy={pt.y} r={30} fill="none" stroke="var(--terra)" strokeOpacity="0.4" style={{ transformBox: 'fill-box', transformOrigin: 'center' }} initial={{ scale: 1, opacity: 0.7 }} animate={{ scale: 1.8, opacity: 0 }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }} />}
                <foreignObject x={pt.x - 14} y={pt.y - 14} width="28" height="28">
                  <div className="flex h-full w-full items-center justify-center" style={{ color: on ? 'var(--terra)' : 'var(--muted)' }}>
                    <Icon className="h-5 w-5" />
                  </div>
                </foreignObject>
                <foreignObject x={pt.x - 120} y={above ? pt.y - 158 : pt.y + 50} width="240" height="118">
                  <div className={`text-center transition-opacity duration-500 ${on ? 'opacity-100' : 'opacity-35'}`}>
                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">0{i + 1}</div>
                    <div className="font-display text-2xl font-semibold text-[var(--ink)]">{STEPS[i].title}</div>
                    <p className="mx-auto mt-1 max-w-[210px] text-[12px] leading-snug text-[var(--ink-2)]">{STEPS[i].body}</p>
                  </div>
                </foreignObject>
              </g>
            );
          })}
        </svg>
      </div>

      {/* mobile: vertical rail */}
      <div className="relative md:hidden">
        <div className="absolute left-[19px] top-2 bottom-2 w-px bg-[var(--line)]" />
        <motion.div className="absolute left-[18px] top-2 bottom-2 w-[3px] origin-top rounded-full bg-[var(--terra)]" style={{ scaleY: draw }} />
        <ol className="space-y-8">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative pl-14">
              <span className={`absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-full border-2 bg-[var(--card-solid)] transition-colors ${i < reached ? 'border-[var(--terra)] text-[var(--terra)]' : 'border-[var(--line)] text-[var(--muted)]'}`}>
                <s.Icon className="h-4 w-4" />
              </span>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">0{i + 1}</div>
              <div className="font-display text-xl font-semibold text-[var(--ink)]">{s.title}</div>
              <p className="text-sm leading-snug text-[var(--ink-2)]">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
