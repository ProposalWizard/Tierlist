/**
 * THE STICK on the top-down dribble run (prototype, /star-dribble-stick-dev).
 *
 * Harry, 14 Oct 2026: "the other top-down dribbling we had, especially in 3D,
 * where you had the joystick and you were moving around with the ball."
 *
 * The run is the match's own (lib/star/firstPersonDribble.ts, played in
 * CanvasMatch's top-down dribble). The stick only changes how YOU move; the
 * men, the tackle, the burst and the passes are the same code. This file
 * checks that, and measures the stick against the swipe with the same bot
 * reading the same men on the same seeds.
 */
import {
  newRun, stepRun, applySteer, applyBurst, applyStick, stickSpeed, pickWaveSizes,
  STICK_LAT, STICK_SPRINT, LUNGE_REACH,
  type FpRunState, type FpDefender,
} from "../../lib/star/firstPersonDribble";
import { STICK } from "../../lib/star/three3d/gait";
import { mulberry32 } from "../../lib/star/season";

let failed = 0;
function check(ok: boolean, msg: string) {
  if (!ok) { failed++; console.log("  ✗ " + msg); } else console.log("  ✓ " + msg);
}
const DT = 1 / 60;

function liveWave(s: FpRunState): FpDefender[] {
  return s.defenders.filter(d => d.round === s.activeRound && d.phase !== "beaten" && d.phase !== "won");
}
function nearestThreat(s: FpRunState): FpDefender | null {
  const live = liveWave(s);
  if (!live.length) return null;
  return live.reduce((a, b) => (s.y - a.y) <= (s.y - b.y) ? a : b);
}
function widestGapTarget(xs: number[], minX: number, maxX: number): number {
  const sorted = [...xs].sort((a, b) => a - b);
  const edges = [minX, ...sorted, maxX];
  let bestMid = (minX + maxX) / 2, bestGap = -1;
  for (let i = 0; i < edges.length - 1; i++) {
    const gap = edges[i + 1] - edges[i];
    if (gap > bestGap) { bestGap = gap; bestMid = (edges[i] + edges[i + 1]) / 2; }
  }
  return bestMid;
}

type Input = "swipe" | "stick" | "stickPatient";
/** The match's own run (pace 100, opp 100, 3-4 waves) or a softer one. */
function makeRun(seed: number, prod: boolean): FpRunState {
  const rng = mulberry32(seed * 977 + 13);
  return prod
    ? newRun({ pace: 100, oppStrength: 100, waveSizes: pickWaveSizes(rng, { minRounds: 3 }), rng })
    : newRun({ pace: 60, oppStrength: 60, rng });
}

/**
 * One bot, three ways of moving: steer for the widest gap in each wave, and
 * burst away from where a telegraphing man will land, `delay` seconds after
 * his telegraph starts (a person is not instant).
 */
function botRun(seed: number, input: Input, prod: boolean, delay: number): FpRunState {
  const s = makeRun(seed, prod);
  if (input !== "swipe") applyStick(s, 0, 0.88);
  let gapFor = -1, target = s.x;
  const seen = new Map<FpDefender, number>();
  const fired = new Set<FpDefender>();
  for (let t = 0; t < 30 && s.phase === "running"; t += DT) {
    if (s.activeRound >= 0 && s.activeRound !== gapFor) {
      gapFor = s.activeRound;
      target = widestGapTarget(s.defenders.filter(d => d.round === s.activeRound).map(d => d.x), s.minX, s.maxX);
      if (input === "swipe") applySteer(s, target);
    }
    const threat = nearestThreat(s);
    if (input !== "swipe") {
      const sx = Math.max(-1, Math.min(1, (target - s.x) / 1.2));
      // Patient: ease to a jog while a man closes, so he commits sooner.
      const closing = input === "stickPatient" && threat && threat.phase === "closing" && s.y - threat.y < 8;
      applyStick(s, sx * 0.7, closing ? 0.5 : 0.88);
    }
    if (threat && threat.phase === "telegraph" && !fired.has(threat)) {
      if (!seen.has(threat)) seen.set(threat, t);
      if (t - (seen.get(threat) ?? t) >= delay - 1e-9) {
        const landsAt = threat.x + threat.commitSide * LUNGE_REACH;
        if (applyBurst(s, s.x >= landsAt ? 1 : -1)) fired.add(threat);
      }
    }
    stepRun(s, DT);
  }
  return s;
}

function rate(input: Input, prod: boolean, delay: number, n = 400): { clear: number; time: number } {
  let c = 0, time = 0;
  for (let seed = 1; seed <= n; seed++) {
    const s = botRun(seed, input, prod, delay);
    if (s.phase === "clear") { c++; time += s.elapsed; }
  }
  return { clear: c / n, time: c ? time / c : 0 };
}

console.log("dribbleStick: the stick on the match's dribble run");

// ── The swipe run is untouched: no stick, no change ──
{
  const a = makeRun(5, true), b = makeRun(5, true);
  for (let i = 0; i < 600; i++) { stepRun(a, DT); stepRun(b, DT); }
  check(a.stick === undefined && a.y === b.y && a.x === b.x, "a run nobody gives a stick to plays exactly as before (no stick field, same path)");
}

