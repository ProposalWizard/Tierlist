import type { Detector } from "../types";
import { averageRating } from "../memory";
import { base, ev, you } from "./kit";

/**
 * You, as a player rather than as a scorer.
 *
 * A rating of 9.1 in a goalless draw is a thing that happened and the career had
 * nowhere to say it. So was a first appearance, a hundredth, an afternoon that
 * ended on the hour because the manager had seen enough.
 */

const DEBUT: Detector = (r) => {
  if (r.you.careerAppearances === 1) {
    return ev("debut", you(r), 66, ["debut", "milestone"], { ...base(r) }, "instant");
  }
  if (r.you.clubAppearances === 1) {
    return ev("club-debut", you(r), 58, ["debut", "milestone"], { ...base(r) }, "instant");
  }
  return null;
};

const APPEARANCE_MILESTONE: Detector = (r) => {
  const marks = [50, 100, 150, 200, 250, 300, 400, 500];
  const hit = marks.find(m => r.you.careerAppearances === m);
  const clubHit = marks.find(m => r.you.clubAppearances === m);
  if (hit) {
    return ev("appearance-milestone", you(r), hit >= 200 ? 74 : 52, ["milestone", "record"], {
      ...base(r), milestone: hit, goals: r.you.careerGoals,
    }, "hour");
  }
  if (clubHit) {
    return ev("club-appearance-milestone", you(r), clubHit >= 200 ? 68 : 46, ["milestone"], {
      ...base(r), milestone: clubHit,
    }, "hour");
  }
  return null;
};

const STAR_MAN: Detector = (r) => {
  if (!r.you.starMan) return null;
  return ev("star-man", you(r), 44, ["award", "opinion"], {
    ...base(r), goals: r.you.goals, assists: r.you.assists,
  }, "hour");
};

const MASTERCLASS: Detector = (r) => {
  if (r.you.rating < 8.8) return null;
  return ev("masterclass", you(r), Math.min(84, 50 + (r.you.rating - 8.8) * 40), ["opinion", "stat"], {
    ...base(r), goals: r.you.goals, assists: r.you.assists,
  }, "hour", "form-hot");
};

const ANONYMOUS: Detector = (r) => {
  if (r.you.rating > 5.6 || r.you.minutes < 45) return null;
  return ev("anonymous", you(r), 40, ["shame", "opinion"], { ...base(r) }, "evening", "form-cold");
};

const HOOKED: Detector = (r) => {
  if (r.you.hooked !== "form") return null;
  return ev("hooked", you(r), 48, ["shame", "manager", "drama"], {
    ...base(r), minutes: r.you.minutes,
  }, "evening", "form-cold");
};

const CAPTAIN_PERFORMANCE: Detector = (r) => {
  if (!r.you.captain || r.you.rating < 8.0) return null;
  return ev("captain-leads", you(r), 46, ["opinion"], { ...base(r) }, "evening");
};

const FORM_SWING: Detector = (r, m) => {
  if (m.recent.length < 4) return null;
  const avg = averageRating(m, 4);
  if (avg >= 7.9) {
    return ev("in-form", you(r), 54, ["form", "stat"], {
      ...base(r), average: avg.toFixed(2), matches: 4,
    }, "evening", "form-hot");
  }
  if (avg <= 5.9) {
    return ev("out-of-form", you(r), 48, ["form", "shame", "stat"], {
      ...base(r), average: avg.toFixed(2), matches: 4,
    }, "evening", "form-cold");
  }
  return null;
};

const SUBSTITUTE_IMPACT: Detector = (r) => {
  if (r.you.minutes >= 60 || r.you.goals + r.you.assists === 0) return null;
  return ev("impact-sub", you(r), 56, ["goal", "drama"], {
    ...base(r), minutes: r.you.minutes, goals: r.you.goals, assists: r.you.assists,
  }, "hour");
};

/**
 * The other side of ANONYMOUS: a real, mockable flop rather than just a
 * quiet fact.
 *
 * Requested directly: "how is that relevant to the game unless they were
 * making fun of me — that's actually pretty interesting, I like the fact
 * that you could have hate comments." The real example given was a
 * substitute appearance — on for the final 15-20 minutes, 0 goals, 0
 * assists, a 5.4 rating — which ANONYMOUS never covers at all (it requires
 * `minutes >= 45`, so a short cameo never fires it). This fires on ANY
 * genuine appearance (`minutes > 0` — never a DNP), whatever the length of
 * it, whenever there is truly nothing to show for it: no goal, no assist,
 * and a rating bad enough that "quiet" undersells it. It can coexist with
 * ANONYMOUS on a longer, equally bad afternoon — a broadsheet's measured
 * "he was quiet" (bs-individual, gated `subject: "you"`) and a fan's "im
 * actually shaking, what a player" over the exact same numbers are two
 * different accounts taking two different angles on the same match, which
 * is exactly how every other event in this engine already works; it is not
 * the same account saying the same thing twice.
 */
const POOR_SHOWING: Detector = (r) => {
  if (r.you.minutes <= 0) return null;
  if (r.you.goals > 0 || r.you.assists > 0) return null;
  if (r.you.rating >= 6.0) return null;
  return ev("poor-showing", you(r), 34, ["shame"], {
    // `goalsN` alongside `goals` — see detect/streaks.ts's own comment on the
    // same split: `{goals}` resolves through grammar.ts's phrase pool
    // ("a hat-trick", "three goals"…), which for zero would render as a
    // second, redundant "goals" bolted onto a template that already writes
    // the word itself ("{goalsN} goals" reads as "0 goals"; "{goals} goals"
    // would have read as "0 goals goals").
    ...base(r), goals: r.you.goals, goalsN: r.you.goals, assists: r.you.assists, minutes: r.you.minutes,
  }, "hour", "form-cold");
};

export const PERSONAL_DETECTORS: Detector[] = [
  DEBUT, APPEARANCE_MILESTONE, STAR_MAN, MASTERCLASS, ANONYMOUS, HOOKED,
  CAPTAIN_PERFORMANCE, FORM_SWING, SUBSTITUTE_IMPACT, POOR_SHOWING,
];
