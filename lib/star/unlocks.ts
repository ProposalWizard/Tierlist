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
 *   4. The first game also opens Relations (v0.24, Harry 2 Oct 2026, P1-44:
 *      "after your third game … the relationship pops up because your
 *      manager wants to talk to you" — game 1 for now). The first-steps list
 *      then asks for a meeting with your boss.
 *   5. Style (Lifestyle): only the phone to start; everything else unlocks at
 *      a star rating. Buying the phone → back Home, "Buy a phone" achievement
 *      → the Phone button unlocks.
 *   6. The phone starts with League, Settings and the dock apps, plus an App
 *      Store for the rest.
 *
 * A save from before this (no `unlocks`) has everything open — nothing here
 * ever locks an existing career.
 *
 * ── v0.25: THE GAME COMES FIRST (Harry and Mikey, 2 Oct 2026, played live) ──
 * A career started from v0.25 (`unlocks.gameFirst`) runs in this order:
 *
 *   1. Home: the welcome tour (it explains energy, and the three match
 *      modes), then "You've got a game today — Play". League, Stats and Play
 *      are open from the start. Training is locked.
 *   2. The first game opens Training and Achievements (announced).
 *   3. "Your manager wants a word": tapping Relations goes straight into the
 *      manager's talk, and the talk is what opens Relations (announced).
 *   4. Training: two drills, with its tutorial.
 *   5. The Shop opens after two drills or three games, whichever comes first
 *      (announced). Then the phone (the step says what it costs and how much
 *      you still need when you cannot afford it yet).
 *   6. Sponsors open with your first sponsor offer.
 *
 * A save part-way through the v0.24 order (no `gameFirst`) keeps that order.
 */
import type { CareerState, CareerUnlocks } from "./types";
import { LIFESTYLE_ITEMS, LIFESTYLE_ALL_LEVELS } from "./shopData";

export type Feature = "league" | "stats" | "play" | "shop" | "achievements" | "relations" | "phone" | "sponsors" | "training";

/** v0.25: a career on the game-first order. */
export function gameFirst(c: Pick<CareerState, "unlocks">): boolean {
  return !!c.unlocks?.gameFirst;
}

/** v0.25: the Shop opens after this many games (or two drills, if sooner). */
export const SHOP_AFTER_GAMES = 3;

/**
 * SPONSORS OPEN WITH YOUR FIRST OFFER (v0.25, review of v0.24, points 36 and
 * 53). v0.24 opened them after 10 games. Mikey: "don't set it to a certain
 * amount of games … whenever your first sponsor happens, it should then do
 * the unveil, and it should all be locked until then." Offers come from form
 * and fame (sponsorDeals.ts, offerChance): nothing while you play badly, and
 * the small brands need no fame at all. Pay is a share of your wage, so a
 * National League South deal pays very little.
 */
export function hasSponsorOffer(c: Pick<CareerState, "brands">): boolean {
  return (c.brands?.offers.length ?? 0) > 0 || (c.brands?.deals.length ?? 0) > 0;
}

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
  shop: "Finish 2 training drills, or play 3 games",
  achievements: "Play your first game",
  relations: "Talk to your manager after your first game",
  phone: "Buy a phone in Style",
  sponsors: "Play well and a brand will get in touch",
  training: "Play your first game",
};

/** What each feature is, in one line — said when it unlocks (v0.24, Harry:
 *  "the moment ANY feature unlocks … it is announced"). */
export const FEATURE_INFO: Record<Feature, { name: string; icon: string; line: string }> = {
  league: { name: "League", icon: "🏆", line: "The table, results and fixtures" },
  stats: { name: "Stats", icon: "📊", line: "Your numbers and records" },
  play: { name: "Play", icon: "▶️", line: "Play your matches" },
  shop: { name: "Shop", icon: "🛍️", line: "Energy cans, boots and style" },
  achievements: { name: "Achievements", icon: "⭐", line: "Your first steps and everything you earn" },
  relations: { name: "Relations", icon: "❤️", line: "Your boss, your team-mates and the fans" },
  phone: { name: "Phone", icon: "📱", line: "Messages, social media and an App Store" },
  sponsors: { name: "Sponsors", icon: "🤝", line: "Brands pay you every week to wear their name" },
  training: { name: "Training", icon: "⚽", line: "Drills make your skills better" },
};

