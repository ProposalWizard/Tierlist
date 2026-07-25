// Visual furniture for the Hall of Fame page — decorative only, no data logic.
// Split out so app/draft/records/page.tsx stays about records rather than SVG.

import type { ReactNode } from "react";

/* ────────────────────────── Accents ──────────────────────────
   Each record board gets a colour by its position on the page, which is what
   gives the list its rhythm. Tailwind only emits classes it can literally see,
   so every class is spelled out in full rather than interpolated.            */

export interface Accent {
  ring: string;      // card border
  glow: string;      // card outer glow
  panel: string;     // rank-panel gradient
  edge: string;      // the lit diagonal edge beside the rank panel
  num: string;       // big rank numeral
  sub: string;       // "PREMIER LEAGUE · SEASON RECORD" line
  pill: string;      // SEE MORE button
}

export const ACCENTS: Accent[] = [
  {
    ring: "border-violet-500/45",
    glow: "shadow-[0_0_26px_-10px_rgba(139,92,246,0.75)]",
    panel: "bg-[linear-gradient(150deg,rgba(139,92,246,0.34)_0%,rgba(76,29,149,0.16)_55%,transparent_100%)]",
    edge: "bg-gradient-to-b from-violet-300/80 via-violet-400/50 to-transparent",
    num: "text-violet-300/90",
    sub: "text-violet-300/80",
    pill: "border-violet-400/50 text-violet-200 hover:border-violet-300 hover:bg-violet-500/10",
  },
  {
    ring: "border-amber-500/45",
    glow: "shadow-[0_0_26px_-10px_rgba(245,158,11,0.75)]",
    panel: "bg-[linear-gradient(150deg,rgba(245,158,11,0.34)_0%,rgba(120,53,15,0.16)_55%,transparent_100%)]",
    edge: "bg-gradient-to-b from-amber-200/80 via-amber-400/50 to-transparent",
    num: "text-amber-300/90",
    sub: "text-amber-300/80",
    pill: "border-amber-400/50 text-amber-200 hover:border-amber-300 hover:bg-amber-500/10",
  },
  {
    ring: "border-sky-500/45",
    glow: "shadow-[0_0_26px_-10px_rgba(56,189,248,0.75)]",
    panel: "bg-[linear-gradient(150deg,rgba(56,189,248,0.34)_0%,rgba(12,74,110,0.16)_55%,transparent_100%)]",
    edge: "bg-gradient-to-b from-sky-200/80 via-sky-400/50 to-transparent",
    num: "text-sky-300/90",
    sub: "text-sky-300/80",
    pill: "border-sky-400/50 text-sky-200 hover:border-sky-300 hover:bg-sky-500/10",
  },
  {
    ring: "border-emerald-500/45",
    glow: "shadow-[0_0_26px_-10px_rgba(16,185,129,0.75)]",
    panel: "bg-[linear-gradient(150deg,rgba(16,185,129,0.34)_0%,rgba(6,78,59,0.16)_55%,transparent_100%)]",
    edge: "bg-gradient-to-b from-emerald-200/80 via-emerald-400/50 to-transparent",
    num: "text-emerald-300/90",
    sub: "text-emerald-300/80",
    pill: "border-emerald-400/50 text-emerald-200 hover:border-emerald-300 hover:bg-emerald-500/10",
  },
  {
    ring: "border-rose-500/45",
    glow: "shadow-[0_0_26px_-10px_rgba(244,63,94,0.75)]",
    panel: "bg-[linear-gradient(150deg,rgba(244,63,94,0.34)_0%,rgba(136,19,55,0.16)_55%,transparent_100%)]",
    edge: "bg-gradient-to-b from-rose-200/80 via-rose-400/50 to-transparent",
    num: "text-rose-300/90",
    sub: "text-rose-300/80",
    pill: "border-rose-400/50 text-rose-200 hover:border-rose-300 hover:bg-rose-500/10",
  },
  {
    ring: "border-cyan-500/45",
    glow: "shadow-[0_0_26px_-10px_rgba(34,211,238,0.75)]",
    panel: "bg-[linear-gradient(150deg,rgba(34,211,238,0.34)_0%,rgba(22,78,99,0.16)_55%,transparent_100%)]",
    edge: "bg-gradient-to-b from-cyan-200/80 via-cyan-400/50 to-transparent",
    num: "text-cyan-300/90",
    sub: "text-cyan-300/80",
    pill: "border-cyan-400/50 text-cyan-200 hover:border-cyan-300 hover:bg-cyan-500/10",
  },
];

