import type { CareerState } from "./types";

/**
 * RETIREMENT
 *
 * A career had no end. You aged, your pace and power declined a point or three a
 * year past thirty, and then you carried on for ever — a forty-five-year-old
 * with 30 pace still being picked every week because nothing in the game knew
 * how to stop.
 *
 * It ends now, and how it ends is mostly yours to choose. From thirty-three you
 * may hang them up whenever you like; at forty the decision is made for you.
 * Either way the last thing you see is what the whole career added up to, which
 * is the part that makes the numbers you have been collecting for fifteen
 * seasons mean something.
 */

export const RETIRE_FROM = 33;
export const RETIRE_AT = 40;

export interface RetirementCheck {
  /** Old enough to choose. */
  canRetire: boolean;
  /** Too old not to. */
  mustRetire: boolean;
  reason: string;
}

export function retirementCheck(career: CareerState): RetirementCheck {
  const age = career.player.age;
  if (age >= RETIRE_AT) {
    return { canRetire: true, mustRetire: true, reason: `You are ${age}. That is the end of it.` };
  }
  if (age >= RETIRE_FROM) {
    return {
      canRetire: true,
      mustRetire: false,
      reason: career.matchFitness < 55
        ? `You are ${age} and the body is telling you something.`
        : `You are ${age}. You could go again, or you could go out on your terms.`,
    };
  }
  return { canRetire: false, mustRetire: false, reason: "" };
}

export interface CareerVerdict {
  /** What they will remember you as. */
  title: string;
  /** One line under it. */
  summary: string;
  /** 0-100, so the title is never the only thing that separates two careers. */
  score: number;
  seasons: number;
  clubs: string[];
}

/**
 * What the career added up to.
 *
 * Weighted toward the things that are hard rather than the things that are
 * long: a Ballon d'Or is worth more than a decade of appearances, and so is a
 * European Cup. Longevity still counts, because it should — it is just not the
 * whole story the way a raw appearance count would make it.
 */
export function careerVerdict(career: CareerState): CareerVerdict {
  const s = career.careerStats;
  const trophies = career.trophies.length;
  const majors = career.trophies.filter(t =>
    t.competition === "Champions League" || t.competition === "World Cup"
    || t.competition === "European Championship").length;

  const score = Math.max(0, Math.min(100,
    Math.min(1, s.goals / 250) * 100 * 0.24
    + Math.min(1, s.assists / 140) * 100 * 0.1
    + Math.min(1, trophies / 12) * 100 * 0.22
    + Math.min(1, majors / 4) * 100 * 0.14
    + Math.min(1, career.ballonDorWins / 3) * 100 * 0.18
    + Math.min(1, (career.caps ?? 0) / 90) * 100 * 0.06
    + Math.min(1, s.appearances / 450) * 100 * 0.06,
  ));

  const clubs = Array.from(new Set([
    career.player.club,
    ...(career.transfers ?? []).flatMap(t => [t.from, t.to]),
  ]));
  const seasons = Math.max(1, career.season);

  const title = score >= 82 ? "One of the Greats"
    : score >= 64 ? "A Modern Legend"
      : score >= 46 ? "Club Legend"
        : score >= 28 ? "A Fine Career"
          : score >= 12 ? "A Solid Professional"
            : "A Career in the Game";

  const summary = career.ballonDorWins > 0
    ? `${career.ballonDorWins} Ballon d'Or${career.ballonDorWins > 1 ? "s" : ""}, ${s.goals} goals and ${trophies} trophies across ${seasons} seasons.`
    : trophies > 0
      ? `${s.goals} goals and ${trophies} trophies across ${seasons} seasons.`
      : `${s.goals} goals in ${s.appearances} appearances across ${seasons} seasons.`;

  return { title, summary, score, seasons, clubs };
}

/**
 * A TESTIMONIAL
 *
 * The reward for having stayed somewhere. A career spent at one club had
 * absolutely nothing to show for it that a career of six clubs did not — if
 * anything the mercenary did better, because every move came with a signing fee.
 *
 * A full house for a man who gave a club a decade is the one thing loyalty
 * should buy, and it is deliberately not available to somebody who arrived last
 * summer however good he was.
 */
export const TESTIMONIAL_APPEARANCES = 120;

export function testimonialFor(career: CareerState): { club: string; season: number; payout: number } | null {
  const apps = career.clubAppearances ?? 0;
  if (apps < TESTIMONIAL_APPEARANCES) return null;
  // A bigger name fills a bigger ground, but the appearances are what earn it.
  const payout = Math.round(apps * 0.9 + career.fame * 1.6 + career.starRating * 22);
  return { club: career.player.club, season: career.season, payout };
}

/** Hang them up. */
export function retire(career: CareerState): CareerState {
  const testimonial = testimonialFor(career);
  return {
    ...career,
    retired: true,
    testimonial,
    money: career.money + (testimonial?.payout ?? 0),
  };
}
