import type { CareerState, Horse } from "./types";
import { getTuning } from "./tuningStore";

/**
 * OWNING A RACEHORSE, NOT BETTING ON ONE.
 *
 * Requested directly: racing your OWN horse used to just multiply whatever
 * the casino's shared bet-amount slider happened to be set to (1st = bet×5,
 * 2nd = bet×2, 3rd = bet×1) — a real, if minor, bug on top of the design
 * problem: nothing was ever actually staked to win that multiple (only the
 * OTHER tab, betting on a horse you don't own, ever calls `onSetBank` to
 * take a stake), and betting against your own animal never made sense
 * anyway. Racing your own horse now pays a fixed purse for where you
 * actually finished — no stake, no bet slider involved at all — and, since
 * there's no wager to lose anymore, owning one instead costs real recurring
 * upkeep (feed, farrier, a vet on call) whether it races or not, scaled to
 * how good a horse it is exactly like the purse is.
 */

export function horseRating(horse: Horse): number {
  return Math.round((horse.speed + horse.stamina) / 2);
}

/** The purse for finishing 1st/2nd/3rd — 4th and worse pay nothing, same as
 *  a real race. Scales with the horse's own rating, same idea as
 *  `marketValue.ts`'s player curve: a better horse races for more. */
export function horseRacePrize(finish: number, horse: Horse): number {
  const win = getTuning("horseRacing.winPrizeBase") + horseRating(horse) * getTuning("horseRacing.winPrizePerRating");
  if (finish === 1) return Math.round(win);
  if (finish === 2) return Math.round(win * getTuning("horseRacing.placeShare"));
  if (finish === 3) return Math.round(win * getTuning("horseRacing.showShare"));
  return 0;
}

/** What it costs to keep this horse for one more week, whether it races or
 *  not — feed, keep, stabling, routine vet costs. Charged at the same
 *  cadence its energy already regenerates on (see careerFlow.ts's two call
 *  sites), so owning a horse you never race still has a real, ongoing cost
 *  rather than being a one-off purchase. */
export function horseUpkeep(horse: Horse): number {
  return Math.round(getTuning("horseRacing.upkeepBase") + horseRating(horse) * getTuning("horseRacing.upkeepPerRating"));
}

/** A real, player-chosen name — requested directly. Trimmed and length-capped
 *  the same way every other free-text name field in this game is (see
 *  facilities.ts's `renameStadium`). */
export function renameHorse(career: CareerState, name: string): CareerState {
  const trimmed = name.trim().slice(0, 24);
  if (!career.horse || !trimmed) return career;
  return { ...career, horse: { ...career.horse, name: trimmed } };
}
