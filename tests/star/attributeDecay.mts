import { decaySkills, makeInitialCareer } from "../../lib/star/careerFlow";
import { mulberry32 } from "../../lib/star/season";
import type { CareerState, Skills, StarPlayer } from "../../lib/star/types";

/**
 * NEGLECT A SKILL LONG ENOUGH AND IT SLIPS.
 *
 * Requested directly: "if you haven't trained any of your attributes...
 * every few months... you have a chance of downgrading them by a point or
 * two every time." `decaySkills` (careerFlow.ts) is the whole mechanic;
 * this checks it against the real tuned numbers, not just that it runs.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function player(): StarPlayer {
  return {
    firstName: "Test", lastName: "Player", age: 24, skinTone: "light",
    club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
  } as StarPlayer;
}

function freshCareer(week: number, lastTrainedWeek: Partial<Record<keyof Skills, number>>): CareerState {
  const base = makeInitialCareer(player(), ["Arsenal", "Chelsea"]);
  return { ...base, week, lastTrainedWeek, skills: { pace: 60, power: 60, technique: 60, vision: 60, freeKick: 60 } };
}

// ── A freshly-trained skill never decays, however many rolls run ──────────
{
  const career = freshCareer(20, { pace: 19, power: 19, technique: 19, vision: 19, freeKick: 19 }); // 1 week overdue-threshold short
  let anyChange = false;
  for (let seed = 1; seed <= 300; seed++) {
    const out = decaySkills(career, mulberry32(seed));
    if (out !== career) anyChange = true;
  }
  check(!anyChange, "a skill trained recently enough never decays, however many times the roll runs");
}

// ── An overdue skill decays at roughly the tuned chance, by 1-2 points ────
{
  const career = freshCareer(30, { pace: 1, power: 1, technique: 1, vision: 1, freeKick: 1 }); // all wildly overdue
  let decayed = 0;
  const trials = 1000;
  const losses = new Set<number>();
  for (let seed = 1; seed <= trials; seed++) {
    const out = decaySkills(career, mulberry32(seed * 7919 + 3));
    if (out.skills.pace !== career.skills.pace) {
      decayed++;
      losses.add(career.skills.pace - out.skills.pace);
    }
  }
  const rate = decayed / trials;
  check(rate > 0.06 && rate < 0.20, `pace decays at roughly the tuned 12% chance once overdue, not never or always (${(rate * 100).toFixed(1)}%)`);
  check([...losses].every(l => l === 1 || l === 2), `every actual loss is 1 or 2 points, matching the tuned range (saw ${[...losses]})`);
}

// ── Each skill rolls independently — one can decay without the others ────
{
  const career = freshCareer(30, { pace: 1, power: 1, technique: 1, vision: 1, freeKick: 1 });
  let sawPartial = false;
  for (let seed = 1; seed <= 500 && !sawPartial; seed++) {
    const out = decaySkills(career, mulberry32(seed * 101 + 1));
    const keys = Object.keys(career.skills) as (keyof Skills)[];
    const changedKeys = keys.filter(k => out.skills[k] !== career.skills[k]);
    if (changedKeys.length > 0 && changedKeys.length < keys.length) sawPartial = true;
  }
  check(sawPartial, "at least one seed decays some skills but not all of them — each skill is its own independent roll");
}

// ── A decay resets that skill's own clock, so it isn't still "overdue" next check ──
{
  const career = freshCareer(30, { pace: 1, power: 1, technique: 1, vision: 1, freeKick: 1 });
  let found = false;
  for (let seed = 1; seed <= 500 && !found; seed++) {
    const out = decaySkills(career, mulberry32(seed * 53 + 9));
    if (out.skills.pace !== career.skills.pace) {
      check(out.lastTrainedWeek?.pace === career.week, `a decayed skill's clock resets to the current week (${out.lastTrainedWeek?.pace} vs week ${career.week})`);
      found = true;
    }
  }
  check(found, "found at least one seed where pace actually decayed, to check the clock reset against");
}

// ── Never decays below the tuned floor ─────────────────────────────────────
{
  const base = freshCareer(999, { pace: 1, power: 1, technique: 1, vision: 1, freeKick: 1 });
  const career = { ...base, skills: { ...base.skills, pace: 20 } }; // already at the default floor
  for (let seed = 1; seed <= 300; seed++) {
    const out = decaySkills(career, mulberry32(seed * 31 + 5));
    check(out.skills.pace >= 20, `pace never drops below the tuned floor of 20 (saw ${out.skills.pace})`);
  }
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — a neglected attribute really can slip, at the tuned odds, and a maintained one never does");
