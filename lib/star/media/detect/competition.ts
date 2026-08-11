import type { Detector } from "../types";
import { base, club, ev, you } from "./kit";

/**
 * Knockout football, which is the only place in the career where a single
 * afternoon is the end of something.
 *
 * The career already resolves ties, advances rounds and awards trophies — and
 * the sum total of what it said about any of it was one coloured strip on the
 * post-match screen.
 */

const ROUND: Detector = (r) => {
  if (!r.cup || r.kind === "league") return null;
  const final = r.round === "Final";

  if (r.cup.trophy) {
    return ev("trophy", club(r), 100, ["trophy", "cup", r.kind === "europe" ? "europe" : "cup"], {
      ...base(r), round: r.round ?? "",
    }, "instant", `cup-run:${r.competition}`);
  }
  if (r.cup.advanced) {
    const semi = r.round === "Semi-Final";
    return ev(semi ? "into-the-final" : "through", club(r), semi ? 84 : 46, ["cup"], {
      ...base(r), round: r.round ?? "",
    }, "instant", `cup-run:${r.competition}`);
  }
  if (r.cup.eliminated) {
    return ev(final ? "lost-the-final" : "knocked-out", club(r), final ? 88 : 52,
      ["cup", "shame"], { ...base(r), round: r.round ?? "" }, "instant", `cup-run:${r.competition}`);
  }
  return null;
};

const EUROPEAN_NIGHT: Detector = (r) => {
  if (r.kind !== "europe") return null;
  if (r.you.goals === 0 && r.you.rating < 8.0) return null;
  return ev("european-night", you(r), 62, ["europe", "goal"], {
    ...base(r), goals: r.you.goals, round: r.round ?? "",
  }, "hour");
};

const INTERNATIONAL: Detector = (r) => {
  if (r.kind !== "international") return null;
  if (r.you.goals > 0) {
    return ev("international-goal", you(r), 70, ["international", "goal"], {
      ...base(r), goals: r.you.goals,
    }, "instant");
  }
  return ev("international-cap", you(r), 34, ["international"], { ...base(r) }, "hour");
};

/**
 * The golden boot, which the career computes every time you open the stats
 * screen and never once mentioned.
 */
const GOLDEN_BOOT: Detector = (r) => {
  if (r.kind !== "league" || r.you.goals === 0) return null;
  if (r.you.seasonGoals < 8) return null;
  return ev("golden-boot-race", you(r), r.table.matchesLeft <= 8 ? 66 : 44, ["stat", "award", "goal"], {
    ...base(r), goals: r.you.seasonGoals, left: r.table.matchesLeft,
  }, "weekly", "golden-boot");
};

export const COMPETITION_DETECTORS: Detector[] = [
  ROUND, EUROPEAN_NIGHT, INTERNATIONAL, GOLDEN_BOOT,
];
