/**
 * tests/star/penaltyRules.mts — Harry's penalty rules (v0.15, item 2),
 * applied LAST to every penalty, whoever built it.
 *
 * Harry, playtest (26 Sep 2026): "The goalie should always be in the centre
 * of his goal, on his line. These players should not be able to cross the
 * edge of the box line … they shouldn't be able to go in the semicircle. The
 * ball should always be on the penalty spot … The camera angle should be the
 * same every single time."
 *
 * Checked on the pictures each mode really serves:
 *   - the real match: built, then a DRAWING laid over it (with its nudge and
 *     its 1.6 m keeper floor), then the kind's setup, then the rules;
 *   - the trial / shootout / gallery card: the engine's own built penalty.
 * Plus the editor's version (penaltyFrame / penaltyDragSpot), the compare
 * switch (test screens only), that corners never get these rules, the
 * variety between penalties, and what goes in on served penalties with the
 * keeper the match really plays (the keeper brain throwing the penalty rule
 * set's dive): Harry, v0.15 build — corners about 75 %, overall 75–80 %.
 *
 * v0.15 build changes (Harry): you stand BEHIND the ball, not beside it; and
 * no two penalties look the same — some men stand a step or two behind the
 * line, some close in toward the D, always legal.
 *
 * Run: npx tsx tests/star/penaltyRules.mts
 */
import {
  buildScenario, initDefenders, launch, stepBall, stepKeeper, stepDefenders, stepReactions,
  goalInView, type Scenario,
} from "../../lib/star/canvasEngine";
import { mulberry32 } from "../../lib/star/season";
import { nextAuthoredShape, applyAuthoredShape, setLiveScenarioPool, showSavedScenarios } from "../../lib/star/authoredChance";
import { setupKind, enforceHardRules } from "../../lib/star/kindRules";
import {
  PENALTY, PENALTY_VIEW, lineBounds, penaltyFrame, penaltyDragSpot, enforcePenalty,
} from "../../lib/star/kindRules/penalty";
import { penaltyReadFor } from "../../lib/star/penaltyKeeper";
import { brainSetup, brainAim, brainStrike, brainStep } from "../../lib/star/keeperBrain";
import { frameFromScenario } from "../../lib/star/scenarioFrame";
import { CX, PEN_SPOT_Y, BOX_DEPTH, BOX_L, BOX_R, ARC_R } from "../../lib/star/pitch";
import { makeChance } from "../../lib/star/chanceMaker";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };

// The compare switches read localStorage, on a test screen only; off a
// browser every one reads ON. `setOff` fakes one device's test screen (the
// gallery) with a switch turned off; `path` picks another page.
const off = new Set<string>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = globalThis as any;
const setOff = (names: string[], path = "/star-gallery-dev") => {
  off.clear(); names.forEach((n) => off.add(n));
  g.window = names.length ? { location: { pathname: path }, localStorage: { getItem: (k: string) => (off.has(k.replace("star-compare-", "")) ? "off" : null), setItem() {}, removeItem() {} } } : undefined;
};

/** The real match's penalty: CanvasMatch.loadScenario's order (since v0.15
 *  A2 every chance is made by lib/star/chanceMaker.ts's makeChance). */
function served(seed: number): { sc: Scenario; drawn: boolean; rng: () => number } {
  showSavedScenarios(false); setLiveScenarioPool(null);
  const rng = mulberry32(seed);
  const made = makeChance({ source: { from: "kind", kind: "penalty" }, rng, strength: { keeper: 62, team: 60, vision: 55 }, memory: null });
  const sc = made.sc, shape = made.shape;
  enforceHardRules(sc);
  initDefenders(sc, rng);
  return { sc, drawn: !!shape, rng };
}
/** The trial / shootout / gallery card: the engine's built penalty. */
function built(seed: number): Scenario {
  const rng = mulberry32(seed);
  const sc = buildScenario("penalty", rng, 45 + (seed % 45), 60, 55);
  enforceHardRules(sc);
  initDefenders(sc, rng);
  return sc;
}

