/**
 * TRAINING LEVELS (Mikey, 25 Sep 2026): 30 fixed levels per skill, three
 * tries each (★★★ / ★★ / ★), any star unlocks the next, all 90 stars take a
 * skill from 40 to 100, only new stars count, age doesn't matter, and passing
 * a level wins back points lost to decay or age.
 *
 * Run: npx tsx tests/star/trainingLevels.mts
 */
import {
  TRAINING_LEVELS, levelDifficulty, levelSeed, starsForTry, skillFromStars,
  starsFromSkill, highestUnlocked, totalStars, applyLevelResult, starsOf,
} from "../../lib/star/trainingLevels";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import type { CareerState } from "../../lib/star/types";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

check(TRAINING_LEVELS === 30, "30 levels per skill");
check(levelDifficulty(1) === 40 && levelDifficulty(30) === 100, "level 1 is the old drill at 40, level 30 the old drill at 100");
for (let n = 2; n <= 30; n++) check(levelDifficulty(n) > levelDifficulty(n - 1), `level ${n} is harder than ${n - 1}`);
check(levelSeed("power", 7) === levelSeed("power", 7), "a level is the same picture every time");
check(levelSeed("power", 7) !== levelSeed("power", 8) && levelSeed("power", 7) !== levelSeed("technique", 7), "different levels and skills are different pictures");
check(starsForTry(0) === 3 && starsForTry(1) === 2 && starsForTry(2) === 1, "first try ★★★, second ★★, third ★");

check(skillFromStars(0) === 40 && skillFromStars(90) === 100, "0 stars is 40, all 90 is 100");
check(skillFromStars(3) === 42, "three stars is +2");
for (let s = 1; s <= 90; s++) check(skillFromStars(s) >= skillFromStars(s - 1), `more stars never lowers the skill (${s})`);

const fresh = starsFromSkill(40);
check(totalStars(fresh) === 0 && highestUnlocked(fresh) === 1, "a new career has nothing, level 1 open");
const at70 = starsFromSkill(70);
check(totalStars(at70) === 45 && at70.slice(0, 15).every((s) => s === 3) && highestUnlocked(at70) === 16, "an old save at 70 keeps levels 1-15 at ★★★, level 16 open");
check(skillFromStars(totalStars(at70)) === 70, "and that is worth exactly the 70 it had");

// ── Every skill starts at 40 ──
const base = makeInitialCareer({
  firstName: "Test", lastName: "Player", age: 18, skinTone: "light",
  club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
} as never, ["Arsenal", "Chelsea"]);
check(Object.values(base.skills).every((v) => v === 40), `every skill starts at 40 (${Object.values(base.skills).join("/")})`);

// ── Banking attempts ──
let c: CareerState = { ...base };
let r = applyLevelResult(c, "power", 1, 3);
check(r.newStars === 3 && r.career.skills.power === 42, "three stars on level 1: +2 power");
c = r.career;
r = applyLevelResult(c, "power", 1, 3);
check(r.newStars === 0 && r.career.skills.power === 42, "replaying a level you already have ★★★ on gives nothing");
r = applyLevelResult(c, "power", 2, 1);
check(highestUnlocked(starsOf(r.career, "power")) === 3, "any star unlocks the next level");
c = applyLevelResult(r.career, "power", 2, 3).career;
check(totalStars(starsOf(c, "power")) === 6 && c.skills.power === 44, "improving 1★ to 3★ counts the two new stars");
const miss = applyLevelResult(c, "power", 3, 0);
check(miss.gained === 0 && highestUnlocked(starsOf(miss.career, "power")) === 3, "no stars: nothing gained, next level still locked");

// Age doesn't matter.
const old = { ...base, player: { ...base.player, age: 34 } };
check(applyLevelResult(old, "pace", 1, 3).career.skills.pace === 42, "a 34-year-old gets exactly the same for three stars");

// Lost points come back.
const decayed = { ...c, skills: { ...c.skills, power: 41 } }; // stars worth 44, three lost
const back = applyLevelResult(decayed, "power", 1, 2);
check(back.career.skills.power === 43, `passing any level wins back one lost point per star (41 → ${back.career.skills.power})`);
const back2 = applyLevelResult(back.career, "power", 1, 3);
check(back2.career.skills.power === 44, "…never past what the stars are worth");

// Matches no longer give skill points: that lives in careerFlow, checked by the suite's own match tests.

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — 30 levels, 3 tries, stars raise the skill 40 → 100, lost points come back");
