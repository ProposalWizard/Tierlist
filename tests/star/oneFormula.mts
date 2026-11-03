/**
 * ONE FORMULA (sim rebuild piece 4, 22 Oct 2026;
 * docs/plans/2026-10-21-sim-formula-rebuild.md §6c, §8 row 4).
 *
 * The real match, "Sim this match", the match radar, the full 90 (sim90) and
 * the FHR ruler all play the same unseen match (hiddenMatch.ts). This checks
 * they are handed the same inputs, and so play the same match:
 *
 *   1. One builder. Every tool's inputs come from lib/star/matchInputs.ts
 *      (the code is read for the two screens that can't run here), and the
 *      real match's inputs are exactly what it built by hand before.
 *   2. Same seed, same match. The radar, sim90 and the real match's own loop
 *      (advanceUntilInvolved, with the live radar's trace) give the same
 *      minutes, for 50 seeds.
 *   3. No even-match bias. 500 even matches (Match flow New): 50 ± 1.5% of the
 *      ball and corners level to within 0.5 a match. Old and a mismatch are
 *      printed for the report.
 */
import { readFileSync } from "node:fs";
import {
  newMatch, advanceUntilInvolved, resolveScenario, benchConversion,
  type HiddenMatchInputs, type RadarTick,
} from "../../lib/star/hiddenMatch";
import { playRadarMatch, radarSummary, frameTick, hadBall } from "../../lib/star/matchRadar";
import { matchInputsFor, simpleMatchSpec, careerMatchSpec, opponentMatchStrength } from "../../lib/star/matchInputs";
import { sim90Inputs, simulate90 } from "../../lib/star/sim90";
import { rulerInputs } from "../../lib/star/fhr/ruler";
import { mulberry32 } from "../../lib/star/season";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { canTakeCorners } from "../../lib/star/cornerReach";
import { storyCornersOpen } from "../../lib/star/setPieces";
import { mechanicOpen, aerialIntroGame } from "../../lib/star/mechanics";
import { matchTeamStrength } from "../../lib/star/matchday";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import type { StarPlayer, Fixture } from "../../lib/star/types";

let failed = 0;
const ok = (c: boolean, what: string) => { console.log(`${c ? "  ok  " : "  FAIL"} ${what}`); if (!c) failed++; };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
/** Inputs compared field by field, absent and undefined alike. */
const sameInputs = (a: HiddenMatchInputs, b: HiddenMatchInputs) => {
  const norm = (x: HiddenMatchInputs) => JSON.stringify(Object.fromEntries(Object.entries(x).filter(([, v]) => v !== undefined).sort(([p], [q]) => p.localeCompare(q))));
  return norm(a) === norm(b);
};