const others = (sc: Scenario) => {
  const out: { x: number; y: number }[] = [];
  sc.defenders.forEach((d) => out.push({ x: d.x, y: d.y }));
  if (sc.runner) out.push({ ...sc.runner.pos });
  sc.secondaryRunners.forEach((r) => out.push({ ...r.pos }));
  if (goalInView(sc.kind) && sc.follower.x > -100) out.push({ x: sc.follower.x, y: sc.follower.y });
  sc.teammates.forEach((t) => out.push({ x: t.x, y: t.y }));
  return out;
};
const inBox = (p: { x: number; y: number }) => p.y < BOX_DEPTH - 1e-6 && p.x > BOX_L && p.x < BOX_R;
const inD = (p: { x: number; y: number }) => p.y >= BOX_DEPTH - 1e-6 && Math.hypot(p.x - CX, p.y - PEN_SPOT_Y) < ARC_R - 1e-6;
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps;
/** On the edge of the box, or a step or two behind it (the variety). */
const onLineBand = (y: number) => y >= PENALTY.lineY - 1e-9 && y <= PENALTY.lineY + PENALTY.backMax + 1e-9;

function checkAll(label: string, pictures: Scenario[]) {
  let keeper = 0, anchor = 0, spot = 0, you = 0, box = 0, d = 0, line = 0, spaced = 0, framed = 0, camera = 0, runners = 0;
  let bodies = 0;
  for (const sc of pictures) {
    const k = sc.keeper;
    if (near(k.x, CX) && near(k.y, PENALTY.keeper.y)) keeper++;
    if (near(k.startX, CX) && near(k.targetX, CX)) anchor++;
    if (near(sc.ball.x, CX) && near(sc.ball.y, PEN_SPOT_Y)) spot++;
    if (near(sc.player.x - sc.ball.x, PENALTY.you.dx) && near(sc.player.y - sc.ball.y, PENALTY.you.dy)) you++;
    const v = sc.viewport;
    if (near(v.x1, PENALTY_VIEW.x1) && near(v.x2, PENALTY_VIEW.x2) && near(v.y1, PENALTY_VIEW.y1) && near(v.y2, PENALTY_VIEW.y2) && (sc.facing ?? "up") === "up") camera++;
    const os = others(sc);
    bodies += os.length;
    let apart = true, inFrame = true, onLine = true;
    for (let a = 0; a < os.length; a++) {
      if (inBox(os[a])) box++;
      if (inD(os[a])) d++;
      if (!onLineBand(os[a].y)) onLine = false;
      if (os[a].x < v.x1 + 0.5 || os[a].x > v.x2 - 0.5) inFrame = false;
      for (let b = a + 1; b < os.length; b++) if (Math.hypot(os[a].x - os[b].x, os[a].y - os[b].y) < PENALTY.spacing - 1e-6) apart = false;
    }
    if (apart) spaced++;
    if (inFrame) framed++;
    if (onLine) line++;
    // A runner must not sprint back into the box when the ball is struck.
    const rs = [...(sc.runner ? [sc.runner] : []), ...sc.secondaryRunners];
    if (rs.every((r) => near(r.to.x, r.pos.x) && near(r.to.y, r.pos.y))) runners++;
  }
  const n = pictures.length;
  console.log(`\n${label.toUpperCase()} — ${n} penalties, ${bodies} other bodies`);
  ok(keeper === n, `the keeper is dead centre, on his line (${PENALTY.keeper.y} m), in ${keeper}/${n}`);
  ok(anchor === n, `his dive is worked out from the centre too (startX / targetX), in ${anchor}/${n}`);
  ok(spot === n, `the ball is on the spot in ${spot}/${n}`);
  ok(you === n, `you stand behind it (${PENALTY.you.dy} m back, towards halfway), in ${you}/${n}`);
  ok(box === 0 && d === 0, `nobody inside the box (${box}) or the D (${d})`);
  ok(line === n, `everybody else stands on the edge of the box, or up to ${PENALTY.backMax} m behind it, in ${line}/${n}`);
  ok(spaced === n, `nobody stands in anybody (≥ ${PENALTY.spacing} m apart) in ${spaced}/${n}`);
  ok(framed === n, `nobody off the picture in ${framed}/${n}`);
  ok(camera === n, `one camera, facing up, in ${camera}/${n}`);
  ok(runners === n, `no runner is still heading into the box in ${runners}/${n}`);
}

