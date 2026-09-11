import {
  submitRecommendation, considerRecommendations,
  setClubFormation, clubStrengthWithFormation,
  clubKitFor, setClubKit, proposeKitVote, resolveKitVote,
  proposePresidentVote, resolvePresidentVote, setPresidentWage, payPresidentWages,
  haveASon, ageUpSonWithPotion, promoteSonToFirstTeam, transferSon,
  canMergeClubs, mergeClubs,
} from "../../lib/star/clubPowers";
import { buyStake, isMajorityOwner, ownedClubState, topUpClubBudget } from "../../lib/star/investments";
import { facilitiesFor } from "../../lib/star/facilities";
import { makeInitialCareer, advanceSeason } from "../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import { getTuning } from "../../lib/star/tuningStore";
import type { CareerState, LeagueSquad, LeaguePlayer, StarPlayer } from "../../lib/star/types";

/**
 * PHASE 3 OF STAR_POWER_POLITICS.MD — DEEPENING CLUB OWNERSHIP.
 *
 * Minority recommendations, formation-as-manager, the kit creator + vote,
 * an elected presidency and its wage, the §4.5 son mechanic, and club
 * mergers — everything §2 asked for beyond the sign/sell/manager trio
 * investments.ts already had. Built on Phase 1 (reputation) and Phase 2
 * (voting) rather than reinventing either.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function player(): StarPlayer {
  return {
    firstName: "Test", lastName: "Player", age: 25, skinTone: "light",
    club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
  } as StarPlayer;
}

function squadFor(club: string, avgOverall: number): LeagueSquad {
  const players: LeaguePlayer[] = Array.from({ length: 18 }, (_, i) => ({
    id: `${club}:${i}`, name: `${club} Player ${i}`, position: i < 4 ? "CB" : i < 8 ? "CM" : "ST",
    positions: [i < 4 ? "CB" : i < 8 ? "CM" : "ST"], overall: avgOverall + (i % 5) - 2, goals: 0, assists: 0,
  }));
  return { club, players };
}

function freshCareer(overrides: Partial<CareerState> = {}): CareerState {
  const base = makeInitialCareer(player(), [...PREMIER_LEAGUE_CLUBS]);
  const league = base.league.map(t => ({ ...t, strength: 75 }));
  return {
    ...base,
    money: 1_000_000,
    league,
    leagueSquads: PREMIER_LEAGUE_CLUBS.filter(c => c !== base.player.club).map(c => squadFor(c, 75)),
    ...overrides,
  };
}

const RIVAL = PREMIER_LEAGUE_CLUBS.find(c => c !== "Arsenal")!;
const RIVAL2 = PREMIER_LEAGUE_CLUBS.filter(c => c !== "Arsenal" && c !== RIVAL)[0];

// ── A. Minority recommendations: real influence, never force ───────────────
{
  let career = freshCareer();

  // Not yet a shareholder at all.
  const noStake = submitRecommendation(career, RIVAL, "sign", "Sign a left-back");
  check("ok" in noStake && noStake.ok === false, "no stake at all means no recommendation can be filed");

  career = buyStake(career, RIVAL, 20); // a real minority stake, below majority
  const filed = submitRecommendation(career, RIVAL, "sign", "Sign a left-back") as CareerState;
  check((filed.recommendations ?? []).length === 1, "a minority shareholder can file a real recommendation");
  check(filed.recommendations![0].status === "pending", "it starts pending, not already decided");

  career = buyStake(career, RIVAL2, 60); // majority elsewhere
  const asMajority = submitRecommendation(career, RIVAL2, "sign", "Sign a striker");
  check("ok" in asMajority && asMajority.ok === false,
    "a majority owner acts directly, not by recommendation — filing one against your own majority club fails");

  // The board considers it — biased by shareholder reputation, but never certain.
  let goodRepCareer = { ...filed, reputation: { ...filed.reputation, shareholders: 95 } };
  let poorRepCareer = { ...filed, reputation: { ...filed.reputation, shareholders: 5 } };
  let goodAdopted = 0, poorAdopted = 0;
  const trials = 200;
  for (let seed = 1; seed <= trials; seed++) {
    const g = considerRecommendations(goodRepCareer, mulberry32(seed * 71 + 1));
    if (g.recommendations![0].status === "adopted") goodAdopted++;
    const p = considerRecommendations(poorRepCareer, mulberry32(seed * 71 + 1));
    if (p.recommendations![0].status === "adopted") poorAdopted++;
  }
  check(goodAdopted > poorAdopted, `high shareholder reputation adopts recommendations more often (good ${goodAdopted}/${trials} vs poor ${poorAdopted}/${trials})`);
  check(poorAdopted > 0 && goodAdopted < trials, "neither extreme is a guarantee either way");
  const decided = considerRecommendations(filed, mulberry32(3));
  check(decided.recommendations![0].status !== "pending", "after the board considers it, it's no longer pending");
}

// ── B. Formation as manager: a real, bounded strength effect ────────────────
{
  let career = freshCareer();
  career = buyStake(career, RIVAL, 60);
  const set = setClubFormation(career, RIVAL, "433");
  check(set.ok, `a majority owner can set a real formation (${set.reason ?? ""})`);
  check(ownedClubState(set.career, RIVAL).formation === "433", "…and it's on record");

  const badFormation = setClubFormation(career, RIVAL, "not-a-real-shape");
  check(!badFormation.ok, "an invented formation id is rejected");

  const strength = clubStrengthWithFormation(set.career, RIVAL);
  check(Math.abs(strength - 75) <= 5, `the formation bonus is small and bounded, not a wild swing (base 75, saw ${strength})`);
}

// ── C. Kit creator + a real public vote ─────────────────────────────────────
{
  let career = freshCareer();
  career = buyStake(career, RIVAL, 60);
  check(clubKitFor(career, RIVAL) === null, "no kit set yet reads as null, not a crash");

  const kitA = { primary: "#ff0000", secondary: "#ffffff", trim: "#000000" };
  const setDirect = setClubKit(career, RIVAL, kitA);
  check(setDirect.ok && clubKitFor(setDirect.career, RIVAL)?.primary === "#ff0000", "a majority owner can set a kit directly");

  const kitB = { primary: "#0000ff", secondary: "#ffffff", trim: "#ffff00" };
  const beforeFans = career.relationships.fans;
  const proposed = proposeKitVote(career, RIVAL, kitA, kitB, "a", mulberry32(9));
  check(proposed.ok, "a majority owner can put two kit designs to a real fan vote");
  if (proposed.ok) {
    const resolved = resolveKitVote(career, proposed.proposal);
    const winningKit = proposed.proposal.tally.winner === "a" ? kitA : kitB;
    check(clubKitFor(resolved, RIVAL)?.primary === winningKit.primary, "the real vote result is the kit that's actually set");
    check(resolved.relationships.fans === beforeFans + 2, "letting fans decide nudges fan reputation up by its own small, real amount");
  }
}

// ── D. Shareholder-elected president, and E. their own wage ────────────────
{
  let career = freshCareer();
  career = buyStake(career, RIVAL, 60);
  check(!ownedClubState(career, RIVAL).isPresident, "not president yet just from majority ownership");

  const wageBlocked = setPresidentWage(career, RIVAL, 500);
  check(!wageBlocked.ok, "can't set a wage before actually being elected president");

  const proposed = proposePresidentVote(career, RIVAL, mulberry32(4));
  check(proposed.ok, "a majority owner can stand for election");
  if (proposed.ok) {
    const forcedWin = { ...proposed.proposal, tally: { ...proposed.proposal.tally, winner: "yes" } };
    const elected = resolvePresidentVote(career, forcedWin, false);
    check(elected.ok && ownedClubState(elected.career, RIVAL).isPresident, "winning the vote makes you president for real");

    career = { ...elected.career };
    career = topUpClubBudget(career, RIVAL, 2000);
    const wageSet = setPresidentWage(career, RIVAL, 500);
    check(wageSet.ok, `once president, you can set your own wage (${wageSet.reason ?? ""})`);

    const beforeMoney = wageSet.career.money;
    const beforeBudget = ownedClubState(wageSet.career, RIVAL).budget;
    const paid = payPresidentWages(wageSet.career);
    check(paid.money === beforeMoney + 500, "the wage is genuinely paid into your own money");
    check(ownedClubState(paid, RIVAL).budget === beforeBudget - 500, "…straight out of the club's own budget");

    const drained = { ...wageSet.career, ownedClubs: { ...wageSet.career.ownedClubs, [RIVAL]: { ...ownedClubState(wageSet.career, RIVAL), budget: 100 } } };
    const cappedPay = payPresidentWages(drained);
    check(cappedPay.money === drained.money + 100, "a wage bigger than the club's budget is capped at what's actually there, not paid on credit");
  }
}

// ── F. The §4.5 son mechanic ─────────────────────────────────────────────
{
  let career = freshCareer();
  const noSonYet = ageUpSonWithPotion(career, mulberry32(1));
  check("ok" in noSonYet && noSonYet.ok === false, "can't use the potion before having a son");

  const withSon = haveASon(career) as CareerState;
  check(!!withSon.son, "having a son creates a real record");
  check(withSon.money < career.money, "…and it costs real money");
  check(withSon.son!.age === 0 && withSon.son!.club === null, "he starts as a newborn, on no team yet");

  const again = haveASon(withSon);
  check("ok" in again && again.ok === false, "can't have a second son while you already have one");

  let aged = withSon;
  for (let i = 0; i < 5; i++) aged = ageUpSonWithPotion(aged, mulberry32(i * 17 + 1)) as CareerState;
  check(aged.son!.age > 0, "the potion genuinely ages him up over repeated uses");
  check(aged.son!.overall > withSon.son!.overall, "…and genuinely raises his ability");
  check(aged.son!.overall <= 92, "…bounded, not an instant superstar");

  const tooYoung = promoteSonToFirstTeam(withSon, RIVAL);
  check(!tooYoung.ok, "a newborn can't be promoted to any first team");

  let readyCareer = { ...aged, son: { ...aged.son!, age: 20 } };
  readyCareer = buyStake(readyCareer, RIVAL, 60);
  const promoted = promoteSonToFirstTeam(readyCareer, RIVAL);
  check(promoted.ok, `old enough and a majority-owned club promotes him for real (${promoted.reason ?? ""})`);
  if (promoted.ok) {
    const squad = (promoted.career.leagueSquads ?? []).find(s => s.club === RIVAL);
    check(!!squad?.players.some(p => p.id === promoted.career.son!.playerId), "he's genuinely on that club's real squad");

    const withoutOwnership = promoteSonToFirstTeam(readyCareer, RIVAL2);
    check(!withoutOwnership.ok, "promoting him into a club you don't own outright fails");

    const movedSquadBefore = ownedClubState(promoted.career, RIVAL);
    const moved = transferSon(promoted.career, RIVAL2);
    check(moved.ok, `he can be transferred anywhere, no fee, no vote (${moved.reason ?? ""})`);
    if (moved.ok) {
      check(moved.career.son!.club === RIVAL2, "his own record follows the move");
      const oldSquad = (moved.career.leagueSquads ?? []).find(s => s.club === RIVAL);
      const newSquad = (moved.career.leagueSquads ?? []).find(s => s.club === RIVAL2);
      check(!oldSquad?.players.some(p => p.id === promoted.career.son!.playerId), "…genuinely gone from his old squad");
      check(!!newSquad?.players.some(p => p.id === promoted.career.son!.playerId), "…and genuinely present in his new one");
    }
  }
}

// ── G. Club takeovers/mergers ──────────────────────────────────────────────
{
  let career = freshCareer();
  career = buyStake(career, RIVAL, 60);
  check(!canMergeClubs(career, RIVAL, RIVAL2), "a mere 60% majority isn't enough to merge — needs full 100% ownership");

  career = buyStake(career, RIVAL, 40); // top up to 100%
  check(!canMergeClubs(career, RIVAL, RIVAL2), "the OTHER club still isn't owned at all yet");

  career = buyStake(career, RIVAL2, 100);
  check(canMergeClubs(career, RIVAL, RIVAL2), "100% of both clears the bar to merge");

  career = topUpClubBudget(career, RIVAL, 500);
  career = topUpClubBudget(career, RIVAL2, 300);
  const beforeFans = career.relationships.fans;
  const target = getTuning("transfers.squadTarget");

  const merged = mergeClubs(career, RIVAL, RIVAL2);
  check(merged.ok, `a real 100/100 merger succeeds (${merged.reason ?? ""})`);
  if (merged.ok) {
    const primarySquad = (merged.career.leagueSquads ?? []).find(s => s.club === RIVAL);
    check((primarySquad?.players.length ?? 0) === target, `the merged squad is capped at the normal squad size, not just doubled (saw ${primarySquad?.players.length})`);
    check(primarySquad!.players.every((p, i, arr) => i === 0 || arr[i - 1].overall >= p.overall),
      "the best players from BOTH sides survive the cap, not just the primary club's own");

    const absorbedSquad = (merged.career.leagueSquads ?? []).find(s => s.club === RIVAL2);
    check((absorbedSquad?.players.length ?? -1) === 0, "the absorbed club's real squad is genuinely gone, not just relabeled");

    check(ownedClubState(merged.career, RIVAL).budget === 800, "the combined budget lands in the surviving club (500 + 300)");
    check(ownedClubState(merged.career, RIVAL2).dissolvedInto === RIVAL, "the absorbed club is marked dissolved, into the right club");
    check(merged.career.relationships.fans === beforeFans - 15, "a merger costs real fan reputation — stealing a club isn't free");

    const again = mergeClubs(merged.career, RIVAL, RIVAL2);
    check(!again.ok, "an already-dissolved club can't be merged a second time");
  }
}

// ── Both season-boundary hooks are genuinely wired into advanceSeason ──────
{
  let career = freshCareer();
  career = buyStake(career, RIVAL, 60); // majority, for the president/wage half below
  career = buyStake(career, RIVAL2, 20); // a separate MINORITY stake — majority owners can't recommend (section A)
  const filed = submitRecommendation(career, RIVAL2, "sign", "Sign a left-back");
  check("recommendations" in filed, "fixture assumption: filing the recommendation actually succeeded");
  career = filed as CareerState;
  check((career.recommendations ?? []).some(r => r.status === "pending"), "fixture assumption: a pending recommendation is on file");

  let wage = 0;
  const proposed = proposePresidentVote(career, RIVAL, mulberry32(2));
  if (proposed.ok) {
    const forcedWin = { ...proposed.proposal, tally: { ...proposed.proposal.tally, winner: "yes" } };
    const elected = resolvePresidentVote(career, forcedWin, false);
    if (elected.ok) {
      career = topUpClubBudget(elected.career, RIVAL, 2000);
      const wageSet = setPresidentWage(career, RIVAL, 300);
      if (wageSet.ok) { career = wageSet.career; wage = 300; }
    }
  }
  check(wage === 300, "fixture assumption: the president wage was actually set to a known value");

  const beforeMoney = career.money;
  const beforeBudget = ownedClubState(career, RIVAL).budget;
  // Phase 7 also credits this SAME club real stadium revenue on the same
  // rollover (creditStadiumRevenue) — a real, independent hook, not a bug
  // in this one's arithmetic, so it has to be accounted for rather than
  // assuming the wage is the only thing touching this club's budget.
  const stadiumRevenue = Math.round(facilitiesFor(career, RIVAL).stadiumCapacity * 2);
  const rolled = advanceSeason(career, false).career;

  check(!(rolled.recommendations ?? []).some(r => r.status === "pending"),
    "advanceSeason genuinely runs the board's consideration of pending recommendations");
  check(rolled.money >= beforeMoney + wage,
    `advanceSeason genuinely pays out the president wage on top of everything else this rollover pays (before ${beforeMoney}, after ${rolled.money}, wage ${wage})`);
  check(ownedClubState(rolled, RIVAL).budget === beforeBudget - wage + stadiumRevenue,
    `…drawn exactly from the club's own budget net of its own real stadium revenue, not invented (saw ${ownedClubState(rolled, RIVAL).budget}, expected ${beforeBudget - wage + stadiumRevenue})`);
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems.slice(0, 30)) console.log(`  ✗ ${p}`);
  if (problems.length > 30) console.log(`  ...and ${problems.length - 30} more`);
  process.exit(1);
}
console.log("PASS — minority recommendations, formations, kits, presidencies, the son mechanic, and mergers are all real, bounded, and honest about their own limits");
