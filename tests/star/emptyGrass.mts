/**
 * tests/star/emptyGrass.mts — the camera fits the play, not a huge empty pitch.
 *
 * Harry, 11 Oct 2026: "the camera view where it shows a huge area of the
 * pitch where no one's at — yeah that's just bugged". Leo: it happens as a
 * real match chance opens.
 *
 * The cause: a man a chance does not use is parked at (-400, 400), "off the
 * picture" (authoredChance.ts OFF_THE_PICTURE). A drawing with no poacher
 * parks the follower there, and so did EVERY Kane drawing (since deleted with
 * the StatsBomb data). matchView's zoom
 * counted him as a man to keep on screen, could not fit a man 400 m away,
 * and gave up: the kind's widest camera, people in the top quarter.
 *
 * Measured on the phone's glass (390 px, 20° tilt, Zoom on), before → after:
 *   Kane one-on-ones: people cover 11% → 51% of the screen,
 *                     grass below them 66% → 23%
 *   Kane long range:  15% → 58%;   drawn one-on-ones with a parked
 *   poacher: zoom 1.00 → ~1.5.
 *
 *  1. A parked man is not a body to frame (bodiesOf / keyPointsOf).
 *  2. A one-on-one with a parked follower still zooms in.
 *  3. Fully real shots (tracking, data/realmoments): the people fill the
 *     screen. (Was the Kane drawings, deleted with the StatsBomb data.)
 *  4. The extra glass fit (fitToPlay) never cuts anybody off the glass
 *     (Match camera Old); with Match camera New (camera round 3) the action
 *     is never cut off and nobody else is cut in half.
 *  6. Match camera New vs Old: the empty grass below the lowest man on the
 *     glass, per kind, upright, 20°.
 */
import { readFileSync } from "node:fs";
import { buildScenario, goalInView, type Scenario, type Viewport } from "../../lib/star/canvasEngine";
import { POST_L, POST_R } from "../../lib/star/pitch";
import { mulberry32 } from "../../lib/star/season";
import { makeChance } from "../../lib/star/chanceMaker";
import { scenarioForShot, kindForShot, type TrackedFile, type RealShot } from "../../lib/star/realMoments";
import {
  frameForNewView, setPlayZoomOverride, playZoomOf, bodiesOf, keyPointsOf, onThePitch,
  WIDE_TURN_KINDS, turnWideChance, setWideChancesOverride, setActionFit, framingFaults,
} from "../../lib/star/matchView";
import { tiltFor, canvasToScreen, visibleOnScreen } from "../../lib/star/cameraTilt";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };
const HW = 686 / 366;
const TILT = 20;
const PARKED = { x: -400, y: 400 };

/** Share of the glass the people (and the goal) cover, and the empty grass below them. */
function onGlass(sc: Scenario, cam: Viewport) {
  const t = tiltFor(TILT, 1, HW);
  const pts = [...bodiesOf(sc)];
  if (goalInView(sc.kind)) pts.push({ x: sc.keeper.x, y: sc.keeper.y }, { x: POST_L, y: 0 }, { x: POST_R, y: 0 });
  const f = pts.map((p) => {
    const sx = (p.x - cam.x1) / (cam.x2 - cam.x1), sy = (p.y - cam.y1) / (cam.y2 - cam.y1);
    const s = canvasToScreen(t, sx, sy, 1, HW);
    return { x: Math.min(1, Math.max(0, s.X)), y: Math.min(1, Math.max(0, s.Y / HW)) };
  });
  const x1 = Math.min(...f.map((c) => c.x)), x2 = Math.max(...f.map((c) => c.x));
  const y1 = Math.min(...f.map((c) => c.y)), y2 = Math.max(...f.map((c) => c.y));
  return { area: (x2 - x1) * (y2 - y1), below: 1 - y2 };
}

setPlayZoomOverride("z2");

