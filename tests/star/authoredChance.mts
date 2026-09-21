/**
 * THE AUTHORED CHANCE LAYER — the rule set scanned off hand-drawn scenarios,
 * and the randomiser that varies them without breaking them.
 *
 * Every number quoted here was measured by running this file, not reasoned
 * about. Where a threshold is a floor rather than an exact figure, it is a
 * floor on purpose: authoring more scenarios must never make the suite red.
 */

import { AUTHORED_SCENARIOS } from "@/lib/star/authoredScenarios";
import {
  deriveRuleSet, sampleFromAuthored, violations, describeRuleSet,
  MIN_SAMPLES_FOR_INVARIANT, MEASURES, outliersOf,
  type ShapeSample, type RuleSet,
} from "@/lib/star/scenarioRules";
import {
  authoredPool, ruleSetFor, nextAuthoredShape, randomiseAuthored,
  setLiveScenarioPool, applyAuthoredShape, sampleFromScenario, JITTER_M,
  KEEPER_TUNING,
} from "@/lib/star/authoredChance";
import { buildScenario } from "@/lib/star/canvasEngine";
import { fixBaseScenario, offsideLineOf } from "@/lib/star/baseScenario";
import { mulberry32 } from "@/lib/star/season";

let failed = 0;
const ok = (cond: boolean, what: string) => {
  if (!cond) { failed++; console.error(`  FAIL ${what}`); }
};

// ── The scan itself ────────────────────────────────────────────────────────

const pool = authoredPool("one_on_one");
ok(pool.length >= 5, `at least 5 authored one-on-ones to scan (have ${pool.length})`);

const set = ruleSetFor("one_on_one")!;
ok(!!set, "a rule set is produced for a kind that has authored scenarios");
ok(set.n === pool.length, "the rule set records how many it scanned");
ok(ruleSetFor("__nothing_authored__") === null, "a kind with nothing authored has no rule set");

// The three that came out of the drawings rather than out of anybody's head.
const inv = set.rules.filter(r => r.invariant).map(r => r.id);
ok(inv.includes("defBetween"), "invariant: no defender between the ball and goal");
ok(inv.includes("defGoalSide"), "invariant: no defender nearer the goal than the ball");
ok(inv.includes("mateInShot"), "invariant: no team-mate standing in your shot");

// A rule set is only as good as its sample count — three agreeing is chance.
const tiny = deriveRuleSet("x", pool.slice(0, 3).map(sampleFromAuthored) as ShapeSample[]);
ok(tiny.rules.every(r => !r.invariant),
  `under ${MIN_SAMPLES_FOR_INVARIANT} samples nothing is treated as a hard rule`);

// ── Auto-scanning: the pool is read fresh, never cached by value ───────────

const before = ruleSetFor("one_on_one")!.n;
const extra = { ...pool[0], id: "live-test-extra", updatedAt: Date.now() };
setLiveScenarioPool([extra]);
ok(ruleSetFor("one_on_one")!.n === before + 1,
  "adding a scenario to the live pool is picked up on the very next scan");
setLiveScenarioPool(null);
ok(ruleSetFor("one_on_one")!.n === before, "removing it again is picked up too");

// The cache must never be able to hold a stale answer: its key is every id
// AND every save time, so EDITING a scenario re-scans just like adding one.
const edited = { ...pool[0], id: "live-test-edited", updatedAt: 1 };
setLiveScenarioPool([edited]);
const first = ruleSetFor("one_on_one")!;
setLiveScenarioPool([{ ...edited, updatedAt: 2, ball: { x: edited.ball.x + 6, y: edited.ball.y } }]);
const second = ruleSetFor("one_on_one")!;
ok(first !== second, "editing a scenario invalidates the cached rule set");
setLiveScenarioPool(null);

// ── The randomiser ────────────────────────────────────────────────────────

const N = 3000;
const rng = mulberry32(4242);
const recent: string[] = [];
let served = 0, exact = 0, repeats = 0, prev = "";
const used = new Set<string>();
let moveSum = 0, moveN = 0;
for (let i = 0; i < N; i++) {
  const sh = nextAuthoredShape("one_on_one", rng, recent);
  if (!sh) continue;
  served++;
  used.add(sh.sourceId);
  if (sh.jitter === 0) exact++;
  if (sh.sourceId === prev) repeats++;
  prev = sh.sourceId;
  // THE load-bearing assertion: nothing that breaks the scanned rules is
  // ever served. The retry loop's last attempt is the drawing itself, so
  // this can only fail if the rules and the drawings disagree.
  ok(violations(sh, set).length === 0, `served shape ${i} obeys the rule set`);
  const base = sampleFromAuthored(pool.find(p => p.id === sh.sourceId)!)!;
  moveSum += Math.hypot(sh.ball.x - base.ball.x, sh.ball.y - base.ball.y);
  moveN++;
  recent.push(sh.sourceId);
  if (recent.length > 3) recent.shift();
}
ok(served === N, `every draw produced a shape (${served}/${N})`);
ok(repeats === 0, `never the same drawing twice running (${repeats})`);
ok(used.size === pool.length, `all ${pool.length} drawings get used (${used.size})`);
ok(exact / served < 0.05,
  `the fallback to an un-nudged drawing stays rare (${(100 * exact / served).toFixed(2)}%)`);
