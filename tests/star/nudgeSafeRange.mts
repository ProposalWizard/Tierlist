/**
 * tests/star/nudgeSafeRange.mts — HOW FAR CAN A DRAWING BE NUDGED BEFORE IT BREAKS?
 *
 * A measurement, not a gate. For every kind served from drawings, each drawing
 * is served NUDGE_N times (seeded) the way makeChance serves it (buildScenario,
 * randomiseAuthored, applyAuthoredShape, setupKind, separateBodies,
 * finishServedFrame), at nudge scale 0, 1, 1.5, 2 and 3 × today's nudge
 * (JITTER_M = 2 m on every man, the ball and you 1.2 m; randomiseAuthored's own
 * smaller-and-smaller retry ladder still runs). JITTER_M is NOT changed: the
 * scale goes in through randomiseAuthored's optional `nudgeScale` (absent = 1,
 * the game as today).
 *
 * Per kind and scale it prints:
 *   servedFaults %   — any fault the game's serving checks find
 *   scenarioFaults % — the game's own base-scenario checks
 *   full nudge %     — the full-size nudge kept (not stepped down by the ladder)
 *   gap median, ≥3 m — picture distance from the same drawing served unnudged,
 *                      against SAME_PICTURE_M (3 m: "reads as a new picture")
 *   after rebuilds   — the same, but as the game serves: a picture with a
 *                      fault the serving ADDED (drawingOwnFaults) is rebuilt,
 *                      up to MAX_TRIES (one drawing; the game may also switch
 *                      drawing), and only ADDED faults are counted
 * and the largest SAFE scale, raw and after rebuilds: both fault rates within
 * 1 point of scale 0, every step up to it checked in order.
 *
 * Only a crash fails it. NUDGE_N=<n> for a quicker run (default 1000).
 */
import { buildScenario, type ScenarioKind } from "../../lib/star/canvasEngine";
import { authoredPool, ruleSetFor, randomiseAuthored, applyAuthoredShape, DEAD_BALL_EXACT } from "../../lib/star/authoredChance";
import { outliersOf } from "../../lib/star/scenarioRules";
import { servedFaults, servesDrawings, pictureOf, pictureDistance, SAME_PICTURE_M, drawingOwnFaults, MAX_TRIES } from "../../lib/star/chanceMaker";
import { scenarioFaults } from "../../lib/star/baseScenario";
import { setupKind } from "../../lib/star/kindRules";
import { separateBodies } from "../../lib/star/spacing";
import { finishServedFrame } from "../../lib/star/goalFrame";
import { EVEN_KINDS } from "../../lib/star/kindMix";
import { mulberry32 } from "../../lib/star/season";

const N = Number(process.env.NUDGE_N ?? 1000);
const SCALES = [0, 1, 1.5, 2, 3];
const KINDS = [...new Set<ScenarioKind>([...EVEN_KINDS, "one_on_one", "tight_angle", "long_range", "cutback", "byline_cross", "corner", "free_kick", "penalty", "midfield_pass", "through_ball"])]
  .filter((k) => servesDrawings(k));

interface Cell { served: number; base: number; full: number; gaps: number[]; retryServed: number; retryBase: number }

function serveOne(kind: ScenarioKind, ms: ReturnType<typeof authoredPool>[number], set: NonNullable<ReturnType<typeof ruleSetFor>>, seed: number, scale: number) {
  const rng = mulberry32(seed);
  const sc = buildScenario(kind, rng, 62, 60, 55);
  const shape = randomiseAuthored(ms, set, rng, { fixedBall: kind === "corner", nudgeScale: scale });
  if (!shape) return null;
  applyAuthoredShape(sc, shape);
  setupKind(sc, rng, { appliedAuthored: true, appliedPlan: false, keeperStrength: 62 });
  separateBodies(sc);
  finishServedFrame(sc);
  return { sc, jitter: shape.jitter ?? 0 };
}

const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const pct = (n: number, d: number) => (d ? (100 * n) / d : 0);
const f1 = (v: number) => `${v.toFixed(1)}%`;

