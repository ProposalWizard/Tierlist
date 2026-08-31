import type { Archetype, Frame, FootballEvent, GraphicKind, StoryMemory, Tag } from "../types";
import { pickWeighted } from "../grammar";
import { CLUB_TEMPLATES } from "./club";
import { PRESS_TEMPLATES } from "./press";
import { SOCIAL_TEMPLATES } from "./social";
import { DATA_TEMPLATES } from "./data";
import { CHANT_TEMPLATES } from "./chants";

/**
 * THE TEMPLATE LIBRARY
 *
 * A template is a sentence with holes in it, and it is matched on four axes:
 * the event, the archetype writing it, the frame the narration chose, and the
 * facts the event actually carries.
 *
 * The important design decision is that a template can match a TAG rather than
 * an event id. `{ archetype: "tabloid", tags: ["goal"] }` covers hat-tricks,
 * braces, screamers, late winners and every goal event added in future — so the
 * library gives full coverage without an entry per combination, and a new
 * detector is useful on the day it is written rather than after thirteen
 * accounts have had lines authored for it.
 */

export interface Template {
  id: string;
  archetype: Archetype;
  /** Exact event ids. Preferred over a tag match when both apply. */
  events?: string[];
  /** …or anything carrying one of these tags. */
  tags?: Tag[];
  frames?: Frame[];
  /** Fact keys that must be present and non-empty. */
  requires?: string[];
  /**
   * Exact-value gates, for a line that is not just "a goal" but a specific
   * real chant — "One-Nil to the Arsenal" is only ever sung by Arsenal, only
   * at 1-0. `club` matches `facts.club`, `score` matches `facts.score`
   * ("us-them", the same format `base()` already writes), `player` matches
   * `facts.scorer`. Unlike `requires`, which only checks a fact exists, these
   * check it equals a specific value.
   */
  club?: string;
  score?: string;
  player?: string;
  /** Matches `facts.result` ("win"/"draw"/"loss") — a personal goal reads
   *  differently depending on whether it actually helped you win. */
  result?: "win" | "draw" | "loss";
  /**
   * Fact keys that must be ABSENT.
   *
   * The safety valve for a word like "today". `goals: 7` on a hat-trick means
   * seven this afternoon; on a scoring run it means seven across three matches,
   * and a template that appends "today" to it is a lie. Excluding `matches`
   * says "this line is about one match" without every run detector having to
   * invent a different fact name.
   */
  excludes?: string[];
  weight?: number;
  body: string;
  /** Used instead of `body` when the angle chose to lead with the running story. */
  threadBody?: string;
  graphic?: GraphicKind;
  hashtag?: boolean;
}

const ALL: Template[] = [
  ...CLUB_TEMPLATES,
  ...PRESS_TEMPLATES,
  ...SOCIAL_TEMPLATES,
  ...DATA_TEMPLATES,
  ...CHANT_TEMPLATES,
];

const BY_ARCHETYPE = new Map<Archetype, Template[]>();
for (const t of ALL) {
  const list = BY_ARCHETYPE.get(t.archetype) ?? [];
  list.push(t);
  BY_ARCHETYPE.set(t.archetype, list);
}

export function templateCount(): number {
  return ALL.length;
}

function has(e: FootballEvent, keys?: string[]): boolean {
  if (!keys) return true;
  return keys.every((k) => {
    const v = e.facts[k];
    return v !== undefined && v !== null && v !== "";
  });
}

/**
 * Pick the line.
 *
 * The fallback chain is the thing that stops a missing combination being a
 * blank post: an exact event match if one exists, otherwise a template that
 * matches on a tag, otherwise the archetype's generic. Every archetype carries
 * at least one generic that requires nothing, so the chain always terminates.
 */
export function chooseTemplate(
  event: FootballEvent,
  archetype: Archetype,
  frame: Frame,
  memory: StoryMemory,
  rng: () => number,
  wantThread: boolean,
  /**
   * Lines already used in THIS cycle.
   *
   * Without it, two stat accounts reacting to the same run both wrote "Arsenal:
   * 6 matches unbeaten", both broadsheets wrote the identical fallback sentence,
   * and two supporters posted "2-2. on to the next one" one after the other. It
   * read exactly like what it was — one writer with several names.
   */
  usedThisCycle: Set<string> = new Set(),
): Template | null {
  const pool = BY_ARCHETYPE.get(archetype) ?? [];

  const usable = pool.filter(t =>
    has(event, t.requires)
    && !(t.excludes ?? []).some(k => event.facts[k] !== undefined)
    && (!t.frames || t.frames.includes(frame))
    && (!wantThread || !!t.threadBody || t.id.endsWith("-generic"))
    && (t.club === undefined || event.facts.club === t.club)
    && (t.score === undefined || event.facts.score === t.score)
    && (t.player === undefined || event.facts.scorer === t.player)
    && (t.result === undefined || event.facts.result === t.result));

  const exact = usable.filter(t => t.events?.includes(event.id));
  const tagged = usable.filter(t => !t.events && t.tags?.some(tag => event.tags.includes(tag)));
  const generic = usable.filter(t => !t.events && !t.tags);

  for (const tier of [exact, tagged, generic]) {
    if (!tier.length) continue;
    // Nothing said twice in one cycle, ever — that is two accounts posting the
    // same sentence a minute apart, which is the single most obvious tell.
    const unused = tier.filter(t => !usedThisCycle.has(t.id));
    if (!unused.length) continue;
    // Then prefer something that has not been said in the last forty posts, but
    // never at the cost of returning nothing — a repeated line beats a hole.
    const fresh = unused.filter(t => !memory.saidRecently.includes(t.id));
    return pickWeighted(fresh.length ? fresh : unused, rng);
  }

  // Nothing at all for this archetype and frame. The caller drops the post
  // rather than inventing one, which is the right failure: a feed with one
  // fewer post is invisible; a feed with a broken sentence in it is not.
  return null;
}
