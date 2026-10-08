/**
 * PLAY3D — the shared 3D engine (lib/star/play3d). Ball physics sanity, the
 * kick matching the 2D match's maths, dribbling, the two-touch rules, AI
 * rally length against overall, a free-roam session run headless, and the
 * multi-man pieces Wembley will need (50-50s, tackles, keeper throws,
 * removing a man).
 */
import { BALL_R, CX, GOAL_H, POST_L, POST_R, G, GROUND_FRICTION, STEP } from "../../lib/star/play3d/constants";
import { newBall, stepBall3d, GOAL, type Ball3 } from "../../lib/star/play3d/ball";
import { makePlayer, skillsOf, stepMover } from "../../lib/star/play3d/player";
import { dribbleTouch, strikeBall, juggleWindow, tackleChance } from "../../lib/star/play3d/actions";
import { makeRng } from "../../lib/star/play3d/rng";
import { World, type Rules } from "../../lib/star/play3d/world";
import { makeTwoTouch, TWO_TOUCH_RALLIES } from "../../lib/star/play3d/twoTouch";
import { makeFreeRoam, freeRoamScore, FREE_ROAM_SECONDS } from "../../lib/star/play3d/freeRoam";
import { DRILLS, pickRandomDrill, drillById } from "../../lib/star/play3d/drills";
import { buildScenario, launch } from "../../lib/star/canvasEngine";
import { mulberry32 } from "../../lib/star/season";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const finite = (b: Ball3) => [b.x, b.y, b.z, b.vx, b.vy, b.vz].every(Number.isFinite);

// ── 1. A dropped ball: each bounce lower than the last, then it sits ──
{
  const b = newBall(34, 30, 3);
  const apexes: number[] = [];
  let top = b.z, rising = false;
  for (let i = 0; i < 20 * 120; i++) {
    stepBall3d(b, STEP, null);
    if (b.vz > 0) { rising = true; top = Math.max(top, b.z); }
    else if (rising) { apexes.push(top); rising = false; top = 0; }
  }
  check(apexes.length >= 3, `a dropped ball bounces a few times (${apexes.length})`);
  for (let i = 1; i < apexes.length; i++) check(apexes[i] < apexes[i - 1], `bounce ${i} lower than ${i - 1}`);
  check(Math.abs(b.z - BALL_R) < 1e-6 && b.vz === 0, "and comes to rest on the grass");
  console.log(`drop from 3 m: bounce heights ${apexes.slice(0, 5).map((a) => a.toFixed(2)).join(", ")} m`);
}

// ── 2. A rolling ball stops where friction says ──
{
  const b = newBall(34, 50);
  b.vy = -8;
  let t = 0;
  while ((b.vx || b.vy) && t < 20) { stepBall3d(b, STEP, null); t += STEP; }
  const want = 64 / (2 * GROUND_FRICTION);
  const got = 50 - b.y;
  check(t < 20, "a rolling ball stops");
  check(Math.abs(got - want) / want < 0.03, `rolls v²/2f (${got.toFixed(2)} vs ${want.toFixed(2)} m)`);
  console.log(`roll at 8 m/s: stops after ${got.toFixed(2)} m (friction maths ${want.toFixed(2)} m), ${t.toFixed(2)} s`);
}

// ── 3. The kick: same power, contact and skills → the 2D match's own launch() ──
{
  let worst = 0;
  for (const [power, cx, cy, ps, tech] of [[0.9, 0, 0, 70, 60], [0.5, 0.4, 0.6, 55, 80], [1, -1, -0.5, 95, 40], [0.25, 0, 1, 40, 99]] as const) {
    const sc = buildScenario("long_range", mulberry32(3), 62, 60, 55);
    sc.defenders = [];
    const b2 = launch(sc, { x: CX - sc.ball.x, y: -sc.ball.y }, power, { cx, cy }, { power: ps, technique: tech }, mulberry32(9));
    const b3 = newBall(sc.ball.x, sc.ball.y);
    strikeBall(b3, makePlayer({ id: "you", x: 0, y: 0, skills: skillsOf(60, { power: ps, technique: tech }) }), { x: CX - sc.ball.x, y: -sc.ball.y }, power, { cx, cy }, makeRng(9));
    const s2 = Math.hypot(b2.vel.x, b2.vel.y), s3 = Math.hypot(b3.vx, b3.vy);
    const e = Math.max(Math.abs(s3 - s2) / s2, Math.abs(b3.vz - b2.vz) / Math.max(0.1, b2.vz), Math.abs(b3.spin - b2.spin));
    worst = Math.max(worst, e);
  }
  check(worst < 0.01, `3D kick speed matches the 2D launch() within 1% (worst ${(worst * 100).toFixed(3)}%)`);
  console.log(`kick vs 2D launch(): worst difference ${(worst * 100).toFixed(4)}% over 4 strikes (speed, lift, spin)`);
}

