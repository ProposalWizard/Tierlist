const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); }, clear: () => store.clear(),
};
import { ruleSetFor, hasAuthored, sampleFromScenario } from "../../lib/star/authoredChance";
import { violations, outliersOf } from "../../lib/star/scenarioRules";
import { nextSim, newSimMemory, buildSimScenario, simFaults, authoredShapeFor } from "../../lib/star/gallerySim";
import { mulberry32 } from "../../lib/star/season";

/**
 * LONG SHOTS HAVE A RULE SET (24 Sep 2026).
 *
 * Asked for directly: "create the rule set for long shots… recreate it for
 * long shots, so that it has a rule set to create and simulate more." Rule
 * sets are scanned off the saved drawings of a kind, so this is the saved
 * long-range drawings doing their job: enough of them to count, a clean pool,
 * and Simulate building from them without breaking what they agree on.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const set = ruleSetFor("long_range");
check(!!set && set.n >= 5, `at least five long-shot drawings (${set?.n ?? 0})`);
check(hasAuthored("long_range"), "the game serves long shots from the drawings");
const law = (id: string) => set?.rules.find((r) => r.id === id);
check(!!law("inBox")?.invariant && law("inBox")!.at === 0, "a long shot is always from outside the box");
check(!!law("mateInShot")?.invariant && law("mateInShot")!.at === 0, "no team-mate ever stands in your shot");
check(set ? outliersOf(set).length === 0 : false, "no drawing disagrees with a law");
const depth = law("ballDepth");
check(!!depth && depth.min >= 16.5 && depth.max <= 36, `the ball is a real long shot away (${depth?.min.toFixed(1)}-${depth?.max.toFixed(1)}m)`);

// Simulate builds from the drawings and never breaks what they agree on.
const rng = mulberry32(42), mem = newSimMemory();
let fromDrawing = 0, broke = 0, faulty = 0;
const N = 300;
for (let k = 0; k < N; k++) {
  const spec = nextSim("long_range", rng, mem);
  if (authoredShapeFor(spec)) fromDrawing++;
  const sc = buildSimScenario(spec);
  if (set && violations(sampleFromScenario(sc), set).length) broke++;
  if (simFaults(sc, spec.planId).length) faulty++;
}
check(fromDrawing === N, `every simulated long shot is built from a drawing (${fromDrawing}/${N})`);
check(broke === 0, `no simulated long shot breaks a law (${broke})`);
check(faulty / N < 0.1, `fewer than 1 in 10 simulated long shots has a fault (${faulty}/${N})`);

// ── THE WORKING RULES (Harry, 26 Sep 2026) — lib/star/kindRules/longRange.ts ──
//
// Measured before the ruleset, on 2,000 long shots served the in-game way:
// 96% struck 24-34m out (median 28.9m), 35.6% with an 11m+ hole in the back
// line, the keeper a median 1.66m off his line (46% over 2m), nobody in the
// lane on 40%, and an ordinary player scoring 13.6% (a specialist striking it
// hard 14.9% — power made no difference). Every number below was measured.
{
  const LR = await import("../../lib/star/kindRules/longRange");
  const { setupKind, strikeKind, stepKind, replayStrike } = await import("../../lib/star/kindRules");
  const { buildScenario, initDefenders, stepDefenders, stepKeeper, stepReactions, stepBall, launch } =
    await import("../../lib/star/canvasEngine");
  const { scenarioFaults } = await import("../../lib/star/baseScenario");
  const { CX, POST_L, POST_R, BOX_DEPTH, BOX_L, BOX_R } = await import("../../lib/star/pitch");
  type Sc = ReturnType<typeof buildScenario>;

  const inBox = (p: { x: number; y: number }) => p.y <= BOX_DEPTH && p.x >= BOX_L && p.x <= BOX_R;
  // Two served paths: the drawings (what the match serves whenever a drawing
  // exists — Simulate builds it the same way) and the raw builder (the
  // match's very first chance, and any kind with no drawing).
  const pics: Sc[] = [];
  {
    const r = mulberry32(2609), m = newSimMemory();
    for (let k = 0; k < 400; k++) pics.push(buildSimScenario(nextSim("long_range", r, m)));
    for (let k = 0; k < 400; k++) {
      const sc = buildScenario("long_range", mulberry32(5000 + k), 62, 60, 55);
      setupKind(sc, mulberry32(9000 + k), { appliedAuthored: false, appliedPlan: false, keeperStrength: 62 });
      pics.push(sc);
    }
  }
  const P = pics.length;
  const count = (f: (sc: Sc) => boolean) => pics.filter(f).length;
  const dist = (sc: Sc) => Math.hypot(sc.ball.x - CX, sc.ball.y);

  // 1-2. Where it is struck from.
  check(count((sc) => sc.kind === "long_range") === P, "a repair never turns it into another chance");
  check(count((sc) => sc.ball.y >= 17 && !inBox(sc.ball)) === P, "always outside the box, 17m+ out");
  check(count((sc) => dist(sc) <= 30) === P, `never more than 30m out (${P - count((sc) => dist(sc) <= 30)} were)`);
  const near = count((sc) => dist(sc) >= 17 && dist(sc) <= 25);
  check(near / P >= 0.75, `mostly 17-25m out (${near}/${P}; was 0.7%)`);
  check(count((sc) => Math.abs(sc.ball.x - CX) <= LR.MAX_LATERAL) === P, "roughly central — inside the box's width");

  // 4. A set defence.
  check(count((sc) => LR.lineGap(sc) <= 11) === P, "no 11m+ hole in the back line (was 35.6%)");
  const faulty = pics.filter((sc) => scenarioFaults(sc).length);
  check(faulty.length === 0, `no fault on a served long shot (${faulty.length}: ${faulty.slice(0, 3).map((sc) => scenarioFaults(sc).join("/")).join(", ")})`);

  // 5. A block is real, not certain.
  check(count((sc) => LR.laneCovered(sc)) === P, "somebody in, or closing, the shooting lane on every one (was 60-71%)");
  check(count((sc) => LR.coneBlockers(sc).length <= 3) === P, "never a wall of men in the lane");

  // 6. The box is busy.
  const mateIn = (sc: Sc) => [...(sc.runner ? [sc.runner.pos] : []), ...sc.secondaryRunners.map((r) => r.pos), sc.follower].filter(inBox).length;
  check(count((sc) => mateIn(sc) >= 1) / P >= 0.97, `one of yours in the box (${count((sc) => mateIn(sc) >= 1)}/${P})`);
  check(count((sc) => sc.defenders.filter(inBox).length >= 2) / P >= 0.95, `their box is defended (${count((sc) => sc.defenders.filter(inBox).length >= 2)}/${P})`);

  // 3. The trigger: a man who has just laid it off, beside or behind you.
  const laid = count((sc) => sc.secondaryRunners.some((r) => {
    const d = Math.hypot(r.pos.x - sc.ball.x, r.pos.y - sc.ball.y);
    return d >= 4.5 && d <= 9 && r.pos.y >= sc.ball.y - 1;
  }));
  check(laid / P >= 0.6, `a lay-off man on most (${laid}/${P})`);

  // 7. The keeper is on his line — nothing to chip.
  check(count((sc) => sc.keeper.y <= LR.KEEPER_Y[1] + 1e-9 && sc.keeper.x >= POST_L && sc.keeper.x <= POST_R) === P,
    "the keeper is on his line, inside his posts");

  // The picture stays in the frame, and a seed always builds the same one.
  check(count((sc) => {
    const v = sc.viewport, in_ = (p: { x: number; y: number }) => p.x >= v.x1 && p.x <= v.x2 && p.y >= v.y1 && p.y <= v.y2;
    return in_(sc.ball) && in_(sc.player) && in_(sc.keeper) && (!sc.runner || in_(sc.runner.pos));
  }) === P, "ball, you, keeper and the pass target all on screen");
  {
    const a = buildScenario("long_range", mulberry32(77), 62, 60, 55), b = buildScenario("long_range", mulberry32(77), 62, 60, 55);
    setupKind(a, mulberry32(1), { appliedAuthored: false, appliedPlan: false, keeperStrength: 62 });
    setupKind(b, mulberry32(1), { appliedAuthored: false, appliedPlan: false, keeperStrength: 62 });
    check(JSON.stringify(a) === JSON.stringify(b), "the same seed builds the same picture");
  }

  // 8. The shot. Hard and low through the middle of the ball, aimed inside
  // the corner away from the keeper, through the match's own flight loop.
  const H = 1 / 180, HALF = (POST_R - POST_L) / 2;
  const shoot = (sc: Sc, skill: number, r: () => number, kdOut?: { d: unknown }) => {
    initDefenders(sc, r);
    const side = sc.keeper.x > CX ? -1 : 1;
    const tx = CX + side * (HALF - 0.6) * (0.55 + r() * 0.45);
    const ball = launch(sc, { x: tx - sc.ball.x, y: -sc.ball.y }, 0.97 + r() * 0.03,
      { cx: (r() - 0.5) * 0.12, cy: -0.05 - r() * 0.2 }, { power: skill, technique: skill }, r);
    const kd = strikeKind(sc, ball, mulberry32(Math.floor(r() * 1e9)), { keeperStrength: sc.keeperStrength, power: skill, technique: skill });
    if (kdOut) kdOut.d = kd;
    let out = null as string | null;
    for (let k = 0; k < 5000 && !out; k++) {
      stepDefenders(sc, H, ball.pos, false, ball); stepKeeper(sc, H); stepReactions(sc, ball, H, r);
      stepKind(sc, ball, H, kd); out = stepBall(ball, sc, r, H);
    }
    return { out, ball, kd };
  };
  const rate = (skill: number, n: number) => {
    let g = 0;
    for (let i = 0; i < n; i++) {
      const r = mulberry32(31337 + i * 7);
      const sc = buildSimScenario(nextSim("long_range", r, newSimMemory()));
      if (shoot(sc, skill, r).out === "goal") g++;
    }
    return g / n;
  };
  const ordinary = rate(50, 800), specialist = rate(85, 800);
  check(ordinary >= 0.025 && ordinary <= 0.075,
    `an ordinary player (P50/T50) scores about 4-6% (${(ordinary * 100).toFixed(1)}%; was 28%)`);
  check(specialist >= ordinary * 1.8,
    `a specialist striking it hard scores noticeably more (${(specialist * 100).toFixed(1)}% vs ${(ordinary * 100).toFixed(1)}%)`);

  // The keeper's read is a decision a replay reproduces exactly.
  {
    const sc0 = buildSimScenario(nextSim("long_range", mulberry32(4), newSimMemory()));
    const box = { d: null as unknown };
    const live = shoot(JSON.parse(JSON.stringify(sc0)), 70, mulberry32(9), box);
    check(!!live.kd && live.kd.kind === "long_range", "a shot at goal gets the keeper's read");
    // Replay: same scenario, same launch, the saved decision applied instead of a fresh one.
    const sc = JSON.parse(JSON.stringify(sc0)) as Sc; const r = mulberry32(9);
    initDefenders(sc, r);
    const side = sc.keeper.x > CX ? -1 : 1;
    const tx = CX + side * (HALF - 0.6) * (0.55 + r() * 0.45);
    const ball = launch(sc, { x: tx - sc.ball.x, y: -sc.ball.y }, 0.97 + r() * 0.03,
      { cx: (r() - 0.5) * 0.12, cy: -0.05 - r() * 0.2 }, { power: 70, technique: 70 }, r);
    r();
    const saved = JSON.parse(JSON.stringify(live.kd));
    replayStrike(sc, ball, saved);
    let out = null as string | null;
    for (let k = 0; k < 5000 && !out; k++) {
      stepDefenders(sc, H, ball.pos, false, ball); stepKeeper(sc, H); stepReactions(sc, ball, H, r);
      stepKind(sc, ball, H, saved); out = stepBall(ball, sc, r, H);
    }
    check(out === live.out && Math.abs(ball.pos.x - live.ball.pos.x) < 1e-9, `a replay plays the same way (${out} vs ${live.out})`);
    // A pass is not his business.
    const sp = JSON.parse(JSON.stringify(sc0)) as Sc;
    const back = launch(sp, { x: 6, y: 3 }, 0.4, { cx: 0, cy: -0.2 }, { power: 60, technique: 60 }, mulberry32(1));
    check(strikeKind(sp, back, mulberry32(2), { keeperStrength: 62, power: 60, technique: 60 }) === null,
      "a pass back gets no keeper's read");
  }
  console.log(`  long range: ${near}/${P} from 17-25m, ${laid}/${P} with a lay-off man, ordinary ${(ordinary * 100).toFixed(1)}% vs specialist ${(specialist * 100).toFixed(1)}% scored`);
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log(`PASS — long shots have a rule set from ${set!.n} drawings, and Simulate follows it (${faulty}/${N} with a fault, 0 laws broken)`);
