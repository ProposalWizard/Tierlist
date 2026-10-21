// How long one build-up takes to make, and a fingerprint of what was made:
//
//   npx tsx scripts/fhr/buildup-speed.mts [N=1500] [--seed=3] [--reps=1]
//
// Times fhrBuildUpFor over the chances the real match serves (even, strong
// and weak sides), prints p50 / p90 / p99 / worst ms and a hash over every
// build-up's full output. Two runs with the same hash made the same build-ups.
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { servedChances } from "../../lib/star/fhr/servedChances";
import { RULER_INPUTS } from "../../lib/star/fhr/ruler";
import { fhrBuildUpFor, fhrWantsBuildUp } from "../../lib/star/fhr/buildUp";

const args = process.argv.slice(2);
const n = Number(args.find((a) => /^\d+$/.test(a)) ?? 1500);
const seed = Number(args.find((a) => a.startsWith("--seed="))?.slice(7) ?? 3);
const reps = Number(args.find((a) => a.startsWith("--reps="))?.slice(7) ?? 1);
const sides: [number, number][] = [[75, 75], [85, 65], [65, 85]];
const hash = createHash("sha256");
const ms: number[] = [];
let made = 0;
for (const [us, them] of sides) {
  const cs = servedChances({ count: Math.ceil(n / sides.length), seed, inputs: { ...RULER_INPUTS, teamStrength: us, oppStrength: them } });
  for (const c of cs) {
    if (!fhrWantsBuildUp(c.sc.kind, c.moment)) continue;
    let b: unknown;
    let best = Infinity;
    for (let r = 0; r < reps; r++) {
      const t0 = performance.now();
      b = fhrBuildUpFor(c.sc, c.moment);
      best = Math.min(best, performance.now() - t0);
    }
    ms.push(best); made++;
    hash.update(JSON.stringify(b));
  }
}
const q = (p: number) => { const s = [...ms].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
console.log(`${made} build-ups · p50 ${q(0.5).toFixed(1)} · p90 ${q(0.9).toFixed(1)} · p99 ${q(0.99).toFixed(1)} · worst ${q(1).toFixed(1)} ms · fingerprint ${createHash("sha256").update(hash.digest("hex")).digest("hex").slice(0, 16)}`);
