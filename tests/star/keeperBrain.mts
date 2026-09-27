/**
 * THE KEEPER BRAIN (lib/star/keeperBrain.ts) — measured on the real engine,
 * in the match file's own order: served chance (drawings + kind rules) →
 * initDefenders → brainSetup → aim (stepKeeper + brainAim) → launch →
 * brainStrike → flight at 1/180 s (stepDefenders, stepKeeper, stepReactions,
 * stepKind, brainStep, stepBall).
 *
 * What it pins (plan items 3, 4, 5, 8, 8b, 10, 11 — as built in v0.15):
 *   - ONE DIVE: once he leaves his feet he never moves back the other way,
 *     and a penalty keeper never turns round (today: most of them do);
 *   - he moves BEFORE the ball reaches him on most one-on-ones (today ~1 %);
 *   - he walks at most 2.2 m from the drawn spot while you aim, 1 m in a
 *     tight angle; a penalty keeper never moves before the strike;
 *   - a penalty run-up hop is small, and he dives the way he hopped;
 *   - a free kick keeps its own rules: no brain;
 *   - a better keeper concedes fewer (45 > 88) on every kind measured;
 *   - a goal replay throws exactly the same dive (snapshot + strike seed);
 *   - the game plays the Middle dial; only a test screen can pick another.
 *
 * Run: npx tsx tests/star/keeperBrain.mts
 */
import * as E from "../../lib/star/canvasEngine";
import { nextAuthoredShape, applyAuthoredShape } from "../../lib/star/authoredChance";
import { setupKind, strikeKind, stepKind } from "../../lib/star/kindRules";
import { penaltyReadFor } from "../../lib/star/penaltyKeeper";
import { mulberry32 } from "../../lib/star/season";
import { CX, POST_L, POST_R, GOAL_W } from "../../lib/star/pitch";
import * as B from "../../lib/star/keeperBrain";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };
const pct = (n: number, d: number) => `${((100 * n) / Math.max(1, d)).toFixed(1)}%`;

function serve(kind: E.ScenarioKind, seed: number, ks: number) {
  const rng = mulberry32(seed);
  const sc = E.buildScenario(kind, rng, ks, 60, 55);
  const shape = nextAuthoredShape(sc.kind, rng, []);
  if (shape) applyAuthoredShape(sc, shape);
  setupKind(sc, rng, { appliedAuthored: !!shape, appliedPlan: false, keeperStrength: ks });
  E.initDefenders(sc, rng);
  return { sc, rng };
}

/** A plausible human shot: usually the open corner, sometimes placed, a thumb's error. */
function shotAt(sc: E.Scenario, r: () => number) {
  const open = CX - sc.keeper.x >= 0 ? 1 : -1;
  const side = r() < 0.75 ? open : -open;
  const off = r() < 0.6 ? GOAL_W / 2 - (0.35 + r() * 0.55) : 1.3 + r();
  return { x: CX + side * off + (r() - 0.5) * 0.9, power: 0.72 + r() * 0.23, cy: -0.6 + r() * 0.9 };
}