// ── 1. One builder ──────────────────────────────────────────────────────────
console.log("\n== 1. every tool builds its inputs the one way");
{
  // The three test tools: same setup, same inputs.
  let agree = 0;
  for (let seed = 1; seed <= 50; seed++) {
    const r = mulberry32(seed);
    const us = 55 + Math.floor(r() * 35), them = 55 + Math.floor(r() * 35), flow = r() < 0.5;
    const radar = matchInputsFor(simpleMatchSpec({ teamStrength: us, oppStrength: them, home: true, skill: 70, position: "ST", matchFlow: flow }));
    const s90 = sim90Inputs({ home: "A", away: "B", homeStrength: us, awayStrength: them, seed, matchFlow: flow });
    if (sameInputs(radar, s90)) agree++;
  }
  ok(agree === 50, `radar and sim90: ${agree}/50 setups give identical inputs`);
  for (const flow of [false, true]) {
    const radar = matchInputsFor(simpleMatchSpec({ teamStrength: 70, oppStrength: 70, skill: 65, position: "ST", matchFlow: flow }));
    ok(sameInputs(radar, rulerInputs(flow)), `radar and the ruler (70 v 70, skill 65, Match flow ${flow ? "New" : "Old"}): identical inputs`);
  }
  const ruler = rulerInputs(true);
  ok(ruler.livePenalties === true && !!ruler.context && ruler.matchFlow === true,
    "the ruler now plays with live penalties, the match context and Match flow (it measured the Old match before)");

  // The real match and "Sim this match": the career read the one way, and the
  // real match's inputs exactly what CanvasMatch built by hand before.
  const car = makeInitialCareer({
    firstName: "One", lastName: "Formula", age: 19, skinTone: "light", club: PREMIER_LEAGUE_CLUBS[5], clubBadge: null,
    position: "ST", nationality: "England", startYear: 2027,
  } as StarPlayer, [...PREMIER_LEAGUE_CLUBS]);
  const fixture = { home: false, opponent: PREMIER_LEAGUE_CLUBS[2], kind: "league" } as unknown as Fixture;
  const kick = { power: car.skills.power + 4, technique: car.skills.technique + 2 };
  const opp = opponentMatchStrength(78, fixture.home);
  const built = matchInputsFor(careerMatchSpec(car, fixture, {
    oppStrength: opp, teamFallback: 60, position: "ST", kick, playstyle: "attacking",
    energy: 92, energyMode: "high", impactSub: false, farewell: false, lateSub: undefined, addedTime: 4, fullTime: 90,
  }));
  // CanvasMatch's hiddenInputs as it was written by hand (Harry, 21 Oct 2026).
  const handWritten: HiddenMatchInputs = {
    teamStrength: matchTeamStrength(car, 60, fixture),
    oppStrength: opp,
    playerSkill: (car.skills.power + car.skills.technique + car.skills.vision) / 3,
    home: fixture.home,
    pace: car.skills.pace,
    freeKick: car.skills.freeKick,
    canTakeCorners: canTakeCorners(kick),
    position: "ST",
    energy: 92,
    energyMode: "high",
    impactSub: false,
    talisman: false,
    matchFlow: built.matchFlow,
    context: {
      playstyle: "attacking",
      teamRelationship: car.relationships.team,
      fanRelationship: car.relationships.fans,
      skills: { pace: car.skills.pace, power: car.skills.power, technique: car.skills.technique, vision: car.skills.vision },
    },
    livePenalties: true,
    lateSub: undefined,
    fergie: { from: 90, to: 94 },
  };
  // 25 Oct 2026 the real match added two more by hand for a new career (the
  // story order): a team-mate's corners before Technique and Vision 70, and the
  // moves still shut. Both now come from careerMatchSpec.
  if (car.unlocks?.story) {
    if (!storyCornersOpen(car)) handWritten.canTakeCorners = false;
    handWritten.mechanics = { air: mechanicOpen(car, "aerial"), airIntro: aerialIntroGame(car), dribble: mechanicOpen(car, "dribble") };
  }
  ok(sameInputs(built, handWritten), "a career match: the builder gives exactly the inputs the real match built by hand");
  ok(opponentMatchStrength(78, true) === 75 && opponentMatchStrength(78, false) === 82 && opponentMatchStrength(98, false) === 99,
    "the opposition's home/away strength rule: 78 → 75 at yours, 82 at theirs, never past 99");

  // The two screens that can't run here: read their code.
  const canvas = readFileSync(new URL("../../components/star/CanvasMatch.tsx", import.meta.url), "utf8");
  const block = canvas.slice(canvas.indexOf("const hiddenInputs = (): HiddenMatchInputs =>"), canvas.indexOf("// Translate what the physics produced"));
  ok(block.includes("matchInputsFor(") && block.includes("careerMatchSpec(") && !/livePenalties\s*:|matchFlow\s*:|canTakeCorners\s*:/.test(block),
    "the real match (CanvasMatch hiddenInputs) builds through matchInputsFor + careerMatchSpec, nothing by hand");
  const sim = readFileSync(new URL("../../lib/star/simMatch.ts", import.meta.url), "utf8");
  ok(sim.includes("matchInputsFor(careerMatchSpec(") && !/livePenalties\s*:|matchFlow\s*:\s*!/.test(sim),
    "\"Sim this match\" (simMatch.ts) builds through matchInputsFor + careerMatchSpec");
  const page = readFileSync(new URL("../../app/star-radar-dev/page.tsx", import.meta.url), "utf8");
  ok(page.includes("matchInputsFor(simpleMatchSpec(") && !page.includes("withCornerReach("),
    "the radar page builds through matchInputsFor + simpleMatchSpec");
}

