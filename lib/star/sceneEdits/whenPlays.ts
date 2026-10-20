/**
 * WHEN DOES A GENERATED CUT SCENE PLAY? (Harry, 20 Oct 2026, answer 31: "I
 * just don't know when they play and why, but we need to fix that.")
 *
 * The one list behind the Scene generator's "When does this play?" panel
 * (/admin/scene-generator). One row per event kind the generator knows (18):
 *   moment — the game moment that WOULD trigger it (the proposal, for Harry to approve)
 *   today  — what the game shows at that moment now
 *   wired  — does the real game play the generated scene there? All false today:
 *            generated scenes only play on test pages. Not wired tonight on purpose.
 * tests/star/sceneEdits.mts keeps this honest: while no career screen calls
 * the generator, every row must say "not wired".
 */
import type { EventKind } from "../cutscene/types";

export interface WhenRow { kind: EventKind; moment: string; today: string; wired: boolean }

export const WHEN_PLAYS: WhenRow[] = [
  { kind: "signed", moment: "You sign a contract: the first one after the trial, and every move to a new club", today: "The 3D signing (its own hand-built scene, not the generator)", wired: false },
  { kind: "scored", moment: "A goal of yours that matters: a winner, a late goal, a goal in a final", today: "The goal itself and the goal videos in the feed; no cut scene", wired: false },
  { kind: "won-trophy", moment: "You lift a trophy: the league, a cup, a European final", today: "The trophy screens (drawn); no cut scene", wired: false },
  { kind: "injured", moment: "You are injured in a match", today: "A message and weeks out; no cut scene", wired: false },
  { kind: "dropped", moment: "You lose your place in the starting XI", today: "Not in the squad: a word from the manager in his 3D office", wired: false },
  { kind: "sacked", moment: "Your manager is sacked", today: "A news post in the feed", wired: false },
  { kind: "record-broken", moment: "You break a club, league or Hall of Fame record", today: "A RECORD BROKEN pop-up", wired: false },
  { kind: "transfer-request", moment: "You hand in a transfer request", today: "Nothing: the game has no transfer requests (left out on purpose)", wired: false },
  { kind: "rivalry", moment: "Before a derby, or a match against your rival", today: "The team sheets", wired: false },
  { kind: "debut", moment: "Your first match for a club", today: "Nothing special", wired: false },
  { kind: "walkout", moment: "The teams walk out before a big match: a final or a derby", today: "The line-up intro", wired: false },
  { kind: "press-conference", moment: "A press question before or after a big match", today: "The press conference screen (drawn)", wired: false },
  { kind: "award", moment: "You win Player of the Month, the Golden Boot or the Ballon d'Or", today: "Award cards; the 3D Ballon d'Or night (its own hand-built scene)", wired: false },
  { kind: "promoted", moment: "Your club goes up at the end of the season", today: "The season-end screens", wired: false },
  { kind: "relegated", moment: "Your club goes down at the end of the season", today: "The season-end screens", wired: false },
  { kind: "retired", moment: "You retire: the farewell match", today: "The farewell match, the 3D guard of honour and the ovation (their own scenes)", wired: false },
  { kind: "arrival", moment: "You arrive at a new club, before the first training", today: "Nothing", wired: false },
  { kind: "mentor-advice", moment: "A senior team-mate gives you advice: a bad run, a big chance coming", today: "Nothing (no mentors in the game yet)", wired: false },
];

/** Every event kind the generator can be asked for, in the panel's order. */
export const EVENT_KINDS: EventKind[] = WHEN_PLAYS.map((r) => r.kind);
