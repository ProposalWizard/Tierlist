/**
 * PERFECT FREE KICKS (Leo, 1 Nov 2026: "maxed out stats, full power, perfect
 * top corner … 100% the keeper saves it"). For served match free kicks and a
 * keeper of a given rating, a 99/99 taker tries every aim × curl × lift at full
 * power; we report the best combos and how often they score, and what beats it.
 *   npx tsx scripts/fk/perfectFk.mts [keeper=88] [kicks=40]
 */
import { initDefenders, stepDefenders, stepKeeper, stepReactions, stepBall, launch, type Outcome, type Scenario, type Ball } from "../../lib/star/canvasEngine";
import { makeChance } from "../../lib/star/chanceMaker";
import { strikeKind, stepKind, type StrikeDecision } from "../../lib/star/kindRules";
import { CX, POST_L, POST_R } from "../../lib/star/pitch";
function mulberry32(a: number) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const KS = Number(process.argv[2] ?? 88), N = Number(process.argv[3] ?? 40), SUB = 1 / 180;
const SK = { power: 99, technique: 99 };
function served(seed: number): Scenario {
  const rng = mulberry32(seed);
  const sc = makeChance({ source: { from: "kind", kind: "free_kick" }, rng, strength: { keeper: KS, team: 80, vision: 80 }, memory: null }).sc;
  initDefenders(sc, rng);
  sc.keeperStrength = KS;
  return sc;
}
function fly(sc: Scenario, ball: Ball, rng: () => number, kd: StrikeDecision | null) {
  let out: Outcome | null = null, crossed: { x: number; z: number } | null = null;
  for (let i = 0; i < 3000 && !out; i++) {
    stepDefenders(sc, SUB, ball.pos, false, ball); stepKeeper(sc, SUB); stepReactions(sc, ball, SUB, rng); stepKind(sc, ball, SUB, kd);
    const py = ball.pos.y;
    out = stepBall(ball, sc, rng, SUB);
    if (!crossed && py > 0 && ball.pos.y <= 0) crossed = { x: ball.pos.x, z: ball.z };
  }
  return { out, crossed };
}
type Cell = { aim: number; pw: number; cx: number; cy: number; goals: number; saves: number; n: number; onTarget: number; topCorner: number };
const cells = new Map<string, Cell>();
const outs: Record<string, number> = {};
for (let s = 0; s < N; s++) {
  const base = served(31000 + s);
  const far = Math.sign(CX - base.ball.x) || 1; // the far post is away from the ball's side
  for (const aimOff of [-2.5, -1.5, -0.8, -0.3, 0.2, 0.6, 1.2]) // aim this far inside the far post (minus = outside it)
   for (const pw of [0.7, 0.85, 1])
    for (const cx of [-0.9, -0.5, 0.5, 0.9])
      for (const cy of [-0.2, 0.1, 0.35, 0.6]) {
        const sc: Scenario = JSON.parse(JSON.stringify(base));
        const rng = mulberry32(s * 977 + 13);
        const tx = far > 0 ? POST_R - aimOff : POST_L + aimOff;
        const ball = launch(sc, { x: tx - sc.ball.x, y: -sc.ball.y }, pw, { cx, cy }, SK, rng);
        const kd = strikeKind(sc, ball, mulberry32(s * 31 + 7), { keeperStrength: KS, power: 99, technique: 99 });
        const { out, crossed } = fly(sc, ball, rng, kd);
        const key = `${aimOff}|${pw}|${cx}|${cy}`;
        const c = cells.get(key) ?? { aim: aimOff, pw, cx, cy, goals: 0, saves: 0, n: 0, onTarget: 0, topCorner: 0 };
        c.n++;
        if (out === "goal") c.goals++;
        if (out === "saved" || out === "caught") c.saves++;
        const onT = crossed && crossed.x > POST_L && crossed.x < POST_R && crossed.z < 2.44;
        if (onT) { c.onTarget++; if (crossed!.z > 1.6 && Math.min(crossed!.x - POST_L, POST_R - crossed!.x) < 1.2) c.topCorner++; }
        cells.set(key, c);
        outs[out ?? "none"] = (outs[out ?? "none"] ?? 0) + 1;
      }
}
const all = [...cells.values()].sort((a, b) => b.goals - a.goals);
console.log(`keeper ${KS}, ${N} free kicks, ${all.length} combos each. All outcomes:`, outs);
console.log("best combos (aim m inside far post | curl | lift): goals / saved / on target / top corner, of", N);
for (const c of all.slice(0, 8)) console.log(`  ${c.aim} | p${c.pw} | ${c.cx} | ${c.cy}:  ${c.goals} goals, ${c.saves} saved, ${c.onTarget} on target, ${c.topCorner} top corner`);
const tc = all.reduce((a, c) => ({ t: a.t + c.topCorner, g: a.g }), { t: 0, g: 0 });
console.log("top-corner kicks overall:", tc.t);
