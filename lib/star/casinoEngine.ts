/**
 * THE SERVER'S CASINO — every roll and every payout, decided here.
 *
 * Harry, 8 Oct 2026: "move the casino to the server". The route
 * (app/api/star/casino/play) only does sign-in and the database; this file
 * does the rest, against a small `CasinoStore` so the tests can run it with
 * an in-memory table (tests/star/casino.mts). Rules come from casinoRules.ts,
 * the same file the phone uses, so what the phone shows and what the server
 * pays cannot drift apart.
 *
 * What the server checks, per game:
 *   roulette, slots   the stake, the choice, the spin, the payout.
 *   blackjack         the deal, every card, the dealer's hidden card (kept
 *                     on the server until you stand), the dealer's draw,
 *                     the payout. One hand = one row, played in steps.
 *   horses (bet)      the race card (ratings dealt by the server and signed,
 *                     so the phone cannot pick its own field), the odds
 *                     (worked out again here), the race, the payout. Each
 *                     card can be bet on once.
 *   horses (own)      the race and the purse, using the horse in the last
 *                     trusted save (never better than the best one sold),
 *                     and no more races than its energy allows.
 *   goalie mode       every shot (dealt one at a time, only after you choose
 *                     to go on), every save, the streak and the cash-out.
 *                     The dive itself is the player's input: the server
 *                     judges it with the same maths, and refuses a dive sent
 *                     before the ball could have arrived, but a perfect
 *                     scripted keeper would still win. The cap is 12×.
 * Competition bets are not here: they settle on season results inside the
 * save, and the save guard already prices them (saveGuard.ts liquidation).
 *
 * Every stake must be within the bank the phone says it has AND within what
 * the last trusted cloud save could have (its money, plus casino net since,
 * plus a generous slack). Every request carries an `idemKey`: sending the
 * same request twice (a retry after a dropped connection) returns the first
 * answer and never plays twice.
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  type Rng, type Card, type RouletteChoice,
  validStake, validRouletteChoice, spinRoulette, roulettePayout, spinSlots, slotsPayout,
  drawCard, handValue, dealerPlay, blackjackSettle,
  dealRaceRatings, raceWinOdds, validRaceRatings, raceScores, finishOf, horseBetPayout,
  ownHorseScores, BEST_HORSE, MY_HORSE_RACE_COST,
} from "./casinoRules";
import { pickShot, resolveDive, streakMultiplier, type GoalieShot, type DiveInput } from "./goalieMode";
import { horseRacePrize } from "./horse";
import type { Horse } from "./types";

export type CasinoGame = "roulette" | "slots" | "blackjack" | "horse" | "horse_own" | "goalie";
export const CASINO_GAMES: CasinoGame[] = ["roulette", "slots", "blackjack", "horse", "horse_own", "goalie"];

export interface PlayRow {
  id: string;
  user_id: string;
  slot: number;
  game: CasinoGame;
  stake: number;
  payout: number;
  net: number;
  status: "open" | "settled";
  step: number;
  /** What the player may see: the last answer, and the final one. */
  outcome: { last?: { idem: string; response: unknown }; final?: unknown };
  /** Never sent to the phone (and not readable by it in the database). */
  secret: Record<string, unknown> | null;
  idem_key: string;
  at: number;
}

export interface CasinoStore {
  findByIdem(userId: string, idem: string): Promise<PlayRow | null>;
  get(userId: string, id: string): Promise<PlayRow | null>;
  /** "conflict": a row with this idem key already exists. */
  insert(row: Omit<PlayRow, "id" | "at">): Promise<PlayRow | "conflict">;
  /** Only if the row is still at `fromStep` (two taps at once cannot both
   *  win). False when it has moved on. */
  update(userId: string, id: string, fromStep: number, patch: Partial<PlayRow>): Promise<boolean>;
  countSince(userId: string, slot: number, game: CasinoGame, sinceMs: number): Promise<number>;
}

/** What the last trusted cloud save says (read by the route with the service key). */
export interface Trusted {
  money: number;
  wage: number;
  /** When it was stored, ms. */
  savedAt: number;
  horse: { speed: number; stamina: number; energy: number } | null;
  /** Casino net the server recorded for this slot since that save. */
  netSince: number;
}

export interface EngineCtx {
  userId: string;
  slot: number;
  now: number;
  rng: Rng;
  /** Signs horse race cards. The route uses a server-only secret. */
  secret: string;
  trusted: () => Promise<Trusted | null>;
}

export interface EngineAnswer { status: number; body: Record<string, unknown> }

const ok = (result: unknown): EngineAnswer => ({ status: 200, body: { result } });
const bad = (error: string, status = 400): EngineAnswer => ({ status, body: { error } });

