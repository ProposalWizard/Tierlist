/**
 * The Match Radar (/star-radar-dev) must be a window onto the REAL unseen
 * match, never a second simulation of its own. Checked two ways:
 *   1. the same seed gives the same match, frame for frame;
 *   2. a hand-written loop over hiddenMatch.ts's own newMatch/tick/
 *      resolveScenario, with the same random stream and the same rule for
 *      your highlights, lands on exactly the same scoreline, minute by minute.
 * Then prints what a whole match looks like, for the report.
 */
import { startRadar, stepRadar, resolveHighlight, radarOver, playRadarMatch, radarSummary } from "../../lib/star/matchRadar";
import { newMatch, tick, resolveScenario, benchConversion, type HiddenMatchInputs } from "../../lib/star/hiddenMatch";
import { mulberry32 } from "../../lib/star/season";
import { injuryRiskFor } from "../../lib/star/careerFlow";

let failed = 0;
const ok = (cond: boolean, msg: string) => { if (!cond) { failed++; console.log("  FAIL", msg); } else console.log("  ok  ", msg); };

const inputs: HiddenMatchInputs = { teamStrength: 83, oppStrength: 72, home: true, playerSkill: 75, pace: 75, freeKick: 75, position: "ST" };

console.log("\n== same seed, same match");
{
  const a = playRadarMatch(4242, inputs), b = playRadarMatch(4242, inputs);
  ok(JSON.stringify(a.frames) === JSON.stringify(b.frames), "two runs of seed 4242 are identical frame for frame");
  ok(a.frames.length === 91, `a match is 90 minutes plus kick-off (${a.frames.length} frames)`);
}

console.log("\n== it is the real match, not a copy");
{
  let same = 0;
  const N = 200;
  for (let seed = 1; seed <= N; seed++) {
    const radar = playRadarMatch(seed, inputs);
    // The same thing, written straight against hiddenMatch.ts.
    const rng = mulberry32(seed);
    const st = newMatch(rng);
    const scores: string[] = [];
    while (st.minute < 90) {
      const { request } = tick(st, inputs, rng);
      if (request) resolveScenario(st, rng() < benchConversion(request.zone) ? "goal" : "saved");
      scores.push(`${st.userScore}-${st.oppScore}`);
    }
    const radarScores = radar.frames.slice(1).map((f) => `${f.userScore}-${f.oppScore}`);
    if (JSON.stringify(scores) === JSON.stringify(radarScores)) same++;
  }
  ok(same === N, `${same}/${N} matches: the radar's score, minute by minute, equals a direct tick loop`);
}

console.log("\n== a highlight stops the clock until it is played out");
{
  const m = startRadar(7, inputs);
  let stopped = false;
  for (let i = 0; i < 400 && !radarOver(m); i++) {
    if (m.pending) {
      const minute = m.state.minute;
      const f = stepRadar(m);
      stopped = f === null && m.state.minute === minute;
      const before = m.state.userScore;
      resolveHighlight(m, "goal");
      ok(m.state.userScore === before + 1, "\"You score\" puts a goal on the board through resolveScenario");
      break;
    }
    stepRadar(m);
  }
  ok(stopped, "stepRadar refuses to move the clock while your highlight is waiting");
}

console.log("\n== what a match looks like (report numbers)");
for (const [label, inp] of [
  ["Chelsea 83 (home) v Brighton 72", inputs],
  ["Brighton 72 (home) v Chelsea 83", { ...inputs, teamStrength: 72, oppStrength: 83 }],
] as const) {
  const N = 500;
  let gf = 0, ga = 0, poss = 0, hl = 0, w = 0, d = 0, chancesUs = 0, chancesThem = 0;
  for (let seed = 1; seed <= N; seed++) {
    const s = radarSummary(playRadarMatch(10_000 + seed, inp as HiddenMatchInputs));
    gf += s.userScore; ga += s.oppScore; poss += s.possessionUs; hl += s.highlights.length;
    chancesUs += s.chancesUs; chancesThem += s.chancesThem;
    if (s.userScore > s.oppScore) w++; else if (s.userScore === s.oppScore) d++;
  }
  console.log(`  ${label}: goals ${(gf / N).toFixed(2)}–${(ga / N).toFixed(2)}, possession ${(poss / N).toFixed(0)}%, chances ${(chancesUs / N).toFixed(1)}–${(chancesThem / N).toFixed(1)}, your highlights ${(hl / N).toFixed(1)}/match, W/D/L ${w}/${d}/${N - w - d} of ${N}`);
}

console.log("\n== injuries: the career's full-time roll, shown at full time");
{
  const a = playRadarMatch(4242, inputs, 90, 100);
  ok(!!a.injuryCheck, "a finished match carries a full-time injury check");
  ok(a.injuryCheck!.risk === injuryRiskFor(a.injuryCheck!.endEnergy), "its risk is the career's own injuryRiskFor at the energy you finish on");
  const b = playRadarMatch(4242, inputs, 90, 30);
  ok(JSON.stringify(a.frames.map((f) => [f.userScore, f.oppScore, f.zone, f.possession]))
    === JSON.stringify(b.frames.map((f) => [f.userScore, f.oppScore, f.zone, f.possession])),
    "the injury roll never changes the match itself (same seed, different energy, same 90 minutes)");
  for (const start of [100, 80, 60]) {
    const N = 2000;
    let hurt = 0, marked = 0, end = 0;
    for (let seed = 1; seed <= N; seed++) {
      const m = playRadarMatch(50_000 + seed, inputs, 90, start);
      end += m.injuryCheck!.endEnergy;
      if (m.injuryCheck!.injury) hurt++;
      if (m.frames.some((f) => f.events.some((e) => e.kind === "injury" && e.minute === 90))) marked++;
    }
    ok(marked === hurt, `start ${start}%: every injury (${hurt}) is an event on the timeline at 90' (${marked})`);
    console.log(`  start ${start}% energy → ends ~${Math.round(end / N)}%, injured ${hurt}/${N} (${(hurt / N * 100).toFixed(1)}%; career risk ${(injuryRiskFor(end / N) * 100).toFixed(1)}%)`);
  }
}

if (failed) { console.log(`\n${failed} FAILED`); process.exit(1); }
console.log("\nall passed");
