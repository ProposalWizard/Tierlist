/**
 * "SIM THIS MATCH" (item 36, v0.15, Harry: "a sim match button just in
 * general").
 *
 * The unseen match (hiddenMatch.ts) plays out exactly as it does when you
 * play — same inputs as CanvasMatch's hiddenInputs, including your club's
 * real strength (item 0), your position, the sub's ladder minute and late-sub
 * chances (item 24), the sub staying on (item 25). The one difference: each
 * chance that comes to you is settled by a roll against your skills instead
 * of by your thumb. Your goals, assists, rating, wage and the result are
 * credited exactly as a played match's are (finaliseMatch → creditMatchResult).
 *
 * THE ODDS (simOdds). Measured, not guessed: each kind of chance was played
 * 1,000 times through the real engine (the real Chelsea
 * team-mates and the real Palace keeper cast onto it, a steady player
 * shooting for the far corner or passing to the runner) at skills 60, 80 and
 * 99, and the odds below are fitted to those rates. A one-on-one goes in
 * about 57%, a tight angle 30%, a long shot 15-20%, a penalty 67%; a cutback
 * finds its man 99% of the time and he scores 36%, a through ball 83-86% and
 * 31%, a byline cross 83-90% and 49%, a corner 65-74% and 36%. Free kicks use
 * Harry's targets (an ordinary taker 5%, a specialist about 13%) because the
 * engine's own free-kick test is failing on the branch head (17% / 32%).
 * A weaker keeper lets in a little more (+0.3% a rating point, measured
 * against a 65 keeper). The first-person run is a reflex game the real match
 * plays at fixed settings, so it is a flat 25% (a player who reads every wave
 * right clears 36.7%, one who reads it wrong 10.3%).
 * A completed pass keeps the move going exactly as the real match does
 * (chainReturnChance, chainKindFor, at most CHAIN_MAX links).
 * Pure: no React, no canvas, and never touches canvasEngine's physics.
 */

import type { CareerState, Fixture, MatchStats, GoalEvent, OppGoalEvent, SquadPlayer } from "./types";
import {
  newMatch, advanceTo, advanceUntilInvolved, resolveScenario, lateSubQuota, noteServedKind,
  type HiddenMatchInputs, type HiddenMatchEvent, type ScenarioResult,
} from "./hiddenMatch";
import { pickScenarioKindFrom, buildScenario, chainKindFor, chainReturnChance, CHAIN_MAX, goalInView, type ScenarioKind } from "./canvasEngine";
import { giveAndGoChance } from "./giveAndGo";
import { CX, PEN_SPOT_Y } from "./pitch";
import { pickWaveSizes } from "./firstPersonDribble";
import { selectChance, newSelectionMemory } from "./scenarioSelect";
import { withoutSwitchedOff, playableKind } from "./switchedOffKinds";
import { mulberry32 } from "./season";
import { finaliseMatch, fairRating } from "./matchStats";
import { hookCheck, subComesOnNow, SUB_OFF_ENERGY, type SelectionVerdict, type HookReason } from "./selection";
import { matchTeamStrength } from "./matchday";
import { rollAddedTime, addedTimeSeed } from "./addedTime";
import type { ChanceEntry, ChanceOutcome } from "./chanceLog";
import { energyFactorFor, energyPerMinute, clampEnergy, tiredKickSkills } from "./energy";
import { pickSquadScorer, pickSquadAssist } from "./squadData";
import { startingTeammateRoles, onPitchToday, fillMissingFromFullRoster, opponentStartingXI } from "./teamsheet";

export type SimOutcome = ChanceOutcome;

export interface SimSkills { power: number; technique: number; vision: number; pace: number }

/**
 * The odds for one chance of this kind. `shot`: you strike it (goal, else a
 * miss). Otherwise you play the ball: `find` is the pass reaching its man and
 * `score` his chance of scoring from it (an assist); a pass that does not
 * reach him is the ball lost.
 */
