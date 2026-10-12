import type { CareerState, LeagueTeam } from "./types";
import { mulberry32, simulateFixtureScore } from "./season";
import { divisionOf } from "./calendar";
import { membershipOf, estimateClubStrength } from "./promotion";

/**
 * THIS SEASON'S PREMIER LEAGUE TABLE, WHATEVER DIVISION YOU PLAY IN.
 *
 * England's Champions/Europa League places come from the Premier League.
 * In a Premier League career that is simply your own table. Below it, nobody
 * simulates the Premier League week by week, so this plays its 380 matches
 * once, seeded by the season (same season, same table), from the clubs who
 * are really in it this season (`membershipOf`) at their estimated strength.
 *
 * Before this (found 5 Oct 2026), resolveSeasonWinners and euro.ts's
 * seasonField read `career.league` directly, so a Championship career's
 * "England" in Europe was the Championship, and about one season in twenty
 * a Championship club won the Champions League.
 */
export function englishTopFlightTable(career: CareerState): LeagueTeam[] {
  if (divisionOf(career) === "premier") return career.league;
  const clubs = membershipOf(career).premier;
  const teams: LeagueTeam[] = clubs.map(name => ({
    name, strength: estimateClubStrength(career, name),
    played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0,
  }));
  const rng = mulberry32(career.season * 6151 + 29);
  for (const home of teams) {
    for (const away of teams) {
      if (home === away) continue;
      const s = simulateFixtureScore(home.strength, away.strength, rng);
      home.played++; away.played++;
      home.goalsFor += s.home; home.goalsAgainst += s.away;
      away.goalsFor += s.away; away.goalsAgainst += s.home;
      if (s.home > s.away) { home.won++; away.lost++; home.points += 3; }
      else if (s.home < s.away) { away.won++; home.lost++; away.points += 3; }
      else { home.drawn++; away.drawn++; home.points++; away.points++; }
    }
  }
  return teams;
}
