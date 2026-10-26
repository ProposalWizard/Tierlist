/**
 * THE SHORT OPTION ON A BYLINE CROSS (lib/star/bylineShort.ts, Mikey 26 Oct
 * 2026). Every byline cross, served as the match serves it, has a team-mate
 * 6-10 m from the ball, behind it (never offside), in clear space, on screen;
 * and a soft pass to him, struck at a new player's skills, reaches him.
 */
import {
  initDefenders, stepDefenders, stepKeeper, stepReactions, stepBall, launch,
  type Identity, type Outcome, type Runner,
} from "../../lib/star/canvasEngine";
import { makeChance } from "../../lib/star/chanceMaker";
import { frameForNewView } from "../../lib/star/matchView";
import { SHORT_MIN_M, SHORT_MAX_M, CLEAR_M } from "../../lib/star/bylineShort";

let fails = 0;
const check = (ok: boolean, what: string) => { if (!ok) { fails++; console.log("  ✗", what); } else console.log("  ✓", what); };
function rng32(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const id = (n: string): Identity => ({ id: n, name: n, shortName: n, position: "ST" });
const H = 1 / 180, N = 300;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

let has = 0, inBand = 0, behind = 0, clear = 0, onScreen = 0, passed = 0, reached = 0;
for (let s = 1; s <= N; s++) {
  const rng = rng32(s * 2654435761 + 13);
  const sc = makeChance({ source: { from: "kind", kind: "byline_cross" }, rng, strength: { keeper: 62, team: 60, vision: 40 } }).sc;
  const short: Runner | undefined = [...(sc.runner ? [sc.runner] : []), ...sc.secondaryRunners]
    .find((r) => { const d = dist(r.pos, sc.ball); return d >= SHORT_MIN_M - 0.5 && d <= SHORT_MAX_M + 0.5 && r.pos.y > sc.ball.y; });
  if (!short) continue;
  has++;
  const d = dist(short.pos, sc.ball);
  if (d >= SHORT_MIN_M - 0.5 && d <= SHORT_MAX_M + 0.5) inBand++;
  if (short.pos.y > sc.ball.y) behind++;
  const others = [sc.player, sc.keeper, ...sc.defenders].filter((p) => p !== short.pos);
  if (Math.min(...others.map((o) => dist(o, short.pos))) >= CLEAR_M - 0.6) clear++;
  const cam = frameForNewView(sc, 844 / 390, false, 0);
  const inside = (p: { x: number; y: number }) => p.x >= Math.min(cam.x1, cam.x2) && p.x <= Math.max(cam.x1, cam.x2) && p.y >= Math.min(cam.y1, cam.y2) && p.y <= Math.max(cam.y1, cam.y2);
  if (inside(short.pos)) onScreen++;

  // A soft pass to him, at a new player's Power and Technique (40).
  initDefenders(sc, rng);
  sc.secondaryRunners.forEach((r, i) => { r.who = id(r === short ? "SHORT" : `R${i}`); });
  if (sc.runner) sc.runner.who = id(sc.runner === short ? "SHORT" : "R");
  const dir = { x: short.pos.x - sc.ball.x, y: short.pos.y - sc.ball.y };
  const power = Math.min(0.6, 0.18 + d / 32);
  const ball = launch(sc, dir, power, { cx: 0, cy: -0.25 }, { power: 40, technique: 40 }, rng);
  passed++;
  let out: Outcome | null = null;
  for (let i = 0; i < 180 * 8 && !out; i++) {
    stepDefenders(sc, H, ball.pos, false, ball);
    stepKeeper(sc, H);
    stepReactions(sc, ball, H, rng);
    out = stepBall(ball, sc, rng, H);
    if (sc.receivedBy?.who?.id === "SHORT") break;
  }
  if (sc.receivedBy?.who?.id === "SHORT") reached++;
}
const pct = (n: number, of = N) => `${n}/${of} (${((100 * n) / of).toFixed(0)}%)`;
check(has >= N * 0.98, `a short option on every byline cross: ${pct(has)}`);
check(inBand === has, `6 to 10 m from the ball: ${pct(inBand, has)}`);
check(behind === has, `behind the ball, so never offside: ${pct(behind, has)}`);
check(clear >= has * 0.95, `in clear space (about ${CLEAR_M} m from everybody): ${pct(clear, has)}`);
check(onScreen >= has * 0.98, `on screen: ${pct(onScreen, has)}`);
check(reached >= passed * 0.85, `a soft pass at Power/Technique 40 reaches him: ${pct(reached, passed)}`);

if (fails) { console.log(`FAIL (${fails})`); process.exit(1); }
console.log("PASS — every byline cross has a short option a new player can reach");