console.log(`Each drawing served ${N} times per scale; scale × JITTER_M (2 m) on men, × 1.2 m on ball and you.`);
const summary: string[] = [];
for (const kind of KINDS) {
  const set = ruleSetFor(kind)!;
  const pool = authoredPool(kind);
  const bad = new Set(outliersOf(set).map((o) => o.id));
  const clean = pool.filter((s) => !bad.has(s.id));
  const from = clean.length ? clean : pool;
  const cells = SCALES.map((): Cell => ({ served: 0, base: 0, full: 0, gaps: [], retryServed: 0, retryBase: 0 }));
  let total = 0;
  for (const ms of from) {
    for (let i = 0; i < N; i++) {
      const seed = (0x9e3779b1 ^ (i * 2654435761) ^ ms.id.length * 7919) >>> 0;
      const p0 = serveOne(kind, ms, set, seed, 0);
      if (!p0) continue;
      const pic0 = pictureOf(p0.sc);
      total++;
      SCALES.forEach((scale, si) => {
        const r = scale === 0 ? p0 : serveOne(kind, ms, set, seed, scale);
        if (!r) return;
        const c = cells[si];
        if (servedFaults(r.sc).length) c.served++;
        if (scenarioFaults(r.sc).length) c.base++;
        if (r.jitter >= 1) c.full++;
        const pic = pictureOf(r.sc);
        // Camera left out: it follows the ball, and the frame rule may slide it.
        c.gaps.push(pictureDistance({ ...pic, cam: pic0.cam }, pic0));
        // As the game serves it: a picture with a fault the serving ADDED (not
        // one the drawing has itself) is rebuilt, up to MAX_TRIES in all.
        const own = drawingOwnFaults(kind, ms.id, false);
        let last = r.sc;
        for (let t = 0; t < MAX_TRIES; t++) {
          const rt = t === 0 ? r : serveOne(kind, ms, set, (seed ^ ((t + 1) * 0x85ebca6b)) >>> 0, scale);
          if (!rt) continue;
          last = rt.sc;
          if (!servedFaults(rt.sc).some((f) => !own.includes(f))) break;
        }
        if (servedFaults(last).some((f) => !own.includes(f))) c.retryServed++;
        if (scenarioFaults(last).some((f) => !own.includes(f))) c.retryBase++;
      });
    }
  }
  const exact = DEAD_BALL_EXACT.has(kind);
  console.log(`\n== ${kind} — ${from.length} drawings × ${N} = ${total} serves${exact ? " (dead ball: served exactly, never nudged)" : kind === "corner" ? " (ball fixed on the flag; men nudged)" : ""}`);
  console.log("  scale  servedFaults  scenarioFaults  | after rebuilds: added served  added scenario  | full nudge  gap median  gap ≥3 m");
  const s0 = pct(cells[0].served, total), b0 = pct(cells[0].base, total);
  const rs0 = pct(cells[0].retryServed, total), rb0 = pct(cells[0].retryBase, total);
  let safe = 0, safeServed = 0;
  SCALES.forEach((scale, si) => {
    const c = cells[si];
    const sv = pct(c.served, total), bv = pct(c.base, total);
    const rs = pct(c.retryServed, total), rb = pct(c.retryBase, total);
    const ok = sv - s0 <= 1 && bv - b0 <= 1;
    const okServed = rs - rs0 <= 1 && rb - rb0 <= 1;
    if (ok && safe === SCALES[si - 1]) safe = scale;
    if (okServed && safeServed === SCALES[si - 1]) safeServed = scale;
    const flag = scale === 0 ? "" : `${ok ? "" : "  raw over +1"}${okServed ? "" : "  served over +1"}`;
    console.log(`  ${String(scale).padStart(4)}×  ${f1(sv).padStart(12)}  ${f1(bv).padStart(14)}  | ${f1(rs).padStart(28)}  ${f1(rb).padStart(14)}  | ${(scale === 0 || exact ? "—" : f1(pct(c.full, total))).padStart(10)}  ${(median(c.gaps).toFixed(2) + " m").padStart(10)}  ${f1(pct(c.gaps.filter((g) => g >= SAME_PICTURE_M).length, total)).padStart(8)}${flag}`);
  });
  const gapOf = (sc: number) => { const c = cells[SCALES.indexOf(sc)]; return `${median(c.gaps).toFixed(2)} m, ${f1(pct(c.gaps.filter((g) => g >= SAME_PICTURE_M).length, total))} ≥ ${SAME_PICTURE_M} m`; };
  const line = exact
    ? `${kind.padEnd(14)} not nudged (dead ball)`
    : `${kind.padEnd(14)} raw: ${safe}× (${gapOf(safe)})   as served, after rebuilds: ${safeServed}× (${gapOf(safeServed)})   today 1×: ${gapOf(1)}`;
  summary.push(line);
  if (!exact && safeServed < 1) console.log(`  WARN ${kind}: even after rebuilds, today's nudge adds more than 1 point of faults`);
}
console.log("\n== Largest safe nudge per kind (faults within 1 point of the unnudged drawing; steps checked in order)");
for (const l of summary) console.log("  " + l);
console.log("\ndone (measurement only; warnings do not fail)");
