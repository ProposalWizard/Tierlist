import { generateOffers, acceptOffer, reputation, MOVE_RESET } from "../../lib/star/transfers";
import { retirementCheck, careerVerdict, retire, RETIRE_FROM, RETIRE_AT } from "../../lib/star/retirement";
import { makeInitialCareer, advanceSeason } from "../../lib/star/careerFlow";
import { selectionFor } from "../../lib/star/selection";
import type { CareerState, StarPlayer } from "../../lib/star/types";

/**
 * Transfers, and the end of a career.
 *
 * A `"season-transfer"` phase had been sitting unused in StarPhase since the
 * game was written, and the only thing that mentioned moving club was a dilemma
 * where your agent asks how you feel about it — you signed for one club at
 * eighteen and finished there whatever you did.
 *
 * And a career had no end. You aged, your pace declined a few points a year past
 * thirty, and then you carried on for ever, because nothing in the game knew how
 * to stop.
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

const PLAYER: StarPlayer = {
  firstName: "Test", lastName: "Player", age: 22, position: "ST",
  club: "Arsenal", nationality: "England", startYear: 2026,
} as StarPlayer;
const CLUBS = ["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs", "Newcastle", "Aston Villa", "Brighton", "West Ham"];
const base = () => makeInitialCareer(PLAYER, CLUBS);

/** A career at a given standing, with everything else held still. */
function at(rep: { star: number; goals?: number; form?: number[]; fame?: number }): CareerState {
  const c = base();
  return {
    ...c,
    starRating: rep.star,
    fame: rep.fame ?? 20,
    form: rep.form ?? [7, 7, 7, 7, 7],
    seasonStats: { ...c.seasonStats, goals: rep.goals ?? 8, appearances: 20 },
  };
}

/** How many of 200 seeds produce at least one offer. */
const offerRate = (c: CareerState) =>
  Array.from({ length: 200 }, (_, i) => generateOffers(c, mulberry32(i + 1)).length).filter(n => n > 0).length / 200;

// ── Interest is earned ──────────────────────────────────────────────────────
{
  const nobody = at({ star: 0.8, goals: 0, form: [5.5, 5.4, 5.6, 5.2, 5.8], fame: 2 });
  const decent = at({ star: 3.0, goals: 12, fame: 30 });
  const star = at({ star: 4.8, goals: 26, form: [8.5, 8.2, 9, 8.8, 8.4], fame: 78 });

  check(reputation(nobody) < reputation(decent) && reputation(decent) < reputation(star),
    `reputation is ordered (${reputation(nobody).toFixed(0)} < ${reputation(decent).toFixed(0)} < ${reputation(star).toFixed(0)})`);

  const a = offerRate(nobody), b = offerRate(decent), c = offerRate(star);
  check(a < b && b <= c, `and so is the interest it attracts (${a.toFixed(2)} / ${b.toFixed(2)} / ${c.toFixed(2)})`);
  check(a < 0.35, `a player nobody rates is mostly left alone (${(a * 100).toFixed(0)}%)`);
  check(c > 0.85, `and one everybody rates is not (${(c * 100).toFixed(0)}%)`);

  // Never more than three, never a bid from your own club.
  for (let i = 0; i < 200; i++) {
    const offers = generateOffers(star, mulberry32(i + 900));
    if (offers.length > 3) { check(false, "at most three clubs come in"); break; }
    if (offers.some(o => o.club === star.player.club)) { check(false, "your own club does not bid for you"); break; }
    if (new Set(offers.map(o => o.club)).size !== offers.length) { check(false, "no club bids twice"); break; }
  }
  check(true, "the offer list is well formed");
}

// ── A bigger club asks for more ─────────────────────────────────────────────
{
  const c = at({ star: 3.6, goals: 16, fame: 45 });
  const table = [...c.league].sort((x, y) => y.strength - x.strength);
  const best = table[0], worst = table[table.length - 1];

  // The same player, judged by the two extremes of the division.
  let bigInterested = 0, smallInterested = 0;
  for (let i = 0; i < 400; i++) {
    const offers = generateOffers(c, mulberry32(i + 5));
    if (offers.some(o => o.club === best.name)) bigInterested++;
    if (offers.some(o => o.club === worst.name)) smallInterested++;
  }
  check(smallInterested > bigInterested,
    `a smaller club comes for you sooner than a bigger one (${smallInterested} vs ${bigInterested} of 400)`);
}

// ── A running-down contract brings more interest ───────────────────────────
{
  const c = at({ star: 3.2, goals: 14, fame: 35 });
  const secure = { ...c, contract: { ...c.contract, seasonsRemaining: 3 } };
  const expiring = { ...c, contract: { ...c.contract, seasonsRemaining: 1 } };
  check(offerRate(expiring) > offerRate(secure),
    `a club that can have you cheaply is likelier to ask (${offerRate(secure).toFixed(2)} → ${offerRate(expiring).toFixed(2)})`);
}

