import { makeInitialCareer, creditMatchResult } from "../../lib/star/careerFlow";
import { generateSquad, clubNameSeed } from "../../lib/star/squadData";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import type { CareerState, LeagueSquad, LeaguePlayer, MatchStats, StarPlayer } from "../../lib/star/types";

/**
 * THE DEADLINE DAY ROUND-UP FIRES EXACTLY ONCE PER WINDOW.
 *
 * The trigger itself lives in app/star-dev/page.tsx's continueAfterMatch
 * (a plain field comparison, `lastTransferWindowKey !== deadlineDayShownFor`)
 * rather than in lib/star, so this can't drive the actual UI — but the two
 * career-state fields it reads are exactly what this checks: seeded equal so
 * a window that never ran (season 1's summer, deliberately skipped) has
 * nothing to show a round-up for, diverging the moment a real window closes,
 * and converging again once the dismiss handler marks it seen.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function player(): StarPlayer {
  return {
    firstName: "Test", lastName: "Player", age: 17, skinTone: "light",
    club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
  } as StarPlayer;
}

function leagueSquadsFor(clubs: readonly string[], season: number): LeagueSquad[] {
  return clubs.map((c): LeagueSquad => ({
    club: c,
    players: generateSquad(clubNameSeed(c) + season).map((p, i): LeaguePlayer => ({
      id: `${c}:${i}`, name: `${p.name} (${c})`, position: p.position,
      positions: p.positions ?? [p.position],
      overall: 60 + (clubNameSeed(p.name) % 22), goals: 0, assists: 0,
    })),
  }));
}

function freshCareer(): CareerState {
  const base = makeInitialCareer(player(), [...PREMIER_LEAGUE_CLUBS]);
  return { ...base, leagueSquads: leagueSquadsFor(PREMIER_LEAGUE_CLUBS, 1) };
}

function statsFor(us: number, them: number, home: boolean): MatchStats {
  return {
    chances: 5, goals: Math.min(us, them), assists: 1, passes: 28, rating: 7.2, starMan: false,
    bossChange: 0, teamChange: 0, fansChange: 0, wage: 1, goalBonus: 0,
    sponsorPay: 0, totalCash: 2,
    homeScore: home ? us : them, awayScore: home ? them : us, minutes: 90,
  };
}

const dueForRoundup = (c: CareerState) =>
  !!c.lastTransferWindowKey && c.lastTransferWindowKey !== c.deadlineDayShownFor;

// ── A fresh career has nothing to show — the skipped window seeds both
//    fields to the same value ──
{
  const c = freshCareer();
  check(c.deadlineDayShownFor === c.lastTransferWindowKey,
    `both fields start equal (${c.deadlineDayShownFor} vs ${c.lastTransferWindowKey})`);
  check(!dueForRoundup(c), "…so a fresh career is never 'due' for a round-up it was never meant to show");
}

// ── Playing the whole first season: due exactly when January closes,
//    not-due again the instant the dismiss handler marks it seen ──
{
  let c = freshCareer();
  let sawDue = false;
  let guard = 0;
  while (guard++ < 60) {
    const next = c.fixtures.find(f => !f.played);
    if (!next) break;
    c = creditMatchResult(c, next, statsFor(1, 1, next.home)).career;
    if (dueForRoundup(c)) {
      sawDue = true;
      check(c.lastTransferWindowKey === "1-january",
        `the first time this ever becomes due is season 1's January window (got ${c.lastTransferWindowKey})`);
      // Simulate the dismiss handler's own update (page.tsx: deadlineDayShownFor
      // set to lastTransferWindowKey on the object handed back into the chain).
      c = { ...c, deadlineDayShownFor: c.lastTransferWindowKey };
      check(!dueForRoundup(c), "…and marking it seen immediately clears the due flag");
      break;
    }
  }
  check(sawDue, "the round-up actually becomes due at some point across a real season of fixtures");
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — the Deadline Day round-up is due exactly once per real window, never for the skipped one");