console.log("\n1. A PARKED MAN IS NOT A BODY TO FRAME");
{
  const sc = buildScenario("one_on_one", mulberry32(7));
  sc.follower.x = PARKED.x; sc.follower.y = PARKED.y;
  ok(!onThePitch(PARKED), "(-400, 400) is off the pitch");
  ok(bodiesOf(sc).every(onThePitch), "bodiesOf leaves the parked follower out");
  sc.keeper.x = PARKED.x; sc.keeper.y = PARKED.y;
  ok(keyPointsOf(sc).every(onThePitch), "keyPointsOf leaves a taken-off keeper out");
}

console.log("\n2. A ONE-ON-ONE WITH A PARKED POACHER STILL ZOOMS IN");
{
  let n = 0, zoomed = 0;
  for (let i = 0; i < 60; i++) {
    const sc = buildScenario("one_on_one", mulberry32(100 + i * 31));
    const free = buildScenario("one_on_one", mulberry32(100 + i * 31));
    sc.follower.x = PARKED.x; sc.follower.y = PARKED.y;
    frameForNewView(free, HW, false, TILT);
    frameForNewView(sc, HW, false, TILT);
    n++;
    // The poacher is one man; without him the camera is never wider than with him.
    // (Match camera New may pick a pan 1% different once the man is gone: 2.08 vs 2.09.)
    if (playZoomOf(sc) >= playZoomOf(free) - 0.02 && playZoomOf(sc) > 1.001) zoomed++;
  }
  ok(zoomed === n, `parked poacher: zoomed in ${zoomed}/${n} (old code: 0 — the zoom gave up)`);
}

console.log("\n3. FULLY REAL SHOTS: THE PEOPLE FILL THE SCREEN");
{
  const tracked = (JSON.parse(readFileSync(new URL("../../data/realmoments/tracked.json", import.meta.url), "utf8")) as TrackedFile).moments
    .filter((m): m is RealShot & { what: "shot" } => m.what === "shot");
  for (const kind of ["one_on_one", "long_range", "tight_angle", "volley"] as const) {
    const areas: number[] = [], below: number[] = [];
    for (const s of tracked.filter((q) => kindForShot(q) === kind).slice(0, 60)) {
      const sc = scenarioForShot(s);
      const m = onGlass(sc, frameForNewView(sc, HW, false, TILT));
      areas.push(m.area); below.push(m.below);
    }
    const mean = (a: number[]) => a.reduce((t, x) => t + x, 0) / a.length;
    const thin = areas.filter((a) => a < 0.35).length / areas.length;
    ok(areas.length > 0 && thin <= 0.25 && mean(below) <= 0.4,
      `${kind} (${areas.length} real): people cover under 35% of the screen in ${(thin * 100).toFixed(0)}% (≤ 25%), grass below them ${(mean(below) * 100).toFixed(0)}% (≤ 40%)`);
  }
}

