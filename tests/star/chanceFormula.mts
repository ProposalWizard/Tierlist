import {
  buildScenario, goalInView, pickScenarioKindFrom,
  type Scenario, type ScenarioKind,
} from "../../lib/star/canvasEngine";
import {
  generateChances, allChances, applyChanceShape, buildChance,
  PARAM_SPACE, FILTER_RULES, DISTANCE_M,
  type ChanceSpec,
} from "../../lib/star/chanceFormula";
import {
  selectChance, newSelectionMemory, RECENT_MEMORY,
} from "../../lib/star/scenarioSelect";
import {
  newMatch, advanceUntilInvolved, resolveScenario,
  type HiddenMatchInputs, type ScenarioResult,
} from "../../lib/star/hiddenMatch";
import { CX, PITCH_W } from "../../lib/star/pitch";

/**
 * THE CHANCE FORMULA — measured, not asserted.
 *
 * Three things, in order:
 *  1. How big the parameter space actually is, and what the filter removed.
 *  2. That EVERY surviving scenario builds a legal Scenario through the real
 *     engine — nobody offside, the central channel covered, nobody behind the
 *     keeper or past the ball, everybody inside the frame.
 *  3. The before/after highlight distribution over hundreds of simulated
 *     matches, driven through newMatch/advanceUntilInvolved/resolveScenario
 *     exactly the way CanvasMatch drives them.
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

const gen = generateChances();
note.push(`SPACE: ${gen.report.crossings.toLocaleString()} crossings → ${gen.report.survivors.toLocaleString()} scenarios survive the filter`);
for (const rule of FILTER_RULES) {
  note.push(`  filtered by ${rule.id.padEnd(30)} ${String(gen.report.rejectedBy[rule.id]).padStart(7)}`);
}
note.push(`  by kind: ${PARAM_SPACE.kind.map(k => `${k} ${gen.report.byKind[k] ?? 0}`).join(" · ")}`);

check(gen.report.survivors > 500, "the space yields a real number of scenarios, not a handful");
check(gen.report.survivors < gen.report.crossings * 0.2, "the filter genuinely removes the bulk of the crossings");
for (const k of PARAM_SPACE.kind) {
  check((gen.report.byKind[k] ?? 0) > 0, `every kind has at least one surviving variant (${k})`);
}
// The filter's own promises, restated as assertions over the survivors.
for (const s of allChances()) {
  const p = s.params;
  if (p.kind === "header") check(p.distance === "in_box", "no headers from 35 yards");
  check(p.defenders <= 5, "no six-defender walls in open play");
  if (p.kind === "tight_angle") check(p.lateral !== "central", "a tight angle is never dead central");
}

// ── 2. Every one of them builds a legal Scenario ────────────────────────────

function legality(sc: Scenario, spec: ChanceSpec): string[] {
  const bad: string[] = [];
  const vp = sc.viewport;
  const inside = (p: { x: number; y: number }, what: string) => {
    if (p.x < vp.x1 - 0.05 || p.x > vp.x2 + 0.05 || p.y < vp.y1 - 0.05 || p.y > vp.y2 + 0.05) {
      bad.push(`${spec.id}: ${what} outside the viewport`);
    }
  };
  inside(sc.ball, "ball");
  inside(sc.player, "player");
  for (const d of sc.defenders) inside(d, "defender");

  // Offside: the second-last opponent, keeper included — the engine's own rule.
  if (goalInView(sc.kind) && sc.kind !== "corner") {
    const ys = sc.defenders.map(d => d.y).concat(sc.keeper.y).sort((a, b) => a - b);
    if (ys.length >= 2) {
      const line = ys[1];
      const off = (q: { y: number }) => q.y < line - 0.001;
      if (sc.runner && off(sc.runner.pos)) bad.push(`${spec.id}: target runner offside`);
      for (const r of sc.secondaryRunners) if (off(r.pos)) bad.push(`${spec.id}: support runner offside`);
      if (off(sc.follower)) bad.push(`${spec.id}: poacher offside`);
    }
  }

  // The central channel is never empty with the ball in or near the box.
  const bd = sc.ball.y;
  if (bd <= 24 && sc.defenders.length > 0
      && !sc.defenders.some(d => Math.abs(d.x - CX) <= 6.6)) {
    bad.push(`${spec.id}: nobody in the central channel`);
  }

  // Nobody behind the keeper, nobody past the ball, nobody standing on it.
  // "Past the ball" is skipped in a turned crossing frame: the ball is on the
  // byline there, so every defender in the box is legitimately upfield of it.
  const turned = sc.facing === "left" || sc.facing === "right";
  for (const d of sc.defenders) {
    if (d.y < sc.keeper.y - 0.05) bad.push(`${spec.id}: defender behind the keeper`);
    if (!turned && d.y > sc.ball.y + 0.05) bad.push(`${spec.id}: defender the wrong side of the ball`);
    if (Math.hypot(d.x - sc.ball.x, d.y - sc.ball.y) < 1.0) bad.push(`${spec.id}: defender on top of the ball`);
    if (d.x < 0 || d.x > PITCH_W) bad.push(`${spec.id}: defender off the pitch`);
  }
  if (sc.defenders.length === 0) bad.push(`${spec.id}: empty defence`);
  return bad;
}

{
  const rng = mulberry32(20260920);
  const specs = allChances();
  const failures: string[] = [];
  for (const spec of specs) {
    const sc = buildChance(spec, rng, 66, 60, 55);
    failures.push(...legality(sc, spec));
  }
  note.push(`LEGALITY: built all ${specs.length.toLocaleString()} scenarios through the real engine — ${failures.length} violations`);
  if (failures.length) note.push(`  first few: ${failures.slice(0, 5).join(" | ")}`);
  check(failures.length === 0, `every generated scenario is legal (${failures.length} violations)`);
}

// The ball genuinely lands in its own declared distance band.
{
  const rng = mulberry32(7);
  let wrong = 0;
  for (const spec of allChances()) {
    if (spec.params.camera !== "straight") continue;  // a turned crossing frame keeps the engine's own fixed ball
    const sc = buildChance(spec, rng);
    const [lo, hi] = DISTANCE_M[spec.params.distance];
    if (sc.ball.y < lo - 2 || sc.ball.y > hi + 2) wrong++;
  }
  check(wrong === 0, `the ball lands in the band the parameters asked for (${wrong} misses)`);
}

// ── 3. Distribution, before and after ───────────────────────────────────────

const EVEN: HiddenMatchInputs = { teamStrength: 70, oppStrength: 70, playerSkill: 65, pace: 60 };
const FULL_TIME = 90;
const MATCHES = 400;

type Roll = { kinds: string[]; sigs: string[]; repeats: number; total: number };

function standInResult(rng: () => number): ScenarioResult {
  const r = rng();
  return r < 0.12 ? "goal" : r < 0.45 ? "delivered" : r < 0.75 ? "saved" : "lost";
}

/**
 * Drive whole matches exactly the way CanvasMatch does: advance the hidden
 * match until it hands you a request, resolve what that request produced,
 * hand the outcome back, repeat to full time.
 */
