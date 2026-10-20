/**
 * B2b, point 1 (Harry, 20 Oct 2026): "The highlights need to end on the
 * actual camera we have been using in game, I don't want that to drift as
 * camera has been a problem throughout."
 *
 * Pins that every build-up hands over to its chance with NO camera move:
 *
 *   1. For every kind of chance the rebuild plays a build-up before (open
 *      play, and the foul before a free kick or penalty), on a phone's match
 *      canvas (390×844: 366 × 744 px) and a computer's (1440×900: 384 × 800):
 *      the chance's camera is the match's own (stillCamera.ts's matchStill —
 *      the steps CanvasMatch's frameScenario runs), the build-up is played by
 *      the match's own lead-in camera (leadIn.ts's leadInCamera, the exact
 *      call CanvasMatch makes every frame), and the LAST build-up frame at
 *      60 fps is the chance's FIRST frame: centre ≤ 1 px, size ≤ 0.3%.
 *   2. A build-up that ends in a called offside never locks onto a chance
 *      (there is none): its camera follows to the end.
 *   3. The framing depends on where the men are (so a frame taken while a
 *      build-up has them elsewhere is a different camera) — and CanvasMatch's
 *      resize re-frames the chance on its own spots (frameOnChance), never on
 *      the build-up's. Measured in the browser before the fix: a resize 1 s
 *      into a build-up put the chance 20.5 px off and 38% out of scale
 *      (scripts/fhr/b2b-camera-probe.mjs --resize=1).
 */
import { readFileSync } from "node:fs";
import { forceFhrMode } from "../../lib/star/fhr/toggle";
import { forceChancesMode } from "../../lib/star/newChances";
import { servedChances } from "../../lib/star/fhr/servedChances";
import { matchStill } from "../../lib/star/fhr/stillCamera";
import { fhrBuildUpFor, fhrWantsBuildUp, type FhrBuildUp } from "../../lib/star/fhr/buildUp";
import { fhrFoulBuildUpFor, fhrWantsFoul } from "../../lib/star/fhr/foulBuildUp";
import { leadInCamera, leadInEntities, type LeadIn } from "../../lib/star/leadIn";
import { standBackFor, yourRunupFor, penaltyRunupOf, freeKickRunupOf } from "../../lib/star/runupStyles";
import type { Scenario, Viewport } from "../../lib/star/canvasEngine";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const CANVASES = [{ name: "phone 390×844", w: 366, h: 744 }, { name: "computer 1440×900", w: 384, h: 800 }];
const FPS = 60;

/** The camera on the glass: the frame's middle (px) and its size (px a metre), for a canvas facing `facing`. */
function glass(v: Viewport, cw: number, facing: string) {
  const across = facing === "up" ? v.x2 - v.x1 : v.y2 - v.y1;
  const pxPerM = cw / across;
  return { cx: ((v.x1 + v.x2) / 2) * pxPerM, cy: ((v.y1 + v.y2) / 2) * pxPerM, pxPerM };
}

/** The lead-in played exactly as CanvasMatch plays it: cam.at(t, chance frame) each frame; the last frame before durS. */
function lastFrame(lead: LeadIn, sc: Scenario, chance: Viewport): Viewport {
  const cam = leadInCamera(lead, leadInEntities(sc).map((e) => e.key));
  let t = 0, v = cam.at(0, chance);
  for (;;) {
    const nt = t + 1 / FPS;
    if (nt >= lead.durS) break;
    t = nt;
    v = cam.at(t, chance);
  }
  return v;
}

