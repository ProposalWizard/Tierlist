/**
 * The build-ups before a chance (lib/star/leadInGen.ts), played by the real
 * match through CanvasMatch's `leadIn` prop (Settings → Chances: New only).
 *
 * Measured over 300 served chances of each kind (makeChance, the drawings):
 *   - which chances get one: the listed kinds at their share, every other kind
 *     and every set piece 0%, and 0% of everything with Chances: Old or for a
 *     move carrying on;
 *   - nobody runs faster than 9 m/s (LEAD_MAX_RUN), frame by frame (1/60 s);
 *   - the end: every man, the ball and the camera exactly where the chance has
 *     them (0 m), nobody jumps in the last frame;
 *   - how long it lasts (2-3 s), and how far from the team shape men start;
 *   - extra time a match, from the unseen match's own highlights.
 */
import { makeChance } from "../../lib/star/chanceMaker";
import { mulberry32 } from "../../lib/star/season";
import { EVEN_KINDS, newKindBag, nextEvenKind } from "../../lib/star/kindMix";
import type { ScenarioKind, Scenario } from "../../lib/star/canvasEngine";
import type { Lane, ChancePattern, HiddenMatchInputs } from "../../lib/star/hiddenMatch";
import { leadInEntities, leadInCamera, LEAD_MAX_RUN, type LeadMoment } from "../../lib/star/leadIn";
import { careerBuildUp, buildUpFor, buildUpKeys, wantsBuildUp, BUILD_UP_KINDS, type BuildUp } from "../../lib/star/leadInGen";
import { playRadarMatch, radarSummary } from "../../lib/star/matchRadar";

// The setting, as the page's ?chances=old|new (the lib's own module copy reads
// the same global; a forceChancesMode here would set a second copy under tsx).
const g = globalThis as unknown as { location?: { search: string } };
const forceChancesMode = (v: "old" | "new" | null) => { if (v) g.location = { search: `?chances=${v}` }; else delete g.location; };

let fails = 0;
function check(label: string, ok: boolean, got?: unknown) {
  if (!ok) { fails++; console.log(`FAIL ${label}`, got ?? ""); } else console.log(`ok   ${label}`);
}
const d = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const pct = (a: number, b: number) => `${((100 * a) / Math.max(1, b)).toFixed(1)}%`;

const N = 300;
const KINDS: ScenarioKind[] = [...EVEN_KINDS, "penalty", "free_kick", "corner"];
const laneOf = (x: number): Lane => (x < 21 ? "left" : x > 47 ? "right" : "centre");
const momentFor = (sc: Scenario, i: number): LeadMoment => ({
  opening: false, fresh: true, seed: 5000 + i * 7,
  lane: laneOf(sc.ball.x), pattern: (i % 10 < 3 ? "transition" : "settled") as ChancePattern,
  us: "Arsenal", them: "Chelsea", themStrength: 80,
});

// ── 1. Which chances get one ──
console.log("\nWhich chances get a build-up (Chances: New):");
const built: { sc: Scenario; b: BuildUp; kind: ScenarioKind }[] = [];
for (const kind of KINDS) {
  let got = 0, oldGot = 0, carryOn = 0, opening = 0;
  for (let i = 0; i < N; i++) {
    const sc = makeChance({ source: { from: "kind", kind }, rng: mulberry32(9000 + i * 31 + kind.length) }).sc;
    const m = momentFor(sc, i);
    if (kind === "penalty" || kind === "free_kick" || kind === "corner") m.pattern = "set_piece";
    forceChancesMode("new");
    const b = careerBuildUp(sc, m);
    if (b) { got++; built.push({ sc, b: b as BuildUp, kind }); }
    if (careerBuildUp(sc, { ...m, fresh: false })) carryOn++;
    if (careerBuildUp(sc, { ...m, opening: true })) opening++;
    forceChancesMode("old");
    if (careerBuildUp(sc, m)) oldGot++;
  }
  forceChancesMode(null);
  const want = BUILD_UP_KINDS[kind] ?? 0;
  const set = kind === "penalty" || kind === "free_kick" || kind === "corner";
  const share = got / N;
  console.log(`  ${kind.padEnd(14)} ${pct(got, N).padStart(6)}  (table ${Math.round((set ? 0 : want) * 100)}%)`);
  if (set || want === 0) check(`${kind}: none`, got === 0, got);
  // 26 Oct 2026: a build-up that ends offside in every style is dropped while
  // offside calls are hidden (fhr/builders.ts), about 1 in 300.
  else if (want >= 1) check(`${kind}: every one (bar an all-offside move)`, got >= N * 0.99, got);
  else check(`${kind}: about ${Math.round(want * 100)}% (seeded)`, Math.abs(share - want) < 0.1, share);
  check(`${kind}: none with Chances Old`, oldGot === 0, oldGot);
  check(`${kind}: none for a move carrying on / the opening picture`, carryOn === 0 && opening === 0, { carryOn, opening });
}
// Seeded: the same chance always does the same.
{
  let same = 0;
  for (let i = 0; i < 200; i++) if (wantsBuildUp("long_range", { fresh: true, seed: i }) === wantsBuildUp("long_range", { fresh: true, seed: i })) same++;
  check("long shots: the same chance always decides the same way", same === 200);
}

