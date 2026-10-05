/**
 * THE KEEPER IS ONLY HUMAN (lib/star/keeperBrain.ts KEEPER_HUMAN + abilities,
 * lib/star/kindRules/freeKick.ts FREE_KICK_DRILL, lib/star/penaltyKeeper.ts
 * penaltyTrialReach) — Leo, 5 Oct 2026: "Goalies being overpowered and far
 * too good in general … more emphasis on top corner shots going in that
 * goalies cant reach, worse goalies dont move as good or predict as good",
 * keeper VISION ("players between the ball and the goalie blocking the
 * goalies view … should only affect them a little at most"), and the trial's
 * keeper "far too good in free kicks and a bit too good in penalties".
 *
 * Measured on the real engine, in the match's own order: served chance
 * (makeChance) → initDefenders → brainSetup → aim → launch → brainStrike →
 * flight at 1/180 s (stepDefenders, stepKeeper, stepReactions, stepKind,
 * brainStep, stepBall). Same seeds for every A/B.
 *
 * Measured when built (scratch harness, keeper 62 unless said; well-struck
 * shots, taker 75/75, five open-play kinds):
 *   top corners (on target)   50.9 % → 60.2 %   (keeper 90: 25.7 % → 43.3 %)
 *   bottom corners            55.9 % → 49.2 %   (noise: the cut never touches them)
 *   all shots, keeper 40/62/90  30.8/24.3/16.1 % → 35.8/27.7/17.1 %
 *   vision, 0 → 3 bodies on the line (on target)  44.3 % → 46.6 %
 *   trial penalties, reps 1/2/3  61.2/54.8/42.5 % → 63.4/60.2/47.4 %
 *   trial free kicks (sensible taker 55/55)  35.8 % → 47.8 %
 *   the match's own free kicks  unchanged (9.0 % / 19.0 %)
 *
 * Run: npx tsx tests/star/keeperHuman.mts
 */
import * as E from "../../lib/star/canvasEngine";
import { makeChance } from "../../lib/star/chanceMaker";
import { strikeKind, stepKind, freeKickReaction, isMatchFreeKick } from "../../lib/star/kindRules";
import { penaltyReadFor, penaltyTrialReach } from "../../lib/star/penaltyKeeper";
import { mulberry32 } from "../../lib/star/season";
import { CX, POST_L, POST_R, GOAL_H } from "../../lib/star/pitch";
import * as B from "../../lib/star/keeperBrain";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };
const pct = (n: number, d: number) => `${((100 * n) / Math.max(1, d)).toFixed(1)}%`;
const H = 1 / 180;

type Zone = "top" | "bottom" | "other" | "none";
interface Shot { goal: boolean; onTarget: boolean; zone: Zone; rt: number | null }

/** One open-play chance as the match serves and strikes it. `plant` decorative
 *  team-mates (no physics) are stood on the ball → keeper line. */