// ── 2. Same seed, same match ────────────────────────────────────────────────
console.log("\n== 2. same seed, same match in every tool");
{
  /** The real match's own loop: advanceUntilInvolved with the live radar's
   *  trace, your chances handed back at the bench rate (as the radar does). */
  const realLoop = (seed: number, inputs: HiddenMatchInputs): Map<number, RadarTick> => {
    const rng = mulberry32(seed);
    const st = newMatch(rng);
    st.radarTrace = new Map();
    for (;;) {
      const step = advanceUntilInvolved(st, inputs, rng, 90);
      if (!step.request) break;
      resolveScenario(st, rng() < benchConversion(step.request.zone) ? "goal" : "saved");
    }
    return st.radarTrace;
  };
  const key = (t: RadarTick) => [t.minute, hadBall(t), t.zone, t.lane, t.shot ?? "", t.goal ?? "", t.corner ?? "", !!t.yours].join(":");
  let radarReal = 0, radarSim90 = 0;
  for (let seed = 1; seed <= 50; seed++) {
    const inputs = sim90Inputs({ home: "A", away: "B", homeStrength: 60 + (seed % 25), awayStrength: 85 - (seed % 25), seed, matchFlow: seed % 2 === 0 });
    const radar = playRadarMatch(seed, inputs);
    const trace = realLoop(seed, inputs);
    const a = radar.frames.slice(1).map((f) => key(frameTick(f)));
    const b = Array.from(trace.values()).sort((x, y) => x.minute - y.minute).map(key);
    if (same(a, b)) radarReal++;
    const s90 = simulate90({ home: "A", away: "B", homeStrength: 60 + (seed % 25), awayStrength: 85 - (seed % 25), seed, matchFlow: seed % 2 === 0 });
    if (same(s90.radar.frames.map((f) => key(frameTick(f))), radar.frames.map((f) => key(frameTick(f))))) radarSim90++;
  }
  ok(radarReal === 50, `radar v the real match's loop: ${radarReal}/50 seeds, every minute the same (ball, area, shots, goals, corners, your chances)`);
  ok(radarSim90 === 50, `radar v sim90: ${radarSim90}/50 seeds, every minute the same`);
}

// ── 3. No even-match bias ───────────────────────────────────────────────────
console.log("\n== 3. an even match is even (500 matches each)");
interface Row { poss: number; cu: number; ct: number; su: number; st: number; gu: number; gt: number }
function measure(inputs: HiddenMatchInputs, N = 500): Row {
  const r: Row = { poss: 0, cu: 0, ct: 0, su: 0, st: 0, gu: 0, gt: 0 };
  for (let i = 0; i < N; i++) {
    const m = playRadarMatch(1000 + i * 7919, inputs);
    r.poss += radarSummary(m).possessionUs;
    for (const f of m.frames.slice(1)) {
      const t = frameTick(f);
      if (t.corner === "user") r.cu++; else if (t.corner === "opponent") r.ct++;
      if (t.shot === "user") r.su++; else if (t.shot === "opponent") r.st++;
    }
    r.gu += m.state.userScore; r.gt += m.state.oppScore;
  }
  return { poss: r.poss / N, cu: r.cu / N, ct: r.ct / N, su: r.su / N, st: r.st / N, gu: r.gu / N, gt: r.gt / N };
}
const show = (label: string, x: Row) => console.log(`   ${label.padEnd(30)} ball ${x.poss.toFixed(1)}% · corners ${x.cu.toFixed(2)} v ${x.ct.toFixed(2)} · shot minutes ${x.su.toFixed(1)} v ${x.st.toFixed(1)} · goals ${x.gu.toFixed(2)} v ${x.gt.toFixed(2)}`);
const spec = (us: number, them: number, flow: boolean) => matchInputsFor(simpleMatchSpec({ teamStrength: us, oppStrength: them, skill: 65, position: "ST", matchFlow: flow }));
{
  const even = measure(spec(70, 70, true));
  show("even 70 v 70, Match flow New", even);
  ok(Math.abs(even.poss - 50) <= 1.5, `even match, Match flow New: ${even.poss.toFixed(1)}% of the ball (50 ± 1.5; was 44.5%)`);
  ok(Math.abs(even.cu - even.ct) <= 0.5, `even match, Match flow New: corners ${even.cu.toFixed(2)} v ${even.ct.toFixed(2)} (level ± 0.5; was 3.94 v 5.37)`);
  show("even 70 v 70, Match flow Old", measure(spec(70, 70, false)));
  show("top v bottom 82 v 62, New", measure(spec(82, 62, true)));
  show("top v bottom 82 v 62, Old", measure(spec(82, 62, false)));
}

if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
console.log("\none formula: all good");
