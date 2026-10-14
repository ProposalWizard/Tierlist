// Prints every hitbox measurement (run: npx tsx tests/star/hitboxReport.ts;
// STAR_HITBOX=new for the New hitboxes). The numbers in docs/gameplay16/hitbox.md.
import { clearance, overMate, crosses, blocks, keeperClearance, headers } from "./hitboxHarness";
const pct = (a: number, b: number) => `${(a / Math.max(1, b) * 100).toFixed(1)}%`;
console.log("== clearance over a standing defender (ball centre height, m) ==");
for (const shot of [false, true]) for (const speed of [12, 22]) {
  const cells: string[] = [];
  for (const dist of [3, 6, 9]) for (const off of [0, 0.5, 0.9]) cells.push(`${dist}m/${off}: ${clearance(dist, off, speed, shot)}`);
  console.log(`${shot ? "shot" : "pass"} ${speed} m/s  ` + cells.join("  "));
}
for (const k of ["shot", "pass"] as const) { const r = overMate(k, 1000); console.log(`over a team-mate (${k}): ${pct(r.clipped, r.trials)} clipped (${r.clipped}/${r.trials}), read as a ball to him ${pct(r.asPass, r.trials)}`); }
for (const k of ["byline_cross", "corner"] as const) { const r = crosses(k, 1200); console.log(`${k}: reached ${pct(r.reached, r.n)}, headers ${pct(r.headers, r.n)}, defender cut out ${pct(r.cutOut, r.n)}, goals ${pct(r.goals, r.n)}`); }
{ const h = headers(1600); console.log(`headers onto a team-mate: reached ${pct(h.reached, h.n)}, goals ${pct(h.goals, h.n)}; by arrival height ` + Object.entries(h.byBand).sort().map(([k, v]) => `${k} m ${pct(v.reached, v.n)}`).join(", ")); }
for (const [k, lift] of [["long_range", 0], ["long_range", -0.5], ["one_on_one", 0], ["cutback", 0]] as const) { const r = blocks(k, 1200, lift); console.log(`blocks ${k} cy=${lift}: blocked ${pct(r.blocked, r.n)}, goals ${pct(r.goals, r.n)}`); }
for (const s of [30, 90]) console.log(`keeper ${s}: clear at 3 m off line ${keeperClearance(3, s)}, 6 m ${keeperClearance(6, s)}`);