function shot(kind: E.ScenarioKind, seed: number, ks: number, opts: B.BrainOptions = {}, plant = 0, corner = false): Shot {
  const rng = mulberry32(seed);
  const sc = makeChance({ source: { from: "kind", kind }, rng, strength: { keeper: ks, team: 60, vision: 55 }, memory: null, set: "new" }).sc;
  E.initDefenders(sc, rng);
  for (let i = 0; i < plant; i++) {
    const t = 0.45 + 0.15 * i;
    sc.teammates.push({ x: sc.ball.x + (sc.keeper.x - sc.ball.x) * t, y: sc.ball.y + (sc.keeper.y - sc.ball.y) * t });
  }
  B.brainSetup(sc, (seed ^ 0x4b7e) >>> 0, ks, { openPlay: 0.55, ...opts });
  for (let t = 0; t < 1.5; t += 1 / 60) { E.stepKeeper(sc, 1 / 60); B.brainAim(sc, 1 / 60); }
  const kr = mulberry32((seed ^ 0xa11ce) >>> 0);
  const side = kr() < 0.5 ? -1 : 1;
  const tx = corner ? CX + side * (3.66 - 0.35 - kr() * 0.5) : POST_L + 0.15 + kr() * (POST_R - POST_L - 0.3);
  const cy = -0.9 + kr() * 1.5, power = 0.8 + kr() * 0.15, cx = (kr() - 0.5) * 0.4;
  const dx = tx - sc.ball.x, dy = -sc.ball.y, L = Math.hypot(dx, dy);
  const ball = E.launch(sc, { x: dx / L, y: dy / L }, power, { cx, cy }, { power: 75, technique: 75 }, rng);
  B.brainStrike(sc, ball, (seed ^ 0x6b1e5) >>> 0);
  const dec = strikeKind(sc, ball, mulberry32((seed ^ 0x6b1d) >>> 0), { keeperStrength: ks, power: 75, technique: 75 });
  const k = sc.keeper;
  let out: E.Outcome | null = null, zone: Zone = "none";
  for (let i = 0; i < 180 * 6 && !out; i++) {
    E.stepDefenders(sc, H, ball.pos, false, ball);
    E.stepKeeper(sc, H);
    E.stepReactions(sc, ball, H, rng);
    stepKind(sc, ball, H, dec);
    B.brainStep(sc, ball, H);
    // Where it is about to cross his line, judged the substep before the engine does.
    if (zone === "none" && ball.lastTouch === "attack" && !ball.loose && ball.pos.y > k.y && ball.vel.y < -0.5) {
      const dtc = (ball.pos.y - k.y) / -ball.vel.y;
      if (dtc < 3 * H) {
        const x = ball.pos.x + ball.vel.x * dtc, z = Math.max(0, ball.z + ball.vz * dtc - 4.9 * dtc * dtc), ax = Math.abs(x - CX);
        zone = ax > 3.66 || z > GOAL_H ? "other" : ax >= 2.3 && z >= 1.5 ? "top" : ax >= 2.3 && z < 0.7 ? "bottom" : "other";
      }
    }
    out = E.stepBall(ball, sc, rng, H);
  }
  const goal = out === "goal" || out === "rebound";
  return { goal, onTarget: goal || k.saves > 0, zone, rt: B.brainStateOf(sc)?.rt ?? null };
}

// ─────────────────────────────────────────────────────────────────────────
console.log("\nVISION — who is between the ball and him");
{
  const sc = E.buildScenario("one_on_one", mulberry32(7), 62, 60, 55);
  sc.defenders = []; sc.teammates = []; sc.runner = null; sc.secondaryRunners = [];
  sc.follower = { ...sc.follower, x: -150, y: 300 };
  const from = { x: sc.ball.x, y: sc.ball.y }, k = sc.keeper;
  const at = (t: number, lat = 0) => {
    const vx = k.x - from.x, vy = k.y - from.y, L = Math.hypot(vx, vy);
    return { x: from.x + vx * t + (-vy / L) * lat, y: from.y + vy * t + (vx / L) * lat };
  };
  ok(B.sightlineBlockage(sc, from) === 0, "a clear view: no blockage");
  sc.teammates = [at(0.5)];
  const one = B.sightlineBlockage(sc, from);
  sc.teammates = [at(0.5, 0.5)];
  const offset = B.sightlineBlockage(sc, from);
  sc.teammates = [at(0.85)];
  const nearHim = B.sightlineBlockage(sc, from);
  ok(one > 0 && offset > 0 && offset < one, `one body on the line blocks (${one.toFixed(2)}); half a metre off it, less (${offset.toFixed(2)})`);
  ok(nearHim > one, `a body nearer HIM hides more of the strike (${nearHim.toFixed(2)} > ${one.toFixed(2)})`);
  sc.teammates = [at(0.5, 1.2), at(1.2), at(0.02)];
  ok(B.sightlineBlockage(sc, from) === 0, "a body well off the line, behind him, or on the striker himself does not count");
  sc.teammates = [at(0.3), at(0.5), at(0.7), at(0.9)];
  ok(B.sightlineBlockage(sc, from) === 1, "a crowd is capped at full blockage (1)");
}
{
  // The same shots, with decorative team-mates planted on the line (they have
  // no physics, so only his sight can change). n = 600 per kind per row.
  const rows: Record<number, { g: number; ot: number; og: number; n: number }> = {};
  let rtClear = 0, rtBlocked = 0, rtN = 0, sameOff = 0, offN = 0;
  for (const plant of [0, 3]) {
    const r = { g: 0, ot: 0, og: 0, n: 0 };
    for (const kind of ["one_on_one", "long_range"] as E.ScenarioKind[]) for (let s = 1; s <= 600; s++) {
      const seed = s * 7919 + 77;
      const a = shot(kind, seed, 62, {}, plant);
      r.n++; if (a.goal) r.g++; if (a.onTarget) { r.ot++; if (a.goal) r.og++; }
      if (plant === 3) {
        const c = shot(kind, seed, 62, {}, 0);
        if (a.rt !== null && c.rt !== null) { rtBlocked += a.rt; rtClear += c.rt; rtN++; }
        if (s <= 150) {
          offN++;
          const v = shot(kind, seed, 62, { vision: false }, 3), v0 = shot(kind, seed, 62, { vision: false }, 0);
          if (v.goal === v0.goal && v.onTarget === v0.onTarget && v.rt === v0.rt) sameOff++;
        }
      }
    }
    rows[plant] = r;
  }
  const c0 = rows[0].og / rows[0].ot, c3 = rows[3].og / rows[3].ot;
  console.log(`  on target: 0 bodies ${pct(rows[0].og, rows[0].ot)}, 3 bodies ${pct(rows[3].og, rows[3].ot)}; all shots ${pct(rows[0].g, rows[0].n)} → ${pct(rows[3].g, rows[3].n)}`);
  ok(c3 > c0 && c3 - c0 <= 0.06, `a blocked keeper is a little worse, never a lot (+${((c3 - c0) * 100).toFixed(1)} points on target at full blockage; built at +2.3)`);
  // Less than the full visionLate on average: the bodies are planted on the
  // line to where he was DRAWN, and he walks up to 2.2 m while you aim, so by
  // the strike some of them are no longer between you.
  const late = (rtBlocked - rtClear) / Math.max(1, rtN);
  ok(late > 0.025 && late <= B.KEEPER_HUMAN.visionLate + 0.03, `…he reacts a beat later (+${(late * 1000).toFixed(0)} ms on average)`);
  ok(sameOff === offN, `with vision off the planted bodies change nothing (${sameOff} of ${offN} identical)`);
}

