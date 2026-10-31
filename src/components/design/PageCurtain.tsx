import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { Sparkle } from './Illustrations';

/**
 * Full-screen "curtain" that sweeps across when the screen changes: two forest panels close,
 * the logo flashes, then they open to reveal the new screen. Content swaps behind it.
 */
export function PageCurtain({ trigger }: { trigger: string }) {
  const reduce = useReducedMotion();
  const first = useRef(true);
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduce) return;
    setRun((n) => n + 1);
  }, [trigger, reduce]);

  return (
    <AnimatePresence>
      {run > 0 && (
        <motion.div key={run} className="pointer-events-none fixed inset-0 z-[90]" initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onAnimationComplete={() => undefined}>
          {[0, 1].map((side) => (
            <motion.div
              key={side}
              className="absolute top-0 h-full w-1/2 bg-[#1f3328]"
              style={{ [side === 0 ? 'left' : 'right']: 0 }}
              initial={{ scaleX: 0, transformOrigin: side === 0 ? 'left' : 'right' }}
              animate={{ scaleX: [0, 1, 1, 0], transformOrigin: [side === 0 ? 'left' : 'right', side === 0 ? 'left' : 'right', side === 0 ? 'right' : 'left', side === 0 ? 'right' : 'left'] }}
              transition={{ duration: 1.15, times: [0, 0.38, 0.55, 1], ease: [0.76, 0, 0.24, 1] }}
            >
              <div className="absolute inset-0 opacity-30" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(231,194,123,.35), transparent 60%)' }} />
            </motion.div>
          ))}
          <motion.div
            className="absolute inset-0 flex items-center justify-center gap-3 text-[#f6f0e4]"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: [0, 1, 1, 0], scale: [0.9, 1, 1, 1.06] }}
            transition={{ duration: 1.15, times: [0.25, 0.4, 0.55, 0.7] }}
          >
            <Sparkle className="h-7 w-7 text-[#e7c27b]" />
            <span className="font-display text-3xl tracking-tight">PlanGenie</span>
          </motion.div>
          <CurtainDone onDone={() => setRun(0)} ms={1250} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CurtainDone({ onDone, ms }: { onDone: () => void; ms: number }) {
  useEffect(() => {
    const t = setTimeout(onDone, ms);
    return () => clearTimeout(t);
  }, [onDone, ms]);
  return null;
}
