/**
 * BACK GOES BACK (navigation round 1, 21 Oct 2026; docs/research/2026-10-21-navigation.md §4.5 rule 1).
 *
 * A screen opened from the Phone, Relations, Stats, the Shop's rail or the
 * gear remembers where it was opened from. Its Back returns there, not Home.
 * Phone → Owner → Back lands on the Phone.
 *
 * Pure: page.tsx keeps the stack in a ref and asks these functions what to do.
 *
 *   let s = openFrom([], { phase: "media", nav: "media" }, "ownership");
 *   const { spot, rest } = backFrom(s, "ownership");   // spot = the Phone
 *   backFrom(s, "league").spot                         // null: go Home as before
 */
import type { StarPhase } from "./types";

/** Where you were: enough to put the screen back exactly. */
export interface NavSpot {
  phase: StarPhase;
  /** The lit bottom-bar button (DashboardShell's NavTab). */
  nav?: string | null;
  /** The swipe page (0 Stats, 1 Home, 2 Shop). */
  homePage?: 0 | 1 | 2;
  /** Training or Relations, on the "skills" phase. */
  trainingTab?: "training" | "life";
}

export interface NavEntry {
  /** Where Back goes. */
  spot: NavSpot;
  /** The screens this entry covers: Back from any of them returns to `spot`. */
  family: StarPhase[];
}

/** A screen and the screens inside it that share one way out. */
const FAMILIES: StarPhase[][] = [
  ["shop-kib", "shop-boots", "shop-lifestyle"],
  ["casino-menu", "casino-3d"],
  ["sponsors", "sponsor-negotiation"],
  ["ownership", "reputation", "rule-book", "investments"],
  ["settings", "face-editor", "fake-face-editor"],
];

/** The family a phase belongs to (itself alone when it has none). */
export function familyOf(phase: StarPhase): StarPhase[] {
  return FAMILIES.find((f) => f.includes(phase)) ?? [phase];
}

/** The bar's own screens: arriving on one by any route empties the stack. */
export const ROOT_PHASES: StarPhase[] = ["dashboard", "skills", "media"];

/** Opening `to` from `from`: push the way back. Never stacks a screen onto itself. */
export function openFrom(stack: NavEntry[], from: NavSpot, to: StarPhase): NavEntry[] {
  const family = familyOf(to);
  if (family.includes(from.phase)) return stack;
  // Opening the same screen again from somewhere else: the newer way back wins.
  const kept = stack.filter((e) => !e.family.includes(to));
  return [...kept, { spot: from, family }];
}

/**
 * Back from `current`. Returns the spot to restore (null = Home, as before)
 * and the stack after it. An entry for another screen is stale (you left by
 * some other road) and is dropped.
 */
export function backFrom(stack: NavEntry[], current: StarPhase): { spot: NavSpot | null; rest: NavEntry[] } {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i].family.includes(current)) return { spot: stack[i].spot, rest: stack.slice(0, i) };
  }
  return { spot: null, rest: [] };
}
