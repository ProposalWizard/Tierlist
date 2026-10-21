/**
 * THE SKILLS A TRAINING LEVEL IS PLAYED WITH (lib/star/trainingAutoSkills.ts)
 * — Harry, 20 Oct 2026: "Surely it should just be auto — playing a level 20
 * skill would mean you have the 19 levels completed before it?"
 *
 * Checks the table is:
 *  1. level 1 = a new career's starting skills;
 *  2. never going down from one level to the next, and never past 100;
 *  3. exactly the career's own gains rule (40 + stars × 60 / 90), and the
 *     same as banking the levels one by one through applyLevelResult;
 *  4. 1 star < 2 stars < 3 stars each, as it should be.
 *
 * Run: npx tsx tests/star/trainingAutoSkills.mts
 */
import { skillsAtLevel, startingSkills, AUTO_STARS, SKILL_ORDER, DRILL_READS, playsWithLine } from "../../lib/star/trainingAutoSkills";
import { TRAINING_LEVELS, skillFromStars, applyLevelResult } from "../../lib/star/trainingLevels";
import type { CareerState } from "../../lib/star/types";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); console.log(`${ok ? "  ok " : "FAIL "} ${what}`); };

const start = startingSkills();
const l1 = skillsAtLevel(1);
check(SKILL_ORDER.every(k => l1[k] === start[k]), `level 1 plays with a new career's skills (${SKILL_ORDER.map(k => l1[k]).join("/")})`);

let mono = true, capped = true;
for (const stars of [1, 2, 3]) {
  let prev = skillsAtLevel(1, stars);
  for (let n = 2; n <= TRAINING_LEVELS; n++) {
    const now = skillsAtLevel(n, stars);
    for (const k of SKILL_ORDER) {
      if (now[k] < prev[k]) mono = false;
      if (now[k] > 100) capped = false;
    }
    prev = now;
  }
}
check(mono, "a later level never plays with less skill than an earlier one (1, 2 and 3 stars each)");
check(capped, "no skill ever goes past 100");

// The gains rule, from a 40 start: after N-1 levels at s stars, 40 + round((N-1)·s·60/90).
let ruleOk = true;
for (const stars of [1, 2, 3]) {
  for (let n = 1; n <= TRAINING_LEVELS; n++) {
    const want = skillFromStars((n - 1) * stars);
    const got = skillsAtLevel(n, stars, { pace: 40, power: 40, technique: 40, vision: 40, freeKick: 40, aerial: 40 });
    if (SKILL_ORDER.some(k => got[k] !== want)) ruleOk = false;
  }
}
check(ruleOk, "matches the career's gains rule: skill = 40 + stars × 60 / 90");

// The same as banking levels through the career's own function, one skill at a time.
{
  let c = { skills: { pace: 40, power: 40, technique: 40, vision: 40, freeKick: 40 } } as unknown as CareerState;
  for (let n = 1; n < 20; n++) c = applyLevelResult(c, "power", n, AUTO_STARS).career;
  check(c.skills.power === skillsAtLevel(20, AUTO_STARS).power, `level 20 Power is what 19 levels at ${AUTO_STARS} stars bank (${c.skills.power})`);
}

const a = skillsAtLevel(20, 1).power, b = skillsAtLevel(20, 2).power, c3 = skillsAtLevel(20, 3).power;
check(a < b && b < c3, `level 20: 1★ each ${a} < 2★ each ${b} < 3★ each ${c3}`);
check(skillsAtLevel(30, 3).power === 98, `level 30 after 29 levels at 3★: 98 (${skillsAtLevel(30, 3).power})`);

check(DRILL_READS.pace.length === 0 && DRILL_READS.vision.length === 0, "Pace and Vision read no skill (the level sets your speed)");
check(playsWithLine("freeKick", 20) === "Power 65 · Technique 65 · Free kick 65", `the line for free kick level 20: "${playsWithLine("freeKick", 20)}"`);

if (problems.length) {
  console.log(`\nFAIL — ${problems.length} problem(s)`);
  process.exit(1);
}
console.log("\nPASS");
