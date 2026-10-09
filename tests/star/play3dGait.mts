/**
 * WALK → JOG → RUN → SPRINT and the stamina bar (lib/star/three3d/gait.ts),
 * plus stepHuman and Free Roam's stamina in the World (Harry, 9 Oct 2026).
 */
import {
  speedsForPace, stickTarget, approach, pickGait, gaitEdges, loopRate, sameFootTime,
  stepStamina, freshStamina, canSprint, STAMINA, SPRINT_OVER_RUN, STICK, MOVE,
  strideLoop, MAX_LOOP_RATE, staminaFor, kmh,
} from "../../lib/star/three3d/gait";
import { makePlayer, skillsOf, stepHuman, stepMover, speedOf, cruiseSpeed, topSpeed } from "../../lib/star/play3d/player";
import { makeFreeRoam } from "../../lib/star/play3d/freeRoam";
import { STEP, JOG_SPEED, sprintSpeed } from "../../lib/star/play3d/constants";
import { makePaceDrill, idealPaceTime, starsForTime, PACE_COUNTDOWN } from "../../lib/star/play3d/paceDrill";
import { drillById } from "../../lib/star/play3d/drills";
import { levelDifficulty } from "../../lib/star/trainingLevels";

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

// ── pace sets the speeds (Harry, 9 Oct 2026: "feel a sense of improving speed") ──
{
  const lo = speedsForPace(0), hi = speedsForPace(100);
  console.log("pace | walk  jog   run   sprint (m/s) | sprint km/h");
  for (const pc of [0, 25, 40, 50, 60, 75, 85, 100]) {
    const v = speedsForPace(pc);
    console.log(`${String(pc).padStart(4)} | ${v.walk.toFixed(2)}  ${v.jog.toFixed(2)}  ${v.run.toFixed(2)}  ${v.sprint.toFixed(2)} | ${kmh(v.sprint).toFixed(1)}`);
  }
  check(near(lo.run, 4.2, 1e-9) && near(hi.run, 6.0, 1e-9), "run 4.2 → 6.0 m/s across pace 0–100");
  check(near(lo.sprint, 5.6, 1e-9) && near(hi.sprint, 8.2, 1e-9), "sprint 5.6 → 8.2 m/s across pace 0–100");
  check(hi.sprint / lo.sprint > 1.4, `pace 100 sprints over 40% faster than pace 0 (${(hi.sprint / lo.sprint).toFixed(2)}×)`);
  check(near(lo.walk / lo.run, hi.walk / hi.run, 1e-9) && near(lo.jog / lo.run, hi.jog / hi.run, 1e-9), "walk and jog in proportion to the run");
  let ok = true, prev = speedsForPace(0);
  for (let pc = 1; pc <= 100; pc++) {
    const v = speedsForPace(pc);
    if (!(v.walk > prev.walk && v.jog > prev.jog && v.run > prev.run && v.sprint > prev.sprint)) ok = false;
    if (!(v.walk < v.jog && v.jog < v.run && v.run < v.sprint)) ok = false;
    prev = v;
  }
  check(ok, "more pace is faster in every gait, and walk < jog < run < sprint");
  // stepHuman really reaches the new top speeds
  for (const pc of [0, 100]) {
    const p = makePlayer({ id: "you", x: 30, y: 60, skills: skillsOf(50, { pace: pc }), human: true });
    for (let i = 0; i < 360; i++) stepHuman(p, { x: 0, y: -1 }, true, STEP);
    check(near(speedOf(p), speedsForPace(pc).sprint, 0.02), `pace ${pc}: you top out at ${speedsForPace(pc).sprint} (${speedOf(p).toFixed(2)})`);
  }
}

