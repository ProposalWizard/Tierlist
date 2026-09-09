import {
  clubValuation, buyStake, sellStake, stakeIn, isMajorityOwner, canInvestIn, MAJORITY_THRESHOLD,
  topUpClubBudget, ownedClubState, signPlayerForOwnedClub, sellPlayerFromOwnedClub, replaceManagerForOwnedClub,
  allInvestableClubs,
} from "../../lib/star/investments";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS, CHAMPIONS_LEAGUE_CLUBS } from "../../lib/star/clubs";
import { FREE_AGENTS_CLUB } from "../../lib/star/leagueSquads";
import type { CareerState, LeagueSquad, LeaguePlayer, StarPlayer } from "../../lib/star/types";

/**
 * OWNING A PIECE OF A REAL CLUB.
 *
 * Requested directly: buy a stake in any club, priced off real reputation/
 * league position/squad rating, moving with real performance — and past
 * 50.1%, real control over transfers, a manager appointment, and the
 * club's own budget. This checks the valuation actually reflects real
 * facts (not an arbitrary number), the buy/sell arithmetic is honest, and
 * every governance action genuinely mutates the same squad/strength data
 * the rest of the game reads — never a cosmetic edit.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function player(): StarPlayer {
  return {
    firstName: "Test", lastName: "Player", age: 25, skinTone: "light",
    club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
  } as StarPlayer;
}

function squadFor(club: string, avgOverall: number): LeagueSquad {
  const players: LeaguePlayer[] = Array.from({ length: 18 }, (_, i) => ({
    id: `${club}:${i}`, name: `${club} Player ${i}`, position: "CM",
    positions: ["CM"], overall: avgOverall + (i % 5) - 2, goals: 0, assists: 0,
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
    freeAgents: [
      { id: "fa1", name: "Free Agent One", position: "ST", positions: ["ST"], overall: 70, goals: 0, assists: 0 },
    ],
    ...overrides,
  };
}

const RIVAL = PREMIER_LEAGUE_CLUBS.find(c => c !== "Arsenal")!;
const RIVAL2 = PREMIER_LEAGUE_CLUBS.filter(c => c !== "Arsenal" && c !== RIVAL)[0];

// ── allInvestableClubs: a real, deduplicated list ──────────────────────────
{
  const list = allInvestableClubs();
  check(list.length > 50, `a real, sizeable universe of investable clubs (${list.length})`);
  check(new Set(list).size === list.length, "no club appears twice");
  check(list.includes("Arsenal") && list.includes("Real Madrid"), "covers both domestic and European names");
}

// ── clubValuation: reflects real facts, not an arbitrary number ──────────
{
  const career = freshCareer();
  const strongLeague = career.league.map(t => (t.name === RIVAL ? { ...t, strength: 92 } : t));
  const weakLeague = career.league.map(t => (t.name === RIVAL ? { ...t, strength: 60 } : t));
  const strongVal = clubValuation(RIVAL, { ...career, league: strongLeague });
  const weakVal = clubValuation(RIVAL, { ...career, league: weakLeague });
  check(strongVal > weakVal, `a genuinely stronger side is worth more (${strongVal} vs ${weakVal})`);

  const baseline = clubValuation(RIVAL, career);
  const asChampion = clubValuation(RIVAL, { ...career, lastSeasonWinners: { league: RIVAL } });
  check(asChampion > baseline, `winning the league last season is worth more today than not having (${asChampion} vs ${baseline})`);

  const clWinner = clubValuation(RIVAL, { ...career, lastSeasonWinners: { championsLeague: RIVAL } });
  check(clWinner > asChampion, `winning the Champions League is worth even more than winning the domestic league (${clWinner} vs ${asChampion})`);

  check(clubValuation(RIVAL, career) >= 500, "valuation never collapses to zero or negative");
}

// ── buyStake / sellStake: honest arithmetic ────────────────────────────────
{
  const career = freshCareer();
  check(!canInvestIn(career, career.player.club), "can't invest in your own employer");
  const blocked = buyStake(career, career.player.club, 1);
  check(blocked === career, "…and buyStake is a no-op against your own club");

  const valuation = clubValuation(RIVAL, career);
  const after = buyStake(career, RIVAL, 1);
  const expectedCost = Math.round(valuation * 0.01);
  check(after.money === career.money - expectedCost, `1% costs 1% of the valuation (${career.money - after.money} vs ${expectedCost})`);
  check(stakeIn(after, RIVAL)?.percent === 1, "the stake is recorded at exactly 1%");
  check(stakeIn(after, RIVAL)?.avgBuyValuation === valuation, "the buy-in valuation is recorded");

  // Buying more merges into a weighted-average buy valuation.
  const doubled = buyStake({ ...after, league: after.league.map(t => (t.name === RIVAL ? { ...t, strength: 95 } : t)) }, RIVAL, 1);
  check(Math.abs((stakeIn(doubled, RIVAL)?.percent ?? 0) - 2) < 1e-6, "a second purchase adds to the existing stake");

  // Can't buy more than you can afford.
  const poorCareer = { ...career, money: 1 };
  const poor = buyStake(poorCareer, RIVAL, 50);
  check(poor === poorCareer, "buying a stake you can't afford is a no-op");

  // Selling pays out and can't oversell.
  const sold = sellStake(after, RIVAL, 1);
  check(sold.money > after.money, `selling the stake pays out (${after.money} -> ${sold.money})`);
  check(stakeIn(sold, RIVAL) === undefined, "selling the whole stake removes it from the portfolio");
  const oversell = sellStake(after, RIVAL, 5);
  check(oversell === after, "can't sell more than you own");
}

// ── Majority threshold ──────────────────────────────────────────────────
{
  let career = freshCareer();
  career = buyStake(career, RIVAL, 40);
  check(!isMajorityOwner(career, RIVAL), `40% is not a majority (threshold is ${MAJORITY_THRESHOLD}%)`);
  career = buyStake(career, RIVAL, 11);
  check(isMajorityOwner(career, RIVAL), "51% crosses the majority threshold");
}

// ── Governance: locked out without a majority ──────────────────────────────
{
  const career = freshCareer();
  const topUp = topUpClubBudget(career, RIVAL, 1000);
  check(topUp === career, "topping up a club's budget without majority ownership is a no-op");
  const sign = signPlayerForOwnedClub(career, RIVAL, "fa1", FREE_AGENTS_CLUB);
  check(!sign.ok, "signing a player without majority ownership fails");
  const sell = sellPlayerFromOwnedClub(career, RIVAL, `${RIVAL}:0`);
  check(!sell.ok, "selling a player without majority ownership fails");
  const manager = replaceManagerForOwnedClub(career, RIVAL, "A Manager");
  check(!manager.ok, "appointing a manager without majority ownership fails");
}

// ── Governance: signing a free agent — real squad change, no fee ─────────
{
  let career = freshCareer();
  career = buyStake(career, RIVAL, 60);
  career = topUpClubBudget(career, RIVAL, 500);
  const before = ownedClubState(career, RIVAL).budget;
  const result = signPlayerForOwnedClub(career, RIVAL, "fa1", FREE_AGENTS_CLUB);
  check(result.ok, "signing a free agent succeeds once majority owner");
  check(ownedClubState(result.career, RIVAL).budget === before, "…at no cost — free agents are free");
  check((result.career.freeAgents ?? []).every(p => p.id !== "fa1"), "the free agent is removed from the pool");
  const squad = (result.career.leagueSquads ?? []).find(s => s.club === RIVAL);
  check(!!squad?.players.some(p => p.id === "fa1"), "…and now appears in the club's real squad");
}

// ── Governance: buying a player from another club — real fee, real move ──
{
  let career = freshCareer();
  career = buyStake(career, RIVAL, 60);
  career = topUpClubBudget(career, RIVAL, 100000);
  const targetId = `${RIVAL2}:0`;
  const targetOverall = squadFor(RIVAL2, 75).players[0].overall;
  const before = ownedClubState(career, RIVAL).budget;

  const tooPoor = signPlayerForOwnedClub({ ...career, ownedClubs: { [RIVAL]: { budget: 0.01 } } }, RIVAL, targetId, RIVAL2);
  check(!tooPoor.ok, "signing a player the club can't afford fails");

  const result = signPlayerForOwnedClub(career, RIVAL, targetId, RIVAL2);
  check(result.ok, `buying a real player from another club succeeds (${result.reason ?? ""})`);
  check(ownedClubState(result.career, RIVAL).budget < before, "…and spends real money from the club's budget");
  const buyerSquad = (result.career.leagueSquads ?? []).find(s => s.club === RIVAL);
  const sellerSquad = (result.career.leagueSquads ?? []).find(s => s.club === RIVAL2);
  check(!!buyerSquad?.players.some(p => p.id === targetId), "the player now appears in the buying club's real squad");
  check(!sellerSquad?.players.some(p => p.id === targetId), "…and no longer appears in the selling club's squad");
  void targetOverall;
}

// ── Governance: selling a player — proceeds, and a squad-size floor ──────
{
  let career = freshCareer();
  career = buyStake(career, RIVAL, 60);
  const before = ownedClubState(career, RIVAL).budget;
  const result = sellPlayerFromOwnedClub(career, RIVAL, `${RIVAL}:0`);
  check(result.ok, "selling a real player from an owned club succeeds");
  check(ownedClubState(result.career, RIVAL).budget > before, "…and the fee lands in the club's budget");
  const squad = (result.career.leagueSquads ?? []).find(s => s.club === RIVAL);
  check(!squad?.players.some(p => p.id === `${RIVAL}:0`), "…and he's genuinely gone from the squad");

  // Selling down toward the minimum eventually gets blocked.
  let thin = career;
  let blockedAt = -1;
  for (let i = 0; i < 18; i++) {
    const squadNow = (thin.leagueSquads ?? []).find(s => s.club === RIVAL)!;
    if (squadNow.players.length === 0) break;
    const r = sellPlayerFromOwnedClub(thin, RIVAL, squadNow.players[0].id);
    if (!r.ok) { blockedAt = squadNow.players.length; break; }
    thin = r.career;
  }
  check(blockedAt > 0, `selling is eventually blocked before the squad is emptied out (stopped at ${blockedAt} players)`);
}

// ── Governance: appointing a manager — real cost, real record ────────────
{
  let career = freshCareer();
  career = buyStake(career, RIVAL, 60);
  career = topUpClubBudget(career, RIVAL, 10000);
  const tooExpensive = replaceManagerForOwnedClub({ ...career, ownedClubs: { [RIVAL]: { budget: 1 } } }, RIVAL, "Pep Guardiola");
  check(!tooExpensive.ok, "appointing a manager the club can't afford fails");

  const before = ownedClubState(career, RIVAL).budget;
  const result = replaceManagerForOwnedClub(career, RIVAL, "Pep Guardiola");
  check(result.ok, `appointing a real manager succeeds (${result.reason ?? ""})`);
  check(ownedClubState(result.career, RIVAL).budget < before, "…and costs real money from the club's budget");
  check(ownedClubState(result.career, RIVAL).managerName === "Pep Guardiola", "…and the appointment is on record");
}

// ── Governance: a club whose real squad lives in externalSquads, not
// leagueSquads (any Champions/Europa League, Other, or other-division club —
// see investments.ts's findSquadEntry header for why) ─────────────────────
{
  const EURO_CLUB = "Atlético Madrid"; // CHAMPIONS_LEAGUE_CLUBS, not in PREMIER_LEAGUE_CLUBS
  check(CHAMPIONS_LEAGUE_CLUBS.includes(EURO_CLUB) && !PREMIER_LEAGUE_CLUBS.includes(EURO_CLUB),
    "fixture assumption: this club is European, not domestic");

  let career = freshCareer({ externalSquads: [squadFor(EURO_CLUB, 80)] });
  career = buyStake(career, EURO_CLUB, 60);
  check(isMajorityOwner(career, EURO_CLUB), "can buy a majority stake in a European club too");

  const before = ownedClubState(career, EURO_CLUB).budget;
  const signed = signPlayerForOwnedClub(career, EURO_CLUB, "fa1", FREE_AGENTS_CLUB);
  check(signed.ok, `signing into a club filed under externalSquads succeeds (${signed.reason ?? ""})`);
  const afterSquad = (signed.career.externalSquads ?? []).find(s => s.club === EURO_CLUB);
  check(!!afterSquad?.players.some(p => p.id === "fa1"), "…and the new player lands in externalSquads, where this club actually lives");
  check((signed.career.leagueSquads ?? []).every(s => s.club !== EURO_CLUB), "…never spuriously created in leagueSquads");

  const sold = sellPlayerFromOwnedClub(signed.career, EURO_CLUB, `${EURO_CLUB}:0`);
  check(sold.ok, `selling from a club filed under externalSquads succeeds (${sold.reason ?? ""})`);
  const soldSquad = (sold.career.externalSquads ?? []).find(s => s.club === EURO_CLUB);
  check(!soldSquad?.players.some(p => p.id === `${EURO_CLUB}:0`), "…and he's genuinely gone from externalSquads");
  check(ownedClubState(sold.career, EURO_CLUB).budget > before, "…with the fee landing in the club's real budget");
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems.slice(0, 25)) console.log(`  ✗ ${p}`);
  if (problems.length > 25) console.log(`  ...and ${problems.length - 25} more`);
  process.exit(1);
}
console.log("PASS — club valuations reflect real form, and majority ownership genuinely moves real squads and money");
