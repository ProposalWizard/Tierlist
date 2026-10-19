/**
 * REAL GOALS — a little game made of real goals (TEST PAGE ONLY,
 * /star-real-goals-dev). Leo, 18 Oct 2026: "we should one HUNDRED percent have
 * a real shots mode … u gotta try get 100% accuracy from real irl goal … maybe
 * like score hero system of going up the levels getting harder and stars".
 *
 * Every non-penalty goal of the 2022 World Cup and Euro 2024 that StatsBomb's
 * free data has a freeze frame for (250), with the extra facts in
 * data/statsbomb/goals.json (scripts/statsbomb/fetch_real_goals.py): the score
 * before it, the height it went in at, every frozen man's name, the whole move.
 *
 * Pure: no React, no canvas. tests/star/realGoals.mts checks it.
 * The licence for a paid game is not cleared, so nothing in the real game
 * imports this file (the test greps for it).
 *
 * Data: StatsBomb open data (https://github.com/statsbomb/open-data)
 */
import type { Scenario, Vec2 } from "./canvasEngine";
import { CLUB_KITS, type Kit } from "./kits";
import type { LeadBallKey } from "./leadIn";
import { ballAlong } from "./leadIn";
import type { RealGoalView, RealGoalGhost } from "./realGoalView";
import {
  sbToPitch, peopleOf, blockersOf, scenarioForShot,
  type SbShot, type SbLeadin, type SbPass,
} from "./statsbombShots";
import { CX, POST_L, POST_R } from "./pitch";
import { realTrack, type TrackFrame, type RealTrack } from "./realGoalTrack";

// ─────────────────────────────────────────────────────────────────────────
//  THE DATA
// ─────────────────────────────────────────────────────────────────────────

/** One action of the move: [seconds before the shot, P pass / C carry / D dribble / R ball received, from, to | null, player, recipient | null, height 0-2]. */
export type RgMoveEv = [number, "P" | "C" | "D" | "R", [number, number], [number, number] | null, string, string | null, number];

/** The extra facts for one goal (goals.json). */
export interface RgExtra {
  id: string;
  matchId: number;
  comp: string;
  home: string;
  away: string;
  stage: string;
  date: string;
  final: [number, number];
  /** The score just before the goal, [home, away]. */
  score: [number, number];
  /** The height it crossed the line at, in StatsBomb yards. */
  endZ: number | null;
  /** The freeze frame's names and positions, in shots.json's ff order. */
  names: string[];
  pos: string[];
  shooterPos: string;
  period: number;
  second: number;
  /** The shot's own flight time, seconds. */
  dur: number | null;
  move: RgMoveEv[];
  /** Full name → [the name he is known by, shirt number]. */
  known?: Record<string, [string, number | null]>;
}

/**
 * One goal as data/statsbomb/realgoals/<collection>.json stores it
 * (scripts/statsbomb/fetch_real_goals.py): the Real shots shape plus the facts.
 */
export interface RgRow extends Omit<RgExtra, "comp"> {
  shot: SbShot;
  /** StatsBomb 360 frames during the move (see realGoalTrack.ts). */
  frames?: TrackFrame[];
  /** A one-line name for a famous goal (Legends). */
  label?: string | null;
  /** What kind of goal it is (Club worldies): "volley", "free kick", "from range"… */
  what?: string;
}

/** One collection file. */
export interface RgCollection { credit: string; key: string; name: string; badge: string; goals: RgRow[] }
/** index.json: the collections and their sizes. */
export interface RgIndexEntry { key: string; name: string; badge: string; count: number; kb: number; tracked: number }
export interface RgIndex { credit: string; collections: RgIndexEntry[] }

export interface RealGoal {
  id: string;
  shot: SbShot;
  x: RgExtra & { frames?: TrackFrame[]; label?: string | null; what?: string };
  /** The collection it is in (wc2022, euro2024, … legends, worldies), and its scoreboard badge. */
  col: string;
  badge: string;
}

/** The goals of one collection file, ready to play. */
export function goalsOf(file: RgCollection): RealGoal[] {
  return file.goals.map((r) => ({
    id: r.id, shot: r.shot, col: file.key, badge: file.badge,
    x: { ...r, comp: r.shot.comp },
  }));
}

// ─────────────────────────────────────────────────────────────────────────
//  NAMES
// ─────────────────────────────────────────────────────────────────────────

const WHOLE_NAMES = new Set(["Carlos Alberto", "Dani Olmo", "Nico Williams", "Lamine Yamal", "Gabriel Jesus", "Bruno Fernandes"]);
const PARTICLES = new Set(["di", "de", "van", "von", "da", "dos", "das", "mac", "el", "al", "ter", "le", "la", "del", "der"]);

/** The name he is known by ("Kylian Mbappé Lottin" → "Kylian Mbappé"). */
export function knownAs(g: RealGoal, full: string): string {
  return g.x.known?.[full]?.[0] ?? full;
}

/** The short name for a shirt ("Kylian Mbappé" → "Mbappé", "Ángel Di María" → "Di María", "Neymar" → "Neymar"). */
export function shortNameOf(known: string): string {
  const w = known.trim().split(/\s+/);
  if (w.length <= 1) return w[0] ?? "";
  // Names a shirt keeps whole ("Carlos Alberto", not "Alberto").
  if (WHOLE_NAMES.has(known.trim())) return known.trim();
  // "Vinícius José Paixão de Oliveira Júnior" → "Vinícius Jr", not "Júnior".
  if (/^(J[uú]nior|Jr\.?)$/i.test(w[w.length - 1])) return `${w[0]} Jr`;
  const prev = w[w.length - 2];
  if (PARTICLES.has(prev.toLowerCase())) return `${prev[0].toUpperCase()}${prev.slice(1)} ${w[w.length - 1]}`;
  return w[w.length - 1];
}

export const scorerShort = (g: RealGoal) => shortNameOf(knownAs(g, g.shot.player));

/** The side that conceded. */
export const concededBy = (g: RealGoal) => (g.x.home === g.shot.team ? g.x.away : g.x.home);

/** "Argentina 2-1 France" — the score just before the goal, as a scoreboard reads it. */
export function scoreBefore(g: RealGoal): string {
  return `${g.x.home} ${g.x.score[0]}-${g.x.score[1]} ${g.x.away}`;
}

/** The minute as a match clock shows it (StatsBomb's minute is the minute already played). */
export const minuteOf = (g: RealGoal) => g.shot.minute + 1;

