import type { Detector } from "../types";
import { base, club, ev } from "./kit";

/**
 * The table, which is the only story that runs all year.
 *
 * Every one of these is a comparison between the league before the match and the
 * league after it, which is why `MatchRecord` carries both. A result is a
 * scoreline; a result that takes you top with six to play is a headline, and the
 * only difference between the two is a subtraction nobody was doing.
 */

const CLIMB: Detector = (r) => {
  if (r.kind !== "league") return null;
  const from = r.table.before.position, to = r.table.after.position;
  if (to === from) return null;

  if (to === 1 && from !== 1) {
    return ev("went-top", club(r), r.table.matchesLeft <= 8 ? 88 : 66, ["table", "title"], {
      ...base(r), from, to, position: to, left: r.table.matchesLeft, points: r.table.after.points,
    }, "hour", "title-race");
  }
  if (from === 1 && to !== 1) {
    return ev("lost-top", club(r), r.table.matchesLeft <= 8 ? 76 : 52, ["table", "title", "shame"], {
      ...base(r), from, to, position: to, left: r.table.matchesLeft,
    }, "hour", "title-race");
  }
  const drop = r.table.clubs - 2;
  if (to >= drop && from < drop) {
    return ev("into-the-drop", club(r), 74, ["table", "relegation", "shame"], {
      ...base(r), to, position: to, left: r.table.matchesLeft,
    }, "hour", "relegation-fight");
  }
  if (from >= drop && to < drop) {
    return ev("out-of-the-drop", club(r), 68, ["table", "relegation"], {
      ...base(r), to, position: to, left: r.table.matchesLeft,
    }, "hour", "relegation-fight");
  }
  if (to <= 4 && from > 4) {
    return ev("into-europe", club(r), 56, ["table", "europe"], {
      ...base(r), to, position: to, left: r.table.matchesLeft,
    }, "hour");
  }
  if (from <= 4 && to > 4) {
    return ev("out-of-europe", club(r), 44, ["table", "europe"], { ...base(r), to, position: to }, "evening");
  }
  return null;
};

const TITLE_RACE: Detector = (r) => {
  if (r.kind !== "league") return null;
  if (r.table.matchesLeft > 10) return null;
  const gap = r.table.leaderGap;
  if (Math.abs(gap) > 6) return null;
  return ev("title-race", club(r), 70, ["table", "title"], {
    ...base(r), gap: Math.abs(gap), left: r.table.matchesLeft,
    leading: gap <= 0, position: r.table.after.position,
  }, "evening", "title-race");
};

const RELEGATION_FIGHT: Detector = (r) => {
  if (r.kind !== "league") return null;
  if (r.table.matchesLeft > 10) return null;
  if (r.table.relegationGap > 5 || r.table.after.position < r.table.clubs - 5) return null;
  return ev("relegation-fight", club(r), 68, ["table", "relegation"], {
    ...base(r), gap: r.table.relegationGap, left: r.table.matchesLeft,
    position: r.table.after.position,
  }, "evening", "relegation-fight");
};

/**
 * A six-pointer: two clubs at the same end of the table, playing each other.
 *
 * Detected on the STRENGTHS and the table rather than declared in the fixture
 * list, so it changes as the season does. The same fixture is a title decider in
 * March and a nothing game in September.
 */
const SIX_POINTER: Detector = (r) => {
  if (r.kind !== "league" || r.table.matchesLeft > 12) return null;
  const near = Math.abs(r.clubStrength - r.opponentStrength) <= 6;
  const top = r.table.after.position <= 5;
  const bottom = r.table.after.position >= r.table.clubs - 5;
  if (!near || (!top && !bottom)) return null;
  return ev("six-pointer", club(r), top ? 62 : 58, ["table", top ? "title" : "relegation"], {
    ...base(r), position: r.table.after.position, left: r.table.matchesLeft,
  }, "instant");
};

const SEASON_OVER: Detector = (r) => {
  if (r.kind !== "league" || r.table.matchesLeft > 0) return null;
  const pos = r.table.after.position;
  const drop = r.table.clubs - 2;
  if (pos === 1) {
    return ev("champions", club(r), 100, ["title", "trophy", "table"], {
      ...base(r), points: r.table.after.points,
    }, "instant", "title-race");
  }
  if (pos >= drop) {
    return ev("relegated", club(r), 94, ["relegation", "shame", "table"], {
      ...base(r), position: pos, points: r.table.after.points,
    }, "instant", "relegation-fight");
  }
  if (pos <= 4) {
    return ev("qualified", club(r), 72, ["europe", "table"], {
      ...base(r), position: pos, points: r.table.after.points,
    }, "hour");
  }
  return ev("season-finished", club(r), 40, ["table"], {
    ...base(r), position: pos, points: r.table.after.points,
  }, "hour");
};

export const TABLE_DETECTORS: Detector[] = [
  CLIMB, TITLE_RACE, RELEGATION_FIGHT, SIX_POINTER, SEASON_OVER,
];