export const accentFor = (i: number): Accent => ACCENTS[i % ACCENTS.length];

/* ────────────────────────── Decorative SVG ────────────────────────── */

export function CrownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 44" fill="none" className={className}>
      <defs>
        <linearGradient id="hofCrown" x1="8" y1="6" x2="52" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="45%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
      </defs>
      <path d="M6 36 L2 10 L18 21 L32 4 L46 21 L62 10 L58 36 Z" fill="url(#hofCrown)" />
      <rect x="6" y="36" width="52" height="6" rx="2.4" fill="url(#hofCrown)" />
      <circle cx="32" cy="15" r="2.6" fill="#fff7ed" opacity="0.9" />
      <circle cx="12" cy="19" r="1.9" fill="#fff7ed" opacity="0.75" />
      <circle cx="52" cy="19" r="1.9" fill="#fff7ed" opacity="0.75" />
    </svg>
  );
}

// A laurel branch. Mirrored via a transform for the right-hand side, so the two
// wreaths are guaranteed to match.
export function Laurel({ flip = false, className }: { flip?: boolean; className?: string }) {
  // Leaves sit along the stem and point away from it. They are elongated and
  // spaced apart on purpose — packed tighter they merge into a single blob at
  // the size this renders at.
  const outer = [
    { x: 25, y: 80, r: -38 },
    { x: 18, y: 65, r: -50 },
    { x: 13, y: 50, r: -62 },
    { x: 11, y: 35, r: -74 },
    { x: 12, y: 21, r: -88 },
  ];
  const inner = [
    { x: 36, y: 74, r: 26 },
    { x: 29, y: 59, r: 12 },
    { x: 24, y: 44, r: -2 },
    { x: 22, y: 29, r: -18 },
  ];
  const leaf = (l: { x: number; y: number; r: number }, i: number, scale = 1) => (
    <ellipse
      key={`${l.x}-${i}`}
      cx={l.x}
      cy={l.y}
      rx={10 * scale}
      ry={3.6 * scale}
      transform={`rotate(${l.r} ${l.x} ${l.y})`}
      fill="url(#hofLaurel)"
    />
  );
  return (
    <svg viewBox="0 0 46 100" fill="none" className={className}>
      <defs>
        <linearGradient id="hofLaurel" x1="8" y1="95" x2="40" y2="8" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#b45309" />
          <stop offset="45%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#fef3c7" />
        </linearGradient>
      </defs>
      <g transform={flip ? "scale(-1,1) translate(-46,0)" : undefined}>
        <path
          d="M34 95 C 16 78, 8 52, 14 10"
          stroke="url(#hofLaurel)"
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
        />
        {outer.map((l, i) => leaf(l, i))}
        {inner.map((l, i) => leaf(l, i, 0.82))}
      </g>
    </svg>
  );
}

/* ────────────────────────── Controls ──────────────────────────
   Angled tabs. The parallelogram comes from skewing the button and
   un-skewing the label inside it, so the text stays upright.        */