function run(position: string, useFormula: boolean, seed: number): Roll {
  const kinds: string[] = [];
  const sigs: string[] = [];
  let repeats = 0;
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
      let kind: ScenarioKind;
      let sig: string;
      if (request.dribble) { kind = "dribble" as ScenarioKind; sig = "dribble"; }
      else {
        const spec = useFormula
          ? selectChance({ request, position, rng, memory })
          : null;
        if (spec) { kind = spec.kind; sig = spec.signature; }
        else {
          kind = pickScenarioKindFrom(position, rng, request.kinds);
          sig = kind;
        }
      }
      kinds.push(kind);
      if (sig === last) repeats++;
      last = sig;
      sigs.push(sig);
      resolveScenario(state, standInResult(rng));
      if (state.minute >= FULL_TIME) break;
    }
  }
  return { kinds, sigs, repeats, total: kinds.length };
}

function share(list: string[]): { table: [string, number][]; top3: number; distinct: number } {
  const counts: Record<string, number> = {};
  for (const k of list) counts[k] = (counts[k] ?? 0) + 1;
  const table = Object.entries(counts).sort((a, b) => b[1] - a[1])
    .map(([k, n]) => [k, n / list.length] as [string, number]);
  return { table, top3: table.slice(0, 3).reduce((s, [, v]) => s + v, 0), distinct: table.length };
}