ok(moveSum / moveN > 0.4, `the ball genuinely moves (mean ${(moveSum / moveN).toFixed(2)}m)`);
ok(nextAuthoredShape("__nothing_authored__", rng) === null,
  "a kind with nothing authored randomises to null, so callers fall through");

// A deliberately hostile rule set — one nothing can satisfy — NEVER yields a
// broken shape. It yields nothing, and the caller moves on to another
// drawing. Refusing to serve is the whole safety property.
const strict = deriveRuleSet("one_on_one", [sampleFromAuthored(pool[0])!]);
strict.rules.forEach(r => { r.invariant = true; });
ok(randomiseAuthored(pool[0], strict, mulberry32(7)) === null,
  "a rule set nothing can satisfy yields nothing, never a broken shape");

// ── ONE BAD DRAWING MUST NOT TAKE THE RULES DOWN WITH IT ──────────────────
//
// It used to. Measured: a single drawing with a defender left goal-side of
// the ball, added to eleven clean ones, destroyed 2 of the 3 laws and 15.0%
// of every chance served then broke its own definition. One drawing outvoted
// eleven. A law now holds at nine in ten, the drawing that disagrees is named
// as an outlier, and the randomiser never uses it as a base.

{
  const spoil = (src: MatchScenario, id: string): MatchScenario => {
    const g = JSON.parse(JSON.stringify(src)) as MatchScenario;
    const d = g.players.find(p => p.side === "opponent" && p.label !== "GK")!;
    d.y = g.ball.y - 4;            // squarely between you and the goal
    d.x = g.ball.x;
    return { ...g, id, updatedAt: Date.now() };
  };
  const lawCount = (rs: RuleSet) => rs.rules.filter(r => r.invariant).length;
  const lawsClean = lawCount(set);
  ok(lawsClean === 3, `the clean pool has three laws (${lawsClean})`);

  setLiveScenarioPool([spoil(pool[0], "oops-1")]);
  const dirty = ruleSetFor("one_on_one")!;
  ok(lawCount(dirty) === lawsClean, "one bad drawing loses no law");

  const named = outliersOf(dirty);
  ok(named.length > 0 && named.every(o => o.id === "oops-1"),
    "…and it is NAMED as the outlier, so a slip is visible not silent");

  const r2 = mulberry32(31337);
  let broke = 0, n3 = 0;
  for (let i = 0; i < 1200; i++) {
    const sh = nextAuthoredShape("one_on_one", r2);
    if (!sh) continue;
    n3++;
    ok(sh.sourceId !== "oops-1", "the bad drawing is never used as a base");
    if (violations(sh, set).length) broke++;   // judged against the TRUE laws
  }
  ok(n3 > 1000, `still serves normally (${n3}/1200)`);
  ok(broke === 0, `nothing broken reaches the game (${broke}/${n3}, was 15.0%)`);
  setLiveScenarioPool(null);
}

// A count that legitimately VARIES must never become a law — "three
// defenders" could hit nine in ten and then a four-defender one-on-one could
// never be served again. Only a ZERO is a law. See isLaw.
{
  const counts = set.rules.filter(r => r.count && r.invariant).map(r => r.id);
  ok(!counts.includes("defCount"), "defender count is never treated as a law");
  ok(!counts.includes("inBox"), "inside-the-box is never treated as a law");
  ok(set.rules.every(r => !r.invariant || r.min === 0),
    "every law is a zero — 'none of this happens'");
}

// ── Onto a live scenario ──────────────────────────────────────────────────

