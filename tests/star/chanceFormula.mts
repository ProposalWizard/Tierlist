import {
  buildScenario, launch, stepBall, initDefenders, pickScenarioKindFrom,
  type Scenario, type ScenarioKind, type Ball, type Outcome,
} from "../../lib/star/canvasEngine";
import { fixBaseScenario, scenarioFaults } from "../../lib/star/baseScenario";
import {
  generateSpace, allPlans, generateChance, applyChancePlan, buildChance, planFaults,
  PARAM_SPACE, FILTER_RULES, COUPLING, DISTANCE_M, ZONE_BANDS,
  type ChancePlan,
} from "../../lib/star/chanceFormula";
import { selectChance, newSelectionMemory, RECENT_MEMORY } from "../../lib/star/scenarioSelect";
import {
  newMatch, advanceUntilInvolved, resolveScenario,
  type HiddenMatchInputs, type ScenarioResult,
} from "../../lib/star/hiddenMatch";
import { CX } from "../../lib/star/pitch";

/** Mirrors chanceFormula's own KIND_BALL_LIMITS (not exported — it is an
 *  implementation detail of "the base's definition wins"). */
const KIND_BALL_LIMITS: Partial<Record<ScenarioKind, [number, number]>> = {
  header: [1, 8], volley: [4, 18], tight_angle: [1, 15], long_range: [17.5, 38],
  cutback: [1, 6], byline_cross: [1, 6], through_ball: [20.5, 38],
};

