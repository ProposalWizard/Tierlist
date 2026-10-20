/** B10 debug: a header/volley build-up whose crosser runs too fast. */
import { servedChances } from "../../lib/star/fhr/servedChances";
import { fhrBuildUpFor, fhrWantsBuildUp, maxSpeed } from "../../lib/star/fhr/buildUp";

const pool = servedChances({ count: 400, seed: Number(process.argv[2] ?? 202) }).filter((c) => (c.sc.kind === "header" || c.sc.kind === "volley") && fhrWantsBuildUp(c.sc.kind, c.moment));
let shown = 0;
(globalThis as Record<string, unknown>).__b10dbg = process.env.DBG === "1";
for (const c of pool) {
  const b = fhrBuildUpFor(c.sc, c.moment);
  const bad = b.problems.filter((p) => new RegExp(process.argv[3] ?? "runs|leaves").test(p));
  if (!bad.length) continue;
  console.log(`\n${c.sc.kind} durS ${b.durS.toFixed(2)} problems: ${b.problems.join("; ")} tries ${b.tries}`);
  console.log(`acts: ${b.acts.map((a, k) => `${a.type}${a.endZ ? "^" : ""} (${a.from.x.toFixed(1)},${a.from.y.toFixed(1)})->(${a.to.x.toFixed(1)},${a.to.y.toFixed(1)}) ${a.t0.toFixed(2)}-${a.t1.toFixed(2)} by ${b.actOwners[k]}`).join(" | ")}`);
  for (const p of b.people) {
    const v = maxSpeed(p.path);
    if (v > p.vmax) {
      const HZ = 15; let worst = 0, at = 0;
      for (let i = 3; i < p.path.length; i++) { const s = Math.hypot(p.path[i].x - p.path[i - 3].x, p.path[i].y - p.path[i - 3].y) * HZ / 3; if (s > worst) { worst = s; at = i; } }
      console.log(`  ${p.key} (${p.role}) top ${p.vmax.toFixed(1)} worst ${worst.toFixed(1)} at ${(at / HZ).toFixed(2)} s; path len ${p.path.length}; end (${p.path[p.path.length - 1].x.toFixed(1)},${p.path[p.path.length - 1].y.toFixed(1)})`);
      console.log(`   around: ${p.path.slice(Math.max(0, at - 6), at + 3).map((q) => `(${q.x.toFixed(1)},${q.y.toFixed(1)})`).join(" ")}`);
    }
  }
  const m = b.problems.map((p) => /^(\S+) and (\S+) ([\d.]+) m apart at ([\d.]+) s/.exec(p)).find((x) => x);
  if (m) {
    const HZ = 15, i = Math.round(Number(m[4]) * HZ);
    for (const k of [m[1], m[2]]) { const p = b.people.find((q) => q.key === k)!; console.log(`  ${k} (${p.side} ${p.role}) at ${m[4]} s: (${p.path[i].x.toFixed(1)},${p.path[i].y.toFixed(1)}) start (${p.path[0].x.toFixed(1)},${p.path[0].y.toFixed(1)}) end (${p.path[p.path.length - 1].x.toFixed(1)},${p.path[p.path.length - 1].y.toFixed(1)})`); }
  }
  if (++shown >= 4) break;
}