export function AngledTab({
  active, onClick, children, tone = "violet",
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  tone?: "violet" | "emerald" | "amber";
}) {
  const on =
    tone === "emerald"
      ? "bg-emerald-600 border-emerald-400 shadow-[0_0_18px_-4px_rgba(16,185,129,0.9)]"
      : tone === "amber"
        ? "bg-amber-600 border-amber-400 shadow-[0_0_18px_-4px_rgba(245,158,11,0.9)]"
        : "bg-violet-600 border-violet-400 shadow-[0_0_18px_-4px_rgba(139,92,246,0.9)]";
  return (
    <button
      onClick={onClick}
      style={{ transform: "skewX(-11deg)", touchAction: "manipulation" }}
      className={`relative flex-1 min-w-0 border px-2 py-2 transition-all duration-200 ${
        active
          ? `${on} text-white`
          : "bg-gray-900/70 border-gray-700/60 text-gray-400 hover:text-white hover:border-gray-500"
      }`}
    >
      <span
        style={{ transform: "skewX(11deg)" }}
        className={`block text-[11px] sm:text-xs font-black uppercase tracking-wider truncate ${active ? "italic" : ""}`}
      >
        {children}
      </span>
    </button>
  );
}

/* ────────────────────────── Page chrome ────────────────────────── */

// The banner across the top. HERO_ART_SRC can point at a file in /public to
// place rendered artwork on the right-hand side; until then the panel simply
// carries the glow and stays balanced without it.
export const HERO_ART_SRC: string | null = null;

export function HallOfFameBanner({ children }: { children?: ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-600/25 mb-5 bg-[radial-gradient(120%_140%_at_70%_0%,#1a1330_0%,#0b0d16_55%,#07080d_100%)]">
      {/* stadium-light bloom */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 55% at 50% -10%, rgba(251,191,36,0.20) 0%, transparent 70%), radial-gradient(40% 40% at 88% 20%, rgba(139,92,246,0.18) 0%, transparent 70%)",
        }}
      />
      {/* floor grid, for a sense of a stage */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-20 opacity-[0.13]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(to top, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "34px 18px",
          maskImage: "linear-gradient(to top, black, transparent)",
          WebkitMaskImage: "linear-gradient(to top, black, transparent)",
        }}
      />
      <div className="relative px-4 py-5 sm:py-6">{children}</div>
    </div>
  );
}

// A single figure in the strip beneath the boards.
export function StatTile({
  label, value, caption, icon,
}: {
  label: string;
  value: string;
  caption: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="shrink-0 grid place-items-center w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-amber-300">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[8.5px] font-black uppercase tracking-[0.14em] text-gray-500 truncate">{label}</div>
        <div className="text-base sm:text-lg font-black text-white leading-none tabular-nums">{value}</div>
        <div className="text-[8.5px] text-gray-500 truncate">{caption}</div>
      </div>
    </div>
  );
}

export function BoardIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="4" y="12" width="4" height="8" rx="1" fill="currentColor" />
      <rect x="10" y="7" width="4" height="13" rx="1" fill="currentColor" opacity="0.75" />
      <rect x="16" y="3" width="4" height="17" rx="1" fill="currentColor" opacity="0.5" />
    </svg>
  );
}

export function PeopleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="9" cy="8" r="3.4" fill="currentColor" />
      <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" fill="currentColor" opacity="0.8" />
      <circle cx="17.5" cy="9.5" r="2.6" fill="currentColor" opacity="0.6" />
      <path d="M15 20c0-2.9 1.9-4.8 4.4-4.8 1.3 0 2.6.5 3.1 1.4" fill="currentColor" opacity="0.45" />
    </svg>
  );
}

export function StarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 3.1 14.12 9.39 20.75 9.46 15.42 13.41 17.41 19.74 12 15.9 6.59 19.74 8.58 13.41 3.25 9.46 9.88 9.39 Z" fill="currentColor" />
    </svg>
  );
}

export function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 2.5 20 5.6v6.1c0 4.6-3.3 8.6-8 9.8-4.7-1.2-8-5.2-8-9.8V5.6z" fill="currentColor" />
    </svg>
  );
}

