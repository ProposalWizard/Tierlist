/**
 * tests/star/chanceMaker.mts — how a chance is served (v0.15 A2).
 *
 *  1. The drawing is the team, for every drawn kind: the served chance has
 *     exactly the drawing's defenders and team-mates, nobody dropped, nobody
 *     added (free kicks excepted: Harry's own wall rule sizes the wall).
 *     Before: a served cutback was missing a drawn defender 77% of the time.
 *  2. The keeper stands at the depth his drawing gives — no 1.6 m / 0.3 m
 *     floor and no "1.5 m goal-side of the ball" cap.
 *  3. A penalty and a free kick are served exactly as drawn (no open-play
 *     nudge). Before: the ball moved off the spot on 100% of penalties.
 *  4. Nobody starts on top of anybody: every two figures, either side, at
 *     least 1.2 m apart (a free kick's wall excepted). Before, 400 a kind:
 *     through balls had two of your men within 0.6 m 75 times.
 *  5. A one-on-one is only offered on a break.
 *  6. Extra drawn team-mates are real support runners you can pass to.
 *  7. The free-kick rules leave your team-mate where he was drawn.
 */
import { buildScenario, SCENARIO_KINDS, type ScenarioKind } from "@/lib/star/canvasEngine";
import { mulberry32 } from "@/lib/star/season";
import {
  makeChance, drawingShape, servesDrawings, PictureMemory, pictureOf, SAME_PICTURE_M, PICTURE_MEMORY,
} from "@/lib/star/chanceMaker";
import { authoredPool, applyAuthoredShape, keeperSharesOf, mateBodiesOf } from "@/lib/star/authoredChance";
import { sampleFromAuthored } from "@/lib/star/scenarioRules";
import { closestFigures, MIN_GAP } from "@/lib/star/spacing";
import { setupKind } from "@/lib/star/kindRules";
import { isSwitchedOff } from "@/lib/star/switchedOffKinds";
import { PITCH_W } from "@/lib/star/pitch";
import type { ScenarioRequest } from "@/lib/star/hiddenMatch";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };
const parked = (p: { x: number; y: number }) => p.x < -50 || p.x > PITCH_W + 50 || p.y > 150 || p.y < -50;
const hyp = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

const DRAWN = (SCENARIO_KINDS as ScenarioKind[]).filter((k) => servesDrawings(k) && !isSwitchedOff(k));

console.log("\n1. THE DRAWING IS THE TEAM");
for (const kind of DRAWN) {
  if (kind === "free_kick") continue; // Harry's wall rule sizes the wall by angle
  let n = 0, wrongD = 0, wrongM = 0;
  for (let i = 0; i < 120; i++) {
    const made = makeChance({ source: { from: "kind", kind }, rng: mulberry32(100 + i * 7919), memory: null });
    if (!made.shape) continue;
    n++;
    const mates = mateBodiesOf(made.sc).filter((p) => !parked(p)).length;
    if (made.sc.defenders.length !== made.shape.defenders.length) wrongD++;
    if (mates !== made.shape.mates.length) wrongM++;
  }
  ok(n > 100 && wrongD === 0 && wrongM === 0, `${kind}: drawn defenders and team-mates, exactly (${n} served; wrong defenders ${wrongD}, wrong team-mates ${wrongM})`);
}

console.log("\n2. THE KEEPER STANDS WHERE HE IS DRAWN");
for (const kind of DRAWN) {
  let n = 0, moved = 0;
  for (let i = 0; i < 150; i++) {
    const sh = drawingShape(kind, mulberry32(200 + i * 7919));
    if (!sh) continue;
    const ms = authoredPool(kind).find((x) => x.id === sh.sourceId);
    const s0 = ms ? sampleFromAuthored(ms) : null;
    if (!s0) continue;
    const share = keeperSharesOf(s0);
    const want = share.advance === null ? s0.keeper.y : share.advance * sh.ball.y;
    n++;
    if (Math.abs(sh.keeper.y - want) > 1e-6) moved++;
  }
  ok(n > 100 && moved === 0, `${kind}: keeper at his drawing's own depth (${moved}/${n} moved)`);
}

console.log("\n3. DEAD BALLS ARE SERVED EXACTLY AS DRAWN");
for (const kind of ["penalty", "free_kick"] as ScenarioKind[]) {
  if (!servesDrawings(kind)) continue;
  let n = 0, nudged = 0;
  for (let i = 0; i < 150; i++) {
    const sh = drawingShape(kind, mulberry32(300 + i * 7919));
    if (!sh) continue;
    const ms = authoredPool(kind).find((x) => x.id === sh.sourceId);
    let s0 = ms ? sampleFromAuthored(ms) : null;
    if (!s0) continue;
    if (sh.mirrored) {
      const m = (p: { x: number; y: number }) => ({ x: PITCH_W - p.x, y: p.y });
      s0 = { ...s0, ball: m(s0.ball), you: m(s0.you), defenders: s0.defenders.map(m), mates: s0.mates.map(m) };
    }
    n++;
    const men = [...sh.defenders, ...sh.mates], men0 = [...s0.defenders, ...s0.mates];
    if (hyp(sh.ball, s0.ball) > 1e-6 || hyp(sh.you, s0.you) > 1e-6 || men.some((p, k) => hyp(p, men0[k]) > 1e-6)) nudged++;
  }
  ok(n > 100 && nudged === 0, `${kind}: nobody nudged (${nudged}/${n})`);
}