export function compBadge(g: RealGoal): string {
  if (g.badge && g.badge !== "LEGEND" && g.badge !== "CLUB") return g.badge;
  const c = g.x.comp;
  return c.startsWith("World Cup") ? "WC" : c.startsWith("Euro") ? "EURO" : c.includes("Champions") || c.includes("European Cup") ? "UCL"
    : c.startsWith("Premier") ? "PL" : c.startsWith("La Liga") ? "LIGA" : c.startsWith("Serie") ? "SERIE A" : c.startsWith("Bundes") ? "BUNDES" : c.startsWith("Ligue") ? "L1" : "CLUB";
}

/** Is this goal played with the real camera's tracking (360 frames) for every man in the build-up? */
export const isTracked = (g: RealGoal) => (g.x.frames?.length ?? 0) >= 2;

// ─────────────────────────────────────────────────────────────────────────
//  THE NATIONAL KITS — the ~44 sides in the data (home, change)
// ─────────────────────────────────────────────────────────────────────────

const k = (shirt: string, trim: string): Kit => ({ shirt, trim });
export const NATION_KITS: Record<string, { home: Kit; away: Kit }> = {
  Albania: { home: k("#d7141a", "#111111"), away: k("#111111", "#d7141a") },
  Argentina: { home: k("#75aadb", "#ffffff"), away: k("#3b2a6b", "#75aadb") },
  Australia: { home: k("#ffc72c", "#00843d"), away: k("#00843d", "#ffc72c") },
  Austria: { home: k("#e30613", "#ffffff"), away: k("#ffffff", "#e30613") },
  Belgium: { home: k("#c8102e", "#111111"), away: k("#f4f1ea", "#e86a10") },
  Brazil: { home: k("#ffdc02", "#009c3b"), away: k("#1d3f94", "#ffdc02") },
  Cameroon: { home: k("#007a3d", "#ce1126"), away: k("#fcd116", "#007a3d") },
  Canada: { home: k("#d52b1e", "#111111"), away: k("#ffffff", "#d52b1e") },
  "Costa Rica": { home: k("#c8102e", "#002b7f"), away: k("#ffffff", "#c8102e") },
  Croatia: { home: k("#e8323c", "#ffffff"), away: k("#0b1f4b", "#e8323c") },
  "Czech Republic": { home: k("#d7141a", "#11457e"), away: k("#ffffff", "#11457e") },
  Denmark: { home: k("#c8102e", "#ffffff"), away: k("#ffffff", "#c8102e") },
  Ecuador: { home: k("#ffdd00", "#034ea2"), away: k("#034ea2", "#ffdd00") },
  England: { home: k("#ffffff", "#1b2a5c"), away: k("#c8102e", "#1b2a5c") },
  France: { home: k("#1f2a6b", "#ffffff"), away: k("#ffffff", "#1f2a6b") },
  Georgia: { home: k("#ffffff", "#da291c"), away: k("#da291c", "#ffffff") },
  Germany: { home: k("#ffffff", "#111111"), away: k("#d6338c", "#6b2d7c") },
  Ghana: { home: k("#ffffff", "#111111"), away: k("#ce1126", "#fcd116") },
  Hungary: { home: k("#c8102e", "#436f4d"), away: k("#ffffff", "#c8102e") },
  Iran: { home: k("#ffffff", "#da0000"), away: k("#da0000", "#ffffff") },
  Italy: { home: k("#1a5fb4", "#ffffff"), away: k("#ffffff", "#1a5fb4") },
  Japan: { home: k("#0b2a7a", "#ffffff"), away: k("#ffffff", "#0b2a7a") },
  Mexico: { home: k("#006847", "#ffffff"), away: k("#ffffff", "#006847") },
  Morocco: { home: k("#c1272d", "#006233"), away: k("#ffffff", "#c1272d") },
  Netherlands: { home: k("#f36c21", "#1b1b5e"), away: k("#1b1b5e", "#f36c21") },
  Poland: { home: k("#ffffff", "#dc143c"), away: k("#dc143c", "#ffffff") },
  Portugal: { home: k("#b5121b", "#006600"), away: k("#f2f2f2", "#b5121b") },
  Qatar: { home: k("#8a1538", "#ffffff"), away: k("#ffffff", "#8a1538") },
  Romania: { home: k("#fcd116", "#002b7f"), away: k("#002b7f", "#fcd116") },
  "Saudi Arabia": { home: k("#ffffff", "#006c35"), away: k("#006c35", "#ffffff") },
  Scotland: { home: k("#0b2a5b", "#ffffff"), away: k("#ffffff", "#0b2a5b") },
  Senegal: { home: k("#ffffff", "#00853f"), away: k("#00853f", "#fdef42") },
  Serbia: { home: k("#c6363c", "#0c4076"), away: k("#ffffff", "#c6363c") },
  Slovakia: { home: k("#0b4ea2", "#ffffff"), away: k("#ffffff", "#0b4ea2") },
  Slovenia: { home: k("#ffffff", "#005da4"), away: k("#005da4", "#7ac143") },
  "South Korea": { home: k("#c8102e", "#111111"), away: k("#111111", "#c8102e") },
  Spain: { home: k("#c60b1e", "#ffc400"), away: k("#8fc7e8", "#0b2a5b") },
  Switzerland: { home: k("#d52b1e", "#ffffff"), away: k("#ffffff", "#d52b1e") },
  Tunisia: { home: k("#e70013", "#ffffff"), away: k("#ffffff", "#e70013") },
  Turkey: { home: k("#ffffff", "#e30a17"), away: k("#e30a17", "#ffffff") },
  Ukraine: { home: k("#ffd500", "#005bbb"), away: k("#005bbb", "#ffd500") },
  "United States": { home: k("#ffffff", "#0a3161"), away: k("#0a3161", "#b31942") },
  Uruguay: { home: k("#5cbfeb", "#111111"), away: k("#ffffff", "#5cbfeb") },
  Wales: { home: k("#c8102e", "#00b140"), away: k("#111111", "#c8102e") },
};
/**
 * The other sides in the 888 goals (World Cup 2018, Euro 2020, Copa América
 * 2024, AFCON 2023, the club classics): their real home and change colours.
 * English clubs come from the game's own CLUB_KITS first.
 */
