/**
 * THE UNLOCK CHAIN — a new career opens one thing at a time.
 *
 * Harry, 1 Oct 2026 (P13, P14, P18-P25, P33, P35, P37-P40): a friend who
 * tried the game "came in and there's just a lot of information". So a NEW
 * career starts with Home and Training open and everything else locked:
 *
 *   1. Home: a short pointer tutorial (skippable) — Home, your player, star
 *      rating, energy, then "Go to training", which you press (v0.23: hands
 *      pointing at the real screen, components/star/PointerTour.tsx).
 *   2. Training: finish 2 drills → League (with Stats and Play) unlocks.
 *   3. Open the League once → the first achievement pops ("Complete your
 *      first two training sessions"); Achievements takes the League button's
 *      place on the bottom bar. The Shop opens after your FIRST GAME (Harry,
 *      P70: "you have to play a game first and then come back. You unlock
 *      the shop").
 *   4. Achievement "Have a meeting with your boss" → Relations unlocks.
 *   5. Style (Lifestyle): only the phone to start; everything else unlocks at
 *      a star rating. Buying the phone → back Home, "Buy a phone" achievement
 *      → the Phone button unlocks.
 *   6. The phone starts with League, Settings and the dock apps, plus an App
 *      Store for the rest.
 *
 * A save from before this (no `unlocks`) has everything open — nothing here
 * ever locks an existing career.
 */
import type { CareerState, CareerUnlocks } from "./types";
import { LIFESTYLE_ITEMS } from "./shopData";

export type Feature = "league" | "stats" | "play" | "shop" | "achievements" | "relations" | "phone";

/** How many drills open the League. */
export const DRILLS_TO_UNLOCK = 2;

/** The achievements the chain hands out (shown on the Achievements screen,
 *  above the usual list). */
export const UNLOCK_ACHIEVEMENTS = [
  { id: "first-two-sessions", label: "First Two Sessions", description: "Complete your first two training sessions" },
  { id: "boss-meeting", label: "Face to Face", description: "Have a meeting with your boss" },
  { id: "buy-phone", label: "Connected", description: "Buy a phone" },
] as const;

/** One line under a locked button: how to open it. */
export const LOCK_HINT: Record<Feature, string> = {
  league: "Finish 2 training drills",
  stats: "Finish 2 training drills",
  play: "Finish 2 training drills",
  shop: "Play your first game",
  achievements: "Open the League once",
  relations: "Achievement: have a meeting with your boss",
  phone: "Find out more in the future",
};

/** A new career's starting state. `points` = star points right now. */
export function freshUnlocks(points = 0): CareerUnlocks {
  return { open: [], seen: [], drills: 0, pointsAtStart: points, apps: [] };
}

export function isOpen(c: Pick<CareerState, "unlocks">, f: Feature): boolean {
  return !c.unlocks || c.unlocks.open.includes(f);
}

/** Is the chain still running (a new career with something still locked)? */
export function inChain(c: Pick<CareerState, "unlocks">): boolean {
  return !!c.unlocks;
}

export function hasSeen(c: Pick<CareerState, "unlocks">, key: string): boolean {
  return !c.unlocks || c.unlocks.seen.includes(key);
}

function withU(c: CareerState, u: CareerUnlocks): CareerState {
  return { ...c, unlocks: u };
}

function addTo(list: string[], ...items: string[]): string[] {
  const out = [...list];
  for (const i of items) if (!out.includes(i)) out.push(i);
  return out;
}

function grant(c: CareerState, id: string): string[] {
  return c.achievements.includes(id) ? c.achievements : [...c.achievements, id];
}

export function markSeen(c: CareerState, key: string): CareerState {
  if (!c.unlocks || c.unlocks.seen.includes(key)) return c;
  return withU(c, { ...c.unlocks, seen: addTo(c.unlocks.seen, key) });
}

/** A training drill finished. The second one opens League, Stats and Play. */
/** `pointsBefore`: star points before this drill — kept from the first one,
 *  so the message can say how much training added. */
export function recordDrill(c: CareerState, pointsBefore?: number, starsBefore?: number): CareerState {
  if (!c.unlocks) return c;
  const drills = c.unlocks.drills + 1;
  const open = drills >= DRILLS_TO_UNLOCK ? addTo(c.unlocks.open, "league", "stats", "play") : c.unlocks.open;
  const pointsAtStart = c.unlocks.drills === 0 && pointsBefore !== undefined ? pointsBefore : c.unlocks.pointsAtStart;
  const starsAtStart = c.unlocks.drills === 0 && starsBefore !== undefined ? starsBefore : c.unlocks.starsAtStart;
  return withU(c, { ...c.unlocks, drills, open, pointsAtStart, starsAtStart });
}

/** Just finished the drill that opened the League (show the message once). */
export function drillMessageDue(c: CareerState): boolean {
  return !!c.unlocks && c.unlocks.drills >= DRILLS_TO_UNLOCK && !c.unlocks.seen.includes("drills-msg");
}

