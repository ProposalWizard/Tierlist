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
  | "penalty-runup" | "freekick-runup" | "celebration" | "wearable" | "boots" | "ball" | "vehicle" | "other";

export const CATEGORIES: { id: RewardCategory; label: string }[] = [
  { id: "penalty-runup", label: "Penalty run-ups" },
  { id: "freekick-runup", label: "Free-kick run-ups" },
  { id: "celebration", label: "Celebrations" },
  { id: "wearable", label: "Wearables" },
  { id: "boots", label: "Boots" },
  { id: "ball", label: "Balls" },
  { id: "vehicle", label: "Vehicles" },
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
export type CollectibleSlot = "eyes" | "ball" | "vehicle" | "trophy";

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
    art: { scene: `${ART}/reward-car.webp`, sceneFit: 0.882, sceneAspect: 358 / 500 },
    note: "Borrowed Ferrari-shaped model: swap for an unbranded car before real use.",
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
  ...FROM_GAME,
];

/** The layout every save starts with, before anything is set on the admin page. */
export const DEFAULT_PASS_LEVELS: Record<number, string> = {
  5: "pass-hop-penalty",
  10: "pass-red-sports-car",
  15: "pass-star-ball",
  20: "pass-slow-runup",
  25: "pass-gold-aviators",
};

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
};
