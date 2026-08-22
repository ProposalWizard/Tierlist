import type { Detector } from "../types";
import { base, club, ev, you } from "./kit";

/**
 * The match itself, before anybody looks at what you personally did.
 *
 * These are the events the club account, the league account and the opposition's
 * supporters all read. They are also the ones that make a career feel like it is
 * happening somewhere — a 2-1 is a scoreline, but a 2-1 after being two down
 * away at the leaders is a story, and the difference is entirely in facts the
 * career already had and never once used.
 */

const FULL_TIME: Detector = (r) => ev(
  r.result === "win" ? "win" : r.result === "draw" ? "draw" : "loss",
  club(r),
  r.result === "win" ? 34 : r.result === "draw" ? 22 : 26,
  ["table"],
  { ...base(r), margin: Math.abs(r.score.us - r.score.them) },
  "instant",
);

const ROUT: Detector = (r) => {
  const margin = r.score.us - r.score.them;
  if (margin < 3) return null;
  return ev("rout", club(r), 54 + margin * 4, ["table", "drama"], {
    ...base(r), margin,
  }, "instant");
};

const HAMMERED: Detector = (r) => {
  const margin = r.score.them - r.score.us;
  if (margin < 3) return null;
  return ev("hammered", club(r), 50 + margin * 5, ["shame", "drama"], {
    ...base(r), margin,
  }, "instant", "crisis");
};

/**
 * A comeback, reconstructed.
 *
 * The lowest point of the match is recoverable from the running score on your
 * side's goals — see record.ts, which distributes the opposition's goals across
 * the ninety so the sequence makes sense. It is a reconstruction, so it is used
 * only for this: were you behind by two at any point, and did you still win.
 */
const COMEBACK: Detector = (r) => {
  if (r.result !== "win") return null;
  let worst = 0;
  for (const g of r.goals) {
    if (!g.scoreAfter) return null;
    worst = Math.max(worst, g.scoreAfter.them - g.scoreAfter.us);
  }
  if (worst < 2) return null;
  return ev("comeback", club(r), 60 + worst * 8, ["drama", "table"], {
    ...base(r), deficit: worst,
  }, "instant");
};

const COLLAPSE: Detector = (r) => {
  if (r.result === "win") return null;
  let best = 0;
  for (const g of r.goals) {
    if (!g.scoreAfter) return null;
    best = Math.max(best, g.scoreAfter.us - g.scoreAfter.them);
  }
  if (best < 2) return null;
  return ev("collapse", club(r), 58 + best * 6, ["shame", "drama"], {
    ...base(r), lead: best,
  }, "instant", "crisis");
};

const CLEAN_SHEET: Detector = (r) => {
  if (r.score.them !== 0) return null;
  return ev("clean-sheet", club(r), r.result === "win" ? 30 : 24, ["keeper", "stat"], {
    ...base(r),
  }, "hour", "clean-sheets");
};

/**
 * An upset, measured rather than asserted.
 *
 * The league already gives every club a strength, and the whole division is
 * simulated off it. A fifteen-point gap between the two sides is the definition
 * of a shock and it was sitting there unread.
 */
const UPSET: Detector = (r) => {
  const gap = r.opponentStrength - r.clubStrength;
  if (r.result === "win" && gap >= 12) {
    return ev(r.kind === "league" ? "upset" : "cup-shock", club(r),
      Math.min(92, 54 + gap * 1.6), ["drama", "table", r.kind === "league" ? "table" : "cup"], {
        ...base(r), gap: Math.round(gap),
      }, "instant");
  }
  if (r.result === "loss" && gap <= -12) {
    return ev("embarrassed", club(r), Math.min(80, 44 + Math.abs(gap) * 1.4), ["shame", "drama"], {
      ...base(r), gap: Math.round(Math.abs(gap)),
    }, "instant", "crisis");
  }
  return null;
};

/** How much more a derby's OWN base importance climbs for a rated rivalry on
 *  top of it — Liverpool-Everton is a derby full stop; a Merseyside-strength
 *  primary rivalry between two clubs who ALSO share a rated history climbs
 *  further still. See lib/star/rivalries.ts. */
const RIVALRY_BOOST: Record<"R1" | "R2" | "R3", number> = { R1: 18, R2: 10, R3: 4 };

const DERBY: Detector = (r) => {
  if (!r.derby) return null;
  const id = r.result === "win" ? "derby-win" : r.result === "loss" ? "derby-loss" : "derby-draw";
  const boost = r.rivalryTier ? RIVALRY_BOOST[r.rivalryTier] : 0;
  return ev(id, club(r), Math.min(96, (r.result === "draw" ? 52 : 78) + boost), ["derby", "drama"], {
    ...base(r),
  }, "instant", "derby");
};

const THRILLER: Detector = (r) => {
  const total = r.score.us + r.score.them;
  if (total < 6) return null;
  return ev("thriller", club(r), 50 + total * 3, ["drama"], { ...base(r), total }, "hour");
};

const GOALLESS: Detector = (r) => {
  if (r.score.us !== 0 || r.score.them !== 0) return null;
  return ev("goalless", club(r), 20, ["table"], { ...base(r) }, "evening");
};

export const RESULT_DETECTORS: Detector[] = [
  FULL_TIME, ROUT, HAMMERED, COMEBACK, COLLAPSE, CLEAN_SHEET, UPSET, DERBY, THRILLER, GOALLESS,
];
