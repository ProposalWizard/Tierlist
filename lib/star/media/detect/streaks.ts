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
 * The Player of the Month race, and the shortlist it produces.
 *
 * Football talks about this award for a fortnight before it is given and the
 * game said nothing until the moment it landed.
 *
 * ── Two different pieces of news ──
 *
 * THROUGH the month it is only news if it is about you: "third in the race with
 * two goals" is a line about your season, and a table of eight strangers you are
 * not in is not. So the mid-month line still needs you near the top of it.
 *
 * The SHORTLIST is not that. It goes up once, on the last round of the month,
 * and it is news whoever is on it — the same way the real one is. It used to be
 * gated behind your being in the top three, which meant the card existed for a
 * player having a good month and vanished for one who was not, and a graphic
 * that only appears when you are winning is not a media feed. So the last round
 * always fires; whether you are on the list only changes how loud it is and
 * which line gets written about it.
 */
const POTM_RACE: Detector = (r) => {
  const race = r.potmRace;
  if (!race) return null;

  const facts = {
    ...base(r),
    month: race.monthName,
    goals: race.goals,
    assists: race.assists,
    leader: race.leader,
    contenders: race.contenders,
  };
  // `place` is deliberately spread in only when you have one. A template asks
  // for the facts it needs and refuses the ones it cannot use, so an absent
  // place is what picks the line about the shortlist over the line about you.
  const place = race.place;
  const placed = place !== undefined;

  // ── The shortlist, with a round still to play ──
  //
  // Not on the last round. The vote runs the moment that round is played, so by
  // then the winner exists and a nominees card is a question somebody has
  // already answered. See MatchRecord.potmRace.decidesNextWeek.
  if (race.decidesNextWeek) {
    // Below this there is no shortlist to publish — see the graphic, which
    // returns nothing rather than a grid with holes in it.
    if (race.contenders < 6) return null;
    return ev(
      "potm-decides",
      you(r),
      place === 1 ? 74 : placed && place <= 3 ? 60 : 48,
      ["award", "form", "stat"],
      placed ? { ...facts, place } : facts,
      "hour",
    );
  }
  if (race.decidesToday) return null;   // the award detector has this one

  if (place === undefined || place > 3) return null;
  if (race.goals + race.assists < 2) return null;
  return ev(
    "potm-race",
    you(r),
    place === 1 ? 58 : 44,
    ["award", "form", "stat"],
    { ...facts, place },
    "evening",
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

/**
 * And the award itself.
 *
 * Separate from the race above because it is a different kind of thing: the race
 * is a running story and this is a result, it happens exactly ten times a season,
 * and it is the one event here that is worth posting about when it has nothing
 * to do with you. A month of football ending with nobody saying who won it is
 * the gap this closes.
 *
 * The subject stays `you` even when the winner is somebody else. It is not quite
 * true and it is deliberate: subject drives which accounts take an interest, and
 * a card the player has asked to see every month should not be at the mercy of
 * whether a Manchester City post reaches a Liverpool feed.
 */
const POTM_AWARD: Detector = (r) => {
  const a = r.potmAward;
  if (!a) return null;
  return ev(
    a.isYou ? "potm-won" : "potm-winner",
    you(r),
    a.isYou ? 88 : 56,
    ["award", "stat"],
    {
      ...base(r),
      month: a.monthName,
      winner: a.winner,
      winnerClub: a.club,
      goals: a.goals,
      assists: a.assists,
      ...(a.yourPlace !== undefined ? { place: a.yourPlace } : {}),
    },
    "hour",
  );
};

export const STREAK_DETECTORS: Detector[] = [
  SCORING_RUN, HOT_STREAK, CREATING_RUN, UNBEATEN, WINNING_RUN,
  LOSING_RUN, CLEAN_SHEET_RUN, RUN_ENDED, POTM_RACE, POTM_AWARD,
];