interface Run { goal: boolean; movedBefore: boolean | null; reversedInDive: boolean; aimMove: number; aimDx: number; aimDy: number; xs: number[] }
function play(kind: E.ScenarioKind, seed: number, ks: number, opts: B.BrainOptions = {}, restoreFrom?: B.KeeperBrainSnapshot): Run {
  const { sc, rng } = serve(kind, seed, ks);
  const k = sc.keeper;
  B.brainSetup(sc, (seed ^ 0x4b7e) >>> 0, ks, opts);
  const kr = mulberry32((seed ^ 0xa11ce) >>> 0);
  const shot = kind === "penalty"
    ? { x: CX + (kr() < 0.5 ? -1 : 1) * (1.4 + 2.1 * kr()), power: 0.6 + kr() * 0.3, cy: -0.8 + kr() }
    : shotAt(sc, kr);
  const x0 = k.x, y0 = k.y;
  for (let t = 0; t < 1.5; t += 1 / 60) { E.stepKeeper(sc, 1 / 60); B.brainAim(sc, 1 / 60); }
  const aimMove = Math.hypot(k.x - x0, k.y - y0), aimDx = Math.abs(k.x - x0), aimDy = Math.abs(k.y - y0);
  const ball = E.launch(sc, { x: shot.x - sc.ball.x, y: -sc.ball.y }, shot.power, { cx: 0, cy: shot.cy }, { power: 60, technique: 60 }, rng);
  const strikeSeed = (seed ^ 0x6b1e5) >>> 0;
  const snap = B.brainSnapshot(sc, strikeSeed)!;
  if (restoreFrom) B.brainRestore(sc, restoreFrom);
  B.brainStrike(sc, ball, restoreFrom?.strikeSeed ?? strikeSeed);
  lastSnap = snap;
  const dec = strikeKind(sc, ball, mulberry32((seed ^ 0x6b1d) >>> 0), { keeperStrength: ks, power: 60, technique: 60 });
  let out: E.Outcome | null = null, prev = k.x, reversedInDive = false, arrived: number | null = null, moved: number | null = null, t = 0;
  const setX = k.x, xs: number[] = [];
  for (let i = 0; i < 180 * 6 && !out; i++) {
    const py = ball.pos.y;
    E.stepDefenders(sc, 1 / 180, ball.pos, false, ball);
    E.stepKeeper(sc, 1 / 180);
    E.stepReactions(sc, ball, 1 / 180, rng);
    stepKind(sc, ball, 1 / 180, dec);
    B.brainStep(sc, ball, 1 / 180);
    out = E.stepBall(ball, sc, rng, 1 / 180);
    t += 1 / 180;
    xs.push(k.x);
    const st = B.brainStateOf(sc);
    const dx = k.x - prev; prev = k.x;
    if (st && st.diveAtT !== null && st.dir !== 0 && k.saves === 0 && arrived === null && Math.abs(dx) > 0.004 && Math.sign(dx) !== st.dir) reversedInDive = true;
    if (moved === null && Math.abs(k.x - setX) > 0.05) moved = t;
    if (arrived === null && py > k.y && ball.pos.y <= k.y) arrived = t;
  }
  return { goal: out === "goal" || out === "rebound", movedBefore: arrived === null ? null : moved !== null && moved < arrived - 0.02, reversedInDive, aimMove, aimDx, aimDy, xs };
}
let lastSnap: B.KeeperBrainSnapshot | undefined;

// ─────────────────────────────────────────────────────────────────────────
console.log("\nABILITIES — every one set by his rating");
{
  const a = B.abilities(45), b = B.abilities(88);
  ok(b.rt < a.rt && b.readErr < a.readErr && b.diveSpeed > a.diveSpeed && b.maxTravel > a.maxTravel, "an 88 reacts sooner, reads better, dives faster and further than a 45");
  ok(B.abilities(60).anticipStep === 0 && B.abilities(90).anticipStep > 0.5, "anticipation only develops above 65, then fast (Harry's shape)");
  const pa = penaltyReadFor(45), pb = penaltyReadFor(88);
  ok(pb.readChance > pa.readChance && pb.readChance <= 0.65, `the penalty rule set he dives by reads better with rating, never a mind-reader (${pa.readChance.toFixed(2)} → ${pb.readChance.toFixed(2)})`);
}

console.log("\nONE DIVE, NEVER TURNING ROUND (items 3, 4)");
for (const kind of ["one_on_one", "tight_angle", "long_range", "penalty", "cutback"] as E.ScenarioKind[]) {
  let rev = 0, n = 0;
  for (let s = 1; s <= 120; s++) { const r = play(kind, s * 7919 + 17, 75); n++; if (r.reversedInDive) rev++; }
  ok(rev === 0, `${kind}: no reversal once he has left his feet (${rev} of ${n})`);
}

console.log("\nHE MOVES BEFORE THE BALL ARRIVES (item 8) — one-on-ones, 200 each");
for (const [ks, floor] of [[45, 0.55], [88, 0.8]] as const) {
  let m = 0, n = 0;
  for (let s = 1; s <= 200; s++) { const r = play("one_on_one", s * 7919 + 31, ks); if (r.movedBefore !== null) { n++; if (r.movedBefore) m++; } }
  ok(m / n >= floor, `rating ${ks}: moves before it reaches him ${pct(m, n)} (today ~1 %)`);
}

console.log("\nWHILE YOU AIM: A WALK OF AT MOST 2.2 m IN ANY DIRECTION (1 m IN A TIGHT ANGLE); A PENALTY KEEPER STAYS PUT");
{
  let moved = 0;
  for (let s = 1; s <= 60; s++) if (play("penalty", s * 7919 + 5, 88).aimMove > 1e-6) moved++;
  ok(moved === 0, `no penalty keeper moved while you aimed (${moved} of 60)`);
  // Measured as the straight-line walk, not each axis on its own: two
  // separate caps (2.2 m across, 1.8 m out) let a diagonal walk reach 2.8 m.
  for (const [kind, cap] of [["one_on_one", B.KEEPER_BRAIN.walkCap], ["long_range", B.KEEPER_BRAIN.walkCap], ["tight_angle", B.KEEPER_BRAIN.walkCapTight]] as const) {
    let worst = 0, walked = 0;
    for (const ks of [45, 88]) for (let s = 1; s <= 80; s++) { const r = play(kind, s * 7919 + 11, ks); worst = Math.max(worst, r.aimMove); if (r.aimMove > 0.3) walked++; }
    ok(worst <= cap + 1e-6 && walked > 40, `${kind}: he walks while you aim (${walked} of 160 over 0.3 m) but never more than ${cap} m in any direction (most ${worst.toFixed(2)} m)`);
  }
}

