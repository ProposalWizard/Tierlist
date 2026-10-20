// Phase 2's generated build-ups (lib/star/fhr/buildUp.ts), measured over the
// chances the real match serves:
//
//   npx tsx scripts/fhr/buildup-measure.mts [N=500] [--seed=3]
//
// Prints how many get one, how long they are, how many are distinct, how many
// tries they took, and every check that failed (there should be none).
import { servedChances } from "../../lib/star/fhr/servedChances";
import { fhrBuildUpFor, fhrWantsBuildUp, maxSpeed } from "../../lib/star/fhr/buildUp";

const args = process.argv.slice(2);
const n = Number(args.find((a) => /^\d+$/.test(a)) ?? 500);
const seed = Number(args.find((a) => a.startsWith("--seed="))?.slice(7) ?? 3);
const t0 = Date.now();
const cs = servedChances({ count: n, seed });
const probs = new Map<string, number>();
let bad = 0, open = 0, extras = 0, touches = 0, fromChain = 0, mates = 0, oneTwo = 0;
const durs: number[] = [], sigs = new Set<string>(), coarse = new Set<string>(), tries: number[] = [], speeds: number[] = [];
const byKind = new Map<string, { n: number; dur: number }>();
for (const c of cs) {
  if (!fhrWantsBuildUp(c.sc.kind, c.moment)) continue;
  open++;
  const b = fhrBuildUpFor(c.sc, c.moment);
  durs.push(b.durS); sigs.add(b.signature); tries.push(b.tries);
  coarse.add(`${b.signature}|${b.owners.join(",")}|${b.acts.map((a) => `${Math.round(a.from.x / 5)},${Math.round(a.from.y / 5)}`).join(";")}`);
  extras += b.extraMates ?? 0; touches += b.acts.length;
  if (b.acts.some((a) => a.src === "chain")) fromChain++;
  mates += b.owners.filter((o) => o !== "you" && !o.startsWith("extra")).length;
  if (b.owners.filter((o) => o === "you").length > 1) oneTwo++;
  for (const p of b.people) speeds.push(maxSpeed(p.path));
  const k = byKind.get(c.sc.kind) ?? { n: 0, dur: 0 }; k.n++; k.dur += b.durS; byKind.set(c.sc.kind, k);
  if (b.problems.length) {
    bad++;
    for (const p of b.problems) { const key = p.replace(/\d+(\.\d+)?/g, "#").replace(/(extra|def|mate|sec)#/g, "$1"); probs.set(key, (probs.get(key) ?? 0) + 1); }
  }
}
const q = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
console.log(`${open} open-play chances of ${cs.length} served (${cs.length - open} set pieces, none get one) · ${Date.now() - t0} ms`);
console.log(`length: min ${q(durs, 0).toFixed(2)} · p10 ${q(durs, 0.1).toFixed(2)} · p50 ${q(durs, 0.5).toFixed(2)} · p90 ${q(durs, 0.9).toFixed(2)} · max ${q(durs, 1).toFixed(2)} s`);
console.log(`distinct: ${sigs.size} routes (touch type + zone), ${coarse.size} build-ups (routes + who + 5 m spots) of ${open}`);
console.log(`touches a build-up ${(touches / open).toFixed(2)} · from a real chain into the chance ${((fromChain / open) * 100).toFixed(0)}% · chance team-mates on the ball ${(mates / open).toFixed(2)} · extras ${(extras / open).toFixed(2)} · one-twos ${oneTwo}`);
console.log(`fastest man: p50 ${q(speeds, 0.5).toFixed(2)} · p99 ${q(speeds, 0.99).toFixed(2)} · max ${q(speeds, 1).toFixed(2)} m/s · tries mean ${(tries.reduce((a, b) => a + b, 0) / open).toFixed(2)}, max ${Math.max(...tries)}`);
for (const [k, v] of [...byKind.entries()].sort((a, b) => b[1].n - a[1].n)) console.log(`  ${k.padEnd(14)} ${String(v.n).padStart(4)} · ${(v.dur / v.n).toFixed(2)} s`);
console.log(`failed checks: ${bad}`);
for (const [k, v] of [...probs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)) console.log(`  ${v} × ${k}`);
