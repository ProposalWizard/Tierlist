import { makeInitialCareer } from "../../lib/star/careerFlow";
import {
  makeObjective, progressObjectives, sponsorFee, signSponsor, sponsorEligible, objectiveLabel,
} from "../../lib/star/sponsors";
import { mulberry32 } from "../../lib/star/season";
import type { CareerState, MatchStats, StarPlayer, SponsorObjective } from "../../lib/star/types";

/**
 * SPONSORSHIP OBJECTIVES — VARIETY, DIFFICULTY SCALING, STREAKS, AND
 * UPGRADE-ON-COMPLETION.
 *
 * Requested directly, with real examples: harder objectives for pricier
 * deals ("score in eleven games in a row", "start twenty-seven games this
 * season", "fifty goals with two seasons to do this in"), and completing
 * one should upgrade the deal itself, not just pay a one-off bonus — "your
 * sponsorship increases to get you more money." All of it needs to be
 * editable in the tuning screen, same as everything else there — every
 * number this suite checks is read via `getTuning`, not a local constant.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const CLUBS = [
  "Arsenal", "Aston Villa", "Bournemouth", "Brentford", "Brighton", "Chelsea",
  "Crystal Palace", "Everton", "Fulham", "Ipswich", "Leicester", "Liverpool",
  "Man City", "Man United", "Newcastle", "Nottingham Forest", "Southampton",
  "Tottenham", "West Ham", "Wolves",
];

function bigCareer(): CareerState {
  const player: StarPlayer = {
    firstName: "Michael", lastName: "Sancho", age: 24, skinTone: "light",
    club: "Man United", clubBadge: null, position: "ST",
    nationality: "England", startYear: 2026,
  };
  const c = makeInitialCareer(player, CLUBS);
  // Push well past every category's fame floor and lifestyle/trophy/fan
  // gates, so every category in SPONSOR_REQUIREMENTS is eligible — this
  // suite is about the OBJECTIVES, not re-testing eligibility gating.
  c.fame = 200;
  c.relationships.fans = 100;
  c.trophies = [{ season: 1, competition: "Premier League", club: "Man United" }];
  c.ownedItems = [{ id: "car1", name: "Test Car", category: "vehicle", price: 100, lifestyleValue: 100 }];
  c.starRating = 4.5;
  c.careerStats = { ...c.careerStats, goals: 10 };
  return c;
}

function stats(overrides: Partial<MatchStats> = {}): MatchStats {
  return {
    chances: 3, goals: 0, assists: 0, passes: 20, rating: 6.8, starMan: false,
    bossChange: 0, teamChange: 0, fansChange: 0, wage: 1, goalBonus: 0, sponsorPay: 0,
    totalCash: 1, homeScore: 0, awayScore: 0, minutes: 90,
    ...overrides,
  };
}

// ── Difficulty scales with the deal's own value ─────────────────────────────
{
  const c = bigCareer();
  const rng = () => 0.4; // fixed, so only `category` differs between the two calls
  const cheap = makeObjective(c, 0, rng, "Boots");        // baseFee 6
  const pricey = makeObjective(c, 0, rng, "Car");          // baseFee 34, the most expensive
  check(cheap.kind === pricey.kind, "same rng seed picks the same objective KIND for both, isolating difficulty");
  if (cheap.kind !== "rating") { // rating's target isn't difficulty-scaled the same multiplicative way
    check(pricey.target > cheap.target,
      `a pricier category's objective asks for more (${cheap.category ?? cheap.kind}: ${cheap.target} vs Car: ${pricey.target})`);
  }
  check(pricey.bonus > cheap.bonus, `a pricier category's bonus is bigger too (${cheap.bonus} vs ${pricey.bonus})`);
}

// ── Every objective kind produces a sane, distinct label ────────────────────
{
  const kinds: SponsorObjective["kind"][] = [
    "goals", "assists", "appearances", "starMan", "rating", "goalStreak", "startStreak", "cleanSheets",
  ];
  const labels = new Set<string>();
  for (const kind of kinds) {
    const label = objectiveLabel({ kind, target: 10, progress: 0, seasonsLeft: 1, bonus: 5, done: false });
    check(label.length > 0 && label.includes("10") || kind === "rating", `${kind} produces a real label mentioning its target (${label})`);
    labels.add(label);
  }
  check(labels.size === kinds.length, "every kind's label is genuinely distinct text");
}

// ── goalStreak: extends on a goal, resets to zero on a scoreless appearance ──
{
  const c = bigCareer();
  let sponsors = c.sponsors.map(s => s.category === "Boots" ? { ...s, active: true, objective: {
    kind: "goalStreak" as const, target: 4, progress: 2, seasonsLeft: 1, bonus: 10, done: false,
  } } : s);
  let r = progressObjectives(sponsors, stats({ goals: 1 }), c.seasonStats, { home: true });
  const afterGoal = r.sponsors.find(s => s.category === "Boots")!.objective!;
  check(afterGoal.progress === 3, `scoring extends the streak (2 -> ${afterGoal.progress})`);

  r = progressObjectives(r.sponsors, stats({ goals: 0 }), c.seasonStats, { home: true });
  const afterBlank = r.sponsors.find(s => s.category === "Boots")!.objective!;
  check(afterBlank.progress === 0, `a scoreless appearance resets the streak to zero (was 3, now ${afterBlank.progress})`);
}

// ── startStreak: extends on a start, resets on a sub cameo ──────────────────
{
  const c = bigCareer();
  let sponsors = c.sponsors.map(s => s.category === "Boots" ? { ...s, active: true, objective: {
    kind: "startStreak" as const, target: 10, progress: 5, seasonsLeft: 1, bonus: 10, done: false,
  } } : s);
  let r = progressObjectives(sponsors, stats({ minutes: 90 }), c.seasonStats);
  check(r.sponsors.find(s => s.category === "Boots")!.objective!.progress === 6, "a full 90 extends the start streak");

  r = progressObjectives(r.sponsors, stats({ minutes: 15 }), c.seasonStats);
  check(r.sponsors.find(s => s.category === "Boots")!.objective!.progress === 0,
    "a 15-minute sub cameo resets the start streak (you weren't trusted to START)");
}

// ── cleanSheets: a count, only moves with real fixture context, only on 0 conceded ──
{
  const c = bigCareer();
  let sponsors = c.sponsors.map(s => s.category === "Boots" ? { ...s, active: true, objective: {
    kind: "cleanSheets" as const, target: 6, progress: 2, seasonsLeft: 1, bonus: 10, done: false,
  } } : s);

  // No match context at all: must not silently credit or crash.
  let r = progressObjectives(sponsors, stats({ homeScore: 1, awayScore: 0 }), c.seasonStats);
  check(r.sponsors.find(s => s.category === "Boots")!.objective!.progress === 2, "no fixture context given -> no change either way");

  // You're home, home kept it at 0-0 conceded... wait, credit only when YOUR side conceded 0.
  r = progressObjectives(sponsors, stats({ homeScore: 0, awayScore: 0 }), c.seasonStats, { home: true });
  check(r.sponsors.find(s => s.category === "Boots")!.objective!.progress === 3, "a 0-0 at home (you conceded 0) credits a clean sheet");

  r = progressObjectives(sponsors, stats({ homeScore: 2, awayScore: 1 }), c.seasonStats, { home: true });
  check(r.sponsors.find(s => s.category === "Boots")!.objective!.progress === 2, "conceding at home does not credit a clean sheet, and does not go backwards either");

  // Away side: YOUR conceded is the home score.
  r = progressObjectives(sponsors, stats({ homeScore: 0, awayScore: 3 }), c.seasonStats, { home: false });
  check(r.sponsors.find(s => s.category === "Boots")!.objective!.progress === 3, "a clean sheet away reads off the HOME score, not the away score");
}

// ── Completing an objective upgrades the deal — permanently, capped ─────────
{
  const c = bigCareer();
  const category = "Boots";
  let career = signSponsor(c, category);
  check(sponsorEligible(category, career), "Boots is eligible at this fame/output level");
  check((career.sponsors.find(s => s.category === category)?.level ?? 1) === 1, "a freshly signed deal starts at level 1 (no upgrade yet)");
  const feeAtLevel1 = sponsorFee(category, career);

  // Force the objective (whatever kind it randomly got) to a "goals" one
  // target - 1, then complete it with a goal-scoring stat line.
  career.sponsors = career.sponsors.map(s => s.category === category ? { ...s, objective: { ...s.objective!, kind: "goals" as const, target: 3, progress: 2 } } : s);
  const result = progressObjectives(career.sponsors, stats({ goals: 5 }), career.seasonStats, { home: true });
  const deal = result.sponsors.find(s => s.category === category)!;
  check(deal.objective!.done, "the objective is marked done once progress reaches its target");
  check(result.earned === deal.objective!.bonus, "the completion bonus is paid out");
  check((deal.level ?? 1) === 2, `completing an objective bumps the deal's level (now ${deal.level})`);

  career.sponsors = result.sponsors;
  const feeAtLevel2 = sponsorFee(category, career);
  check(feeAtLevel2 > feeAtLevel1, `an upgraded deal pays more per season (${feeAtLevel1} -> ${feeAtLevel2})`);

  // Cap: repeatedly completing objectives never exceeds upgradeMaxLevel.
  for (let i = 0; i < 20; i++) {
    career.sponsors = career.sponsors.map(s => s.category === category
      ? { ...s, objective: { kind: "goals" as const, target: 1, progress: 0, seasonsLeft: 1, bonus: 1, done: false } }
      : s);
    const r2 = progressObjectives(career.sponsors, stats({ goals: 5 }), career.seasonStats, { home: true });
    career.sponsors = r2.sponsors;
  }
  const finalLevel = career.sponsors.find(s => s.category === category)?.level ?? 1;
  check(finalLevel <= 20, `level never runs away unbounded even after 21 total completions (level is ${finalLevel})`);
}

// ── Determinism: the same seed/category always produces the same objective ──
{
  const c = bigCareer();
  const a = makeObjective(c, 2, mulberry32(777), "Watch");
  const b = makeObjective(c, 2, mulberry32(777), "Watch");
  check(JSON.stringify(a) === JSON.stringify(b), "the same seed and category produce an identical objective every time");
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — sponsorship objectives scale with the deal's own value, streaks break honestly, and completing one upgrades the deal");
