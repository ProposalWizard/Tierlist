import { oddsFor, settleBets, betNewsLines, type CompetitionBet } from "../../lib/star/competitionBetting";
import type { SeasonWinners } from "../../lib/star/careerFlow";

/**
 * THE CASINO'S BOOK.
 *
 * Requested directly: bet on the winner of any competition, priced off real
 * team ratings. This checks the two things a betting market actually has to
 * get right — the book reflects genuine ability (a real favourite is
 * genuinely favoured, nobody is priced as a sure thing) and a bet settles
 * against the exact same result the rest of the game already agreed on
 * (never re-decided here) — plus the boring arithmetic (a loss pays nothing,
 * a win pays stake×odds, an old season's stray bet is left alone).
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// ── oddsFor: a real book ───────────────────────────────────────────────────
{
  const field = [
    { name: "Man City", strength: 92 },
    { name: "Arsenal", strength: 85 },
    { name: "Everton", strength: 68 },
    { name: "Luton", strength: 58 },
  ];
  const book = oddsFor(field);
  check(book.length === 4, `every entrant gets a price (${book.length})`);
  const by = new Map(book.map(b => [b.name, b.odds]));

  check(by.get("Man City")! < by.get("Arsenal")!, "the strongest side is the shortest price");
  check(by.get("Arsenal")! < by.get("Everton")!, "…and the ordering holds all the way down");
  check(by.get("Everton")! < by.get("Luton")!, "…to the weakest side having the longest odds");

  check(by.get("Man City")! >= 1.15, `even a huge favourite is never a sure thing (${by.get("Man City")})`);
  check(by.get("Luton")! <= 250, `even a huge underdog is never priced as impossible (${by.get("Luton")})`);
  check(book.every(b => b.odds > 1), "every price is worse than even money against the field (odds > 1)");

  // The book should imply a bookmaker's overround, not a fair coin: summed
  // implied probability (1/odds) comes out ABOVE 1, which is where the
  // house's edge actually lives.
  const impliedTotal = book.reduce((s, b) => s + 1 / b.odds, 0);
  check(impliedTotal > 1, `the book overrounds — implied probabilities sum above 1 (${impliedTotal.toFixed(3)})`);
  check(impliedTotal < 1.3, `…but not absurdly so (${impliedTotal.toFixed(3)})`);
}

// ── A near-even field prices near-even, not arbitrarily ────────────────────
{
  const evenField = [
    { name: "A", strength: 74 }, { name: "B", strength: 74 },
    { name: "C", strength: 75 }, { name: "D", strength: 73 },
  ];
  const book = oddsFor(evenField);
  const spread = Math.max(...book.map(b => b.odds)) - Math.min(...book.map(b => b.odds));
  check(spread < 2, `four evenly-matched sides get close prices, not wildly different ones (spread ${spread.toFixed(2)})`);
}

// ── Duplicate entrants fold together rather than double-booking a club ─────
{
  const withDup = [
    { name: "Real Madrid", strength: 90 },
    { name: "Real Madrid", strength: 90 },
    { name: "Getafe", strength: 60 },
  ];
  const book = oddsFor(withDup);
  check(book.filter(b => b.name === "Real Madrid").length === 1, "a club listed twice appears once in the book");
  check(book.length === 2, `…and the book has exactly as many rows as real contenders (${book.length})`);
}

// ── settleBets: pays the winner, pays nothing to everyone else ────────────
{
  const bets: CompetitionBet[] = [
    { id: "1", competition: "league", club: "Arsenal", odds: 3.4, stake: 10, season: 5 },
    { id: "2", competition: "faCup", club: "Chelsea", odds: 8.0, stake: 5, season: 5 },
    { id: "3", competition: "championsLeague", club: "Real Madrid", odds: 4.2, stake: 20, season: 5 },
  ];
  const winners: SeasonWinners = {
    league: "Arsenal", faCup: "Liverpool", leagueCup: "Man City",
    championsLeague: "Real Madrid", europaLeague: "Sevilla",
  };
  const { settled, stillPending, totalPayout } = settleBets(bets, winners, 5);

  check(settled.length === 3, `all three season-5 bets settle (${settled.length})`);
  check(stillPending.length === 0, "…leaving nothing pending");

  const byId = new Map(settled.map(s => [s.bet.id, s]));
  check(byId.get("1")!.won === true, "the league bet on Arsenal wins — Arsenal won the league");
  check(byId.get("1")!.payout === 34, `…paying stake × odds (${byId.get("1")!.payout})`);
  check(byId.get("2")!.won === false, "the FA Cup bet on Chelsea loses — Liverpool won it");
  check(byId.get("2")!.payout === 0, "…and pays nothing");
  check(byId.get("3")!.won === true, "the Champions League bet on Real Madrid wins");
  check(byId.get("3")!.payout === 84, `…paying out correctly (${byId.get("3")!.payout})`);
  check(totalPayout === 34 + 0 + 84, `total payout is the sum of the winners only (${totalPayout})`);
}

// ── A bet from a DIFFERENT season is left alone, not wrongly resolved ─────
{
  const bets: CompetitionBet[] = [
    { id: "old", competition: "league", club: "Arsenal", odds: 3.0, stake: 10, season: 3 },
    { id: "new", competition: "league", club: "Arsenal", odds: 3.0, stake: 10, season: 5 },
  ];
  const winners: SeasonWinners = { league: "Arsenal" };
  const { settled, stillPending } = settleBets(bets, winners, 5);
  check(settled.length === 1 && settled[0].bet.id === "new", "only the current season's bet settles");
  check(stillPending.length === 1 && stillPending[0].id === "old", "…and a stray older-season bet is left pending rather than resolved against the wrong year's result");
}

// ── A competition with no known winner (absent from SeasonWinners) never
// pays out by accident ──────────────────────────────────────────────────
{
  const bets: CompetitionBet[] = [
    { id: "1", competition: "leagueCup", club: "Anyone", odds: 5.0, stake: 10, season: 1 },
  ];
  const { settled } = settleBets(bets, {}, 1);
  check(settled[0].won === false && settled[0].payout === 0, "an unresolved competition never accidentally pays out");
}

// ── betNewsLines: readable, and only for what actually settled ────────────
{
  const bets: CompetitionBet[] = [
    { id: "1", competition: "league", club: "Arsenal", odds: 3.4, stake: 10, season: 5 },
    { id: "2", competition: "faCup", club: "Chelsea", odds: 8.0, stake: 5, season: 5 },
  ];
  const { settled } = settleBets(bets, { league: "Arsenal", faCup: "Liverpool" }, 5);
  const lines = betNewsLines(settled);
  check(lines.length === 2, "one line per settled bet");
  check(lines[0].includes("Arsenal") && lines[0].includes("won"), `the winning line reads clearly (${lines[0]})`);
  check(lines[1].includes("Chelsea") && !lines[1].includes("won!"), `the losing line reads clearly, without claiming a win (${lines[1]})`);
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — the book favours real form, overrounds like a real bookmaker, and settles only against the real result");
