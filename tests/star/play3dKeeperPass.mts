/**
 * PLAY3D KEEPER AND PASSING (Harry, 9 Oct 2026: "the goalie is infinitely
 * diving … add passing and fix goalie mechanics").
 *
 *   1. No dive without a shot: you sprint at goal with the ball for 4 s
 *      (the old keeper dived 0.46 s in, then every 1.6 s), and a cross in
 *      Headers & Volleys before anyone strikes it.
 *   2. Exactly one dive per shot, none for a shot well wide, and a shot
 *      straight at him is blocked standing up.
 *   3. After a dive he is up and back near his spot inside 2.5 s.
 *   4. Passing: a tap passes to the ringed team-mate (World.aimMate); a tap
 *      naming a team-mate passes to him; passes into a runner's stride are
 *      controlled cleanly; team-mates make runs while you have the ball.
 */
import { CX, GOAL_H, POST_L, POST_R, STEP } from "../../lib/star/play3d/constants";
import { skillsOf, type P3 } from "../../lib/star/play3d/player";
import { makeFreeRoam } from "../../lib/star/play3d/freeRoam";
import { makeHeadersVolleys } from "../../lib/star/play3d/headersVolleys";
import { keeperSpot } from "../../lib/star/play3d/keeper";
import type { World } from "../../lib/star/play3d/world";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const person = (id: string, ov = 70) => ({ id, name: id, skills: skillsOf(ov) });
const roam = (seed: number, keeper = 66) => makeFreeRoam({ seed, you: person("you", 75), mates: [person("a"), person("b")], keeperOverall: keeper });

/** Count fresh dives (the keeper's mode going into "dive") while stepping `secs`; `each` runs every step. */
function stepCounting(w: World, secs: number, each?: () => void) {
  const k = w.keeperOf()!;
  let dives = 0, prev = String(k.mind.mode ?? "set");
  for (let i = 0; i < Math.round(secs / STEP); i++) {
    each?.();
    w.step(STEP);
    const m = String(k.mind.mode ?? "set");
    if (m === "dive" && prev !== "dive") dives++;
    prev = m;
  }
  return dives;
}

// ── 1. No dive without a shot ──
{
  let dives = 0, runs = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const { world: w } = roam(seed);
    w.rules.shouldShoot = () => false; // nobody shoots: mates hold, pass, run
    w.input = { move: { x: 0, y: -1 }, sprint: true };
    dives += stepCounting(w, 4);
    runs++;
  }
  check(dives === 0, `sprinting at goal with the ball, nobody shooting: no dives (${dives} in ${runs} runs)`);
  console.log(`no shot, 60 runs of 4 s sprinting at goal: ${dives} dives (the old keeper: about 3 a run)`);

  let crossDives = 0, crosses = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const r = makeHeadersVolleys({ seed, bot: false, defender: false, keeperOverall: 66, you: person("you"), leftBack: person("lb"), rightBack: person("rb") });
    const w = r.world, k = w.keeperOf()!;
    let prev = "set";
    for (let i = 0; i < 120 * 30 && !r.state.over; i++) {
      w.step(STEP); w.drain();
      const m = String(k.mind.mode ?? "set");
      if (m === "dive" && prev !== "dive") crossDives++;
      prev = m;
    }
    crosses += r.state.log.length;
  }
  check(crossDives === 0, `Headers & Volleys, nobody striking: no dive at a cross (${crossDives} in ${crosses} crosses)`);
}

// ── 2. One dive per shot; none for a wide one; a shot at him is blocked standing ──
{
  let shots = 0, onTarget = 0, dived = 0, twice = 0, wideShots = 0, wideDives = 0, atHim = 0, atHimDives = 0, atHimSaved = 0;
  for (let seed = 1; seed <= 240; seed++) {
    const { world: w } = roam(seed);
    w.rules.shouldShoot = () => false;
    const you = w.you()!;
    const k = w.keeperOf()!;
    // you on the ball 16 m out, the keeper set
    you.x = CX + ((seed % 7) - 3) * 2; you.y = 16; you.vx = you.vy = 0; you.facing = -Math.PI / 2;
    w.placeBall(you.x, you.y - 0.5, you.id);
    for (const m of w.players) if (!m.human && !m.keeper) { m.x = m.x < CX ? 6 : 62; m.y = 30; m.active = false; }
    for (let i = 0; i < 120; i++) w.step(STEP);
    const kind = seed % 3; // 0 a corner, 1 straight at him, 2 well wide
    const aimX = kind === 0 ? (seed % 2 ? POST_R - 0.5 : POST_L + 0.5) : kind === 1 ? k.x : (seed % 2 ? POST_R + 2.5 : POST_L - 2.5);
    w.strike(you, { x: aimX - w.ball.x, y: -w.ball.y }, 0.75, { cx: 0, cy: -0.5 });
    const d = stepCounting(w, 2.2);
    shots++;
    if (d > 1) twice++;
    if (kind === 2) { wideShots++; if (d > 0) wideDives++; }
    else if (kind === 1) { atHim++; if (d > 0) atHimDives++; if (w.log.some((e) => e.kind === "save" || e.kind === "catch")) atHimSaved++; }
    else { onTarget++; if (d > 0) dived++; }
  }
  check(twice === 0, `never two dives for one shot (${twice} of ${shots})`);
  check(wideDives === 0, `no dive for a shot 2.5 m wide (${wideDives} of ${wideShots})`);
  check(dived / onTarget > 0.8, `he dives for a shot at a corner (${dived} of ${onTarget})`);
  check(atHimDives / atHim < 0.2 && atHimSaved / atHim > 0.6, `a shot straight at him: blocked standing (${atHimDives} dives, ${atHimSaved} saved of ${atHim})`);
  console.log(`16 m strikes: corners dived for ${dived}/${onTarget}, at him ${atHimSaved}/${atHim} saved with ${atHimDives} dives, wide ${wideDives}/${wideShots} dives, double dives ${twice}`);
}