/* ────────────────────────── Record-board icons ──────────────────────────
   One icon per record type. All share the same gold gradient family so they
   read as a set. Each has a unique gradient ID to avoid SVG namespace clashes
   when multiple icons appear on the same page.                              */

export function PointsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <defs>
        <linearGradient id="recPoints" x1="0" y1="0" x2="0" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fef3c7" /><stop offset="38%" stopColor="#fcd34d" />
          <stop offset="72%" stopColor="#f59e0b" /><stop offset="100%" stopColor="#b45309" />
        </linearGradient>
      </defs>
      <rect x="2" y="15" width="5" height="8" rx="1" fill="url(#recPoints)" />
      <rect x="9.5" y="9" width="5" height="14" rx="1" fill="url(#recPoints)" opacity="0.9" />
      <rect x="17" y="3" width="5" height="20" rx="1" fill="url(#recPoints)" />
      <rect x="2.8" y="15.8" width="1.3" height="6.2" rx="0.5" fill="rgba(255,255,255,0.42)" />
      <rect x="10.3" y="9.8" width="1.3" height="10.2" rx="0.5" fill="rgba(255,255,255,0.38)" />
      <rect x="17.8" y="3.8" width="1.3" height="16.2" rx="0.5" fill="rgba(255,255,255,0.4)" />
    </svg>
  );
}

export function WinsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <defs>
        <linearGradient id="recWins" x1="2" y1="1" x2="22" y2="23" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fef3c7" /><stop offset="38%" stopColor="#fcd34d" />
          <stop offset="72%" stopColor="#f59e0b" /><stop offset="100%" stopColor="#b45309" />
        </linearGradient>
      </defs>
      <path d="M7 1.5h10v9.5a5 5 0 01-10 0V1.5z" fill="url(#recWins)" />
      <path d="M7 4.5H4a1.8 1.8 0 000 3.6h3" fill="none" stroke="url(#recWins)" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M17 4.5h3a1.8 1.8 0 010 3.6h-3" fill="none" stroke="url(#recWins)" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="10.5" y="17" width="3" height="3" rx="0.5" fill="url(#recWins)" />
      <rect x="7" y="19.8" width="10" height="2.5" rx="1.2" fill="url(#recWins)" />
      <path d="M10 2.5 v7 a3 3 0 001 2.2" fill="none" stroke="rgba(255,255,255,0.38)" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function BootIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <defs>
        <linearGradient id="recBoot" x1="2" y1="1" x2="22" y2="23" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fef3c7" /><stop offset="38%" stopColor="#fcd34d" />
          <stop offset="72%" stopColor="#f59e0b" /><stop offset="100%" stopColor="#b45309" />
        </linearGradient>
      </defs>
      <path d="M6 1.5 L12 1.5 L12 13 L21 13 L21 17 L4 17 L4 1.5 Z" fill="url(#recBoot)" />
      <rect x="4" y="17" width="17" height="2.5" rx="1" fill="url(#recBoot)" opacity="0.85" />
      <circle cx="7" cy="21.2" r="1.1" fill="url(#recBoot)" />
      <circle cx="12" cy="21.2" r="1.1" fill="url(#recBoot)" />
      <circle cx="17" cy="21.2" r="1.1" fill="url(#recBoot)" />
      <path d="M7.5 2.5 v10" stroke="rgba(255,255,255,0.4)" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function AssistIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <defs>
        <linearGradient id="recAssist" x1="1" y1="20" x2="23" y2="4" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#b45309" /><stop offset="38%" stopColor="#f59e0b" />
          <stop offset="72%" stopColor="#fcd34d" /><stop offset="100%" stopColor="#fef3c7" />
        </linearGradient>
      </defs>
      <path d="M2 20 Q9 5 22 8" stroke="url(#recAssist)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M18.5 4.5 L22.5 8 L19 11.5" stroke="url(#recAssist)" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="4" cy="18.5" r="2" fill="url(#recAssist)" />
    </svg>
  );
}