const MORE_KITS: Record<string, { home: Kit; away: Kit }> = {
  "AC Milan": { home: k("#d40000", "#111111"), away: k("#ffffff", "#d40000") },
  "AS Monaco": { home: k("#d4021d", "#ffffff"), away: k("#ffffff", "#d4021d") },
  "AS Roma": { home: k("#8e1f2f", "#f0bc42"), away: k("#ffffff", "#8e1f2f") },
  "Ajax": { home: k("#ffffff", "#d2122e"), away: k("#111111", "#d2122e") },
  "Algeria": { home: k("#ffffff", "#006233"), away: k("#006233", "#ffffff") },
  "Almería": { home: k("#d40c1c", "#ffffff"), away: k("#111111", "#d40c1c") },
  "Angola": { home: k("#cc092f", "#111111"), away: k("#111111", "#cc092f") },
  "Atalanta": { home: k("#1e3e8f", "#111111"), away: k("#ffffff", "#1e3e8f") },
  "Athletic Club": { home: k("#ee2523", "#ffffff"), away: k("#111111", "#ee2523") },
  "Atlético Madrid": { home: k("#cb3524", "#ffffff"), away: k("#272e61", "#cb3524") },
  "Barcelona": { home: k("#a50044", "#004d98"), away: k("#f6c445", "#a50044") },
  "Bastia": { home: k("#0047ab", "#ffffff"), away: k("#ffffff", "#0047ab") },
  "Bayer Leverkusen": { home: k("#e32221", "#111111"), away: k("#111111", "#e32221") },
  "Bayern Munich": { home: k("#dc052d", "#ffffff"), away: k("#ffffff", "#dc052d") },
  "Bolivia": { home: k("#007a3d", "#ffffff"), away: k("#ffffff", "#007a3d") },
  "Borussia Dortmund": { home: k("#fde100", "#111111"), away: k("#111111", "#fde100") },
  "Burkina Faso": { home: k("#ffffff", "#009e49"), away: k("#ef2b2d", "#fcd116") },
  "Cape Verde Islands": { home: k("#003893", "#ffffff"), away: k("#ffffff", "#003893") },
  "Carpi": { home: k("#ffffff", "#d40000"), away: k("#d40000", "#ffffff") },
  "Chievo": { home: k("#ffd700", "#002d72"), away: k("#002d72", "#ffd700") },
  "Chile": { home: k("#d52b1e", "#0039a6"), away: k("#ffffff", "#d52b1e") },
  "Colombia": { home: k("#fcd116", "#003893"), away: k("#003893", "#fcd116") },
  "Congo DR": { home: k("#007fff", "#f7d618"), away: k("#ce1021", "#007fff") },
  "Côte d'Ivoire": { home: k("#f77f00", "#009e60"), away: k("#ffffff", "#f77f00") },
  "Deportivo Alavés": { home: k("#1e5fa8", "#ffffff"), away: k("#ffffff", "#1e5fa8") },
  "Egypt": { home: k("#c8102e", "#ffffff"), away: k("#ffffff", "#c8102e") },
  "Eibar": { home: k("#a00c30", "#004b93"), away: k("#ffffff", "#a00c30") },
  "Eintracht Frankfurt": { home: k("#e1000f", "#111111"), away: k("#111111", "#e1000f") },
  "Equatorial Guinea": { home: k("#e32118", "#3e9a00"), away: k("#ffffff", "#e32118") },
  "Espanyol": { home: k("#007fc8", "#ffffff"), away: k("#111111", "#007fc8") },
  "FC Porto": { home: k("#003c8f", "#ffffff"), away: k("#ffd700", "#003c8f") },
  "FSV Mainz 05": { home: k("#c3141e", "#ffffff"), away: k("#ffffff", "#c3141e") },
  "Finland": { home: k("#ffffff", "#002f6c"), away: k("#002f6c", "#ffffff") },
  "Frosinone": { home: k("#ffd700", "#0050a0"), away: k("#0050a0", "#ffd700") },
  "Gambia": { home: k("#ce1126", "#0c1c8c"), away: k("#ffffff", "#3a7728") },
  "Gazélec Ajaccio": { home: k("#e30613", "#0a3d91"), away: k("#ffffff", "#e30613") },
  "Genoa": { home: k("#a41e34", "#0a2240"), away: k("#ffffff", "#a41e34") },
  "Getafe": { home: k("#005999", "#ffffff"), away: k("#d40c1c", "#ffffff") },
  "Girona": { home: k("#d40c1c", "#ffffff"), away: k("#111111", "#d40c1c") },
  "Guinea": { home: k("#ce1126", "#fcd116"), away: k("#ffffff", "#009460") },
  "Guinea-Bissau": { home: k("#ce1126", "#fcd116"), away: k("#009e49", "#ffffff") },
  "Guingamp": { home: k("#d40c1c", "#111111"), away: k("#ffffff", "#d40c1c") },
  "Hoffenheim": { home: k("#1961b5", "#ffffff"), away: k("#ffffff", "#1961b5") },
  "Huesca": { home: k("#003b7a", "#a00c30"), away: k("#ffffff", "#003b7a") },
  "Iceland": { home: k("#02529c", "#ffffff"), away: k("#ffffff", "#02529c") },
  "Inter Milan": { home: k("#0068a8", "#111111"), away: k("#ffffff", "#0068a8") },
  "Jamaica": { home: k("#fed100", "#009b3a"), away: k("#111111", "#fed100") },
  "Juventus": { home: k("#ffffff", "#111111"), away: k("#111111", "#ffffff") },
  "Leeds United": { home: k("#ffffff", "#1d428a"), away: k("#1d428a", "#ffcd00") },
  "Leganés": { home: k("#ffffff", "#003da5"), away: k("#003da5", "#ffffff") },
  "Leicester City": { home: k("#003090", "#fdbe11"), away: k("#ffffff", "#003090") },
  "Lens": { home: k("#ffd700", "#d40c1c"), away: k("#d40c1c", "#ffd700") },
  "Levante UD": { home: k("#004b93", "#a00c30"), away: k("#ffffff", "#004b93") },
  "Lille": { home: k("#e01e13", "#20325f"), away: k("#ffffff", "#e01e13") },
  "Lyon": { home: k("#ffffff", "#1e3e8f"), away: k("#1e3e8f", "#e01e13") },
  "Mali": { home: k("#14b53a", "#fcd116"), away: k("#fcd116", "#ce1126") },
  "Mallorca": { home: k("#e20613", "#111111"), away: k("#111111", "#e20613") },
  "Mauritania": { home: k("#00a95c", "#ffd700"), away: k("#ffffff", "#00a95c") },
  "Mozambique": { home: k("#d21034", "#111111"), away: k("#ffffff", "#d21034") },
  "Málaga": { home: k("#3399ff", "#ffffff"), away: k("#111111", "#3399ff") },
  "Namibia": { home: k("#003580", "#ffce00"), away: k("#ffffff", "#003580") },
  "Nantes": { home: k("#fcd405", "#00764b"), away: k("#00764b", "#fcd405") },
  "Napoli": { home: k("#12a0d7", "#ffffff"), away: k("#ffffff", "#12a0d7") },
  "Nigeria": { home: k("#008751", "#ffffff"), away: k("#ffffff", "#008751") },
  "North Macedonia": { home: k("#d20000", "#ffe600"), away: k("#ffffff", "#d20000") },
  "Palermo": { home: k("#f4a8c4", "#111111"), away: k("#111111", "#f4a8c4") },
  "Panama": { home: k("#da121a", "#ffffff"), away: k("#ffffff", "#072357") },
  "Paraguay": { home: k("#d52b1e", "#ffffff"), away: k("#0038a8", "#ffffff") },
  "Paris Saint-Germain": { home: k("#004170", "#da291c"), away: k("#ffffff", "#004170") },
  "Peru": { home: k("#ffffff", "#d91023"), away: k("#d91023", "#ffffff") },
  "RC Deportivo La Coruña": { home: k("#0067b1", "#ffffff"), away: k("#111111", "#0067b1") },
  "Racing Santander": { home: k("#ffffff", "#00703c"), away: k("#00703c", "#ffffff") },
  "Rayo Vallecano": { home: k("#ffffff", "#e30613"), away: k("#111111", "#e30613") },
  "Real Betis": { home: k("#00954c", "#ffffff"), away: k("#111111", "#00954c") },
  "Real Madrid": { home: k("#ffffff", "#febe10"), away: k("#1d2a58", "#ffffff") },
  "Real Sociedad": { home: k("#0067b1", "#ffffff"), away: k("#ff6a00", "#111111") },
  "Real Valladolid": { home: k("#5b2a86", "#ffffff"), away: k("#ffffff", "#5b2a86") },
  "Real Zaragoza": { home: k("#ffffff", "#003a8c"), away: k("#003a8c", "#ffffff") },
  "Recreativo Huelva": { home: k("#ffffff", "#0055a5"), away: k("#0055a5", "#ffffff") },
  "Rennes": { home: k("#e13327", "#111111"), away: k("#ffffff", "#e13327") },
  "Russia": { home: k("#d52b1e", "#ffffff"), away: k("#ffffff", "#0039a6") },
  "Sassuolo": { home: k("#00a752", "#111111"), away: k("#ffffff", "#00a752") },
  "Schalke 04": { home: k("#004d9d", "#ffffff"), away: k("#ffffff", "#004d9d") },
  "Sevilla": { home: k("#ffffff", "#d40c1c"), away: k("#d40c1c", "#ffffff") },
  "South Africa": { home: k("#ffb612", "#007749"), away: k("#007749", "#ffb612") },
  "Stade Malherbe Caen": { home: k("#1a3e84", "#e30613"), away: k("#ffffff", "#1a3e84") },
  "Stade de Reims": { home: k("#e30613", "#ffffff"), away: k("#ffffff", "#e30613") },
  "Sweden": { home: k("#fecc02", "#006aa7"), away: k("#006aa7", "#fecc02") },
  "Tanzania": { home: k("#1eb53a", "#00a3dd"), away: k("#00a3dd", "#fcd116") },
  "Torino": { home: k("#8a1e03", "#ffffff"), away: k("#ffffff", "#8a1e03") },
  "Toulouse": { home: k("#5b2a86", "#ffffff"), away: k("#ffffff", "#5b2a86") },
  "Troyes": { home: k("#0a4ca3", "#ffffff"), away: k("#ffffff", "#0a4ca3") },
  "Udinese": { home: k("#ffffff", "#111111"), away: k("#111111", "#ffffff") },
  "Union Berlin": { home: k("#eb1923", "#ffffff"), away: k("#ffffff", "#eb1923") },
  "Valencia": { home: k("#ffffff", "#ee3524"), away: k("#111111", "#ff7f00") },
  "Venezuela": { home: k("#7a1b2e", "#fcd116"), away: k("#ffffff", "#7a1b2e") },
  "Villarreal": { home: k("#ffe667", "#005187"), away: k("#005187", "#ffe667") },
  "Werder Bremen": { home: k("#1d9053", "#ffffff"), away: k("#ffffff", "#1d9053") },
  "Wolfsburg": { home: k("#65b32e", "#ffffff"), away: k("#ffffff", "#65b32e") },
  "Zambia": { home: k("#198a00", "#ef7d00"), away: k("#ffffff", "#198a00") },
};
for (const [team, kits] of Object.entries(MORE_KITS)) if (!NATION_KITS[team]) NATION_KITS[team] = kits;
for (const team of ["Arsenal", "Aston Villa", "AFC Bournemouth", "Chelsea", "Crystal Palace", "Liverpool", "Manchester City", "Manchester United", "Newcastle United", "Southampton", "Stoke City", "Sunderland", "Swansea City", "Tottenham Hotspur", "West Bromwich Albion", "West Ham United", "Leicester City", "Leeds United"]) {
  const c = CLUB_KITS[team];
  if (c && !NATION_KITS[team]) NATION_KITS[team] = { home: k(c.home.shirt.toLowerCase(), c.home.trim.toLowerCase()), away: k(c.away.shirt.toLowerCase(), c.away.trim.toLowerCase()) };
}
const FALLBACK: { home: Kit; away: Kit } = { home: k("#64748b", "#ffffff"), away: k("#ffffff", "#64748b") };