// ── 3. After a dive: up and back to his spot inside 2.5 s ──
{
  let n = 0, back = 0, worst = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const { world: w } = roam(seed);
    w.rules.shouldShoot = () => false;
    const you = w.you()!, k = w.keeperOf()!;
    you.x = CX + 4; you.y = 15; you.facing = -Math.PI / 2;
    w.placeBall(you.x, you.y - 0.5, you.id);
    for (const m of w.players) if (!m.human && !m.keeper) m.active = false;
    for (let i = 0; i < 120; i++) w.step(STEP);
    w.strike(you, { x: POST_L + 0.6 - w.ball.x, y: -w.ball.y }, 0.8, { cx: 0, cy: -0.5 });
    let divedAt = -1;
    for (let i = 0; i < 120 * 4; i++) {
      w.step(STEP);
      if (divedAt < 0 && k.mind.mode === "dive") divedAt = w.t;
    }
    if (divedAt < 0) continue;
    n++;
    // put a ball back out in front, as a restart would, then give him 2.5 s from the dive
    const s = keeperSpot(w.ball);
    const d = Math.hypot(k.x - s.x, k.y - s.y);
    worst = Math.max(worst, d);
    if (k.mind.mode === "set" && !k.dive && d < 1.2) back++;
  }
  check(n >= 40 && back / n > 0.9, `after a dive he is up and back near his spot (${back} of ${n}, worst ${worst.toFixed(1)} m)`);
}

// ── 4. Passing ──
{
  // a tap passes to the ringed man; a tap naming the other passes to him
  let ringed = 0, named = 0, n = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const { world: w } = roam(seed);
    w.rules.shouldShoot = () => false;
    for (let i = 0; i < 30; i++) w.step(STEP);
    const ring = w.aimMate;
    if (!ring) continue;
    n++;
    w.act({ kind: "tap" });
    w.step(STEP);
    if (w.passTarget === ring) ringed++;
    const r2 = roam(seed + 1000).world;
    r2.rules.shouldShoot = () => false;
    for (let i = 0; i < 30; i++) r2.step(STEP);
    const other = r2.players.find((p) => !p.human && !p.keeper && p.id !== r2.aimMate)!;
    r2.act({ kind: "tap", to: other.id });
    r2.step(STEP);
    if (r2.passTarget === other.id) named++;
  }
  check(n >= 35 && ringed === n, `a tap passes to the ringed team-mate (${ringed} of ${n})`);
  check(named === n, `a tap on a team-mate passes to him (${named} of ${n})`);

  // into a runner's stride: clean first touches
  let passes = 0, clean = 0;
  for (let seed = 1; seed <= 80; seed++) {
    const { world: w } = roam(seed);
    w.rules.shouldShoot = () => false;
    const mate = w.players.find((p) => p.id === "a") as P3;
    // he is 14 m to your side, running at goal
    mate.x = w.you()!.x - 14; mate.y = w.you()!.y; mate.facing = -Math.PI / 2; mate.vx = 0; mate.vy = -6;
    w.passBall(w.you()!, mate);
    passes++;
    for (let i = 0; i < 120 * 4; i++) {
      w.step(STEP);
      const t = w.log.find((e) => e.kind === "touch" && e.who === "a");
      if (t) { if (t.clean) clean++; break; }
    }
  }
  check(clean / passes > 0.7, `a pass into a runner's stride is controlled cleanly (${clean} of ${passes})`);
  console.log(`passing: ringed ${ringed}/${n}, named ${named}/${n}, a 14 m pass to a man running at goal: ${clean}/${passes} clean`);

  // runs: while you hold the ball, a team-mate goes in behind
  let withRun = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const { world: w } = roam(seed);
    w.rules.shouldShoot = () => false;
    w.input = { move: { x: 0, y: 0 }, sprint: false };
    for (let i = 0; i < 120 * 6; i++) w.step(STEP);
    if (w.log.some((e) => e.kind === "info" && e.text === "run")) withRun++;
  }
  check(withRun >= 27, `holding the ball 6 s, a team-mate makes a run (${withRun} of 30)`);
}

void GOAL_H;
if (problems.length) { console.log(problems.map((p) => "  ✗ " + p).join("\n")); process.exit(1); }
console.log("play3dKeeperPass: all checks pass");
