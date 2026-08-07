import type { CareerState, MatchStats, GoalEvent } from "./types";

// Canonical end-of-match scoring for career mode: turns a match tally
// (chances/goals/assists/passes + the final scoreline) into the MatchStats the
// career flow consumes — rating, star-man, cash and relationship deltas.
// Moved out of the old DOM match engine so the career flow keeps one source of
// truth after that engine was replaced by the canvas engine.
/**
 * The rating a performance is worth so far, before any adjustment for minutes.
 *
 * Pulled out of finaliseMatch so the manager can read the same number mid-match
 * that the scoresheet reads at the end — a hook decision that used a different
 * formula from the rating it is meant to reflect would be indefensible.
 */
export function liveRating(
  goals: number,
  assists: number,
  passes: number,
  userScore: number,
  oppScore: number,
): number {
  const result = userScore > oppScore ? 0.4 : userScore < oppScore ? -0.3 : 0.1;
  return Math.max(1, Math.min(10, 6.0 + goals * 1.2 + assists * 0.8 + passes * 0.05 + result));
}

export function finaliseMatch(
  chances: number,
  goals: number,
  assists: number,
  passes: number,
  minutes: number,
  userScore: number,
  oppScore: number,
  career: CareerState,
  goalEvents: GoalEvent[] = [],
  hooked: MatchStats["hooked"] = null,
): MatchStats {
  let rating = liveRating(goals, assists, passes, userScore, oppScore);

  // A cameo is judged on less evidence. The `minutes` argument had been passed
  // in since this function was written and never read; a substitute who came on
  // for twenty minutes was rated as though he had played the ninety. The rating
  // now regresses toward a neutral 6.5 in proportion to the minutes NOT played,
  // so a short appearance can neither earn a 9 nor be blamed for a 4. A full
  // match is multiplied by exactly 1, so nothing about starting changed.
  const share = Math.max(0.15, Math.min(1, minutes / 90));
  rating = 6.5 + (rating - 6.5) * (0.45 + 0.55 * share);
  rating = Math.max(1, Math.min(10, rating));

  const starMan = rating >= 8.5 || goals >= 2;
  const wage = career.contract.wage;
  const goalBonus = goals * career.contract.goalBonus;
  const assistBonusPay = assists * career.contract.assistBonus;
  const sponsorPay = Math.floor(career.relationships.sponsors / 20);
  const totalCash = wage + goalBonus + assistBonusPay + sponsorPay;

  let boss = 0, team = 0, fans = 0;
  if (rating >= 8) { boss += 6; fans += 8; team += 3; }
  else if (rating >= 7) { boss += 3; fans += 4; team += 2; }
  else if (rating >= 6) { boss += 1; fans += 1; team += 1; }
  else if (rating >= 5) { boss -= 2; fans -= 2; team -= 1; }
  else { boss -= 5; fans -= 4; team -= 3; }
  if (goals > 0) fans += goals * 3;
  if (assists > 0) { team += assists * 3; fans += assists; }
  if (starMan) { boss += 4; fans += 5; team += 2; }

  return {
    chances,
    goals,
    assists,
    passes,
    minutes,
    hooked,
    rating: Math.round(rating * 10) / 10,
    starMan,
    bossChange: boss,
    teamChange: team,
    fansChange: fans,
    wage,
    goalBonus: goalBonus + assistBonusPay,
    sponsorPay,
    totalCash,
    homeScore: userScore,
    awayScore: oppScore,
    goalEvents,
  };
}
