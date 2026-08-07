import type { CareerState } from "./types";
import { sortLeague } from "./season";
import { leaguePosition } from "./competitions";

/**
 * CLUB EXPECTATIONS
 *
 * Sixth was sixth. Finishing there was worth exactly the same at the club that
 * won the league last year as at the one that nearly went down, because nothing
 * in the game knew the difference — the only judgement on a season was whether
 * you finished top.
 *
 * From the specification, §16.11: "Every club should possess its own identity:
 * league, competitive level, expectations, reputation, playing environment. The
 * player joins an existing football world. The football world does not revolve
 * around the player."
 *
 * And §16.10: expectations rise with the player as well as the club — early on
 * you are trying to earn playing time, and by the end you are expected to lead
 * the side and deliver trophies. Both halves are here, because a season is
 * judged on what the club wanted AND on what someone of your standing owed it.
 */

export type Ambition = "Title" | "Europe" | "Mid-table" | "Survival";

export interface ClubExpectation {
  ambition: Ambition;
  /** Finish at or above this and the board is content. */
  targetPosition: number;
  /** Below this and it is a crisis. */
  crisisPosition: number;
  summary: string;
}

/**
 * What the board wants, read off where the club sits in its own division.
 *
 * Deliberately relative: the same 78-strength side is a title contender in a
 * weak league and a top-half team in a strong one.
 */
export function clubExpectation(career: CareerState): ClubExpectation {
  const table = [...career.league].sort((a, b) => b.strength - a.strength);
  const rank = Math.max(1, table.findIndex(t => t.name === career.player.club) + 1);
  const n = career.league.length;
  const share = rank / n;

  if (share <= 0.2) {
    return {
      ambition: "Title",
      targetPosition: Math.max(1, Math.round(n * 0.1)),
      crisisPosition: Math.round(n * 0.4),
      summary: "The board expect the title. Anything else is a bad season.",
    };
  }
  if (share <= 0.45) {
    return {
      ambition: "Europe",
      targetPosition: Math.max(2, Math.round(n * 0.4)),
      crisisPosition: Math.round(n * 0.7),
      summary: "The board expect European football.",
    };
  }
  if (share <= 0.75) {
    return {
      ambition: "Mid-table",
      targetPosition: Math.round(n * 0.7),
      crisisPosition: Math.round(n * 0.9),
      summary: "The board want a comfortable season in the top half if you can.",
    };
  }
  return {
    ambition: "Survival",
    targetPosition: Math.round(n * 0.9),
    crisisPosition: n,
    summary: "Staying up is the job. Everything above that is a bonus.",
  };
}

/** What someone of your standing is expected to contribute. §16.10. */
export type PersonalDuty = "Earn a place" | "Perform consistently" | "Lead the team";

export function personalDuty(career: CareerState): { duty: PersonalDuty; goalTarget: number; summary: string } {
  if (career.starRating >= 4.2) {
    return {
      duty: "Lead the team",
      goalTarget: 18,
      summary: "You are the player this side is built around. They expect you to win them matches.",
    };
  }
  if (career.starRating >= 2.8) {
    return {
      duty: "Perform consistently",
      goalTarget: 10,
      summary: "You are established here. They expect you week in, week out.",
    };
  }
  return {
    duty: "Earn a place",
    goalTarget: 4,
    summary: "You are still proving you belong. Minutes are the thing to chase.",
  };
}

export interface SeasonJudgement {
  /** -1 disaster, 0 as expected, +1 far beyond it. */
  score: number;
  /** What it does to your standing with the manager. */
  bossChange: number;
  headline: string;
  detail: string;
}

/**
 * How the season went, by the club's own standards and by yours.
 *
 * Applied at the season rollover. It is the only thing that makes a promotion
 * cost something: the same performance that was a triumph at a small club is a
 * failure at a big one, so moving up is a real gamble rather than a free
 * upgrade.
 */
export function judgeSeason(career: CareerState): SeasonJudgement {
  const exp = clubExpectation(career);
  const duty = personalDuty(career);
  const pos = leaguePosition(career);
  const n = career.league.length;
  const trophies = career.trophies.filter(t => t.season === career.season).length;

  // Where the club finished against what it wanted, normalised so a place is
  // worth more in a small division than a large one.
  //
  // The divisor was 0.35 of the division and the scale saturated almost
  // immediately: in a ten-team league, finishing six places above the target
  // scored 1.71 against a ceiling of 1, so a cup win on top of it changed
  // nothing at all. At 0.6 the full range is actually reachable and everything
  // else that feeds in still counts.
  let score = (exp.targetPosition - pos) / Math.max(1, n * 0.6);
  if (pos > exp.crisisPosition) score -= 0.5;
  if (trophies > 0) score += 0.35 * trophies;

  // …and what you personally owed it.
  const goals = career.seasonStats.goals;
  score += Math.max(-0.4, Math.min(0.4, (goals - duty.goalTarget) / (duty.goalTarget * 2.5)));

  score = Math.max(-1, Math.min(1, score));

  const headline = score >= 0.5 ? "A season beyond what anyone expected"
    : score >= 0.12 ? "Expectations met, and then some"
      : score >= -0.12 ? "About what was expected"
        : score >= -0.5 ? "Below what the board wanted"
          : "A bad season, and everybody knows it";

  const finish = `${pos}${pos === 1 ? "st" : pos === 2 ? "nd" : pos === 3 ? "rd" : "th"}`;
  return {
    score,
    bossChange: Math.round(score * 18),
    headline,
    detail: `${exp.ambition} was the ask. You finished ${finish}`
      + (trophies > 0 ? ` and won ${trophies === 1 ? "a trophy" : `${trophies} trophies`}` : "")
      + `. ${goals} goals against a target of ${duty.goalTarget}.`,
  };
}

/** Live position for the dashboard, so the ask is visible all season. */
export function expectationStatus(career: CareerState): { pos: number; exp: ClubExpectation; onTrack: boolean } {
  const exp = clubExpectation(career);
  const pos = sortLeague(career.league).findIndex(t => t.name === career.player.club) + 1;
  return { pos, exp, onTrack: pos <= exp.targetPosition };
}