console.log("\nA FREE KICK KEEPS ITS OWN RULES (kindRules/freeKick.ts): NO BRAIN");
{
  let none = 0, kept = 0;
  for (let s = 1; s <= 60; s++) {
    const { sc } = serve("free_kick", s * 7919 + 9, 88);
    const x0 = sc.keeper.x;
    B.brainSetup(sc, s, 88);
    if (!B.hasBrain(sc)) none++;
    for (let t = 0; t < 1.5; t += 1 / 60) { E.stepKeeper(sc, 1 / 60); B.brainAim(sc, 1 / 60); }
    if (Math.abs(sc.keeper.x - x0) < 0.6) kept++;
  }
  ok(none === 60, `no free kick gets a brain (${none} of 60)`);
  ok(kept === 60, `…so its keeper stays at the rule set's far-post cheat while you aim (${kept} of 60)`);
}

console.log("\nA PENALTY RUN-UP HOP IS SMALL, AND HE DIVES THE WAY HE HOPPED");
{
  let hopped = 0, small = 0, sameWay = 0, dived = 0;
  for (let s = 1; s <= 120; s++) {
    const seed = s * 7919 + 21;
    const { sc, rng } = serve("penalty", seed, 88);
    B.brainSetup(sc, seed, 88, { penalty: penaltyReadFor(88) });
    const x0 = sc.keeper.x;
    const aimX = CX + (s % 2 ? 2.8 : -2.8);
    for (let t = 0; t < 2; t += 1 / 60) { E.stepKeeper(sc, 1 / 60); B.brainRunUp(sc, 1 / 60, t, aimX); }
    const hop = sc.keeper.x - x0;
    if (Math.abs(hop) < 1e-6) continue;
    hopped++;
    if (Math.abs(hop) <= B.KEEPER_BRAIN.hopM + 1e-6) small++;
    const ball = E.launch(sc, { x: aimX - sc.ball.x, y: -sc.ball.y }, 0.8, { cx: 0, cy: -0.4 }, { power: 60, technique: 60 }, rng);
    B.brainStrike(sc, ball, seed);
    for (let i = 0; i < 180; i++) { E.stepKeeper(sc, 1 / 180); B.brainStep(sc, ball, 1 / 180); if (E.stepBall(ball, sc, rng, 1 / 180)) break; }
    const st = B.brainStateOf(sc)!;
    if (st.diveAtT !== null) { dived++; if (st.dir === Math.sign(hop)) sameWay++; }
  }
  ok(hopped > 60, `an 88 keeper hops during the run-up (${hopped} of 120)`);
  ok(small === hopped, `…a small hop, never more than ${B.KEEPER_BRAIN.hopM} m (${small} of ${hopped})`);
  ok(dived > 0 && sameWay === dived, `…and every dive after it goes the way he hopped (${sameWay} of ${dived})`);
}

console.log("\nTHE SAME PICTURE, PLAYED AGAIN, IS NOT THE SAME KICK (final playtest: 11 of 11 dived one way, none hopped)");
{
  // A feature screen mounts the match with the SAME seed every Play (EnginePlay's
  // seed 1), so one picture played 200 times hands the brain the same seeds —
  // unless the mount's salt (keeperSaltFor) is mixed in, as CanvasMatch does.
  const run = (feature: boolean) => {
    let low = 0, high = 0, hops = 0;
    const saltRng = mulberry32(4242);
    for (let i = 0; i < 200; i++) {
      const salt = B.keeperSaltFor(feature, saltRng);
      const { sc } = serve("penalty", 31337, 62);
      B.brainSetup(sc, ((1 ^ 0x4b7e) ^ salt) >>> 0, 62, { penalty: penaltyReadFor(62) });
      const aimX = POST_L + 0.7; // the same corner every kick
      const x0 = sc.keeper.x;
      for (let t = 0; t < 2; t += 1 / 60) { E.stepKeeper(sc, 1 / 60); B.brainRunUp(sc, 1 / 60, t, aimX); }
      if (Math.abs(sc.keeper.x - x0) > 1e-6) hops++;
      const ball = E.launch(sc, { x: aimX - sc.ball.x, y: -sc.ball.y }, 0.8, { cx: 0, cy: -0.4 }, { power: 60, technique: 60 }, mulberry32(5));
      B.brainStrike(sc, ball, ((2 ^ Math.imul(37, 0xc2b2ae35)) ^ 0x4b7f ^ salt) >>> 0);
      const d = B.brainStateOf(sc)!.dir;
      if (d < 0) low++; else if (d > 0) high++;
    }
    return { low, high, hops };
  };
  const game = run(false), feature = run(true);
  ok(B.keeperSaltFor(false) === 0, "the real match's keeper keeps its seeded, replayable stream (salt 0)");
  ok(game.hops === 0 || game.hops === 200, `without the salt one picture is one kick, every time (dived low ${game.low} / high ${game.high}, hopped ${game.hops} of 200)`);
  ok(feature.low >= 60 && feature.high >= 60, `with it he dives both ways (low ${feature.low} / high ${feature.high} of 200)`);
  ok(feature.hops >= 70 && feature.hops <= 130, `…and hops on about half of the run-ups (${feature.hops} of 200)`);
}

