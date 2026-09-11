import {
  facilitiesFor, renameStadium, upgradeStadiumCapacity, upgradeTrainingGround, upgradeYouthAcademy,
  creditStadiumRevenue,
} from "../../lib/star/facilities";
import { buyStake, ownedClubState, topUpClubBudget } from "../../lib/star/investments";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS, CHAMPIONSHIP_CLUBS } from "../../lib/star/clubs";
import type { CareerState, StarPlayer } from "../../lib/star/types";

/**
 * CLUB FACILITIES — PHASE 7 OF STAR_POWER_POLITICS.MD, §6.
 *
 * Every club has real, distinct facilities from the moment anything reads
 * them — generated deterministically from the club's own name, not left
 * undefined and not hand-authored per club. Majority owners can rename,
 * upgrade, and — the one real gameplay hook this phase ships — collect
 * real gate-receipt revenue into the club's own budget every season,
 * sized to a real stadium capacity.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function player(): StarPlayer {
  return {
    firstName: "Test", lastName: "Player", age: 25, skinTone: "light",
    club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
  } as StarPlayer;
}

function freshCareer(overrides: Partial<CareerState> = {}): CareerState {
  const base = makeInitialCareer(player(), [...PREMIER_LEAGUE_CLUBS]);
  return { ...base, money: 1_000_000, ...overrides };
}

const RIVAL = PREMIER_LEAGUE_CLUBS.find(c => c !== "Arsenal")!;
const CHAMPIONSHIP_CLUB = CHAMPIONSHIP_CLUBS[0];

// ── Every club has real, distinct, deterministic default facilities ──────
{
  const career = freshCareer();
  const a = facilitiesFor(career, RIVAL);
  const b = facilitiesFor(career, RIVAL); // read twice — must be stable, not re-rolled
  check(JSON.stringify(a) === JSON.stringify(b), "reading a club's facilities twice gives the identical result — deterministic, not re-rolled each time");

  const other = facilitiesFor(career, PREMIER_LEAGUE_CLUBS.find(c => c !== RIVAL && c !== "Arsenal")!);
  check(a.stadiumCapacity !== other.stadiumCapacity || a.trainingGroundTier !== other.trainingGroundTier,
    "two different real clubs get genuinely distinct facilities, not a single shared template");

  check(a.stadiumName.length > 0, "every club has a real stadium name, never blank");
  check(a.trainingGroundTier >= 1 && a.trainingGroundTier <= 3, "training ground tier stays inside its real 1-3 range");
  check(a.youthAcademyTier >= 1 && a.youthAcademyTier <= 3, "youth academy tier stays inside its real 1-3 range");

  const premierClub = facilitiesFor(career, RIVAL);
  const championshipClub = facilitiesFor(career, CHAMPIONSHIP_CLUB);
  check(premierClub.stadiumCapacity > championshipClub.stadiumCapacity,
    `a real Premier League club's baseline stadium is genuinely bigger than a Championship one's (${premierClub.stadiumCapacity} vs ${championshipClub.stadiumCapacity})`);
}

// ── Upgrades: majority ownership only, paid from the club's own budget ────
{
  let career = freshCareer();
  const blockedRename = renameStadium(career, RIVAL, "New Name Ground");
  check(!blockedRename.ok, "can't rename a stadium without majority ownership");
  const blockedUpgrade = upgradeStadiumCapacity(career, RIVAL);
  check(!blockedUpgrade.ok, "can't upgrade a stadium without majority ownership");

  career = buyStake(career, RIVAL, 60);
  career = topUpClubBudget(career, RIVAL, 100_000);

  const before = facilitiesFor(career, RIVAL);
  const beforeBudget = ownedClubState(career, RIVAL).budget;

  const renamed = renameStadium(career, RIVAL, "New Name Ground");
  check(renamed.ok, `a majority owner can genuinely rename the stadium (${renamed.reason ?? ""})`);
  check(facilitiesFor(renamed.career, RIVAL).stadiumName === "New Name Ground", "…and the new name is genuinely on record");
  check(ownedClubState(renamed.career, RIVAL).budget < beforeBudget, "…and it genuinely costs real money from the club's own budget");

  const upgraded = upgradeStadiumCapacity(career, RIVAL);
  check(upgraded.ok, `capacity can genuinely be upgraded (${upgraded.reason ?? ""})`);
  check(facilitiesFor(upgraded.career, RIVAL).stadiumCapacity > before.stadiumCapacity, "…and capacity genuinely increases");

  let training = career;
  let tier = before.trainingGroundTier;
  while (tier < 3) {
    const result = upgradeTrainingGround(training, RIVAL);
    check(result.ok, `training ground upgrades from tier ${tier} genuinely succeed with enough budget (${result.reason ?? ""})`);
    training = result.career;
    tier = facilitiesFor(training, RIVAL).trainingGroundTier;
  }
  const cappedTraining = upgradeTrainingGround(training, RIVAL);
  check(!cappedTraining.ok, "training ground upgrades stop for real at the top tier — no tier 4");

  let youth = career;
  let ytier = before.youthAcademyTier;
  while (ytier < 3) {
    const result = upgradeYouthAcademy(youth, RIVAL);
    check(result.ok, `youth academy upgrades from tier ${ytier} genuinely succeed with enough budget (${result.reason ?? ""})`);
    youth = result.career;
    ytier = facilitiesFor(youth, RIVAL).youthAcademyTier;
  }
  const cappedYouth = upgradeYouthAcademy(youth, RIVAL);
  check(!cappedYouth.ok, "youth academy upgrades stop for real at the top tier — no tier 4");

  const poorCareer = { ...career, ownedClubs: { ...career.ownedClubs, [RIVAL]: { ...ownedClubState(career, RIVAL), budget: 0 } } };
  const cantAfford = upgradeStadiumCapacity(poorCareer, RIVAL);
  check(!cantAfford.ok, "an upgrade genuinely fails when the club's own budget can't cover it");
}

// ── The one real hook: bigger stadiums earn real, per-season revenue ──────
{
  let career = freshCareer();
  career = buyStake(career, RIVAL, 60);
  const before = ownedClubState(career, RIVAL).budget;

  const credited = creditStadiumRevenue(career);
  const after = ownedClubState(credited, RIVAL).budget;
  check(after > before, `a majority-owned club's stadium genuinely earns real revenue every time this runs (before ${before}, after ${after})`);
  check(credited.money === career.money, "stadium revenue never touches the PLAYER's personal money — it's a club asset");

  const capacity = facilitiesFor(career, RIVAL).stadiumCapacity;
  const funded = topUpClubBudget(career, RIVAL, 100_000);
  const upgraded = upgradeStadiumCapacity(funded, RIVAL);
  if (upgraded.ok) {
    const beforeUpgradedBudget = ownedClubState(upgraded.career, RIVAL).budget;
    const creditedAfterUpgrade = creditStadiumRevenue(upgraded.career);
    const gain = ownedClubState(creditedAfterUpgrade, RIVAL).budget - beforeUpgradedBudget;
    const originalGain = after - before;
    check(gain > originalGain, `a bigger stadium (after the upgrade, capacity ${facilitiesFor(upgraded.career, RIVAL).stadiumCapacity} vs original ${capacity}) genuinely earns MORE revenue (${gain} vs ${originalGain})`);
  } else {
    check(false, "fixture assumption failed: could not upgrade the stadium to compare revenue");
  }

  const noOwnedClubs = freshCareer();
  check(creditStadiumRevenue(noOwnedClubs) === noOwnedClubs, "a career with no owned clubs at all is a genuine no-op, not an error");

  const minorityOnly = buyStake(freshCareer(), RIVAL, 20);
  const stillZero = creditStadiumRevenue(minorityOnly);
  check(ownedClubState(stillZero, RIVAL).budget === ownedClubState(minorityOnly, RIVAL).budget,
    "a merely minority stake earns no stadium revenue — majority ownership only, same as every other Boardroom power");
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems.slice(0, 30)) console.log(`  ✗ ${p}`);
  if (problems.length > 30) console.log(`  ...and ${problems.length - 30} more`);
  process.exit(1);
}
console.log("PASS — every club has real, distinct, deterministic facilities, majority owners can rename and upgrade them for a real cost, and a bigger stadium genuinely earns its own club more real revenue every season");
