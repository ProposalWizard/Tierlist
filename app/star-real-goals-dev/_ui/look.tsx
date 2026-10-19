"use client";
/**
 * REAL GOALS — the look (Leo, 19 Oct 2026: "revamp ui and look, looks way too
 * much like a tester page rn and not a good polished game/gamemode").
 * Small pieces the screens share: each collection's colours, the stars, the
 * three-letter codes, a kit dot, the accuracy dial and the goal mouth.
 * Test page only (data: StatsBomb open data).
 */
import { POST_L, POST_R, CX } from "@/lib/star/pitch";
import { NATION_KITS } from "@/lib/star/realGoals";

export interface ColLook { title: string; where: string; from: string; to: string; ink: string; mark: string }
export const LOOK: Record<string, ColLook> = {
  wc2022: { title: "World Cup 2022", where: "Qatar", from: "#6d1532", to: "#c79a3b", ink: "#ffe7a8", mark: "WC" },
  euro2024: { title: "Euro 2024", where: "Germany", from: "#0b2a6f", to: "#2c8fd6", ink: "#cfe8ff", mark: "EURO" },
  wc2018: { title: "World Cup 2018", where: "Russia", from: "#8c0f18", to: "#d9a632", ink: "#ffe1a1", mark: "WC" },
  euro2020: { title: "Euro 2020", where: "Across Europe", from: "#0a3768", to: "#13a3a6", ink: "#c6fbf6", mark: "EURO" },
  copa2024: { title: "Copa América 2024", where: "United States", from: "#0b4f2a", to: "#e3b22c", ink: "#fff1b8", mark: "COPA" },
  afcon2023: { title: "AFCON 2023", where: "Côte d'Ivoire", from: "#a6420b", to: "#1f7a3a", ink: "#ffe0c2", mark: "AFCON" },
  legends: { title: "Legends", where: "Finals, classics, history", from: "#2f2205", to: "#e8b830", ink: "#fff3c4", mark: "★" },
  worldies: { title: "Club worldies", where: "The best club goals in the data", from: "#2c0b4a", to: "#b23bd0", ink: "#f3d1ff", mark: "CLUB" },
};
export const lookOf = (key: string): ColLook => LOOK[key] ?? { title: key, where: "", from: "#123", to: "#456", ink: "#fff", mark: "?" };

/** The display font (the game's Anton; components/star/ui/pitchFont.ts sets --font-pitch). */
export const DISPLAY = { fontFamily: "var(--font-pitch), Anton, Impact, 'Arial Narrow', sans-serif", fontWeight: 400 as const, letterSpacing: 0.3 };

export function Stars({ n, of = 3, size = 16, pop = false }: { n: number; of?: number; size?: number; pop?: boolean }) {
  return (
    <span className="inline-flex" style={{ gap: size * 0.12 }} aria-label={`${n} of ${of} stars`}>
      {Array.from({ length: of }, (_, i) => (
        <span key={i} className={pop && i < n ? "rg-pop" : ""} style={{ fontSize: size, lineHeight: 1, color: i < n ? "#fcd34d" : "rgba(255,255,255,0.22)", textShadow: i < n ? "0 0 10px rgba(252,211,77,0.55)" : "none", animationDelay: `${0.35 + i * 0.28}s` }}>★</span>
      ))}
    </span>
  );
}

