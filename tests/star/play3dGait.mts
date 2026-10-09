/**
 * WALK → JOG → RUN → SPRINT and the stamina bar (lib/star/three3d/gait.ts),
 * plus stepHuman and Free Roam's stamina in the World (Harry, 9 Oct 2026).
 */
import {
  speedsForPace, stickTarget, approach, pickGait, gaitEdges, loopRate, sameFootTime,
  stepStamina, freshStamina, canSprint, STAMINA, SPRINT_OVER_RUN, STICK, MOVE,
} from "../../lib/star/three3d/gait";
import { makePlayer, skillsOf, stepHuman, speedOf } from "../../lib/star/play3d/player";
import { makeFreeRoam } from "../../lib/star/play3d/freeRoam";
import { STEP } from "../../lib/star/play3d/constants";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const near = (a: number, b: number, e = 0.02) => Math.abs(a - b) <= e;

const s = speedsForPace(50);
console.log(`pace 50: walk ${s.walk}  jog ${s.jog}  run ${s.run.toFixed(2)}  sprint ${s.sprint.toFixed(2)} m/s`);

// ── the stick's zones ──
check(stickTarget(0.05, false, s) === 0, "a tiny push stands still");
const w = stickTarget(0.3, false, s), j = stickTarget(0.65, false, s), r = stickTarget(0.88, false, s), f = stickTarget(1, false, s);
console.log(`stick 0.3 → ${w.toFixed(2)}, 0.65 → ${j.toFixed(2)}, 0.88 → ${r.toFixed(2)}, 1.0 → ${f.toFixed(2)} m/s`);
check(w > 0 && w <= s.walk, "a small push walks");
check(j > s.walk && j <= s.jog, "a medium push jogs");
check(r > s.jog && r <= s.run, "a near-full push runs");
check(near(f, s.sprint, 1e-9), "a full push sprints");
check(near(f / stickTarget(STICK.sprint - 0.001, false, s), SPRINT_OVER_RUN, 0.02), "sprint is 1.35× run");
check(near(stickTarget(1, false, s, false), s.run, 1e-9), "out of stamina: a full push runs");
check(near(stickTarget(0.6, true, s), s.sprint, 1e-9), "the sprint button sprints");
// monotonic
let last = -1, mono = true;
for (let m = 0; m <= 1.0001; m += 0.01) { const v = stickTarget(m, false, s); if (v < last - 1e-9) mono = false; last = v; }
check(mono, "more push is never slower");

// ── speed up and slow down ──
{
  let v = 0, t = 0;
  while (v < s.run - 1e-6 && t < 2) { v = approach(v, s.sprint, 0.001, s); t += 0.001; }
  check(near(t, MOVE.upToRun, 0.01), `standing to run in ~0.25 s (${t.toFixed(3)})`);
  let t2 = 0;
  while (v < s.sprint - 1e-6 && t2 < 2) { v = approach(v, s.sprint, 0.001, s); t2 += 0.001; }
  check(t2 > 0.3 && t2 < 0.6, `run to sprint takes a beat (${t2.toFixed(3)})`);
  let t3 = 0;
  while (v > 0 && t3 < 2) { v = approach(v, 0, 0.001, s); t3 += 0.001; }
  check(t3 > 0.25 && t3 < 0.6, `letting go from a sprint stops in a short slow-down (${t3.toFixed(3)})`);
  console.log(`0→run ${t.toFixed(2)} s, run→sprint ${t2.toFixed(2)} s, sprint→stop ${t3.toFixed(2)} s`);
}

// ── gait picking and hysteresis ──
{
  const e = gaitEdges(s);
  check(pickGait("idle", 0, e) === "idle", "still: idle");
  check(pickGait("idle", s.walk, e) === "walk", "walk speed: walk");
  check(pickGait("walk", s.jog, e) === "jog", "jog speed: jog");
  check(pickGait("jog", s.run, e) === "run", "run speed: run");
  check(pickGait("run", s.sprint, e) === "sprint", "sprint speed: sprint");
  // right on an edge he stays in the gait he's in
  check(pickGait("walk", e[1] + 0.1, e) === "walk" && pickGait("jog", e[1] - 0.1, e) === "jog", "a band at the edge (no flicker)");
  check(pickGait("walk", e[1] + 0.3, e) === "jog", "past the band he changes");
}

