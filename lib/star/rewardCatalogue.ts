/**
 * THE REWARD CATALOGUE (Mikey, 2 Oct 2026) — every reward and unlockable in
 * one list, so the Star Pass, the Shop and the admin page all read the same
 * cards.
 *
 * "An admin area where it basically stores all of the designs and all of the
 * rewards in one area which is categorized by the different types of rewards
 * … then I could select the ones that should go in the rewards area for
 * exactly which rewards. That also allows me and you to create more rewards
 * than even necessary … to be store items."
 *
 * A card is: a name, a category, how it looks (a picture, an animation or
 * live 3D), what owning it gives you (a run-up you can pick, an accessory, or
 * a collectible kept in your Locker), and how far along it is (idea →
 * designed → in the game).
 *
 * Which card sits at which Star Pass level is NOT here: that is the shared
 * Star Pass layout (lib/star/starPassStore.ts), set on /admin/star-pass.
 * Idea cards added on that page live in the layout too.
 *
 * Pure: no React.
 */
import { PENALTY_RUNUPS, FREE_KICK_RUNUPS, DEFAULT_PENALTY_RUNUP, DEFAULT_FREE_KICK_RUNUP } from "./runupStyles";
import { ACCESSORIES, type AccessorySlot } from "./store/catalogue";
import type { Live3D } from "./starPassRewards";

export type RewardCategory =
  | "penalty-runup" | "freekick-runup" | "celebration" | "wearable" | "boots" | "ball" | "vehicle"
  | "watch" | "home" | "outfit" | "cabinet" | "other";

export const CATEGORIES: { id: RewardCategory; label: string }[] = [
  { id: "penalty-runup", label: "Penalty run-ups" },
  { id: "freekick-runup", label: "Free-kick run-ups" },
  { id: "celebration", label: "Celebrations" },
  { id: "wearable", label: "Wearables" },
  { id: "boots", label: "Boots" },
  { id: "ball", label: "Balls" },
  { id: "vehicle", label: "Vehicles" },
  { id: "watch", label: "Watches & jewellery" },
  { id: "home", label: "Homes" },
  { id: "outfit", label: "Outfits" },
  { id: "cabinet", label: "Trophy cabinet" },
  { id: "other", label: "Other" },
];

export type RewardStatus = "idea" | "designed" | "in-game";

/** What owning a card gives you. */
export type RewardGrant =
  | { kind: "penaltyRunup"; id: string }
  | { kind: "freeKickRunup"; id: string }
  | { kind: "accessory"; id: string }
  /** Kept in the Locker; `slot` is what it is used as (one per slot). */
  | { kind: "collectible"; slot: CollectibleSlot };

/** Collectible slots: one used at a time in each. */
export type CollectibleSlot = "eyes" | "ball" | "vehicle" | "trophy" | "watch" | "chain" | "home" | "outfit";

export interface RewardArt {
  /** A still picture (no podium in it). */
  image?: string;
  /** The reward standing on its podium (may be animated). */
  scene?: string;
  /** Podium width ÷ scene width, so the podium matches the plain ones. */
  sceneFit?: number;
  /** Scene height ÷ width. */
  sceneAspect?: number;
  /** Live 3D you can spin. */
  live?: Live3D;
  /** No art yet: one emoji and a colour for its tile. */
  icon?: string;
  color?: string;
}

export interface CatalogueItem {
  id: string;
  name: string;
  category: RewardCategory;
  status: RewardStatus;
  grant: RewardGrant;
  art: RewardArt;
  /** Built into the code (vs an idea card added on the admin page). */
  builtIn?: boolean;
  /** On the road, but not made yet: it shows as "Soon" and can't be claimed
   *  (a celebration or run-up still needs its animation). */
  comingSoon?: boolean;
  note?: string;
}

const ART = "/star/star-pass";