console.log("\n4. THE GLASS FIT CUTS NOBODY OFF");
for (const camMode of ["old", "new"] as const) {
  setActionFit(camMode === "new");
  const t = tiltFor(TILT, 1, HW);
  let cut = 0, n = 0;
  for (const kind of ["one_on_one", "tight_angle", "cutback", "through_ball", "long_range", "free_kick", "penalty"] as const) {
    for (let i = 0; i < 40; i++) {
      const sc = makeChance({ source: { from: "kind", kind }, rng: mulberry32(5000 + i * 7919), memory: null }).sc;
      const cam = frameForNewView(sc, HW, false, TILT);
      if (camMode === "new") {
        n++;
        if (framingFaults(sc, cam, HW, TILT).length) cut++;
        continue;
      }
      if (playZoomOf(sc) <= 1.001) continue;
      n++;
      for (const p of keyPointsOf(sc)) {
        const sx = (p.x - cam.x1) / (cam.x2 - cam.x1), sy = (p.y - cam.y1) / (cam.y2 - cam.y1);
        if (!visibleOnScreen(t, sx, sy, 0)) { cut++; break; }
      }
    }
  }
  ok(n > 100 && cut === 0, camMode === "old"
    ? `Old: zoomed chances with a man, post or keeper off the glass: ${cut} of ${n}`
    : `New: chances with the action off the glass or a man cut in half: ${cut} of ${n}`);
}
setActionFit(null);
console.log("\n5. WIDE CHANCES SIDE-ON (Settings → Look → Wide chances: New)");
// Leo, 11 Oct 2026. Tight angles, cutbacks and penalties: upright, even the
// glass fit left a block of empty grass under the people (150 a kind, 390 px,
// 20°): 58% / 51% / 55% below the lowest man. Side-on, flat, fitted:
// 24% / 24% / 27%, nobody cut off (upright cut a man off in 2–3%).
{
  setWideChancesOverride("new");
  /** Flat, any facing: share below the lowest man, and is everyone on the screen? */
  const turnedOnScreen = (sc: Scenario, cam: Viewport) => {
    const f = sc.facing ?? "up";
    const frac = (p: { x: number; y: number }) => {
      const fx = (p.x - cam.x1) / (cam.x2 - cam.x1), fy = (p.y - cam.y1) / (cam.y2 - cam.y1);
      return f === "right" ? { sx: 1 - fy, sy: fx } : f === "left" ? { sx: fy, sy: 1 - fx } : { sx: fx, sy: fy };
    };
    const pts = [...bodiesOf(sc), { x: sc.keeper.x, y: sc.keeper.y }, { x: POST_L, y: 0 }, { x: POST_R, y: 0 }].map(frac);
    const inside = pts.every((c) => c.sx >= 0 && c.sx <= 1 && c.sy >= 0 && c.sy <= 1);
    return { below: 1 - Math.max(...pts.map((c) => c.sy)), inside, ball: frac(sc.ball) };
  };
  const limits: Record<string, number> = { tight_angle: 0.32, cutback: 0.36, penalty: 0.34 };
  const turnedAtLeast: Record<string, number> = { tight_angle: 0.9, cutback: 0.5, penalty: 0.9 };
  for (const kind of WIDE_TURN_KINDS) {
    const below: number[] = [];
    let turned = 0, cut = 0, n = 0, shrink = 0;
    for (let i = 0; i < 80; i++) {
      const sc = makeChance({ source: { from: "kind", kind }, rng: mulberry32(9000 + i * 7919), memory: null }).sc;
      n++;
      const t = turnWideChance(sc, kind !== "penalty", HW) && (sc.facing === "left" || sc.facing === "right");
      if (t) turned++;
      const cam = frameForNewView(sc, HW, false, t ? 0 : TILT);
      const m = t ? turnedOnScreen(sc, cam) : { ...onGlass(sc, cam), inside: true };
      below.push(m.below);
      if (!m.inside) cut++;
      // The men stay today's size: the figure divisor matches the zoom.
      if (playZoomOf(sc) < 1) shrink++;
    }
    const mean = below.reduce((s, x) => s + x, 0) / below.length;
    // A cutback whose runners come from deep stays upright (side-on would be wider).
    ok(turned >= n * turnedAtLeast[kind], `${kind}: turned side-on ${turned}/${n} (≥ ${(turnedAtLeast[kind] * 100).toFixed(0)}%)`);
    ok(cut === 0, `${kind}: a man, post or keeper off the screen: ${cut} of ${n}`);
    ok(mean <= limits[kind], `${kind}: grass below the lowest man ${(mean * 100).toFixed(0)}% (≤ ${(limits[kind] * 100).toFixed(0)}%; upright ≈ 50–58%)`);
    ok(shrink === 0, `${kind}: never a wider camera than upright: ${shrink}`);
  }
  // Old leaves them upright, and other kinds are never turned.
  setWideChancesOverride("old");
  const old = makeChance({ source: { from: "kind", kind: "tight_angle" }, rng: mulberry32(3), memory: null }).sc;
  ok(!turnWideChance(old) && (old.facing ?? "up") === "up", "Wide chances Old: a tight angle stays upright");
  setWideChancesOverride("new");
  const oneOnOne = makeChance({ source: { from: "kind", kind: "one_on_one" }, rng: mulberry32(3), memory: null }).sc;
  ok(!turnWideChance(oneOnOne) && (oneOnOne.facing ?? "up") === "up", "Wide chances New: a one-on-one stays upright");
  // Turned twice is turned once (a resize re-frames the same chance).
  const twice = makeChance({ source: { from: "kind", kind: "tight_angle" }, rng: mulberry32(4), memory: null }).sc;
  ok(turnWideChance(twice), "a tight angle turns");
  const f1 = twice.facing, p1 = { ...twice.player };
  ok(!turnWideChance(twice) && twice.facing === f1 && twice.player.x === p1.x && twice.player.y === p1.y, "turning an already-turned chance does nothing");
  // Side-on you stand BESIDE the ball on the screen (pitch y), not on it.
  ok(Math.abs(twice.player.y - twice.ball.y) > 1 && Math.abs(twice.player.x - twice.ball.x) < 0.5,
    `side-on you stand beside the ball on the screen (Δx ${(twice.player.x - twice.ball.x).toFixed(2)}, Δy ${(twice.player.y - twice.ball.y).toFixed(2)})`);
  setWideChancesOverride(null);
}

