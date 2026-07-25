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
