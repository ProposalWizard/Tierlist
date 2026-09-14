import { getTuning } from "./tuningStore";

/**
 * PLAYER TRANSFER NEGOTIATION.
 *
 * Requested directly: buying and selling players used to just hand over a
 * fixed fee — no back-and-forth, no chance to get a better deal, no risk of
 * losing one. This is a real, round-based negotiation against a counterpart
 * (their agent when buying, an interested buyer's club when selling) that
 * opens away from `marketValue` on purpose (a seller always asks above it, a
 * buyer always lowballs under it — nobody opens at "fair"), concedes toward
 * you a little each round scaled by their mood, and can genuinely end in a
 * walkout if you push a mood that's already gone sour.
 *
 * Pure, deterministic given an `rng`, no React/CareerState knowledge — same
 * split every other engine module here keeps (dribble.ts, competitionBetting.ts):
 * the caller (NegotiationScreen.tsx) drives the UI loop, this only computes.
 */

export type NegotiationMode = "buying" | "selling";
export type CounterpartMood = "happy" | "neutral" | "angry";

export type NegotiationStatus = "negotiating" | "accepted" | "rejected" | "walked_away";

export interface NegotiationState {
  marketValue: number;
  mode: NegotiationMode;
  round: number;
  /** Your most recent offer (buying) or asking price (selling). */
  yourPosition: number;
  /** Their current ask (buying) or offer (selling). */
  theirPosition: number;
  moodScore: number; // 0-100, 100 = delighted
  status: NegotiationStatus;
  finalPrice?: number;
  log: string[];
}

function moodBucket(score: number): CounterpartMood {
  if (score >= 65) return "happy";
  if (score >= 35) return "neutral";
  return "angry";
}

export function moodToFace(state: NegotiationState): CounterpartMood {
  return moodBucket(state.moodScore);
}

