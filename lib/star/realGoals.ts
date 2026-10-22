/**
 * REAL GOALS — a little game made of real goals (TEST PAGE ONLY,
 * /star-real-goals-dev). Leo, 18 Oct 2026: "we should one HUNDRED percent have
 * a real shots mode … u gotta try get 100% accuracy from real irl goal … maybe
 * like score hero system of going up the levels getting harder and stars".
 *
 * Every non-penalty goal of the 2018 World Cup and Euro 2016 (232), from the
 * Wyscout public dataset (CC BY 4.0, data/realmoments/wyscout_shots.json and
 * wyscout_goals.json, scripts/realmoments/extract_wyscout.py): the scorer,
 * the minute, the two sides, the score before it, where it was struck, where
 * it went in (Wyscout's 3 x 3 goal-mouth zones) and the whole move before it.
 * Wyscout has nobody's position off the ball, so the defenders and keeper are
 * PLACED by the game's own scenario rules (lib/star/realMoments, "placed").
 *
 * Pure: no React, no canvas. tests/star/realGoals.mts checks it.
 * Credit: REAL_CREDIT.wyscout (data/opendata/LICENCES.md).
 */
import type { Scenario, Vec2 } from "./canvasEngine";
import { kitsOf, type Kit } from "./kits";
import type { LeadBallKey } from "./leadIn";
import { ballAlong } from "./leadIn";
import type { RealGoalView, RealGoalGhost } from "./realGoalView";
import { P, scenarioForShot, type RealShot, type RealLead, type RealPass, type XY } from "./realMoments";
import { CX, POST_L, POST_R } from "./pitch";

// ─────────────────────────────────────────────────────────────────────────
//  THE DATA
// ─────────────────────────────────────────────────────────────────────────

/** One action of the move: [seconds before the shot, P(ass) / C(arry), from, to | null, player, recipient | null, height 0-2]. */
export type RgMoveEv = [number, "P" | "C", XY, XY | null, string, string | null, number];

/** The match facts for one goal (wyscout_goals.json). */
export interface RgExtra {
  id: string;
  comp: string;
  home: string;
  away: string;
  stage: string;
  date: string;
  /** The final score (after extra time), [home, away]. */
  final: [number, number];
  /** The score just before the goal, [home, away]. */
  score: [number, number];
  /** The conceding side's keeper (from the line-up). */
  keeper: string;
  period: string;
  move: RgMoveEv[];
  /** Bangers only (data/realmoments/bangers.json, drafted by us from public record): */
  label?: string;
  /** How it was struck ("overhead kick", "volley"). */
  technique?: string;
  /** The match report the facts were checked against. */
  source?: string;
  source2?: string;
  checked?: string;
  note?: string;
  /** "drafted from public record" — never licensed data. */
  drafted?: string;
}

export interface RgFile { goals: RgExtra[] }

export interface RealGoal {
  id: string;
  shot: RealShot;
  x: RgExtra;
}

