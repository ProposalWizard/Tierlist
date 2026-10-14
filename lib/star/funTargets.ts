/**
 * FUN TARGETS v0 — DRAFT. Harry's table of what a match should hand each
 * position, level by level, written down as data so a test can measure it.
 *
 * Nothing in the game reads this. It is a ruler: tests/star/funTargets.mts
 * plays the real unseen match (hiddenMatch.ts, through matchRadar.ts) and
 * prints ours against these numbers. Harry owns the numbers; change them here.
 *
 * Every value carries one of three marks:
 *   target    - Harry's own number (14 Oct 2026 table).
 *   guardrail - a fence from real football or from a test that already exists.
 *               A broken guardrail FAILS the test. A missed target only reports.
 *   designed  - filled in by the builder so the table has no holes (the
 *               levels in between, and the positions Harry gave no number
 *               for: AM, CM). Harry: please change any of these.
 *
 * How to read a cell: { low, target, high }. A match is "in range" when the
 * measured value sits between low and high. "At most 10%" is written
 * low 0 / target 0.10 / high 0.10. "At least 20%" is high 1.
 *
 * Levels run bottom to top, the same ladder the dribble deal uses
 * (dribbleDeal.ts). Between the two ends Harry gave (National League and
 * Premier League) the numbers step in a straight line: designed.
 * "europe" is set equal to the Premier League.
 *
 * THE RADAR HAS NO LEAGUE INPUT YET (step 2). Until it has, one radar number
 * is compared against the bottom and the top level side by side.
 */
import type { DribbleLevel } from "./dribbleDeal";

export type FunLevel = DribbleLevel;
/** ST striker, W winger (LW or RW), AM attacking mid (CAM), CM central mid. */
export type FunPosition = "ST" | "W" | "AM" | "CM";

export const FUN_LEVELS: FunLevel[] = ["national", "league_two", "league_one", "championship", "premier", "europe"];
export const FUN_POSITIONS: FunPosition[] = ["ST", "W", "AM", "CM"];

/** The positions the radar is run with for each table position. */
export const RADAR_POSITIONS: Record<FunPosition, string[]> = { ST: ["ST"], W: ["LW", "RW"], AM: ["CAM"], CM: ["CM"] };

export type Mark = "target" | "guardrail" | "designed";
export interface Band { low: number; target: number; high: number; mark: Mark }

export type MetricKey =
  | "chances"       // your chances per match (count)
  | "finalThird"    // share of your chances that start in the final third or box
  | "ownWing"       // winger only: share of chances from his own wing's lane
  | "buildUp"       // share that start in midfield or your own half
  | "dribbles"      // share of chances that are a run at the defence
  | "oneOnOnes"     // one-on-ones per match (count, from the kinds the match offers)
  | "longestWait"   // longest gap between your chances, minutes (mean over matches)
  | "fallback"      // share that came from the "drop in and demand the ball" rescue
  | "lastQuarter"   // share of chances in the last 15 minutes
  | "goals60"       // league goals a season, a rating-60 player
  | "goals85";      // league goals a season, a rating-85 player

export interface MetricInfo { key: MetricKey; label: string; unit: "n" | "pct" | "min"; plain: string }
export const METRICS: MetricInfo[] = [
  { key: "chances", label: "Your chances a match", unit: "n", plain: "How many highlights you get to play in 90 minutes." },
  { key: "finalThird", label: "In the final third", unit: "pct", plain: "Chances that start up the pitch, not in midfield." },
  { key: "ownWing", label: "From his own wing", unit: "pct", plain: "Winger only: chances that come down his side." },
  { key: "buildUp", label: "Build-up share", unit: "pct", plain: "Chances that start in midfield or your own half." },
  { key: "dribbles", label: "Dribbles", unit: "pct", plain: "Chances that are a run at the defence." },
  { key: "oneOnOnes", label: "One-on-ones a match", unit: "n", plain: "Clean one-on-one chances in a match." },
  { key: "longestWait", label: "Longest wait", unit: "min", plain: "Longest stretch with no chance for you." },
  { key: "fallback", label: "Fallback share", unit: "pct", plain: "Chances that only exist because you waited too long." },
  { key: "lastQuarter", label: "Last 15 minutes", unit: "pct", plain: "Share of chances after minute 75." },
  { key: "goals60", label: "Season goals, rating 60", unit: "n", plain: "Goals in a 38-match season for a weak player (indicative)." },
  { key: "goals85", label: "Season goals, rating 85", unit: "n", plain: "Goals in a 38-match season for a star (indicative)." },
];

export type Cell = Partial<Record<MetricKey, Band>>;

const band = (target: number, mark: Mark, spread: number): Band => ({ low: +(target * (1 - spread)).toFixed(3), target, high: +(target * (1 + spread)).toFixed(3), mark });
const atMost = (cap: number, mark: Mark): Band => ({ low: 0, target: cap, high: cap, mark });
const atLeast = (floor: number, mark: Mark): Band => ({ low: floor, target: floor, high: 1, mark });
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Where a level sits on the ladder: 0 = National League, 1 = Premier League and up. */
const stepOf = (l: FunLevel) => Math.min(1, FUN_LEVELS.indexOf(l) / 4);

