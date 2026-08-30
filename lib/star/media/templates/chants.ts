import type { Template } from "./index";
import {
  CLUB_WIN_CHANTS, CLUB_SCORELINE_CHANTS, CLUB_DRAW_LOSS_CHANTS, PLAYER_GOAL_CHANTS,
} from "../chants";

/**
 * REAL CHANTS, TURNED INTO TEMPLATES.
 *
 * Built from the data in ../chants.ts rather than hand-written one at a time,
 * so adding a chant is editing that one table, not this file. A club or
 * player with several lines gets one Template per line, all equally weighted
 * — `chooseTemplate` already picks one at random and never repeats one in
 * the same cycle, exactly the variety a real ground has.
 */

let n = 0;

const winTemplates: Template[] = Object.entries(CLUB_WIN_CHANTS).flatMap(([clubName, lines]) =>
  lines.map((body): Template => ({
    id: `chant-win-${n++}`, archetype: "fan", events: ["win", "rout"], club: clubName, body,
  })));

const scorelineTemplates: Template[] = Object.entries(CLUB_SCORELINE_CHANTS).flatMap(([clubName, byScore]) =>
  Object.entries(byScore).flatMap(([score, lines]) =>
    lines.map((body): Template => ({
      id: `chant-score-${n++}`, archetype: "fan", events: ["win"], club: clubName, score, body,
      // Rarer than the plain win chant, so the exact-scoreline line does not
      // crowd out the club's regular one on the scorelines it also matches.
      weight: 2,
    }))));

const drawLossTemplates: Template[] = Object.entries(CLUB_DRAW_LOSS_CHANTS).flatMap(([clubName, lines]) =>
  lines.map((body): Template => ({
    id: `chant-drawloss-${n++}`, archetype: "fan", events: ["draw", "loss"], club: clubName, body,
  })));

const playerGoalTemplates: Template[] = Object.entries(PLAYER_GOAL_CHANTS).flatMap(([playerName, lines]) =>
  lines.map((body): Template => ({
    id: `chant-player-${n++}`, archetype: "fan", tags: ["goal"], requires: ["scorer"], player: playerName, body,
  })));

export const CHANT_TEMPLATES: Template[] = [
  ...winTemplates, ...scorelineTemplates, ...drawLossTemplates, ...playerGoalTemplates,
];