/** The goals the page plays: open play, corners and free kicks, with their match facts. */
export function joinGoals(shots: RealShot[], extras: RgExtra[]): RealGoal[] {
  const by = new Map(extras.map((e) => [e.id, e]));
  const out: RealGoal[] = [];
  for (const s of shots) {
    if (s.outcome !== "Goal" || s.type === "Penalty") continue;
    const x = by.get(s.id);
    if (x) out.push({ id: s.id, shot: s, x });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────
//  NAMES
// ─────────────────────────────────────────────────────────────────────────

const PARTICLES = new Set(["di", "de", "van", "von", "da", "dos", "das", "mac", "el", "al", "ter", "le", "la", "del", "der"]);

/** The name he is known by (the data already gives it: "Kylian Mbappé"). */
export function knownAs(_g: RealGoal, full: string): string {
  return full.replace(/\s+/g, " ").trim();
}

/** The short name for a shirt ("Kylian Mbappé" → "Mbappé", "Ángel Di María" → "Di María", "Neymar" → "Neymar"). */
export function shortNameOf(known: string): string {
  const w = known.trim().split(/\s+/);
  if (w.length <= 1) return w[0] ?? "";
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

/** The minute as a match clock shows it. */
export const minuteOf = (g: RealGoal) => g.shot.minute;

/** The league seasons in the data (2017/18), as the page and its filter name them. */
export const LEAGUES: { file: LeagueFile; comp: string; badge: string }[] = [
  { file: "league-england", comp: "Premier League 2017/18", badge: "PL" },
  { file: "league-spain", comp: "La Liga 2017/18", badge: "LIGA" },
  { file: "league-italy", comp: "Serie A 2017/18", badge: "SERIE A" },
  { file: "league-germany", comp: "Bundesliga 2017/18", badge: "BUNDES" },
  { file: "league-france", comp: "Ligue 1 2017/18", badge: "L1" },
];
export type LeagueFile = "league-england" | "league-spain" | "league-italy" | "league-germany" | "league-france";

/** A World Cup or Euro goal (the level map is made of these). */
export const isTournament = (g: RealGoal) => !g.id.startsWith("bg-") && (g.x.comp.startsWith("World Cup") || g.x.comp.startsWith("Euro"));

/** A banger's badge, from its competition's name ("Champions League 2017/18" → UCL). */
const BANGER_BADGES: [string, string][] = [
  ["Premier League", "PL"], ["La Liga", "LIGA"], ["Serie A", "SERIE A"], ["Bundesliga", "BUNDES"], ["Ligue 1", "L1"],
  ["Champions League", "UCL"], ["Copa del Rey", "COPA"], ["World Cup", "WC"], ["Euro", "EURO"],
];

export function compBadge(g: RealGoal): string {
  if (g.id.startsWith("bg-")) return BANGER_BADGES.find(([c]) => g.x.comp.startsWith(c))?.[1] ?? "INTL";
  const lg = LEAGUES.find((l) => l.comp === g.x.comp);
  if (lg) return lg.badge;
  return g.x.comp.startsWith("World Cup") ? "WC" : "EURO";
}

/** The round for a tournament goal ("Quarter-finals"); the date for a league goal ("12 Aug 2017"). */
export function stageOf(g: RealGoal): string {
  if (g.x.stage) return g.x.stage;
  const d = new Date(`${g.x.date}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? g.x.date : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

// ─────────────────────────────────────────────────────────────────────────
//  THE NATIONAL KITS — the sides in the data (home, change)
// ─────────────────────────────────────────────────────────────────────────

const k = (shirt: string, trim: string): Kit => ({ shirt, trim });
export const NATION_KITS: Record<string, { home: Kit; away: Kit }> = {
  Albania: { home: k("#d7141a", "#111111"), away: k("#111111", "#d7141a") },
  Argentina: { home: k("#75aadb", "#ffffff"), away: k("#3b2a6b", "#75aadb") },
  Australia: { home: k("#ffc72c", "#00843d"), away: k("#00843d", "#ffc72c") },
  Austria: { home: k("#e30613", "#ffffff"), away: k("#ffffff", "#e30613") },
  Belgium: { home: k("#c8102e", "#111111"), away: k("#f4f1ea", "#e86a10") },
  Brazil: { home: k("#ffdc02", "#009c3b"), away: k("#1d3f94", "#ffdc02") },
  Colombia: { home: k("#fcd116", "#003893"), away: k("#003893", "#fcd116") },
  "Costa Rica": { home: k("#c8102e", "#002b7f"), away: k("#ffffff", "#c8102e") },
  Croatia: { home: k("#e8323c", "#ffffff"), away: k("#0b1f4b", "#e8323c") },
  "Czech Republic": { home: k("#d7141a", "#11457e"), away: k("#ffffff", "#11457e") },
  Denmark: { home: k("#c8102e", "#ffffff"), away: k("#ffffff", "#c8102e") },
  Egypt: { home: k("#ce1126", "#ffffff"), away: k("#ffffff", "#ce1126") },
  England: { home: k("#ffffff", "#1b2a5c"), away: k("#c8102e", "#1b2a5c") },
  France: { home: k("#1f2a6b", "#ffffff"), away: k("#ffffff", "#1f2a6b") },
  Germany: { home: k("#ffffff", "#111111"), away: k("#2e8b57", "#111111") },
  Hungary: { home: k("#c8102e", "#436f4d"), away: k("#ffffff", "#c8102e") },
  Iceland: { home: k("#02529c", "#ffffff"), away: k("#ffffff", "#02529c") },
  Iran: { home: k("#ffffff", "#da0000"), away: k("#da0000", "#ffffff") },
  Italy: { home: k("#1a5fb4", "#ffffff"), away: k("#ffffff", "#1a5fb4") },
  Japan: { home: k("#0b2a7a", "#ffffff"), away: k("#ffffff", "#0b2a7a") },
  "Korea Republic": { home: k("#c8102e", "#111111"), away: k("#111111", "#c8102e") },
  Mexico: { home: k("#006847", "#ffffff"), away: k("#ffffff", "#006847") },
  Morocco: { home: k("#c1272d", "#006233"), away: k("#ffffff", "#c1272d") },
  Nigeria: { home: k("#008751", "#ffffff"), away: k("#ffffff", "#008751") },
  "Northern Ireland": { home: k("#00843d", "#ffffff"), away: k("#ffffff", "#00843d") },
  Panama: { home: k("#d21034", "#ffffff"), away: k("#ffffff", "#d21034") },
  Peru: { home: k("#ffffff", "#d91023"), away: k("#d91023", "#ffffff") },
  Poland: { home: k("#ffffff", "#dc143c"), away: k("#dc143c", "#ffffff") },
  Portugal: { home: k("#b5121b", "#006600"), away: k("#f2f2f2", "#b5121b") },
  "Republic of Ireland": { home: k("#169b62", "#ffffff"), away: k("#ffffff", "#169b62") },
  Romania: { home: k("#fcd116", "#002b7f"), away: k("#002b7f", "#fcd116") },
  Russia: { home: k("#c8102e", "#ffffff"), away: k("#ffffff", "#1c3578") },
  "Saudi Arabia": { home: k("#ffffff", "#006c35"), away: k("#006c35", "#ffffff") },
  Senegal: { home: k("#ffffff", "#00853f"), away: k("#00853f", "#fdef42") },
  Serbia: { home: k("#c6363c", "#0c4076"), away: k("#ffffff", "#c6363c") },
  Slovakia: { home: k("#0b4ea2", "#ffffff"), away: k("#ffffff", "#0b4ea2") },
  Spain: { home: k("#c60b1e", "#ffc400"), away: k("#ffffff", "#c60b1e") },
  Sweden: { home: k("#fecc00", "#006aa7"), away: k("#006aa7", "#fecc00") },
  Switzerland: { home: k("#d52b1e", "#ffffff"), away: k("#ffffff", "#d52b1e") },
  Tunisia: { home: k("#e70013", "#ffffff"), away: k("#ffffff", "#e70013") },
  Turkey: { home: k("#ffffff", "#e30a17"), away: k("#e30a17", "#ffffff") },
  Ukraine: { home: k("#ffd500", "#005bbb"), away: k("#005bbb", "#ffd500") },
  Uruguay: { home: k("#5cbfeb", "#111111"), away: k("#ffffff", "#5cbfeb") },
  Wales: { home: k("#c8102e", "#00b140"), away: k("#111111", "#c8102e") },
};
/**
 * Club kits for the 2017/18 league goals (Leo, 20 Oct 2026) that the game's own
 * club table (lib/star/kits.ts) does not have: the real 2017/18 home and change
 * colours, by the name the data uses. The rest come from kitsOf().
 */
export const CLUB_KITS_1718: Record<string, { home: Kit; away: Kit }> = {
  // La Liga
  Barcelona: { home: k("#a50044", "#004d98"), away: k("#f5e14c", "#a50044") },
  Valencia: { home: k("#ffffff", "#111111"), away: k("#111111", "#f18e00") },
  Sevilla: { home: k("#ffffff", "#d0103a"), away: k("#d0103a", "#ffffff") },
  Villarreal: { home: k("#ffe667", "#005187"), away: k("#005187", "#ffe667") },
  "Athletic Club": { home: k("#ee2523", "#ffffff"), away: k("#111111", "#ee2523") },
  "Real Betis": { home: k("#00954c", "#ffffff"), away: k("#ffffff", "#00954c") },
  Getafe: { home: k("#005999", "#ffffff"), away: k("#ffffff", "#005999") },
  Girona: { home: k("#cd2534", "#ffffff"), away: k("#111111", "#cd2534") },
  Espanyol: { home: k("#0074c8", "#ffffff"), away: k("#111111", "#0074c8") },
  "Celta de Vigo": { home: k("#8ac3ee", "#ffffff"), away: k("#c8102e", "#ffffff") },
  Eibar: { home: k("#a0002b", "#0b2c6b"), away: k("#ffffff", "#a0002b") },
  Levante: { home: k("#0b2c6b", "#b4053f"), away: k("#ffffff", "#b4053f") },
  Leganés: { home: k("#ffffff", "#1a3e8c"), away: k("#1a3e8c", "#ffffff") },
  "Deportivo Alavés": { home: k("#1e4ea0", "#ffffff"), away: k("#ffffff", "#1e4ea0") },
  "Deportivo La Coruña": { home: k("#1b54a6", "#ffffff"), away: k("#111111", "#1b54a6") },
  "Las Palmas": { home: k("#fde500", "#004fa3"), away: k("#004fa3", "#fde500") },
  Málaga: { home: k("#2a6fb5", "#ffffff"), away: k("#111111", "#2a6fb5") },
  // Serie A
  Milan: { home: k("#c8102e", "#111111"), away: k("#ffffff", "#c8102e") },
  Internazionale: { home: k("#0068a8", "#111111"), away: k("#ffffff", "#0068a8") },
  Fiorentina: { home: k("#5b2d8e", "#ffffff"), away: k("#ffffff", "#5b2d8e") },
  Torino: { home: k("#8a1e03", "#ffffff"), away: k("#ffffff", "#8a1e03") },
  Sampdoria: { home: k("#1b5497", "#ffffff"), away: k("#ffffff", "#1b5497") },
  Genoa: { home: k("#a2142c", "#002350"), away: k("#ffffff", "#a2142c") },
  Bologna: { home: k("#a21c26", "#1a2f48"), away: k("#ffffff", "#a21c26") },
  Udinese: { home: k("#111111", "#ffffff"), away: k("#ffffff", "#111111") },
  Cagliari: { home: k("#a11e2e", "#0a2a59"), away: k("#ffffff", "#a11e2e") },
  Sassuolo: { home: k("#00a752", "#111111"), away: k("#ffffff", "#00a752") },
  Chievo: { home: k("#f5e14c", "#1b3a8c"), away: k("#ffffff", "#1b3a8c") },
  "Hellas Verona": { home: k("#002f6c", "#f5e14c"), away: k("#ffffff", "#002f6c") },
  SPAL: { home: k("#ffffff", "#5ab4e5"), away: k("#5ab4e5", "#ffffff") },
  Crotone: { home: k("#c8102e", "#0b2c6b"), away: k("#ffffff", "#c8102e") },
  Benevento: { home: k("#d6001c", "#f5e14c"), away: k("#f5e14c", "#d6001c") },
  // Bundesliga
  "Bayern München": { home: k("#dc052d", "#ffffff"), away: k("#ffffff", "#dc052d") },
  "Bayer Leverkusen": { home: k("#e32221", "#111111"), away: k("#111111", "#e32221") },
  Hoffenheim: { home: k("#1961b5", "#ffffff"), away: k("#ffffff", "#1961b5") },
  "Werder Bremen": { home: k("#1d9053", "#ffffff"), away: k("#ffffff", "#1d9053") },
  "Hertha BSC": { home: k("#005ca9", "#ffffff"), away: k("#ffffff", "#005ca9") },
  Stuttgart: { home: k("#ffffff", "#e32219"), away: k("#e32219", "#ffffff") },
  "Schalke 04": { home: k("#004d9d", "#ffffff"), away: k("#ffffff", "#004d9d") },
  "Hamburger SV": { home: k("#ffffff", "#0a3f86"), away: k("#0a3f86", "#ffffff") },
  Augsburg: { home: k("#ffffff", "#ba3733"), away: k("#ba3733", "#46714d") },
  "Hannover 96": { home: k("#c8102e", "#111111"), away: k("#ffffff", "#c8102e") },
  "Mainz 05": { home: k("#c3141e", "#ffffff"), away: k("#ffffff", "#c3141e") },
  Wolfsburg: { home: k("#65b32e", "#ffffff"), away: k("#ffffff", "#65b32e") },
  "Borussia M'gladbach": { home: k("#ffffff", "#111111"), away: k("#111111", "#00a650") },
  Köln: { home: k("#ffffff", "#ed1c24"), away: k("#ed1c24", "#ffffff") },
  Freiburg: { home: k("#c8102e", "#111111"), away: k("#ffffff", "#c8102e") },
  // Ligue 1
  PSG: { home: k("#004170", "#da291c"), away: k("#ffffff", "#004170") },
  Monaco: { home: k("#e51f2b", "#ffffff"), away: k("#ffffff", "#e51f2b") },
  "Olympique Marseille": { home: k("#ffffff", "#2faee0"), away: k("#2faee0", "#ffffff") },
  Lille: { home: k("#e01e13", "#20325f"), away: k("#ffffff", "#e01e13") },
  Nice: { home: k("#c8102e", "#111111"), away: k("#ffffff", "#c8102e") },
  Bordeaux: { home: k("#1a2a50", "#ffffff"), away: k("#ffffff", "#1a2a50") },
  Rennes: { home: k("#e13327", "#111111"), away: k("#ffffff", "#e13327") },
  Nantes: { home: k("#fcd405", "#00843d"), away: k("#00843d", "#fcd405") },
  "Saint-Étienne": { home: k("#009639", "#ffffff"), away: k("#ffffff", "#009639") },
  Montpellier: { home: k("#0b2c6b", "#f37021"), away: k("#ffffff", "#f37021") },
  Toulouse: { home: k("#6a2c91", "#ffffff"), away: k("#ffffff", "#6a2c91") },
  Strasbourg: { home: k("#0090d0", "#ffffff"), away: k("#ffffff", "#0090d0") },
  Metz: { home: k("#7a1f3d", "#ffffff"), away: k("#ffffff", "#7a1f3d") },
  Guingamp: { home: k("#c8102e", "#111111"), away: k("#ffffff", "#c8102e") },
  Caen: { home: k("#1a3e8c", "#c8102e"), away: k("#ffffff", "#1a3e8c") },
  "Amiens SC": { home: k("#ffffff", "#111111"), away: k("#111111", "#ffffff") },
  Troyes: { home: k("#0055a4", "#ffffff"), away: k("#ffffff", "#0055a4") },
  Angers: { home: k("#ffffff", "#111111"), away: k("#111111", "#ffffff") },
  Dijon: { home: k("#c8102e", "#ffffff"), away: k("#ffffff", "#c8102e") },
};

/**
 * The Bangers' sides the tables above do not have (22 Oct 2026): their usual
 * home and change colours, by the name bangers.json uses. Names the data
 * spells another way point at the same kit (Bayern Munich = Bayern München).
 */
export const BANGER_KITS: Record<string, { home: Kit; away: Kit }> = {
  "Bayern Munich": CLUB_KITS_1718["Bayern München"],
  "VfL Wolfsburg": CLUB_KITS_1718.Wolfsburg,
  "FC Augsburg": CLUB_KITS_1718.Augsburg,
  "AS Saint-Étienne": CLUB_KITS_1718["Saint-Étienne"],
  "OGC Nice": CLUB_KITS_1718.Nice,
  "AC Milan": CLUB_KITS_1718.Milan,
  "Inter Milan": CLUB_KITS_1718.Internazionale,
  "SV Darmstadt 98": { home: k("#004e9e", "#ffffff"), away: k("#ffffff", "#004e9e") },
  "SC Bastia": { home: k("#0057a8", "#ffffff"), away: k("#ffffff", "#0057a8") },
  Frosinone: { home: k("#f5d000", "#0047ab"), away: k("#0047ab", "#f5d000") },
  Anderlecht: { home: k("#4b2a84", "#ffffff"), away: k("#ffffff", "#4b2a84") },
  Kazakhstan: { home: k("#00afca", "#fec50c"), away: k("#fec50c", "#00afca") },
  Netherlands: { home: k("#f36c21", "#111111"), away: k("#1b2a5c", "#f36c21") },
  Scotland: { home: k("#1b2a5c", "#ffffff"), away: k("#ffffff", "#1b2a5c") },
};

/** A side's kits: a nation, a 2017/18 club, a banger's side, a club the game knows, else grey. */
export function sideKits(team: string): { home: Kit; away: Kit } {
  const own = NATION_KITS[team] ?? CLUB_KITS_1718[team] ?? BANGER_KITS[team];
  if (own) return own;
  const c = kitsOf(team);
  return c === kitsOf("") ? FALLBACK : c;
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

/**
 * The two real sides' shirts: the scorers in their home kit, the others in theirs
 * unless it clashes (then their change kit). If both of theirs clash, the scorers
 * change instead (Levante's navy v Real Sociedad's blue and black); failing all
 * three, the pair furthest apart.
 */
export function kitsForGoal(g: RealGoal): { us: Kit; them: Kit; keeper: Kit } {
  const u = sideKits(g.shot.team);
  const t = sideKits(concededBy(g));
  const pairs: [Kit, Kit][] = [[u.home, t.home], [u.home, t.away], [u.away, t.home]];
  const [us, them] = pairs.find(([a, b]) => colourGap(a.shirt, b.shirt) >= KIT_CLASH)
    ?? pairs.reduce((best, p) => (colourGap(p[0].shirt, p[1].shirt) > colourGap(best[0].shirt, best[1].shirt) ? p : best));
  const keeper = KEEPER_SHIRTS.find((kk) => colourGap(kk.shirt, us.shirt) >= KIT_CLASH && colourGap(kk.shirt, them.shirt) >= KIT_CLASH) ?? KEEPER_SHIRTS[0];
  return { us, them, keeper };
}

// ─────────────────────────────────────────────────────────────────────────
//  WHERE THE REAL BALL WENT
// ─────────────────────────────────────────────────────────────────────────

/** How far inside the posts and bar the real goal's spot is kept (m): ball (0.11) + post (0.06) + room for a human wobble. */
export const END_ROOM = 0.4;

/**
 * Where the real goal crossed the goal line: x across, z up (metres). Wyscout
 * records the goal-mouth zone (low / middle / high × left / centre / right as
 * the shooter sees it); the spot is that zone's middle.
 */
export function realEnd(g: RealGoal): { x: number; z: number } {
  const x = g.shot.end ? g.shot.end[0] : CX;
  const z = g.shot.endZ ?? 1.0;
  return { x: Math.min(POST_R - END_ROOM, Math.max(POST_L + END_ROOM, x)), z: Math.max(0.11, Math.min(2.44 - END_ROOM, z)) };
}

export const realStart = (g: RealGoal): Vec2 => P(g.shot.ball);

/**
 * The real ball's flight, sampled (pitch metres, z up): a straight line over
 * the grass from where it was struck to where it crossed, rising to the real
 * height. The data has no path, only the two ends, so the arc is drawn the
 * shape the strike suggests (a header barely arcs; a long shot rises).
 */
export function ghostPath(g: RealGoal, n = 28): RealGoalGhost {
  const a = realStart(g), e = realEnd(g);
  const dist = Math.hypot(e.x - a.x, a.y);
  const head = g.shot.body === "Head";
  const z0 = head ? 1.9 : 0.11;
  const bulge = head ? 0.15 : Math.min(1.1, dist * 0.035);
  const pts: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    pts.push({ x: a.x + (e.x - a.x) * f, y: a.y * (1 - f), z: z0 + (e.z - z0) * f + bulge * 4 * f * (1 - f) });
  }
  return { pts, durS: Math.max(0.4, dist / (head ? 14 : 22)) };
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

/** How close to the real crossing a strike must be heading to be in the real lane (m). */
export const LANE_TOL_X = 0.6;
export const LANE_TOL_Z = 0.55;

/** The real goal as one of our chances (placed defenders), with its real lane switched on. */
export function scenarioForGoal(g: RealGoal, lane = true): Scenario {
  const sc = scenarioForShot(g.shot, { wideFrame: true });
  if (lane) { const e = realEnd(g); sc.realLane = { x: e.x, z: e.z, tolX: LANE_TOL_X, tolZ: LANE_TOL_Z }; }
  return sc;
}

// ─────────────────────────────────────────────────────────────────────────
//  THE REAL NAMES
// ─────────────────────────────────────────────────────────────────────────

const idFor = (name: string, pos: string) => ({ id: `rg:${name}`, name, shortName: shortNameOf(name), position: pos });

/**
 * Puts the real names on the chance's men (CanvasMatch calls it after casting
 * its own): the conceding keeper's real name (from the line-up). The placed
 * defenders and team-mates stand where the game put them, so they carry no
 * name — never one of the test club's players.
 */
export function dressFor(g: RealGoal): (sc: Scenario) => void {
  return (sc) => {
    const blank = { id: "rg:none", name: "", shortName: "", position: "" };
    sc.keeper.who = g.x.keeper ? idFor(knownAs(g, g.x.keeper), "Goalkeeper") : blank;
    for (const d of sc.defenders) d.who = blank;
    if (sc.runner) sc.runner.who = blank;
    for (const r of sc.secondaryRunners) r.who = blank;
    for (const t of sc.teammates) t.who = blank;
    sc.follower.who = blank;
  };
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

/** Goals named on the page first (famous ones in the data). */
export const FEATURED: { id: string; label: string }[] = [
  { id: "wy261066161", label: "Pavard v Argentina — the half-volley" },
  { id: "wy258702613", label: "Ronaldo v Spain — the free kick for his hat-trick" },
  { id: "wy259967017", label: "Kroos v Sweden — the 95th-minute free kick" },
  { id: "wy260342034", label: "Quaresma v Iran — the outside of the boot" },
  { id: "wy263885135", label: "Mbappé v Croatia — World Cup final" },
  { id: "wy261066318", label: "Mbappé v Argentina — the second" },
  { id: "wy259751694", label: "Modrić v Argentina — from 25 m" },
  { id: "wy89148495", label: "Shaqiri v Poland — the overhead kick" },
  { id: "wy88222586", label: "Bale v Slovakia — the free kick" },
  { id: "wy88180407", label: "Payet v Romania — the opening-night winner" },
  { id: "wy89857551", label: "Robson-Kanu v Belgium — the turn" },
  { id: "wy89856754", label: "Nainggolan v Wales — from distance" },
  { id: "wy258973361", label: "Coutinho v Switzerland — the curler" },
  { id: "wy259958556", label: "Son v Mexico — the late one" },
];
const FEATURED_IDS = new Set(FEATURED.map((f) => f.id));

/**
 * How hard the goal is to recreate. Mostly the chance itself (its chance of
 * a goal: a 3% shot is far harder than a 50% one), plus distance, a finish
 * into a top corner and a header.
 */
export function difficultyOf(g: RealGoal): number {
  const b = realStart(g);
  const xg = Math.max(0.005, g.shot.xg);
  const dist = Math.hypot(b.x - CX, b.y);
  const e = realEnd(g);
  const corner = e.z > 1.5 && Math.abs(e.x - CX) > 2.4 ? 0.5 : 0;
  const head = g.shot.body === "Head" ? 0.3 : 0;
  return -Math.log(xg) + 0.04 * Math.max(0, dist - 11) + corner + head;
}

export interface Level { n: number; stage: number; goal: RealGoal; difficulty: number }
export interface Stage { n: number; name: string; levels: Level[]; gate: number }

export const STAGE_NAMES = ["Group stage", "Round of 16", "Quarter-finals", "Semi-finals", "The final"];
export const LEVELS_PER_STAGE = 10;
/** Stars needed in all to open each stage. */
export const STAGE_GATES = [0, 6, 15, 26, 38];

/**
 * The level map: 5 stages of 10, easiest first. The goals are split into five
 * bands by difficulty; each stage takes its band's featured goals first, then
 * the rest of the band spread evenly. Deterministic.
 */
export interface LevelOpts {
  /** The stage names (one stage per name). Default: the World Cup rounds. */
  names?: string[];
  /** Levels in each stage. Default 10. */
  perStage?: number;
  /** Stars needed in all to open each stage. Default STAGE_GATES. */
  gates?: number[];
  /** Goals taken first in their band. Default FEATURED. */
  featured?: Set<string>;
}

export function buildLevels(goals: RealGoal[], opts: LevelOpts = {}): Stage[] {
  const names = opts.names ?? STAGE_NAMES;
  const per = opts.perStage ?? LEVELS_PER_STAGE;
  const gates = opts.gates ?? STAGE_GATES;
  const featured = opts.featured ?? FEATURED_IDS;
  const sorted = goals.map((g) => ({ g, d: difficultyOf(g) })).sort((a, b) => a.d - b.d || a.g.id.localeCompare(b.g.id));
  const stages: Stage[] = [];
  const band = sorted.length / names.length;
  let n = 0;
  for (let s = 0; s < names.length; s++) {
    const pool = sorted.slice(Math.round(s * band), Math.round((s + 1) * band));
    const feat = pool.filter((q) => featured.has(q.g.id));
    const rest = pool.filter((q) => !featured.has(q.g.id));
    const want = Math.max(0, per - feat.length);
    const step = rest.length / Math.max(1, want);
    const picked = [...feat.slice(0, per)];
    // A small pool (the Bangers) is taken whole; a big one is spread evenly.
    if (rest.length <= want) picked.push(...rest);
    else for (let i = 0; i < want; i++) picked.push(rest[Math.floor(i * step + step / 2)]);
    picked.sort((a, b) => a.d - b.d);
    stages.push({
      n: s, name: names[s], gate: gates[s] ?? 0,
      levels: picked.map((q) => ({ n: n++, stage: s, goal: q.g, difficulty: q.d })),
    });
  }
  return stages;
}

/** Per level id: the best stars and the best accuracy. */
export type Progress = Record<string, { stars: number; best: number }>;

export const totalStars = (p: Progress) => Object.values(p).reduce((a, v) => a + v.stars, 0);

/** Is level `lv` open? Stage gate (total stars) and the level before it passed (★1+). */
export function levelOpen(stages: Stage[], p: Progress, lv: Level, stars: (p: Progress) => number = totalStars): boolean {
  if (stars(p) < stages[lv.stage].gate) return false;
  if (lv.n === 0) return true;
  const all = stages.flatMap((s) => s.levels);
  const prev = all[lv.n - 1];
  if (prev.stage !== lv.stage) return true;   // the first level of an open stage
  return (p[prev.goal.id]?.stars ?? 0) > 0;
}

/** A result in: keeps the best stars and the best accuracy. */
export function recordResult(p: Progress, id: string, stars: number, pct: number): Progress {
  const was = p[id] ?? { stars: 0, best: 0 };
  return { ...p, [id]: { stars: Math.max(was.stars, stars), best: Math.max(was.best, Math.round(pct)) } };
}

// v2: the goals changed (World Cup 2018 / Euro 2016), so old stars are not carried over.
const KEY = "star-real-goals-progress-v2";
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
//  THE BUILD-UP: THE REAL MOVE AT THE REAL TIMES
// ─────────────────────────────────────────────────────────────────────────
//
// wyscout_goals.json has the whole move (every pass and carry with its real
// time before the shot), so the build-up plays the real actions at the real
// times: the ball goes where the real ball went, when it went there.

/** The longest build-up (seconds of the real move). */
export const MOVE_MAX_S = 14;

/** The window of the move the build-up plays (oldest first). */
export function moveWindow(g: RealGoal): RgMoveEv[] {
  const mv = g.x.move.filter((e) => e[2]);
  if (!mv.length) return [];
  let from = mv.findIndex((e) => e[0] <= MOVE_MAX_S);
  if (from < 0) from = mv.length - 1;
  return mv.slice(from);
}

/** The window's passes, as the lead-in's pass list ([seconds before, from, to, passer, recipient]). */
export function windowPasses(win: RgMoveEv[]): RealPass[] {
  return win.filter((e) => e[1] === "P" && e[3] && e[5]).map((e) => [e[0], e[2], e[3]!, e[4], e[5]!] as RealPass);
}

/** A lead-in (for leadinTrack) made of the window's real passes. */
export function realMoveLeadin(g: RealGoal): RealLead | null {
  const passes = windowPasses(moveWindow(g));
  if (!passes.length) return null;
  return { passes, path: g.shot.lead?.path ?? [] };
}

const HOLD_S = 0.45;
const flightS = (d: number) => Math.min(1.8, Math.max(0.3, d / 18));

/**
 * The ball at the real timing: every pass leaves at its real time and arrives
 * when the next action starts; every carry runs from its real start to its
 * real end. Ends on `end` (the chance's ball) at the shot's real time.
 */
export function realBallKeys(_g: RealGoal, win: RgMoveEv[], end: Vec2): LeadBallKey[] {
  if (!win.length) return [{ t: 0, p: { ...end } }, { t: 0.5, p: { ...end } }];
  const T = win[0][0] + HOLD_S;          // seconds of build-up
  const at = (back: number) => T - back;
  const keys: LeadBallKey[] = [];
  const push = (t: number, p: Vec2, pass?: { h: number }) => {
    const last = keys[keys.length - 1];
    if (last && t <= last.t + 1e-3) t = last.t + 0.05;
    keys.push(pass ? { t, p, pass } : { t, p });
  };
  push(0, P(win[0][2]));
  win.forEach((e, i) => {
    const from = P(e[2]);
    const t0 = Math.max(HOLD_S * (i === 0 ? 1 : 0), at(e[0]));
    const last = keys[keys.length - 1];
    if (Math.hypot(last.p.x - from.x, last.p.y - from.y) > 0.3 || t0 > last.t + 0.05) push(Math.max(t0, last.t + 0.05), from);
    const nextT = i + 1 < win.length ? at(win[i + 1][0]) : T;
    if (e[1] === "P" && e[3] && e[5]) {
      const to = P(e[3]);
      const d = Math.hypot(to.x - from.x, to.y - from.y);
      // It arrives as the next action starts (the receiver's touch), never quicker than a ball can travel.
      const start = keys[keys.length - 1].t;
      push(Math.max(nextT, start + Math.min(flightS(d), 0.6)), to, { h: e[6] === 2 ? Math.min(5, d * 0.1) : e[6] === 1 ? Math.min(1.5, d * 0.05) : 0 });
    } else if (e[3]) {
      push(Math.max(nextT - 0.05, keys[keys.length - 1].t + 0.1), P(e[3]));
    }
  });
  push(Math.max(T, keys[keys.length - 1].t + 0.05), { ...end });
  return keys;
}

/** Every real action in the window as (seconds before the shot, where the ball was). */
export function realTouches(win: RgMoveEv[]): { back: number; p: Vec2 }[] {
  return win.map((e) => ({ back: e[0], p: P(e[2]) }));
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