const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
/** How far apart two colours are (0..441). */
export function colourGap(a: string, b: string): number {
  const p = rgb(a), q = rgb(b);
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}
/** Two shirts this close are hard to tell apart on a small pitch. */
export const KIT_CLASH = 120;

const KEEPER_SHIRTS: Kit[] = [k("#a3e635", "#14532d"), k("#f97316", "#111111"), k("#111111", "#a3e635"), k("#7c3aed", "#ffffff"), k("#06b6d4", "#111111")];

/** The two real sides' shirts: the scorers in their home kit, the others in theirs unless it clashes. */
export function kitsForGoal(g: RealGoal): { us: Kit; them: Kit; keeper: Kit } {
  const us = (NATION_KITS[g.shot.team] ?? FALLBACK).home;
  const t = NATION_KITS[concededBy(g)] ?? FALLBACK;
  const them = colourGap(t.home.shirt, us.shirt) < KIT_CLASH ? t.away : t.home;
  const keeper = KEEPER_SHIRTS.find((kk) => colourGap(kk.shirt, us.shirt) >= KIT_CLASH && colourGap(kk.shirt, them.shirt) >= KIT_CLASH) ?? KEEPER_SHIRTS[0];
  return { us, them, keeper };
}

// ─────────────────────────────────────────────────────────────────────────
//  WHERE THE REAL BALL WENT
// ─────────────────────────────────────────────────────────────────────────

