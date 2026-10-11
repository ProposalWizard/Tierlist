import { ev } from "./kit";
import type { Facts, FootballEvent } from "../types";
import type { RegenNote, RetirementNote } from "../../retirementNews";
import { surname } from "../grammar";

/**
 * RETIREMENTS AND REGENS, AT THE ROLLOVER.
 *
 * The world ages (worldAgeing.ts): men retire from 33 and boys replace them.
 * retirementNews.ts picks which of them are news; this turns each one into
 * an event the ordinary pipeline narrates — the club says farewell, the
 * stats accounts give the numbers, the fans react.
 *
 * Every fact is set only when it is real (a man with no goals this season
 * has no `seasonGoals`), so a template that names a missing number is
 * rejected by the chooser rather than printing a hole.
 *
 * Three event ids, each with its own exact templates for every archetype
 * that is interested in its tags, so a post is never a generic fallback:
 *  - "teammate-retires": your own team-mate (tags milestone).
 *  - "legend-retires":   a famous name elsewhere (tags milestone).
 *  - "regen-watch":      a High Potential boy just brought in (rumour, debut, milestone).
 */

const POSITION_WORD: Record<string, string> = {
  GK: "goalkeeper", CB: "centre-back", LB: "left-back", RB: "right-back", CDM: "holding midfielder",
  CM: "midfielder", CAM: "attacking midfielder", LW: "winger", RW: "winger", ST: "striker",
};

export function positionWord(pos: string): string | undefined {
  return POSITION_WORD[pos];
}

function common(n: { name: string; club: string; age: number; position: string; overall?: number }, season: number): Facts {
  const role = positionWord(n.position);
  return {
    player: n.name,
    short: surname(n.name),
    club: n.club,
    age: n.age,
    season,
    ...(role ? { role } : {}),
    ...(typeof n.overall === "number" ? { overall: n.overall } : {}),
  };
}

export function retirementEvent(n: RetirementNote, season: number): FootballEvent {
  const facts: Facts = {
    ...common(n, season),
    ...(n.goalsWithUs ? { goalsWithUs: n.goalsWithUs } : {}),
    ...(n.assistsWithUs ? { assistsWithUs: n.assistsWithUs } : {}),
    ...(n.seasonGoals ? { lastGoals: n.seasonGoals } : {}),
    ...(n.seasonAssists ? { lastAssists: n.seasonAssists } : {}),
  };
  if (n.own) {
    return ev("teammate-retires", { kind: "teammate", name: n.name }, 52, ["milestone"], facts, "hour");
  }
  return ev("legend-retires", { kind: "club", name: n.club }, 48, ["milestone"], facts, "evening");
}

export function regenEvent(n: RegenNote, season: number): FootballEvent {
  return ev("regen-watch", { kind: "club", name: n.club }, 34, ["rumour", "debut", "milestone"], {
    ...common(n, season),
    tier: n.worldClass ? "World Class" : "High",
    ...(n.worldClass ? { worldClass: true } : {}),
  }, "nextDay");
}
