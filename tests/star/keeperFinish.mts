/**
 * KEEPER REALISM (Leo, round 16) — switch "keeperFinish" (lib/star/gameplayVersion.ts).
 *
 *   1. Old is exactly the keeper from before: a fingerprint of 264 seeded shots
 *      (every case, live defaults and the Oct 13 update) — where he stood,
 *      where he ended, every save and outcome — equals the hash taken on the
 *      code before this change.
 *   2. New does what Leo asked, measured on the real engine and brain
 *      (tests/star/keeperFinish/harness.mts):
 *      - the Henry (corner of the six-yard box, curled far post low) goes in at a real rate;
 *      - top corners get harder to save as the shot gets harder;
 *      - shots at him / central low stay saveable at real rates.
 *
 * Run: npx tsx tests/star/keeperFinish.mts   (full table: tests/star/keeperFinish/report.mts)
 */
import { setConfig, cases, play, runCase, savePct, aimFor } from "./keeperFinish/harness.mts";
import { mulberry32 } from "../../lib/star/season";
import { defaultVersion } from "../../lib/star/gameplayVersion";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };

/** Taken on the code before keeperFinish existed (origin/main 406e125e). */
const OLD_HASH = "8794d5d2";

function fingerprint(): string {
  let h = 2166136261 >>> 0;
  const mix = (v: number | string) => {
    const s = typeof v === "number" ? v.toFixed(4) : v;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  };
  for (const cfg of ["live", "oct13"] as const) {
    setConfig(cfg, { keeperFinish: "old" });
    for (const c of cases()) {
      for (let i = 0; i < 12; i++) {
        const seed = (424243 + i * 7919) >>> 0;
        const p = c.make(seed, mulberry32((seed ^ 0xcafe) >>> 0));
        const r = play(p, aimFor(p));
        mix(r.keeperX); mix(r.keeperY); mix(r.x); mix(r.z); mix(r.save ?? "-"); mix(r.goal ? "g" : r.saved ? "s" : "m");
      }
    }
  }
  return h.toString(16).padStart(8, "0");
}

console.log("\n1. OLD IS THE KEEPER FROM BEFORE");
ok(defaultVersion("keeperFinish") === "new", "keeperFinish starts on New (Leo asked for it directly)");
const fp = fingerprint();
console.log(`  fingerprint (Old) ${fp}`);
ok(OLD_HASH === "PENDING" || fp === OLD_HASH, `Old plays exactly the keeper from before (${fp} = ${OLD_HASH})`);

if (!process.argv.includes("--old-only")) {
  const N = 150;
  const byId = Object.fromEntries(cases().map((c) => [c.id, c]));
  const rate = (id: string, f: "new" | "old", cfg: "live" | "oct13") => { setConfig(cfg, { keeperFinish: f }); return savePct(runCase(byId[id], N, 3)); };
  for (const cfg of ["live", "oct13"] as const) {
    console.log(`\n2. NEW — ${cfg === "live" ? "live defaults" : "Oct 13 update on"}, keeper 80 (${N} shots a case)`);
    const hO = rate("henry-served-tight_angle", "old", cfg), hN = rate("henry-served-tight_angle", "new", cfg);
    const oO = rate("henry-served-one_on_one", "old", cfg), oN = rate("henry-served-one_on_one", "new", cfg);
    console.log(`  Henry (served chances, channel): tight angle saved ${hO.toFixed(1)} -> ${hN.toFixed(1)}%, one-on-one ${oO.toFixed(1)} -> ${oN.toFixed(1)}%`);
    ok(hN < hO && oN < oO && (hO + oO) - (hN + oN) >= 15, "the Henry is saved clearly less often (both kinds down, 15+ points between them)");
    ok(hN <= 65 && oN <= 65, "the Henry goes in at least 35% of the time");
    if (cfg === "oct13") ok(hN >= 30, `…but a keeper still stops some (tight angle saved ${hN.toFixed(1)}%)`);
    const tl = rate("top-low", "new", cfg), tm = rate("top-medium", "new", cfg), tf = rate("top-full", "new", cfg);
    console.log(`  top corner saved, low / medium / full power: ${tl.toFixed(1)} / ${tm.toFixed(1)} / ${tf.toFixed(1)}%`);
    // Medium → full in both; low → medium only with the live shots (with the Oct 13
    // Shots model a soft top-corner ball is already saved less than a medium one, Old too).
    ok(tm > tf && (cfg === "oct13" || tl > tm), "a harder top-corner shot is saved less often");
    ok(tf <= 20, `a full-power top corner is saved at most 20% (${tf.toFixed(1)}%)`);
    for (const id of ["at-him", "central-low"]) {
      const a = rate(id, "old", cfg), b = rate(id, "new", cfg);
      console.log(`  ${id}: ${a.toFixed(1)} -> ${b.toFixed(1)}%`);
      ok(Math.abs(a - b) <= 3, `${id} is saved as before (±3 points)`);
    }
  }
}

if (failed) { console.error(`\n${failed} FAILED`); process.exit(1); }
console.log("\nall passed");
