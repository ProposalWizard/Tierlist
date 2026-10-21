/**
 * THE RULER — today's numbers, the line the Full Highlights Rebuild is held to
 * (plan page, phase 0). Pure: no canvas, no React.
 *
 * It plays N whole matches through the real unseen match (hiddenMatch.ts:
 * newMatch → advanceUntilInvolved → resolveScenario), and every chance the
 * match hands you is made by the real chance maker (chanceMaker.ts's
 * makeChance, the function CanvasMatch calls). Given a `react` counter
 * (scripts/fhr/react.ts, terminal and tests only), each chance is then struck
 * once through the real engine's substep loop to count who reacts; the test
 * page shows that count from the last terminal run (reactSnapshot.json).
 *
 * What it stands in for, and says so:
 *   · Your finishing: a stand-in rate per zone (the same one
 *     tests/star/hiddenMatch.mts uses), so momentum and the score move as in
 *     play. Goals a match therefore depend on the stand-in, not on your feet.
 *   · Your strike, for the reaction count: one fixed strike — a firm, low shot
 *     at the middle of the goal on a chance with the goal in view, a firm pass
 *     to the runner otherwise.
 *   · Not modelled: the top-down dribble deal, a team-mate's penalty, the
 *     lead-in, the keeper brain's set-up, real squads. A dribble request is
 *     counted as a chance of kind "dribble" and not built.
 *
 * "Players reacting" = men other than you and the keeper (defenders, the
 * runners, the poacher) who move at least REACT_MOVE_M between the strike and
 * the end of the chance; "early" = by REACT_EARLY_S after the strike. NOT the
 * same definition as the plan's quoted 1.17 / 2.04 (an earlier measurement
 * whose script was not kept), so compare this ruler with itself. "Start distance" = the ball's distance from the
 * middle of the goal line when the chance is served.
 *
 * The match engine, the hidden match's tuned numbers and the drawings are
 * READ here, never changed.
 */
import {
  newMatch, advanceUntilInvolved, resolveScenario,
  type HiddenMatchInputs, type ScenarioResult, type Zone,
} from "../hiddenMatch";
import { type Scenario } from "../canvasEngine";
import { withCornerReach } from "../cornerReach";
import { CX } from "../pitch";
import { makeChance, PictureMemory } from "../chanceMaker";
import { newSelectionMemory } from "../scenarioSelect";
import { forceChancesMode, type ChancesMode } from "../newChances";
import type { LeadIn, LeadMoment } from "../leadIn";
import { matchStill, matchCanvasHW } from "./stillCamera";

/** Deterministic RNG, the one the hidden-match tests use. */
export function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const FULL_TIME = 90;
/** A man has reacted once he has moved this far (metres). */
export const REACT_MOVE_M = 0.5;
/** How long a struck ball is followed before the count is taken (seconds). */
export const REACT_MAX_S = 4;

/** An even game, a striker: the case the plan quotes its bands for. */
export const RULER_INPUTS: HiddenMatchInputs = { teamStrength: 70, oppStrength: 70, playerSkill: 65, position: "ST" };

/** The stand-in for you taking the chance (tests/star/hiddenMatch.mts's). */
export function standInResult(zone: Zone, rng: () => number): ScenarioResult {
  const roll = rng();
  if (zone === "box") return roll < 0.24 ? "goal" : roll < 0.85 ? "saved" : "lost";
  if (zone === "attacking") return roll < 0.11 ? "goal" : roll < 0.6 ? "saved" : roll < 0.85 ? "delivered" : "lost";
  return roll < 0.72 ? "delivered" : "lost";
}

/** Who reacted to one strike. */
export interface Reaction {
  /** Moved REACT_MOVE_M or more before the chance ended. */
  all: number;
  /** …of whom your team-mates (runners, the poacher). */
  mates: number;
  /** Moved REACT_MOVE_M or more within the first REACT_EARLY_S of the strike. */
  early: number;
}
/** "Early" reactions: by this long after the strike (seconds). */
export const REACT_EARLY_S = 1;

/** Counts who reacts to one strike of a served chance (scripts/fhr/react.ts:
 *  it runs the engine's physics, so it lives outside the shipped code — the
 *  one-engine guard allows physics only in the real match). */
export type ReactFn = (sc: Scenario, seed: number) => Reaction;

export interface KindRow { kind: string; n: number; startM: number; reacting: number; reactingEarly: number }

export interface Ruler {
  chances: "old" | "new";
  matches: number;
  /** Chances the match handed you, a match. */
  chancesPerMatch: number;
  /** Goals a match, both sides (your share from the stand-in). */
  goalsPerMatch: number;
  yourGoalsPerMatch: number;
  oppGoalsPerMatch: number;
  /** Your chances by kind, with each kind's start distance and reactions. */
  byKind: KindRow[];
  /** Men reacting, per chance struck (dribbles not counted). */
  reactingPerChance: number;
  /** …of whom your team-mates. */
  matesReactingPerChance: number;
  /** Men moving within REACT_EARLY_S of the strike. */
  reactingEarlyPerChance: number;
  /** Ball to the middle of the goal line when served, metres (median). */
  startMedianM: number;
  startMeanM: number;
  /** One-on-ones only (the plan quotes 11.9 m drawn vs 16.3 m real). */
  oneOnOneStartM: number | null;
  oneOnOneReacting: number | null;
  /** Phase 2: build-ups made (when a builder was given), their length, how many distinct. */
  buildUps?: { made: number; of: number; lenS: { min: number; p10: number; p50: number; p90: number; max: number }; distinct: number };
  ms: number;
}