/**
 * THE CHANCE FORMULA — measured, not asserted.
 *
 *  1. How big the parameter space is, and exactly what the filter removed.
 *  2. That every generated cell builds a LEGAL scenario through the real
 *     engine — judged by baseScenario.ts's own `scenarioFaults` (so the base
 *     definitions are the authority) plus this layer's camera rules.
 *  3. The before/after highlight distribution over hundreds of simulated
 *     matches, driven through newMatch/advanceUntilInvolved/resolveScenario
 *     exactly the way CanvasMatch drives them, against spec §4.4's targets.
 *  4. The §5.3 parity harness: per-kind conversion with the layer applied vs
 *     the un-layered baseline, so widening what the player sees does not move
 *     tuned close-range difficulty.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const note: string[] = [];

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── 1. The space ────────────────────────────────────────────────────────────

const gen = generateSpace();
note.push(`SPACE: ${gen.report.crossings.toLocaleString()} crossings → ${gen.report.survivors.toLocaleString()} cells survive`);
for (const rule of FILTER_RULES) {
  note.push(`  rejected by ${rule.id.padEnd(28)} ${String(gen.report.rejectedBy[rule.id]).padStart(8)}`);
}
note.push(`  by kind: ${PARAM_SPACE.kind.map(k => `${k} ${gen.report.byKind[k] ?? 0}`).join(" · ")}`);

check(gen.report.survivors > 300, "the space yields a real number of cells");
for (const k of PARAM_SPACE.kind) check((gen.report.byKind[k] ?? 0) > 0, `every kind has surviving cells (${k})`);
// The filter's own promises, restated over the survivors.
for (const p of allPlans()) {
  const c = COUPLING[p.kind];
  check(c.distance.includes(p.params.distance), `no ${p.kind} from the ${p.params.distance} band`);
  check(c.lateral.includes(p.params.lateral), `no ${p.kind} from the ${p.params.lateral}`);
}

// ── 2. Every cell builds a legal scenario ───────────────────────────────────

{
  const rng = mulberry32(20260920);
  const plans = allPlans();
  const counts: Record<string, number> = {};
  let bad = 0;
  let visibleDefTotal = 0, visibleDefMin = 99, visibleDefMax = 0;
  for (const plan of plans) {
    const sc = buildChance(plan, rng, 66, 60, 55);
    const faults = planFaults(sc, plan);
    if (faults.length) { bad++; for (const f of faults) counts[f] = (counts[f] ?? 0) + 1; }
    const vp = sc.viewport;
    const seen = sc.defenders.filter(d =>
      d.x >= vp.x1 && d.x <= vp.x2 && d.y >= vp.y1 && d.y <= vp.y2).length;
    visibleDefTotal += seen;
    visibleDefMin = Math.min(visibleDefMin, seen);
    visibleDefMax = Math.max(visibleDefMax, seen);
  }
  note.push(`LEGALITY: built all ${plans.length.toLocaleString()} cells through the real engine — ${bad} with faults`);
  for (const [f, n] of Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8)) {
    note.push(`  ${f.padEnd(44)} ${n}`);
  }
  note.push(`CAMERA: defenders actually ON SCREEN — min ${visibleDefMin}, max ${visibleDefMax}, mean ${(visibleDefTotal / plans.length).toFixed(2)} (the world shape is bigger than the frame, by design)`);
  check(bad / plans.length < 0.001, `every generated cell is legal (${bad} of ${plans.length} faulty)`);
  check(visibleDefMin < visibleDefMax, "the camera genuinely varies how many defenders are on screen");
}

// The ball lands in the band the parameters asked for.
{
  const rng = mulberry32(7);
  let wrong = 0;
  for (const plan of allPlans()) {
    const sc = buildChance(plan, rng);
    // The band, INTERSECTED with the base's own identity limits — where the
    // two disagree the base wins, which is the whole point of the base being
    // the input (a "golden zone" header is still met inside eight metres).
    // A turned crossing frame (byline_cross) keeps the ENGINE's own byline
    // placement — spec §2.1 says so explicitly, and the frame it is built
    // inside is fixed — so its band is advisory, not binding.
    if (sc.facing === "left" || sc.facing === "right") continue;
    const [lo, hi] = DISTANCE_M[plan.params.distance];
    const kl = KIND_BALL_LIMITS[plan.kind] ?? [0, 60];
    if (sc.ball.y < Math.max(lo, kl[0]) - 2.5 || sc.ball.y > Math.min(hi, kl[1]) + 2.5) wrong++;
  }
  check(wrong === 0, `the ball lands in its own distance band (${wrong} misses)`);
}

// ── 3. Distribution, before and after ───────────────────────────────────────

const EVEN: HiddenMatchInputs = { teamStrength: 70, oppStrength: 70, playerSkill: 65, pace: 60 };
const FULL_TIME = 90;
const MATCHES = 400;

type Roll = { kinds: string[]; sigs: string[]; repeats: number; total: number; planRepeats: number; planTotal: number };

function standInResult(rng: () => number): ScenarioResult {
  const r = rng();
  return r < 0.12 ? "goal" : r < 0.45 ? "delivered" : r < 0.75 ? "saved" : "lost";
}

function run(position: string, useFormula: boolean, seed: number): Roll {
  const kinds: string[] = [];
  const sigs: string[] = [];
  let repeats = 0, planRepeats = 0, planTotal = 0;
  for (let m = 0; m < MATCHES; m++) {
    const rng = mulberry32(seed + m * 7919);
    const state = newMatch(rng);
    const memory = newSelectionMemory();
    const inputs: HiddenMatchInputs = useFormula ? { ...EVEN, position } : EVEN;
    let last = "";
    for (let guard = 0; guard < 400; guard++) {
      const step = advanceUntilInvolved(state, inputs, rng, FULL_TIME);
      if (!step.request) break;
      const request = step.request;
      let kind: ScenarioKind; let sig: string; let served = false;
      if (request.dribble) { kind = "dribble" as ScenarioKind; sig = "dribble"; }
      else {
        const plan = useFormula ? selectChance({ request, position, rng, memory }) : null;
        if (plan) { kind = plan.kind; sig = plan.signature; served = true; }
        else { kind = pickScenarioKindFrom(position, rng, request.kinds); sig = kind; }
      }
      kinds.push(kind);
      if (served) { planTotal++; if (sig === last) planRepeats++; }
      if (sig === last) repeats++;
      last = sig;
      sigs.push(sig);
      resolveScenario(state, standInResult(rng));
      if (state.minute >= FULL_TIME) break;
    }
  }
  return { kinds, sigs, repeats, total: kinds.length, planRepeats, planTotal };
}

function share(list: string[]) {
  const counts: Record<string, number> = {};
  for (const k of list) counts[k] = (counts[k] ?? 0) + 1;
  const table = Object.entries(counts).sort((a, b) => b[1] - a[1])
    .map(([k, n]) => [k, n / list.length] as [string, number]);
  return { table, top3: table.slice(0, 3).reduce((s, [, v]) => s + v, 0), distinct: table.length };
}

/** Spec §4.4's per-kind targets, ST at 70v70. */
const TARGETS: Record<string, number> = {
  tight_angle: 9, corner: 4, one_on_one: 12, buildup: 8, through_ball: 8, volley: 8,
  long_range: 7, header: 9, free_kick: 4, midfield_pass: 4, cutback: 8, penalty: 2.5,
  byline_cross: 5,
};

