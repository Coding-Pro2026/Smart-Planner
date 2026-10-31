import { motion } from 'motion/react';

/** Hand-built SVG art. Each is self-contained (gradients scoped by id) and works in light/dark. */

export function Botanical({ className, delay = 0, flip = false }: { className?: string; delay?: number; flip?: boolean }) {
  const draw = (d: number) => ({
    initial: { pathLength: 0, opacity: 0 },
    animate: { pathLength: 1, opacity: 1 },
    transition: { duration: 2.2, delay: delay + d, ease: [0.4, 0, 0.2, 1] as const },
  });
  return (
    <svg viewBox="0 0 220 360" fill="none" className={className} style={flip ? { transform: 'scaleX(-1)' } : undefined} aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <motion.path d="M110 350 C108 280 118 220 104 150 C96 108 112 70 126 24" {...draw(0)} />
        {[
          'M108 300 C74 292 52 270 46 240 C80 244 104 266 108 300Z',
          'M110 258 C146 252 170 230 176 198 C140 202 114 224 110 258Z',
          'M106 214 C72 206 54 184 50 156 C82 160 102 182 106 214Z',
          'M112 172 C146 164 164 142 168 114 C136 118 116 140 112 172Z',
          'M108 130 C84 122 72 104 70 82 C92 86 106 104 108 130Z',
          'M118 92 C142 84 152 66 152 46 C132 52 120 68 118 92Z',
        ].map((d, i) => (
          <motion.path key={i} d={d} {...draw(0.35 + i * 0.22)} />
        ))}
        <motion.circle cx="126" cy="22" r="7" {...draw(1.9)} />
        <motion.circle cx="126" cy="22" r="2" {...draw(2.1)} />
      </g>
    </svg>
  );
}

export function IsoCalendar({ className, day = '15' }: { className?: string; day?: string }) {
  return (
    <svg viewBox="0 0 160 170" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="ic-l" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e9dcc2" />
          <stop offset="1" stopColor="#cdb98f" />
        </linearGradient>
        <linearGradient id="ic-r" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c86d51" />
          <stop offset="1" stopColor="#9e4a33" />
        </linearGradient>
        <radialGradient id="ic-s" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#000" stopOpacity="0.28" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="80" cy="152" rx="58" ry="13" fill="url(#ic-s)" />
      <polygon points="28,56 80,82 80,142 28,116" fill="url(#ic-l)" />
      <polygon points="80,82 132,56 132,116 80,142" fill="url(#ic-r)" />
      <polygon points="28,56 80,30 132,56 80,82" fill="#fbf6ea" />
      <g stroke="#b88b4a" strokeWidth="1.2" opacity="0.55">
        <line x1="54" y1="43" x2="106" y2="69" />
        <line x1="66" y1="37" x2="118" y2="63" />
        <line x1="42" y1="49" x2="94" y2="75" />
      </g>
      <g fill="#2c4636">
        <circle cx="52" cy="56" r="3.2" />
        <circle cx="80" cy="42" r="3.2" />
        <circle cx="108" cy="56" r="3.2" />
      </g>
      <text transform="matrix(1 -0.5 0 1 88 112)" fontFamily="var(--font-display)" fontSize="38" fontWeight="600" fill="#fbf6ea">{day}</text>
      <text transform="matrix(1 0.5 0 1 38 98)" fontFamily="var(--font-mono)" fontSize="9" letterSpacing="2" fill="#6f6040">MAY</text>
    </svg>
  );
}

export function IsoPin({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 140 170" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="ip-b" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4f7b63" />
          <stop offset="1" stopColor="#25402f" />
        </linearGradient>
      </defs>
      {[0, 1, 2].map((i) => (
        <motion.ellipse
          key={i}
          cx="70"
          cy="148"
          rx="22"
          ry="7"
          fill="none"
          stroke="#2c4636"
          strokeWidth="1.2"
          initial={{ opacity: 0.6, scale: 0.5 }}
          animate={{ opacity: 0, scale: 2.1 }}
          transition={{ duration: 2.8, repeat: Infinity, delay: i * 0.9, ease: 'easeOut' }}
          style={{ transformOrigin: '70px 148px' }}
        />
      ))}
      <ellipse cx="70" cy="148" rx="20" ry="6" fill="#000" opacity="0.2" />
      <path d="M70 140 C46 108 32 90 32 66 A38 38 0 0 1 108 66 C108 90 94 108 70 140Z" fill="url(#ip-b)" />
      <path d="M70 140 C94 108 108 90 108 66 A38 38 0 0 0 70 28 C88 44 92 80 70 140Z" fill="#000" opacity="0.14" />
      <circle cx="70" cy="66" r="15" fill="#f6f0e4" />
      <circle cx="70" cy="66" r="7" fill="#c86d51" />
      <path d="M44 48 C50 36 60 30 72 30" stroke="#fff" strokeOpacity="0.55" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function IsoEnvelope({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 180 140" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="ie-b" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbf6ea" />
          <stop offset="1" stopColor="#e6d8b9" />
        </linearGradient>
      </defs>
      <ellipse cx="90" cy="126" rx="62" ry="9" fill="#000" opacity="0.14" />
      <rect x="22" y="34" width="136" height="84" rx="8" fill="url(#ie-b)" stroke="#b88b4a" strokeOpacity="0.5" />
      <path d="M22 42 L90 90 L158 42" fill="none" stroke="#b88b4a" strokeOpacity="0.6" strokeWidth="1.4" />
      <path d="M22 42 L90 8 L158 42 L90 80Z" fill="#f1e6cd" stroke="#b88b4a" strokeOpacity="0.5" />
      <circle cx="90" cy="64" r="11" fill="#c86d51" />
      <path d="M85 64 l4 4 l7 -8" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M12 0 C12.8 7 17 11.2 24 12 C17 12.8 12.8 17 12 24 C11.2 17 7 12.8 0 12 C7 11.2 11.2 7 12 0Z" fill="currentColor" />
    </svg>
  );
}

/** Animated progress ring. */
export function Ring({ pct, size = 120, stroke = 10, className, delay = 0 }: { pct: number; size?: number; stroke?: number; className?: string; delay?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={className} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth={stroke} />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--terra)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        whileInView={{ strokeDashoffset: c * (1 - pct / 100) }}
        viewport={{ once: true }}
        transition={{ duration: 1.8, delay, ease: [0.2, 0.7, 0.2, 1] }}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}