// ── Stick zones: stand, walk, jog, run, sprint (3D's own zones) ──
{
  const run = 7.4;
  check(stickSpeed(STICK.dead * 0.5, run) === 0, "inside the dead zone you stand still");
  check(stickSpeed(0.3, run) < stickSpeed(0.6, run) && stickSpeed(0.6, run) < stickSpeed(0.85, run), "a bigger push is faster (walk < jog < run)");
  check(Math.abs(stickSpeed(1, run) - run * STICK_SPRINT) < 1e-9, `a full push sprints (${STICK_SPRINT}× run)`);
}

// ── Let go and you stop; push and you build up, never jump ──
{
  const s = makeRun(9, true);
  applyStick(s, 0, 1);
  stepRun(s, DT);
  const first = s.fwd ?? 0;
  check(first > 0 && first < s.speed * 0.2, `speed builds, never jumps (after one frame ${first.toFixed(2)} m/s of ${s.speed.toFixed(1)})`);
  let t = 0;
  while ((s.fwd ?? 0) < s.speed * 0.9 && t < 2) { stepRun(s, DT); t += DT; }
  check(t < 0.4, `standing to 90% of run speed in ${(t + DT).toFixed(2)} s`);
  applyStick(s, 0, 0);
  for (let i = 0; i < 40; i++) stepRun(s, DT);
  const y0 = s.y;
  for (let i = 0; i < 30; i++) stepRun(s, DT);
  check(Math.abs(s.y - y0) < 1e-6, "let go of the stick and you stand still with it");
}

// ── Sideways is capped: you still cannot out-jog a man's mirror ──
{
  const s = makeRun(11, true);
  applyStick(s, 1, 0);
  const x0 = s.x;
  for (let i = 0; i < 30; i++) stepRun(s, DT);
  const v = (s.x - x0) / (30 * DT);
  const minMirror = Math.min(...s.defenders.map(d => d.mirrorSpeed));
  check(v <= STICK_LAT + 1e-6, `a full sideways push moves you at most ${STICK_LAT} m/s (measured ${v.toFixed(2)})`);
  check(STICK_LAT < minMirror, `…slower than the slowest man's mirror in the match's run (${minMirror.toFixed(2)} m/s)`);
}

// ── Response (sim ticks, not the screen): time to 0.5 m sideways from a straight run ──
const resp = (input: "swipe" | "stick") => {
  const s = makeRun(21, true);
  if (input === "stick") applyStick(s, 0, 0.88);
  for (let i = 0; i < 30; i++) stepRun(s, DT);
  const x0 = s.x;
  if (input === "swipe") applySteer(s, s.x + 4); else applyStick(s, 0.7, 0.62);
  let t = 0;
  while (Math.abs(s.x - x0) < 0.5 && t < 2) { stepRun(s, DT); t += DT; }
  return t;
};
const rSwipe = resp("swipe"), rStick = resp("stick");
console.log(`  response to 0.5 m sideways: swipe ${(rSwipe * 1000).toFixed(0)} ms, stick ${(rStick * 1000).toFixed(0)} ms`);
check(rStick <= rSwipe + 0.05, "the stick answers about as fast as the swipe (within 50 ms)");

// ── Difficulty: the same bot, the same seeds, swipe vs stick ──
const rows: [string, boolean, number][] = [
  ["match run (pace 100, opp 100), instant reads", true, 0],
  ["match run, 0.25 s reads", true, 0.25],
  ["soft run (pace 60, opp 60), 0.25 s reads", false, 0.25],
];
for (const [label, prod, delay] of rows) {
  const sw = rate("swipe", prod, delay), st = rate("stick", prod, delay), sp = rate("stickPatient", prod, delay);
  console.log(`  ${label}: clear swipe ${(sw.clear * 100).toFixed(1)}% (${sw.time.toFixed(1)} s) · stick ${(st.clear * 100).toFixed(1)}% (${st.time.toFixed(1)} s) · stick, patient ${(sp.clear * 100).toFixed(1)}% (${sp.time.toFixed(1)} s)`);
  if (delay > 0) check(Math.abs(st.clear - sw.clear) <= 0.12, `${label}: the stick is about as hard as the swipe (within 12 points)`);
}

// Burst rule unchanged: blind bursts (before any telegraph) still rarely clear on the stick.
{
  let c = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const s = makeRun(seed, false);
    applyStick(s, 0, 0.88);
    for (let t = 0; t < 30 && s.phase === "running"; t += DT) {
      const th = nearestThreat(s);
      if (th && th.phase === "closing" && s.y - th.y < 7) applyBurst(s, 1);
      stepRun(s, DT);
    }
    if (s.phase === "clear") c++;
  }
  check(c / 300 < 0.25, `bursting blind on the stick still rarely clears (${(c / 3).toFixed(1)}%)`);
}

if (failed) { console.log(`${failed} failed`); process.exit(1); }
console.log("all passed");