// ── 2-4. Speed, the end frame, the camera ──
const FRAME = 1 / 60;
let manFrames = 0, fast = 0, worstSpeed = 0, endErr = 0, ballErr = 0, ballZ = 0, camJump = 0, lastJump = 0, camLost = 0;
const durs: { passes: number[]; break: number[] } = { passes: [], break: [] };
const shapeOff: number[] = [];
let extrasTotal = 0, extrasOnScreen = 0, passCount: number[] = [];
for (const { sc, b } of built) {
  const keys = buildUpKeys(sc, b);
  durs[b.kind].push(b.durS);
  passCount.push(b.passStart.length);
  for (const k of keys) {
    let prev = b.posAt(k, 0);
    for (let f = 1; f * FRAME <= b.durS + 1e-9; f++) {
      const p = b.posAt(k, f * FRAME);
      if (!p || !prev) continue;
      const v = d(p, prev) / FRAME;
      manFrames++;
      if (v > LEAD_MAX_RUN) fast++;
      worstSpeed = Math.max(worstSpeed, v);
      prev = p;
    }
  }
  // The end: everyone, the ball, exactly the chance's.
  for (const e of leadInEntities(sc)) {
    const p = b.posAt(e.key, b.durS);
    if (p) endErr = Math.max(endErr, d(p, e.get()));
    const q = b.posAt(e.key, b.durS - FRAME);
    if (p && q) lastJump = Math.max(lastJump, d(p, q));
    const s0 = b.shape.get(e.key);
    if (s0) shapeOff.push(d(s0, b.posAt(e.key, 0)!));
  }
  const be = b.ballAt(b.durS);
  ballErr = Math.max(ballErr, d(be, sc.ball));
  ballZ = Math.max(ballZ, Math.abs(be.z));
  // The camera at the chance start is the chance's own frame.
  const cam = leadInCamera(b, keys);
  for (let t = 0; t <= b.durS + 1e-9; t += 1 / 30) {
    const v = cam.at(Math.min(t, b.durS), sc.viewport), bb = b.ballAt(Math.min(t, b.durS));
    if (bb.x < v.x1 - 0.01 || bb.x > v.x2 + 0.01 || bb.y < v.y1 - 0.01 || bb.y > v.y2 + 0.01) { camLost++; break; }
  }
  const v = cam.at(b.durS, sc.viewport);
  camJump = Math.max(camJump, Math.abs(v.x1 - sc.viewport.x1), Math.abs(v.x2 - sc.viewport.x2), Math.abs(v.y1 - sc.viewport.y1), Math.abs(v.y2 - sc.viewport.y2));
  // Men only in the build-up: are they in the chance's picture when they go?
  for (let i = 0; i < (b.extraMates ?? 0); i++) {
    extrasTotal++;
    const p = b.posAt(`extra${i}`, b.durS)!;
    if (p.x > sc.viewport.x1 && p.x < sc.viewport.x2 && p.y > sc.viewport.y1 && p.y < sc.viewport.y2) extrasOnScreen++;
  }
}
const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const range = (a: number[]) => (a.length ? `${Math.min(...a).toFixed(2)}–${Math.max(...a).toFixed(2)} s` : "-");
console.log(`\nBuild-ups measured: ${built.length}`);
console.log(`  man-frames over ${LEAD_MAX_RUN} m/s: ${fast} of ${manFrames} (${pct(fast, manFrames)}); fastest ${worstSpeed.toFixed(2)} m/s`);
check(`nobody faster than ${LEAD_MAX_RUN} m/s (<2% of man-frames)`, fast / Math.max(1, manFrames) < 0.02, pct(fast, manFrames));
check(`end frame = the drawing: worst man ${endErr.toFixed(6)} m`, endErr < 1e-9, endErr);
check(`end frame = the drawing: ball ${ballErr.toFixed(6)} m, height ${ballZ}`, ballErr < 1e-9 && ballZ === 0, { ballErr, ballZ });
check(`camera jump at chance start: ${camJump.toFixed(6)} m`, camJump < 1e-9, camJump);
check(`nobody jumps in the last frame (worst ${lastJump.toFixed(3)} m)`, lastJump < 0.16, lastJump);
check(`the camera keeps the ball in frame (lost on ${camLost})`, camLost === 0, camLost);
console.log(`  passes: ${durs.passes.length} build-ups, ${range(durs.passes)}, mean ${mean(durs.passes).toFixed(2)} s`);
console.log(`  breaks: ${durs.break.length} build-ups, ${range(durs.break)}, mean ${mean(durs.break).toFixed(2)} s`);
console.log(`  passes per build-up: mean ${mean(passCount).toFixed(2)}`);
check("each lasts 2-3.3 s (2-3 passes, or a long ball and a carry)", [...durs.passes, ...durs.break].every((t) => t >= 1.9 && t <= 3.3), range([...durs.passes, ...durs.break]));
const sorted = [...shapeOff].sort((a, b) => a - b);
console.log(`  start vs team shape: median ${sorted[Math.floor(sorted.length / 2)]?.toFixed(1)} m, ${pct(shapeOff.filter((x) => x < 0.01).length, shapeOff.length)} exactly in shape (the rest pulled in so they can get there)`);
console.log(`  men only in the build-up: ${extrasTotal} (${(extrasTotal / Math.max(1, built.length)).toFixed(2)} a build-up), ${extrasOnScreen} still in the chance's frame when they go`);
check(`men only in the build-up are out of the chance's frame when they go (${pct(extrasOnScreen, extrasTotal)} are not; <3%)`, extrasOnScreen / Math.max(1, extrasTotal) < 0.03, extrasOnScreen);

