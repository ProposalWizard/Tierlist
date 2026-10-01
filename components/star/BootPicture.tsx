"use client";

/**
 * A DRAWN BOOT — one per boot type, dressed up per level.
 *
 * Harry, 30 Sep 2026: "Can I see pictures of these?" and (p42) "it should just
 * be like a gallery, like I'm in a shop." Each of the seven boots has its own
 * colours and its own mark on the side (Flash a bolt, Thunder a jagged stripe,
 * Control a grip pattern, Elite a chevron, Swerve a curl, Maestro a star).
 * The level changes the finish: 1 matte and scuffed, 2 adds the side mark,
 * 3 gloss and a coloured sole, 4 a knit collar and metal sheen, 5 gold studs
 * and sparkle. Generic shapes only — no real makers' marks.
 */
import { useId } from "react";

interface BootLook { upper: string; accent: string; sole: string }

export const BOOT_LOOK: Record<string, BootLook> = {
  starter: { upper: "#e5e7eb", accent: "#64748b", sole: "#94a3b8" },
  speed: { upper: "#facc15", accent: "#111827", sole: "#1f2937" },
  power: { upper: "#dc2626", accent: "#111827", sole: "#111827" },
  control: { upper: "#2563eb", accent: "#f8fafc", sole: "#1e3a8a" },
  elite: { upper: "#111827", accent: "#fbbf24", sole: "#374151" },
  curl: { upper: "#06b6d4", accent: "#7c3aed", sole: "#4c1d95" },
  maestro: { upper: "#c026d3", accent: "#fde68a", sole: "#701a75" },
};

/** Mix a colour toward grey — level 1 boots look worn. */
function dull(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const m = (c: number) => Math.round(c * (1 - k) + 128 * k);
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}