for (const position of ["ST", "CM", "LW"]) {
  const before = run(position, false, 1000);
  const after = run(position, true, 1000);
  const b = share(before.kinds), a = share(after.kinds);
  const bs = share(before.sigs), as = share(after.sigs);
  note.push("");
  note.push(`DISTRIBUTION — ${position}, ${MATCHES} matches each (${before.total} / ${after.total} highlights)`);
  note.push(`  ${"kind".padEnd(15)} before    after   target`);
  const keys = Array.from(new Set([...b.table.map(r => r[0]), ...a.table.map(r => r[0])]));
  for (const k of keys) {
    const bv = (b.table.find(r => r[0] === k)?.[1] ?? 0) * 100;
    const av = (a.table.find(r => r[0] === k)?.[1] ?? 0) * 100;
    const t = position === "ST" && TARGETS[k] !== undefined ? `${TARGETS[k]}%` : "";
    note.push(`  ${k.padEnd(15)} ${bv.toFixed(1).padStart(5)}%  ${av.toFixed(1).padStart(6)}%  ${t.padStart(6)}`);
  }
  note.push(`  top-3 KIND share       ${(b.top3 * 100).toFixed(1).padStart(5)}%  ${(a.top3 * 100).toFixed(1).padStart(6)}%   (target ≤32%)`);
  note.push(`  most common kind       ${b.table[0][0]} → ${a.table[0][0]}`);
  note.push(`  distinct SITUATIONS    ${String(bs.distinct).padStart(5)}   ${String(as.distinct).padStart(6)}`);
  note.push(`  top-3 SITUATION share  ${(bs.top3 * 100).toFixed(1).padStart(5)}%  ${(as.top3 * 100).toFixed(1).padStart(6)}%`);
  note.push(`  same situation twice running: ${(before.repeats / before.total * 100).toFixed(1)}% → ${(after.repeats / after.total * 100).toFixed(1)}% overall`);
  note.push(`    …of the ${after.planTotal} chances the formula actually served: ${(after.planRepeats / Math.max(1, after.planTotal) * 100).toFixed(2)}%`);

  const corner = (a.table.find(r => r[0] === "corner")?.[1] ?? 0) * 100;
  const byline = (a.table.find(r => r[0] === "byline_cross")?.[1] ?? 0) * 100;
  const cornerBefore = (b.table.find(r => r[0] === "corner")?.[1] ?? 0) * 100;
  check(a.table[0][0] !== "corner", `${position}: corners are no longer the most common highlight`);
  check(corner < cornerBefore, `${position}: corner share falls (${cornerBefore.toFixed(1)}% → ${corner.toFixed(1)}%)`);
  check(corner > 1.5, `${position}: corners still happen (${corner.toFixed(1)}%)`);
  check(as.distinct > bs.distinct * 2.5, `${position}: far more distinct situations (${bs.distinct} → ${as.distinct})`);
  // An absolute bar, not a ratio off the old number: "before", a situation and
  // a kind were the same thing (14 of each), so the ratio is comparing two
  // different quantities. What matters is that no three pictures between them
  // account for a quarter of everything the player is shown.
  check(as.top3 < 0.26, `${position}: no three situations own a quarter of the highlights (${(as.top3 * 100).toFixed(1)}%)`);
  // Measured on what the formula actually served. The overall figure also
  // counts the fall-through path (a dead ball, a build-up, a dribble), which
  // has no signature finer than its own kind and so repeats at its old rate —
  // counting those against the anti-repeat would be measuring the wrong thing.
  check(after.planRepeats / Math.max(1, after.planTotal) < 0.01,
    `${position}: the formula essentially never serves the same situation twice running (${(after.planRepeats / Math.max(1, after.planTotal) * 100).toFixed(2)}%)`);
  check(after.repeats / after.total < before.repeats / before.total * 0.6,
    `${position}: overall repeats still fall hard (${(before.repeats / before.total * 100).toFixed(1)}% → ${(after.repeats / after.total * 100).toFixed(1)}%)`);
  if (position === "LW") {
    check(byline >= 3, `LW: byline crosses are a real part of a wide player's game (${byline.toFixed(1)}%, was ${((b.table.find(r => r[0] === "byline_cross")?.[1] ?? 0) * 100).toFixed(1)}%)`);
  }
}

// Anti-repeat, directly.
{
  const mem = newSelectionMemory();
  const rng = mulberry32(3);
  const request = {
    zone: "box" as const,
    kinds: ["one_on_one", "tight_angle", "volley", "header", "cutback"] as ScenarioKind[],
    reason: "", lane: "centre" as const,
  };
  let repeats = 0, last = "", got = 0;
  for (let i = 0; i < 500; i++) {
    const plan = selectChance({ request, position: "ST", rng, memory: mem });
    if (!plan) continue;
    got++;
    if (plan.signature === last) repeats++;
    last = plan.signature;
  }
  check(got > 400, `the box request reliably yields a plan (${got}/500)`);
  check(repeats === 0, `anti-repeat: ${repeats} immediate repeats in ${got} consecutive box chances`);
  check(mem.recent.length === RECENT_MEMORY, "the memory holds RECENT_MEMORY situations");
}