console.log("\nWORSE KEEPERS MOVE AND READ WORSE; THE ELITE END IS WHERE IT WAS");
{
  const a40 = B.abilities(40), a62 = B.abilities(62), a95 = B.abilities(95);
  // The 95 is exactly the keeper before 5 Oct 2026 (the formulas share their top end).
  ok(Math.abs(a95.rt - 0.20) < 1e-9 && Math.abs(a95.readErr - 0.4) < 1e-9 && Math.abs(a95.diveSpeed - 6.2) < 1e-9 && Math.abs(a95.maxTravel - 3.2) < 1e-9 && Math.abs(a95.correction - 0.95) < 1e-9,
    "a 95 reacts, reads and dives exactly as before");
  ok(a40.rt >= 0.33 && a40.readErr >= 1.6 && a40.diveSpeed <= 4.5 && a40.correction <= 0.3,
    `a 40 is slower and reads worse than before (rt ${a40.rt.toFixed(2)} s was 0.30, read error ${a40.readErr.toFixed(2)} m was 1.3, dive ${a40.diveSpeed.toFixed(1)} m/s was 4.8)`);
  ok(a40.rt > a62.rt && a62.rt > a95.rt && a40.readErr > a62.readErr && a62.readErr > a95.readErr, "…and every step up the ratings is better");
  const kinds = ["one_on_one", "long_range", "through_ball"] as E.ScenarioKind[];
  const rate = (ks: number) => { let g = 0, n = 0; for (const kind of kinds) for (let s = 1; s <= 300; s++) { n++; if (shot(kind, s * 7919 + 3, ks).goal) g++; } return g / n; };
  const w = rate(40), m = rate(62), s = rate(90);
  console.log(`  goals, three open-play kinds: 40 ${pct(w, 1)}  62 ${pct(m, 1)}  90 ${pct(s, 1)}`);
  // Built: 43.5 / 33.3 / 18.4 % (before: 36.9 / 28.7 / 16.7 %, a 20-point gap).
  ok(w - s >= 0.21, `a 40 concedes far more than a 90 (${((w - s) * 100).toFixed(1)} points apart; was ~20)`);
  ok(w > m && m > s, "…in rating order");
  ok(m <= 0.37, `an average keeper is beatable, not a sieve (${pct(m, 1)} of all well-struck shots)`);
}

