/**
 * ONE ROUND OF EACH CASINO GAME — the roll the flat casino
 * (components/star/Casino.tsx) and the 3D room (components/star/
 * Casino3DTable.tsx) both play, so the two can never pay differently.
 *
 * Each is exactly what Casino.tsx's local play did inline before the 3D
 * games (8 Oct 2026): the same rules (./casinoRules.ts), the same random
 * numbers drawn in the same order. The 3D room rolls with these, THEN moves
 * the ball / reels / cards / horses to show the result
 * (./casino3d/motion.ts). tests/star/casino3dGames.mts compares them with
 * the old inline code, seed by seed.
 */
import {
  type Card, type Rng, type RouletteChoice, spinRoulette, roulettePayout, spinSlots, slotsPayout,
  drawCard, dealerPlay, blackjackSettle, raceScores, finishOf, type BlackjackVerdict,
} from "./casinoRules";

export function rouletteRound(choice: RouletteChoice, stake: number, rng: Rng): { winner: number; payout: number } {
  const winner = spinRoulette(rng);
  return { winner, payout: roulettePayout(choice, winner, stake) };
}

export function slotsRound(stake: number, rng: Rng): { reels: string[]; payout: number } {
  const reels = spinSlots(rng);
  return { reels, payout: slotsPayout(reels, stake) };
}

/** Two cards each: yours first, then the dealer's (his second stays face down). */
export function blackjackDeal(rng: Rng): { player: Card[]; dealer: Card[] } {
  return { player: [drawCard(rng), drawCard(rng)], dealer: [drawCard(rng), drawCard(rng)] };
}

export function blackjackHit(player: readonly Card[], rng: Rng): Card[] {
  return [...player, drawCard(rng)];
}

/** You stand: the dealer draws to 17, and the hand is settled. */
export function blackjackStand(player: readonly Card[], dealer: readonly Card[], stake: number, rng: Rng): { dealer: Card[]; verdict: BlackjackVerdict; payout: number } {
  const full = dealerPlay(dealer, rng);
  const s = blackjackSettle(player, full, stake);
  return { dealer: full, verdict: s.verdict, payout: s.payout };
}

/** A bet on horse `pick` in this field: everyone's score, and what it pays. */
export function horseBetRound(ratings: readonly number[], odds: readonly number[], pick: number, stake: number, rng: Rng, noise: number): { scores: number[]; payout: number } {
  const scores = raceScores(ratings, rng, noise);
  return { scores, payout: finishOf(scores, pick) === 1 ? Math.round(stake * odds[pick]) : 0 };
}
