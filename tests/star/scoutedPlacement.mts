import {
  scoutedPlacement, finalPenScoredOf, scoutedOfferForTrial, SCOUTED_ODDS, type ScoutedDivision,
} from "../../lib/star/scoutedPlacement.ts";
import { clubsForDivision } from "../../lib/star/scoutOffers.ts";
import { makeIdentity, attachClub } from "../../lib/star/careerFlow.ts";
import { mulberry32 } from "../../lib/star/season.ts";
import { divisionOf as divisionOfClub } from "../../lib/star/clubs.ts";
import { matchweeksFor } from "../../lib/star/calendar.ts";
import type { StarPlayer } from "../../lib/star/types.ts";

/**
 * "A SCOUT HAS SPOTTED YOU" (P36, P63, Harry 1 Oct 2026).
 *
 * The trial places you at a random club in the National League, North or
 * South, with the National League likelier if you scored the final shootout
 * penalty. Checked: the measured odds over 40,000 placements match
 * SCOUTED_ODDS, every club is a real member of the division it is placed in
 * and every member gets picked, a seed always lands at the same club, the
 * flag is read the way the rebuilt trial will set it, and a career started
 * from the offer is a real 24-club, 46-week season in that division.
 */

let fail = 0;
const check = (ok: boolean, msg: string) => { if (!ok) { fail++; console.log("  ✗ " + msg); } };

const N = 40_000;
for (const scored of [true, false]) {
  const rng = mulberry32(scored ? 11 : 12);
  const counts: Record<ScoutedDivision, number> = { national_league: 0, national_league_north: 0, national_league_south: 0 };
  const seenClubs = new Map<ScoutedDivision, Set<string>>();
  for (let i = 0; i < N; i++) {
    const p = scoutedPlacement(scored, rng);
    counts[p.division]++;
    if (divisionOfClub(p.club) !== p.division) check(false, `${p.club} placed in ${p.division} but is tagged ${divisionOfClub(p.club)}`);
    if (!p.clubs.includes(p.club) || p.clubs.length !== 24) check(false, `${p.club}'s club list is wrong (${p.clubs.length})`);
    if (!seenClubs.has(p.division)) seenClubs.set(p.division, new Set());
    seenClubs.get(p.division)!.add(p.club);
  }
  const odds = SCOUTED_ODDS[scored ? "scored" : "missed"];
  for (const d of Object.keys(counts) as ScoutedDivision[]) {
    const got = counts[d] / N;
    check(Math.abs(got - odds[d]) < 0.01, `${scored ? "scored" : "missed"}: ${d} ${(got * 100).toFixed(1)}% vs ${odds[d] * 100}%`);
    check((seenClubs.get(d)?.size ?? 0) === 24, `${scored ? "scored" : "missed"}: every ${d} club gets picked (${seenClubs.get(d)?.size})`);
  }
  console.log(`  ${scored ? "scored final pen" : "missed final pen"}: National League ${(counts.national_league / N * 100).toFixed(1)}% · North ${(counts.national_league_north / N * 100).toFixed(1)}% · South ${(counts.national_league_south / N * 100).toFixed(1)}%`);
}
check(SCOUTED_ODDS.scored.national_league > SCOUTED_ODDS.missed.national_league, "scoring the final pen makes the National League likelier");

// The flag, and its fallback until the rebuilt trial sets it.
check(finalPenScoredOf({ finalPenScored: true }) === true, "an explicit true is read");
check(finalPenScoredOf({ finalPenScored: false, results: { shootout: { quality: 1 } } }) === false, "an explicit false wins over the stage result");
check(finalPenScoredOf({ results: { shootout: { quality: 2 / 3 } } }) === true, "fallback: 2 of 3 shootout kicks scored reads as scored");
check(finalPenScoredOf({ results: { shootout: { quality: 1 / 3 } } }) === false, "fallback: 1 of 3 reads as missed");
check(finalPenScoredOf({ results: {} }) === false && finalPenScoredOf(null) === false, "no shootout reads as missed");

// Same trial, same club, every time (a reload can't re-roll it).
{
  const t = { seed: 424242, finalPenScored: true };
  const a = scoutedOfferForTrial(t), b = scoutedOfferForTrial(t);
  check(a.club === b.club && a.division === b.division && a.wage === b.wage, `a trial always lands at the same club (${a.club})`);
  check(a.wage > 0 && a.seasons === 2 && a.strength > 0, `the offer is a real contract (★${a.wage}/wk, ${a.seasons} seasons, strength ${a.strength})`);
}

// The offer starts a real season in that division.
const P: StarPlayer = { firstName: "T", lastName: "P", age: 16, skinTone: "light", club: "", clubBadge: null, position: "ST", nationality: "England", startYear: 2027 };
const reached = new Set<string>();
for (let seed = 1; seed < 400 && reached.size < 3; seed++) {
  const offer = scoutedOfferForTrial({ seed, finalPenScored: seed % 2 === 0 });
  if (reached.has(offer.division)) continue;
  reached.add(offer.division);
  const c = attachClub(makeIdentity({ ...P, club: offer.club }, offer.division), offer.club, clubsForDivision(offer.division), offer.division, offer.wage);
  const league = c.fixtures.filter(f => (f.kind ?? "league") === "league");
  check(c.player.club === offer.club && c.division === offer.division, `${offer.division}: career at ${offer.club} in ${c.division}`);
  check(c.league.length === 24 && league.length === matchweeksFor(offer.division) && league.length === 46,
    `${offer.division}: 24-club table, 46 league fixtures (${c.league.length}, ${league.length})`);
  check(c.fixtures.some(f => f.competition === "FA Cup") && !c.fixtures.some(f => f.competition === "League Cup"),
    `${offer.division}: in the FA Cup, not the League Cup`);
}
check(reached.size === 3, `careers started in all three divisions (${Array.from(reached).join(", ")})`);

if (fail) { console.log(`FAIL (${fail})`); process.exit(1); }
console.log("PASS — scouted into the National League / North / South at the set odds, same club on reload, a real season");