console.log("\nTHE TOP CORNER IS THE ONE HE CAN'T REACH");
{
  const sc = E.buildScenario("one_on_one", mulberry32(3), 62, 60, 55);
  const k = sc.keeper;
  const ballTo = (x: number, z: number): E.Ball => {
    // A ball 0.2 s out, heading for (x, z) at his line.
    const t = 0.2, vy = -25, vz = (z - 0.5 + 4.9 * t * t) / t;
    return { pos: { x: x - 0, y: k.y + 25 * t }, vel: { x: 0, y: vy }, z: 0.5, vz } as unknown as E.Ball;
  };
  const low = B.topCornerReach(sc, ballTo(k.x + 2.8, 0.3), k.x);
  const atHim = B.topCornerReach(sc, ballTo(k.x, 2.2), k.x);
  const corner = B.topCornerReach(sc, ballTo(k.x + 2.8, 2.2), k.x);
  sc.keeperStrength = 40;
  const weak = B.topCornerReach(sc, ballTo(k.x + 2.8, 2.2), k.x);
  sc.keeperStrength = 95;
  const elite = B.topCornerReach(sc, ballTo(k.x + 2.8, 2.2), k.x);
  ok(low === 1 && atHim === 1, "a low ball, or a high one straight at him, keeps all his reach");
  ok(corner < 1, `the top corner cuts it (${(corner * 100).toFixed(0)}% of his reach left)`);
  ok(weak < corner && corner < elite && elite < 1, `a worse keeper loses more of it (40: ${(weak * 100).toFixed(0)}%, 62: ${(corner * 100).toFixed(0)}%, 95: ${(elite * 100).toFixed(0)}%)`);

  // The same well-struck corner shots, with and without the cut (keeper 62).
  const z = { on: { top: [0, 0], bottom: [0, 0] }, off: { top: [0, 0], bottom: [0, 0] } };
  let bottomSame = 0, bottomN = 0;
  for (const kind of ["one_on_one", "long_range", "through_ball", "tight_angle"] as E.ScenarioKind[]) for (let s = 1; s <= 300; s++) {
    const seed = s * 7919 + 101;
    const a = shot(kind, seed, 62, {}, 0, true), b = shot(kind, seed, 62, { topCorner: false }, 0, true);
    for (const [key, r] of [["on", a], ["off", b]] as const) {
      if (!r.onTarget || (r.zone !== "top" && r.zone !== "bottom")) continue;
      z[key][r.zone][1]++; if (r.goal) z[key][r.zone][0]++;
    }
    if (b.zone === "bottom") { bottomN++; if (a.goal === b.goal) bottomSame++; }
  }
  const tOn = z.on.top[0] / z.on.top[1], tOff = z.off.top[0] / z.off.top[1];
  console.log(`  top corners on target: ${pct(z.off.top[0], z.off.top[1])} → ${pct(z.on.top[0], z.on.top[1])} (n ${z.on.top[1]})`);
  ok(tOn - tOff >= 0.05, `top corners go in clearly more often (+${((tOn - tOff) * 100).toFixed(1)} points)`);
  ok(bottomSame === bottomN, `a bottom corner is exactly as it was (${bottomSame} of ${bottomN} the same)`);
}

console.log("\nTHE TRIAL'S SET PIECES");
{
  // Free kicks: the match's own (set up by the rules) keep their keeper; a
  // drill's own picture (the trial builds its own wall and keeper) gets the
  // slower one.
  const rng = mulberry32(11);
  const served = makeChance({ source: { from: "kind", kind: "free_kick" }, rng, strength: { keeper: 62, team: 60, vision: 55 }, memory: null, set: "new" }).sc;
  const own = E.buildScenario("free_kick", mulberry32(12), 90, 60, 55);
  ok(isMatchFreeKick(served) && !isMatchFreeKick(own), "the match's free kick is the match's; a drill's own picture is a drill's");
  let slower = 0;
  for (const ks of [45, 62, 80, 95]) for (const d of [0, 0.5, 0.99]) if (freeKickReaction(d, ks, true) > freeKickReaction(d, ks)) slower++;
  ok(slower === 12, "a drill's keeper is slower to react to a free kick than the match's, at every rating");
  ok(freeKickReaction(0, 95) === freeKickReaction(0, 95, false), "…and the match's keeper reacts exactly as before");
  // Penalties: a committed trial keeper no longer keeps his full reach.
  const t = penaltyReadFor(88, { commitChance: 0.95, readChance: 0.75, metres: 1.65 });
  ok(t.reach === penaltyTrialReach(88) && t.reach < penaltyTrialReach(45) && penaltyTrialReach(45) < 1 && t.reach > 0.3,
    `a diving trial keeper keeps ${(penaltyTrialReach(45) * 100).toFixed(0)}% (45) to ${(t.reach! * 100).toFixed(0)}% (88) of his reach (was 100%; the real match keeps 30%)`);
  ok(penaltyReadFor(62).reach === 0.3, "the real match's penalty keeper is unchanged");
}

if (failed) { console.error(`\n${failed} FAILED`); process.exit(1); }
console.log("\nall passed");