console.log("\n4. NOBODY STARTS ON TOP OF ANYBODY");
for (const kind of SCENARIO_KINDS as ScenarioKind[]) {
  let worst = Infinity, n = 0;
  for (let i = 0; i < 150; i++) {
    const made = makeChance({ source: { from: "kind", kind }, rng: mulberry32(400 + i * 7919), memory: null });
    n++;
    worst = Math.min(worst, closestFigures(made.sc));
  }
  ok(worst >= MIN_GAP - 1e-6, `${kind}: closest two figures ${worst.toFixed(2)} m over ${n} chances (at least ${MIN_GAP})`);
}

console.log("\n5. A ONE-ON-ONE ONLY ON A BREAK");
{
  const base: ScenarioRequest = { zone: "box", lane: "centre", kinds: ["one_on_one", "tight_angle"], pattern: "settled", reason: "t" } as ScenarioRequest;
  let settled = 0, breaks = 0;
  for (let i = 0; i < 200; i++) {
    const a = makeChance({ source: { from: "request", request: base, position: "ST" }, rng: mulberry32(500 + i), memory: null });
    if (a.sc.kind === "one_on_one") settled++;
    const b = makeChance({ source: { from: "request", request: { ...base, pattern: "transition" }, position: "ST" }, rng: mulberry32(500 + i), memory: null });
    if (b.sc.kind === "one_on_one") breaks++;
  }
  ok(settled === 0, `settled play never offers one (${settled}/200)`);
  ok(breaks > 20, `a break still does (${breaks}/200)`);
  const only = makeChance({ source: { from: "request", request: { ...base, kinds: ["one_on_one"] }, position: "ST" }, rng: mulberry32(9), memory: null });
  ok(only.sc.kind === "one_on_one", "when a one-on-one is the only thing on offer, it stays");
}

console.log("\n6. EXTRA DRAWN TEAM-MATES CAN BE PASSED TO");
{
  // A drawing laid over a build that has fewer team-mates than it: the extra
  // drawn men become support runners (a pass can find them), not statues.
  let checked = 0, good = 0;
  for (const kind of ["cutback", "tight_angle", "one_on_one", "byline_cross", "midfield_pass"] as ScenarioKind[]) {
    for (let i = 0; i < 80; i++) {
      const rng = mulberry32(600 + i);
      const sc = buildScenario(kind, rng);
      const sh = drawingShape(kind, rng);
      if (!sh) continue;
      const extra = sh.mates.length - mateBodiesOf(sc).filter((p) => !parked(p)).length;
      if (extra <= 0) continue;
      const sr0 = sc.secondaryRunners.length, tm0 = sc.teammates.length;
      applyAuthoredShape(sc, sh);
      checked++;
      if (sc.secondaryRunners.length >= sr0 + extra && sc.teammates.length <= tm0
        && sc.secondaryRunners.every((r) => r.role === "support" && r.speed > 0)) good++;
    }
  }
  ok(checked > 20 && good === checked, `extra drawn team-mates join as support runners (${good}/${checked})`);
}

console.log("\n7. THE FREE KICK LEAVES YOUR TEAM-MATE WHERE HE WAS DRAWN");
{
  let moved = 0;
  for (let i = 0; i < 100; i++) {
    const rng = mulberry32(700 + i);
    const sc = buildScenario("free_kick", rng);
    const sh = drawingShape("free_kick", rng);
    if (sh) applyAuthoredShape(sc, sh);
    const f0 = { x: sc.follower.x, y: sc.follower.y };
    setupKind(sc, rng, { appliedAuthored: !!sh, appliedPlan: false, keeperStrength: 62 });
    if (hyp(f0, sc.follower) > 1e-6) moved++;
  }
  ok(moved === 0, `team-mate moved by the free-kick rules ${moved}/100`);
}

console.log("\n8. THE PICTURE MEMORY");
{
  const mem = new PictureMemory("test", false);
  let n = 0, fresh = 0;
  for (let i = 0; i < 80; i++) {
    const made = makeChance({ source: { from: "kind", kind: "long_range" }, rng: mulberry32(800 + i * 31), memory: mem });
    n++;
    if (made.nearestRecent >= SAME_PICTURE_M) fresh++;
    void pictureOf;
  }
  ok(mem.recent("long_range").length >= PICTURE_MEMORY, `remembers the last ${PICTURE_MEMORY} pictures of a kind (${mem.recent("long_range").length} kept)`);
  ok(fresh / n >= 0.95, `served long shots unlike any of the last ${PICTURE_MEMORY} (${fresh}/${n})`);
}

if (failed) { console.error(`\n${failed} FAILED`); process.exit(1); }
console.log("\nALL PASSED");