/** A new career's starting state. `points` = star points right now. */
export function freshUnlocks(points = 0): CareerUnlocks {
  // v0.25: the game comes first — League, Stats and Play are open at once.
  return { open: ["league", "stats", "play"], seen: [], drills: 0, pointsAtStart: points, apps: [], gameFirst: true };
}

export function isOpen(c: Pick<CareerState, "unlocks">, f: Feature): boolean {
  if (!c.unlocks) return true;
  // Training was never locked before v0.25.
  if (f === "training" && !c.unlocks.gameFirst) return true;
  return c.unlocks.open.includes(f);
}

/** Games played so far: appearances, or played fixtures if you watched one. */
export function gamesPlayed(c: Pick<CareerState, "careerStats" | "fixtures">): number {
  return Math.max(c.careerStats?.appearances ?? 0, (c.fixtures ?? []).filter((f) => f.played).length);
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

/** Opens features and queues the new ones to be announced (v0.24). Only the
 *  ones in `announce` are queued: League and Achievements, Stats and Play
 *  already have their own moments (the League pointer, the first-steps pop). */
function openFeatures(u: CareerUnlocks, features: Feature[], announce: Feature[] = []): CareerUnlocks {
  const fresh = features.filter((f) => !u.open.includes(f));
  if (fresh.length === 0) return u;
  const queue = fresh.filter((f) => announce.includes(f));
  return {
    ...u,
    open: addTo(u.open, ...fresh),
    ...(queue.length ? { announce: addTo(u.announce ?? [], ...queue) } : {}),
  };
}

function grant(c: CareerState, id: string): string[] {
  return c.achievements.includes(id) ? c.achievements : [...c.achievements, id];
}

export function markSeen(c: CareerState, key: string): CareerState {
  if (!c.unlocks || c.unlocks.seen.includes(key)) return c;
  return withU(c, { ...c.unlocks, seen: addTo(c.unlocks.seen, key) });
}

/** A training drill finished. The second one opens League, Stats and Play
 *  (v0.24 order), or the Shop with the first-steps achievement (v0.25). */
/** `pointsBefore`: star points before this drill — kept from the first one,
 *  so the message can say how much training added. */
export function recordDrill(c: CareerState, pointsBefore?: number, starsBefore?: number): CareerState {
  if (!c.unlocks) return c;
  const drills = c.unlocks.drills + 1;
  const pointsAtStart = c.unlocks.drills === 0 && pointsBefore !== undefined ? pointsBefore : c.unlocks.pointsAtStart;
  const starsAtStart = c.unlocks.drills === 0 && starsBefore !== undefined ? starsBefore : c.unlocks.starsAtStart;
  if (c.unlocks.gameFirst) {
    let u: CareerUnlocks = { ...c.unlocks, drills, pointsAtStart, starsAtStart };
    if (drills >= DRILLS_TO_UNLOCK) u = openFeatures(u, ["shop"], ["shop"]);
    return { ...withU(c, u), achievements: drills >= DRILLS_TO_UNLOCK ? grant(c, "first-two-sessions") : c.achievements };
  }
  const open = drills >= DRILLS_TO_UNLOCK ? addTo(c.unlocks.open, "league", "stats", "play") : c.unlocks.open;
  return withU(c, { ...c.unlocks, drills, open, pointsAtStart, starsAtStart });
}

/** Just finished the drill that opened the League (show the message once). */
export function drillMessageDue(c: CareerState): boolean {
  return !!c.unlocks && !c.unlocks.gameFirst && c.unlocks.drills >= DRILLS_TO_UNLOCK && !c.unlocks.seen.includes("drills-msg");
}

/** The League was opened. The first time, Achievements opens and the first
 *  achievement is handed out. */
export function recordLeagueVisit(c: CareerState): CareerState {
  // v0.25: the first game opens Achievements, not the League.
  if (!c.unlocks || c.unlocks.gameFirst || !isOpen(c, "league") || c.unlocks.open.includes("achievements")) return c;
  return {
    ...withU(c, { ...c.unlocks, open: addTo(c.unlocks.open, "achievements") }),
    achievements: grant(c, "first-two-sessions"),
  };
}

/** A game was played. Call it after every match.
 *  v0.25 order: the first opens Training and Achievements; the third opens the
 *  Shop if two drills have not already. Relations waits for the manager's talk.
 *  v0.24 order: the first opens the Shop and Relations.
 *  Either way, your first sponsor offer opens Sponsors. All announced. */
export function recordMatchPlayed(c: CareerState): CareerState {
  if (!c.unlocks) return c;
  const games = gamesPlayed(c);
  let u = c.unlocks;
  if (u.gameFirst) {
    if (games >= 1) u = openFeatures(u, ["training", "achievements"], ["training", "achievements"]);
    if (games >= SHOP_AFTER_GAMES) u = openFeatures(u, ["shop"], ["shop"]);
  } else if (games >= 1 || u.open.includes("shop")) u = openFeatures(u, ["relations", "shop"], ["relations", "shop"]);
  if (hasSponsorOffer(c)) u = openFeatures(u, ["sponsors"], ["sponsors"]);
  return u === c.unlocks ? c : withU(c, u);
}

/** The first game (kept for older callers): the same as recordMatchPlayed,
 *  and it opens the first game's features even when no appearance was counted. */
export function recordFirstMatch(c: CareerState): CareerState {
  if (!c.unlocks) return c;
  const u = c.unlocks.gameFirst
    ? openFeatures(c.unlocks, ["training", "achievements"], ["training", "achievements"])
    : openFeatures(c.unlocks, ["relations", "shop"], ["relations", "shop"]);
  const after = u === c.unlocks ? c : withU(c, u);
  return recordMatchPlayed(after);
}

/** v0.25: the manager's talk is due — the first game is played and the talk
 *  is not done. Tapping Relations goes straight into it. */
export function managerTalkDue(c: Pick<CareerState, "unlocks" | "achievements" | "careerStats" | "fixtures">): boolean {
  return !!c.unlocks?.gameFirst && gamesPlayed(c) >= 1 && !c.achievements.includes("boss-meeting");
}

/** A boss meeting was played (won or lost — he asked for a meeting, not a
 *  win). Hands out the first-steps achievement; opens Relations if a save
 *  from before v0.24 still has it shut. */
export function recordBossMeeting(c: CareerState): CareerState {
  if (!c.unlocks || c.achievements.includes("boss-meeting")) return c;
  return {
    // v0.25: the talk is what opens Relations, so it is announced.
    ...withU(c, openFeatures(c.unlocks, ["relations"], c.unlocks.gameFirst ? ["relations"] : [])),
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

// ── Announcing an unlock (v0.24) ───────────────────────────────────────────

/** Features opened but not yet announced, in the order they opened. */
export function pendingAnnouncements(c: Pick<CareerState, "unlocks">): Feature[] {
  return (c.unlocks?.announce ?? []) as Feature[];
}

/** The announcement was shown: clear these from the queue. */
export function markAnnounced(c: CareerState, features: Feature[] = pendingAnnouncements(c)): CareerState {
  if (!c.unlocks?.announce?.length) return c;
  const left = c.unlocks.announce.filter((f) => !features.includes(f as Feature));
  return withU(c, { ...c.unlocks, announce: left });
}

// ── The first steps: a story list of achievements (v0.24) ──────────────────
//
// Harry, 2 Oct 2026 (P2-69): "almost like a story mode of achievements. And
// then there's the achievements that just happen naturally." The story is
// these steps, in order; each says what it opens and has a Go button that
// takes you there (UnlockChain.tsx).

export type StepId = "first-two-sessions" | "first-game" | "boss-meeting" | "buy-phone";
export interface FirstStep {
  id: StepId;
  label: string;
  /** What you have to do, as the row says it. */
  todo: string;
  /** The prompt when this is the next step ("Time to meet your boss"). */
  prompt: string;
  /** What it opens. */
  opens: string;
}

export const FIRST_STEPS: FirstStep[] = [
  { id: "first-two-sessions", label: "First Two Sessions", todo: "Complete your first two training sessions", prompt: "Go to training", opens: "Opens the League" },
  { id: "first-game", label: "Debut", todo: "Play your first game", prompt: "Time to play your first game", opens: "Opens Relations and the Shop" },
  { id: "boss-meeting", label: "Face to Face", todo: "Have a meeting with your boss", prompt: "Time to meet your boss", opens: "Your boss picks you more when he likes you" },
  { id: "buy-phone", label: "Connected", todo: "Buy a phone", prompt: "Buy your first phone in the Shop", opens: "Opens the Phone" },
];

/** v0.25 (game first): the same steps in the new order, worded for it. */
export const FIRST_STEPS_GAME_FIRST: FirstStep[] = [
  { id: "first-game", label: "Debut", todo: "Play your first game", prompt: "You've got a game today", opens: "Opens Training and Achievements" },
  { id: "boss-meeting", label: "Face to Face", todo: "Talk to your manager", prompt: "Your manager wants a word", opens: "Opens Relations" },
  { id: "first-two-sessions", label: "First Two Sessions", todo: "Complete two training drills", prompt: "Go to training", opens: "Opens the Shop" },
  { id: "buy-phone", label: "Connected", todo: "Buy a phone", prompt: "Buy your first phone in the Shop", opens: "Opens the Phone" },
];

/** The first steps for this career, in its order. */
export function stepsFor(c: Pick<CareerState, "unlocks">): FirstStep[] {
  return c.unlocks?.gameFirst ? FIRST_STEPS_GAME_FIRST : FIRST_STEPS;
}

// ── The phone step: never a step that silently does not work (v0.25) ──────

/** What your first phone costs in the shop. */
export function phonePrice(): number {
  const lv = LIFESTYLE_ALL_LEVELS.filter((i) => (i.baseId ?? i.id) === "phone").sort((a, b) => (a.level ?? 0) - (b.level ?? 0))[0];
  return lv?.price ?? LIFESTYLE_ITEMS.find((i) => i.id === "phone")?.price ?? 0;
}

/** How much more money the first phone needs (0 = you can buy it now). */
export function phoneShortfall(c: Pick<CareerState, "money">): number {
  return Math.max(0, phonePrice() - Math.floor(c.money));
}

/** The line the phone step shows: the price, and what is still needed. */
export function phoneStepLine(c: Pick<CareerState, "money">): string {
  const need = phoneShortfall(c);
  return need > 0
    ? `A phone costs ★${phonePrice()}. You need ★${need} more. Matches pay you`
    : `A phone costs ★${phonePrice()}. You can buy it now`;
}

export function stepDone(c: Pick<CareerState, "unlocks" | "achievements" | "careerStats" | "fixtures">, id: StepId): boolean {
  if (!c.unlocks) return true;
  if (id === "first-game") return (c.careerStats?.appearances ?? 0) >= 1 || c.fixtures.some((f) => f.played);
  if (id === "first-two-sessions") return c.achievements.includes(id) || c.unlocks.drills >= DRILLS_TO_UNLOCK;
  return c.achievements.includes(id);
}

/** The next first step to do, or null when every one is done. */
export function nextStep(c: Pick<CareerState, "unlocks" | "achievements" | "careerStats" | "fixtures">): FirstStep | null {
  if (!c.unlocks) return null;
  return stepsFor(c).find((s) => !stepDone(c, s.id)) ?? null;
}

export function firstStepsDone(c: Pick<CareerState, "unlocks" | "achievements" | "careerStats" | "fixtures">): boolean {
  return nextStep(c) === null;
}

/**
 * THE BOTTOM-LEFT BUTTON (Harry, 2 Oct 2026, P2-68, P2-89): "the achievements
 * are there until they've completed all their first steps. Once they complete
 * all of their first steps, then maybe it says, do you wanna switch this to
 * league as a shortcut?"
 *
 *   "league"       — League (locked until two drills), and every old save.
 *   "achievements" — once Achievements has opened, through the first steps,
 *                    and after them if the player says no to the switch.
 */
export type BottomLeft = "league" | "achievements";

export function bottomLeft(c: Pick<CareerState, "unlocks" | "achievements" | "careerStats" | "fixtures">): BottomLeft {
  if (!c.unlocks || !c.unlocks.open.includes("achievements")) return "league";
  if (c.unlocks.slot) return c.unlocks.slot;
  return "achievements";
}

/** Ask "switch this to League?" — first steps done, not asked yet. */
export function slotQuestionDue(c: Pick<CareerState, "unlocks" | "achievements" | "careerStats" | "fixtures">): boolean {
  return !!c.unlocks && c.unlocks.open.includes("achievements") && !c.unlocks.slot && firstStepsDone(c);
}

export function setBottomLeft(c: CareerState, slot: BottomLeft): CareerState {
  if (!c.unlocks) return c;
  return withU(c, { ...c.unlocks, slot });
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
