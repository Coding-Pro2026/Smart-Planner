import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from 'motion/react';
import { useEffect } from 'react';

/**
 * Living background: drifting colour fields, a faint architectural grid, and a cursor spotlight.
 * Pure transforms (GPU), paused when the user prefers reduced motion.
 */
export function Backdrop({ variant = 'hero' }: { variant?: 'hero' | 'workspace' }) {
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const driftA = useTransform(scrollY, [0, 1600], [0, -180]);
  const driftB = useTransform(scrollY, [0, 1600], [0, 140]);
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.3);
  const sx = useSpring(mx, { stiffness: 60, damping: 20 });
  const sy = useSpring(my, { stiffness: 60, damping: 20 });
  const spot = useTransform([sx, sy], ([x, y]: number[]) => `radial-gradient(600px circle at ${x * 100}% ${y * 100}%, rgba(184,139,74,0.16), transparent 60%)`);

  useEffect(() => {
    if (variant !== 'hero' || reduce) return;
    const move = (e: PointerEvent) => {
      mx.set(e.clientX / window.innerWidth);
      my.set(e.clientY / window.innerHeight);
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => window.removeEventListener('pointermove', move);
  }, [variant, reduce, mx, my]);

  const calm = variant === 'workspace';
  const loop = (d: number) => ({ duration: d, repeat: Infinity, repeatType: 'mirror' as const, ease: 'easeInOut' as const });

  return (
    <div aria-hidden="true" className="fixed inset-0 -z-10 overflow-hidden bg-[var(--paper)]">
      {/* colour fields */}
      <motion.div style={{ y: driftA }} className="absolute inset-0">
        <motion.div
          className="absolute -left-[10%] -top-[15%] h-[62vmax] w-[62vmax] rounded-full"
          style={{ background: 'radial-gradient(closest-side, rgba(143,165,138,0.55), transparent)', opacity: calm ? 0.45 : 0.9 }}
          animate={reduce ? undefined : { x: [0, 90, -30], y: [0, 60, -20], scale: [1, 1.12, 0.96] }}
          transition={loop(22)}
        />
        <motion.div
          className="absolute -right-[12%] top-[8%] h-[52vmax] w-[52vmax] rounded-full"
          style={{ background: 'radial-gradient(closest-side, rgba(200,109,81,0.42), transparent)', opacity: calm ? 0.3 : 0.85 }}
          animate={reduce ? undefined : { x: [0, -70, 40], y: [0, 80, -30], scale: [1, 0.94, 1.1] }}
          transition={loop(27)}
        />
      </motion.div>
      <motion.div style={{ y: driftB }} className="absolute inset-0">
        <motion.div
          className="absolute left-[22%] top-[55%] h-[46vmax] w-[46vmax] rounded-full"
          style={{ background: 'radial-gradient(closest-side, rgba(184,139,74,0.40), transparent)', opacity: calm ? 0.28 : 0.8 }}
          animate={reduce ? undefined : { x: [0, 60, -60], y: [0, -50, 30], scale: [1, 1.08, 0.98] }}
          transition={loop(31)}
        />
      </motion.div>

      {/* architectural grid, masked to fade out */}
      <svg className="absolute inset-0 h-full w-full text-[var(--ink)]" style={{ opacity: calm ? 0.035 : 0.06, maskImage: 'radial-gradient(ellipse at 50% 30%, black 20%, transparent 75%)', WebkitMaskImage: 'radial-gradient(ellipse at 50% 30%, black 20%, transparent 75%)' }}>
        <defs>
          <pattern id="pg-grid" width="64" height="64" patternUnits="userSpaceOnUse">
            <path d="M64 0H0V64" fill="none" stroke="currentColor" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#pg-grid)" />
      </svg>

      {variant === 'hero' && !reduce && <motion.div className="absolute inset-0" style={{ background: spot }} />}
      {/* soft vignette to seat the content */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 40%, transparent 55%, color-mix(in srgb, var(--paper) 70%, transparent) 100%)' }} />
    </div>
  );
}
