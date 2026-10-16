/**
 * Plays the REAL unseen match (hiddenMatch.ts tick / resolveScenario, the same
 * two calls matchRadar.ts makes) with the inputs CanvasMatch passes, and
 * counts what each position is handed. Used by tests/star/funTargets.mts and
 * the Fun targets section of /star-radar-dev. Reads and writes nothing.
 *
 * The player's own highlights are settled with stand-in odds (the ones
 * tests/star/hiddenMatch.mts and matchFlow.mts use), because the aim-and-strike
 * game is not played here.
 */
import { newMatch, tick, resolveScenario, CHANCE_LINES, type HiddenMatchInputs, type ScenarioResult, type Zone } from "./hiddenMatch";
import { mulberry32 } from "./season";
import { GUARDRAILS, FUN_POSITIONS, FUN_TARGETS, METRICS, RADAR_POSITIONS, inBand, type Band, type FunPosition, type MetricKey } from "./funTargets";

export interface Measured {
  chances: number; finalThird: number; ownWing: number; buildUp: number; dribbles: number; oneOnOnes: number;
  longestWait: number; fallback: number; lastQuarter: number;
  /** Share of matches with no chance by minute 20. */
  nothingBy20: number;
  /** Shots by both sides a match. */
  shots: number;
}

function standIn(zone: Zone, rng: () => number): ScenarioResult {
  const r = rng();
  if (zone === "box") return r < 0.24 ? "goal" : r < 0.85 ? "saved" : "lost";
  if (zone === "attacking") return r < 0.11 ? "goal" : r < 0.6 ? "saved" : r < 0.85 ? "delivered" : "lost";
  return r < 0.72 ? "delivered" : "lost";
}

export interface RunOptions { position: string; team: number; opp: number; matches: number; skill?: number; seed?: number }

/** The real match's inputs, as CanvasMatch.hiddenInputs builds them. */
export function realInputs(o: { position: string; team: number; opp: number; skill: number; home: boolean }): HiddenMatchInputs {
  return {
    teamStrength: o.team, oppStrength: o.opp, playerSkill: o.skill, pace: 60, freeKick: 50, position: o.position, home: o.home,
    energyMode: "medium", matchFlow: true, livePenalties: true,
    context: { playstyle: "balanced", teamRelationship: 60, fanRelationship: 50, skills: { pace: 60, power: 60, technique: 60, vision: 60 } },
  };
}

export const FALLBACK_REASON = "You drop in and demand the ball";

export function measureRadar(o: RunOptions): Measured {
  const N = o.matches;
  const wide = o.position === "LW" || o.position === "RW";
  const ownLane = o.position === "RW" ? "right" : "left";
  let reqs = 0, third = 0, deep = 0, wing = 0, drib = 0, late = 0, fb = 0, o1 = 0, shots = 0, starved = 0, longGap = 0;
  for (let s = 0; s < N; s++) {
    const rng = mulberry32((o.seed ?? 90210) + s * 7919);
    const st = newMatch(rng);
    const inputs = realInputs({ position: o.position, team: o.team, opp: o.opp, skill: o.skill ?? 60, home: s % 2 === 0 });
    let last = 0, first = -1, maxGap = 0;
    while (st.minute < 90) {
      const { events, request } = tick(st, inputs, rng);
      for (const ev of events) if (ev.isGoal || CHANCE_LINES.has(ev.text) || ev.shot) shots++;
      if (!request) continue;
      reqs++;
      if (first < 0) first = st.minute;
      maxGap = Math.max(maxGap, st.minute - last); last = st.minute;
      if (request.zone === "box" || request.zone === "attacking") third++; else deep++;
      if (wide && request.lane === ownLane) wing++;
      if (request.dribble) drib++;
      if (st.minute > 75) late++;
      if (request.reason === FALLBACK_REASON) fb++;
      // One-on-ones: the one-on-one share of the kinds the match offers.
      if (!request.dribble && !request.penaltyWon && request.kinds.length) {
        o1 += request.kinds.filter((k) => k === "one_on_one").length / request.kinds.length;
      }
      const res = standIn(request.zone, rng);
      if (res === "goal" || res === "saved") shots++;
      resolveScenario(st, res);
    }
    maxGap = Math.max(maxGap, 90 - last);
    longGap += maxGap;
    if (first < 0 || first > 20) starved++;
  }
  const share = (v: number) => v / Math.max(1, reqs);
  return {
    chances: reqs / N, finalThird: share(third), ownWing: share(wing), buildUp: share(deep), dribbles: share(drib), oneOnOnes: o1 / N,
    longestWait: longGap / N, fallback: share(fb), lastQuarter: share(late), nothingBy20: starved / N,
    shots: shots / N,
  };
}