// ── 4. A strike off the bar comes back out; one under it is a goal ──
{
  const hitBar = newBall(CX, 6); hitBar.z = GOAL_H; hitBar.vy = -20; hitBar.vz = 0.5 * G * (6 / 20);
  let ev: string[] = [];
  for (let i = 0; i < 240; i++) ev.push(...stepBall3d(hitBar, STEP, GOAL).map((e) => e.kind));
  check(ev.includes("bar") && hitBar.vy > 0, "a ball at bar height comes back off the bar");
  const inside = newBall(CX, 6); inside.z = 1; inside.vy = -18; inside.vz = 0.5 * G * (6 / 18);
  ev = [];
  for (let i = 0; i < 360; i++) ev.push(...stepBall3d(inside, STEP, GOAL).map((e) => e.kind));
  check(ev.includes("goal") && inside.inNet && inside.y < 0 && inside.y > -2, "under the bar is a goal and the net holds it");
  const post = newBall(POST_R, 6); post.z = 1; post.vy = -18; post.vz = 0.5 * G * (6 / 18);
  ev = [];
  for (let i = 0; i < 240; i++) ev.push(...stepBall3d(post, STEP, GOAL).map((e) => e.kind));
  check(ev.includes("post") && !ev.includes("goal"), "a ball at the post hits the post");
  void POST_L;
}

// ── 5. Dribbling: a jog keeps it, a flat-out-and-beyond touch loses it ──
{
  const rng = makeRng(4);
  const lost = (speed: number, drib: number) => {
    let n = 0;
    for (let i = 0; i < 400; i++) {
      const p = makePlayer({ id: "d", x: 34, y: 30, skills: skillsOf(60, { dribbling: drib }) });
      p.facing = -Math.PI / 2; p.vy = -speed;
      if (dribbleTouch(newBall(34, 29.6), p, { x: 0, y: -1 }, rng).lost) n++;
    }
    return n / 400;
  };
  const jog = lost(4.2, 60), sprint = lost(8.5, 60), tooFast = lost(13, 60), tooFastGood = lost(13, 95);
  check(jog < 0.01, `a jog never loses it (${jog})`);
  check(tooFast > 0.8, `too fast (13 m/s) loses it most touches (${tooFast})`);
  check(tooFastGood < tooFast, "a better dribbler loses it less");
  console.log(`dribble touches lost — jog 4.2 m/s: ${(jog * 100).toFixed(1)}%, sprint 8.5: ${(sprint * 100).toFixed(1)}%, 13 m/s: ${(tooFast * 100).toFixed(1)}% (dribbling 60), ${(tooFastGood * 100).toFixed(1)}% (dribbling 95)`);
}

// ── 6. Two touch: the rules ──
{
  const you = { id: "you", name: "You", skills: skillsOf(75) };
  const mate = { id: "mate", name: "Mate", skills: skillsOf(75) };
  // a perfect first touch, a perfect second → over to him; a third → rally over
  const { world: w, state } = makeTwoTouch({ seed: 1, you, mate });
  const waitDrop = () => { for (let i = 0; i < 1200 && !(w.ball.vz < 0 && w.ball.z < 0.72); i++) w.step(STEP); };
  waitDrop();
  w.act({ kind: "tap" }); w.step(STEP);
  check(state.touches === 1 && state.receiver === "you", "first tap: controlled, still yours");
  waitDrop();
  w.act({ kind: "tap" }); w.step(STEP);
  check(state.rally === 1 && state.receiver === "mate", "second tap: sent over, the rally is 1");
  // a third touch: force one on a fresh world
  const t2 = makeTwoTouch({ seed: 2, you, mate });
  const w2 = t2.world;
  const wd = () => { for (let i = 0; i < 1200 && !(w2.ball.vz < 0 && w2.ball.z < 0.72); i++) w2.step(STEP); };
  wd(); w2.act({ kind: "tap" }); w2.step(STEP);
  // make his second go fall back to himself: control again instead of passing
  t2.state.touches = 2;
  wd(); w2.act({ kind: "tap" }); w2.step(STEP);
  check(t2.state.rallies[0] === 0 && t2.state.last === "Third touch", `a third touch ends the rally (${t2.state.last})`);
  // a tap far too early does nothing
  const t3 = makeTwoTouch({ seed: 3, you, mate });
  t3.world.act({ kind: "tap" }); t3.world.step(STEP);
  check(t3.state.touches === 0, "a tap while the ball is still going up is ignored");
  check(juggleWindow(90) > juggleWindow(50), "better technique, wider timing window");
}