let placedD = 0, placedM = 0, trials = 0;
for (let i = 0; i < 200; i++) {
  const r = mulberry32(i * 31 + 5);
  const sc = buildScenario("one_on_one", r);
  fixBaseScenario(sc);
  const shape = nextAuthoredShape("one_on_one", r)!;
  const res = applyAuthoredShape(sc, shape);
  placedD += res.defendersPlaced; placedM += res.matesPlaced; trials++;
  const s = sampleFromScenario(sc);
  ok(Math.abs(s.ball.x - shape.ball.x) < 0.001 && Math.abs(s.ball.y - shape.ball.y) < 0.001,
    "the live ball lands exactly where the shape says");
  ok(Math.abs(s.you.x - shape.you.x) < 0.001, "and so do you");
  ok(Math.abs(s.keeper.x - shape.keeper.x) < 0.001, "and so does the keeper");
  // A runner left pointing at his old target sprints away the moment the
  // ball is struck, undoing the placement on screen.
  if (sc.runner) {
    ok(Math.abs(sc.runner.to.x - sc.runner.pos.x) < 0.001
      && Math.abs(sc.runner.to.y - sc.runner.pos.y) < 0.001,
      "a runner's target is re-anchored to where he now stands");
  }
  // Every figure inside the frame the picture was drawn in.
  const vp = sc.viewport;
  for (const d of sc.defenders) {
    ok(d.y >= vp.y1 - 2 && d.y <= vp.y2 + 2, "placed defenders are inside the camera");
  }
}
ok(placedD / trials >= 2.5, `defenders actually get placed (${(placedD / trials).toFixed(1)} per chance)`);
ok(placedM / trials >= 1.5, `team-mates actually get placed (${(placedM / trials).toFixed(1)} per chance)`);

// ── The keeper follows the ball ───────────────────────────────────────────
//
// He is DERIVED from the nudged ball (his drawing's own near-post share and
// advance re-applied), never copied and nudged separately. Copying measured
// 32.8% of nudges making his near-post cover WORSE, with the share running
// from -0.68 (shading the FAR post — the opposite of what every drawing
// does) to 1.34. Deriving him: 0.0%.

{
  const gkNP = MEASURES.find(m => m.id === "gkNearPost")!;
  const r = mulberry32(5150);
  let worse = 0, tot = 0, lo = Infinity, hi = -Infinity;
  for (let i = 0; i < 1500; i++) {
    const sh = nextAuthoredShape("one_on_one", r);
    if (!sh) continue;
    const b = sampleFromAuthored(pool.find(p => p.id === sh.sourceId)!)!;
    const v0 = gkNP.of(b), v1 = gkNP.of(sh);
    if (!Number.isFinite(v0) || !Number.isFinite(v1)) continue;
    tot++;
    if (v1 < v0 - 0.05) worse++;
    lo = Math.min(lo, v1); hi = Math.max(hi, v1);
  }
  ok(tot > 300, `enough wide-ball variants to judge the keeper on (${tot})`);
  ok(worse === 0, `a nudge never makes his near-post cover worse (${worse}/${tot})`);
  ok(lo > -0.2, `he never drifts round to the FAR post (worst ${lo.toFixed(2)})`);
  ok(hi < 1.0, `and never past square with the ball (worst ${hi.toFixed(2)})`);
}

// Tuning overrides every drawing's own share, for when a number is chosen by
// looking rather than by scanning.
{
  const wide = pool.find(x => Math.abs(sampleFromAuthored(x)!.ball.x - 34) > 3)!;
  const gkNP = MEASURES.find(m => m.id === "gkNearPost")!;
  KEEPER_TUNING.nearPost = 0.5;
  const tuned = randomiseAuthored(wide, set, mulberry32(11))!;
  ok(Math.abs(gkNP.of(tuned) - 0.5) < 0.02, "a tuned near-post share is what actually gets used");
  KEEPER_TUNING.nearPost = null;
  const untuned = randomiseAuthored(wide, set, mulberry32(11))!;
  ok(Math.abs(gkNP.of(untuned) - gkNP.of(tuned)) > 0.05,
    "...and clearing it goes back to the drawing's own");
}

// ── The PROCEDURAL base obeys the drawn rules too ─────────────────────────
//
// Not just the authored layer. A kind with drawings should have its plain
// engine build repaired to the same standard, or the two disagree about what
// the situation is. Measured 85.6% before the repair was widened (a defender
// goal-side but WIDE was exempt, and nothing cleared a team-mate out of the
// shooting lane in a base build), 100.0% after.

{
  let clean2 = 0;
  const N2 = 600;
  for (let i = 0; i < N2; i++) {
    const sc = buildScenario("one_on_one", mulberry32(i * 7717 + 3));
    fixBaseScenario(sc);
    if (violations(sampleFromScenario(sc), set).length === 0) clean2++;
  }
  ok(clean2 === N2, `every procedural one-on-one obeys the drawn rules (${clean2}/${N2})`);
}