// ── 5. Extra time a match ──
const inputs: HiddenMatchInputs = { teamStrength: 75, oppStrength: 75, home: true, playerSkill: 70, pace: 70, freeKick: 60, position: "ST" };
let matches = 0, highlights = 0, withBuild = 0, extraS = 0;
const avgDur = mean(built.map((x) => x.b.durS));
for (let s = 0; s < 200; s++) {
  const m = playRadarMatch(10_000 + s, inputs);
  const bag = newKindBag(), rng = mulberry32(77 + s);
  matches++;
  radarSummary(m).highlights.forEach((h, i) => {
    highlights++;
    if (h.dribble) return;
    const set = h.kinds.length === 1 && ["penalty", "free_kick", "corner"].includes(h.kinds[0]);
    const kind = set ? (h.kinds[0] as ScenarioKind) : nextEvenKind(bag, rng);
    if (wantsBuildUp(kind, { fresh: true, seed: s * 100 + i, pattern: set ? "set_piece" : "settled" })) { withBuild++; extraS += avgDur; }
  });
}
console.log(`\nExtra time a match (200 unseen matches, the even mix): ${(highlights / matches).toFixed(1)} chances, ${(withBuild / matches).toFixed(1)} with a build-up, +${(extraS / matches).toFixed(1)} s a match`);

// A direct build-up with no clubs named still works (made-up sides).
{
  const sc = makeChance({ source: { from: "kind", kind: "one_on_one" }, rng: mulberry32(3) }).sc;
  const b = buildUpFor(sc, { opening: false, fresh: true, seed: 1 });
  check("works with no clubs named", b.durS > 0 && d(b.ballAt(b.durS), sc.ball) < 1e-9);
}

console.log(fails ? `\n${fails} FAILED` : "\nall ok");
process.exit(fails ? 1 : 0);