/** The Star Pass test designs (Mikey, 1-2 Oct 2026). */
const PASS_DESIGNS: CatalogueItem[] = [
  {
    id: "pass-hop-penalty", name: "Hop Penalty", category: "penalty-runup", status: "in-game",
    grant: { kind: "penaltyRunup", id: "skip" },
    art: { scene: `${ART}/reward-penalty.webp`, sceneFit: 0.598, sceneAspect: 389 / 620 },
    note: "Plays as The Skip run-up on penalties.",
  },
  {
    id: "pass-red-sports-car", name: "Red Sports Car", category: "vehicle", status: "designed",
    grant: { kind: "collectible", slot: "vehicle" },
    art: { scene: `${ART}/reward-sports-car.webp`, sceneFit: 0.896, sceneAspect: 415 / 580 },
  },
  {
    id: "pass-star-ball", name: "Star Ball", category: "ball", status: "designed",
    grant: { kind: "collectible", slot: "ball" },
    art: { live: {
      podium: `${ART}/3d/podium-premier-medium.glb`, item: `${ART}/3d/reward-ball.glb`,
      look: 1.45, dist: 13.5, tilt: 70, w: 255, h: 200 } },
  },
  {
    id: "pass-slow-runup", name: "Slow Run-up", category: "penalty-runup", status: "in-game",
    grant: { kind: "penaltyRunup", id: "stutter" },
    art: { scene: `${ART}/reward-slow-runup.webp`, sceneFit: 0.894, sceneAspect: 549 / 560 },
    note: "Plays as Stutter Step on penalties.",
  },
  {
    id: "pass-gold-aviators", name: "Gold Aviators", category: "wearable", status: "designed",
    grant: { kind: "collectible", slot: "eyes" },
    art: { live: {
      podium: `${ART}/3d/podium-europa-medium.glb`, item: `${ART}/3d/reward-glasses.glb`,
      itemAt: [0, 0, 0.79], itemScale: 2.3,
      look: 2.45, dist: 15.5, tilt: 79, w: 290, h: 400,
      zoom: { at: [0, 0, 4.62], dist: 2.2 } } },
  },
];

/**
 * THE NEW STAR PASS REWARDS (Mikey, 25 Oct 2026: "apply this to the game
 * now"), from the Star Pass Concept page: a reward every 2 levels, each one
 * fitting where you are at that level. These are the new ideas that are
 * cards of their own; the Golden Run-up, The Leaf and Signature Boots are a
 * run-up and an accessory, and the four new celebrations are accessories, so
 * their cards come from FROM_GAME below. The things you collect live in the
 * Locker.
 */