// ── A gallery cell keeps its base as the pool grows ───────────────────────
//
// A cell is a fixed seed and a person edits the picture under it. Picking the
// base by index into the pool meant adding ONE drawing renumbered everything:
// measured, 199 of 400 cells (50%) repainted onto a different base, with
// whatever had been dragged still applied on top of an arrangement it was
// never made for.
//
// Rendezvous hashing instead. The first attempt at it combined id and seed
// with plain djb2 and measured 31% with one drawing winning 189 of 400 cells;
// with a proper avalanche it is 9%, against a theoretical floor of 1/12 = 8%.

{
  const seeds = Array.from({ length: 400 }, (_, i) => 7000 + i * 7);
  const idsNow = () => seeds.map(sd =>
    nextAuthoredShape("one_on_one", mulberry32(sd ^ 0x5bf03635), [], sd)!.sourceId);
  const b = idsNow();
  setLiveScenarioPool([{ ...pool[3], id: "zz-added", updatedAt: Date.now() }]);
  const a = idsNow();
  setLiveScenarioPool(null);
  const moved = b.filter((v, i) => v !== a[i]).length;
  ok(moved / seeds.length < 0.15,
    `adding one drawing moves few cells (${moved}/${seeds.length}, floor is 1/12)`);

  // Even spread, or one drawing would be most of what anybody ever sees.
  const counts = pool.map(x => b.filter(v => v === x.id).length);
  ok(Math.min(...counts) > 0, "every drawing is the base for some cell");
  ok(Math.max(...counts) / Math.min(...counts) < 4,
    `no drawing dominates (${Math.min(...counts)}-${Math.max(...counts)} cells each)`);

  // And the same cell asked twice is the same base, always.
  const twice = idsNow();
  ok(twice.every((v, i) => v === b[i]), "a cell's base is stable across calls");
}

// ── Offside: both halves of Law 11 ────────────────────────────────────────
//
// A team-mate BEHIND the ball cannot be offside however deep the back line
// is. Reported directly, and measured wrong on 3 of 3 calls across the
// authored one-on-ones before this was fixed.

let wouldHaveFlagged = 0;
for (const ms of pool) {
  const s = sampleFromAuthored(ms)!;
  const ys = [...s.defenders.map(d => d.y), s.keeper.y].sort((a, b) => a - b);
  if (ys.length < 2) continue;
  const line = ys[1];
  for (const m of s.mates) {
    const beyondLine = m.y < line - 0.01;
    const aheadOfBall = m.y < s.ball.y - 0.01;
    if (beyondLine && !aheadOfBall) wouldHaveFlagged++;
  }
}
ok(wouldHaveFlagged > 0,
  `the authored scenarios still contain men the OLD rule would have wrongly flagged (${wouldHaveFlagged}) — so this stays a real regression test`);

// And the real rule, through the real fault function, agrees with the law.
{
  const sc = buildScenario("one_on_one", mulberry32(3));
  fixBaseScenario(sc);
  const line = offsideLineOf(sc);
  if (line !== null && sc.secondaryRunners.length) {
    const r = sc.secondaryRunners[0];
    // Put him beyond the line but clearly BEHIND the ball: legal.
    r.pos.y = Math.max(sc.ball.y + 2, line - 3);
    const faults = (await import("@/lib/star/baseScenario")).scenarioFaults(sc);
    ok(!faults.includes("attacker offside"),
      "a man beyond the back line but behind the ball is NOT offside");
    // Now put him beyond both: offside.
    r.pos.y = Math.min(line - 1, sc.ball.y - 1);
    const faults2 = (await import("@/lib/star/baseScenario")).scenarioFaults(sc);
    ok(faults2.includes("attacker offside"),
      "a man beyond the back line AND ahead of the ball IS offside");
  }
}

// ── The readout a person actually reads ───────────────────────────────────

const lines = describeRuleSet(set);
ok(lines.length === set.rules.length, "every rule gets a line");
ok(lines.slice(0, inv.length).every(l => l.startsWith("ALWAYS")), "invariants are listed first");
ok(!lines.some(l => /gkNearPost|gkAdvance/.test(l)), "the readout uses plain English, not ids");
ok(lines.some(l => /near-post cover[^:]*: 0\.\d\d to 0\.\d\d/.test(l)),
  "a ratio reads as a ratio, not as metres");

console.log(`authoredChance: jitter ${JITTER_M}m, ${pool.length} drawings, ${served} draws`);
if (failed) { console.error(`\n${failed} FAILED`); process.exit(1); }
console.log("authoredChance: all checks passed");
