import type { Detector } from "../types";
import { base, ev, userGoals, you } from "./kit";

/**
 * The half of a forward's afternoon that never got reported.
 *
 * The career has counted assists since the day it was written and the only
 * place they appeared was a row on the post-match screen. A player who set up
 * three and scored none had, as far as the world was concerned, done nothing.
 */

const ASSISTS: Detector = (r) => {
  const n = r.you.assists;
  if (n < 1) return null;
  const id = n >= 3 ? "assist-hat-trick" : n === 2 ? "double-assist" : "assist";
  const importance = n >= 3 ? 80 : n === 2 ? 56 : 30;
  return ev(id, you(r), importance, ["assist"], {
    ...base(r), assists: n,
  }, "instant", n >= 2 ? "form-hot" : undefined);
};

const GOAL_AND_ASSIST: Detector = (r) => {
  if (r.you.goals < 1 || r.you.assists < 1) return null;
  return ev("goal-and-assist", you(r), 48, ["goal", "assist", "stat"], {
    ...base(r), goals: r.you.goals, assists: r.you.assists,
    involved: r.you.goals + r.you.assists,
  }, "hour");
};

/** A hand in every goal your side scored. A stat page's favourite kind of fact. */
const INVOLVED_IN_ALL: Detector = (r) => {
  const involved = r.you.goals + r.you.assists;
  if (r.score.us < 3 || involved < r.score.us) return null;
  return ev("involved-in-all", you(r), 74, ["stat", "goal", "assist"], {
    ...base(r), goals: r.you.goals, assists: r.you.assists, involved,
  }, "hour");
};

const ASSIST_MILESTONE: Detector = (r) => {
  if (r.you.assists === 0) return null;
  const marks = [10, 25, 50, 100, 150];
  const passed = marks.find(m => r.you.careerAssists >= m && r.you.careerAssists - r.you.assists < m);
  if (!passed) return null;
  return ev("assist-milestone", you(r), passed >= 100 ? 72 : 50, ["assist", "milestone", "record"], {
    ...base(r), milestone: passed, total: r.you.careerAssists,
  }, "hour");
};

/** Somebody else had the day. The club account still has to post about it. */
const TEAMMATE_HAUL: Detector = (r) => {
  const counts = new Map<string, number>();
  for (const g of r.goals) {
    if (g.isUser) continue;
    counts.set(g.scorer, (counts.get(g.scorer) ?? 0) + 1);
  }
  const best = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
  if (!best || best[1] < 2) return null;
  return ev("teammate-haul", { kind: "teammate", name: best[0] }, best[1] >= 3 ? 60 : 38, ["goal"], {
    ...base(r), scorer: best[0], goals: best[1],
  }, "hour");
};

export const CREATION_DETECTORS: Detector[] = [
  ASSISTS, GOAL_AND_ASSIST, INVOLVED_IN_ALL, ASSIST_MILESTONE, TEAMMATE_HAUL,
];