const YD = 0.9144;
/** How far inside the posts and bar the real goal's spot is kept (m): ball (0.11) + post (0.06) + room for a human wobble. */
export const END_ROOM = 0.4;

/** Where the real goal crossed the goal line: x across (our metres), z up (metres). */
export function realEnd(g: RealGoal): { x: number; z: number } {
  const e = g.shot.end ?? [120, 40];
  const x = sbToPitch([120, e[1]]).x;
  // StatsBomb records the height in yards; a goal with none went in along the grass.
  const z = g.x.endZ === null ? 0.15 : g.x.endZ * YD;
  // Kept a ball and a post inside the frame: StatsBomb puts a goal in off the
  // inside of the post ON the post, and the same spot here would hit it.
  return { x: Math.min(POST_R - END_ROOM, Math.max(POST_L + END_ROOM, x)), z: Math.max(0.11, Math.min(2.44 - END_ROOM, z)) };
}

export const realStart = (g: RealGoal): Vec2 => sbToPitch(g.shot.loc);

/**
 * The real ball's flight, sampled (pitch metres, z up): a straight line over
 * the grass from where it was struck to where it crossed, rising to the real
 * height. StatsBomb has no path, only the two ends, so the arc is drawn the
 * shape the strike suggests (a lob or a chip goes up first; a header or a
 * drive barely arcs).
 */
export function ghostPath(g: RealGoal, n = 28): RealGoalGhost {
  const a = realStart(g), e = realEnd(g);
  const dist = Math.hypot(e.x - a.x, a.y);
  const t = g.shot.technique, body = g.shot.body;
  const z0 = body === "Head" ? 1.9 : t === "Volley" || t === "Overhead Kick" || t === "Diving Header" ? 0.7 : 0.11;
  const bulge = t === "Lob" ? Math.max(1.6, dist * 0.14) : body === "Head" ? 0.15 : Math.min(1.1, dist * 0.035);
  const pts: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    pts.push({ x: a.x + (e.x - a.x) * f, y: a.y * (1 - f), z: z0 + (e.z - z0) * f + bulge * 4 * f * (1 - f) });
  }
  const durS = g.x.dur && g.x.dur > 0.15 ? g.x.dur : Math.max(0.4, dist / 22);
  return { pts, durS };
}

// ─────────────────────────────────────────────────────────────────────────
//  ACCURACY AND STARS
// ─────────────────────────────────────────────────────────────────────────

/**
 * How close your ball crossed the line to the real one, 0–100%. A bell curve
 * on the distance in the goal mouth (across and up): 100% on the spot, 85%
 * at 45 cm, 60% at 80 cm, 25% at 1.3 m. Height counts a little less than
 * across (it is harder to judge on a phone): 1 m too high = 0.8 m wide.
 */
export const ACC_SIGMA = 1.116;
export const ACC_HEIGHT_WEIGHT = 0.8;
export function accuracyPct(real: { x: number; z: number }, you: { x: number; z: number } | null): number {
  if (!you) return 0;
  const d = Math.hypot(you.x - real.x, (you.z - real.z) * ACC_HEIGHT_WEIGHT);
  return Math.max(0, Math.min(100, 100 * Math.exp(-((d / ACC_SIGMA) ** 2))));
}

/** ★ a goal, ★★ a goal at 60%+, ★★★ a goal at 85%+. No goal: no stars. */
export const STAR_TWO = 60;
export const STAR_THREE = 85;
export function starsFor(scored: boolean, pct: number): 0 | 1 | 2 | 3 {
  if (!scored) return 0;
  return pct >= STAR_THREE ? 3 : pct >= STAR_TWO ? 2 : 1;
}

// ─────────────────────────────────────────────────────────────────────────
//  ALWAYS SCOREABLE AS THE REAL GOAL (the engine's Scenario.realLane)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Leo, 19 Oct 2026: "make sure that if the shot is almost exactly like the
 * real shot then it WILL go in no matter what, if a player didnt block it irl
 * they cant block the IDENTICAL same shot in game".
 *
 * A strike heading LANE_PCT% or more like the real one (the page's own
 * accuracy %, worked out at the moment you strike it) is in the real lane:
 * nobody blocks it, the keeper does not save it. Before (v0.17) the lane was a
 * separate box (0.6 m across, 0.55 m up), so a shot the page called 77% could
 * still be saved. Now the two use the same distance.
 */
export const LANE_PCT = 70;
/** The lane's radius (m): where the accuracy curve reaches LANE_PCT. */
export const LANE_R = ACC_SIGMA * Math.sqrt(-Math.log(LANE_PCT / 100));
/** The old box, kept for the measurements' before. */
export const LANE_TOL_X = 0.6;
export const LANE_TOL_Z = 0.55;

/** The real goal as one of our chances, with its real lane switched on. */
export function scenarioForGoal(g: RealGoal, lane: boolean | "box" = true): Scenario {
  // Every real man in the freeze frame is in the chance (the build-up never makes one vanish).
  const sc = scenarioForShot(g.shot, { wideFrame: true, allPeople: true });
  if (lane) {
    const e = realEnd(g);
    sc.realLane = lane === "box"
      ? { x: e.x, z: e.z, tolX: LANE_TOL_X, tolZ: LANE_TOL_Z }
      : { x: e.x, z: e.z, tolX: LANE_TOL_X, tolZ: LANE_TOL_Z, r: LANE_R, hw: ACC_HEIGHT_WEIGHT };
  }
  return sc;
}

// ─────────────────────────────────────────────────────────────────────────
//  THE REAL NAMES ON THE REAL MEN
// ─────────────────────────────────────────────────────────────────────────

interface Named { at: Vec2; side: "mate" | "opp" | "keeper"; name: string; pos: string }

export function namedPeople(g: RealGoal): Named[] {
  return g.shot.ff.map(([x, y, mate, gk], i) => ({
    at: sbToPitch([x, y]),
    side: (mate ? "mate" : gk ? "keeper" : "opp") as Named["side"],
    name: knownAs(g, g.x.names[i] ?? ""),
    pos: g.x.pos[i] ?? "",
  }));
}

