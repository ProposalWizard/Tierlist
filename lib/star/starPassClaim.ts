/**
 * CLAIMING STAR PASS REWARDS, AND WHAT YOU OWN (Mikey, 2 Oct 2026).
 *
 * Reach a level → its reward is claimable (it waits for ever, never lost).
 * Claiming adds it to what you own:
 *   - a penalty or free-kick run-up → ownedAnimations (the match uses
 *     whichever you pick, penaltyRunup / freeKickRunup)
 *   - a store accessory (headband, celebration, boots colour) → ownedAccessories
 *   - anything else (a car, a ball, sunglasses) → ownedRewards, a collectible
 *     kept in the Locker, one used per slot (equippedRewards).
 * Things bought in the Store land in the same places, so the Locker shows
 * everything you own however you got it.
 *
 * Pure: no React. Pass the live star level (starStatus(career).stars) as
 * `stars`; `career.stars` is only the last saved copy of it.
 */
import type { CareerState } from "./types";
import type { CatalogueItem } from "./rewardCatalogue";
import { careerStoreEquip, careerStoreUnequip } from "./store/career";
import { ACCESSORIES } from "./store/catalogue";
import { DEFAULT_PENALTY_RUNUP, DEFAULT_FREE_KICK_RUNUP } from "./runupStyles";
import { STAR_PASS_STEP } from "./starPassRewards";

const add = (list: string[] | undefined, id: string) => (list?.includes(id) ? list : [...(list ?? []), id]);

/** Levels you have reached whose reward you haven't claimed yet. */
export function claimableLevels(c: CareerState, levels: Record<number, string>, stars = c.stars ?? 1): number[] {
  const claimed = new Set(c.starPassClaimed ?? []);
  return Object.keys(levels).map(Number)
    .filter((n) => n % STAR_PASS_STEP === 0 && n <= stars && !claimed.has(n) && !!levels[n])
    .sort((a, b) => a - b);
}

export function isClaimed(c: CareerState, level: number): boolean {
  return (c.starPassClaimed ?? []).includes(level);
}

/** Give the card to the player (whatever way they got it). */
export function grantCard(c: CareerState, card: CatalogueItem): CareerState {
  const g = card.grant;
  if (g.kind === "penaltyRunup" || g.kind === "freeKickRunup") return { ...c, ownedAnimations: add(c.ownedAnimations, g.id) };
  if (g.kind === "accessory") return { ...c, ownedAccessories: add(c.ownedAccessories, g.id) };
  return { ...c, ownedRewards: add(c.ownedRewards, card.id) };
}

/** Claim the reward at `level`. Does nothing if it isn't claimable. */
export function claimLevel(c: CareerState, level: number, card: CatalogueItem | undefined, stars = c.stars ?? 1): CareerState {
  if (!card || isClaimed(c, level) || level > stars) return c;
  const next = grantCard(c, card);
  return { ...next, starPassClaimed: [...(c.starPassClaimed ?? []), level].sort((a, b) => a - b) };
}

export function ownsCard(c: CareerState, card: CatalogueItem): boolean {
  const g = card.grant;
  if (g.kind === "penaltyRunup" || g.kind === "freeKickRunup") return (c.ownedAnimations ?? []).includes(g.id);
  if (g.kind === "accessory") return (c.ownedAccessories ?? []).includes(g.id);
  return (c.ownedRewards ?? []).includes(card.id);
}

export function isUsing(c: CareerState, card: CatalogueItem): boolean {
  const g = card.grant;
  if (g.kind === "penaltyRunup") return (c.penaltyRunup ?? c.runupStyle ?? DEFAULT_PENALTY_RUNUP) === g.id;
  if (g.kind === "freeKickRunup") return (c.freeKickRunup ?? DEFAULT_FREE_KICK_RUNUP) === g.id;
  if (g.kind === "accessory") return Object.values(c.equippedAccessories ?? {}).includes(g.id);
  return (c.equippedRewards ?? {})[g.slot] === card.id;
}

/** Use an owned card (pick the run-up, wear the accessory, use the collectible). */
export function equipCard(c: CareerState, card: CatalogueItem): CareerState {
  if (!ownsCard(c, card)) return c;
  const g = card.grant;
  if (g.kind === "penaltyRunup") return { ...c, penaltyRunup: g.id as CareerState["penaltyRunup"] };
  if (g.kind === "freeKickRunup") return { ...c, freeKickRunup: g.id as CareerState["freeKickRunup"] };
  if (g.kind === "accessory") {
    const r = careerStoreEquip(c, g.id);
    return r.ok ? r.career : c;
  }
  return { ...c, equippedRewards: { ...(c.equippedRewards ?? {}), [g.slot]: card.id } };
}

/** Stop using a card (run-ups go back to Standard). */
export function stopUsing(c: CareerState, card: CatalogueItem): CareerState {
  const g = card.grant;
  if (g.kind === "penaltyRunup") return { ...c, penaltyRunup: DEFAULT_PENALTY_RUNUP };
  if (g.kind === "freeKickRunup") return { ...c, freeKickRunup: DEFAULT_FREE_KICK_RUNUP };
  if (g.kind === "accessory") {
    const slot = ACCESSORIES.find((a) => a.id === g.id)?.slot;
    return slot ? careerStoreUnequip(c, slot) : c;
  }
  const eq = { ...(c.equippedRewards ?? {}) };
  if (eq[g.slot] === card.id) delete eq[g.slot];
  return { ...c, equippedRewards: eq };
}

/** Whether using it changes anything in the game yet (collectibles don't, yet). */
export function showsInGame(card: CatalogueItem): boolean {
  return card.grant.kind !== "collectible";
}