function randBetween(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

/**
 * Reported directly, 14 Sep 2026: the counterpart's own numbers ("they
 * offered sixteen thousand one hundred and seventy six") read as oddly
 * precise — a real agent/buyer opens and concedes toward round, sayable
 * numbers, not the raw output of a percentage formula. Deliberately never
 * applied to YOUR OWN typed/preset amount — free-typing an exact number
 * (or the negotiation screen's own presets) stays exactly what you entered.
 * The step widens with the amount the same "clean numbers" idea
 * `niceMoneyStep` (money.ts) already uses for the UI's own +/- stepper,
 * just tuned finer here — a stepper button and a spoken counter-offer
 * don't need the same granularity, and money.ts's own steps (500 below
 * ★10k) rounded 16,166 down to 15,000, a visibly bigger jump than the
 * ★16,000 the reported example actually expected.
 */
function cleanRound(amount: number): number {
  const sign = amount < 0 ? -1 : 1;
  const a = Math.abs(amount);
  const step = a < 5_000 ? 100
    : a < 50_000 ? 500
    : a < 500_000 ? 5_000
    : a < 5_000_000 ? 50_000
    : a < 50_000_000 ? 500_000
    : 5_000_000;
  return sign * Math.max(step, Math.round(a / step) * step);
}

/**
 * Open the negotiation. A seller (buying mode's counterpart) always anchors
 * above market value; a buyer (selling mode's counterpart) always anchors
 * under it — real opening positions are never "fair," that's what the
 * rounds are for.
 */
export function startNegotiation(marketValue: number, mode: NegotiationMode, rng: () => number): NegotiationState {
  const theirPosition = cleanRound(mode === "buying"
    ? marketValue * (1 + randBetween(rng, getTuning("negotiation.sellerAnchorMin"), getTuning("negotiation.sellerAnchorMax")))
    : marketValue * (1 - randBetween(rng, getTuning("negotiation.buyerAnchorMin"), getTuning("negotiation.buyerAnchorMax"))));
  // Only the SUGGESTED starting point, not a real position of yours until
  // you actually submit it — cleaned the same way for the same reason, but
  // free-typing over it afterward is completely untouched by any of this.
  const yourPosition = cleanRound(mode === "buying"
    ? marketValue * (1 - randBetween(rng, getTuning("negotiation.buyerAnchorMin"), getTuning("negotiation.buyerAnchorMax")))
    : marketValue * (1 + randBetween(rng, getTuning("negotiation.sellerAnchorMin"), getTuning("negotiation.sellerAnchorMax"))));
  return {
    marketValue, mode, round: 0, yourPosition, theirPosition,
    moodScore: 60, status: "negotiating",
    log: [mode === "buying"
      ? `Their agent opens at ★${theirPosition.toLocaleString()}.`
      : `An interested buyer opens at ★${theirPosition.toLocaleString()}.`],
  };
}

/** True if `offer` has met or beaten `target` from the negotiator's own
 *  favourable direction — lower is better when buying, higher is better
 *  when selling. */
function meets(mode: NegotiationMode, offer: number, target: number): boolean {
  return mode === "buying" ? offer >= target : offer <= target;
}

/**
 * Make your move: a new offer (buying) or a new asking price (selling).
 * Returns a NEW state — never mutates.
 */
export function makeOffer(state: NegotiationState, yourNewPosition: number, rng: () => number): NegotiationState {
  if (state.status !== "negotiating") return state;
  const { mode } = state;
  const log = [...state.log];

  // You've met or beaten their current position outright — deal closes at
  // WHICHEVER number is more favourable to you (their position, since you
  // didn't need to go all the way to your own offer to get there). Reported
  // directly as confusing — offering ★32,000 against their ★16,166 ask and
  // seeing the deal close at ★16,000 read as the game ignoring the offer,
  // when it's actually the opposite: you never had to go that high, so it
  // didn't charge you that high. The extra log line spells that out
  // explicitly whenever your own number and the final price genuinely
  // differ — silent the rest of the time (a close, unremarkable match
  // doesn't need it explained).
  if (meets(mode, yourNewPosition, state.theirPosition)) {
    const finalPrice = state.theirPosition;
    log.push(mode === "buying"
      ? `Deal — they accept ★${finalPrice.toLocaleString()}.`
      : `Deal — the buyer's own ★${finalPrice.toLocaleString()} offer already covers your asking price.`);
    if (finalPrice !== yourNewPosition) {
      log.push(mode === "buying"
        ? `You offered ★${yourNewPosition.toLocaleString()}, but that was more than they needed — you only actually pay ★${finalPrice.toLocaleString()}.`
        : `You asked ★${yourNewPosition.toLocaleString()}, but the buyer was already offering more than that — you get their real ★${finalPrice.toLocaleString()}, not your lower ask.`);
    }
    return { ...state, yourPosition: yourNewPosition, status: "accepted", finalPrice, log };
  }

  const gap = Math.abs(state.theirPosition - yourNewPosition);
  const relativeGap = gap / Math.max(1, state.theirPosition);

  // Close enough that they'll just take it, no further haggling needed.
  if (relativeGap <= getTuning("negotiation.acceptTolerance")) {
    const finalPrice = yourNewPosition;
    log.push(`Close enough — they accept ★${finalPrice.toLocaleString()}.`);
    return { ...state, yourPosition: yourNewPosition, status: "accepted", finalPrice, log };
  }

  // Did you actually move toward them this round, or stall/lowball again?
  const priorGap = Math.abs(state.theirPosition - state.yourPosition);
  const movedToward = gap < priorGap - 1e-6;

  let moodScore = state.moodScore + (movedToward ? 6 : -12);
  moodScore = Math.max(0, Math.min(100, moodScore));

  // Below the walk-away floor, a bad round carries a real chance they just leave.
  if (moodScore < getTuning("negotiation.walkAwayMoodFloor") && rng() < getTuning("negotiation.walkAwayChance")) {
    log.push(mode === "buying" ? "They've had enough — the agent walks away." : "The buyer walks away, unhappy with your demands.");
    return { ...state, yourPosition: yourNewPosition, moodScore, status: "walked_away", log };
  }

  const moodMultiplier = Math.max(0.4, Math.min(1.6, moodScore / 60));
  const concession = gap * getTuning("negotiation.concessionRate") * moodMultiplier;
  const theirPosition = cleanRound(mode === "buying"
    ? state.theirPosition - concession
    : state.theirPosition + concession);

  const round = state.round + 1;
  log.push(mode === "buying"
    ? `You offer ★${yourNewPosition.toLocaleString()} — they come down to ★${theirPosition.toLocaleString()}.`
    : `You ask ★${yourNewPosition.toLocaleString()} — they raise their offer to ★${theirPosition.toLocaleString()}.`);

  if (round >= getTuning("negotiation.maxRounds")) {
    const finalGap = Math.abs(theirPosition - yourNewPosition);
    const finalRelativeGap = finalGap / Math.max(1, theirPosition);
    if (finalRelativeGap <= getTuning("negotiation.acceptTolerance") * 2) {
      const finalPrice = cleanRound((theirPosition + yourNewPosition) / 2);
      log.push(`Final round — you split the difference at ★${finalPrice.toLocaleString()}.`);
      return { ...state, yourPosition: yourNewPosition, theirPosition, moodScore, round, status: "accepted", finalPrice, log };
    }
    log.push("Talks run out of time with no deal.");
    return { ...state, yourPosition: yourNewPosition, theirPosition, moodScore, round, status: "rejected", log };
  }

  return { ...state, yourPosition: yourNewPosition, theirPosition, moodScore, round, status: "negotiating", log };
}
