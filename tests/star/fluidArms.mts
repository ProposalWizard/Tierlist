/**
 * FLUID ARMS (B5c, lib/star/cutscene/fluid.ts + refMotion.ts): the arm paths
 * copied from the reference videos are real arm paths (no wrist further from
 * the shoulder than the arm is long, no jump between frames, every clip
 * there), loops have no seam, the eased lift starts and stops soft and
 * settles at 1, the human rhythms never run backwards, the shoulder follow
 * stays within a few degrees and only lifts for a raised hand, and every
 * helper is a pure function of t (the same second gives the same number).
 */
import { refArms, refArmDuration, type RefArmClip } from "../../lib/star/cutscene/refMotion";
import { liftCurve, humanBeat, clapGap, liveDrift, shoulderFollow, minJerk, wander, actorSeed, OVERLAP } from "../../lib/star/cutscene/fluid";
import { POSE_QUALITY } from "../../lib/star/cutscene/presets/clips";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const len = (v: number[]) => Math.hypot(v[0], v[1], v[2]);

const CLIPS: RefArmClip[] = ["talk-hands", "trophy-lift", "roar", "wave-clap", "shirt-up"];

// ── the real people's arm paths ──
for (const c of CLIPS) {
  const dur = refArmDuration(c);
  check(dur > 3, `${c}: a real clip (${dur.toFixed(2)} s)`);
  check(`ref-${c}` in POSE_QUALITY, `${c}: the camera knows how good it looks`);
  let prev = refArms(c, 0)!, worstStep = 0, worstLen = 0;
  for (let t = 1 / 60; t <= dur; t += 1 / 60) {
    const s = refArms(c, t)!;
    for (const k of ["L", "R", "Le", "Re"] as const) {
      const step = len([s[k][0] - prev[k][0], s[k][1] - prev[k][1], s[k][2] - prev[k][2]]);
      worstStep = Math.max(worstStep, step);
      if (k === "L" || k === "R") worstLen = Math.max(worstLen, len(s[k]));
    }
    prev = s;
  }
  // a wrist at 4 m/s on a 0.55 m arm moves 0.12 arm lengths in a 60th of a second
  check(worstStep < 0.12, `${c}: no wrist or elbow jumps (worst ${worstStep.toFixed(3)} arm lengths in 1/60 s)`);
  check(worstLen <= 1.0, `${c}: no wrist further out than the arm is long (${worstLen.toFixed(2)})`);
  const a = JSON.stringify(refArms(c, 1.234)), b = JSON.stringify(refArms(c, 1.234));
  check(a === b, `${c}: the same second, the same arms`);
  // a loop has no seam: step through three rounds
  let lp = refArms(c, 0, true)!, worstLoop = 0;
  for (let t = 1 / 60; t < dur * 3; t += 1 / 60) {
    const s = refArms(c, t, true)!;
    worstLoop = Math.max(worstLoop, len([s.L[0] - lp.L[0], s.L[1] - lp.L[1], s.L[2] - lp.L[2]]), len([s.R[0] - lp.R[0], s.R[1] - lp.R[1], s.R[2] - lp.R[2]]));
    lp = s;
  }
  check(worstLoop < 0.12, `${c}: looped, it never pops (worst ${worstLoop.toFixed(3)} arm lengths in 1/60 s)`);
}

// ── the eased lift: a dip, a soft start, an overshoot, a settle at 1 ──
{
  let prev = liftCurve(0, 0.2, 0.75), worst = 0, min = 0, max = 0;
  for (let t = 1 / 120; t < 3; t += 1 / 120) {
    const v = liftCurve(t, 0.2, 0.75);
    worst = Math.max(worst, Math.abs(v - prev));
    min = Math.min(min, v); max = Math.max(max, v);
    prev = v;
  }
  check(worst < 0.03, `the lift never jumps (worst ${worst.toFixed(3)} in 1/120 s)`);
  check(min < -0.02 && min > -0.1, `a small dip before the lift (${min.toFixed(3)})`);
  check(max > 1.0 && max < 1.12, `a small overshoot (${max.toFixed(3)})`);
  check(Math.abs(liftCurve(3, 0.2, 0.75) - 1) < 1e-9, "it settles at the top");
  check(minJerk(0) === 0 && minJerk(1) === 1 && Math.abs(minJerk(0.5) - 0.5) < 1e-9, "minimum-jerk runs 0 → 1");
}

// ── rhythms a person keeps ──
{
  let prev = humanBeat(0, 1.3, 2).phase, back = 0;
  const sizes: number[] = [];
  for (let t = 0.01; t < 20; t += 0.01) {
    const b = humanBeat(t, 1.3, 2);
    if (b.phase < prev) back++;
    prev = b.phase;
    sizes.push(b.size);
  }
  check(back === 0, "the beat never runs backwards");
  check(Math.min(...sizes) > 0.75 && Math.max(...sizes) < 1.25, "each beat a touch different in size, never wild");
  check(Math.max(...sizes) - Math.min(...sizes) > 0.05, "…but not all the same (not a metronome)");
  check(clapGap(0) === 1 && clapGap(0.38) < 1e-9 && Math.abs(clapGap(0.999) - 1) < 0.01, "a clap: apart, together at the hit, apart again");
}

// ── drift, sway and the shoulder ──
{
  let worst = 0;
  for (let t = 0; t < 30; t += 0.05) {
    const d = liveDrift(t, actorSeed("you"));
    worst = Math.max(worst, len(d));
    check(Math.abs(wander(t, 3)) <= 1.0001, "wander stays in −1..1");
  }
  check(worst < 0.03 && worst > 0.005, `a held hand drifts a little, never off what it holds (most ${(worst * 100).toFixed(1)} cm)`);
  check(actorSeed("you") !== actorSeed("boss"), "two men never sway in step");
  const low = shoulderFollow(-0.9, 0.1), high = shoulderFollow(0.8, 0.2), reach = shoulderFollow(-0.2, 0.95);
  check(low.raise < 0.01 && low.forward === 0, "a hand at the side: the collarbone stays put");
  check(high.raise > 0.2 && high.raise <= 0.28, "a hand overhead: the collarbone lifts (at most 16°)");
  check(reach.forward > 0.1 && reach.forward <= 0.16, "a long reach forward: the shoulder rolls forward (at most 9°)");
  check(OVERLAP.lower > 0 && OVERLAP.hand > OVERLAP.lower, "the hand trails the forearm, the forearm the upper arm");
}

if (problems.length) { console.error(`✗ ${problems.length} problem(s):\n  ` + problems.slice(0, 40).join("\n  ")); process.exit(1); }
console.log("✓ fluid arms: real arm paths, soft lifts, human rhythms, living holds");