const tile = (icon: string, color: string): RewardArt => ({ icon, color });
const own = (slot: CollectibleSlot): RewardGrant => ({ kind: "collectible", slot });
const PASS_NEW: CatalogueItem[] = [
  { id: "pass-scuffed-ball", name: "Scuffed Lucky Ball", category: "ball", status: "designed", grant: own("ball"), art: { scene: `${ART}/reward-scuffed-ball.webp`, sceneFit: 0.897, sceneAspect: 352 / 479 }, note: "The worn ball from your first club." },
  { id: "pass-used-hatchback", name: "Used Hatchback", category: "vehicle", status: "designed", grant: own("vehicle"), art: { scene: `${ART}/reward-hatchback.webp`, sceneFit: 0.91, sceneAspect: 439 / 571 }, note: "Your first car. A National League wage buys second-hand." },
  { id: "pass-steel-watch", name: "Steel Watch", category: "watch", status: "designed", grant: own("watch"), art: { scene: `${ART}/reward-steel-watch.webp`, sceneFit: 0.943, sceneAspect: 449 / 456 }, note: "A Championship wage buys a decent watch." },
  { id: "pass-penthouse", name: "Penthouse Flat", category: "home", status: "designed", grant: own("home"), art: { scene: `${ART}/reward-penthouse.webp`, sceneFit: 0.946, sceneAspect: 562 / 550 }, note: "A city penthouse. Premier League money after a few seasons." },
  { id: "pass-iced-chain", name: "Iced Chain", category: "watch", status: "designed", grant: own("chain"), art: { scene: `${ART}/reward-iced-chain.webp`, sceneFit: 0.943, sceneAspect: 472 / 456 }, note: "Jewellery for an established top-flight player." },
  { id: "pass-european-ball", name: "European Night Ball", category: "ball", status: "designed", grant: own("ball"), art: { scene: `${ART}/reward-european-ball.webp`, sceneFit: 0.897, sceneAspect: 352 / 479 }, note: "The ball for nights in Europe." },
  { id: "pass-gold-watch", name: "Gold Watch", category: "watch", status: "designed", grant: own("watch"), art: { scene: `${ART}/reward-gold-watch.webp`, sceneFit: 0.943, sceneAspect: 449 / 456 }, note: "A luxury watch for a trophy winner." },
  { id: "pass-supercar", name: "Supercar", category: "vehicle", status: "designed", grant: own("vehicle"), art: { scene: `${ART}/reward-supercar.webp`, sceneFit: 0.913, sceneAspect: 439 / 570 }, note: "A supercar. You are winning trophies now." },
  { id: "pass-trophy-wall", name: "Glass Trophy Wall", category: "cabinet", status: "designed", grant: own("trophy"), art: { scene: `${ART}/reward-trophy-wall.webp`, sceneFit: 0.942, sceneAspect: 453 / 456 }, note: "A wall to show every trophy you have won." },
  { id: "pass-mansion", name: "Mansion", category: "home", status: "designed", grant: own("home"), art: { scene: `${ART}/reward-mansion.webp`, sceneFit: 0.899, sceneAspect: 429 / 578 }, note: "A mansion with grounds. Ballon d'Or money." },
  { id: "pass-night-suit", name: "Ballon d'Or Night Suit", category: "outfit", status: "designed", grant: own("outfit"), art: { scene: `${ART}/reward-night-suit.webp`, sceneFit: 0.95, sceneAspect: 504 / 453 }, note: "What you wear to the Ballon d'Or night." },
  { id: "pass-golden-ball", name: "Golden Match Ball", category: "ball", status: "designed", grant: own("ball"), art: { scene: `${ART}/reward-golden-ball.webp`, sceneFit: 0.897, sceneAspect: 352 / 479 }, note: "A solid-gold match ball." },
  { id: "pass-private-jet", name: "Private Jet", category: "vehicle", status: "designed", grant: own("vehicle"), art: { scene: `${ART}/reward-private-jet.webp`, sceneFit: 0.937, sceneAspect: 519 / 555 }, note: "Your own jet. Legend level." },
  { id: "pass-hof-plaque", name: "Hall of Fame Plaque", category: "cabinet", status: "designed", grant: own("trophy"), art: { scene: `${ART}/reward-hof-plaque.webp`, sceneFit: 0.931, sceneAspect: 416 / 462 }, note: "Your name in your club's hall of fame." },
  { id: "pass-diamond-watch", name: "Diamond Watch", category: "watch", status: "designed", grant: own("watch"), art: { scene: `${ART}/reward-diamond-watch.webp`, sceneFit: 0.943, sceneAspect: 449 / 456 }, note: "The best watch there is." },
  { id: "pass-golden-set", name: "The Golden Set", category: "cabinet", status: "designed", grant: own("trophy"), art: { scene: `${ART}/reward-golden-set.webp`, sceneFit: 0.95, sceneAspect: 570 / 548 }, note: "Gold boots, gold ball, gold car and your statue outside the ground. You finished the game." },
];

const RUNUP_ICON: Record<string, string> = {
  stroll: "🚶", skip: "🦘", sprint: "💨", stutter: "⏸️", two_step: "👣", arc: "↪️",
};

const ACCESSORY_CATEGORY = (slot: AccessorySlot): RewardCategory =>
  slot === "celebration" ? "celebration" : slot === "boots" ? "boots" : "wearable";

/** Run-ups a Star Pass design already stands for (its card replaces the plain one). */
const DESIGNED_RUNUPS = new Set(PASS_DESIGNS.map((c) => ("id" in c.grant && c.grant.kind !== "accessory" ? c.grant.id : "")));

/** Everything already in the game, as cards. */
const FROM_GAME: CatalogueItem[] = [
  ...PENALTY_RUNUPS.filter((r) => r.id !== DEFAULT_PENALTY_RUNUP && !DESIGNED_RUNUPS.has(r.id)).map((r): CatalogueItem => ({
    id: `runup-${r.id}`, name: r.name, category: "penalty-runup", status: "in-game", builtIn: true,
    grant: { kind: "penaltyRunup", id: r.id }, art: { icon: RUNUP_ICON[r.id] ?? "⚽", color: "#22c55e" }, note: r.blurb,
  })),
  ...FREE_KICK_RUNUPS.filter((r) => r.id !== DEFAULT_FREE_KICK_RUNUP && !DESIGNED_RUNUPS.has(r.id)).map((r): CatalogueItem => ({
    id: `runup-${r.id}`, name: r.name, category: "freekick-runup", status: "in-game", builtIn: true,
    grant: { kind: "freeKickRunup", id: r.id }, art: { icon: "🎯", color: "#38bdf8" },
    note: r.player ? `${r.player}: ${r.blurb}` : r.blurb,
  })),
  ...ACCESSORIES.map((a): CatalogueItem => ({
    id: `acc-${a.id}`, name: a.name, category: ACCESSORY_CATEGORY(a.slot), status: "in-game", builtIn: true,
    grant: { kind: "accessory", id: a.id }, art: { color: a.color },
  })),
];