for (const position of ["CM", "ST"]) {
  const before = run(position, false, 1000);
  const after = run(position, true, 1000);
  const b = share(before.kinds), a = share(after.kinds);
  const bs = share(before.sigs), as = share(after.sigs);
  note.push("");
  note.push(`DISTRIBUTION — ${position}, ${MATCHES} simulated matches each (${before.total} / ${after.total} highlights)`);
  note.push(`  ${"kind".padEnd(16)} before    after`);
  const keys = Array.from(new Set([...b.table.map(r => r[0]), ...a.table.map(r => r[0])]));
  for (const k of keys) {
    const bv = b.table.find(r => r[0] === k)?.[1] ?? 0;
    const av = a.table.find(r => r[0] === k)?.[1] ?? 0;
    note.push(`  ${k.padEnd(16)} ${(bv * 100).toFixed(1).padStart(5)}%  ${(av * 100).toFixed(1).padStart(6)}%`);
  }
  note.push(`  top-3 KIND share       ${(b.top3 * 100).toFixed(1).padStart(5)}%  ${(a.top3 * 100).toFixed(1).padStart(6)}%`);
  note.push(`  most common kind       ${b.table[0][0]} → ${a.table[0][0]}`);
  note.push(`  distinct SITUATIONS    ${String(bs.distinct).padStart(5)}   ${String(as.distinct).padStart(6)}`);
  note.push(`  top-3 SITUATION share  ${(bs.top3 * 100).toFixed(1).padStart(5)}%  ${(as.top3 * 100).toFixed(1).padStart(6)}%`);
  note.push(`  most common situation  ${bs.table[0][0]} (${(bs.table[0][1] * 100).toFixed(1)}%) → ${as.table[0][0]} (${(as.table[0][1] * 100).toFixed(1)}%)`);
  note.push(`  same situation twice running: ${(before.repeats / before.total * 100).toFixed(1)}% → ${(after.repeats / after.total * 100).toFixed(1)}%`);

  // The honest headline metric.
  //
  // A "kind" used to BE a situation — thirteen builders, one picture each —
  // so the before/after kind table alone understates what changed and, on its
  // own, moves the WRONG way: set pieces used to be served so often that they
  // flattened the kind mix by brute force, and correcting that (see
  // buildRequest's dead-ball block) concentrates what is left. What the player
  // actually sees is the SITUATION — this kind, from this distance, at this
  // angle — and that is what the formula multiplies.
  check(as.distinct > bs.distinct * 3, `${position}: far more distinct situations (${bs.distinct} → ${as.distinct})`);
  check(as.top3 < bs.top3 * 0.65, `${position}: the top-3 situation share falls by a third or more (${(bs.top3 * 100).toFixed(1)}% → ${(as.top3 * 100).toFixed(1)}%)`);
  check(a.table[0][0] !== "corner", `${position}: corners are no longer the single most common highlight`);
  // Still a real part of the game, not filtered out of existence. A striker's
  // own corner weight is 2 against a box's ~69, so his share is correctly the
  // lower of the two — he attacks corners, he does not take them.
  check((a.table.find(r => r[0] === "corner")?.[1] ?? 0) > 0.005,
    `${position}: corners still happen`);
  check(after.repeats / after.total < 0.02, `${position}: the same situation is essentially never served twice running (${(after.repeats / after.total * 100).toFixed(1)}%)`);
}

// The anti-repeat itself, directly.
{
  const mem = newSelectionMemory();
  const rng = mulberry32(3);
  const request = { zone: "box" as const, kinds: ["one_on_one", "tight_angle", "volley", "header", "cutback"] as ScenarioKind[], reason: "" };
  let repeats = 0;
  let last = "";
  for (let i = 0; i < 500; i++) {
    const spec = selectChance({ request, position: "ST", rng, memory: mem });
    if (!spec) { problems.push("selectChance found nothing for a box request"); break; }
    if (spec.signature === last) repeats++;
    last = spec.signature;
  }
  check(repeats === 0, `anti-repeat: 500 consecutive box chances, ${repeats} immediate repeats`);
  check(mem.recent.length === RECENT_MEMORY, "the memory holds exactly RECENT_MEMORY situations");
}

// Zero regression: everything the formula has no variant of falls through.
{
  const rng = mulberry32(11);
  const mem = newSelectionMemory();
  check(selectChance({ request: { zone: "box", kinds: ["penalty"], reason: "" }, position: "ST", rng, memory: mem }) === null,
    "a penalty falls through to today's behaviour");
  check(selectChance({ request: { zone: "attacking", kinds: ["corner"], reason: "" }, position: "ST", rng, memory: mem }) === null,
    "a corner falls through to today's behaviour");
  check(selectChance({ request: { zone: "own_box", kinds: ["buildup"], reason: "" }, position: "CB", rng, memory: mem }) === null,
    "a build-up falls through to today's behaviour");
  check(selectChance({ request: { zone: "middle", kinds: ["one_on_one"], reason: "", dribble: true }, position: "ST", rng, memory: mem }) === null,
    "a dribble request falls through to today's behaviour");
}

// ── Report ──────────────────────────────────────────────────────────────────

console.log(note.join("\n"));
if (problems.length) {
  console.error("\nFAILURES:\n" + problems.map(p => " - " + p).join("\n"));
  process.exit(1);
}
console.log("\nchanceFormula.mts — all checks pass");