// ── Moving costs you something ──────────────────────────────────────────────
//
// Without this, taking the biggest wage every summer would be strictly correct
// and there would be no decision in it.
{
  const c: CareerState = {
    ...at({ star: 4, goals: 20, fame: 60 }),
    relationships: { boss: 95, team: 92, fans: 88, girlfriend: null, sponsors: 40 },
  };
  const offers = generateOffers(c, mulberry32(3));
  check(offers.length > 0, "there is an offer to take");
  const o = offers[0];
  const moved = acceptOffer(c, o);

  check(moved.player.club === o.club, "you play for the new club");
  check(moved.contract.club === o.club && moved.contract.wage === o.wage, "on the new contract");
  check(moved.money === c.money + o.signingFee, "and the signing fee is paid");

  check(moved.relationships.team === MOVE_RESET.team, "a new dressing room does not know you");
  check(moved.relationships.boss === MOVE_RESET.boss, "and a new manager has not picked you before");
  check(moved.relationships.fans <= MOVE_RESET.fansCap, "new supporters start from scratch too");
  check(moved.matchFitness < c.matchFitness, "and you lose sharpness settling in");

  const oldNames = new Set(c.squad.map(p => p.name));
  const newNames = moved.squad.map(p => p.name);
  check(newNames.length > 0 && newNames.some(n => !oldNames.has(n)),
    "you get new team-mates — keeping the old sheet would have you setting up players at your old club");
  check((moved.transfers ?? []).length === 1, "the move is recorded");
  check((moved.transfers ?? [])[0].from === c.player.club && (moved.transfers ?? [])[0].to === o.club,
    "with both ends of it");

  // The place in the side is genuinely earned again.
  check(selectionFor(moved).standing < selectionFor(c).standing,
    "you arrive with something to prove");

  // …and the season that follows is played for the new club.
  const nextSeason = advanceSeason(moved, false).career;
  check(nextSeason.fixtures.every(f => f.opponent !== o.club || f.kind !== "league"),
    "you no longer play yourself in the league");
}

// ── The end of a career ─────────────────────────────────────────────────────
{
  const young = { ...base(), player: { ...PLAYER, age: 24 } };
  check(!retirementCheck(young).canRetire, "a twenty-four-year-old is not retiring");

  const veteran = { ...base(), player: { ...PLAYER, age: RETIRE_FROM } };
  const vc = retirementCheck(veteran);
  check(vc.canRetire && !vc.mustRetire, `from ${RETIRE_FROM} it is your call`);
  check(vc.reason.length > 0, "and you are told why it is being asked");

  const done = { ...base(), player: { ...PLAYER, age: RETIRE_AT } };
  check(retirementCheck(done).mustRetire, `at ${RETIRE_AT} it is not`);

  const retired = retire(veteran);
  check(retired.retired === true, "hanging them up is recorded on the career itself");
  check(retirementCheck(retired).canRetire, "the check itself is unaffected — the flag on the career is what routes you");

  // A body that has gone reads differently from one that has not.
  const worn = { ...veteran, matchFitness: 40 };
  check(retirementCheck(worn).reason !== vc.reason, "and the reason reflects the state you are in");
}

// ── What it added up to ─────────────────────────────────────────────────────
{
  const journeyman = careerVerdict({ ...base(), season: 12, careerStats: { ...base().careerStats, appearances: 300, goals: 40, assists: 30, ratingCount: 300, totalRating: 300 * 6.6, hatTricks: 0, passes: 1000, starMan: 4 } });
  const great = careerVerdict({
    ...base(), season: 16, ballonDorWins: 3, caps: 95,
    careerStats: { ...base().careerStats, appearances: 480, goals: 280, assists: 150, ratingCount: 480, totalRating: 480 * 7.9, hatTricks: 20, passes: 4000, starMan: 90 },
    trophies: [
      ...Array.from({ length: 6 }, (_, i) => ({ season: i + 2, competition: "Premier League", club: "Arsenal" })),
      ...Array.from({ length: 3 }, (_, i) => ({ season: i + 4, competition: "Champions League", club: "Arsenal" })),
      { season: 8, competition: "World Cup", club: "England" },
      { season: 5, competition: "FA Cup", club: "Arsenal" },
      { season: 9, competition: "FA Cup", club: "Arsenal" },
    ],
  });

  check(great.score > journeyman.score, `a great career scores higher (${great.score.toFixed(0)} vs ${journeyman.score.toFixed(0)})`);
  check(great.score > 80 && journeyman.score < 45, "and the two land in different brackets");
  check(great.title !== journeyman.title, `with different titles ("${great.title}" vs "${journeyman.title}")`);
  check(great.summary.includes("Ballon"), "the summary leads with the biggest thing you did");
  check(journeyman.summary.includes("goals"), "and falls back to what there is");

  // Longevity counts but does not carry a career on its own.
  const longButQuiet = careerVerdict({ ...base(), season: 20, careerStats: { ...base().careerStats, appearances: 600, goals: 30, assists: 20, ratingCount: 600, totalRating: 600 * 6.4, hatTricks: 0, passes: 2000, starMan: 2 } });
  check(longButQuiet.score < great.score * 0.6,
    `six hundred quiet appearances is not a great career (${longButQuiet.score.toFixed(0)})`);
  check(longButQuiet.score > 0, "but it is a career");

  // Every club you played for is remembered, not just the last one.
  const moved = careerVerdict({
    ...base(),
    transfers: [
      { season: 3, from: "Brighton", to: "Aston Villa", fee: 10 },
      { season: 7, from: "Aston Villa", to: "Arsenal", fee: 40 },
    ],
  });
  check(moved.clubs.includes("Brighton") && moved.clubs.includes("Aston Villa") && moved.clubs.includes("Arsenal"),
    `every club is remembered (${moved.clubs.join(", ")})`);
  check(new Set(moved.clubs).size === moved.clubs.length, "and none of them twice");
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — clubs come for you, moving costs you, and a career ends with what it added up to");
