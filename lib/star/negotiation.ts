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
  /** Their hidden limit: the most a buyer will ever pay (selling mode) or the
   *  least a seller will ever take (buying mode). They never concede past it.
   *  Absent = worked out from `marketValue` and `negotiation.limitMargin`. */
  limit?: number;
  /** They were insulted and made one last take-it-or-leave-it offer. Anything
   *  but accepting `theirPosition` now ends the talks. */
  finalOffer?: boolean;
  /** Their very first position — their worst offer is measured from it. */
  opening?: number;
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
  // Small sums round small (Leo, 5 Oct 2026: a ★9-a-week sponsor's counter
  // jumped to ★300 because the smallest step used to be ★100).
  const step = a < 100 ? 1
    : a < 1_000 ? 10
    : a < 5_000 ? 100
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
/** Their hidden limit (see `NegotiationState.limit`). */
export function limitOf(state: Pick<NegotiationState, "limit" | "marketValue" | "mode">): number {
  if (state.limit !== undefined) return state.limit;
  const m = getTuning("negotiation.limitMargin");
  return state.mode === "selling" ? state.marketValue * (1 + m) : state.marketValue * (1 - m);
}

/** True if your position is past what they will ever agree to. */
function beyondLimit(mode: NegotiationMode, position: number, limit: number): boolean {
  return mode === "selling" ? position > limit : position < limit;
}

