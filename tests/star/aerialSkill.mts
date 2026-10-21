// A tiny localStorage so tuningStore.ts can run headless (same as saveGuard.mts).
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
};

import { makeInitialCareer } from "../../lib/star/careerFlow";
import { applyLevelResult, starsOf } from "../../lib/star/trainingLevels";
import { aerialFromOld, aerialOf, aerialHeaderPace, aerialVolleyPace } from "../../lib/star/aerial";
import { airContactRead, airForgiveness } from "../../lib/star/airborneChance";
import { checkSave } from "../../lib/star/saveGuard";
import { levelConfig, TRAINING_SKILLS, defaultTable } from "../../lib/star/trainingLevelData";
import { computeStarRating } from "../../lib/star/rating";
import type { CareerState, StarPlayer } from "../../lib/star/types";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";

/**
 * AERIAL & ACROBATICS (Harry, Q7 / Q10, 21 Oct 2026).
 *  1. A new career starts at 40; an old save gets a start from Power/Technique.
 *  2. The save guard never flags filling it in, nor one training session on it.
 *  3. It trains like the other five (30 levels, stars raise it).
 *  4. A strike without Aerial is exactly the strike as before; Aerial 60
 *     plays as Technique 60; higher Aerial forgives more.
 */
let failed = 0;
const ok = (c: boolean, what: string) => { console.log(`${c ? "  ok  " : "  FAIL"} ${what}`); if (!c) failed++; };

console.log("1. STARTING VALUES");
const fresh = makeInitialCareer({
  firstName: "Test", lastName: "Aerial", age: 17, skinTone: "light", club: PREMIER_LEAGUE_CLUBS[3], clubBadge: null,
  position: "ST", nationality: "England", startYear: 2027,
} as StarPlayer, [...PREMIER_LEAGUE_CLUBS]);
ok(fresh.skills.aerial === 40, `a new career starts at ${fresh.skills.aerial}`);
ok(aerialFromOld({ power: 70, technique: 60 }) === 66, `an old save at Power 70, Technique 60 starts at ${aerialFromOld({ power: 70, technique: 60 })}`);
ok(aerialFromOld({ power: 30, technique: 30 }) === 40, "never below a new career's 40");
ok(aerialFromOld({}) === 40 && aerialOf({ aerial: 81 }) === 81, "missing skills read 40; a saved Aerial is kept");

console.log("\n2. THE SAVE GUARD");
const now = 1_900_000_000_000;
const oldSave = JSON.parse(JSON.stringify(fresh)) as Record<string, unknown>;
const oldSkills = { ...(oldSave.skills as Record<string, number>), power: 64, technique: 58 };
delete (oldSkills as Record<string, unknown>).aerial;
oldSave.skills = oldSkills;
const migrated = { ...oldSave, skills: { ...oldSkills, aerial: aerialFromOld(oldSkills) } };
const r1 = checkSave(oldSave, migrated, { mode: "enforce", now, prevSavedAt: now - 60_000 });
ok(!r1.findings.some(f => f.field.startsWith("skills")), `an old save getting its Aerial (${aerialFromOld(oldSkills)}) is not flagged (${r1.findings.map(f => f.field).join(", ") || "no findings"})`);
const trained = applyLevelResult(migrated as unknown as CareerState, "aerial", 1, 3).career;
const r2 = checkSave(migrated, { ...trained, week: (trained.week ?? 1) + 1 }, { mode: "enforce", now, prevSavedAt: now - 3_600_000 });
ok(!r2.findings.some(f => f.field.startsWith("skills") || f.field === "trainingStars"), `one Aerial session is not flagged (${r2.findings.map(f => f.field).join(", ") || "no findings"})`);
const cheat = { ...migrated, skills: { ...(migrated.skills as Record<string, number>), aerial: 99 } };
const r3 = checkSave(migrated, cheat, { mode: "enforce", now, prevSavedAt: now - 60_000 });
ok(r3.findings.some(f => f.field.startsWith("skills")), `Aerial jumped to 99 in a minute IS flagged (${r3.findings.map(f => f.field).join(", ")})`);

console.log("\n3. TRAINING");
ok(TRAINING_SKILLS.includes("aerial") && defaultTable().aerial.length === 30, "30 Aerial levels");
const l1 = levelConfig("aerial", 1), l2 = levelConfig("aerial", 2), l30 = levelConfig("aerial", 30);
ok(!l1.volley && l2.volley && l30.keeperStrength > l1.keeperStrength + 50, `level 1 a header (keeper ${l1.keeperStrength}), level 2 a volley, level 30 keeper ${l30.keeperStrength}`);
let c = fresh;
for (let lv = 1; lv <= 6; lv++) c = applyLevelResult(c, "aerial", lv, 3).career;
ok(c.skills.aerial === 52 && starsOf(c, "aerial").slice(0, 6).every(s => s === 3), `six levels at three stars: Aerial ${fresh.skills.aerial} → ${c.skills.aerial}`);
ok(computeStarRating(c) === computeStarRating({ ...c, skills: { ...c.skills, aerial: 40 } }), "Aerial does not move the star rating (weight 0 for now)");

console.log("\n4. THE STRIKE");
const hit = { kind: "volley" as const, lift: 0.6, cx: 0.6, cy: 0.1 };
const before = airContactRead({ ...hit, tech: 70 });
ok(JSON.stringify(airContactRead({ ...hit, tech: 70, aerial: undefined })) === JSON.stringify(before), "no Aerial on the strike: exactly as before");
ok(Math.abs(airForgiveness({ aerial: 60 }) - airForgiveness({ tech: 60 })) < 1e-9, `Aerial 60 forgives as Technique 60 (×${airForgiveness({ tech: 60 }).toFixed(2)})`);
const a30 = airContactRead({ ...hit, aerial: 30 }), a90 = airContactRead({ ...hit, aerial: 90 });
ok(Math.abs(a90.turnDeg) < Math.abs(a30.turnDeg), `a mis-hit volley goes ${Math.abs(a30.turnDeg).toFixed(1)}° off at Aerial 30, ${Math.abs(a90.turnDeg).toFixed(1)}° at 90`);
ok(aerialHeaderPace(60) === 1 && aerialVolleyPace(60) === 1 && aerialHeaderPace(undefined) === 1, "pace ×1 at 60 and when absent");
ok(aerialHeaderPace(30) < 1 && aerialHeaderPace(90) > 1, `header pace ×${aerialHeaderPace(30).toFixed(2)} at 30, ×${aerialHeaderPace(90).toFixed(2)} at 90`);

if (failed) { console.error(`\n${failed} FAILED`); process.exit(1); }
console.log("\nPASS");