const worst: Record<string, { px: number; pct: number; n: number }> = {};
forceFhrMode("on"); forceChancesMode("new");
const pool = servedChances({ count: 700, seed: 41 });
const kindsSeen = new Set<string>();
for (const cv of CANVASES) {
  const hw = cv.h / cv.w;
  for (const c of pool) {
    const sc0 = JSON.parse(JSON.stringify(c.sc)) as Scenario;
    const setPiece = sc0.kind === "free_kick" || sc0.kind === "penalty";
    if (setPiece) sc0.player = standBackFor(yourRunupFor(sc0.kind, penaltyRunupOf(undefined), freeKickRunupOf(undefined)), sc0.ball, sc0.player, sc0.viewport);
    // The chance's camera, as the match frames it (and its facing and angle).
    const still = matchStill(sc0, hw, 20);
    const chance = { ...still.frame.camera };
    const facing = still.frame.facing ?? "up";
    const moment = { ...c.moment, fresh: true, frame: chance };
    let lead: LeadIn | null = null;
    if (fhrWantsBuildUp(sc0.kind, moment)) lead = fhrBuildUpFor(sc0, moment);
    else if (fhrWantsFoul(sc0, moment)) lead = fhrFoulBuildUpFor(sc0, moment);
    if (!lead) continue;
    if ((lead as FhrBuildUp).offside) {
      // 2. No chance after a called offside: it never locks.
      const cam = leadInCamera(lead, []);
      check(cam.lockAt(lead.durS, chance) === 0, `${sc0.kind}: a called-offside build-up locks onto a chance`);
      continue;
    }
    const key = `${cv.name} · ${(lead as { foul?: unknown }).foul ? "foul → " : ""}${sc0.kind}`;
    kindsSeen.add(sc0.kind);
    const a = glass(lastFrame(lead, sc0, chance), cv.w, facing), b = glass(chance, cv.w, facing);
    const px = Math.hypot(a.cx - b.cx, a.cy - b.cy), pct = (Math.abs(a.pxPerM - b.pxPerM) / b.pxPerM) * 100;
    const w = (worst[key] ??= { px: 0, pct: 0, n: 0 });
    w.px = Math.max(w.px, px); w.pct = Math.max(w.pct, pct); w.n++;
    check(px <= 1, `${key}: the last build-up frame is ${px.toFixed(2)} px from the chance's camera`);
    check(pct <= 0.3, `${key}: the last build-up frame is ${pct.toFixed(2)}% out of scale`);
    // The angle: the build-up is played in the chance's own facing and tilt (CanvasMatch sets them before it starts).
    check(still.tilt === matchStill(sc0, hw, 20).tilt, `${key}: the chance's angle is not fixed`);
  }
}
for (const k of ["one_on_one", "cutback", "long_range", "tight_angle", "header", "volley", "free_kick", "penalty"]) check(kindsSeen.has(k), `no ${k} build-up was checked`);

// 3. The framing depends on where the men are — so the chance must be framed on its own spots.
{
  const c = pool.find((x) => x.sc.kind === "one_on_one") ?? pool[0];
  const sc = JSON.parse(JSON.stringify(c.sc)) as Scenario;
  const lead = fhrBuildUpFor(sc, { ...c.moment, frame: matchStill(sc, 744 / 366, 20).frame.camera });
  const moved = JSON.parse(JSON.stringify(sc)) as Scenario;
  for (const e of leadInEntities(moved)) { const p = lead.posAt(e.key, lead.durS * 0.3); if (p) e.set(p); }
  const b = lead.ballAt(lead.durS * 0.3); moved.ball.x = b.x; moved.ball.y = b.y;
  const onChance = matchStill(sc, 744 / 366, 20).frame.camera, onBuildUp = matchStill(moved, 744 / 366, 20).frame.camera;
  check(Math.abs(onChance.x1 - onBuildUp.x1) + Math.abs(onChance.y1 - onBuildUp.y1) + Math.abs(onChance.x2 - onBuildUp.x2) > 0.5,
    "framing no longer depends on the men (this check is blind: pick another chance)");
  const cm = readFileSync(new URL("../../components/star/CanvasMatch.tsx", import.meta.url), "utf8");
  const resize = cm.slice(cm.indexOf("// --- Canvas sizing"), cm.indexOf("resize();", cm.indexOf("// --- Canvas sizing")));
  check(/frameOnChance\(\)/.test(resize) && !/frameScenario\(scenarioRef\.current\)/.test(resize), "the resize re-frames on the build-up's men again (it must call frameOnChance)");
  const foc = cm.slice(cm.indexOf("const frameOnChance = "), cm.indexOf("const skipLeadIn = "));
  check(/e\.set\(ends\[i\]\)/.test(foc) && /L\.ball\.x/.test(foc) && /frameScenario\(sc\)/.test(foc) && /e\.set\(now\[i\]\)/.test(foc),
    "frameOnChance no longer frames on the chance's spots and puts everyone back");
}
forceFhrMode(null); forceChancesMode(null);

const rows = Object.entries(worst).sort();
console.log(problems.length ? "fhrCameraHandover (measured):" : `fhrCameraHandover: every build-up ends on its chance's own camera — ${rows.reduce((s, [, w]) => s + w.n, 0)} hand-overs, worst ${Math.max(...rows.map(([, w]) => w.px)).toFixed(3)} px / ${Math.max(...rows.map(([, w]) => w.pct)).toFixed(3)}% (target ≤ 1 px, ≤ 0.3%); called offsides never lock; the resize frames the chance on its own spots — all checks pass`);
for (const [k, w] of rows) console.log(`  ${k.padEnd(44)} n ${String(w.n).padStart(3)}  worst ${w.px.toFixed(3)} px  ${w.pct.toFixed(3)}%`);
if (problems.length) {
  console.log(`FAIL — ${problems.length} problem(s):`);
  for (const p of problems.slice(0, 40)) console.log("  " + p);
  process.exit(1);
}

