/**
 * THE CASINO'S RULES — one copy, used by the phone AND the server.
 *
 * Harry, 8 Oct 2026: "move the casino to the server". Every game used to roll
 * Math.random() on the phone and write the bank into the save, so the save
 * guard could not tell a lucky night from an edited save. Now, when the
 * player is signed in, the SERVER rolls (app/api/star/casino/play) and
 * records every stake and payout (star_casino_plays). The phone only shows
 * what the server rolled.
 *
 * So the rules (what a spin can land on, what each result pays) live here,
 * pure, with the random numbers passed in. The phone uses them for local
 * play (signed out, or before star_casino.sql has run) and to draw the
 * tables; the server uses the same functions to decide and pay. Roulette,
 * slots, blackjack, Goalie Mode and your own horse's purse are exactly the
 * rules Casino.tsx already had, moved. One change: horse-race ODDS are now
 * worked out exactly instead of by 4,000 random races, because the old
 * prices let some bets pay back more than the stake (see raceWinChances).
 *
 * Every "payout" below is what goes BACK to the bank, stake included
 * (a lost bet pays 0, a push pays the stake back). Net = payout − stake.
 *
 * Tested in tests/star/casino.mts.
 */

export type Rng = () => number;

/** Strong random numbers: the browser's and Node's crypto.getRandomValues
 *  (both have it). 32 bits per number, buffered. */
export function cryptoRng(): Rng {
  const c = globalThis.crypto;
  const buf = new Uint32Array(64);
  let i = buf.length;
  return () => {
    if (i >= buf.length) { c.getRandomValues(buf); i = 0; }
    return buf[i++] / 4294967296;
  };
}

/** A small seeded generator, for things that must come out the same on the
 *  phone and the server (the horse odds below). */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rng: Rng, n: number) => Math.min(n - 1, Math.floor(rng() * n));

/** A stake the casino takes: a whole number of stars, at least 1. */
export function validStake(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 1e13;
}

// ═══════════════════════════════════════════════════════════════════════
//  ROULETTE — European, 0-36
// ═══════════════════════════════════════════════════════════════════════

export const ROULETTE_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23,
  10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];
export const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export const isRed = (n: number) => RED_NUMBERS.has(n);

export type RouletteChoice = "red" | "black" | "even" | "odd" | number;

export function validRouletteChoice(c: unknown): c is RouletteChoice {
  return c === "red" || c === "black" || c === "even" || c === "odd"
    || (typeof c === "number" && Number.isInteger(c) && c >= 0 && c <= 36);
}

export function spinRoulette(rng: Rng): number {
  return pick(rng, 37);
}

/** Single number 35× (returned, stake included — as the game always paid);
 *  red/black/even/odd 2×. Zero loses every outside bet. */
export function roulettePayout(choice: RouletteChoice, winner: number, stake: number): number {
  const red = isRed(winner);
  if (typeof choice === "number") return choice === winner ? stake * 35 : 0;
  if (choice === "red" && red) return stake * 2;
  if (choice === "black" && !red && winner !== 0) return stake * 2;
  if (choice === "even" && winner !== 0 && winner % 2 === 0) return stake * 2;
  if (choice === "odd" && winner % 2 === 1) return stake * 2;
  return 0;
}

// ═══════════════════════════════════════════════════════════════════════
//  SLOTS — three reels of six
// ═══════════════════════════════════════════════════════════════════════

export const SLOTS_SYMBOLS = ["🍒", "🍋", "🍊", "🔔", "⭐", "7️⃣"];

export function spinSlots(rng: Rng): [string, string, string] {
  const roll = () => SLOTS_SYMBOLS[pick(rng, SLOTS_SYMBOLS.length)];
  return [roll(), roll(), roll()];
}

/** 777 = 20×, ⭐⭐⭐ = 10×, any other triple 5×, a pair next to each other
 *  gives the stake back. */
