import type { Template } from "./index";

/**
 * THE PRESS.
 *
 * Two registers that have to be audibly different or the whole voice system is
 * decoration: the broadsheet writes sentences with subordinate clauses and never
 * shouts, the tabloid writes four words and shouts all of them.
 *
 * `tests/star/media.mts` measures this — mean length, caps rate and exclamation
 * rate per archetype — because "they feel different" is not a thing you can
 * assert and "the tabloid is 40% shorter and shouts eight times as often" is.
 */

export const PRESS_TEMPLATES: Template[] = [
  // ── Broadsheet ────────────────────────────────────────────────────────────
  {
    id: "bs-report-win", archetype: "broadsheet", events: ["win", "rout"], frames: ["analyse", "report"],
    body: "{club} {winVerb} {venue} against {opponent}, a {score} that will feel more comfortable in the morning than it did at the time.",
    weight: 2,
  },
  {
    id: "bs-report-loss", archetype: "broadsheet", events: ["loss", "hammered"], frames: ["analyse", "report"],
    body: "{club} {lossVerb} {venue}. {opponent} deserved the {score}, and the questions that follow will not be about the scoreline alone.",
    weight: 2,
  },
  {
    id: "bs-rout", archetype: "broadsheet", events: ["rout"], requires: ["margin"],
    body: "{club} {bigWin} {venue}. {margin} clear, and for long spells {opponent} looked like a side hoping the whistle would come early.",
  },
  {
    id: "bs-hammered", archetype: "broadsheet", events: ["hammered", "embarrassed"], requires: ["margin"],
    body: "{club} {bigLoss}. A {score} defeat that raises harder questions than any single afternoon should have to answer.",
  },
  {
    id: "bs-goal", archetype: "broadsheet", tags: ["goal"], requires: ["goals"], excludes: ["matches"],
    body: "{player} took {goals}, and on this evidence there is little sign of it stopping.",
    threadBody: "{player} has {thread.goals} goals in {thread.matches} matches — a run that has quietly become the story of {club|possessive} season.",
    weight: 2,
  },
  {
    id: "bs-screamer", archetype: "broadsheet", events: ["screamer"], requires: ["distance"],
    body: "The goal, when it came, arrived from {distance} yards: {greatGoal}, struck with the certainty of a player who is not thinking about it any more.",
  },
  {
    id: "bs-comeback", archetype: "broadsheet", events: ["comeback"], requires: ["deficit"],
    body: "Two down and, for twenty minutes, going nowhere — and yet {club} found something. {score}, and nobody in the ground quite believed it.",
  },
  {
    id: "bs-upset", archetype: "broadsheet", events: ["upset", "cup-shock", "embarrassed"], requires: ["gap"],
    body: "On paper there were {gap} points of difference between these sides. On grass there were none, and {club} will not care how it looked on paper.",
    weight: 2,
  },
  {
    id: "bs-run", archetype: "broadsheet", tags: ["streak"], requires: ["matches"],
    body: "{matches} matches now, and the interesting thing about a run is never how it started. It is what it does to the sides who have to play you next.",
    weight: 2,
  },
  {
    id: "bs-individual", archetype: "broadsheet", tags: ["opinion"], requires: ["player"],
    body: "{player} was the difference, and he was the difference in the quiet way — not the goals, the twenty minutes either side of them.",
    weight: 2,
  },
  {
    id: "bs-title", archetype: "broadsheet", events: ["title-race", "went-top", "lost-top"], requires: ["left", "position"],
    body: "With {left} matches remaining, {club} sit {position|ordinal}. Title races are not won in {week|ordinal} weeks, but they are certainly lost in them.",
    weight: 2,
  },
  {
    id: "bs-relegation", archetype: "broadsheet", events: ["relegation-fight", "into-the-drop"], requires: ["left"],
    body: "{club} have {left} matches to find the points that keep them up. On current form, that is not a comfortable arithmetic.",
  },
  {
    id: "bs-manager", archetype: "broadsheet", tags: ["manager"], requires: ["manager"],
    body: "{manager} leaves {club} after a run that made the decision, in the end, straightforward for a board that rarely finds anything straightforward.",
  },
  {
    id: "bs-transfer", archetype: "broadsheet", tags: ["transfer"], requires: ["to"],
    body: "{player} completes a move to {to}. Whether {to} have bought the player of the last six months or the player of the last six years is the question the fee does not answer.",
  },
  {
    id: "bs-champions", archetype: "broadsheet", events: ["champions", "trophy"],
    body: "{club} are champions. It has been a season of small margins and one very large one, and the table is the only argument that matters now.",
    weight: 3,
  },
  {
    id: "bs-form", archetype: "broadsheet", events: ["in-form", "out-of-form"], requires: ["average"],
    body: "{player} is averaging {average} across his last {matches}. Form is temporary, as the cliché has it — the interesting question is which of these is the temporary one.",
  },
  {
    id: "bs-generic", archetype: "broadsheet",
    body: "{club} {score} {opponent}. A result that says less about either side than the table will suggest by Monday.",
    weight: 0.5,
  },

  // ── Tabloid ───────────────────────────────────────────────────────────────
  {
    id: "tb-hattrick", archetype: "tabloid", events: ["hat-trick", "four-goals", "five-goals"],
    requires: ["goals", "short"],
    body: "{short|caps} {goals|caps}!",
    graphic: "breaking", weight: 4,
  },
  {
    id: "tb-late", archetype: "tabloid", events: ["late-winner"], requires: ["short", "minute"],
    body: "{short|caps} SINKS THEM AT {minute}!",
    graphic: "breaking", weight: 4,
  },
  {
    id: "tb-screamer", archetype: "tabloid", events: ["screamer"], requires: ["short", "distance"],
    body: "{distance} YARDS! {short|caps} WITH A ROCKET",
    graphic: "breaking", weight: 3,
  },
  {
    id: "tb-goal", archetype: "tabloid", tags: ["goal"], requires: ["short"], frames: ["hype"],
    body: "{short|caps} DOES IT AGAIN",
    threadBody: "{thread.goals} IN {thread.matches}. {short|caps} IS UNSTOPPABLE",
    weight: 2,
  },
  {
    id: "tb-derby", archetype: "tabloid", events: ["derby-win"], requires: ["short"],
    body: "THE CITY IS THEIRS! {club|caps} DO THE DERBY",
    graphic: "breaking", weight: 3,
  },
  {
    id: "tb-derby-loss", archetype: "tabloid", events: ["derby-loss"], frames: ["mock"],
    body: "DERBY DAY MISERY FOR {club|caps}",
    weight: 2,
  },
  {
    id: "tb-shame", archetype: "tabloid", tags: ["shame"], frames: ["mock"], requires: ["margin"],
    body: "{margin}-GOAL HUMILIATION. WHERE DOES {club|caps} GO FROM HERE?",
    graphic: "breaking", weight: 2,
  },
  {
    id: "tb-collapse", archetype: "tabloid", events: ["collapse"], requires: ["lead"],
    body: "BOTTLED IT! {lead} UP AND THEY STILL LOST",
    graphic: "breaking",
  },
  {
    id: "tb-crisis", archetype: "tabloid", events: ["losing-run", "drought"], requires: ["matches"],
    body: "CRISIS: {matches} AND COUNTING",
    weight: 2,
  },
  {
    id: "tb-manager", archetype: "tabloid", tags: ["manager"], requires: ["manager"],
    body: "AXED! {manager|caps} GOES",
    graphic: "breaking", weight: 3,
  },
  {
    id: "tb-transfer", archetype: "tabloid", tags: ["transfer", "rumour"], requires: ["to"],
    body: "DONE DEAL! {short|caps} TO {to|caps}",
    graphic: "transfer", weight: 3,
  },
  {
    id: "tb-trophy", archetype: "tabloid", events: ["trophy", "champions"],
    body: "{club|caps} ARE CHAMPIONS!",
    graphic: "trophy", weight: 4,
  },
  {
    id: "tb-relegated", archetype: "tabloid", events: ["relegated"],
    body: "DOWN. {club|caps} ARE RELEGATED",
    graphic: "breaking", weight: 4,
  },
  {
    id: "tb-generic", archetype: "tabloid",
    body: "{club|caps} {us}-{them} {opponent|caps}",
    weight: 0.5,
  },
];
