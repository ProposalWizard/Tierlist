/**
 * Real Goals: "if the shot is almost exactly like the real shot then it WILL
 * go in no matter what" (Leo, 19 Oct 2026).
 *
 * For a sample of real goals, strike at the real spot and at spots 0.2-0.75 m
 * off it (in a random direction), with the v0.17 lane box and with today's
 * round lane. Each strike is grouped by the page's own accuracy % of where it
 * really crossed. A goal for every strike at 70%+ is the promise.
 *
 * Run: npx tsx tests/star/realGoals/lane.mts [goals=80] [seeds=2]
 */
import { loadGoals, aimAtReal, playStrike } from "./harness.mts";
import { realEnd, accuracyPct, LANE_PCT } from "../../../lib/star/realGoals";
import { POST_L, POST_R } from "../../../lib/star/pitch";

export function measureLane(nGoals = 80, seeds = 2, log = false) {
  const all = loadGoals().filter((g) => g.shot.type !== "Penalty");
  // An even spread over every collection.
  const step = Math.max(1, Math.floor(all.length / nGoals));
  const goals = all.filter((_, i) => i % step === 0).slice(0, nGoals);
  const bands = [[90, 101], [70, 90], [50, 70], [0, 50]] as const;
  const tally = { box: bands.map(() => ({ n: 0, goal: 0 })), page: bands.map(() => ({ n: 0, goal: 0 })) };
  const misses: string[] = [];
  let k = 0;
  for (const g of goals) {
    const e = realEnd(g);
    for (const off of [0, 0.25, 0.45, 0.6, 0.75]) {
      const a = (k++ * 2.399) % (2 * Math.PI);
      const target = { x: Math.min(POST_R - 0.25, Math.max(POST_L + 0.25, e.x + off * Math.cos(a))), z: Math.min(2.2, Math.max(0.12, e.z + off * Math.sin(a))) };
      const aim = aimAtReal(g, target);
      for (let s = 0; s < seeds; s++) {
        const seed = (4100 + s * 7919 + k) >>> 0;
        for (const mode of ["box", "page"] as const) {
          const p = playStrike(g, aim, mode === "box" ? "box" : true, seed, false);
          const pct = Number.isNaN(p.x) ? 0 : accuracyPct(e, { x: p.x, z: p.z });
          const b = bands.findIndex(([lo, hi]) => pct >= lo && pct < hi);
          tally[mode][b].n++;
          if (p.goal) tally[mode][b].goal++;
          else if (mode === "page" && pct >= LANE_PCT) misses.push(`${g.id} ${g.shot.player} ${pct.toFixed(0)}% → ${p.outcome}`);
        }
      }
    }
  }
  const rows = bands.map(([lo, hi], i) => ({ band: `${lo}-${Math.min(100, hi)}%`, box: tally.box[i], page: tally.page[i] }));
  if (log) {
    console.log(`${goals.length} goals × 5 spots × ${seeds} seeds`);
    for (const r of rows) console.log(`  like the real one ${r.band.padEnd(8)}  v0.17 box ${pc(r.box)}  →  now ${pc(r.page)}`);
    if (misses.length) console.log("  70%+ and NOT a goal:\n    " + misses.slice(0, 20).join("\n    "));
  }
  return { rows, misses };
}
const pc = (t: { n: number; goal: number }) => `${t.n ? ((100 * t.goal) / t.n).toFixed(1) : "-"}% of ${t.n}`.padEnd(14);

if (process.argv[1]?.endsWith("lane.mts")) {
  const t0 = Date.now();
  measureLane(Number(process.argv[2] ?? 80), Number(process.argv[3] ?? 2), true);
  console.log(`(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