const idFor = (name: string, pos: string) => ({ id: `rg:${name}`, name, shortName: shortNameOf(name), position: pos });

/**
 * Puts the real names on the chance's men (CanvasMatch calls it after casting
 * its own): the keeper, each defender and team-mate on the real man standing
 * where he stands. A man the real frame has nobody for (the match's own
 * poacher) is left nameless — never one of the test club's players.
 */
export function dressFor(g: RealGoal): (sc: Scenario) => void {
  const people = namedPeople(g);
  return (sc) => {
    const used = new Set<number>();
    const take = (side: Named["side"], p: Vec2, within = 2.5) => {
      let best = -1, bd = within;
      people.forEach((q, i) => {
        if (used.has(i) || q.side !== side) return;
        const d = Math.hypot(q.at.x - p.x, q.at.y - p.y);
        if (d < bd) { bd = d; best = i; }
      });
      if (best < 0) return null;
      used.add(best);
      return idFor(people[best].name, people[best].pos);
    };
    const blank = { id: "rg:none", name: "", shortName: "", position: "" };
    sc.keeper.who = take("keeper", sc.keeper, 6) ?? blank;
    for (const d of sc.defenders) d.who = take("opp", d) ?? blank;
    if (sc.runner) sc.runner.who = take("mate", sc.runner.pos) ?? blank;
    for (const r of sc.secondaryRunners) r.who = take("mate", r.pos) ?? blank;
    for (const t of sc.teammates) t.who = take("mate", t) ?? blank;
    sc.follower.who = take("mate", sc.follower) ?? blank;
  };
}

/**
 * For the build-up (leadinTrack's `isNamed`): is the man with this lead-in key
 * wearing the passer's real name? So the man who plays a pass is the man whose
 * name is over his head (seen on the page: "Bellingham on the ball" while the
 * ball was at the feet of the man labelled Foden).
 */
export function isNamedFor(g: RealGoal, sc: Scenario): (key: string, passer: string) => boolean | undefined {
  const whoOf = (key: string) => {
    if (key === "run") return sc.runner?.who;
    if (key === "follower") return sc.follower.who;
    const m = /^(def|mate|sec)(\d+)$/.exec(key);
    if (!m) return undefined;
    const i = Number(m[2]);
    return m[1] === "def" ? sc.defenders[i]?.who : m[1] === "mate" ? sc.teammates[i]?.who : sc.secondaryRunners[i]?.who;
  };
  // true: he IS the passer; false: he is somebody else (never plays it); undefined: nameless.
  return (key, passer) => { const w = whoOf(key); return w?.name ? w.name === knownAs(g, passer) : undefined; };
}