/** True if your position is so far past their limit it insults them. */
function insulting(mode: NegotiationMode, position: number, limit: number): boolean {
  const k = getTuning("negotiation.outrageousMultiple");
  return mode === "selling" ? position > limit * k : position < limit / k;
}

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

  // You've met or beaten their current position outright — the deal closes
  // at YOUR number. Reported directly, twice now, as confusing the other
  // way round: this used to close at THEIR lower position instead (you
  // "never had to go that high, so it didn't charge you that high") —
  // real, but not what a typed offer should mean. What you actually put on
  // the table is the number that's binding once it clears their ask; if you
  // don't want to pay more than needed, offer less next round instead.
  if (meets(mode, yourNewPosition, state.theirPosition)) {
    const finalPrice = yourNewPosition;
    log.push(mode === "buying"
      ? `Deal — they accept your ★${finalPrice.toLocaleString()} offer.`
      : `Deal — the buyer accepts your ★${finalPrice.toLocaleString()} asking price.`);
    return { ...state, yourPosition: yourNewPosition, status: "accepted", finalPrice, log };
  }

  // They already said it was their final offer. Anything but taking it ends it.
  if (state.finalOffer) {
    log.push(mode === "buying"
      ? "They told you it was final. The agent walks away."
      : "They told you it was final. They walk away.");
    return { ...state, yourPosition: yourNewPosition, moodScore: 0, status: "walked_away", log };
  }

  // Leo, 5 Oct 2026: a sponsor opened at ★9 a week, he asked ★1,000, and they
  // came back at ★300 — meeting in the middle of a silly number. Then Mikey,
  // same day: a fixed rule ("ask a bit over and they always come up to their
  // limit") is just as easy to abuse. So a counterpart has a hidden limit, and
  // every counter you make is a ROLL: usually they come up a random amount
  // (never past the limit), but sometimes they stand firm at their price as a
  // final offer, sometimes they drop to their worst price as a final offer,
  // and sometimes they just leave. The further past their limit you ask, the
  // likelier the bad outcomes — but even a fair ask is never a sure thing.
  const limit = limitOf(state);
  const opening = state.opening ?? state.theirPosition;
  const cut = getTuning("negotiation.finalOfferCut");
  // The worst they will offer you: below their opener (selling) / above it (buying).
  const worst = cleanRound(mode === "buying" ? opening * (1 + cut) : Math.max(1, opening * (1 - cut)));
  const insult = insulting(mode, yourNewPosition, limit);
  const pastLimit = beyondLimit(mode, yourNewPosition, limit);

  const gap = Math.abs(state.theirPosition - yourNewPosition);
  const relativeGap = gap / Math.max(1, state.theirPosition);

  // Close enough that they'll just take it, no further haggling needed.
  if (!pastLimit && relativeGap <= getTuning("negotiation.acceptTolerance")) {
    const finalPrice = yourNewPosition;
    log.push(`Close enough — they accept ★${finalPrice.toLocaleString()}.`);
    return { ...state, yourPosition: yourNewPosition, status: "accepted", finalPrice, log };
  }

  // Did you actually move toward them this round, or stall/lowball again?
  const priorGap = Math.abs(state.theirPosition - state.yourPosition);
  const movedToward = gap < priorGap - 1e-6;

  // Asking past their limit annoys them even when you came down a bit.
  let moodScore = state.moodScore + (insult ? -40 : pastLimit ? (movedToward ? -4 : -15) : (movedToward ? 6 : -12));
  moodScore = Math.max(0, Math.min(100, moodScore));
  const round = state.round + 1;
  const you = `${mode === "buying" ? "You offer" : "You ask"} ★${yourNewPosition.toLocaleString()}`;

  // ── The roll ──
  const baseRisk = insult ? 1 - getTuning("negotiation.insultCounterChance")
    : pastLimit ? getTuning("negotiation.cheekyRisk")
    : getTuning("negotiation.fairRisk");
  // A sour mood makes every bad outcome likelier; a good one, rarer.
  const moodFactor = Math.max(0.6, Math.min(2, 1 + (55 - moodScore) / 55));
  const risk = Math.min(0.97, baseRisk * moodFactor);
  if (rng() < risk) {
    // Which bad outcome. An insult mostly ends in a walkout or their worst
    // price; a fair ask going wrong is mostly them just holding their number.
    const walkShare = insult ? getTuning("negotiation.insultWalkChance") : pastLimit ? 0.3 : 0.2;
    const worstShare = insult ? 0.45 : pastLimit ? 0.35 : 0.3;
    const r = rng();
    if (r < walkShare) {
      log.push(insult
        ? `${you} — insulted, ${mode === "buying" ? "the agent walks" : "they walk"} away.`
        : `${you} — ${mode === "buying" ? "the agent has" : "they've"} had enough and ${mode === "buying" ? "walks" : "walk"} away.`);
      return { ...state, yourPosition: yourNewPosition, moodScore: 0, round, opening, status: "walked_away", log };
    }
    const dropToWorst = r < walkShare + worstShare && worst !== state.theirPosition;
    const final = dropToWorst ? worst : state.theirPosition;
    log.push(dropToWorst
      ? `${you} — ${insult ? "insulted. " : "annoyed. "}${mode === "buying" ? "Final price" : "Final offer"}: ★${final.toLocaleString()}, take it or leave it.`
      : `${you} — they won't budge. ★${final.toLocaleString()} is final, take it or leave it.`);
    return { ...state, yourPosition: yourNewPosition, theirPosition: final, moodScore: Math.min(moodScore, 30), round, opening, finalOffer: true, log };
  }

  // They counter: a random share of the way toward the nearer of your number
  // and their own limit — never past the limit, never the same move twice.
  const target = pastLimit ? limit : yourNewPosition;
  const towardGap = Math.abs(state.theirPosition - target);
  const moodMultiplier = Math.max(0.4, Math.min(1.6, moodScore / 60));
  // concessionRate is the AVERAGE share; each counter lands anywhere from
  // under half of it to over double (0.35 gives 14%-84% of the gap).
  const share = Math.min(1, getTuning("negotiation.concessionRate") * randBetween(rng, 0.4, 2.4) * moodMultiplier);
  const moved = mode === "buying"
    ? Math.max(limit, state.theirPosition - towardGap * share)
    : Math.min(limit, state.theirPosition + towardGap * share);
  const rounded = cleanRound(moved);
  const theirPosition = mode === "buying"
    ? Math.max(rounded, Math.min(state.theirPosition, Math.ceil(limit)))
    : Math.min(rounded, Math.max(state.theirPosition, Math.floor(limit)));

  // Reported directly: repeating the same offer twice in a row both times
  // logged "they come down to ★95,000,000" — the SAME number they were
  // already at. A stalled round still computes a real (if tiny, mood-
  // shrunk) concession, and `cleanRound` can round that tiny move right
  // back to the position they started the round at — the number genuinely
  // didn't move, so the message shouldn't claim it did.
  const theyActuallyMoved = theirPosition !== state.theirPosition;
  if (theyActuallyMoved) {
    log.push(mode === "buying"
      ? `You offer ★${yourNewPosition.toLocaleString()} — they come down to ★${theirPosition.toLocaleString()}.`
      : `You ask ★${yourNewPosition.toLocaleString()} — they raise their offer to ★${theirPosition.toLocaleString()}.`);
  } else {
    log.push(mode === "buying"
      ? `You offer ★${yourNewPosition.toLocaleString()} — they're standing firm at ★${theirPosition.toLocaleString()}.`
      : `You ask ★${yourNewPosition.toLocaleString()} — they're standing firm at ★${theirPosition.toLocaleString()}.`);
  }

  if (round >= getTuning("negotiation.maxRounds")) {
    // Reported directly, twice, as a real bug: this used to force-close the
    // deal at a synthetic AVERAGE of their position and your offer the
    // moment the two were even loosely close — a price you never actually
    // offered or agreed to ("I offered 330, it agreed at 340... I never
    // offered that"). Talks running out of time now only ever closes at a
    // price you genuinely put on the table (the same real "close enough,
    // they accept" rule every other round already uses — see
    // `acceptTolerance` above), never an invented midpoint.
    const finalGap = Math.abs(theirPosition - yourNewPosition);
    const finalRelativeGap = finalGap / Math.max(1, theirPosition);
    if (!pastLimit && finalRelativeGap <= getTuning("negotiation.acceptTolerance")) {
      const finalPrice = yourNewPosition;
      log.push(`Final round — close enough, they accept ★${finalPrice.toLocaleString()}.`);
      return { ...state, yourPosition: yourNewPosition, theirPosition, moodScore, round, opening, status: "accepted", finalPrice, log };
    }
    log.push("Talks run out of time with no deal.");
    return { ...state, yourPosition: yourNewPosition, theirPosition, moodScore, round, opening, status: "rejected", log };
  }

  return { ...state, yourPosition: yourNewPosition, theirPosition, moodScore, round, opening, status: "negotiating", log };
}