console.log("\n6. MATCH CAMERA NEW vs OLD: EMPTY GRASS BELOW THE LOWEST MAN ON THE GLASS (upright, 20°)");
{
  const t = tiltFor(TILT, 1, HW);
  /** Share of the glass under the lowest man, keeper or post that is on it. */
  const belowOnGlass = (sc: Scenario, cam: Viewport) => {
    const pts = [...bodiesOf(sc)];
    if (goalInView(sc.kind)) pts.push({ x: sc.keeper.x, y: sc.keeper.y }, { x: POST_L, y: 0 }, { x: POST_R, y: 0 });
    let low = 0;
    for (const p of pts) {
      const sx = (p.x - cam.x1) / (cam.x2 - cam.x1), sy = (p.y - cam.y1) / (cam.y2 - cam.y1);
      if (!visibleOnScreen(t, sx, sy, 0)) continue;
      low = Math.max(low, canvasToScreen(t, sx, sy, 1, HW).Y / HW);
    }
    return 1 - low;
  };
  setWideChancesOverride("old");
  const rows: string[] = [];
  let sumOld = 0, sumNew = 0, worse = 0;
  for (const kind of ["one_on_one", "long_range", "cutback", "through_ball", "tight_angle", "free_kick", "penalty", "volley", "midfield_pass", "buildup"] as const) {
    const m = { old: 0, new: 0 };
    const N = 150;
    for (const camMode of ["old", "new"] as const) {
      setActionFit(camMode === "new");
      for (let i = 0; i < N; i++) {
        const sc = makeChance({ source: { from: "kind", kind }, rng: mulberry32(20000 + i * 7919), memory: null }).sc;
        m[camMode] += belowOnGlass(sc, frameForNewView(sc, HW, false, TILT)) / N;
      }
    }
    sumOld += m.old; sumNew += m.new;
    if (m.new > m.old + 0.005) worse++;
    rows.push(`${kind} ${(m.old * 100).toFixed(0)}% → ${(m.new * 100).toFixed(0)}%`);
  }
  setActionFit(null);
  setWideChancesOverride(null);
  console.log("  " + rows.join(", "));
  ok(worse === 0, `New is never emptier than Old on any kind (${worse} worse)`);
  ok(sumNew < sumOld * 0.85, `New cuts the empty grass by at least 15% overall (${(sumOld / 10 * 100).toFixed(0)}% → ${(sumNew / 10 * 100).toFixed(0)}%)`);
}
setPlayZoomOverride(null);

if (failed) { console.error(`\nemptyGrass: ${failed} failed`); process.exit(1); }
console.log("\nemptyGrass: all passed");