/** Everything the match is handed for this goal (CanvasMatch's `realGoal`). */
export function viewForGoal(g: RealGoal, ghostOn: boolean): RealGoalView {
  const kits = kitsForGoal(g);
  return {
    us: { name: g.shot.team, kit: kits.us },
    them: { name: concededBy(g), kit: kits.them },
    keeperKit: kits.keeper,
    badge: compBadge(g),
    youName: scorerShort(g),
    showNames: true,
    dress: dressFor(g),
    ghost: ghostOn ? ghostPath(g) : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────
//  DIFFICULTY, LEVELS, STARS SAVED ON THE PHONE
// ─────────────────────────────────────────────────────────────────────────

/** Goals named on the page first (Leo's, and other famous ones in the data). */
export const FEATURED: { id: string; label: string }[] = [
  { id: "03fb2918", label: "Mbappé's volley v Argentina — World Cup final" },
  { id: "657ac0ef", label: "Neymar v Croatia — the extra-time one-two" },
  { id: "f49ffee0", label: "Saka v Switzerland — through the gap" },
  { id: "32b4bd54", label: "Güler v Georgia — top corner from 25 m" },
  { id: "fedfb68d", label: "Yamal v France — the curler" },
  { id: "c71a4f0a", label: "Bellingham v Slovakia — the overhead kick" },
  { id: "f32f451c", label: "Richarlison v Serbia — the scissor kick" },
  { id: "54b889ec", label: "Messi v France — World Cup final, 108'" },
  { id: "ef86f4d9", label: "Di María v France — World Cup final" },
  { id: "70e7f361", label: "Messi v Mexico — low from 25 m" },
  { id: "19d5c45f", label: "Oyarzabal v England — Euro 2024 final winner" },
  { id: "bf03dfcf", label: "Nico Williams v England — Euro 2024 final" },
  { id: "07c658a2", label: "Al Dawsari v Argentina — the shock" },
  { id: "d71bc1d5", label: "Asano v Germany — the near-post finish" },
  { id: "61d6d669", label: "Musiala v Scotland — Euro 2024's opener" },
  { id: "f3b86342", label: "Merino v Germany — the 119th-minute header" },
  { id: "dc16ea8a", label: "Watkins v Netherlands — the late winner" },
  { id: "7d0b37dd", label: "Pavard v Argentina — the half-volley" },
  { id: "a1da3a4b", label: "Quaresma v Iran — the outside of the boot" },
  { id: "526c3ca4", label: "Ronaldo's free kick v Spain — hat-trick" },
  { id: "c7b79eb5", label: "Messi v Nigeria — thigh, foot, finish" },
  { id: "989f9092", label: "Kroos v Sweden — 95th minute" },
  { id: "59cd7437", label: "Modrić v Argentina — from 25 m" },
  { id: "63b6b995", label: "Mbappé v Argentina — the 19-year-old" },
  { id: "6946589d", label: "Di María v France — the screamer" },
  { id: "ae7860e0", label: "Golovin's free kick v Saudi Arabia" },
  { id: "8023b6b6", label: "Mandžukić v England — into the final" },
  { id: "8b8479e0", label: "Pogba — World Cup final 2018" },
  { id: "8b3b883a", label: "Mbappé — World Cup final 2018" },
  { id: "02add02f", label: "Coutinho v Switzerland — the curler" },
  { id: "26ef739f", label: "Schick v Scotland — from the halfway line" },
  { id: "731a6026", label: "Pogba v Switzerland — the curler" },
  { id: "3b50aa84", label: "Damsgaard's free kick v England" },
  { id: "6605af47", label: "Shaw — Euro 2020 final, 2nd minute" },
  { id: "eb8df622", label: "Insigne v Belgium — the trademark" },
  { id: "51e7dde0", label: "Chiesa v Spain — the semi-final" },
  { id: "edc62055", label: "Modrić v Scotland — the outside of the boot" },
  { id: "b8aaa89d", label: "Messi's volley — Copa América 2024" },
  { id: "231b12e4", label: "Lautaro — Copa América 2024 final winner" },
  { id: "c406e643", label: "Haller — the AFCON 2023 final winner" },
];
const FEATURED_IDS = new Set(FEATURED.map((f) => f.id));

/**
 * How hard the goal is to recreate. Mostly the chance itself (StatsBomb's xG:
 * a 2% shot is far harder than a 50% one), plus bodies in the way, distance,
 * and a finish into a top corner.
 */
export function difficultyOf(g: RealGoal): number {
  const p = peopleOf(g.shot);
  const xg = Math.max(0.005, g.shot.xg);
  const dist = Math.hypot(p.ball.x - CX, p.ball.y);
  const e = realEnd(g);
  const corner = e.z > 1.5 && Math.abs(e.x - CX) > 2.4 ? 0.5 : 0;
  const special = /Volley|Overhead|Diving/.test(g.shot.technique) ? 0.4 : 0;
  return -Math.log(xg) + 0.3 * blockersOf(p.ball, p.opps) + 0.04 * Math.max(0, dist - 11) + corner + special;
}

/**
 * THE GAME (Leo, 19 Oct 2026: "score hero system of going up the levels").
 * Each collection is played as itself: a tournament round by round (group
 * stage, round of 16 … the final, in the order they were scored); Legends
 * and Club worldies by where they were scored. Every goal is a level with 1-3
 * stars. A chapter opens when half the goals of the chapter before it have a
 * star — so a whole tournament can be played, but it is earned.
 */
export interface Chapter { n: number; name: string; goals: RealGoal[] }

const ROUND_ORDER = ["Group Stage", "Round of 16", "Quarter-finals", "Semi-finals", "3rd Place Final", "Final"];
const ROUND_NAME: Record<string, string> = {
  "Group Stage": "Group stage", "Round of 16": "Round of 16", "Quarter-finals": "Quarter-finals",
  "Semi-finals": "Semi-finals", "3rd Place Final": "Third place", Final: "The final",
};

/** Where a club goal was scored, as a chapter name. */
export function placeOf(g: RealGoal): string {
  const c = g.x.comp;
  if (/^World Cup 19/.test(c)) return "World Cup classics";
  if (/Champions League|European Cup/.test(c)) return "European nights";
  if (c.startsWith("Premier League")) return "Premier League";
  if (c.startsWith("La Liga")) return "La Liga";
  if (c.startsWith("Serie A")) return "Serie A";
  if (c.startsWith("Bundesliga")) return "Bundesliga";
  if (c.startsWith("Ligue 1")) return "Ligue 1";
  return "More";
}
const PLACE_ORDER = ["World Cup classics", "European nights", "Premier League", "La Liga", "Serie A", "Bundesliga", "Ligue 1", "More"];

/** The chapters of one collection, in the order they are played. */
export function chaptersFor(goals: RealGoal[]): Chapter[] {
  const club = goals.length > 0 && (goals[0].col === "legends" || goals[0].col === "worldies");
  const by = new Map<string, RealGoal[]>();
  for (const g of goals) {
    const key = club ? placeOf(g) : (ROUND_ORDER.includes(g.x.stage) ? g.x.stage : "Group Stage");
    by.set(key, [...(by.get(key) ?? []), g]);
  }
  const order = club ? PLACE_ORDER : ROUND_ORDER;
  const out: Chapter[] = [];
  for (const key of order) {
    const list = by.get(key);
    if (!list?.length) continue;
    // In the order they happened (club chapters: oldest first; a tournament: by date and minute).
    list.sort((a, b) => a.x.date.localeCompare(b.x.date) || a.x.matchId - b.x.matchId || a.x.period - b.x.period || a.shot.minute - b.shot.minute || a.x.second - b.x.second);
    if (!club && key === "Group Stage") {
      // The group stage is three matchdays: its matches split in three by date.
      const matches = Array.from(new Set(list.map((g) => `${g.x.date}|${g.x.matchId}`))).sort();
      const day = (g: RealGoal) => Math.min(2, Math.floor((matches.indexOf(`${g.x.date}|${g.x.matchId}`) * 3) / matches.length));
      for (let d = 0; d < 3; d++) {
        const part = list.filter((g) => day(g) === d);
        if (part.length) out.push({ n: out.length, name: `Matchday ${d + 1}`, goals: part });
      }
      continue;
    }
    out.push({ n: out.length, name: club ? key : ROUND_NAME[key] ?? key, goals: list });
  }
  return out;
}

/** Half the goals of the chapter before need a star to open a chapter. */
export const CHAPTER_OPEN_SHARE = 0.5;
export const starredIn = (ch: Chapter, p: Progress) => ch.goals.filter((g) => (p[g.id]?.stars ?? 0) > 0).length;
export const starsIn = (goals: RealGoal[], p: Progress) => goals.reduce((a, g) => a + (p[g.id]?.stars ?? 0), 0);
/** How many stars of the chapter before it a chapter still needs, 0 = open. */
export function chapterNeeds(chs: Chapter[], i: number, p: Progress): number {
  if (i <= 0) return 0;
  const prev = chs[i - 1];
  return Math.max(0, Math.ceil(prev.goals.length * CHAPTER_OPEN_SHARE) - starredIn(prev, p));
}
export const chapterOpen = (chs: Chapter[], i: number, p: Progress) => chapterNeeds(chs, i, p) === 0 && (i === 0 || chapterOpen(chs, i - 1, p));

/** 1 (easy) to 5 (a worldie): difficultyOf in five bands, measured over all 888 goals (tests/star/realGoals.mts). */
export const DIFFICULTY_CUTS = [0.92, 1.75, 2.63, 4.02];
export function difficultyTier(g: RealGoal): 1 | 2 | 3 | 4 | 5 {
  const d = difficultyOf(g);
  return (1 + DIFFICULTY_CUTS.filter((c) => d >= c).length) as 1 | 2 | 3 | 4 | 5;
}

/** Per level id: the best stars and the best accuracy. */
export type Progress = Record<string, { stars: number; best: number }>;

export const totalStars = (p: Progress) => Object.values(p).reduce((a, v) => a + v.stars, 0);

/** A result in: keeps the best stars and the best accuracy. */
export function recordResult(p: Progress, id: string, stars: number, pct: number): Progress {
  const was = p[id] ?? { stars: 0, best: 0 };
  return { ...p, [id]: { stars: Math.max(was.stars, stars), best: Math.max(was.best, Math.round(pct)) } };
}

const KEY = "star-real-goals-progress-v1";
export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? JSON.parse(raw) : {};
    return v && typeof v === "object" ? v : {};
  } catch { return {}; }
}
export function saveProgress(p: Progress): void {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* private window: this visit only */ }
}