export const BUILT_IN_CATALOGUE: CatalogueItem[] = [
  ...PASS_DESIGNS.map((c) => ({ ...c, builtIn: true })),
  ...PASS_NEW.map((c) => ({ ...c, builtIn: true })),
  ...FROM_GAME,
];

/**
 * The layout every save starts with, before anything is set on the admin
 * page: a reward every 2 levels, a big one every 10 (the Star Pass Concept
 * page, 24 Oct 2026, applied 25 Oct 2026). Each fits where an average career
 * is at that level: non-league to level 13, the Premier League from 38.
 */
export const DEFAULT_PASS_LEVELS: Record<number, string> = {
  2: "acc-celeb-hands-up", 4: "acc-tape-white", 6: "runup-stroll", 8: "pass-scuffed-ball",
  10: "acc-boots-blackout", 12: "acc-headband-white", 14: "runup-fk_power_stance", 16: "acc-celeb-arms-out",
  18: "runup-two_step", 20: "pass-used-hatchback", 22: "acc-snood-black", 24: "runup-fk_stance_sprint",
  26: "acc-celeb-knee-slide", 28: "pass-star-ball", 30: "acc-boots-volt", 32: "acc-sleeves-black",
  34: "runup-sprint", 36: "pass-steel-watch", 38: "runup-fk_calm_curl", 40: "pass-red-sports-car",
  42: "acc-headband-ninja", 44: "acc-celeb-corner-flag", 46: "runup-fk_stutter_curl", 48: "pass-gold-aviators",
  50: "pass-penthouse", 52: "runup-arc", 54: "pass-iced-chain", 56: "pass-european-ball",
  58: "runup-fk_angled_whip", 60: "acc-boots-gold", 62: "acc-armband-rainbow", 64: "acc-celeb-backflip",
  66: "pass-gold-watch", 68: "runup-fk_long_diagonal", 70: "pass-supercar", 72: "acc-armband-classic",
  74: "pass-trophy-wall", 76: "acc-celeb-own-name", 78: "acc-boots-signature", 80: "pass-mansion",
  82: "acc-gloves-gold", 84: "runup-golden", 86: "pass-night-suit", 88: "pass-golden-ball",
  90: "pass-private-jet", 92: "pass-hof-plaque", 94: "runup-fk_leaf", 96: "acc-celeb-statue",
  98: "pass-diamond-watch", 100: "pass-golden-set",
};

/** Cards on the road that can't be claimed yet (see `comingSoon`). */
export const COMING_SOON_IDS: ReadonlySet<string> = new Set(
  [...PASS_DESIGNS, ...PASS_NEW].filter((c) => c.comingSoon).map((c) => c.id),
);

/** The full catalogue: built-in cards, then idea cards from the layout, with
 *  any status changes made on the admin page applied. */
export function fullCatalogue(extra: CatalogueItem[] = [], statusOverrides: Record<string, RewardStatus> = {}): CatalogueItem[] {
  const all = [...BUILT_IN_CATALOGUE, ...extra.filter((e) => !BUILT_IN_CATALOGUE.some((b) => b.id === e.id))];
  return all.map((c) => (statusOverrides[c.id] ? { ...c, status: statusOverrides[c.id] } : c));
}

export function findCard(id: string | undefined, catalogue: CatalogueItem[]): CatalogueItem | undefined {
  return id ? catalogue.find((c) => c.id === id) : undefined;
}

export const SLOT_LABEL: Record<CollectibleSlot, string> = {
  eyes: "Eyewear", ball: "Match ball", vehicle: "Vehicle", trophy: "Trophy cabinet",
  watch: "Watch", chain: "Chain", home: "Home", outfit: "Outfit",
};
