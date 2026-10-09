import { buildScenario, goalInView, SCENARIO_KINDS, type Scenario, type Viewport } from "../../lib/star/canvasEngine";
import { POST_L, POST_R } from "../../lib/star/pitch";
import { frameForNewView, setPlayZoomOverride, playZoomOf, bodiesOf } from "../../lib/star/matchView";

/**
 * CHANCE FRAMING: Zoom | Old (lib/star/chanceFraming.ts, Harry 9 Oct 2026).
 *
 * - Old is exactly the camera before it (zoom 1, same rectangle);
 * - Zoom never zooms out, never cuts a man off (centre 0.9 m from a side,
 *   1 m from the top), keeps the goal posts and keeper on screen, and leaves
 *   at least 5 m of grass below the ball to pull back into;
 * - side-on chances (corners, byline crosses) and build-up are untouched;
 * - it holds the canvas's shape (the drag is read in screen px, so the same
 *   pull kicks exactly as hard).
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const HW = 686 / 366;
const frame = (kind: (typeof SCENARIO_KINDS)[number], seed: number, mode: "off" | "z2", tilt: number) => {
  setPlayZoomOverride(mode);
  const sc: Scenario = buildScenario(kind, mulberry32(seed * 7919 + 11));
  const cam = frameForNewView(sc, HW, false, tilt);
  return { sc, cam, k: playZoomOf(sc) };
};
const same = (a: Viewport, b: Viewport) => Math.abs(a.x1 - b.x1) + Math.abs(a.x2 - b.x2) + Math.abs(a.y1 - b.y1) + Math.abs(a.y2 - b.y2) < 1e-9;

const zooms: Record<string, number[]> = {};
for (const kind of SCENARIO_KINDS) for (let seed = 1; seed <= 40; seed++) for (const tilt of [0, 20]) {
  const old = frame(kind, seed, "off", tilt);
  const z = frame(kind, seed, "z2", tilt);
  check(old.k === 1, `${kind} #${seed}: Old has zoom ${old.k}`);
  const facing = z.sc.facing ?? "up";
  if (facing !== "up" || !goalInView(kind)) {
    check(same(old.cam, z.cam) && z.k === 1, `${kind} #${seed}: side-on / build-up was zoomed`);
    continue;
  }
  (zooms[kind] ??= []).push(z.k);
  check(z.k >= 1, `${kind} #${seed}: zoomed OUT (${z.k})`);
  const c = z.cam, w = c.x2 - c.x1, h = c.y2 - c.y1;
  check(Math.abs(h / w - (old.cam.y2 - old.cam.y1) / (old.cam.x2 - old.cam.x1)) < 1e-6, `${kind} #${seed}: shape changed`);
  if (z.k === 1) continue;
  for (const p of bodiesOf(z.sc)) {
    check(p.x >= c.x1 + 0.9 - 1e-6 && p.x <= c.x2 - 0.9 + 1e-6 && p.y >= c.y1 + 1 - 1e-6 && p.y <= c.y2 + 1e-6,
      `${kind} #${seed} tilt ${tilt}: a man at (${p.x.toFixed(1)}, ${p.y.toFixed(1)}) is cut off`);
  }
  for (const p of [{ x: z.sc.keeper.x, y: z.sc.keeper.y }, { x: POST_L, y: 0 }, { x: POST_R, y: 0 }]) {
    check(p.x >= c.x1 && p.x <= c.x2 && p.y >= c.y1, `${kind} #${seed}: goal or keeper cut off`);
  }
  check(c.y2 - z.sc.ball.y >= 5 - 1e-6, `${kind} #${seed}: only ${(c.y2 - z.sc.ball.y).toFixed(1)} m to pull back into`);
}
setPlayZoomOverride(null);

if (problems.length) {
  console.log(`FAIL — ${problems.length} problem(s):`);
  for (const p of problems.slice(0, 20)) console.log("  " + p);
  process.exit(1);
}
console.log("chanceFraming: zoom per kind (mean, max):",
  Object.entries(zooms).map(([k, v]) => `${k} ${(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2)}/${Math.max(...v).toFixed(2)}`).join(", "));