export function simOdds(kind: ScenarioKind, s: SimSkills, keeper = 83): { shot: true; goal: number; assist: number } | { shot: false; find: number; score: number } {
  const shotQ = (s.power + s.technique) / 200;
  const passQ = (s.technique + s.vision) / 200;
  // Measured against the real Palace keeper (83); a 65 keeper let in about 5% more.
  const k = Math.max(0.9, Math.min(1.1, 1 + (83 - keeper) * 0.003));
  // A shot: `goal` is yours; `assist` is the rebound a team-mate puts away,
  // which the real match credits to him with your assist (CanvasMatch's own
  // "a rebound a team-mate puts away is his goal" rule).
  const shot = (goal: number, assist: number) => ({ shot: true as const, goal: goal * k, assist: assist * k });
  switch (kind) {
    case "penalty": return shot(0.65, 0.02);                                  // played: 63-66% yours, 2% rebounds
    case "one_on_one": return shot(0.38, 0.19);                               // 34-43% yours, 17-20% a team-mate's
    case "tight_angle": return shot(0.10 + 0.08 * shotQ, 0.13);               // 15-18% yours, 13-14%
    case "long_range": return shot(0.042 + 0.069 * shotQ, 0.045 + 0.04 * shotQ); // 8-11% yours, 7-9%
    case "free_kick": return shot(Math.max(0.02, Math.min(0.2, 0.05 + 0.23 * (shotQ - 0.5))), 0); // Harry's targets
    case "volley": return shot(0.10 + 0.20 * shotQ, 0);                       // switched off in the game (estimate)
    case "header": return shot(0.08 + 0.17 * shotQ, 0);                       // switched off in the game (estimate)
    case "cutback": return { shot: false, find: 0.97 + 0.02 * passQ, score: 0.36 * k };      // found 99%, he scores 36%
    case "through_ball": return { shot: false, find: 0.77 + 0.09 * passQ, score: 0.31 * k }; // found 83-86%, 30-32%
    case "byline_cross": return { shot: false, find: 0.72 + 0.18 * passQ, score: 0.49 * k }; // found 83-90%, 47-51%
    case "corner": return { shot: false, find: 0.51 + 0.23 * passQ, score: 0.36 * k };       // found 65-74%, 33-39%
    default: return { shot: false, find: 0.58 + 0.30 * passQ, score: 0 };                     // build-up / midfield pass: found 74-87%
  }
}
/** The first-person run: flat, because the real match plays it at fixed settings (pace 100, opposition 100). */
export const SIM_RUN_CLEARED = 0.25;

export type SimChance = ChanceEntry;

export interface SimOptions {
  selection: Pick<SelectionVerdict, "status" | "onAt">;
  duties?: { freeKicks: boolean; penalties: boolean };
  /** Power/technique the shot uses (boots included), as the real match gets them. */
  skills?: { power: number; technique: number };
  seed?: number;
  /** The energy mode to play the whole match on. Default Medium, like a real kick-off. */
  energyMode?: "low" | "medium" | "high";
}