// ─────────────────────────────────────────────────────────────────────────
//  THE BUILD-UP, CLOSER TO THE REAL MOVE
// ─────────────────────────────────────────────────────────────────────────
//
// The Real shots page replays the last 2-3 completed passes, timed so the
// whole thing fits LEAD_MAX_S, with the carries between them guessed as
// straight runs. goals.json has the whole move (every pass, carry and
// dribble with its real timestamp), so the build-up here plays the real
// actions at the real times: the ball goes where the real ball went, when it
// went there.

/** The longest build-up (seconds of the real move). */
export const MOVE_MAX_S = 14;

/** The window of the move the build-up plays (oldest first). */
export function moveWindow(g: RealGoal, lead?: SbLeadin): RgMoveEv[] {
  const mv = g.x.move.filter((e) => e[2]);
  if (!mv.length) return [];
  // With a 360 frame for the old lead-in's first pass, start there, so the
  // men start where StatsBomb saw them.
  const first = lead?.start && lead.passes.length ? lead.passes[0][0] : null;
  let from = mv.findIndex((e) => e[1] === "P" && first !== null && Math.abs(e[0] - first) < 0.8 && e[0] <= MOVE_MAX_S + 4);
  if (from < 0) from = mv.findIndex((e) => e[0] <= MOVE_MAX_S);
  if (from < 0) from = mv.length - 1;
  return mv.slice(from);
}

/** The window's passes, as the lead-in's pass list ([seconds before, from, to, passer, recipient]). */
export function windowPasses(win: RgMoveEv[]): SbPass[] {
  return win.filter((e) => e[1] === "P" && e[3] && e[5]).map((e) => [e[0], e[2], e[3]!, e[4], e[5]!] as SbPass);
}

/** A lead-in (for leadinTrack) made of the window's real passes; keeps the 360 start only when the window starts on its pass. */
export function realMoveLeadin(g: RealGoal, lead?: SbLeadin): SbLeadin | null {
  const win = moveWindow(g, lead);
  const passes = windowPasses(win);
  if (!passes.length) return null;
  const sameStart = !!lead?.start && lead.passes.length > 0 && Math.abs(lead.passes[0][0] - passes[0][0]) < 0.8;
  return { passes, path: lead?.path ?? [], start: sameStart ? lead!.start : undefined };
}

const HOLD_S = 0.45;
const flightS = (d: number) => Math.min(1.8, Math.max(0.3, d / 18));

/**
 * The ball at the real timing: every pass leaves at its real time and arrives
 * when the next action starts; every carry runs from its real start to its
 * real end. Ends on `end` (the chance's ball) at the shot's real time.
 */
export function realBallKeys(g: RealGoal, win: RgMoveEv[], end: Vec2): LeadBallKey[] {
  if (!win.length) return [{ t: 0, p: { ...end } }, { t: 0.5, p: { ...end } }];
  const T = win[0][0] + HOLD_S;          // seconds of build-up
  const at = (back: number) => T - back;
  const keys: LeadBallKey[] = [];
  const push = (t: number, p: Vec2, pass?: { h: number }) => {
    const last = keys[keys.length - 1];
    if (last && t <= last.t + 1e-3) t = last.t + 0.05;
    keys.push(pass ? { t, p, pass } : { t, p });
  };
  push(0, sbToPitch(win[0][2]));
  win.forEach((e, i) => {
    const from = sbToPitch(e[2]);
    const t0 = Math.max(HOLD_S * (i === 0 ? 1 : 0), at(e[0]));
    const last = keys[keys.length - 1];
    if (Math.hypot(last.p.x - from.x, last.p.y - from.y) > 0.3 || t0 > last.t + 0.05) push(Math.max(t0, last.t + 0.05), from);
    const nextT = i + 1 < win.length ? at(win[i + 1][0]) : T;
    if (e[1] === "P" && e[3] && e[5]) {
      const to = sbToPitch(e[3]);
      const d = Math.hypot(to.x - from.x, to.y - from.y);
      // It arrives as the next action starts (the receiver's touch), never quicker than a ball can travel.
      const start = keys[keys.length - 1].t;
      push(Math.max(nextT, start + Math.min(flightS(d), 0.6)), to, { h: e[6] === 2 ? Math.min(5, d * 0.1) : e[6] === 1 ? Math.min(1.5, d * 0.05) : 0 });
    } else if (e[3]) {
      push(Math.max(nextT - 0.05, keys[keys.length - 1].t + 0.1), sbToPitch(e[3]));
    }
  });
  push(Math.max(T, keys[keys.length - 1].t + 0.05), { ...end });
  return keys;
}

/** Every real action in the window as (seconds before the shot, where the ball was). */
export function realTouches(win: RgMoveEv[]): { back: number; p: Vec2 }[] {
  const out: { back: number; p: Vec2 }[] = [];
  for (const e of win) out.push({ back: e[0], p: sbToPitch(e[2]) });
  return out;
}

/**
 * How far the replayed ball is from the real ball, metres, averaged over the
 * real actions: each real touch (where and how long before the shot) against
 * where the replay's ball is that long before its own end.
 */
export function replayError(keys: LeadBallKey[], touches: { back: number; p: Vec2 }[]): number {
  if (!touches.length) return NaN;
  const dur = keys[keys.length - 1].t;
  let sum = 0;
  for (const t of touches) {
    const b = ballAlong(keys, Math.max(0, dur - t.back));
    sum += Math.hypot(b.x - t.p.x, b.y - t.p.y);
  }
  return sum / touches.length;
}

// ─────────────────────────────────────────────────────────────────────────
//  THE BUILD-UP (Leo, 19 Oct 2026: "almost identical to the real goal")
// ─────────────────────────────────────────────────────────────────────────

/** The real move, played before the chance (realGoalTrack.ts). Null: no move (a penalty, a free kick taken first). */
export function trackForGoal(g: RealGoal, sc: Scenario): RealTrack | null {
  if (g.shot.type === "Penalty") return null;
  return realTrack({
    shooter: g.shot.player, move: g.x.move, frames: g.x.frames, ff: g.shot.ff, names: g.x.names,
    short: (full) => shortNameOf(knownAs(g, full)),
  }, sc);
}
