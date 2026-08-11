import type { FootballEvent, MatchRecord, StoryMemory } from "./types";
import { timesSeen } from "./memory";

/**
 * HOW BIG A DEAL IS THIS, HERE?
 *
 * Detection asks "did it happen". This asks "does anybody care", and the answer
 * is contextual in ways a detector cannot see. The same hat-trick is the story
 * of the weekend in a title decider and a footnote in a 6-0 against the bottom
 * club, and a media world that treats them the same is a media world nobody
 * believes.
 *
 * Multiplicative rather than additive on purpose: the factors compound. A late
 * winner in a derby in a title race should not be "a bit more important than a
 * late winner" — it should be the only thing anybody talks about.
 */

const COMPETITION_WEIGHT: Record<string, number> = {
  league: 1.0,
  cup: 1.12,
  europe: 1.28,
  international: 1.2,
};

export function scoreMatchEvents(
  events: FootballEvent[],
  r: MatchRecord,
  m: StoryMemory,
): FootballEvent[] {
  return events.map((e) => {
    let w = COMPETITION_WEIGHT[r.kind] ?? 1;

    if (r.round === "Final") w *= 1.45;
    else if (r.round === "Semi-Final") w *= 1.2;

    if (r.derby) w *= 1.35;

    // The stakes. Both ends of the table count, and they count more the fewer
    // matches are left to fix it.
    if (r.kind === "league" && r.table.matchesLeft <= 10) {
      const tight = Math.abs(r.table.leaderGap) <= 6 && r.table.after.position <= 4;
      const scrap = r.table.relegationGap <= 5 && r.table.after.position >= r.table.clubs - 5;
      if (tight || scrap) w *= 1 + (10 - r.table.matchesLeft) * 0.045;
    }

    // Late drama.
    const minute = Number(e.facts.minute ?? 0);
    if (minute >= 88) w *= 1.3;
    else if (minute >= 80) w *= 1.12;

    w *= rarity(e, m);
    w *= fameWeight(e, r.context.fame, r.context.starRating);

    return { ...e, importance: clamp(Math.round(e.baseImportance * w)) };
  });
}

export function scoreCareerEvents(events: FootballEvent[], m: StoryMemory, fame: number): FootballEvent[] {
  return events.map(e => ({
    ...e,
    importance: clamp(Math.round(e.baseImportance * rarity(e, m) * (0.85 + Math.min(1, fame / 120) * 0.35))),
  }));
}

/**
 * The fifth is not the first.
 *
 * This is the single most important number in the engine for making a long
 * career feel different from a short one. Your first hat-trick should stop the
 * bulletin. Your ninth should be a line on a stat page, because that is what
 * happens to real players, and the alternative is a media world that shouts
 * identically at season one and season fifteen.
 *
 * Milestones and trophies are exempt — a hundredth goal is rarer the more of
 * them you have, not less.
 */
const NEVER_STALE = new Set([
  "goal-milestone", "assist-milestone", "appearance-milestone", "club-appearance-milestone",
  "trophy", "champions", "relegated", "ballon-dor", "retirement", "transfer-done",
  "into-the-final", "lost-the-final", "award-won",
]);

function rarity(e: FootballEvent, m: StoryMemory): number {
  if (NEVER_STALE.has(e.id)) return 1;
  const n = timesSeen(m, e.id);
  if (n === 0) return 1.45;
  if (n === 1) return 1.2;
  if (n <= 3) return 1.0;
  if (n <= 8) return 0.9;
  if (n <= 20) return 0.82;
  return 0.74;
}

/**
 * Nobody outside the ground is writing about a squad player's 6.9.
 *
 * Fame scales what the WORLD notices, not what happened. It is deliberately
 * gentle at the top — a famous player's quiet afternoon is still news — and
 * unforgiving at the bottom, because that is the thing that makes becoming
 * famous feel like it did something.
 */
function fameWeight(e: FootballEvent, fame: number, stars: number): number {
  const standing = Math.min(1, (fame / 140) * 0.6 + (stars / 5) * 0.4);
  const personal = e.subject.kind === "you" || e.subject.kind === "teammate";
  if (!personal) return 0.95 + standing * 0.15;
  return 0.62 + standing * 0.5;
}

function clamp(v: number): number {
  return Math.max(1, Math.min(100, v));
}

/** The one event that defines the cycle. Drives the breaking-news threshold. */
export function headlineEvent(events: FootballEvent[]): FootballEvent | undefined {
  return [...events].sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0))[0];
}