/** Stake slack above the trusted save's money: a few seasons' pay at the
 *  current wage, never less than this (pay, prizes and sponsor money that
 *  landed after the last save). */
export const STAKE_SLACK_MIN = 250_000;
export const STAKE_SLACK_WAGES = 60;
/** A race card can be bet on for this long. */
export const CARD_TTL_MS = 30 * 60 * 1000;
/** A dive cannot reach the server sooner than the ball reaches the line,
 *  less this (the phone starts its clock after the answer arrives, so real
 *  play is always later than this, never earlier). */
export const DIVE_EARLY_SLACK_MS = 400;
/** Own-horse races allowed beyond what the trusted save's energy gives
 *  (energy comes back +20 a match; a few matches can pass between saves). */
export const OWN_RACE_SLACK = 3;

export function stakeCap(t: Trusted | null): number {
  if (!t) return Infinity;
  return Math.max(0, t.money) + Math.max(0, t.netSince) + Math.max(STAKE_SLACK_MIN, STAKE_SLACK_WAGES * Math.max(0, t.wage));
}

// ── The horse race card ────────────────────────────────────────────────────

export interface RaceCard { ratings: number[]; nonce: string; exp: number }

function cardPayload(c: RaceCard): string {
  return `${c.nonce}.${c.exp}.${c.ratings.join(",")}`;
}
export function signCard(c: RaceCard, secret: string): string {
  return createHmac("sha256", secret).update(cardPayload(c)).digest("hex");
}
export function verifyCard(c: unknown, sig: unknown, secret: string, now: number): c is RaceCard {
  if (!c || typeof c !== "object" || typeof sig !== "string" || !/^[0-9a-f]{64}$/.test(sig)) return false;
  const k = c as RaceCard;
  if (typeof k.nonce !== "string" || !/^[0-9a-f]{16,64}$/.test(k.nonce) || typeof k.exp !== "number") return false;
  if (!validRaceRatings(k.ratings) || k.exp < now) return false;
  const want = Buffer.from(signCard(k, secret), "hex");
  const got = Buffer.from(sig, "hex");
  return want.length === got.length && timingSafeEqual(want, got);
}

// ── Reading the request ────────────────────────────────────────────────────

type Body = Record<string, unknown>;
const isObj = (v: unknown): v is Body => !!v && typeof v === "object" && !Array.isArray(v);
const fin = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
export const validIdem = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9:_-]{8,80}$/.test(v);

async function checkStake(stake: unknown, bank: unknown, ctx: EngineCtx): Promise<string | null> {
  if (!validStake(stake)) return "That stake isn't a real amount.";
  if (fin(bank) && stake > bank) return "That's more than your bank.";
  const t = await ctx.trusted();
  if (stake > stakeCap(t)) return "That's more than your saved bank. Let your game save, then try again.";
  return null;
}

/** A finished single-step play: one settled row, answer stored with it. */
async function settleOnce(
  store: CasinoStore, ctx: EngineCtx, game: CasinoGame, idem: string, stake: number, payout: number, response: unknown,
): Promise<EngineAnswer> {
  const row = await store.insert({
    user_id: ctx.userId, slot: ctx.slot, game, stake, payout, net: payout - stake, status: "settled", step: 1,
    outcome: { final: response }, secret: null, idem_key: idem,
  });
  if (row === "conflict") {
    const prev = await store.findByIdem(ctx.userId, idem);
    return prev ? ok(prev.outcome.final ?? prev.outcome.last?.response) : bad("Try again.", 409);
  }
  return ok(response);
}

// ── The entry point ────────────────────────────────────────────────────────

