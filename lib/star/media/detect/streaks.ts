import type { Detector } from "../types";
import { assistsInLast, goalsInLast } from "../memory";
import { base, club, ev, you } from "./kit";

/**
 * The run, which is the thing football talks about most and the thing a career
 * mode almost never notices.
 *
 * These detectors read memory rather than the match. That is the whole point:
 * nothing that happened in the last ninety minutes contains the sentence "he has
 * scored in five straight", and it is the sentence a stat account exists to
 * write.
 */

/**
 * The Player of the Month race, while it is still a race.
 *
 * Football talks about this award for a fortnight before it is given and the
 * game said nothing until the moment it landed. Two lines: one when you are in
 * contention at all, and a louder one on the day the month ends, which is the
 * day it is actually worth talking about.
 *
 * Only ever about YOU. The panel's shortlist is not news until it is announced.
 */
const POTM_RACE: Detector = (r) => {
  const race = r.potmRace;
  if (!race || race.place === undefined || race.place > 3) return null;
  if (race.goals + race.assists < 2) return null;
  const leading = race.place === 1;
  return ev(
    race.decidesToday ? "potm-decides" : "potm-race",
    you(r),
    race.decidesToday ? (leading ? 78 : 62) : (leading ? 58 : 44),
    ["award", "form", "stat"],
    {
      ...base(r),
      month: race.monthName,
      place: race.place,
      goals: race.goals,
      assists: race.assists,
      leader: race.leader,
    },
    race.decidesToday ? "hour" : "evening",
  );
};

const SCORING_RUN: Detector = (r, m) => {
  if (m.streaks.scoring < 3) return null;
  const n = m.streaks.scoring;
  return ev("scoring-run", you(r), Math.min(84, 38 + n * 8), ["streak", "goal", "stat"], {
    ...base(r), matches: n, goals: goalsInLast(m, n),
  }, "hour", "form-hot");
};

/**
 * The "six in three" event.
 *
 * Distinct from the scoring run on purpose: a run counts matches, this counts
 * goals, and they are different headlines. Three in three is a run. Six in three
 * is a story, and it only fires when the rate is genuinely unusual.
 */
const HOT_STREAK: Detector = (r, m) => {
  if (m.recent.length < 3) return null;
  const three = goalsInLast(m, 3);
  const five = goalsInLast(m, 5);
  if (three >= 5) {
    return ev("red-hot", you(r), Math.min(90, 56 + three * 5), ["streak", "goal", "stat", "form"], {
      ...base(r), goals: three, matches: 3,
    }, "hour", "form-hot");
  }
  if (m.recent.length >= 5 && five >= 7) {
    return ev("purple-patch", you(r), Math.min(84, 50 + five * 4), ["streak", "goal", "stat", "form"], {
      ...base(r), goals: five, matches: 5,
    }, "evening", "form-hot");
  }
  return null;
};

const CREATING_RUN: Detector = (r, m) => {
  if (m.recent.length < 4) return null;
  const four = assistsInLast(m, 4);
  if (four < 4) return null;
  return ev("creating", you(r), 56, ["streak", "assist", "stat"], {
    ...base(r), assists: four, matches: 4,
  }, "evening", "form-hot");
};

const UNBEATEN: Detector = (r, m) => {
  if (m.streaks.unbeaten < 5) return null;
  return ev("unbeaten-run", club(r), Math.min(80, 34 + m.streaks.unbeaten * 5), ["streak", "table", "stat"], {
    ...base(r), matches: m.streaks.unbeaten,
  }, "hour", "unbeaten");
};

const WINNING_RUN: Detector = (r, m) => {
  if (m.streaks.winning < 4) return null;
  return ev("winning-run", club(r), Math.min(84, 38 + m.streaks.winning * 6), ["streak", "table", "stat"], {
    ...base(r), matches: m.streaks.winning,
  }, "hour", "unbeaten");
};

const LOSING_RUN: Detector = (r, m) => {
  if (m.streaks.losing < 3) return null;
  return ev("losing-run", club(r), Math.min(82, 36 + m.streaks.losing * 8), ["streak", "shame", "stat"], {
    ...base(r), matches: m.streaks.losing,
  }, "hour", "crisis");
};

const CLEAN_SHEET_RUN: Detector = (r, m) => {
  if (m.streaks.cleanSheets < 3) return null;
  return ev("clean-sheet-run", club(r), Math.min(72, 32 + m.streaks.cleanSheets * 8), ["streak", "keeper", "stat"], {
    ...base(r), matches: m.streaks.cleanSheets,
  }, "hour", "clean-sheets");
};

const RUN_ENDED: Detector = (r, m) => {
  // The run that ended today is the one that was long yesterday, so it is read
  // off the digest BEFORE this match — memory.recent[1] onwards.
  if (m.recent.length < 6) return null;
  if (r.result !== "loss") return null;
  const prior = m.recent.slice(1);
  let unbeaten = 0;
  for (const d of prior) { if (d.result === "loss") break; unbeaten++; }
  if (unbeaten < 6) return null;
  return ev("run-ended", club(r), Math.min(78, 40 + unbeaten * 4), ["streak", "drama"], {
    ...base(r), matches: unbeaten,
  }, "hour");
};

export const STREAK_DETECTORS: Detector[] = [
  SCORING_RUN, HOT_STREAK, CREATING_RUN, UNBEATEN, WINNING_RUN,
  LOSING_RUN, CLEAN_SHEET_RUN, RUN_ENDED, POTM_RACE,
];