// ── 1. The real match, served from the drawings ──
setOff([]);
const real = Array.from({ length: 200 }, (_, i) => served(1000 + i * 7919));
const drawnCount = real.filter((r) => r.drawn).length;
ok(drawnCount === 200, `the real match serves its penalties from the drawings (${drawnCount}/200) — the rules have to beat the drawing layer`);
checkAll("the real match (served from a drawing)", real.map((r) => r.sc));

// ── 2. The built picture (trial, shootout, gallery card) ──
checkAll("the built penalty (trial, shootout, gallery card)", Array.from({ length: 200 }, (_, i) => built(3000 + i * 104729)));

// ── 2b. No two alike (Harry, v0.15) ──
console.log("\nNO TWO PENALTIES LOOK THE SAME");
{
  const sig = (sc: Scenario) => others(sc).map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).sort().join("|");
  const pics = real.map((r) => r.sc);
  const distinct = new Set(pics.map(sig)).size;
  const back = pics.filter((sc) => others(sc).some((p) => p.y > PENALTY.lineY + 0.5)).length;
  const pair = pics.filter((sc) => {
    const os = others(sc);
    return os.some((a, i) => os.some((b, j) => j > i && Math.abs(a.y - b.y) < 1e-6 && Math.abs(a.x - b.x) < PENALTY.spacing + 0.05));
  }).length;
  console.log(`  ${distinct} different pictures in 200; someone a step or more back in ${back}; two shoulder to shoulder in ${pair}`);
  ok(distinct >= 190, `no two alike: ${distinct} different arrangements in 200 served penalties`);
  ok(back >= 50 && back <= 170, `…in some a man stands a step or two further back (${back}/200)`);
  ok(pair >= 40, `…and in some a few stand side by side along the edge of the box (${pair}/200)`);
}

// ── 2c. Corners never get the penalty rules ──
console.log("\nCORNERS KEEP THEIR DRAWINGS");
{
  let untouched = 0, onLine = 0;
  for (let i = 0; i < 200; i++) {
    showSavedScenarios(false); setLiveScenarioPool(null);
    const rng = mulberry32(700 + i * 7919);
    const sc = buildScenario("corner", rng, 62, 60, 55);
    const shape = nextAuthoredShape("corner", rng, []);
    if (shape) applyAuthoredShape(sc, shape);
    setupKind(sc, rng, { appliedAuthored: !!shape, appliedPlan: false, keeperStrength: 62 });
    const before = JSON.stringify(sc);
    enforceHardRules(sc);
    if (JSON.stringify(sc) === before) untouched++;
    if (near(sc.keeper.x, PENALTY.keeper.x) && near(sc.keeper.y, PENALTY.keeper.y)) onLine++;
  }
  ok(untouched === 200, `a corner is never touched by the penalty rules (${untouched}/200)`);
  ok(onLine === 0, `…its keeper is never put dead centre on his line by them (${onLine}/200 there)`);
}

// ── 3. Idempotent: applying the rules twice changes nothing ──
console.log("\nIDEMPOTENT");
{
  let same = 0;
  for (let i = 0; i < 100; i++) {
    const sc = served(9000 + i * 7919).sc;
    const before = JSON.stringify(sc);
    enforcePenalty(sc);
    if (JSON.stringify(sc) === before) same++;
  }
  ok(same === 100, `a penalty already under the rules is left exactly as it is (${same}/100)`);
}