/** Play the match without drawing it. */
export function simulateOwnMatch(career: CareerState, fixture: Fixture, o: SimOptions): MatchStats {
  const seed = o.seed ?? career.season * 1000 + career.week;
  const rng = mulberry32((seed ^ 0x51ed) >>> 0);
  // Added time, rolled off its own seed exactly as the real match does (item 30).
  const added = rollAddedTime(mulberry32(addedTimeSeed(seed)));
  const whistle = 90 + added;
  const skills: SimSkills = {
    power: o.skills?.power ?? career.skills.power,
    technique: o.skills?.technique ?? career.skills.technique,
    vision: career.skills.vision,
    pace: career.skills.pace,
  };
  const position = career.playAs ?? career.player.position;
  const baseStrength = fixture.opponentStrength ?? career.league.find((t) => t.name === fixture.opponent)?.strength ?? 65;
  const oppStrength = Math.max(20, Math.min(99, baseStrength + (fixture.home ? -3 : 4)));
  const sub = o.selection.status === "Substitute" && o.selection.onAt > 0;

  // Energy, charged minute by minute at Medium from the minute you are on.
  const factor = energyFactorFor(career, fixture);
  const mode = o.energyMode ?? "medium";
  const perMin = energyPerMinute(mode, factor);
  const startEnergy = career.energy;
  let enteredAt = 0;
  const energyAt = (minute: number) => clampEnergy(startEnergy - Math.max(0, minute - enteredAt) * perMin);

  let subOn = false, subChances = 0;
  const inputs = (): HiddenMatchInputs => ({
    teamStrength: matchTeamStrength(career, career.relationships.team, fixture),
    oppStrength,
    playerSkill: (career.skills.power + career.skills.technique + career.skills.vision) / 3,
    home: fixture.home,
    pace: career.skills.pace,
    freeKick: career.skills.freeKick,
    position,
    energy: energyAt(enteredAt),
    energyMode: mode,
    impactSub: sub,
    talisman: !!career.ownedClubs?.[career.player.club]?.talisman,
    fergie: { from: 90, to: whistle },
    // v0.26: the same match context the played match passes.
    context: {
      playstyle: career.playstyle ?? "balanced",
      teamRelationship: career.relationships.team,
      fanRelationship: career.relationships.fans,
      skills: { pace: career.skills.pace, power: career.skills.power, technique: career.skills.technique, vision: career.skills.vision },
    },
    lateSub: subOn
      ? { enteredAt, owed: Math.max(0, lateSubQuota(enteredAt) - subChances), fitness: energyAt(enteredAt) }
      : undefined,
  });

  // Who is out there, named exactly as the real match names them.
  const startingXI = startingTeammateRoles(career, fixture);
  const onPitch: SquadPlayer[] = onPitchToday(fillMissingFromFullRoster(career.squad ?? [], startingXI, career), startingXI);
  const oppXI = opponentStartingXI(career, fixture);
  // The real starting keeper's rating when there is a sheet, else the side's strength — as CanvasMatch reads it.
  const keeper = Math.max(20, Math.min(99, oppXI?.find((p) => p.role === "GK")?.overall ?? oppStrength));
  const me = `${career.player.firstName} ${career.player.lastName}`;
  const goalEvents: GoalEvent[] = [];
  const oppGoalEvents: OppGoalEvent[] = [];
  const name = (events: HiddenMatchEvent[]) => {
    for (const e of events) {
      if (!e.isGoal) continue;
      if (e.teammateGoal) {
        const scorer = pickSquadScorer(onPitch, rng);
        const assist = scorer ? pickSquadAssist(onPitch, scorer.id, rng) : null;
        goalEvents.push({ minute: e.minute, scorer: scorer?.name ?? "Team-mate", assist: assist?.name, isUserGoal: false });
      } else if (oppXI) {
        const cands = oppXI.map((p) => ({ id: p.id, name: p.name, position: p.role }));
        const scorer = pickSquadScorer(cands, rng) ?? { id: "unnamed", name: "Opponent", position: "ST" as const };
        const assist = scorer.id !== "unnamed" ? pickSquadAssist(cands, scorer.id, rng) : null;
        oppGoalEvents.push({ minute: e.minute, scorerId: scorer.id, scorer: scorer.name, assistId: assist?.id, assist: assist?.name });
      }
    }
  };

  const st = newMatch(rng);
  if (sub) {
    const jitter = (career.week * 37 + career.season * 11) % 5;
    const rung = o.selection.onAt;
    name(advanceTo(st, inputs(), rng, 50));
    while (st.minute < 88 && !subComesOnNow(st.minute, st.userScore - st.oppScore, jitter, rung)) {
      name(advanceTo(st, inputs(), rng, st.minute + 1));
    }
    enteredAt = st.minute;
    subOn = true;
  }

  const t = { attempts: 0, goals: 0, assists: 0, passes: 0, misses: 0, lost: 0, dribbles: 0 };
  const chances: SimChance[] = [];
  /** The chance formula's anti-repeat memory, one per match like CanvasMatch's. */
  const memory = newSelectionMemory();
  let hooked: HookReason | null = null, hookedAt: number | null = null;
  const mayTake = (k: ScenarioKind) => !o.duties || (k === "free_kick" ? o.duties.freeKicks : k === "penalty" ? o.duties.penalties : true);

  /** One chance of yours: roll it, tally it, and tell the match. */
  const settle = (kind: ScenarioKind, minute: number, depth = 0): ScenarioResult => {
    t.attempts += 1;
    // v0.26: tired legs strike it weaker, as in the played match.
    const odds = simOdds(kind, tiredKickSkills(skills, energyAt(minute)), keeper);
    if (odds.shot) {
      const u = rng();
      if (u < odds.goal) {
        t.goals += 1; chances.push({ minute, kind, outcome: "goal" });
        goalEvents.push({ minute, scorer: me, isUserGoal: true, how: kind });
        return "goal";
      }
      if (u < odds.goal + odds.assist) {
        // Your shot, his rebound: his goal, your assist — as the real match credits it.
        t.assists += 1; t.passes += 1; chances.push({ minute, kind, outcome: "rebound" });
        const fwd = onPitch.filter((p) => ["ST", "CAM", "LW", "RW", "CM"].includes(p.position));
        const scorer = pickSquadScorer(fwd.length ? fwd : onPitch, rng);
        goalEvents.push({ minute, scorer: scorer?.name ?? "Team-mate", assist: me, isUserGoal: false, how: kind });
        return "goal";
      }
      t.misses += 1; chances.push({ minute, kind, outcome: "miss" });
      return "saved";
    }
    if (rng() >= odds.find) { t.lost += 1; chances.push({ minute, kind, outcome: "lost" }); return "lost"; }
    t.passes += 1;
    if (odds.score > 0 && rng() < odds.score) {
      t.assists += 1; chances.push({ minute, kind, outcome: "assist" });
      const fwd = onPitch.filter((p) => ["ST", "CAM", "LW", "RW", "CM"].includes(p.position));
      const scorer = pickSquadScorer(fwd.length ? fwd : onPitch, rng);
      goalEvents.push({ minute, scorer: scorer?.name ?? "Team-mate", assist: me, isUserGoal: false, how: kind });
      return "goal";
    }
    if (odds.score > 0) { chances.push({ minute, kind, outcome: "setup" }); return "saved"; }
    chances.push({ minute, kind, outcome: "pass" });
    // A pass that found its man can keep the move going — the real match's own
    // rule (chainReturnChance off the pass you just played, chainKindFor off
    // where it arrived, at most CHAIN_MAX links), not a second guess at it.
    if (depth < CHAIN_MAX) {
      const sc = buildScenario(kind, rng, keeper, career.relationships.team, skills.vision);
      const at = sc.runner?.pos ?? sc.passTarget;
      if (at) {
        // Scored the way the engine scores a pass the moment it is received.
        const forward = sc.ball.y - at.y;
        sc.passDifficulty = Math.max(0, Math.min(1, forward / 25 + Math.hypot(at.x - sc.ball.x, at.y - sc.ball.y) / 45));
        sc.passAmbition = forward > 2 && sc.forwardMostY !== undefined ? Math.max(0, Math.min(1, 1 - (at.y - sc.forwardMostY) / 8)) : 0;
      }
      // v0.25: in a picture with no goal, the give-and-go's own odds (giveAndGo.ts).
      if (at && rng() < (goalInView(kind) ? chainReturnChance(sc) : giveAndGoChance(sc, at))) {
        resolveScenario(st, "delivered");
        const next = playableKind(chainKindFor(at, rng, Math.max(sc.passDifficulty, sc.passAmbition ?? 0)), rng);
        return settle(next, minute, depth + 1);
      }
    }
    return "delivered";
  };

  for (let guard = 0; guard < 60; guard++) {
    // Item 25: a sub comes off the minute his legs go.
    let offAt = Infinity;
    if (subOn && perMin > 0) {
      const e = energyAt(st.minute);
      offAt = e <= SUB_OFF_ENERGY ? st.minute : st.minute + Math.ceil((e - SUB_OFF_ENERGY) / perMin);
    }
    const end = Math.min(whistle, offAt);
    let step = advanceUntilInvolved(st, inputs(), rng, end);
    // Set pieces that are somebody else's.
    for (let g = 0; g < 20; g++) {
      const k = step.request?.kinds.length === 1 ? step.request.kinds[0] : null;
      if (!k || mayTake(k) || (k !== "free_kick" && k !== "penalty")) break;
      const scored = rng() < (k === "penalty" ? 0.76 : 0.09);
      if (scored) step.events.push({ minute: st.minute, text: "", isGoal: true, teammateGoal: true });
      resolveScenario(st, scored ? "goal" : "saved");
      const next = advanceUntilInvolved(st, inputs(), rng, end);
      step = { ...next, events: [...step.events, ...next.events] };
    }
    name(step.events);
    const legsGone = !step.request && offAt < whistle && st.minute >= offAt;
    // Being taken off — the same rules as the real match.
    if (legsGone || (step.request && !step.fullTime)) {
      const ratingNow = fairRating({ goals: t.goals, assists: t.assists, passes: t.passes, dribbles: t.dribbles, misses: t.misses, lost: t.lost }, st.userScore, st.oppScore).rating;
      const d = legsGone
        ? { hooked: true, reason: "legs" as HookReason }
        : hookCheck({ minute: st.minute, startMinute: enteredAt, liveRating: ratingNow, scoreDiff: st.userScore - st.oppScore, rng, liveEnergy: energyAt(st.minute), cameo: subOn });
      if (d.hooked) {
        hooked = d.reason; hookedAt = st.minute;
        name(advanceTo(st, inputs(), rng, whistle));
        break;
      }
    }
    if (!step.request) break;
    const req = step.request;
    if (subOn) subChances += 1;
    const minute = st.minute;
    if (req.dribble) {
      t.attempts += 1;
      // The real run's own waves; clear 7+ men and it chains in near the
      // penalty spot, otherwise about 30 m out (finishFpDribble).
      const men = pickWaveSizes(rng).reduce((a, b) => a + b, 0);
      if (rng() < SIM_RUN_CLEARED) {
        t.dribbles += 1; chances.push({ minute, kind: "dribble", outcome: "dribble" });
        resolveScenario(st, "delivered");
        const at = men >= 7
          ? { x: CX + (rng() - 0.5) * 8, y: PEN_SPOT_Y - 2 + rng() * 4 }
          : { x: CX + (rng() - 0.5) * 12, y: 28 + rng() * 3 };
        resolveScenario(st, settle(playableKind(chainKindFor(at, rng, 1), rng), minute));
      } else {
        t.lost += 1; chances.push({ minute, kind: "dribble", outcome: "tackled" });
        resolveScenario(st, "lost");
      }
      continue;
    }
    // Which kind of chance — picked the way loadScenario picks it: the chance
    // formula's weighted roll first, today's plain roll when it has no picture.
    const playable = { ...req, kinds: withoutSwitchedOff(req.kinds) };
    const plan = selectChance({ request: playable, position, rng, memory });
    const kind = playableKind(plan ? plan.kind : pickScenarioKindFrom(position, rng, playable.kinds), rng);
    noteServedKind(st, kind);
    resolveScenario(st, settle(kind, minute));
  }

  const minutes = Math.max(1, Math.min(90, hookedAt ?? 90) - enteredAt);
  const stats = finaliseMatch(
    t.attempts, t.goals, t.assists, t.passes, minutes, st.userScore, st.oppScore, career,
    goalEvents, hooked, oppGoalEvents, fixture, { misses: t.misses, lost: t.lost, dribbles: t.dribbles },
  );
  return {
    ...stats,
    endEnergy: energyAt(hookedAt ?? whistle),
    ...(subOn ? { cameo: true, enteredAt } : {}),
    chanceLog: chances,
    simmed: true,
  };
}