// ── the clip is never played past 1.3×; faster, the longer stride ──
{
  // the mocap loops' own speeds (public/star/anims3d/mocap.glb), capture actor size
  const CLIP: Record<string, number> = { walk: 1.05, jog: 2.88, run: 3.35, sprint: 6.36 };
  const cs = (g: string) => CLIP[g];
  let worst = 0;
  for (let pc = 0; pc <= 100; pc += 5) {
    const v = speedsForPace(pc);
    for (const g of ["walk", "jog", "run", "sprint"] as const) {
      const r = strideLoop(g, v[g], cs, 1);
      worst = Math.max(worst, r.rate);
      if (r.rate > MAX_LOOP_RATE + 1e-9) problems.push(`${g} at pace ${pc} plays at ${r.rate.toFixed(2)}×`);
    }
  }
  const top = strideLoop("sprint", speedsForPace(100).sprint, cs, 1);
  console.log(`clip rates: never above ${worst.toFixed(2)}× (cap ${MAX_LOOP_RATE}); pace-100 sprint ${top.rate.toFixed(2)}× its loop`);
  check(top.loop === "sprint" && top.rate <= MAX_LOOP_RATE && top.rate > 1.25, "pace 100's sprint: the sprint loop, near its cap (feet still match)");
  const fastRun = strideLoop("run", speedsForPace(100).run, cs, 1);
  check(fastRun.loop === "sprint", `a fast run (6.0 m/s) leans on the sprint's longer stride (${fastRun.loop} ${fastRun.rate.toFixed(2)}×)`);
  check(strideLoop("run", speedsForPace(0).run, cs, 1).loop === "run", "a slow run keeps the run loop");
  const walkTop = strideLoop("walk", speedsForPace(100).walk, cs, 1);
  check(walkTop.loop === "walk" && near(walkTop.rate, MAX_LOOP_RATE, 1e-9), "a brisk walk stays a walk, held at the cap (the jog would be too slow)");
}

// ── stamina from the physical stat ──
{
  const last = (physical: number) => {
    let st = freshStamina(), t = 0;
    const fit = staminaFor(physical);
    while (canSprint(st) && t < 30) { st = stepStamina(st, "sprint", 0.01, 1, fit); t += 0.01; }
    let t2 = 0;
    while (!canSprint(st) && t2 < 30) { st = stepStamina(st, "easy", 0.01, 1, fit); t2 += 0.01; }
    return { t, t2 };
  };
  const a = last(0), b = last(50), c = last(100);
  console.log(`stamina by physical: 0 → ${a.t.toFixed(1)} s sprint, ${a.t2.toFixed(1)} s to recover · 50 → ${b.t.toFixed(1)} / ${b.t2.toFixed(1)} · 100 → ${c.t.toFixed(1)} / ${c.t2.toFixed(1)}`);
  check(near(b.t, STAMINA.sprintSeconds, 0.05), "physical 50 is today's 6 s bar");
  check(a.t < b.t && b.t < c.t && near(c.t, 8, 0.05) && near(a.t, 4, 0.05), "a fitter man's bar lasts longer (4 → 8 s)");
  check(a.t2 > b.t2 && b.t2 > c.t2, "and comes back faster");
  // the World uses your physical stat (Free Roam)
  const drain = (physical: number) => {
    const { world } = makeFreeRoam({ seed: 7, you: { id: "you", name: "You", skills: skillsOf(70, { physical }) }, mates: [] });
    world.newFeel = true;
    world.input = { move: { x: 0, y: -1 }, sprint: false };
    for (let i = 0; i < 120 * 3; i++) world.step(STEP);
    return world.stamina.v;
  };
  check(drain(95) > drain(40) + 0.05, `Free Roam: a fit man has more left after 3 s (${drain(95).toFixed(2)} vs ${drain(40).toFixed(2)})`);
}

// ── computer players move on the same rules (new feel) ──
{
  const run = (pace: number, human: boolean, feel: boolean) => {
    const p = makePlayer({ id: human ? "you" : "ai", x: 30, y: 60, skills: skillsOf(60, { pace }), human });
    p.newFeel = feel;
    for (let i = 0; i < 480; i++) (human ? stepHuman(p, { x: 0, y: -1 }, true, STEP) : stepMover(p, { x: 0, y: -1 }, true, STEP));
    return speedOf(p);
  };
  const ai60 = run(60, false, true), you85 = run(85, true, true), ai85 = run(85, false, true);
  console.log(`flat out: 60-pace AI ${ai60.toFixed(2)} m/s, 85-pace AI ${ai85.toFixed(2)}, 85-pace you ${you85.toFixed(2)} (old AI: 60-pace ${run(60, false, false).toFixed(2)})`);
  check(ai60 < you85, "a 60-pace computer player is slower than an 85-pace you");
  check(near(ai85, you85, 0.02), "the same pace is the same top speed, you or the computer");
  check(near(run(60, false, false), sprintSpeed(60), 0.02), "Motion: Old: the computer players keep their old 7–9 m/s");
  const cruiser = makePlayer({ id: "ai", x: 30, y: 60, skills: skillsOf(50) });
  check(near(cruiseSpeed(cruiser), JOG_SPEED, 1e-9), "old feel: 4.2 m/s easy pace");
  cruiser.newFeel = true;
  check(near(cruiseSpeed(cruiser), 4.18, 0.01), `new feel, pace 50: easy pace about the same 4.2 (${cruiseSpeed(cruiser).toFixed(2)})`);
  check(near(topSpeed(cruiser), speedsForPace(50).sprint, 1e-9), "new feel: his flat out is his own sprint");
  // the World hands the feel to everyone
  const { world } = makeFreeRoam({ seed: 3, you: { id: "you", name: "You", skills: skillsOf(85) }, mates: [{ id: "m", name: "Mate", skills: skillsOf(60) }] });
  world.newFeel = true;
  world.step(STEP);
  check(world.players.every((p) => p.newFeel), "the World puts every man on the new feel");
}