// ── 4. The editor's version ──
console.log("\nTHE EDITOR (gallery card, its editor, Infinite Highlights)");
{
  let fixed = 0, n = 0;
  for (let i = 0; i < 100; i++) {
    setOff(["penaltyRules"]);
    const raw = served(5000 + i * 7919).sc; // the picture as it used to be
    setOff([]);
    const f = penaltyFrame(frameFromScenario(raw));
    n++;
    const k = f.items.find((it) => it.keeper)!;
    const y = f.items.find((it) => it.side === "you")!;
    const os = f.items.filter((it) => !it.keeper && it.side !== "you" && it.at.x > -100);
    const good = near(k.at.x, CX) && near(k.at.y, PENALTY.keeper.y) && near(f.ball.x, CX) && near(f.ball.y, PEN_SPOT_Y)
      && near(y.at.x, CX + PENALTY.you.dx) && near(y.at.y, PEN_SPOT_Y + PENALTY.you.dy) && os.every((o) => onLineBand(o.at.y) && !inBox(o.at) && !inD(o.at))
      && near(f.camera.x1, PENALTY_VIEW.x1) && near(f.camera.y2, PENALTY_VIEW.y2) && (f.facing ?? "up") === "up";
    if (good) fixed++;
  }
  ok(fixed === n, `a drawn picture is put under the rules for the editor in ${fixed}/${n}`);
  const { min, max } = lineBounds();
  const spots = [-40, CX - 1, CX, CX + 0.5, CX + 9, 200].map((x) => penaltyDragSpot(x));
  ok(spots.every((s) => near(s.y, PENALTY.lineY)), "a dragged man stays on the edge of the box, whatever the finger does");
  ok(spots.every((s) => Math.abs(s.x - CX) >= min - 1e-9 && Math.abs(s.x - CX) <= max + 1e-9),
    `…outside the D and on the picture (${min.toFixed(2)}–${max.toFixed(2)} m from the middle)`);
  const oneOnOne = frameFromScenario(buildScenario("one_on_one", mulberry32(7)));
  ok(penaltyFrame(oneOnOne) === oneOnOne, "any other kind of chance is left alone");
}

// ── 5. The compare switch puts the old game back ──
console.log("\nTHE COMPARE SWITCH");
{
  setOff(["penaltyRules"]);
  const old = Array.from({ length: 200 }, (_, i) => served(1000 + i * 7919).sc);
  // (The drawn keeper stands where his drawing put him — before the v0.15
  // build a separate floor pushed every one 1.6 m out; that floor is gone.)
  const keeperOut = old.filter((sc) => !(near(sc.keeper.x, CX) && near(sc.keeper.y, PENALTY.keeper.y))).length;
  const intruded = old.filter((sc) => others(sc).some((p) => inBox(p) || inD(p))).length;
  const offSpot = old.filter((sc) => Math.hypot(sc.ball.x - CX, sc.ball.y - PEN_SPOT_Y) > 0.05).length;
  ok(keeperOut > 150, `off: the keeper is back where the drawing put him, not dead centre on his line (${keeperOut}/200)`);
  // v0.15 A2 (rules audit R3): the serving no longer nudges a penalty at all,
  // so with the rules off the picture is the drawing exactly — the ball on
  // its drawn spot (was off it 199/200 with the nudge) and the drawings' own
  // men, some just inside the box or the D (85/200 measured; was 186/200).
  ok(intruded > 50, `off: somebody is inside the box or the D again, as drawn (${intruded}/200)`);
  ok(offSpot === 0, `off: the ball stays on its drawn spot — nothing nudges a penalty any more (${offSpot}/200 off it)`);
  // The real game (/star-dev: a career, its trial and shootouts) never reads it.
  setOff(["penaltyRules"], "/star-dev");
  const game = Array.from({ length: 50 }, (_, i) => served(1000 + i * 7919).sc);
  ok(game.every((sc) => near(sc.keeper.y, PENALTY.keeper.y) && near(sc.ball.y, PEN_SPOT_Y)), "…but only on a test screen: the real game plays the rules whatever this device has saved (50/50)");
  setOff([]);
}

