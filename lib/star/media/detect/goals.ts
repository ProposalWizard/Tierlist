import type { Detector, FootballEvent, GoalKind } from "../types";
import { base, ev, isEqualiser, isWinner, userGoals, you } from "./kit";

/**
 * What you did in front of goal.
 *
 * Every detector here is independent — a last-minute hat-trick winner from
 * thirty yards fires four of them, and that is correct. Four events means four
 * angles for eleven accounts to choose between, which is how the same afternoon
 * reads differently on the club account and the stat page.
 */

const HAUL: Detector = (r) => {
  const n = r.you.goals;
  if (n < 2) return null;
  const id = n >= 5 ? "five-goals" : n === 4 ? "four-goals" : n === 3 ? "hat-trick" : "brace";
  const importance = n >= 5 ? 96 : n === 4 ? 88 : n === 3 ? 76 : 52;
  return ev(id, you(r), importance, ["goal", n >= 3 ? "record" : "goal"], {
    ...base(r),
    goals: n,
    minutes: userGoals(r).map(g => g.minute).join(", "),
  }, "instant", "form-hot");
};

const ONE_GOAL: Detector = (r) => {
  if (r.you.goals !== 1) return null;
  const g = userGoals(r)[0];
  return ev("scored", you(r), 34, ["goal"], {
    ...base(r), goals: 1, minute: g?.minute ?? 0, how: g?.how ?? "",
  }, "instant", "form-hot");
};

const OPENER: Detector = (r) => {
  const g = userGoals(r).find(x => x.scoreAfter?.us === 1 && x.scoreAfter.them === 0);
  if (!g) return null;
  return ev("opener", you(r), 30, ["goal"], { ...base(r), minute: g.minute }, "instant");
};

const EQUALISER: Detector = (r) => {
  const g = userGoals(r).find(isEqualiser);
  if (!g) return null;
  const late = g.minute >= 80;
  return ev("equaliser", you(r), late ? 62 : 44, late ? ["goal", "drama"] : ["goal"], {
    ...base(r), minute: g.minute, how: g.how ?? "",
  }, "instant");
};

const WINNER: Detector = (r) => {
  const g = userGoals(r).find(x => isWinner(r, x));
  if (!g) return null;
  const late = g.minute >= 85;
  return ev(late ? "late-winner" : "winner", you(r), late ? 86 : 58,
    late ? ["goal", "drama"] : ["goal"], {
      ...base(r), minute: g.minute, how: g.how ?? "",
    }, "instant", "form-hot");
};

/**
 * How it was struck.
 *
 * Reads `how` and `distance`, which a career saved before the match engine
 * recorded them does not have. It returns nothing rather than guessing — a
 * headline about a thirty-yard screamer that was actually a tap-in is worse than
 * no headline.
 */
const SPECTACULAR: Detector = (r) => {
  const out: FootballEvent[] = [];
  for (const g of userGoals(r)) {
    if (!g.how) continue;
    const far = (g.distance ?? 0) >= 22;
    const spectacular: GoalKind[] = ["volley", "long_range", "free_kick", "tight_angle", "solo"];

    if (g.how === "long_range" || far) {
      out.push(ev("screamer", you(r), far && (g.distance ?? 0) >= 28 ? 74 : 60, ["goal", "drama"], {
        ...base(r), minute: g.minute, how: g.how, distance: Math.round(g.distance ?? 22),
      }, "instant", "goal-of-the-season"));
    } else if (spectacular.includes(g.how)) {
      out.push(ev("special-goal", you(r), 56, ["goal", "drama"], {
        ...base(r), minute: g.minute, how: g.how,
      }, "instant", "goal-of-the-season"));
    } else if (g.how === "header" || g.how === "penalty") {
      out.push(ev(g.how === "header" ? "headed-goal" : "penalty-scored", you(r), 32, ["goal"], {
        ...base(r), minute: g.minute, how: g.how,
      }, "instant"));
    }
  }
  return out.length ? out : null;
};

const FIRST_GOAL: Detector = (r, m) => {
  if (r.you.goals === 0) return null;
  if (r.you.careerGoals !== r.you.goals) return null;   // the first he has ever scored
  return ev("first-career-goal", you(r), 70, ["goal", "milestone", "debut"], {
    ...base(r), goals: r.you.goals, apps: r.you.careerAppearances,
    waited: Math.max(0, r.you.careerAppearances - 1),
  }, "instant");
};

const FIRST_FOR_CLUB: Detector = (r) => {
  if (r.you.goals === 0) return null;
  if (r.you.careerGoals === r.you.goals) return null;   // covered by first-career-goal
  if (r.you.clubAppearances > 12) return null;
  // Only when this is a NEW club — a first goal after twelve games at the club
  // you came through is a drought story, not a debut one.
  if (r.you.careerAppearances - r.you.clubAppearances < 5) return null;
  return ev("first-for-club", you(r), 58, ["goal", "milestone"], {
    ...base(r), apps: r.you.clubAppearances,
  }, "instant");
};

const GOAL_MILESTONE: Detector = (r) => {
  if (r.you.goals === 0) return null;
  const marks = [10, 25, 50, 75, 100, 150, 200, 250, 300];
  const passed = marks.find(m => r.you.careerGoals >= m && r.you.careerGoals - r.you.goals < m);
  if (!passed) return null;
  return ev("goal-milestone", you(r), passed >= 100 ? 88 : passed >= 50 ? 72 : 56,
    ["goal", "milestone", "record"], {
      ...base(r), milestone: passed, total: r.you.careerGoals, apps: r.you.careerAppearances,
    }, "hour");
};

const ALL_THE_GOALS: Detector = (r) => {
  if (r.you.goals < 2 || r.you.goals !== r.score.us) return null;
  return ev("scored-them-all", you(r), 70, ["goal", "stat"], {
    ...base(r), goals: r.you.goals,
  }, "hour");
};

const BLANK: Detector = (r, m) => {
  // Only worth mentioning when it is a story: a forward who normally scores.
  if (r.you.goals > 0) return null;
  if (m.streaks.drought < 5) return null;
  if (!["ST", "CAM", "LW", "RW"].includes(r.you.position)) return null;
  return ev("drought", you(r), Math.min(66, 30 + m.streaks.drought * 4), ["shame", "form", "streak"], {
    ...base(r), matches: m.streaks.drought,
  }, "evening", "drought");
};

export const GOAL_DETECTORS: Detector[] = [
  HAUL, ONE_GOAL, OPENER, EQUALISER, WINNER, SPECTACULAR,
  FIRST_GOAL, FIRST_FOR_CLUB, GOAL_MILESTONE, ALL_THE_GOALS, BLANK,
];