console.log("\nA BETTER KEEPER CONCEDES FEWER (item 10) — 200 each");
for (const kind of ["one_on_one", "tight_angle", "long_range", "penalty"] as E.ScenarioKind[]) {
  const g = (ks: number) => { let n = 0; for (let s = 1; s <= 200; s++) if (play(kind, s * 7919 + 3, ks).goal) n++; return n; };
  const lo = g(45), hi = g(88);
  ok(hi < lo, `${kind}: 88 concedes ${pct(hi, 200)}, 45 concedes ${pct(lo, 200)}`);
}

console.log("\nA GOAL REPLAY THROWS THE SAME DIVE");
{
  let same = 0;
  for (let s = 1; s <= 40; s++) {
    const seed = s * 7919 + 77;
    const live = play("one_on_one", seed, 75);
    const snap = lastSnap!;
    const again = play("one_on_one", seed, 75, {}, snap);
    if (live.xs.length === again.xs.length && live.xs.every((x, i) => Math.abs(x - again.xs[i]) < 1e-9)) same++;
  }
  ok(same === 40, `restored from its snapshot, the keeper moves identically (${same} of 40)`);
}

console.log("\nTHE TRIAL'S PENALTY KEEPER RIDES THROUGH THE RULE SET");
{
  const { sc } = serve("penalty", 4242, 90);
  B.brainSetup(sc, 1, 90, { penalty: penaltyReadFor(90, { commitChance: 0.95, readChance: 0.72 }) });
  const snap = B.brainSnapshot(sc, 7)!;
  ok(snap.opts.penalty?.readChance === 0.72 && snap.opts.penalty?.commitChance === 0.95 && snap.opts.penalty?.middleRead === 0.72,
    "the trial's harder keeper (goes 95 %, reads 72 %, reads the middle as well) is the dive the brain throws, and a replay keeps it");
}

console.log("\nTHE ONE DIAL (Harry's question 1) moves long shots, and only down to today's");
{
  const g = (dial: number) => { let n = 0; for (let s = 1; s <= 200; s++) if (play("long_range", s * 7919 + 13, 62, { openPlay: dial }).goal) n++; return n; };
  const hard = g(B.OPEN_PLAY_DIAL.hard), mid = g(B.OPEN_PLAY_DIAL.middle), easy = g(B.OPEN_PLAY_DIAL.easier);
  ok(easy > mid && mid > hard, `long shots at 62: Hard concedes ${pct(hard, 200)}, Middle ${pct(mid, 200)}, Easier ${pct(easy, 200)}`);
  ok(B.KEEPER_BRAIN.openPlay === B.OPEN_PLAY_DIAL.middle, "the game's own setting is the Middle");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gw = globalThis as any;
  const saved = { getItem: (k: string) => (k === B.BRAIN_DIAL_FLAG ? "hard" : null), setItem() {}, removeItem() {} };
  gw.window = { location: { pathname: "/star-dev" }, localStorage: saved };
  const inGame = B.openPlayDialHere();
  gw.window = { location: { pathname: "/star-highlights-dev" }, localStorage: saved };
  const onTest = B.openPlayDialHere();
  gw.window = undefined;
  ok(inGame === "middle" && onTest === "hard" && B.openPlayDialHere() === "middle",
    `a device saved on Hard: the real game still plays ${inGame}, a test screen plays ${onTest}`);
}

if (failed) { console.error(`\n${failed} FAILED`); process.exit(1); }
console.log("\nall passed");