// ── 6. What goes in, on the penalties the real match serves ──
// tests/star/penaltyKeeper.mts's kick mix, a keeper rated 62, a kicker 60,
// served from the drawings, with the keeper the match plays: the keeper brain
// throwing the penalty rule set's dive (CanvasMatch's order: brainSetup, the
// aim, launch, brainStrike, then brainStep every substep before stepBall).
// Harry, v0.15 build: corners about 75 %, overall 75–80 %. Measured before
// the build (the prototype: the engine's own scramble, fixed 1-2.5 m dive at
// the strike): overall 82.3 %, corners 87.6 %.
console.log("\nWHAT GOES IN, SERVED PENALTIES (Harry: corners ~75 %, overall 75–80 %)");
{
  type Res = "scored" | "saved" | "missed";
  const kickFor = (rng: () => number, zone?: "corner") => {
    const u = zone ? 0 : rng(); const side = rng() < 0.5 ? -1 : 1; const p = 0.6 + rng() * 0.3; const cy = -1 + rng() * 1.25;
    if (zone === "corner") return { off: side * (2.9 + rng() * 0.65), power: p, cy };
    if (u < 0.7) return { off: side * (1.4 + 2.15 * Math.sqrt(rng())), power: p, cy };
    if (u < 0.9) return { off: (rng() - 0.5) * 0.8, power: p, cy };
    return { off: (rng() - 0.5) * 0.6, power: 0.4 + rng() * 0.05, cy: 0.3 + rng() * 0.45 };
  };
  const play = (N: number, zone?: "corner") => {
    const c = { scored: 0, saved: 0, missed: 0 };
    for (let i = 0; i < N; i++) {
      const seed = 1000 + i * 7919;
      const kick = kickFor(mulberry32((seed ^ 0xa11ce) >>> 0), zone);
      const { sc, rng } = served(seed);
      brainSetup(sc, (seed ^ 0x4b7e) >>> 0, 62, { penalty: penaltyReadFor(62) });
      for (let t = 0; t < 1.5; t += 1 / 60) { stepKeeper(sc, 1 / 60); brainAim(sc, 1 / 60); }
      const dx = CX + kick.off - sc.ball.x, dy = -sc.ball.y, L = Math.hypot(dx, dy);
      const ball = launch(sc, { x: dx / L, y: dy / L }, kick.power, { cx: 0, cy: kick.cy }, { power: 60, technique: 60 }, rng);
      brainStrike(sc, ball, (seed ^ 0x6b1e5) >>> 0);
      let res: string | null = null;
      for (let t = 0; !res && t < 8; t += 1 / 180) {
        stepDefenders(sc, 1 / 180, ball.pos, false, ball); stepKeeper(sc, 1 / 180); stepReactions(sc, ball, 1 / 180, rng);
        brainStep(sc, ball, 1 / 180);
        res = stepBall(ball, sc, rng, 1 / 180);
      }
      const out: Res = (res === "goal" || res === "rebound") && !sc.follower.shot ? "scored" : sc.keeper.saves > 0 ? "saved" : "missed";
      c[out]++;
    }
    return { scored: (100 * c.scored) / N, saved: (100 * c.saved) / N, missed: (100 * c.missed) / N };
  };
  const all = play(1500), corners = play(800, "corner");
  console.log(`  overall (1,500): scored ${all.scored.toFixed(1)}%, saved ${all.saved.toFixed(1)}%, missed ${all.missed.toFixed(1)}%`);
  console.log(`  corners (800):   scored ${corners.scored.toFixed(1)}%, saved ${corners.saved.toFixed(1)}%, missed ${corners.missed.toFixed(1)}%`);
  ok(all.scored >= 74 && all.scored <= 81, `served penalties score ${all.scored.toFixed(1)}% — Harry's 75–80 %`);
  ok(corners.scored >= 71 && corners.scored <= 79, `…a kick into the corner scores ${corners.scored.toFixed(1)}% — Harry's "about 75 %" (was 87.6 % in the prototype)`);
  ok(all.saved >= 12 && all.saved <= 22, `…and ${all.saved.toFixed(1)}% are saved (Premier League all-time 17.7 %)`);
}

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