export default function BootPicture({ base, level, className = "" }: { base: string; level: number; className?: string }) {
  const uid = useId().replace(/:/g, "");
  const lv = Math.max(1, Math.min(5, Math.round(level || 1)));
  const look = BOOT_LOOK[base] ?? BOOT_LOOK.starter;
  const upper = lv === 1 ? dull(look.upper, 0.35) : look.upper;
  const accent = lv === 5 ? "#fbbf24" : look.accent;
  const sole = lv >= 3 ? look.sole : "#4b5563";
  const stud = lv === 5 ? `url(#${uid}g)` : lv >= 3 ? "#e5e7eb" : "#9ca3af";
  const upperPath = "M15 46 L12 30 Q12 17 23 17 Q31 19 37 24 L63 30 Q84 33 90 42 Q92 47 86 48 L17 48 Z";
  return (
    <svg viewBox="0 0 100 64" className={className} role="img" aria-hidden>
      <defs>
        <linearGradient id={`${uid}g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3b0" /><stop offset=".5" stopColor="#f5c542" /><stop offset="1" stopColor="#b7791f" />
        </linearGradient>
        <linearGradient id={`${uid}s`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".55" /><stop offset=".45" stopColor="#fff" stopOpacity="0" /><stop offset=".7" stopColor="#fff" stopOpacity=".25" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${uid}c`}><path d={upperPath} /></clipPath>
      </defs>
      <ellipse cx="51" cy="58" rx="40" ry="3.2" fill="rgba(0,0,0,.4)" />
      {/* Studs, then the sole plate. */}
      {[20, 29, 58, 70, 81].map((x, i) => (
        <path key={i} d={`M${x - 2.6} 51 L${x + 2.6} 51 L${x + 1.6} ${lv === 1 ? 54.5 : 56} L${x - 1.6} ${lv === 1 ? 54.5 : 56} Z`} fill={stud} />
      ))}
      <path d="M15 48 L88 48 Q91 50 86 51.6 L17 51.6 Q13 51.6 15 48 Z" fill={sole} />
      {/* Knit ankle collar from level 4. */}
      {lv >= 4 && <path d="M12.5 26 Q12 12 23 11 Q33 12 38.5 21 L37 24 Q31 17 23 17 Q13 17 12.5 26 Z" fill={look.accent === "#f8fafc" ? "#1e3a8a" : look.accent} stroke="#0b1220" strokeWidth=".6" />}
      <path d={upperPath} fill={upper} stroke={lv === 1 ? "#4b5563" : "#0b1220"} strokeWidth="1" />
      <g clipPath={`url(#${uid}c)`}>
        {lv >= 2 && <Mark base={base} accent={accent} />}
        {lv >= 3 && <path d="M12 46 Q50 40 92 44 L92 48 L12 48 Z" fill={look.sole} opacity=".55" />}
        {lv >= 3 && <rect x="0" y="0" width="100" height="64" fill={`url(#${uid}s)`} />}
        {lv === 1 && <><path d="M40 40 q4 -2 8 0 M66 38 q3 -2 6 0" stroke="#6b7280" strokeWidth="1" fill="none" /><circle cx="78" cy="42" r="1.6" fill="#78716c" /></>}
      </g>
      {/* Laces. */}
      {[0, 1, 2, 3].map((i) => (
        <path key={i} d={`M${40 + i * 6} ${24.5 + i * 1.6} L${44 + i * 6} ${29.5 + i * 1.6}`} stroke={lv === 5 ? "#fde68a" : lv === 4 ? "#f8fafc" : "#f1f5f9"} strokeWidth="1.6" strokeLinecap="round" />
      ))}
      {lv >= 4 && <path d="M37 24 Q40 19 46 21 L44 26 Z" fill={upper} stroke="#0b1220" strokeWidth=".6" />}
      {lv === 5 && (
        <g fill="#fffbe6">
          {[[56, 8, 2], [90, 18, 2.6], [80, 5, 1.5]].map(([x, y, r], i) => (
            <path key={i} d={`M${x} ${y - r * 2} L${x + r * 0.5} ${y - r * 0.5} L${x + r * 2} ${y} L${x + r * 0.5} ${y + r * 0.5} L${x} ${y + r * 2} L${x - r * 0.5} ${y + r * 0.5} L${x - r * 2} ${y} L${x - r * 0.5} ${y - r * 0.5} Z`} />
          ))}
        </g>
      )}
    </svg>
  );
}

/** The mark on the side of each boot — its own, not a real maker's. */
function Mark({ base, accent }: { base: string; accent: string }) {
  switch (base) {
    case "speed":
      return <path d="M44 32 L58 32 L52 37 L66 37 L46 46 L52 40 L40 40 Z" fill={accent} />;
    case "power":
      return <path d="M20 40 L30 33 L36 39 L46 31 L54 38 L64 31 L72 37 L84 33 L84 37 L72 41 L64 35 L54 42 L46 35 L36 43 L30 37 L20 44 Z" fill={accent} />;
    case "control":
      return <g fill={accent} opacity=".85">{Array.from({ length: 24 }, (_, i) => <circle key={i} cx={66 + (i % 6) * 4} cy={34 + Math.floor(i / 6) * 3.6} r="1" />)}</g>;
    case "elite":
      return <path d="M24 36 L40 42 L24 48 L30 42 Z M40 36 L56 42 L40 48 L46 42 Z" fill={accent} />;
    case "curl":
      return <path d="M30 42 Q40 30 56 34 Q68 38 62 44 Q56 48 52 42" stroke={accent} strokeWidth="3.4" fill="none" strokeLinecap="round" />;
    case "maestro":
      return <path d="M50 30 L52.6 36 L59 36.4 L54 40.4 L55.8 46.6 L50 43 L44.2 46.6 L46 40.4 L41 36.4 L47.4 36 Z" fill={accent} />;
    default:
      return <path d="M22 41 Q50 34 86 40 L86 43 Q50 37 22 44 Z" fill={accent} />;
  }
}
