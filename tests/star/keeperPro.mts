/**
 * KEEPER PRO (Leo v0.15, 11 Oct 2026; Settings → Gameplay → Keeper pro).
 * Real reference (StatsBomb, Premier League 2015/16, tools/statsbomb/keeper.py, deleted 19 Oct 2026)
 * and the before/after numbers: docs/gameplay15/keeper.md.
 *
 * 1. Old is exactly the keeper from before (a hash of 1,224 seeded shots).
 * 2. New: save % falls with distance like the real one; he holds the gentle
 *    ones and parries the hard ones; errors and rebound goals are rare; a 90
 *    is clearly better than a 60; his body ends up where the ball was saved;
 *    he comes for some crosses (never in Old); penalties keep their own rules.
 *
 * Run: npx tsx tests/star/keeperPro.mts
 */
import { shoot, saveRate, deliver, pctS, type ShotRec } from "./keeperPro/harness.mts";
import { keeperFingerprint, KEEPER_FINGERPRINT_BEFORE } from "./keeperPro/fingerprint.mts";
import * as E from "../../lib/star/canvasEngine";
import * as B from "../../lib/star/keeperBrain";
import { mulberry32 } from "../../lib/star/season";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
};

console.log("\nOLD IS THE KEEPER FROM BEFORE");
store.set("star-gameplay-keeperPro", "old");
// Keeper realism (round 16, default New) is its own layer, measured in keeperFinish.mts.
store.set("star-gameplay-keeperFinish", "old");
{
  const f = keeperFingerprint();
  ok(f.hash === KEEPER_FINGERPRINT_BEFORE, `1,224 seeded shots give the same hash as before Keeper pro (${f.hash})`);
  let claims = 0;
  for (let s = 1; s <= 60; s++) if (deliver("corner", s * 6151 + 3, 90).came) claims++;
  ok(claims === 0, "Old never comes for a cross");
}
store.set("star-gameplay-keeperPro", "new");

console.log("\nNEW — SAVE % BY DISTANCE (keeper 80)");
const kinds = ["one_on_one", "through_ball", "long_range", "tight_angle", "volley"] as const;
const rs: ShotRec[] = [];
for (const ks of [60, 80, 90]) for (const kind of kinds) for (let s = 1; s <= 80; s++) rs.push(shoot(kind, s * 7919 + 13, ks));
const k80 = rs.filter((r) => r.ks === 80);
const near = saveRate(k80.filter((r) => r.dist < 12)).rate, mid = saveRate(k80.filter((r) => r.dist >= 12 && r.dist < 22)).rate, far = saveRate(k80.filter((r) => r.dist >= 22)).rate;
console.log(`  under 12 m ${pctS(near * 100, 100)} · 12-22 m ${pctS(mid * 100, 100)} · 22 m+ ${pctS(far * 100, 100)} (real 53 / 77 / 90)`);
ok(near < mid && mid < far, "it falls the closer the shot");
ok(near <= 0.72 && far >= 0.85, "close shots beat him far more often than long ones");

console.log("\nNEW — WHAT A SAVE TURNS INTO");
const sv = rs.filter((r) => r.save);
const share = (f: (r: ShotRec) => boolean, set = sv) => set.filter(f).length / Math.max(1, set.length);
const held = share((r) => r.save === "catch");
console.log(`  held ${(held * 100).toFixed(0)}% (real 40-47%), errors ${(share((r) => r.save === "fumble") * 100).toFixed(1)}%, rebound goals per save ${(share((r) => r.reboundGoal) * 100).toFixed(1)}%`);
ok(held >= 0.35 && held <= 0.6, "he holds about half of what he saves");
const slow = sv.filter((r) => r.speed < 20), fast = sv.filter((r) => r.speed >= 25);
const lowB = sv.filter((r) => r.z < 1.5), high = sv.filter((r) => r.z >= 1.6);
ok(share((r) => r.save === "catch", slow) > share((r) => r.save === "catch", fast), "a gentle shot is held more than a fierce one");
ok(share((r) => r.save === "catch", lowB) > share((r) => r.save === "catch", high) + 0.15, "a ball below his chest is held more than one over his head");
ok(share((r) => r.save === "fumble") <= 0.015, "goalkeeping errors are rare (≤ 1.5% of saves)");
ok(share((r) => r.reboundGoal) <= 0.07, "a save is rarely followed by a rebound goal (≤ 7%)");

console.log("\nNEW — RATING SHOWS");
const s60 = saveRate(rs.filter((r) => r.ks === 60)).rate, s90 = saveRate(rs.filter((r) => r.ks === 90)).rate;
ok(s90 - s60 >= 0.12, `a 90 saves ${(s90 * 100).toFixed(0)}%, a 60 ${(s60 * 100).toFixed(0)}%`);

console.log("\nNEW — THE SAVE IS WHERE THE BALL IS");
const ends = sv.map((r) => r.bodyEnd ?? 0).sort((a, b) => a - b);
const p90 = ends[Math.floor(0.9 * (ends.length - 1))];
ok(p90 <= 1.0, `0.35 s after a save his body is within an arm's length of the save point (p90 ${p90.toFixed(2)} m)`);
ok(E.proSaveBodyX(30, 30, 33) === 32 && E.proSaveBodyX(30, 32.5, 33) === 32.5, "a dive that would stop short is carried on to the ball; one already there is left alone");

console.log("\nNEW — CROSSES AND PENALTIES");
{
  let came = 0, n = 0;
  for (let s = 1; s <= 120; s++) { const d = deliver("corner", s * 6151 + 3, 90); if (d.intoBox) { n++; if (d.came) came++; } }
  ok(came / n >= 0.05 && came / n <= 0.3, `he comes for some corners (${pctS(came, n)}; real claims + punches ≈ 11% of deliveries)`);
  const pen = E.buildScenario("penalty", mulberry32(4), 80, 60, 55);
  B.brainSetup(pen, 3, 80);
  ok(!pen.keeperPro, "a penalty keeps its own rule set (no Keeper pro)");
}

if (failed) { console.error(`\n${failed} FAILED`); process.exit(1); }
console.log("\nall passed");