export function slotsPayout(reels: readonly string[], stake: number): number {
  const [a, b, c] = reels;
  if (a === b && b === c) return a === "7️⃣" ? stake * 20 : a === "⭐" ? stake * 10 : stake * 5;
  if (a === b || b === c) return stake;
  return 0;
}

// ═══════════════════════════════════════════════════════════════════════
//  BLACKJACK — an endless deck (every card drawn fresh, as it always was)
// ═══════════════════════════════════════════════════════════════════════

export type Suit = "♥" | "♠" | "♦" | "♣";
export interface Card { rank: string; value: number; suit: Suit }
export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
export const SUITS: Suit[] = ["♥", "♠", "♦", "♣"];

export function drawCard(rng: Rng): Card {
  const rank = RANKS[pick(rng, RANKS.length)];
  const value = rank === "A" ? 11 : ["J", "Q", "K"].includes(rank) ? 10 : parseInt(rank, 10);
  return { rank, value, suit: SUITS[pick(rng, SUITS.length)] };
}

export function handValue(cards: readonly Card[]): number {
  let total = cards.reduce((s, c) => s + c.value, 0);
  let aces = cards.filter(c => c.rank === "A").length;
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

/** The dealer draws to 17. */
export function dealerPlay(dealer: readonly Card[], rng: Rng): Card[] {
  const d = [...dealer];
  while (handValue(d) < 17) d.push(drawCard(rng));
  return d;
}

export type BlackjackVerdict = "bust" | "dealer-bust" | "win" | "push" | "lose";

/** A win pays 2× (stake back plus the same again), a push gives the stake
 *  back. No extra for a natural 21 — the game never had one. */
export function blackjackSettle(player: readonly Card[], dealer: readonly Card[], stake: number): { verdict: BlackjackVerdict; payout: number } {
  const p = handValue(player);
  if (p > 21) return { verdict: "bust", payout: 0 };
  const d = handValue(dealer);
  if (d > 21) return { verdict: "dealer-bust", payout: stake * 2 };
  if (p > d) return { verdict: "win", payout: stake * 2 };
  if (p === d) return { verdict: "push", payout: stake };
  return { verdict: "lose", payout: 0 };
}

// ═══════════════════════════════════════════════════════════════════════
//  HORSE RACING — score = rating + random noise; best score wins
// ═══════════════════════════════════════════════════════════════════════

export const RACE_FIELD = 6;
export const RACE_MIN_RATING = 40;
export const RACE_MAX_RATING = 95;
/** horseRacing.raceNoise's shipped value (tuning.ts). The server always uses
 *  this; the phone uses it whenever the server dealt the race. */
export const DEFAULT_RACE_NOISE = 50;
const OVERROUND = 1.15;
/** The longest price: what the old 4,000-race measurement gave a horse that
 *  never won (1 / (1/4000) / 1.15). */
export const MAX_HORSE_ODDS = 3478;
/** The shortest price. Was 1.2, which paid MORE than the stake back on
 *  average for a heavy favourite (measured: backing a 93 against 55-86
 *  returned ★1.02 per ★1) — a free-money bet once a race card can be asked
 *  for again and again. */
export const MIN_HORSE_ODDS = 1.01;

/**
 * The exact chance each horse wins. A horse scores rating + noise × U, with
 * U even between 0 and 1, and the best score wins; so horse i wins with
 * chance ∫ (1/noise) × Π_{j≠i} P(score_j < x) dx over its own range. Worked
 * out with 4,000 small steps (far tighter than the race can tell apart).
 *
 * Until 8 Oct 2026 this was MEASURED by running 4,000 random races per card.
 * That sampling put long shots at the wrong price: a horse with a 1-in-500
 * chance that happened to win twice in 4,000 was quoted at the price of a
 * 1-in-2,000 — measured over 2,000 cards, 47% had at least one horse whose
 * price paid back more than the stake on average (up to ★9.57 per ★1).
 */
export function raceWinChances(ratings: readonly number[], noise = DEFAULT_RACE_NOISE): number[] {
  const STEPS = 4000;
  const F = (x: number, r: number) => Math.min(1, Math.max(0, (x - r) / noise));
  return ratings.map((ri, i) => {
    let p = 0;
    const h = noise / STEPS;
    for (let k = 0; k < STEPS; k++) {
      const x = ri + (k + 0.5) * h;
      let prod = 1;
      for (let j = 0; j < ratings.length && prod > 0; j++) if (j !== i) prod *= F(x, ratings[j]);
      p += prod * h / noise;
    }
    return p;
  });
}

/**
 * Win odds for this exact field: the exact chance, less the bookmaker's 15%,
 * rounded to 0.1, between 1.01 and 3,478. The same on the phone and the
 * server (no random numbers in it).
 */
export function raceWinOdds(ratings: readonly number[], noise = DEFAULT_RACE_NOISE): number[] {
  return raceWinChances(ratings, noise).map(p => {
    if (p <= 0) return MAX_HORSE_ODDS;
    const fair = Math.round((1 / p / OVERROUND) * 10) / 10;
    return Math.min(MAX_HORSE_ODDS, Math.max(MIN_HORSE_ODDS, fair));
  });
}

/** Six horses rated 40-95. */
export function dealRaceRatings(rng: Rng): number[] {
  const out: number[] = [];
  for (let i = 0; i < RACE_FIELD; i++) out.push(RACE_MIN_RATING + pick(rng, RACE_MAX_RATING - RACE_MIN_RATING + 1));
  return out;
}

export function validRaceRatings(r: unknown): r is number[] {
  return Array.isArray(r) && r.length === RACE_FIELD
    && r.every(x => typeof x === "number" && Number.isInteger(x) && x >= RACE_MIN_RATING && x <= RACE_MAX_RATING);
}

export function raceScores(ratings: readonly number[], rng: Rng, noise = DEFAULT_RACE_NOISE): number[] {
  return ratings.map(r => r + rng() * noise);
}

/** 1-based finishing place of runner `i` (highest score first). */
export function finishOf(scores: readonly number[], i: number): number {
  return 1 + scores.filter((s, j) => j !== i && (s > scores[i] || (s === scores[i] && j < i))).length;
}

/** A winning bet pays stake × odds (rounded), stake included. */
export function horseBetPayout(pickIdx: number, scores: readonly number[], odds: readonly number[], stake: number): number {
  return finishOf(scores, pickIdx) === 1 ? Math.round(stake * odds[pickIdx]) : 0;
}

/** Racing your own horse: index 0 is yours, five rivals rated 46-88. */
export function ownHorseScores(
  horse: { speed: number; stamina: number; energy: number }, rng: Rng, noise = DEFAULT_RACE_NOISE,
): { scores: number[]; ratings: number[] } {
  const energyFactor = 0.6 + (Math.max(0, Math.min(100, horse.energy)) / 100) * 0.4;
  const scores = [(horse.speed * 0.55 + horse.stamina * 0.45) * energyFactor + rng() * noise];
  const ratings = [Math.round((horse.speed + horse.stamina) / 2)];
  for (let i = 0; i < 5; i++) {
    const rating = 46 + rng() * 42;
    ratings.push(Math.round(rating));
    scores.push(rating + rng() * noise);
  }
  return { scores, ratings };
}

/** The best horse the casino sells (Casino.tsx PURCHASABLE_HORSES). No horse
 *  ever gets better than what was bought. */
export const BEST_HORSE = { speed: 88, stamina: 84 };
export const MY_HORSE_RACE_COST = 40;

/** Server casino switch (Harry, 8 Oct 2026: "I'm really not certain about
 *  moving casino to server for now, adding lag … until we have a paid database
 *  plan"). false = every game rolls on the phone exactly as before: no server
 *  call, no lag, no database rows. The save guard keeps its luck allowance.
 *  The server route, its tests and star_casino.sql stay in the repo, ready to
 *  switch on if cheating shows up. */
export const CASINO_ON_SERVER = false;