export function GloveIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <defs>
        <linearGradient id="recGlove" x1="2" y1="1" x2="22" y2="23" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fef3c7" /><stop offset="38%" stopColor="#fcd34d" />
          <stop offset="72%" stopColor="#f59e0b" /><stop offset="100%" stopColor="#b45309" />
        </linearGradient>
      </defs>
      <rect x="6" y="8" width="14" height="11" rx="5" fill="url(#recGlove)" />
      <ellipse cx="5" cy="10" rx="2.8" ry="4.5" fill="url(#recGlove)" />
      <line x1="10.5" y1="8" x2="10.5" y2="11.5" stroke="rgba(0,0,0,0.22)" strokeWidth="1" />
      <line x1="14" y1="8" x2="14" y2="11.5" stroke="rgba(0,0,0,0.22)" strokeWidth="1" />
      <rect x="6" y="17.5" width="14" height="4.5" rx="2.2" fill="url(#recGlove)" opacity="0.88" />
      <path d="M7.5 9 Q10 7.5 15 8.5" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function UnbeatenIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <defs>
        <linearGradient id="recUnbeaten" x1="2" y1="1" x2="22" y2="23" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fef3c7" /><stop offset="38%" stopColor="#fcd34d" />
          <stop offset="72%" stopColor="#f59e0b" /><stop offset="100%" stopColor="#b45309" />
        </linearGradient>
      </defs>
      <path d="M12 2 L20 5.5 v7 c0 4.5-3.5 7.8-8 9.5-4.5-1.7-8-5-8-9.5v-7 Z" fill="url(#recUnbeaten)" />
      <path d="M13 8 L9.5 15 L12.2 15 L9 21 L16 13.5 L13 13.5 Z" fill="rgba(255,255,255,0.55)" />
    </svg>
  );
}

export function GoalLockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <defs>
        <linearGradient id="recLock" x1="4" y1="1" x2="20" y2="23" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fef3c7" /><stop offset="38%" stopColor="#fcd34d" />
          <stop offset="72%" stopColor="#f59e0b" /><stop offset="100%" stopColor="#b45309" />
        </linearGradient>
      </defs>
      <rect x="5" y="11" width="14" height="11" rx="2.5" fill="url(#recLock)" />
      <path d="M8.5 11 V7.5 a3.5 3.5 0 017 0 V11" fill="none" stroke="url(#recLock)" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="12" cy="16.5" r="2" fill="rgba(0,0,0,0.38)" />
      <rect x="11.1" y="16.5" width="1.8" height="2.8" rx="0.5" fill="rgba(0,0,0,0.38)" />
      <rect x="5.8" y="11.8" width="2.2" height="5" rx="0.8" fill="rgba(255,255,255,0.3)" />
    </svg>
  );
}

export function ExplosionIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <defs>
        <linearGradient id="recExplosion" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fef3c7" /><stop offset="38%" stopColor="#fcd34d" />
          <stop offset="72%" stopColor="#f59e0b" /><stop offset="100%" stopColor="#b45309" />
        </linearGradient>
      </defs>
      <path d="M12 1.5 L13.5 8.3 L19.4 4.6 L15.7 10.5 L22.5 12 L15.7 13.5 L19.4 19.4 L13.5 15.7 L12 22.5 L10.5 15.7 L4.6 19.4 L8.3 13.5 L1.5 12 L8.3 10.5 L4.6 4.6 L10.5 8.3 Z" fill="url(#recExplosion)" />
      <circle cx="12" cy="12" r="3.5" fill="rgba(255,255,255,0.28)" />
    </svg>
  );
}

