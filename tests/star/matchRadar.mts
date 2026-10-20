/**
 * The Match Radar (/star-radar-dev) must be a window onto the REAL unseen
 * match, never a second simulation of its own. Checked two ways:
 *   1. the same seed gives the same match, frame for frame;
 *   2. a hand-written loop over hiddenMatch.ts's own newMatch/tick/
 *      resolveScenario, with the same random stream and the same rule for
 *      your highlights, lands on exactly the same scoreline, minute by minute.
 * Then prints what a whole match looks like, for the report.
 */
import { startRadar, stepRadar, resolveHighlight, radarOver, playRadarMatch, radarSummary, attackLabel } from "../../lib/star/matchRadar";
import { readFileSync } from "node:fs";
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

console.log("\n== which way each side attacks (labels match the pitch)");
{
  // Your goals come from the zones drawn on the RIGHT (attacking/box); theirs
  // from the LEFT (defensive/own_box). Measured over real matches.
  let usRight = 0, usAll = 0, themLeft = 0, themAll = 0;
  for (let seed = 1; seed <= 1000; seed++) {
    const m = playRadarMatch(70_000 + seed, inputs);
    for (let i = 1; i < m.frames.length; i++) {
      const before = m.frames[i - 1];
      for (const e of m.frames[i].events) {
        if (e.kind === "goal-us") { usAll++; if (before.zone === "attacking" || before.zone === "box") usRight++; }
        if (e.kind === "goal-them") { themAll++; if (before.zone === "defensive" || before.zone === "own_box") themLeft++; }
      }
    }
  }
  console.log(`  your goals from their half (right): ${usRight}/${usAll}; their goals from your half (left): ${themLeft}/${themAll}`);
  ok(usRight / usAll > 0.6 && themLeft / themAll > 0.6, "you score at the right-hand end, they score at the left-hand end");
  ok(attackLabel("Chelsea", "user") === "CHELSEA →", `you attack right: "${attackLabel("Chelsea", "user")}"`);
  ok(attackLabel("Brighton", "opponent") === "← BRIGHTON", `they attack left: "${attackLabel("Brighton", "opponent")}"`);
  const src = readFileSync(new URL("../../components/star/MatchRadar.tsx", import.meta.url), "utf8");
  ok(/box: \[88\.5, 105\]/.test(src) && /own_box: \[0, 16\.5\]/.test(src), "their box is drawn on the right, yours on the left");
  ok(/possession === "user" \? "M 9 -3\.5 L 13\.5 0/.test(src) && /possession === "user" \? "M 8 -3 L 12 0/.test(src), "both ball arrows point right when you have it");
  ok((src.match(/attackLabel\(us\.short, "user"\)/g) ?? []).length === 2 && (src.match(/attackLabel\(them\.short, "opponent"\)/g) ?? []).length === 2,
    "both radars (test page and live) take their corner labels from attackLabel");
  ok(!/short\.toUpperCase\(\)\} [←→]|[←→] \{(us|them)\.short/.test(src), "no hand-written arrow labels left");
}

console.log("\n== the ball dot stays inside the area it names");
{
  // 20 Oct 2026: jitter's last step went signed, so the dot left its lit area
  // 220 of 455 minutes (50 off the pitch). The radar is a .tsx file, so this
  // reads its jitter and area tables from the source and runs them here.
  const src = readFileSync(new URL("../../components/star/MatchRadar.tsx", import.meta.url), "utf8");
  const body = src.match(/function jitter\(minute: number, salt: number\): number \{([\s\S]*?)\n\}/)?.[1] ?? "";
  const jitter = new Function("minute", "salt", body.replace(/^\s*\/\/.*$/gm, "")) as (m: number, s: number) => number;
  let outside = 0, n = 0;
  for (const seed of [11, 4242, 9001, 123, 777]) {
    for (const f of playRadarMatch(seed, inputs).frames) {
      for (const salt of [1, 2]) { n++; const j = jitter(f.minute, salt); if (j < -0.5 || j >= 0.5) outside++; }
    }
  }
  ok(body.length > 0 && outside === 0, `the dot's nudge stays inside its area: ${outside} of ${n} outside`);
}

if (failed) { console.log(`\n${failed} FAILED`); process.exit(1); }
console.log("\nall passed");