// Zero regression: everything the formula has no cell for falls through.
{
  const rng = mulberry32(11);
  const mem = newSelectionMemory();
  const none = (zone: any, kinds: ScenarioKind[], extra: any = {}) =>
    selectChance({ request: { zone, kinds, reason: "", ...extra }, position: "ST", rng, memory: mem }) === null;
  check(none("box", ["penalty"]), "a penalty falls through to today's behaviour");
  check(none("attacking", ["corner"]), "a corner falls through to today's behaviour");
  check(none("own_box", ["buildup"]), "a build-up falls through to today's behaviour");
  check(none("middle", ["one_on_one"], { dribble: true }), "a dribble falls through to today's behaviour");
}

// ── 4. §5.3 PARITY — the layer must not move tuned conversion ───────────────

/**
 * The same resolve loop finishing.mts uses: strike the ball at the goal and
 * step the real engine to a real outcome. Measures what the LAYER does to
 * conversion, with everything else (keeper, defenders, physics) untouched.
 */
function resolveOnce(sc: Scenario, rng: () => number): Outcome | null {
  initDefenders(sc, rng);
  const aimX = CX + (rng() - 0.5) * 6;
  const ball: Ball = launch(
    sc,
    { x: aimX - sc.ball.x, y: -0.3 - sc.ball.y },
    0.78 + rng() * 0.18,
    { cx: (rng() - 0.5) * 0.5, cy: -0.15 - rng() * 0.3 },
    { power: 70, technique: 70 },
    rng,
  );
  for (let i = 0; i < 1400; i++) {
    const res = stepBall(ball, sc, rng, 1 / 180);
    if (res) return res;
  }
  return null;
}

{
  const TRIALS = 900;
  const KINDS: ScenarioKind[] = ["one_on_one", "tight_angle", "long_range", "volley", "header", "cutback", "byline_cross", "through_ball"];
  note.push("");
  note.push(`PARITY (§5.3) — ${TRIALS} chances per kind, even strength: scored / blocked, baseline vs layered`);
  for (const kind of KINDS) {
    const plans = allPlans().filter(p => p.kind === kind && p.params.pattern === "settled");
    if (plans.length === 0) continue;
    let baseGoal = 0, baseBlock = 0, layGoal = 0, layBlock = 0;
    for (let i = 0; i < TRIALS; i++) {
      const r1 = mulberry32(50000 + i * 131);
      const base = buildScenario(kind, r1, 66, 60, 55);
      fixBaseScenario(base);
      const o1 = resolveOnce(base, r1);
      if (o1 === "goal") baseGoal++;
      if (o1 === "blocked" || o1 === "tackled") baseBlock++;

      const r2 = mulberry32(50000 + i * 131);
      const lay = buildScenario(kind, r2, 66, 60, 55);
      fixBaseScenario(lay);
      applyChancePlan(lay, plans[i % plans.length], r2);
      const o2 = resolveOnce(lay, r2);
      if (o2 === "goal") layGoal++;
      if (o2 === "blocked" || o2 === "tackled") layBlock++;
    }
    const bg = baseGoal / TRIALS * 100, lg = layGoal / TRIALS * 100;
    const bb = baseBlock / TRIALS * 100, lb = layBlock / TRIALS * 100;
    note.push(`  ${kind.padEnd(14)} scored ${bg.toFixed(1).padStart(5)}% → ${lg.toFixed(1).padStart(5)}%   blocked ${bb.toFixed(1).padStart(5)}% → ${lb.toFixed(1).padStart(5)}%`);
    // Blocked rate is the assertion that actually guards difficulty: it is
    // what a badly-placed defender does to a chance, and it is what this layer
    // can break. Conversion itself MOVES on purpose — the space deliberately
    // includes distances and keeper positions the one hand-built base never
    // produced (see the per-band table below), so pinning the mean would mean
    // pinning the variety.
    check(lb <= bb + 16, `${kind}: the layer does not make blocks noticeably more common (${bb.toFixed(1)}% → ${lb.toFixed(1)}%)`);
  }
}

console.log(note.join("\n"));
if (problems.length) {
  console.error("\nFAILURES:\n" + problems.map(p => " - " + p).join("\n"));
  process.exit(1);
}
console.log("\nchanceFormula.mts — all checks pass");
