import type { CareerState } from "./types";
import { mulberry32 } from "./season";
import { leadingScorer } from "./recognition";

/**
 * WHAT THEY ARE SAYING ABOUT YOU
 *
 * The `fans` relationship moved up and down for fifteen seasons and the player
 * never once heard from them. It fed an achievement at 90 and nothing else.
 *
 * This is the cheapest possible fix and it is the right one: a feed, generated
 * entirely from state that already exists, that tells you what your standing
 * actually FEELS like. Nothing here is interactive and nothing here changes a
 * number — it is a mirror, and the point of a mirror is that it cannot lie.
 *
 * The tone follows the relationship, the volume follows fame, and the subjects
 * come from what genuinely just happened. A supporter who adores you says so;
 * one who does not says that instead.
 */

export interface FanPost {
  handle: string;
  text: string;
  /** -1 hostile, 0 neutral, +1 adoring. Drives the colour of the card. */
  mood: number;
}

const HANDLES = [
  "@terrace_tom", "@northbank_nia", "@ninetyminutes", "@ClaretAndBlue", "@matchday_mo",
  "@stand_side", "@thekop_ken", "@awaydays_al", "@programme_pat", "@halfway_line",
];

const ADORING = [
  "best thing to happen to this club in years",
  "getting the name on the back of the shirt this week",
  "whatever they're paying him it isn't enough",
  "would walk to an away game in the rain for him",
  "my lad has him on his wall",
];

const WARM = [
  "quietly having a good season you know",
  "does the ugly stuff nobody claps",
  "grew into that one",
  "solid. no complaints from me",
];

const COOL = [
  "not seen enough of him lately",
  "needs to do more in the big games",
  "jury's still out for me",
  "wants it more than that, surely",
];

const HOSTILE = [
  "wages we're paying for that",
  "hiding out there again",
  "time to move him on",
  "wouldn't get in the side I grew up watching",
];

/**
 * The feed.
 *
 * Seeded off the week so it is stable while you are looking at it and different
 * next time. Deliberately short — a wall of generated text reads as filler, and
 * five posts read as a room.
 */
export function fanFeed(career: CareerState, count = 5): FanPost[] {
  const rng = mulberry32(career.season * 977 + career.week * 43 + Math.round(career.relationships.fans));
  const fans = career.relationships.fans;
  const out: FanPost[] = [];

  // The things worth talking about, in the order a supporter would raise them.
  const topics: FanPost[] = [];
  const lastAward = (career.awards ?? [])[(career.awards ?? []).length - 1];
  if (lastAward) {
    topics.push({ handle: HANDLES[0], text: `${lastAward.kind}. deserved every bit of it 👏`, mood: 1 });
  }
  if (career.captain) {
    topics.push({ handle: HANDLES[1], text: "proper captain. leads by doing it, not shouting about it", mood: 1 });
  }
  if (leadingScorer(career) && career.seasonStats.goals >= 5) {
    topics.push({ handle: HANDLES[2], text: `top of the scoring charts and it's not close`, mood: 1 });
  }
  const form = career.form.length ? career.form.reduce((s, r) => s + r, 0) / career.form.length : 6.5;
  if (career.form.length >= 3 && form < 6.2) {
    topics.push({ handle: HANDLES[3], text: "something's not right with him at the minute", mood: -1 });
  }
  if ((career.transfers ?? []).length > 0 && career.clubAppearances !== undefined && career.clubAppearances < 6) {
    topics.push({ handle: HANDLES[4], text: "still making my mind up on the new signing", mood: 0 });
  }
  if (career.managerNews) {
    topics.push({ handle: HANDLES[5], text: "new gaffer. here we go again", mood: 0 });
  }

  // Whatever the feed is actually about goes first, then the general mood.
  for (const t of topics) {
    if (out.length >= count) break;
    out.push(t);
  }

  const pool = fans >= 78 ? ADORING : fans >= 58 ? WARM : fans >= 34 ? COOL : HOSTILE;
  const mood = fans >= 78 ? 1 : fans >= 58 ? 1 : fans >= 34 ? 0 : -1;
  const used = new Set(out.map(p => p.handle));

  while (out.length < count) {
    const handle = HANDLES[Math.floor(rng() * HANDLES.length)];
    if (used.has(handle)) { used.add(handle + out.length); }
    out.push({
      handle: used.has(handle) ? `${handle}_${out.length}` : handle,
      text: pool[Math.floor(rng() * pool.length)],
      mood,
    });
    used.add(handle);
  }

  return out.slice(0, count);
}

/** One line summing the room up, for the header. */
export function fanMood(career: CareerState): string {
  const f = career.relationships.fans;
  if (f >= 88) return "They sing your name.";
  if (f >= 72) return "The ground is behind you.";
  if (f >= 52) return "They think you're doing all right.";
  if (f >= 32) return "They want to see more.";
  return "They have turned.";
}
