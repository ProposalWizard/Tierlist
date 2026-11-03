/**
 * TOP-CORNER FREE KICKS vs the keeper (Leo, 1 Nov 2026). A 99/99 taker,
 * every aim × power × curl × lift; each kick is flown twice: once with no
 * keeper (where would it cross the line?) and once for real. Of the kicks
 * that would cross INSIDE the goal, by where (top corner / elsewhere), how
 * many does the keeper stop?
 *   npx tsx scripts/fk/cornerFk.mts [keeper=88] [kicks=20]
 */
import { initDefenders, stepDefenders, stepKeeper, stepReactions, stepBall, launch, type Outcome, type Scenario, type Ball } from "../../lib/star/canvasEngine";
import { makeChance } from "../../lib/star/chanceMaker";
import { strikeKind, stepKind, type StrikeDecision } from "../../lib/star/kindRules";
import { CX, POST_L, POST_R } from "../../lib/star/pitch";
import { FREE_KICK, cornerness } from "../../lib/star/kindRules/freeKick";
// FK_TRY='{"topCorner":true,...}': try dials without touching the file.
if (process.env.FK_TRY) Object.assign(FREE_KICK, JSON.parse(process.env.FK_TRY));
function mulberry32(a: number) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const KS = Number(process.argv[2] ?? 88), N = Number(process.argv[3] ?? 20), SUB = 1 / 180;
const SK = { power: Number(process.env.FK_POW ?? 82), technique: 99 };
function served(seed: number): Scenario {
  const rng = mulberry32(seed);
  const sc = makeChance({ source: { from: "kind", kind: "free_kick" }, rng, strength: { keeper: KS, team: 80, vision: 80 }, memory: null }).sc;
  initDefenders(sc, rng);
  sc.keeperStrength = KS;
  return sc;
}
function fly(sc: Scenario, ball: Ball, rng: () => number, kd: StrikeDecision | null) {
  let out: Outcome | null = null, crossed: { x: number; z: number; v: number } | null = null;
  for (let i = 0; i < 3000 && !out; i++) {
    stepDefenders(sc, SUB, ball.pos, false, ball); stepKeeper(sc, SUB); stepReactions(sc, ball, SUB, rng); stepKind(sc, ball, SUB, kd);
    const py = ball.pos.y;
    out = stepBall(ball, sc, rng, SUB);
    if (!crossed && py > 0 && ball.pos.y <= 0) crossed = { x: ball.pos.x, z: ball.z, v: Math.hypot(ball.vel.x, ball.vel.y) };
  }
  return { out, crossed };
}
export type Zone = "postage stamp" | "top corner" | "low corner" | "middle";
const tally: Record<Zone, { n: number; goal: number; saved: number; other: number }> = {
  "postage stamp": { n: 0, goal: 0, saved: 0, other: 0 },
  "top corner": { n: 0, goal: 0, saved: 0, other: 0 }, "low corner": { n: 0, goal: 0, saved: 0, other: 0 }, middle: { n: 0, goal: 0, saved: 0, other: 0 },
};
const fast: number[] = [];
for (let s = 0; s < N; s++) {
  const base = served(31000 + s);
  const far = Math.sign(CX - base.ball.x) || 1;
  for (const aimOff of [-2.5, -1.5, -0.8, -0.3, 0.2, 0.6, 1.2, 2.5])
   for (const pw of [0.7, 0.85, 1])
    for (const cx of [-0.9, -0.5, 0.5, 0.9])
      for (const cy of [-0.2, 0.1, 0.35, 0.6]) {
        const tx = far > 0 ? POST_R - aimOff : POST_L + aimOff;
        const go = (withKeeper: boolean) => {
          // Served afresh (not a copy): a copied picture counts as a drill's free kick, not the match's.
          const sc: Scenario = served(31000 + s);
          if (!withKeeper) { sc.keeper.x = -50; sc.keeper.y = 60; }
          const rng = mulberry32(s * 977 + 13);
          const ball = launch(sc, { x: tx - sc.ball.x, y: -sc.ball.y }, pw, { cx, cy }, SK, rng);
          const kd = strikeKind(sc, ball, mulberry32(s * 31 + 7), { keeperStrength: KS, power: 99, technique: 99 });
          return fly(sc, ball, rng, kd);
        };
        const free = go(false);
        const c = free.crossed;
        if (!c || c.x <= POST_L + 0.11 || c.x >= POST_R - 0.11 || c.z >= 2.33) continue; // would not have gone in anyway
        const edge = Math.min(c.x - POST_L, POST_R - c.x);
        const zone: Zone = edge < 0.7 && c.z > 1.7 ? "postage stamp" : edge < 1.3 && c.z > 1.4 ? "top corner" : edge < 1.3 && c.z < 0.6 ? "low corner" : "middle";
        const real = go(true);
        if (process.env.FK_TRACE && zone === "postage stamp" && !(globalThis as { traced?: number }).traced) {
          (globalThis as { traced?: number }).traced = 1;
          const sc: Scenario = served(31000 + s);
          const rng = mulberry32(s * 977 + 13);
          const ball = launch(sc, { x: tx - sc.ball.x, y: -sc.ball.y }, pw, { cx, cy }, SK, rng);
          const kd = strikeKind(sc, ball, mulberry32(s * 31 + 7), { keeperStrength: KS, power: 99, technique: 99 });
          console.log("TRACE kick", { aimOff, pw, cx, cy }, "crosses at", c, "decision", JSON.stringify(kd), "keeper start", sc.keeper.x.toFixed(2), sc.keeper.y.toFixed(2), "ks", sc.keeperStrength, "reach", sc.keeperReach);
          let out: Outcome | null = null; let t = 0;
          for (let i = 0; i < 3000 && !out; i++) {
            stepDefenders(sc, SUB, ball.pos, false, ball); stepKeeper(sc, SUB); stepReactions(sc, ball, SUB, rng); stepKind(sc, ball, SUB, kd);
            out = stepBall(ball, sc, rng, SUB); t += SUB;
            if (i % 18 === 0 || out) console.log(t.toFixed(2), "ball", ball.pos.x.toFixed(2), ball.pos.y.toFixed(2), "z", ball.z.toFixed(2), "v", Math.hypot(ball.vel.x, ball.vel.y).toFixed(1), "| keeper", sc.keeper.x.toFixed(2), sc.keeper.y.toFixed(2), "scr", !!sc.keeper.scrambling, "adj", !!sc.keeper.adjusting, "tgt", sc.keeper.targetX?.toFixed(2), "saves", sc.keeper.saves, "corner", cornerness(ball).toFixed(2), "reachK", sc.keeperReach?.toFixed(2), out ?? "");
          }
        }
        const t = tally[zone];
        t.n++;
        if (real.out === "goal" || real.out === "rebound") t.goal++;
        else if (real.out === "saved" || real.out === "caught") t.saved++;
        else t.other++;
        if (zone === "top corner") fast.push(c.v);
      }
}
console.log(`keeper ${KS}, ${N} free kicks, 99/99 taker. Kicks that would have gone in, by where:`);
for (const [z, t] of Object.entries(tally)) console.log(`  ${z.padEnd(11)} ${String(t.n).padStart(4)} kicks: ${t.goal} goals (${t.n ? Math.round(100 * t.goal / t.n) : 0}%), ${t.saved} saved, ${t.other} other (wall/post/rebound out)`);
if (fast.length) console.log(`  top-corner kicks reach the line at ${Math.min(...fast).toFixed(1)}–${Math.max(...fast).toFixed(1)} m/s`);