// ── the Pace Sprint ──
{
  const sprint = (pace: number, level: number, feel = true, react = 0.05) => {
    const { world, state } = makePaceDrill({ seed: 11, you: { id: "you", name: "You", skills: skillsOf(60, { pace }) }, level });
    world.newFeel = feel;
    for (let i = 0; i < 120 * 16 && !state.over; i++) {
      world.input = world.t > PACE_COUNTDOWN + react ? { move: { x: 0, y: -1 }, sprint: true } : { move: { x: 0, y: 0 }, sprint: false };
      world.step(STEP);
    }
    return state;
  };
  const lv = 10, lp = levelDifficulty(lv);
  const even = sprint(lp, lv), slow = sprint(lp - 10, lv), slower = sprint(lp - 20, lv), crawl = sprint(lp - 35, lv), late = sprint(lp, lv, true, 0.85);
  console.log(`pace sprint, level ${lv} (pace ${lp.toFixed(0)}): at level ${even.time.toFixed(2)} s ${even.stars}★ top ${kmh(even.topSpeed).toFixed(1)} km/h · −10 ${slow.time.toFixed(2)} ${slow.stars}★ · −20 ${slower.caught ? "caught" : slower.stars + "★"} · −35 ${crawl.caught ? "caught" : crawl.stars + "★"} · late start ${late.caught ? "caught" : late.stars + "★"}`);
  check(even.finished && even.stars === 3, "your pace = the level's: 3 stars");
  check(slow.finished && slow.stars === 2, "10 pace short: 2 stars");
  check(crawl.caught && crawl.stars === 0, "far too slow: the defender catches you");
  check(late.caught, "asleep at GO: he catches you");
  const ready = sprint(lp, lv, true, -9);
  check(ready.finished && ready.stars === 3 && near(ready.time, even.time, 0.05), `held ready before GO: off on GO, the same clock (${ready.time.toFixed(2)} s)`);
  check(near(even.time, idealPaceTime(lp, true), 0.05), "the clock runs from your first step");
  const fast = sprint(90, 1), slowMan = sprint(40, 1);
  check(fast.topSpeed > slowMan.topSpeed + 1.2, `top speed grows with pace (${kmh(slowMan.topSpeed).toFixed(1)} → ${kmh(fast.topSpeed).toFixed(1)} km/h)`);
  check(near(fast.topSpeed, speedsForPace(90).sprint, 0.05), "the readout is your real top speed");
  check(sprint(lp, lv, false).finished, "Motion: Old: the drill still runs");
  check(starsForTime(4, 4) === 3 && starsForTime(4.3, 4) === 1 && starsForTime(5, 4) === 0, "stars by time");
  // the drill's result hands the career a pace level and stars
  const d = drillById("pace")!;
  const ses = d.start!({ seed: 2, you: { id: "you", name: "You", skills: skillsOf(60, { pace: lp }) }, mates: [], paceLevel: lv, previewTrain: (t) => t.stars });
  ses.world.newFeel = true;
  for (let i = 0; i < 120 * 16 && !ses.done(); i++) { ses.world.input = ses.world.t > PACE_COUNTDOWN ? { move: { x: 0, y: -1 }, sprint: true } : { move: { x: 0, y: 0 }, sprint: false }; ses.world.step(STEP); }
  const r = ses.result(50, 0.5);
  check(r.train?.skill === "pace" && r.train.level === lv && r.train.stars === 3 && r.gain === 0, `the result trains pace: ${JSON.stringify(r.train)} · ${r.line}`);
  check(/km\/h/.test(ses.hud().small), "the HUD shows Top speed in km/h");
}

if (problems.length) { console.error("FAIL\n  " + problems.join("\n  ")); process.exit(1); }
console.log("play3dGait: all good");