/** Average two Measured rows (a winger is LW and RW). */
export function meanMeasured(rows: Measured[]): Measured {
  const keys = Object.keys(rows[0]) as (keyof Measured)[];
  const out = {} as Measured;
  for (const k of keys) out[k] = rows.reduce((a, r) => a + r[k], 0) / rows.length;
  return out;
}

export const GAPS = [
  { id: "even", label: "even", team: 75, opp: 75 },
  { id: "plus20", label: "+20", team: 85, opp: 65 },
  { id: "minus20", label: "−20", team: 65, opp: 85 },
] as const;

export interface PositionReport {
  pos: FunPosition;
  gaps: Record<(typeof GAPS)[number]["id"], Measured>;
}

/** Every position × every gap, `matches` each. A winger is LW and RW averaged. */
export function reportAll(matches: number): PositionReport[] {
  return FUN_POSITIONS.map((pos) => {
    const run = (g: { team: number; opp: number }, skill: number) =>
      meanMeasured(RADAR_POSITIONS[pos].map((position) => measureRadar({ position, team: g.team, opp: g.opp, matches, skill })));
    const gaps = {} as PositionReport["gaps"];
    for (const g of GAPS) gaps[g.id] = run(g, 60);
    return { pos, gaps };
  });
}

/** The guardrails (data). Anything returned here fails the test. */
export function guardrailProblems(reports: PositionReport[]): string[] {
  const out: string[] = [];
  for (const r of reports) {
    for (const g of GAPS) {
      const band = g.id === "even" ? GUARDRAILS.shotsEven : GUARDRAILS.shotsMismatch;
      const m = r.gaps[g.id];
      if (m.shots < band.low || m.shots > band.high) out.push(`${r.pos} ${g.label}: ${m.shots.toFixed(1)} shots a match, outside ${band.low}–${band.high}`);
    }
    // The table itself may never ask for more than the Premier League ceiling.
    for (const k of ["goals60", "goals85"] as const) {
      const b = FUN_TARGETS.premier[r.pos][k];
      if (b && b.high > GUARDRAILS.premSeasonGoalsMax.high) out.push(`${r.pos} ${k}: table asks up to ${b.high}, above ${GUARDRAILS.premSeasonGoalsMax.high}`);
    }
  }
  return out;
}

/** One row of the report: ours against the bottom and top level. */
export interface Row { key: MetricKey; label: string; unit: "n" | "pct" | "min"; ours: number; national: Band; premier: Band; okNational: boolean; okPremier: boolean }

export function rowsFor(pos: FunPosition, m: Measured): Row[] {
  const nat = FUN_TARGETS.national[pos], pre = FUN_TARGETS.premier[pos];
  const ours: Partial<Record<MetricKey, number>> = {
    chances: m.chances, finalThird: m.finalThird, ownWing: m.ownWing, buildUp: m.buildUp, dribbles: m.dribbles, oneOnOnes: m.oneOnOnes,
    longestWait: m.longestWait, fallback: m.fallback, lastQuarter: m.lastQuarter,
  };
  // The goals rows are not judged here: the radar cannot play your shots, so
  // goals a season would only echo the stand-in odds. See impliedConversion.
  return METRICS.filter((x) => ours[x.key] !== undefined && nat[x.key] && pre[x.key]).map((x) => ({
    key: x.key, label: x.label, unit: x.unit, ours: ours[x.key]!, national: nat[x.key]!, premier: pre[x.key]!,
    okNational: inBand(ours[x.key]!, nat[x.key]!), okPremier: inBand(ours[x.key]!, pre[x.key]!),
  }));
}

/**
 * What the season-goals targets ask of your shooting. The radar hands you
 * `chances` a match; a season of 38 matches turns `goals` into the share of
 * those chances that must go in. Step 2 compares this with what the aim game
 * really converts.
 */
export function impliedConversion(pos: FunPosition, chances: number) {
  const season = chances * GUARDRAILS.seasonMatches;
  const out: { level: "national" | "premier"; rating: number; goals: number; needs: number }[] = [];
  for (const level of ["national", "premier"] as const) {
    for (const k of ["goals60", "goals85"] as const) {
      const b = FUN_TARGETS[level][pos][k]!;
      out.push({ level, rating: k === "goals60" ? 60 : 85, goals: b.target, needs: b.target / season });
    }
  }
  return out;
}
