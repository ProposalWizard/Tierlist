/** B10 probe: the generated build-ups (Full highlights rebuild On) of header
 *  and volley chances end with a lofted ball INTO THE AIR to you.
 *  npx tsx scripts/b10/buildupProbe.mts [count=60] */
import { servedChances } from "../../lib/star/fhr/servedChances";
import { fhrBuildUpFor, fhrWantsBuildUp } from "../../lib/star/fhr/buildUp";
import { arriveZ } from "../../lib/star/airDrawings";

const count = Number(process.argv[2] ?? 60);
const pool = servedChances({ count: count * 8, seed: 202 }).filter((c) => (c.sc.kind === "header" || c.sc.kind === "volley") && fhrWantsBuildUp(c.sc.kind, c.moment)).slice(0, count);
const tally: Record<string, { n: number; lofted: number; byCrosser: number; endOk: number; clean: number; dur: number; problems: Map<string, number> }> = {};
for (const c of pool) {
  const b = fhrBuildUpFor(c.sc, c.moment);
  const t = (tally[c.sc.kind] ??= { n: 0, lofted: 0, byCrosser: 0, endOk: 0, clean: 0, dur: 0, problems: new Map() });
  t.n++; t.dur += b.durS;
  const last = b.acts[b.acts.length - 1];
  if (last.type === "pass" && last.h > 0 && (last.endZ ?? 0) > 0) t.lofted++;
  const cr = c.sc.teammates[0];
  if (cr && Math.hypot(last.from.x - cr.x, last.from.y - cr.y) < 0.01) t.byCrosser++;
  const z = b.ballAt(b.durS).z;
  if (Math.abs(z - arriveZ(c.sc.kind)) < 0.01) t.endOk++;
  if (!b.problems.length) t.clean++;
  for (const p of b.problems) { const k = p.replace(/[\d.]+/g, "#"); t.problems.set(k, (t.problems.get(k) ?? 0) + 1); }
}
for (const [k, t] of Object.entries(tally)) {
  console.log(`${k}: ${t.n} build-ups, avg ${(t.dur / t.n).toFixed(1)} s; last touch a lofted ball in the air ${t.lofted}/${t.n}, played by the crosser ${t.byCrosser}/${t.n}, ball arrives at ${arriveZ(k)} m ${t.endOk}/${t.n}; no problems ${t.clean}/${t.n}`);
  for (const [p, n] of t.problems) console.log(`   ${n}× ${p}`);
}