// ── 7. AI rally length grows with overall (200 seeded rallies each) ──
{
  const rally = (ov: number) => {
    const lens: number[] = [];
    for (let s = 1; lens.length < 200; s++) {
      const { world, state } = makeTwoTouch({ seed: 1000 + s, you: { id: "you", name: "Bot", skills: skillsOf(75) }, mate: { id: "mate", name: "Mate", skills: skillsOf(ov) }, autoYou: true });
      for (let i = 0; i < 120 * 600 && !state.over; i++) world.step(STEP);
      lens.push(...state.rallies);
      check([world.ball].every(finite), "two-touch ball stays finite");
    }
    const l = lens.slice(0, 200);
    return { mean: l.reduce((a, b) => a + b, 0) / l.length, max: Math.max(...l) };
  };
  const lo = rally(55), hi = rally(85);
  check(hi.mean > lo.mean * 1.3, `rally length grows with his overall (${lo.mean.toFixed(2)} → ${hi.mean.toFixed(2)})`);
  console.log(`two-touch, 200 rallies each (you a 75 bot): mate 55 → mean ${lo.mean.toFixed(2)} passes (longest ${lo.max}); mate 85 → mean ${hi.mean.toFixed(2)} (longest ${hi.max}); ${TWO_TOUCH_RALLIES} rallies a session`);
}

// ── 8. Free roam: two minutes headless, nothing NaN, things happen ──
{
  const { world, state } = makeFreeRoam({
    seed: 5,
    you: { id: "you", name: "You", skills: skillsOf(70) },
    mates: [{ id: "m1", name: "A", skills: skillsOf(72) }, { id: "m2", name: "B", skills: skillsOf(68) }],
  });
  const rng = makeRng(11);
  let bad = 0;
  for (let i = 0; i < (FREE_ROAM_SECONDS + 5) * 120 && !state.over; i++) {
    // a crude "you": run at the ball, then at goal, shoot inside 20 m, pass now and then
    const you = world.you()!;
    const b = world.ball;
    if (world.owner === you.id) {
      world.input = { move: { x: (CX - you.x) / 20, y: -1 }, sprint: true };
      if (Math.hypot(b.x - CX, b.y) < 20 && rng() < 0.02) world.act({ kind: "shoot", dir: { x: CX - b.x + (rng() - 0.5) * 6, y: -b.y }, pull: 0.06 + rng() * 0.04 });
      else if (rng() < 0.006) world.act({ kind: "tap" });
    } else {
      const d = Math.hypot(b.x - you.x, b.y - you.y) || 1;
      world.input = { move: { x: (b.x - you.x) / d, y: (b.y - you.y) / d }, sprint: d > 4 };
      if (rng() < 0.004) world.act({ kind: "tap" });
    }
    world.step(STEP);
    if (!finite(world.ball) || world.players.some((p) => !Number.isFinite(p.x + p.y + p.vx + p.vy + p.facing))) bad++;
  }
  check(state.over, "the session ends at two minutes");
  check(bad === 0, `nothing goes NaN (${bad} bad steps)`);
  const kinds = new Set(world.log.map((e) => e.kind));
  check(kinds.has("pass") && kinds.has("shot"), "passes and shots happen");
  console.log(`free roam 2 min headless (a crude bot): ${state.goals} goals, ${state.cleanPasses} clean passes, ${state.shots} shots, score ${freeRoamScore(state)}; events seen: ${[...kinds].sort().join(" ")}`);
}