/** The League was opened. The first time, Achievements opens and the first
 *  achievement is handed out. */
export function recordLeagueVisit(c: CareerState): CareerState {
  if (!c.unlocks || !isOpen(c, "league") || c.unlocks.open.includes("achievements")) return c;
  return {
    ...withU(c, { ...c.unlocks, open: addTo(c.unlocks.open, "achievements") }),
    achievements: grant(c, "first-two-sessions"),
  };
}

/** The first game was played: the Shop opens (and with it, the phone). */
export function recordFirstMatch(c: CareerState): CareerState {
  if (!c.unlocks || c.unlocks.open.includes("shop")) return c;
  return withU(c, { ...c.unlocks, open: addTo(c.unlocks.open, "shop") });
}

/** A boss meeting was played (won or lost — he asked for a meeting, not a win). */
export function recordBossMeeting(c: CareerState): CareerState {
  if (!c.unlocks || c.unlocks.open.includes("relations")) return c;
  return {
    ...withU(c, { ...c.unlocks, open: addTo(c.unlocks.open, "relations") }),
    achievements: grant(c, "boss-meeting"),
  };
}

/** The phone was bought in Style. */
export function recordPhoneBought(c: CareerState): CareerState {
  if (!c.unlocks || c.unlocks.open.includes("phone")) return c;
  return {
    ...withU(c, { ...c.unlocks, open: addTo(c.unlocks.open, "phone") }),
    achievements: grant(c, "buy-phone"),
  };
}

// ── Style (Lifestyle) items: locked by star rating ──────────────────────────

/** Harry's numbers (P37): "level four, level six, level eight, level ten ...
 *  the more expensive ones level fifteen, level thirty". Read as star rating
 *  levels on the 1-100 scale. The phone is always open. Banded by how much
 *  the item is worth (`lifestyleValue`, lib/star/shopDefaults.ts). */
export function styleUnlockStar(base: string, lifestyleValue: number = valueOf(base)): number {
  if (base === "phone") return 0;
  if (lifestyleValue <= 5) return 4;
  if (lifestyleValue <= 10) return 6;
  if (lifestyleValue <= 20) return 8;
  if (lifestyleValue <= 45) return 10;
  if (lifestyleValue <= 100) return 15;
  return 30;
}

function valueOf(base: string): number {
  return LIFESTYLE_ITEMS.find((i) => i.id === base)?.lifestyleValue ?? 0;
}

/** The star rating needed for this item, or null when it is open. */
export function styleLock(c: Pick<CareerState, "unlocks">, base: string, stars: number): number | null {
  if (!c.unlocks) return null;
  const need = styleUnlockStar(base);
  return stars >= need ? null : need;
}

// ── The phone ──────────────────────────────────────────────────────────────

/** On the phone from the start (P39: "league and settings to start, plus
 *  your messages ... kickabout, social"). */
export const STARTER_APPS = ["league", "settings", "social", "kickabout", "fixtures", "messages"];

/** In the App Store, to install. Apps are shortcuts, so they cost real money
 *  (Harry, 1 Oct 2026, P71: "paying to get these apps. These are essentially
 *  shortcuts for the player. So I think it should be quite a bit of money").
 *  The price is in coins; ★650 is the first pair of boots, so an app is a real
 *  purchase, not a tap. */
export const APP_STORE: { id: string; label: string; icon: string; note: string; price: number }[] = [
  { id: "achievements", label: "Awards", icon: "⭐", note: "Achievements and records", price: 1000 },
  { id: "store", label: "Store", icon: "🛒", note: "Daily specials and Coins", price: 1500 },
  { id: "shop-kib", label: "Shop", icon: "🛍️", note: "Cans, boots and style", price: 2000 },
  { id: "sponsors", label: "Sponsors", icon: "🤝", note: "Deals and offers", price: 2500 },
  { id: "casino-menu", label: "Casino", icon: "🎰", note: "Slots, cards, racing", price: 3500 },
  { id: "garden", label: "Garden", icon: "🌳", note: "Your garden and horse", price: 5000 },
  { id: "ownership", label: "Owner", icon: "🏛️", note: "Buy into clubs", price: 15000 },
];

export function appInstalled(c: Pick<CareerState, "unlocks">, id: string): boolean {
  if (!c.unlocks) return true;
  return STARTER_APPS.includes(id) || c.unlocks.apps.includes(id);
}

/** Pays for an app and puts it on the phone. Not enough money: nothing happens. */
export function installApp(c: CareerState, id: string): CareerState {
  if (!c.unlocks || c.unlocks.apps.includes(id)) return c;
  const price = APP_STORE.find((a) => a.id === id)?.price ?? 0;
  if (c.money < price) return c;
  return { ...withU(c, { ...c.unlocks, apps: [...c.unlocks.apps, id] }), money: c.money - price };
}