/** 1-5 balls: how hard the goal is to recreate. */
export function Difficulty({ tier, size = 7 }: { tier: number; size?: number }) {
  return (
    <span className="inline-flex items-center" style={{ gap: 2 }} aria-label={`difficulty ${tier} of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} style={{ width: size, height: size, borderRadius: size, background: i < tier ? (tier >= 5 ? "#f43f5e" : tier >= 4 ? "#fb923c" : "#a3e635") : "rgba(255,255,255,0.2)" }} />
      ))}
    </span>
  );
}

const CODES: Record<string, string> = {
  "United States": "USA", "South Korea": "KOR", "Saudi Arabia": "KSA", "Costa Rica": "CRC", "Czech Republic": "CZE", Netherlands: "NED",
  Germany: "GER", Switzerland: "SUI", Portugal: "POR", Croatia: "CRO", Denmark: "DEN", England: "ENG", Spain: "ESP", Morocco: "MAR",
  Uruguay: "URU", Paraguay: "PAR", Slovenia: "SVN", Slovakia: "SVK", Scotland: "SCO", Iran: "IRN", Japan: "JPN", Australia: "AUS",
  "North Macedonia": "MKD", "Côte d'Ivoire": "CIV", "Congo DR": "COD", "Cape Verde Islands": "CPV", "Equatorial Guinea": "EQG",
  "Guinea-Bissau": "GNB", "South Africa": "RSA", Algeria: "ALG", Angola: "ANG", "Burkina Faso": "BFA", Gambia: "GAM", Mauritania: "MTN",
  Mozambique: "MOZ", Namibia: "NAM", Tanzania: "TAN", Zambia: "ZAM", Nigeria: "NGA", Cameroon: "CMR", Senegal: "SEN", Tunisia: "TUN",
  Ghana: "GHA", Egypt: "EGY", Guinea: "GUI", Mali: "MLI", Chile: "CHI", Colombia: "COL", Venezuela: "VEN", Bolivia: "BOL", Jamaica: "JAM",
  Panama: "PAN", Peru: "PER", Mexico: "MEX", Canada: "CAN", Ecuador: "ECU", Brazil: "BRA", Argentina: "ARG", Qatar: "QAT", Wales: "WAL",
  Poland: "POL", Serbia: "SRB", Belgium: "BEL", France: "FRA", Italy: "ITA", Austria: "AUT", Hungary: "HUN", Romania: "ROU", Turkey: "TUR",
  Ukraine: "UKR", Georgia: "GEO", Albania: "ALB", Russia: "RUS", Sweden: "SWE", Iceland: "ISL", Finland: "FIN",
  "Paris Saint-Germain": "PSG", "Manchester United": "MUN", "Manchester City": "MCI", "Real Madrid": "RMA", "Atlético Madrid": "ATM",
  Barcelona: "BAR", "Bayern Munich": "BAY", "Bayer Leverkusen": "B04", "Borussia Dortmund": "BVB", "Inter Milan": "INT", "AC Milan": "MIL",
  "Tottenham Hotspur": "TOT", "Crystal Palace": "CRY", "West Ham United": "WHU", "West Bromwich Albion": "WBA", "Newcastle United": "NEW",
  "Leicester City": "LEI", "Real Betis": "BET", "Real Sociedad": "RSO", "Athletic Club": "ATH", "FC Porto": "POR", "AS Monaco": "MON",
  "Werder Bremen": "SVW", "Eintracht Frankfurt": "SGE",
};
export function code3(team: string): string {
  if (CODES[team]) return CODES[team];
  const w = team.replace(/^(FC|AC|AS|RC|SD|CD|UD|SC|1\.)\s+/i, "").split(/\s+/);
  return (w.length > 1 && w[0].length <= 3 ? w[1] : w[0]).normalize("NFD").replace(/[̀-ͯ]/g, "").slice(0, 3).toUpperCase();
}

export function KitDot({ team, size = 18 }: { team: string; size?: number }) {
  const k = NATION_KITS[team]?.home;
  return (
    <span style={{ display: "inline-block", width: size, height: size, borderRadius: size, flexShrink: 0, background: `linear-gradient(135deg, ${k?.shirt ?? "#64748b"} 55%, ${k?.trim ?? "#fff"} 55%)`, boxShadow: "0 0 0 2px rgba(255,255,255,0.85), 0 2px 6px rgba(0,0,0,0.4)" }} />
  );
}

/** The accuracy dial: how like the real goal, 0-100%. */
export function Dial({ pct, size = 132, scored }: { pct: number; size?: number; scored: boolean }) {
  const r = size / 2 - 9, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, pct / 100));
  const col = !scored ? "#f87171" : pct >= 85 ? "#fcd34d" : pct >= 60 ? "#a3e635" : "#38bdf8";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={`${Math.round(pct)}% like the real goal`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="rgba(0,0,0,0.35)" stroke="rgba(255,255,255,0.14)" strokeWidth={10} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth={10} strokeLinecap="round"
        strokeDasharray={`${c * f} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} className="rg-dial" style={{ filter: `drop-shadow(0 0 8px ${col})` }} />
      <text x="50%" y="50%" dy="0.1em" textAnchor="middle" fill="#fff" style={{ ...DISPLAY, fontSize: size * 0.3 }}>{Math.round(pct)}%</text>
      <text x="50%" y="50%" dy="1.9em" textAnchor="middle" fill="rgba(255,255,255,0.85)" style={{ fontSize: size * 0.085, fontWeight: 800 }}>LIKE THE REAL ONE</text>
    </svg>
  );
}