// ── 9. The pieces Wembley needs: many men on one loose ball, tackles, keeper throws, removing a man ──
{
  const rules: Rules = { id: "ffa", finished: () => false };
  const men = Array.from({ length: 6 }, (_, i) => makePlayer({ id: `p${i}`, team: i, x: 20 + i * 5, y: 26, skills: skillsOf(60 + i * 5), mind: { brain: "striker" } }));
  const keeper = makePlayer({ id: "k", team: 99, keeper: true, x: CX, y: 1, facing: Math.PI / 2, skills: skillsOf(70) });
  const w = new World({ seed: 8, players: [...men, keeper], rules });
  w.owner = "k"; w.heldSince = 0;
  let throws = 0, fifties = 0, tackles = 0, goals = 0, shots = 0;
  for (let i = 0; i < 120 * 120; i++) {
    w.step(STEP);
    for (const e of w.drain()) {
      if (e.kind === "throw") throws++;
      if (e.kind === "fifty") fifties++;
      if (e.kind === "tackle-won") tackles++;
      if (e.kind === "shot") shots++;
      if (e.kind === "goal") { goals++; w.remove(e.who ?? ""); w.placeBall(CX, 1, "k"); w.heldSince = w.t; }
      if (e.kind === "out" || e.kind === "byline") { w.placeBall(CX, 1, "k"); w.heldSince = w.t; }
    }
    if (!finite(w.ball)) { check(false, "FFA ball NaN"); break; }
  }
  check(throws > 0, "the keeper throws it out");
  // a tackle, set up: a striker running with it, a man right on him
  let won = 0, tries = 0;
  for (let s = 1; s <= 200; s++) {
    const a = makePlayer({ id: "a", team: 0, x: CX, y: 25, skills: skillsOf(65), mind: { brain: "striker" } });
    const d = makePlayer({ id: "d", team: 1, x: CX + 0.6, y: 24.2, skills: skillsOf(70), mind: { brain: "striker" } });
    const tw = new World({ seed: s, players: [a, d], rules, goal: null });
    tw.placeBall(CX, 24.6, "a");
    for (let i = 0; i < 120 * 2 && tw.owner === "a"; i++) {
      tw.step(STEP);
      for (const e of tw.drain()) { if (e.kind === "tackle-won") { won++; tries++; } if (e.kind === "tackle-lost") tries++; }
    }
  }
  tackles += won;
  check(tries > 150 && won > 40, `a man on the dribbler tackles (${won} won of ${tries} tries in 200 runs)`);
  // a 50-50: two men arriving together at a rolling ball
  let fifty = 0;
  const wins: Record<string, number> = { strong: 0, weak: 0 };
  for (let s = 1; s <= 300; s++) {
    const a = makePlayer({ id: "strong", team: 0, x: CX - 3, y: 20, facing: 0, skills: skillsOf(90), mind: { brain: "striker" } });
    const c = makePlayer({ id: "weak", team: 1, x: CX + 3, y: 20, facing: Math.PI, skills: skillsOf(50, { pace: 90 }), mind: { brain: "striker" } });
    const fw = new World({ seed: s, players: [a, c], rules, goal: null });
    fw.placeBall(CX, 14);
    fw.ball.vy = 4.8;
    for (let i = 0; i < 120 * 3 && !fw.owner; i++) {
      fw.step(STEP);
      for (const e of fw.drain()) if (e.kind === "fifty") { fifty++; wins[e.who as string]++; }
    }
  }
  fifties += fifty;
  check(fifty > 30, `two men arriving together make a 50-50 (${fifty} of 300)`);
  check(wins.strong > wins.weak, `the stronger man wins more 50-50s (${wins.strong} vs ${wins.weak})`);
  console.log(`tackle set-up: ${won} won of ${tries} tries; 50-50s: ${fifty} of 300 (90 wins ${wins.strong}, 50 wins ${wins.weak})`);
  check(shots > 0, "the AI shoots");
  check(w.players.filter((p) => !p.active).length === goals, "a scorer is taken off and stays off");
  check(tackleChance(skillsMan(90), skillsMan(50)) > tackleChance(skillsMan(50), skillsMan(90)), "a good defender wins more tackles");
  console.log(`free-for-all, 6 strikers, 2 min: ${throws} throws, ${fifties} 50-50s, ${tackles} tackles won, ${shots} shots, ${goals} goals (scorers taken off)`);
}
function skillsMan(ov: number) { return makePlayer({ id: "x", x: 0, y: 0, skills: skillsOf(ov) }); }

// ── 10. The drill list ──
{
  check(DRILLS.some((d) => d.id === "crossbar" && d.status === "ready"), "Crossbar Challenge is a drill");
  check(drillById("headers-volleys")?.status === "soon" && drillById("wembley")?.status === "soon", "the two next ones are listed as coming");
  const seen = new Set<string>();
  for (let s = 1; s < 200; s++) seen.add(pickRandomDrill(makeRng(s)).id);
  check([...seen].every((id) => drillById(id)?.status === "ready") && seen.size === DRILLS.filter((d) => d.status === "ready").length, "random only picks ready drills, all of them");
}

// keep stepMover in use for the type-check of the shape
void stepMover;

if (problems.length) { console.error(problems.map((p) => "  ✗ " + p).join("\n")); process.exit(1); }
console.log("play3d: all checks pass");
