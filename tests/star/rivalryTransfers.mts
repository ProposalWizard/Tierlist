import { rivalrySellChance, runTransferWindow } from "../../lib/star/leagueTransfers";
import { rivalInterestOdds } from "../../lib/star/transfers";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { mulberry32 } from "../../lib/star/season";
import { generateSquad, clubNameSeed } from "../../lib/star/squadData";
import type { CareerState, LeagueSquad, LeaguePlayer, StarPlayer } from "../../lib/star/types";

/**
 * RIVALS DO NOT SELL TO RIVALS.
 *
 * Two places this had to land: the other clubs' own business with each other
 * (leagueTransfers.ts) and interest shown in YOU (transfers.ts). Both read
 * the same real per-club data (lib/star/rivalries.ts) rather than a fixed
 * no-sell list, so this checks the actual tier numbers rather than a single
 * derby/not-derby switch.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// ── The two gate functions themselves ────────────────────────────────────────
{
  // Arsenal - Tottenham Hotspur: R1, a derby.
  const r1 = rivalrySellChance("Arsenal", "Tottenham Hotspur", false);
  check(r1 < 0.1, `a primary rivalry is close to a hard no (${r1})`);
  const r1Unhappy = rivalrySellChance("Arsenal", "Tottenham Hotspur", true);
  check(r1Unhappy > r1, `an unhappy player forcing it through is more likely than the club selling freely (${r1} -> ${r1Unhappy})`);
  check(r1Unhappy < 1, "but still not a certainty, even then");

  // Arsenal - Manchester City: R3, no derby.
  const r3 = rivalrySellChance("Arsenal", "Manchester City", false);
  check(r3 > r1, `a lesser rivalry dampens far less than a primary one (${r3} vs ${r1})`);
  check(r3 < 1, "but still dampens something");

  // Chelsea - Fulham: a derby with no rated tier at all.
  const derbyOnly = rivalrySellChance("Chelsea", "Fulham FC", false);
  check(derbyOnly > 0 && derbyOnly < 1, `a derby with no tier still dampens (${derbyOnly})`);

  // No rivalry at all.
  check(rivalrySellChance("Arsenal", "Everton", false) === 1, "no rivalry, no suppression at all");

  // The offers-to-you side reads the exact same shape.
  check(rivalInterestOdds("Arsenal", "Tottenham Hotspur") < 0.1, "a primary rival essentially never comes calling for you either");
  check(rivalInterestOdds("Arsenal", "Everton") === 1, "and a non-rival is unaffected");
  check(rivalInterestOdds("Arsenal", "Manchester City") > rivalInterestOdds("Arsenal", "Tottenham Hotspur"),
    "the same tier ordering holds on the interest side too");
}

// ── The whole window actually respects it ───────────────────────────────────
//
// Not a claim that rivals NEVER trade — an unhappy star can still force his
// way to one — only that it happens far less than a comparable non-rival
// pairing given the same chance to.
{
  function playerAt(club: string): StarPlayer {
    return {
      firstName: "Test", lastName: "Player", age: 16, skinTone: "light",
      club, clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
    } as StarPlayer;
  }

  // A small division of real clubs, including a real R1 pairing (Arsenal /
  // Tottenham Hotspur) and a real non-rival pairing (Arsenal / Everton), so
  // the same club is the seller in both comparisons.
  const clubs = ["Arsenal", "Tottenham Hotspur", "Everton", "Liverpool", "Chelsea", "Newcastle United"];
  const you = "Liverpool";
  let career = makeInitialCareer(playerAt(you), clubs);
  career = {
    ...career,
    leagueSquads: clubs.map((club): LeagueSquad => ({
      club,
      players: generateSquad(clubNameSeed(club)).map((p): LeaguePlayer => ({
        id: p.id, name: p.name, position: p.position, positions: p.positions ?? [p.position],
        overall: 62 + (clubNameSeed(p.name) % 20), goals: 0, assists: 0,
      })),
    })),
  };

  let arsenalToSpurs = 0, arsenalToEverton = 0, totalMoves = 0;
  for (let seed = 0; seed < 500; seed++) {
    const rng = mulberry32(seed * 7919 + 3);
    const { moves } = runTransferWindow(career, "summer", rng);
    totalMoves += moves.length;
    for (const m of moves) {
      if (m.from === "Arsenal" && m.to === "Tottenham Hotspur") arsenalToSpurs++;
      if (m.from === "Arsenal" && m.to === "Everton") arsenalToEverton++;
    }
  }

  check(totalMoves > 50, `the window is genuinely doing business across 500 seeds (${totalMoves} moves)`);
  check(arsenalToSpurs < arsenalToEverton,
    `Arsenal sell to their primary rival far less than to a non-rival, over 500 windows (Spurs: ${arsenalToSpurs}, Everton: ${arsenalToEverton})`);
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — rivals really do not sell to rivals, on either side of the desk");