/** The goal mouth, from the front: the real goal's spot (gold) and yours (blue). */
export function GoalMouth({ real, you }: { real: { x: number; z: number }; you: { x: number; z: number } | null }) {
  const W = 320, pad = 16, s = (W - 2 * pad) / (POST_R - POST_L + 1.6), H = 2.44 * s + pad + 22;
  const px = (x: number) => pad + (x - (POST_L - 0.8)) * s;
  const py = (z: number) => H - 22 - z * s;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
      <defs>
        <pattern id="rg-net" width="9" height="9" patternUnits="userSpaceOnUse"><path d="M0 0L9 9M9 0L0 9" stroke="rgba(255,255,255,0.13)" strokeWidth="1" /></pattern>
      </defs>
      <rect x={0} y={py(0)} width={W} height={22} fill="#1f7a3f" />
      <rect x={px(POST_L)} y={py(2.44)} width={(POST_R - POST_L) * s} height={2.44 * s} fill="url(#rg-net)" />
      <path d={`M${px(POST_L)} ${py(0)} V${py(2.44)} H${px(POST_R)} V${py(0)}`} fill="none" stroke="#fff" strokeWidth={5} strokeLinejoin="round" />
      {you && <line x1={px(real.x)} y1={py(real.z)} x2={px(you.x)} y2={py(Math.max(0, you.z))} stroke="rgba(255,255,255,0.8)" strokeDasharray="4 3" strokeWidth={1.5} />}
      <circle cx={px(real.x)} cy={py(real.z)} r={10} fill="#fcd34d" stroke="#422006" strokeWidth={2} />
      <text x={px(real.x)} y={py(real.z) - 14} fill="#fde68a" fontSize={11} fontWeight={900} textAnchor="middle">REAL</text>
      {you && <>
        <circle cx={px(you.x)} cy={py(Math.max(0, you.z))} r={9} fill="#38bdf8" stroke="#082f49" strokeWidth={2} />
        <text x={px(you.x)} y={py(Math.max(0, you.z)) + 22} fill="#e0f2fe" fontSize={11} fontWeight={900} textAnchor="middle">YOU</text>
      </>}
    </svg>
  );
}

/** "top left corner" — as you look at the goal. */
export function spotWords(x: number, z: number): string {
  const across = x < CX - 1.2 ? "left" : x > CX + 1.2 ? "right" : "middle";
  const up = z < 0.7 ? "low" : z > 1.6 ? "top" : "mid-height";
  if (across === "middle") return up === "low" ? "low, down the middle" : up === "top" ? "high, down the middle" : "down the middle";
  return up === "top" ? `top ${across} corner` : up === "low" ? `bottom ${across} corner` : `${across} side, ${up}`;
}

/** Animations the screens use (one style block). */
export const RG_CSS = `
@keyframes rg-pop { 0% { transform: scale(0); opacity: 0 } 60% { transform: scale(1.5); opacity: 1 } 100% { transform: scale(1) } }
.rg-pop { display: inline-block; animation: rg-pop .45s cubic-bezier(.2,1.6,.4,1) both }
@keyframes rg-up { from { transform: translateY(40px); opacity: 0 } to { transform: none; opacity: 1 } }
.rg-up { animation: rg-up .32s ease-out both }
@keyframes rg-dial { from { stroke-dasharray: 0 999 } }
.rg-dial { animation: rg-dial .9s ease-out both }
@keyframes rg-glow { 0%,100% { box-shadow: 0 0 0 0 rgba(252,211,77,.0) } 50% { box-shadow: 0 0 22px 4px rgba(252,211,77,.55) } }
.rg-next { animation: rg-glow 1.8s ease-in-out infinite }
@keyframes rg-in { from { opacity: 0 } to { opacity: 1 } }
.rg-in { animation: rg-in .25s ease-out both }
.rg-press:active { transform: scale(.96) }
`;
