import { contractForClubMove } from "../../lib/star/contracts";
import { generateRelegationOffers } from "../../lib/star/relegationOffers";
import { makeInitialCareer, advanceSeason } from "../../lib/star/careerFlow";
import { mulberry32 } from "../../lib/star/season";
import { NATIONAL_LEAGUE_NORTH_CLUBS, CHAMPIONSHIP_CLUBS } from "../../lib/star/clubs";
import type { CareerState, Contract, StarPlayer } from "../../lib/star/types";

/**
 * UP OR DOWN WITH YOUR CLUB, AND WHO WANTS YOU AFTER (Mikey, 8 Oct 2026).
 * Down with your club: wage and bonuses −25%. Up: wage +25%. Forced out of
 * the bottom division: offers follow your season, never from a club going up.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const c0 = { club: "X", wage: 1000, goalBonus: 200, assistBonus: 100, seasonsRemaining: 3, appearanceFee: 40, releaseClause: 20000 } as unknown as Contract;
const down = contractForClubMove(c0, "relegated");
check(down.wage === 750 && down.goalBonus === 150 && down.assistBonus === 75, `down: wage and bonuses −25% (${down.wage}/${down.goalBonus}/${down.assistBonus})`);
check(down.appearanceFee === 30 && down.releaseClause === 15000, "down: appearance fee and release clause follow");
const up = contractForClubMove(c0, "promoted");
check(up.wage === 1250 && up.goalBonus === 200 && up.assistBonus === 100, `up: wage +25%, bonuses as they were (${up.wage}/${up.goalBonus})`);
check(up.releaseClause === 25000, "up: the release clause follows the wage");
check(contractForClubMove(c0, null) === c0, "no move: nothing changes");

const player = (club: string) => ({ firstName: "T", lastName: "P", age: 22, skinTone: "light", club, clubBadge: null,
  position: "ST", nationality: "England", startYear: 2027 } as StarPlayer);
function finishing(clubs: string[], division: string, you: string, place: number): CareerState {
  const c = makeInitialCareer(player(you), clubs, division as never);
  const order = clubs.filter(x => x !== you); order.splice(place - 1, 0, you);
  return { ...c, league: c.league.map(t => { const p = (clubs.length - order.indexOf(t.name)) * 3; return { ...t, played: 46, points: p, won: p / 3, goalsFor: p }; }) };
}

// The real rollover: relegated from the Championship, promoted from it, stayed.
{
  const ch = [...CHAMPIONSHIP_CLUBS];
  for (const [place, want] of [[24, 0.75], [1, 1.25], [12, 1]] as const) {
    const c = finishing(ch, "championship", ch[7], place);
    const before = c.contract.wage;
    const after = advanceSeason(c, false).career.contract.wage;
    check(Math.abs(after - Math.max(1, Math.round(before * want))) <= 1, `championship ${place}th: wage ×${want} (${before} → ${after})`);
  }
  const moved = finishing(ch, "championship", ch[7], 24);
  const kept = advanceSeason(moved, false, true).career.contract.wage;
  check(kept === moved.contract.wage, "a transfer this summer: the new deal is not cut");
}

// Forced out of North: never a club that goes up; worse seasons, weaker clubs.
{
  const north = [...NATIONAL_LEAGUE_NORTH_CLUBS];
  const c = finishing(north, "national_league_north", north[5], 24);
  const champion = north.filter(x => x !== north[5])[0];
  const avg = (stars: number, goals: number, form: number[]) => {
    const cc = { ...c, starRating: stars, seasonStats: { ...c.seasonStats, goals }, form };
    let sum = 0, n = 0, up = 0, above = 0;
    for (let s = 0; s < 300; s++) for (const o of generateRelegationOffers(cc, mulberry32(s))) {
      if (o.club === champion) up++;
      if (o.division !== "national_league_north") { above++; continue; }
      sum += o.strength; n++;
    }
    return { mean: sum / n, up, above };
  };
  const awful = avg(0.5, 0, [5]), good = avg(3, 15, [7.5]), great = avg(4.6, 30, [9]);
  check(awful.up + good.up + great.up === 0, "no offer from the champion (it goes up)");
  check(awful.mean < good.mean - 3 && good.mean < great.mean - 3, `worse season, weaker clubs (${awful.mean.toFixed(1)} < ${good.mean.toFixed(1)} < ${great.mean.toFixed(1)})`);
  check(awful.above === 0 && great.above > 150, `only a great season gets National League offers (${awful.above}, ${great.above} in 300)`);
}

if (problems.length) {
  console.error(`clubMovePay: ${problems.length} problem(s)`);
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("clubMovePay: all good");