export function RatingStarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <defs>
        <linearGradient id="recRating" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fef3c7" /><stop offset="38%" stopColor="#fcd34d" />
          <stop offset="72%" stopColor="#f59e0b" /><stop offset="100%" stopColor="#b45309" />
        </linearGradient>
      </defs>
      <path d="M12 2 L14.4 8.8 L21.5 8.9 L15.8 13.2 L17.9 20.1 L12 16 L6.1 20.1 L8.2 13.2 L2.5 8.9 L9.6 8.8 Z" fill="url(#recRating)" />
      <path d="M10.5 5 L12 3 L12.5 8.5" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="18.5" cy="5.5" r="0.8" fill="rgba(255,255,255,0.6)" />
      <circle cx="5.5" cy="5.5" r="0.8" fill="rgba(255,255,255,0.6)" />
    </svg>
  );
}

export function SquadOvrIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <defs>
        <linearGradient id="recOvr" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fef3c7" /><stop offset="38%" stopColor="#fcd34d" />
          <stop offset="72%" stopColor="#f59e0b" /><stop offset="100%" stopColor="#b45309" />
        </linearGradient>
      </defs>
      <path d="M12 2 L20 8.5 L12 22 L4 8.5 Z" fill="url(#recOvr)" />
      <line x1="4" y1="8.5" x2="20" y2="8.5" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" />
      <path d="M4 8.5 L12 2 L16.5 8.5 L12 22 Z" fill="rgba(255,255,255,0.1)" />
      <path d="M8 6 L12 2.5 L15 7" fill="none" stroke="rgba(255,255,255,0.48)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function FootballIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <defs>
        <linearGradient id="recFootball" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fef3c7" /><stop offset="38%" stopColor="#fcd34d" />
          <stop offset="72%" stopColor="#f59e0b" /><stop offset="100%" stopColor="#b45309" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="10.5" fill="url(#recFootball)" />
      <path d="M12 7 L15 9.3 L13.8 13 L10.2 13 L9 9.3 Z" fill="rgba(0,0,0,0.38)" />
      <line x1="12" y1="7" x2="12" y2="1.5" stroke="rgba(0,0,0,0.28)" strokeWidth="1" />
      <line x1="15" y1="9.3" x2="21.5" y2="7.5" stroke="rgba(0,0,0,0.28)" strokeWidth="1" />
      <line x1="13.8" y1="13" x2="18" y2="18.5" stroke="rgba(0,0,0,0.28)" strokeWidth="1" />
      <line x1="10.2" y1="13" x2="6" y2="18.5" stroke="rgba(0,0,0,0.28)" strokeWidth="1" />
      <line x1="9" y1="9.3" x2="2.5" y2="7.5" stroke="rgba(0,0,0,0.28)" strokeWidth="1" />
      <path d="M7 5 Q12 2.5 17 5" fill="none" stroke="rgba(255,255,255,0.42)" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function MedalIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <defs>
        <linearGradient id="recMedal" x1="4" y1="1" x2="20" y2="23" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fef3c7" /><stop offset="38%" stopColor="#fcd34d" />
          <stop offset="72%" stopColor="#f59e0b" /><stop offset="100%" stopColor="#b45309" />
        </linearGradient>
      </defs>
      <path d="M9 1.5 L12 9 L7.5 14 Z" fill="url(#recMedal)" opacity="0.85" />
      <path d="M15 1.5 L12 9 L16.5 14 Z" fill="url(#recMedal)" opacity="0.68" />
      <circle cx="12" cy="17" r="7" fill="url(#recMedal)" />
      <circle cx="12" cy="17" r="4.8" fill="rgba(0,0,0,0.14)" stroke="rgba(255,255,255,0.18)" strokeWidth="0.8" />
      <path d="M12 14 L12.7 16.2 L15 16.2 L13.2 17.6 L13.9 19.8 L12 18.5 L10.1 19.8 L10.8 17.6 L9 16.2 L11.3 16.2 Z" fill="rgba(255,255,255,0.48)" />
      <path d="M8.5 14 Q10 13 13 14" fill="none" stroke="rgba(255,255,255,0.42)" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