// ── clip speed matches ground speed ──
check(near(loopRate(6.36, 6.36, 1), 1), "a loop at its own speed plays at 1");
check(near(loopRate(3.2, 6.36, 0.5), 3.2 / 3.18), "body size scales the loop's speed");
check(loopRate(20, 1, 1) <= 1.6 && loopRate(0.01, 3, 1) >= 0.5, "rates kept within limits");

// ── same foot ──
{
  // halfway through the old cycle (from its plant) → halfway through the new one (from its plant)
  const t = sameFootTime(0.2 + 0.5 * 0.7, 0.7, 0.2, 1.0, 0.1);
  check(near(t, 0.6, 1e-9), `same foot: ${t}`);
  check(near(sameFootTime(0.69, 0.7, 0.0, 1.0, 0.95), (0.95 + 0.69 / 0.7) % 1, 1e-9), "wraps round the loop");
}

// ── stamina ──
{
  let st = freshStamina(), t = 0;
  while (canSprint(st) && t < 30) { st = stepStamina(st, "sprint", 0.01); t += 0.01; }
  check(near(t, STAMINA.sprintSeconds, 0.05), `a full bar lasts ~${STAMINA.sprintSeconds} s of sprinting (${t.toFixed(2)})`);
  check(st.tired && st.v === 0, "at empty he is tired");
  // easing off brings it back; sprint again only from 25%
  let t2 = 0;
  while (!canSprint(st) && t2 < 30) { st = stepStamina(st, "easy", 0.01); t2 += 0.01; }
  check(near(st.v, STAMINA.resume, 0.01), `sprint back at ${STAMINA.resume * 100}% (${st.v.toFixed(2)})`);
  let st2 = { v: 0.5, tired: false }, st3 = { v: 0.5, tired: false };
  st2 = stepStamina(st2, "run", 1); st3 = stepStamina(st3, "still", 1);
  check(st2.v > 0.5 && st3.v > st2.v, "running brings it back slowly, standing faster");
  console.log(`stamina: ${t.toFixed(1)} s of sprint, ${t2.toFixed(1)} s jogging to sprint again`);
}

// ── stepHuman: a held full push gets to sprint, a near-full one runs ──
{
  const p = makePlayer({ id: "you", x: 30, y: 30, skills: skillsOf(50), human: true });
  for (let i = 0; i < 120; i++) stepHuman(p, { x: 0, y: -1 }, false, STEP);
  check(near(speedOf(p), s.run, 0.05) || speedOf(p) > s.run, "full push: at least run speed after 1 s");
  for (let i = 0; i < 240; i++) stepHuman(p, { x: 0, y: -1 }, false, STEP);
  check(near(speedOf(p), s.sprint, 0.02) && !!p.sprinting, `full push held: sprinting (${speedOf(p).toFixed(2)})`);
  for (let i = 0; i < 240; i++) stepHuman(p, { x: 0, y: -0.85 }, false, STEP);
  check(near(speedOf(p), stickTarget(0.85, false, s), 0.02) && !p.sprinting, "near-full: runs");
  for (let i = 0; i < 120; i++) stepHuman(p, { x: 0, y: 0 }, false, STEP);
  check(speedOf(p) === 0, "let go: stops");
}

// ── Free Roam: the World drains and refills the bar ──
{
  const { world } = makeFreeRoam({ seed: 7, you: { id: "you", name: "You", skills: skillsOf(70) }, mates: [] });
  world.newFeel = true;
  world.input = { move: { x: 0, y: -1 }, sprint: false };
  for (let i = 0; i < 120 * 2; i++) world.step(STEP);
  const after2 = world.stamina.v;
  check(after2 < 0.8, `two seconds of sprint uses the bar (${after2.toFixed(2)})`);
  world.input = { move: { x: 0, y: 0 }, sprint: false };
  for (let i = 0; i < 120 * 2; i++) world.step(STEP);
  check(world.stamina.v > after2, "standing refills it");
  // the old feel: no stamina
  const { world: old } = makeFreeRoam({ seed: 7, you: { id: "you", name: "You", skills: skillsOf(70) }, mates: [] });
  old.input = { move: { x: 0, y: -1 }, sprint: true };
  for (let i = 0; i < 120 * 2; i++) old.step(STEP);
  check(old.stamina.v === 1, "Motion: Old: the bar is never used");
}

if (problems.length) { console.error("FAIL\n  " + problems.join("\n  ")); process.exit(1); }
console.log("play3dGait: all good");