/**
 * The two ends per position: [National League, Premier League]. `given` says
 * which end is Harry's own: "both", "top" (only the Premier League number),
 * or nothing (all designed).
 */
type Given = "both" | "top" | undefined;
interface End { v: [number, number]; given: Given }
const e = (a: number, b: number, given: Given): End => ({ v: [a, b], given });
interface Ends { finalThird: End; buildUp: End; dribbles: End; oneOnOnes: End; goals60: End; goals85: End; ownWing?: number }
const ENDS: Record<FunPosition, Ends> = {
  ST: { finalThird: e(0.85, 0.80, "both"), buildUp: e(0.10, 0.15, "both"), dribbles: e(0.04, 0.08, "both"), oneOnOnes: e(0.5, 0.35, "both"),
    goals60: e(15, 10, "both"), goals85: e(25, 25, "both") },
  W: { finalThird: e(0.70, 0.70, "both"), buildUp: e(0.25, 0.25, "both"), dribbles: e(0.10, 0.15, "top"), oneOnOnes: e(0.3, 0.3, "both"),
    goals60: e(9, 6, "top"), goals85: e(18, 14, "top"), ownWing: 0.55 },
  AM: { finalThird: e(0.75, 0.75, undefined), buildUp: e(0.20, 0.20, undefined), dribbles: e(0.07, 0.10, undefined), oneOnOnes: e(0.3, 0.3, undefined),
    goals60: e(8, 5, undefined), goals85: e(16, 13, undefined) },
  CM: { finalThird: e(0.60, 0.60, undefined), buildUp: e(0.35, 0.35, undefined), dribbles: e(0.05, 0.08, undefined), oneOnOnes: e(0.15, 0.15, undefined),
    goals60: e(5, 3, undefined), goals85: e(10, 8, undefined) },
};

/** Harry's own only at an end he gave; every step in between is designed. */
function markOf(end: End, step: number): Mark {
  if (end.given === "both" && (step === 0 || step === 1)) return "target";
  if (end.given === "top" && step === 1) return "target";
  return "designed";
}
const at = (end: End, step: number, digits = 3) => +lerp(end.v[0], end.v[1], step).toFixed(digits);

function cellFor(level: FunLevel, pos: FunPosition): Cell {
  const x = ENDS[pos], t = stepOf(level);
  const cell: Cell = {
    chances: { low: 5, target: 7, high: 9, mark: "target" },
    // At least the target minus a little; more is never a problem, so high is 1.
    finalThird: { ...band(at(x.finalThird, t), markOf(x.finalThird, t), 0.09), high: 1 },
    buildUp: atMost(at(x.buildUp, t), markOf(x.buildUp, t)),
    dribbles: band(at(x.dribbles, t), markOf(x.dribbles, t), 0.3),
    oneOnOnes: band(at(x.oneOnOnes, t), markOf(x.oneOnOnes, t), 0.35),
    longestWait: atMost(25, "target"),
    fallback: atMost(0.10, "target"),
    lastQuarter: atLeast(0.20, "target"),
    goals60: band(at(x.goals60, t, 1), markOf(x.goals60, t), 0.25),
    goals85: band(at(x.goals85, t, 1), markOf(x.goals85, t), 0.25),
  };
  if (x.ownWing !== undefined) cell.ownWing = atLeast(x.ownWing, "target");
  return cell;
}

export const FUN_TARGETS: Record<FunLevel, Record<FunPosition, Cell>> = Object.fromEntries(
  FUN_LEVELS.map((l) => [l, Object.fromEntries(FUN_POSITIONS.map((p) => [p, cellFor(l, p)]))]),
) as Record<FunLevel, Record<FunPosition, Cell>>;

/**
 * Fences that fail the test when broken (mark: guardrail).
 *  - shots: the whole match (both sides) keeps real-football numbers. Even game
 *    21-28 shots (tests/star/matchFlow.mts); in a mismatch 20-32.
 *  - premSeasonGoalsMax: nobody scores more than 36 in a Premier League season
 *    (Haaland, 2022/23).
 */
export const GUARDRAILS = {
  shotsEven: { low: 21, high: 28, mark: "guardrail" as Mark },
  shotsMismatch: { low: 20, high: 32, mark: "guardrail" as Mark },
  premSeasonGoalsMax: { high: 36, mark: "guardrail" as Mark },
  /** Matches in a league season, for turning goals a match into goals a season. */
  seasonMatches: 38,
};

/** In range? */
export const inBand = (v: number, b: Band) => v >= b.low - 1e-9 && v <= b.high + 1e-9;

export function formatValue(v: number, unit: MetricInfo["unit"]): string {
  return unit === "pct" ? `${(v * 100).toFixed(0)}%` : unit === "min" ? `${v.toFixed(0)}'` : v.toFixed(1);
}
export function formatBand(b: Band, unit: MetricInfo["unit"]): string {
  const f = (v: number) => formatValue(v, unit);
  if (b.low === 0 && b.high === b.target) return `≤ ${f(b.target)}`;
  if (b.high === 1 && b.low === b.target && unit === "pct") return `≥ ${f(b.target)}`;
  return `${f(b.target)} (${f(b.low)}–${f(b.high)})`;
}
