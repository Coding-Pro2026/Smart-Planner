import { animate, motion, useInView, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react';
import React, { useEffect, useRef, useState } from 'react';

export const EASE = [0.2, 0.7, 0.2, 1] as const;

/** Scroll-triggered fade/translate. */
export function Reveal({ children, delay = 0, y = 28, className, once = true }: { children: React.ReactNode; delay?: number; y?: number; className?: string; once?: boolean }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: '-8% 0px' }}
      transition={{ duration: 0.8, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/** Masked word-by-word headline reveal; words in `accent` render in italic gold. */
export function RevealWords({ text, className, delay = 0, accent = [], stagger = 0.07 }: { text: string; className?: string; delay?: number; accent?: string[]; stagger?: number }) {
  const words = text.split(' ');
  return (
    <span className={className} aria-label={text}>
      {words.map((w, i) => {
        const isAccent = accent.includes(w.replace(/[.,]/g, ''));
        return (
          <span key={i} aria-hidden="true" className="inline-block overflow-hidden align-bottom pb-[0.12em] -mb-[0.12em]">
            <motion.span
              className={`inline-block will-change-transform ${isAccent ? 'italic text-[var(--terra)]' : ''}`}
              initial={{ y: '115%', rotate: 4 }}
              animate={{ y: 0, rotate: 0 }}
              transition={{ duration: 0.9, delay: delay + i * stagger, ease: EASE }}
            >
              {w}
              {i < words.length - 1 ? ' ' : ''}
            </motion.span>
          </span>
        );
      })}
    </span>
  );
}

/** Counts from 0 to `value` when scrolled into view. */
export function CountUp({ value, prefix = '', suffix = '', duration = 1.6, className, decimals = 0 }: { value: number; prefix?: string; suffix?: string; duration?: number; className?: string; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-10% 0px' });
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? value : 0);
  useEffect(() => {
    if (!inView || reduce) return;
    const c = animate(0, value, { duration, ease: EASE, onUpdate: (v) => setN(v) });
    return () => c.stop();
  }, [inView, value, duration, reduce]);
  return (
    <span ref={ref} className={className}>
      {prefix}
      {n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

/** 3D tilt that follows the pointer; flat on touch / reduced motion. */
export function Tilt3D({ children, max = 9, className, style, glare = true }: { children: React.ReactNode; max?: number; className?: string; style?: React.CSSProperties; glare?: boolean }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rx = useSpring(useTransform(py, [-0.5, 0.5], [max, -max]), { stiffness: 160, damping: 18 });
  const ry = useSpring(useTransform(px, [-0.5, 0.5], [-max, max]), { stiffness: 160, damping: 18 });
  const gx = useTransform(px, [-0.5, 0.5], ['0%', '100%']);
  const gy = useTransform(py, [-0.5, 0.5], ['0%', '100%']);
  const glareBg = useTransform([gx, gy], ([x, y]: string[]) => `radial-gradient(420px circle at ${x} ${y}, rgba(255,255,255,0.35), transparent 55%)`);
  const onMove = (e: React.PointerEvent) => {
    if (reduce || e.pointerType === 'touch') return;
    const r = ref.current!.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  };
  const reset = () => {
    px.set(0);
    py.set(0);
  };
  return (
    <div style={{ perspective: 1100 }} className={className}>
      <motion.div ref={ref} onPointerMove={onMove} onPointerLeave={reset} style={{ rotateX: rx, rotateY: ry, transformStyle: 'preserve-3d', ...style }} className="relative h-full">
        {children}
        {glare && !reduce && <motion.div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] mix-blend-soft-light" style={{ background: glareBg }} />}
      </motion.div>
    </div>
  );
}

/** Button that is gently pulled toward the cursor. */
export function Magnetic({ children, className, strength = 0.25 }: { children: React.ReactNode; className?: string; strength?: number }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const x = useSpring(useMotionValue(0), { stiffness: 220, damping: 16 });
  const y = useSpring(useMotionValue(0), { stiffness: 220, damping: 16 });
  return (
    <motion.div
      ref={ref}
      className={`inline-block ${className ?? ''}`}
      style={{ x, y }}
      onPointerMove={(e) => {
        if (reduce || e.pointerType === 'touch') return;
        const r = ref.current!.getBoundingClientRect();
        x.set((e.clientX - (r.left + r.width / 2)) * strength);
        y.set((e.clientY - (r.top + r.height / 2)) * strength);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}
