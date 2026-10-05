import { fameOf } from "./fame";
import type { CareerState } from "./types";
import { tierWeeklyIncome } from "./economy";
import { closeFinalSeason } from "./careerFlow";

/**
 * RETIREMENT
 *
 * A career had no end. You aged, your pace and power declined a point or three a
 * year past thirty, and then you carried on for ever — a forty-five-year-old
 * with 30 pace still being picked every week because nothing in the game knew
 * how to stop.
 *
 * Now every career is the same length (CAREER_SEASONS). The season before the
 * last ends with a warning (FinalSeasonNotice, components/star/CareerEnd.tsx)
 * so the last club is chosen on purpose, and the last season ends with the
 * final whistle and the career overview. Either way the last thing you see is
 * what the whole career added up to, which is the part that makes the numbers
 * you have been collecting for twenty seasons mean something.
 */

/**
 * HOW LONG A CAREER LASTS, in seasons. Change this one number to change it;
 * `null` means no limit.
 *
 * Leo, 5 Oct 2026: "limit the amount of seasons you can play at 20. So once
 * you hit 20 seasons, that is your limit, and then you are forced to retire
 * … that figure could change in the future. We could bring that to 15 or up
 * it to 30 or even unlimited." Before that: retire by choice from 33, forced
 * after 50 seasons (owners, 21 Sep 2026). Leo also removed the choice: "that
 * would mean removing the system of, from age 33, do you go again at the end
 * of every season".
 *
 * A career starts at 16, so season 20 is played at 35.
 */
export const CAREER_SEASONS: number | null = 20;

export interface RetirementCheck {
  /** The career ends now. Same as `mustRetire` since 5 Oct 2026 — there is
   *  no early retirement — kept because the Old UI page still reads it. */
  canRetire: boolean;
  /** The season just finished was the last one. */
  mustRetire: boolean;
  /** The season just finished was the one before the last: warn now. */
  finalSeasonNext: boolean;
  reason: string;
}

/**
 * Asked when a season ends (after the Ballon d'Or night).
 *
 *   season 1 … CAREER_SEASONS-2   nothing
 *   season CAREER_SEASONS-1       finalSeasonNext: "your next season is the last"
 *   season CAREER_SEASONS (or later, an older save)   mustRetire
 */
export function retirementCheck(career: Pick<CareerState, "season">, cap: number | null = CAREER_SEASONS): RetirementCheck {
  if (cap !== null && career.season >= cap) {
    return { canRetire: true, mustRetire: true, finalSeasonNext: false, reason: `${cap} seasons. Time to hang them up.` };
  }
  return { canRetire: false, mustRetire: false, finalSeasonNext: cap !== null && career.season === cap - 1, reason: "" };
}

/** The season being played is the last one (for a "Final season" tag). */
export function isFinalSeason(career: Pick<CareerState, "season">, cap: number | null = CAREER_SEASONS): boolean {
  return cap !== null && career.season >= cap;
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

/** Weeks of top-flight income per point of the testimonial score below. */
export const TESTIMONIAL_WEEKS_PER_POINT = 0.06;

export function testimonialFor(career: CareerState): { club: string; season: number; payout: number } | null {
  const apps = career.clubAppearances ?? 0;
  if (apps < TESTIMONIAL_APPEARANCES) return null;
  // A bigger name fills a bigger ground, but the appearances are what earn it.
  //
  // ON THE CURVE, 19 Sep 2026. The flat ×2000 rescale of 14 Sep fixed a
  // real bug (a 300-appearance, 5★ career was being sent off with ★500) by
  // replacing it with a different one: ★1,440,000, which against the income
  // ladder economy.ts builds is roughly ten whole top-flight seasons of pay
  // for one evening's football.
  //
  // The SHAPE of the formula is still untouched — appearances are what earn
  // it, a bigger name fills a bigger ground. What changed is the unit: the
  // score it produces (roughly 300 for a modest one-club career, 800 for a
  // great one) is now read as weeks of top-flight income, at a rate that
  // puts a great career's send-off at about fifty weeks of it and a modest
  // one at eighteen. A real windfall to retire on; not a second career.
  const score = apps * 0.9 + fameOf(career) * 1.6 + career.starRating * 22;
  const payout = Math.round(score * TESTIMONIAL_WEEKS_PER_POINT * tierWeeklyIncome("world_class"));
  return { club: career.player.club, season: career.season, payout };
}

/**
 * Hang them up. `wonBallonDor`: the Ballon d'Or screen you came from said you
 * won this season's — counted here, because retiring skips the rollover that
 * normally counts it (see closeFinalSeason).
 */
export function retire(career: CareerState, wonBallonDor = false): CareerState {
  if (career.retired) return career;
  // Closing the season is extra; it must never stop "Hang them up" working.
  let closed: CareerState;
  try {
    closed = closeFinalSeason(career, wonBallonDor);
  } catch {
    closed = { ...career, ballonDorWins: career.ballonDorWins + (wonBallonDor ? 1 : 0) };
  }
  const testimonial = testimonialFor(closed);
  return {
    ...closed,
    retired: true,
    testimonial,
    money: closed.money + (testimonial?.payout ?? 0),
  };
}
