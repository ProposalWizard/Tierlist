/**
 * The keeper's numbers, printed (docs/gameplay15/keeper.md). Not a test: run
 *   npx tsx tests/star/keeperPro/report.mts            (this device's switch: New)
 *   KEEPER=old npx tsx tests/star/keeperPro/report.mts (Settings → Keeper pro: Old)
 * N=300 shots per kind per rating by default.
 */
import { shoot, saveRate, pctS, type ShotRec } from "./harness.mts";

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
};
if (process.env.KEEPER === "old") store.set("star-gameplay-keeperPro", "old");

const N = Number(process.env.N ?? 300);
const kinds = ["one_on_one", "through_ball", "long_range", "tight_angle", "volley"] as const;
const all: ShotRec[] = [];
for (const ks of [60, 75, 80, 90]) for (const kind of kinds) for (let s = 1; s <= N; s++) all.push(shoot(kind, s * 7919 + 13, ks, { aim: (process.env.AIM as "any" | "corner" | "body") ?? "any" }));
const line = (lab: string, rs: ShotRec[]) => {
  const s = saveRate(rs);
  console.log(`${lab.padEnd(26)} save ${pctS(s.rate, 1).padStart(6)} of ${String(s.n).padStart(5)} on target · scored ${pctS(rs.filter((r) => r.goal).length, rs.length).padStart(6)} of ${rs.length}`);
};
line("ALL", all);
for (const ks of [60, 75, 80, 90]) line(`keeper ${ks}`, all.filter((r) => r.ks === ks));
for (const z of ["six", "box", "out"]) line(`zone ${z}`, all.filter((r) => r.zone === z));
for (const [a, b] of [[0, 8], [8, 12], [12, 16], [16, 22], [22, 28], [28, 99]]) line(`dist ${a}-${b} (ks 80)`, all.filter((r) => r.ks === 80 && r.dist >= a && r.dist < b));
for (const k of kinds) line(`${k} (ks 80)`, all.filter((r) => r.kind === k && r.ks === 80));
for (const k of kinds) line(`kind ${k}`, all.filter((r) => r.kind === k));
line("top corner", all.filter((r) => r.top));
line("speed <18 m/s", all.filter((r) => r.speed < 18));
line("speed 18-25", all.filter((r) => r.speed >= 18 && r.speed < 25));
line("speed >=25", all.filter((r) => r.speed >= 25));
const sv = all.filter((r) => r.save);
const c = (f: (r: ShotRec) => boolean) => pctS(sv.filter(f).length, sv.length);
console.log(`saves ${sv.length}: catch ${c((r) => r.save === "catch")} parry ${c((r) => r.save === "parry")} push ${c((r) => r.save === "push")} fumble ${c((r) => r.save === "fumble")}`);
const bands: [string, (r: ShotRec) => boolean][] = [
  ["slow <18", (r) => r.speed < 18], ["mid 18-25", (r) => r.speed >= 18 && r.speed < 25], ["fast >=25", (r) => r.speed >= 25],
  ["low z<0.5", (r) => r.z < 0.5], ["chest 0.5-1.5", (r) => r.z >= 0.5 && r.z < 1.5], ["high >1.5", (r) => r.z >= 1.5],
];
for (const [lab, f] of bands) { const s = sv.filter(f); console.log(`  held ${lab.padEnd(14)} ${pctS(s.filter((r) => r.save === "catch").length, s.length)} (n ${s.length})`); }
const pr = sv.filter((r) => r.parry);
console.log(`parried/pushed ${pr.length}: back into danger ${pctS(pr.filter((r) => r.parry === "danger").length, pr.length)} · safe ${pctS(pr.filter((r) => r.parry === "safe").length, pr.length)} · out ${pctS(pr.filter((r) => r.parry === "out").length, pr.length)}`);
console.log(`  danger rebounds per save ${pctS(pr.filter((r) => r.parry === "danger").length, sv.length)} · goals from rebounds per save ${pctS(all.filter((r) => r.reboundGoal).length, sv.length)}`);
const q = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(p * (s.length - 1))] ?? 0; };
const gaps = sv.map((r) => r.gap ?? 0), ends = sv.map((r) => r.bodyEnd ?? 0);
console.log(`save: ball→body at the save median ${q(gaps, 0.5).toFixed(2)} m, p90 ${q(gaps, 0.9).toFixed(2)}; body→save point after he lands median ${q(ends, 0.5).toFixed(2)} m, p90 ${q(ends, 0.9).toFixed(2)}, max ${q(ends, 1).toFixed(2)}`);
for (const k of kinds) { const rs = all.filter((r) => r.kind === k); console.log(`${k.padEnd(13)} keeper off line at strike: median ${q(rs.map((r) => r.keeperY), 0.5).toFixed(2)} m · shot from ${q(rs.map((r) => r.dist), 0.5).toFixed(1)} m`); }