export async function handlePlay(raw: unknown, ctx: EngineCtx, store: CasinoStore): Promise<EngineAnswer> {
  if (!isObj(raw)) return bad("Not a play.");
  const game = raw.game as CasinoGame;
  if (!CASINO_GAMES.includes(game)) return bad("Unknown game.");
  const action = typeof raw.action === "string" ? raw.action : "play";

  // The race card is only dealt, never stored: nothing to replay.
  if (game === "horse" && action === "card") {
    const ratings = dealRaceRatings(ctx.rng);
    const card: RaceCard = { ratings, nonce: randomBytes(12).toString("hex"), exp: ctx.now + CARD_TTL_MS };
    return ok({ card, sig: signCard(card, ctx.secret), odds: raceWinOdds(ratings) });
  }

  if (!validIdem(raw.idemKey)) return bad("Missing request key.");
  // Horse bets are keyed by their card, so one card is one bet, ever.
  const idem = game === "horse" && isObj(raw.card) && typeof raw.card.nonce === "string"
    ? `horse:${String(raw.card.nonce).slice(0, 64)}` : raw.idemKey;

  // Steps of an open hand / run are replayed from the row itself.
  if ((game === "blackjack" || game === "goalie") && action !== "deal" && action !== "start") {
    return stepPlay(game, action, raw, idem, ctx, store);
  }

  // A race card must be one the server dealt, unchanged and in date.
  if (game === "horse" && !verifyCard(raw.card, raw.sig, ctx.secret, ctx.now)) {
    return bad("That race has gone. Pick from the new card.", 409);
  }

  // A repeat of a first step or single play: the first answer again.
  const seen = await store.findByIdem(ctx.userId, idem);
  if (seen) {
    if (seen.game !== game) return bad("That request key was used for something else.", 409);
    return ok(seen.outcome.final ?? seen.outcome.last?.response);
  }

  switch (game) {
    case "roulette": {
      if (!validRouletteChoice(raw.choice)) return bad("Pick red, black, odd, even or a number.");
      const problem = await checkStake(raw.stake, raw.bank, ctx);
      if (problem) return bad(problem);
      const stake = raw.stake as number;
      const winner = spinRoulette(ctx.rng);
      const payout = roulettePayout(raw.choice as RouletteChoice, winner, stake);
      return settleOnce(store, ctx, game, idem, stake, payout, { winner, payout });
    }
    case "slots": {
      const problem = await checkStake(raw.stake, raw.bank, ctx);
      if (problem) return bad(problem);
      const stake = raw.stake as number;
      const reels = spinSlots(ctx.rng);
      const payout = slotsPayout(reels, stake);
      return settleOnce(store, ctx, game, idem, stake, payout, { reels, payout });
    }
    case "horse": {
      const card = raw.card as RaceCard;
      const pickIdx = raw.pick;
      if (typeof pickIdx !== "number" || !Number.isInteger(pickIdx) || pickIdx < 0 || pickIdx >= card.ratings.length) return bad("Pick a horse.");
      const problem = await checkStake(raw.stake, raw.bank, ctx);
      if (problem) return bad(problem);
      const stake = raw.stake as number;
      const odds = raceWinOdds(card.ratings);
      const scores = raceScores(card.ratings, ctx.rng);
      const payout = horseBetPayout(pickIdx, scores, odds, stake);
      return settleOnce(store, ctx, game, idem, stake, payout, { scores, finish: finishOf(scores, pickIdx), payout, odds });
    }
    case "horse_own": {
      const t = await ctx.trusted();
      const claim = isObj(raw.horse) ? raw.horse : {};
      const base = t?.horse ?? null;
      const speed = Math.min(fin(claim.speed) ? claim.speed : 0, base?.speed ?? BEST_HORSE.speed, BEST_HORSE.speed);
      const stamina = Math.min(fin(claim.stamina) ? claim.stamina : 0, base?.stamina ?? BEST_HORSE.stamina, BEST_HORSE.stamina);
      const energy = Math.max(0, Math.min(100, fin(claim.energy) ? claim.energy : 0));
      if (energy < MY_HORSE_RACE_COST) return bad("Your horse is too tired to race.");
      if (t && t.horse) {
        const raced = await store.countSince(ctx.userId, ctx.slot, "horse_own", t.savedAt);
        if (raced >= Math.floor(t.horse.energy / MY_HORSE_RACE_COST) + OWN_RACE_SLACK) {
          return bad("Your horse has raced enough for now. Play a match, then race again.");
        }
      }
      const { scores, ratings } = ownHorseScores({ speed, stamina, energy }, ctx.rng);
      const finish = finishOf(scores, 0);
      const payout = horseRacePrize(finish, { speed, stamina } as Horse);
      return settleOnce(store, ctx, game, idem, 0, payout, { scores, ratings, finish, payout });
    }
    case "blackjack": {
      const problem = await checkStake(raw.stake, raw.bank, ctx);
      if (problem) return bad(problem);
      const stake = raw.stake as number;
      const player = [drawCard(ctx.rng), drawCard(ctx.rng)];
      const dealer = [drawCard(ctx.rng), drawCard(ctx.rng)];
      return openPlay(store, ctx, game, idem, stake, { player, dealer }, (id) => ({ playId: id, player, dealerUp: dealer[0] }));
    }
    case "goalie": {
      const problem = await checkStake(raw.stake, raw.bank, ctx);
      if (problem) return bad(problem);
      const stake = raw.stake as number;
      const shot = pickShot(0, ctx.rng);
      return openPlay(store, ctx, game, idem, stake, { streak: 0, shot, issuedAt: ctx.now },
        (id) => ({ playId: id, shot, streak: 0 }));
    }
  }
  return bad("Unknown game.");
}

