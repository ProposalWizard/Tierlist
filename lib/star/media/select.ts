import type { FootballEvent, MediaAccount } from "./types";
import { rngFor, shuffle } from "./grammar";

/**
 * WHO REACTS
 *
 * Nobody reacts to everything. A stat page ignores a manager's press
 * conference; a transfer insider ignores a 1-0; a rival's supporters ignore
 * your good afternoons entirely and are waiting for the bad one.
 *
 * This is the stage that makes the feed feel populated rather than broadcast,
 * and it is deliberately the only place in the pipeline where reach matters — a
 * national tabloid genuinely does not write about a 6.8 rating in a goalless
 * draw, however much the tabloid TEMPLATES would enjoy it.
 */

export interface Pairing {
  event: FootballEvent;
  account: MediaAccount;
  score: number;
}

/** How many posts an entire cycle produces, given its biggest moment. */
function budgetFor(topImportance: number): number {
  if (topImportance >= 90) return 22;
  if (topImportance >= 75) return 17;
  if (topImportance >= 55) return 13;
  if (topImportance >= 35) return 9;
  return 6;
}

const MAX_PER_ACCOUNT = 2;
const MAX_PER_EVENT = 4;

export function selectPairings(
  events: FootballEvent[],
  accounts: MediaAccount[],
  cycleId: string,
  yourClub: string,
): Pairing[] {
  const scored: Pairing[] = [];

  for (const e of events) {
    const importance = e.importance ?? e.baseImportance;
    for (const a of accounts) {
      const s = interest(a, e) * allegiance(a, e, yourClub) * reach(a, importance);
      if (s <= 0) continue;
      const rng = rngFor("sel", cycleId, e.id, a.id);
      scored.push({ event: e, account: a, score: s * importance * (0.75 + rng() * 0.5) });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  const top = Math.max(...events.map(e => e.importance ?? e.baseImportance), 0);
  const budget = budgetFor(top);
  const perAccount = new Map<string, number>();
  const perEvent = new Map<string, number>();
  const out: Pairing[] = [];

  for (const p of scored) {
    if (out.length >= budget) break;
    const a = perAccount.get(p.account.id) ?? 0;
    const e = perEvent.get(p.event.id) ?? 0;
    if (a >= MAX_PER_ACCOUNT || e >= MAX_PER_EVENT) continue;
    perAccount.set(p.account.id, a + 1);
    perEvent.set(p.event.id, e + 1);
    out.push(p);
  }

  // Every cycle has at least one post about the match itself, whatever the
  // scoring said. A feed that is empty after a football match is a bug the
  // player experiences as the feature being broken.
  if (out.length === 0 && events.length) {
    const rng = rngFor("fallback", cycleId);
    const clubAcct = accounts.find(a => a.archetype === "club" && a.allegiance?.club === yourClub);
    const any = clubAcct ?? shuffle(accounts, rng)[0];
    if (any) out.push({ event: events[0], account: any, score: 1 });
  }

  return out;
}

function interest(a: MediaAccount, e: FootballEvent): number {
  let best = 0;
  for (const t of e.tags) best = Math.max(best, a.interests[t] ?? 0);
  // Nobody has an opinion on nothing.
  return best;
}

/**
 * Whose side they are on, and what that does to their appetite.
 *
 * A rival account's interest is INVERTED, not reduced: they want the events
 * you would rather not have happened, and they want them badly. That single
 * sign flip is most of what makes them read like rivals.
 */
function allegiance(a: MediaAccount, e: FootballEvent, yourClub: string): number {
  if (!a.allegiance) return 1;
  const aboutYourClub = e.subject.kind !== "opponent";
  const negative = e.tags.includes("shame") || e.tags.includes("relegation")
    || e.id.startsWith("derby-loss") || e.id === "hammered" || e.id === "collapse"
    || e.id === "losing-run" || e.id === "drought" || e.id === "hooked"
    || e.id === "anonymous" || e.id === "knocked-out" || e.id === "lost-top"
    || e.id === "embarrassed" || e.id === "into-the-drop" || e.id === "out-of-form";

  if (a.allegiance.polarity === -1) {
    if (!aboutYourClub) return 0.2;
    return negative ? 1.6 : 0.12;   // they will still sneer at your good day, occasionally
  }
  // A club account only ever talks about its own club.
  if (a.archetype === "club" && a.allegiance.club !== yourClub) return 0;
  return negative ? 0.45 : 1;       // your own do not dwell on the bad ones
}

/**
 * A national outlet does not write about a squad player's Tuesday.
 *
 * Reach is a threshold, not a multiplier: above roughly a million followers an
 * account simply does not bother below a certain importance, and below ten
 * thousand it will post about anything, because that is what a fan account is.
 */
function reach(a: MediaAccount, importance: number): number {
  if (a.followers > 2_000_000) return importance >= 55 ? 1.15 : importance >= 40 ? 0.5 : 0;
  if (a.followers > 500_000) return importance >= 40 ? 1.1 : importance >= 28 ? 0.6 : 0.05;
  if (a.followers > 50_000) return importance >= 25 ? 1 : 0.4;
  return 1;
}
