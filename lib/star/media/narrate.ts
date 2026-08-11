import type { Angle, Archetype, Frame, FootballEvent, MediaAccount, StoryMemory } from "./types";
import { pick, rngFor } from "./grammar";

/**
 * THE ANGLE
 *
 * The stage that decides what a post is ABOUT before a single word of it is
 * chosen, and the reason the same event does not read the same way twice.
 *
 * Given a late winner in a derby with a hot scoring run behind it, the club
 * account leads with the minute, the stat page leads with the run, and the
 * rival's supporters lead with the opponent. Three posts, one event, no shared
 * text — and none of that variety comes from the templates, which is what stops
 * the template library having to contain every combination.
 */

const FRAMES: Record<Archetype, Frame[]> = {
  club: ["celebrate", "report"],
  league: ["report"],
  competition: ["report", "celebrate"],
  broadsheet: ["analyse", "report"],
  tabloid: ["hype", "mock"],
  insider: ["report"],
  stats: ["report"],
  aggregator: ["hype", "report"],
  pundit: ["analyse", "question", "lament"],
  fan: ["celebrate", "hype", "lament"],
  rivalFan: ["mock", "joke"],
  teammate: ["celebrate"],
  meme: ["joke", "mock"],
};

const NEGATIVE_TAGS = new Set(["shame", "relegation"]);

/**
 * Which fact leads.
 *
 * Ordered by how interesting it is to that kind of account, and filtered by
 * what the event actually carries — a template asking for a minute on an event
 * with no minute produces a sentence with a hole in it, so the angle never
 * selects a lead the facts cannot support.
 */
const LEAD_PREFERENCE: Record<Archetype, string[]> = {
  club: ["goals", "minute", "score", "player", "round"],
  league: ["score", "goals", "position", "points"],
  competition: ["round", "score", "goals"],
  broadsheet: ["score", "position", "gap", "average", "matches"],
  tabloid: ["minute", "goals", "margin", "deficit", "player"],
  insider: ["fee", "to", "seasons", "club"],
  stats: ["goals", "matches", "average", "total", "milestone", "assists"],
  aggregator: ["goals", "minute", "how", "score"],
  pundit: ["average", "matches", "rating", "position", "player"],
  fan: ["minute", "goals", "player", "score"],
  rivalFan: ["opponent", "score", "margin", "position"],
  teammate: ["player", "goals", "score"],
  meme: ["margin", "score", "opponent", "matches"],
};

export function chooseAngle(
  event: FootballEvent,
  account: MediaAccount,
  memory: StoryMemory,
  cycleId: string,
): Angle {
  const rng = rngFor("angle", cycleId, event.id, account.id);

  const negative = event.tags.some(t => NEGATIVE_TAGS.has(t));
  const hostile = account.allegiance?.polarity === -1;
  const sentiment: -1 | 0 | 1 = hostile
    ? (negative ? 1 : -1)
    : (negative ? -1 : event.tags.includes("goal") || event.tags.includes("trophy") ? 1 : 0);

  // A club account does not celebrate a defeat, and a rival does not lament one.
  let frames = FRAMES[account.archetype];
  if (!hostile && negative) frames = frames.filter(f => f !== "celebrate");
  if (!frames.length) frames = ["report"];
  const frame = pick(frames, rng);

  // Lead with a fact the event actually has.
  const prefs = LEAD_PREFERENCE[account.archetype] ?? ["score"];
  const lead = prefs.find(k => event.facts[k] !== undefined && event.facts[k] !== "") ?? "score";
  const secondary = prefs.find(k => k !== lead && event.facts[k] !== undefined && event.facts[k] !== "");

  /**
   * Whether to reach for the running story instead of today.
   *
   * Only when there IS one and it is hot, and only for the kinds of account
   * that talk in seasons rather than in afternoons. A fan account shouting
   * "SIX IN THREE" is not how a fan account sounds; a stat page saying anything
   * else is not how a stat page sounds.
   */
  const threadish: Archetype[] = ["stats", "broadsheet", "pundit", "tabloid", "league"];
  const useThread = !!event.thread
    && event.thread.heat >= 45
    && Number(event.thread.facts.matches ?? 0) >= 2
    && threadish.includes(account.archetype)
    && rng() < 0.8;

  return { lead, secondary, sentiment, frame, useThread };
}
