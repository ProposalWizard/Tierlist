/**
 * "NEEDS YOU" (navigation round 1, 21 Oct 2026; docs/research/2026-10-21-navigation.md §4.4).
 *
 * What is waiting for the player, most urgent first, from sources the game
 * already has. Two uses:
 *   - `needsYou(i)`  the ordered list; Home shows the first as one chip.
 *   - `barBadges(i)` a count or a dot on each bottom-bar button.
 *
 * Pure: page.tsx gathers the inputs (`needsInput` does it from a career) and
 * hands the answers to HomeHub and DashboardShell. Counts, not words; no
 * exact amounts (30 Sep 2026 ruling). A badge clears when the thing is done
 * or read, because its source clears.
 *
 * Not here, on purpose:
 *   - A contract offer never waits on Home: the club's offer opens by itself
 *     straight after the match (careerFlow checkForContractOffer). Nothing to badge.
 *   - The Star Pass reward keeps its own round "!" on the star bar.
 */
import type { CareerState, Fixture } from "./types";
import { brandsOf } from "./sponsorDeals";
import { trainingLeft } from "./week";
import { managerTalkDue, isOpen } from "./unlocks";
import { fixtureTimestamp } from "./calendar";

export type NeedId = "season-end" | "boss-talk" | "sponsor-offers" | "training" | "phone" | "match-today";

export interface Need {
  id: NeedId;
  /** Short, on the chip. */
  label: string;
  icon: string;
  /** A number shown on the chip, when the thing is countable. */
  count?: number;
}

export interface NeedsInput {
  seasonOver: boolean;
  bossTalkDue: boolean;
  sponsorOffers: number;
  sponsorsOpen: boolean;
  trainingLeft: number;
  trainingOpen: boolean;
  phoneUnread: number;
  phoneOpen: boolean;
  /** Days to the next match (0 = today); null with no match ahead. */
  matchInDays: number | null;
  playOpen: boolean;
}

/** Everything waiting, most urgent first (§4.4's order). */
export function needsYou(i: NeedsInput): Need[] {
  const out: Need[] = [];
  if (i.seasonOver) out.push({ id: "season-end", label: "End of Season", icon: "🏆" });
  if (i.bossTalkDue) out.push({ id: "boss-talk", label: "Boss wants a word", icon: "🗣️" });
  if (i.sponsorsOpen && i.sponsorOffers > 0) out.push({ id: "sponsor-offers", label: i.sponsorOffers === 1 ? "Sponsor offer" : "Sponsor offers", icon: "🤝", count: i.sponsorOffers });
  if (!i.seasonOver && i.trainingOpen && i.trainingLeft > 0) out.push({ id: "training", label: "Training left", icon: "⚡", count: i.trainingLeft });
  if (i.phoneOpen && i.phoneUnread > 0) out.push({ id: "phone", label: "On your phone", icon: "📱", count: i.phoneUnread });
  if (i.playOpen && i.matchInDays !== null && i.matchInDays <= 0) out.push({ id: "match-today", label: "Match today", icon: "⚽" });
  return out;
}

export interface BarBadges {
  /** Training: sessions left this week. */
  skills?: number;
  /** Relations: the boss wants a word. */
  life?: "dot";
  /** Phone: unread messages, social and sponsor offers. */
  media?: number;
  /** Play: a match today (a stronger pulse). */
  play?: boolean;
}

export function barBadges(i: NeedsInput): BarBadges {
  const b: BarBadges = {};
  if (!i.seasonOver && i.trainingOpen && i.trainingLeft > 0) b.skills = i.trainingLeft;
  if (i.bossTalkDue) b.life = "dot";
  if (i.phoneOpen && i.phoneUnread > 0) b.media = i.phoneUnread;
  if (i.playOpen && i.matchInDays !== null && i.matchInDays <= 0) b.play = true;
  return b;
}

/**
 * TRANSFERS HAVE NO DOOR, ON PURPOSE (CLAUDE.md, 18 Oct 2026: only the summer
 * window, at the season's end). Harry's answer 18 (21 Oct 2026): say when it
 * opens instead — "Transfer window opens in N weeks" on Home.
 *
 * Weeks from "today" (the day after your last match, as Home's countdown
 * counts it) to your last fixture of the season, rounded up. 0 = this week.
 * Null when the season's fixtures are all played (the End of Season chip
 * leads there) or there are none.
 */
export function transferWindowWeeks(career: Pick<CareerState, "fixtures" | "player" | "season">, division: Parameters<typeof fixtureTimestamp>[4]): number | null {
  const left = career.fixtures.filter((f) => !f.played);
  if (left.length === 0) return null;
  const ts = (f: Fixture) => fixtureTimestamp(career.player.startYear, career.season, f.week, f.kind, division);
  const last = Math.max(...left.map(ts));
  const played = career.fixtures.filter((f) => f.played).map(ts);
  const firstLeft = Math.min(...left.map(ts));
  const today = played.length ? Math.max(...played) + DAY : firstLeft - 5 * DAY;
  return Math.max(0, Math.ceil((last - today) / (7 * DAY)));
}
const DAY = 86400000;

/** The Home line for it, or null. */
export function transferWindowLine(weeks: number | null): string | null {
  if (weeks === null) return null;
  if (weeks === 0) return "Transfer window opens this week";
  return `Transfer window opens in ${weeks} week${weeks === 1 ? "" : "s"}`;
}

/** The inputs, from a career and what page.tsx already knows. */
export function needsInput(career: CareerState, o: { seasonOver: boolean; phoneUnread: number; nextFixture: Fixture | null; daysToNext: (c: CareerState, f: Fixture) => number }): NeedsInput {
  return {
    seasonOver: o.seasonOver,
    bossTalkDue: managerTalkDue(career),
    sponsorOffers: brandsOf(career).offers.length,
    sponsorsOpen: isOpen(career, "sponsors"),
    trainingLeft: trainingLeft(career),
    trainingOpen: isOpen(career, "training"),
    phoneUnread: o.phoneUnread,
    phoneOpen: isOpen(career, "phone"),
    matchInDays: o.nextFixture ? o.daysToNext(career, o.nextFixture) : null,
    playOpen: isOpen(career, "play"),
  };
}