async function openPlay(
  store: CasinoStore, ctx: EngineCtx, game: CasinoGame, idem: string, stake: number,
  secret: Record<string, unknown>, answer: (id: string) => unknown,
): Promise<EngineAnswer> {
  const row = await store.insert({
    user_id: ctx.userId, slot: ctx.slot, game, stake, payout: 0, net: -stake, status: "open", step: 1,
    outcome: {}, secret, idem_key: idem,
  });
  if (row === "conflict") {
    const prev = await store.findByIdem(ctx.userId, idem);
    return prev ? ok(prev.outcome.final ?? prev.outcome.last?.response) : bad("Try again.", 409);
  }
  const response = answer(row.id);
  // Stored so a retried "deal"/"start" gets the same answer.
  await store.update(ctx.userId, row.id, row.step, { outcome: { last: { idem, response } } });
  return ok(response);
}

async function stepPlay(
  game: "blackjack" | "goalie", action: string, raw: Body, idem: string, ctx: EngineCtx, store: CasinoStore,
): Promise<EngineAnswer> {
  if (typeof raw.playId !== "string") return bad("Which hand?");
  const row = await store.get(ctx.userId, raw.playId);
  if (!row || row.game !== game) return bad("That hand isn't open.", 404);
  if (row.outcome.last?.idem === idem) return ok(row.outcome.last.response);
  if (row.status === "settled") return ok(row.outcome.final ?? row.outcome.last?.response);

  const s = (row.secret ?? {}) as Record<string, unknown>;
  const save = async (secret: Record<string, unknown>, response: unknown, payout?: number): Promise<EngineAnswer> => {
    const settled = payout !== undefined;
    const patch: Partial<PlayRow> = {
      step: row.step + 1, secret: settled ? null : secret,
      outcome: settled ? { last: { idem, response }, final: response } : { last: { idem, response } },
      ...(settled ? { status: "settled", payout, net: payout - row.stake } : {}),
    };
    const done = await store.update(ctx.userId, row.id, row.step, patch);
    if (!done) {
      // Another tap got there first: answer with whatever it stored.
      const now = await store.get(ctx.userId, row.id);
      return now ? ok(now.outcome.final ?? now.outcome.last?.response) : bad("Try again.", 409);
    }
    return ok(response);
  };

  if (game === "blackjack") {
    const player = (s.player ?? []) as Card[];
    const dealer = (s.dealer ?? []) as Card[];
    if (action === "hit") {
      const next = [...player, drawCard(ctx.rng)];
      if (handValue(next) > 21) {
        const { verdict, payout } = blackjackSettle(next, dealer, row.stake);
        return save({}, { player: next, dealer, verdict, payout, done: true }, payout);
      }
      return save({ player: next, dealer }, { player: next, done: false });
    }
    if (action === "stand") {
      const finalDealer = dealerPlay(dealer, ctx.rng);
      const { verdict, payout } = blackjackSettle(player, finalDealer, row.stake);
      return save({}, { player, dealer: finalDealer, verdict, payout, done: true }, payout);
    }
    return bad("Hit or stand.");
  }

  // Goalie Mode
  const streak = typeof s.streak === "number" ? s.streak : 0;
  const shot = (s.shot ?? null) as GoalieShot | null;
  const issuedAt = typeof s.issuedAt === "number" ? s.issuedAt : 0;
  if (action === "dive") {
    if (!shot) return bad("No shot is coming.");
    let input: DiveInput | null = null;
    if (isObj(raw.dive)) {
      const d = raw.dive;
      if (!fin(d.commitT) || !fin(d.targetX) || !fin(d.targetZ)) return bad("That dive isn't readable.");
      input = { commitT: d.commitT, targetX: d.targetX, targetZ: d.targetZ };
    }
    if (ctx.now - issuedAt < shot.arriveAtT * 1000 - DIVE_EARLY_SLACK_MS) {
      return bad("Too quick — the ball hadn't arrived.", 409);
    }
    const result = resolveDive(shot, input);
    if (!result.saved) return save({}, { saved: false, streak, result, payout: 0, done: true }, 0);
    return save({ streak: streak + 1, shot: null, issuedAt: 0 }, { saved: true, streak: streak + 1, result, done: false });
  }
  if (action === "next") {
    if (shot) return ok({ shot, streak });
    const next = pickShot(streak, ctx.rng);
    return save({ streak, shot: next, issuedAt: ctx.now }, { shot: next, streak });
  }
  if (action === "cashout") {
    if (shot) return bad("Save the shot first.");
    const payout = Math.round(row.stake * streakMultiplier(streak));
    return save({}, { payout, streak, done: true }, payout);
  }
  return bad("Dive, next or cash out.");
}

/** For the table's verify notes and the guard: the net of a list of rows. */
export function netOf(rows: { net: number }[]): number {
  return rows.reduce((s, r) => s + (Number.isFinite(r.net) ? r.net : 0), 0);
}
