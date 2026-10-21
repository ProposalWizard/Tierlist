/**
 * B2b (after the B10 merge): offsides by chance kind, from the build-up's own
 * positions (the same law check as tests/star/fhrIntel.mts). Prints, per side
 * and per kind: build-ups, called offsides, offside passes NOT called (must be 0),
 * and how many header/volley build-ups end in the lofted cross.
 *
 *   npx tsx scripts/fhr/b2b-offside-by-kind.mts [count]
 */
import { forceFhrMode } from "../../lib/star/fhr/toggle";
import { forceChancesMode } from "../../lib/star/newChances";
import { servedChances } from "../../lib/star/fhr/servedChances";
import { fhrBuildUpFor, fhrWantsBuildUp, type FhrBuildUp } from "../../lib/star/fhr/buildUp";
import { goalInView } from "../../lib/star/canvasEngine";
import { HALF_LEN } from "../../lib/star/pitch";
import type { HiddenMatchInputs } from "../../lib/star/hiddenMatch";

const COUNT = Number(process.argv[2] ?? 600);
const inputsFor = (us: number, them: number): HiddenMatchInputs => ({ teamStrength: us, oppStrength: them, playerSkill: 60, position: "ST", matchFlow: true, context: {}, livePenalties: true });
forceFhrMode("on"); forceChancesMode("new");
for (const [us, them] of [[85, 65], [75, 75], [65, 85]] as const) {
  const rows: Record<string, { n: number; called: number; uncalled: number; crossed: number; problems: number }> = {};
  for (const c of servedChances({ count: COUNT, seed: 1234, inputs: inputsFor(us, them) })) {
    if (!fhrWantsBuildUp(c.sc.kind, c.moment)) continue;
    const b = fhrBuildUpFor(c.sc, c.moment) as FhrBuildUp;
    const r = (rows[c.sc.kind] ??= { n: 0, called: 0, uncalled: 0, crossed: 0, problems: 0 });
    r.n++;
    if (b.offside) r.called++;
    if (b.problems.length) r.problems++;
    const last = b.acts[b.acts.length - 1];
    if (!b.offside && last.type === "pass" && last.endZ) r.crossed++;
    if (!goalInView(c.sc.kind)) continue;
    const opps = b.people.filter((p) => p.side === "opp" || p.side === "keeper" || p.side === "oppx").map((p) => p.key);
    b.acts.forEach((a, k) => {
      if (a.type !== "pass") return;
      const by = k + 1 < b.acts.length ? b.actOwners[k + 1] : b.offside?.pass === k ? b.offside.by : "you";
      const p = b.posAt(by, a.t0);
      if (!p) return;
      const ys = opps.map((o) => b.posAt(o, a.t0)!.y).sort((x, y) => x - y);
      const off = p.y < HALF_LEN - 0.05 && p.y < a.from.y - 0.05 && p.y < ys[1] - 0.05;
      if (off && b.offside?.pass !== k) r.uncalled++;
    });
  }
  console.log(`\n${us} v ${them}`);
  let N = 0, C = 0, U = 0;
  for (const [k, r] of Object.entries(rows).sort()) {
    N += r.n; C += r.called; U += r.uncalled;
    console.log(`  ${k.padEnd(14)} build-ups ${String(r.n).padStart(4)}  called ${String(r.called).padStart(3)} (${((r.called / r.n) * 100).toFixed(1)}%)  uncalled ${r.uncalled}  with problems ${r.problems}${k === "header" || k === "volley" ? `  lofted cross at the end ${r.crossed}/${r.n - r.called}` : ""}`);
  }
  console.log(`  all            build-ups ${N}  called ${C} (${((C / N) * 100).toFixed(1)}%)  uncalled ${U}`);
}
forceFhrMode(null); forceChancesMode(null);