/** A build-up builder for the ruler (phase 2: lib/star/fhr/buildUp.ts's fhrBuildUpFor); `signature` names its route. */
export type BuildUpFn = (sc: Scenario, moment: LeadMoment) => (LeadIn & { signature?: string }) | null;

const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

/**
 * Measure `matches` whole matches. `chances` picks Settings → Chances for the
 * run ("old" = today's game; "new" = what Full highlights rebuild: On turns
 * on), restored afterwards.
 */
export function measureRuler(o: { matches: number; seed?: number; chances?: ChancesMode; inputs?: HiddenMatchInputs; react?: ReactFn; buildUp?: BuildUpFn }): Ruler {
  const t0 = Date.now();
  const mode: ChancesMode = o.chances ?? "old";
  // Mikey's corner rule, as the real match passes it (lib/star/cornerReach.ts).
  const inputs = withCornerReach(o.inputs ?? RULER_INPUTS);
  const prev = (globalThis as Record<string, unknown>).__starChancesForced as ChancesMode | null | undefined;
  forceChancesMode(mode);
  try {
    const memory = new PictureMemory("fhr-ruler", false);
    let chances = 0, you = 0, opp = 0;
    const kinds = new Map<string, { n: number; start: number[]; react: number[]; early: number[] }>();
    const starts: number[] = [];
    const reacts: number[] = [], mates: number[] = [], earlies: number[] = [];
    const buLens: number[] = [], buSigs = new Set<string>();
    let buOf = 0;
    for (let i = 0; i < o.matches; i++) {
      const seed = (o.seed ?? 1) + i * 7919;
      const rng = mulberry32(seed);
      const engineRng = mulberry32(seed ^ 0x5eed);
      const state = newMatch(rng);
      const selection = newSelectionMemory();
      for (;;) {
        const step = advanceUntilInvolved(state, inputs, rng, FULL_TIME);
        if (!step.request) break;
        const req = step.request;
        chances++;
        if (req.dribble) {
          const row = kinds.get("dribble") ?? { n: 0, start: [], react: [], early: [] };
          row.n++; kinds.set("dribble", row);
        } else {
          const made = makeChance({ source: { from: "request", request: req, position: inputs.position ?? "ST" }, rng: engineRng, memory, selection });
          const sc = made.sc;
          const d = Math.hypot(sc.ball.x - CX, sc.ball.y);
          const row = kinds.get(sc.kind) ?? { n: 0, start: [], react: [], early: [] };
          row.n++; row.start.push(d); kinds.set(sc.kind, row);
          starts.push(d);
          // A build-up before it (phase 2), with the moment the match hands one.
          // Built from a copy and its own seed: it never moves what is served.
          if (o.buildUp) {
            buOf++;
            const setPiece = sc.kind === "penalty" || sc.kind === "free_kick" || sc.kind === "corner";
            const cam = matchStill(sc, matchCanvasHW(390, 700)).frame.camera;
            const b = o.buildUp(JSON.parse(JSON.stringify(sc)), {
              opening: false, fresh: !setPiece, lane: req.lane, pattern: req.pattern, seed,
              usStrength: inputs.teamStrength, themStrength: inputs.oppStrength,
              frame: { x1: cam.x1, x2: cam.x2, y1: cam.y1, y2: cam.y2 },
            });
            if (b) { buLens.push(b.durS); buSigs.add(b.signature ?? String(buLens.length)); }
          }
          // Its own seed, so counting reactions never moves the chances served.
          const r = o.react?.(sc, (seed * 31 + chances) >>> 0);
          if (r) { row.react.push(r.all); row.early.push(r.early); reacts.push(r.all); mates.push(r.mates); earlies.push(r.early); }
        }
        resolveScenario(state, standInResult(req.zone, rng));
      }
      you += state.userScore;
      opp += state.oppScore;
    }
    const n = o.matches;
    const byKind: KindRow[] = Array.from(kinds.entries())
      .map(([kind, r]) => ({ kind, n: r.n / n, startM: median(r.start), reacting: mean(r.react), reactingEarly: mean(r.early) }))
      .sort((a, b) => b.n - a.n);
    const oo = kinds.get("one_on_one");
    return {
      chances: mode, matches: n,
      chancesPerMatch: chances / n,
      goalsPerMatch: (you + opp) / n, yourGoalsPerMatch: you / n, oppGoalsPerMatch: opp / n,
      byKind,
      reactingPerChance: mean(reacts),
      matesReactingPerChance: mean(mates),
      reactingEarlyPerChance: mean(earlies),
      startMedianM: median(starts), startMeanM: mean(starts),
      oneOnOneStartM: oo?.start.length ? median(oo.start) : null,
      oneOnOneReacting: oo?.react.length ? mean(oo.react) : null,
      buildUps: o.buildUp ? (() => {
        const q = (p: number) => { const s = [...buLens].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
        return { made: buLens.length, of: buOf, lenS: { min: q(0), p10: q(0.1), p50: q(0.5), p90: q(0.9), max: q(1) }, distinct: buSigs.size };
      })() : undefined,
      ms: Date.now() - t0,
    };
  } finally {
    forceChancesMode(prev ?? null);
  }
}

/** The reference numbers quoted on the plan page (earlier measurements). */
export const PLAN_REFERENCE = {
  oneOnOneStartDrawnM: 11.9,
  oneOnOneStartRealM: 16.3,
  reactingDrawn: 1.17,
  reactingReal: 2.04,
  possessionChanges: 28,
  goalsEvenGame: 2,
} as const;
