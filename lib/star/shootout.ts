/**
 * PENALTY SHOOTOUTS AND EXTRA TIME.
 *
 * A knockout cannot be drawn. Until now this game answered that with a single
 * weighted coin flip (`cups.ts`'s old `shootout()`, and `euro.ts`'s
 * `settleTie`'s own inline version) — no extra time, no actual kicks, just a
 * result. This is the real thing: extra time where the competition actually
 * has it, then a genuine penalty shootout — kicks taken alternately, a
 * running score, sudden death once 5-a-side is exhausted, and an early stop
 * the moment the trailing side can no longer possibly draw level within the
 * initial 5 kicks each.
 *
 * Pure, fully unit-testable functions — the same "engine logic is pure and
 * tested separately from whatever drives it" split as canvasEngine.ts vs
 * CanvasMatch.tsx.
 */

// ── Per-competition extra-time rules ────────────────────────────────────────

export type ExtraTimeCompetition =
  | "League Cup" | "FA Cup" | "Champions League" | "Europa League" | "Conference League"
  | "Super Cup" | "Community Shield" | "Charity Shield";

/**
 * Does this competition (at this round) play extra time before penalties?
 *
 *  - League Cup: only the Final.
 *  - FA Cup: every round.
 *  - Champions League / Europa League: every knockout tie (decided on
 *    aggregate — see `settleAggregateTie` below).
 *  - Super Cup / Community Shield / Charity Shield: never — straight to
 *    penalties if level after 90.
 */
export function hasExtraTime(competition: ExtraTimeCompetition, round: string): boolean {
  switch (competition) {
    case "League Cup": return round === "Final";
    case "FA Cup": return true;
    case "Champions League": return true;
    case "Europa League": return true;
    case "Conference League": return true;
    case "Super Cup": return false;
    case "Community Shield": return false;
    case "Charity Shield": return false;
    default: return false;
  }
}

// ── Simple scorelines (used for AI-simulated ties, not the live match) ─────

function poisson(lambda: number, rng: () => number): number {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= rng(); } while (p > L);
  return k - 1;
}

/** A 90-minute scoreline between two clubs. Same shape cups.ts's own
 *  `tieScore` already used — kept here too so `playKnockoutTie` is
 *  self-contained. */
export function ninetyMinuteScore(homeStr: number, awayStr: number, rng: () => number): { hs: number; as: number } {
  const h = homeStr + 3;
  return {
    hs: poisson(Math.max(0.3, (h / awayStr) * 1.4), rng),
    as: poisson(Math.max(0.2, (awayStr / h) * 1.1), rng),
  };
}

/** Extra time is a real, separate 30 minutes — a third the rate of a full
 *  90, not a second helping of the same intensity. */
export function extraTimeScore(homeStr: number, awayStr: number, rng: () => number): { hs: number; as: number } {
  const h = homeStr + 3;
  return {
    hs: poisson(Math.max(0.1, (h / awayStr) * 1.4 / 3), rng),
    as: poisson(Math.max(0.08, (awayStr / h) * 1.1 / 3), rng),
  };
}

// ── The shootout state machine ──────────────────────────────────────────────

export type ShootoutSide = "home" | "away";

export interface ShootoutKick {
  side: ShootoutSide;
  /** Index into that side's own roster — wraps back to 0 past the 11th man,
   *  same taker retaking in the same order (see `takerIndexFor`). */
  takerIndex: number;
  scored: boolean;
  /** 1-based. Rounds 1-5 are the initial phase; 6+ is sudden death. */
  round: number;
}

export interface PenaltyShootoutState {
  kicks: ShootoutKick[];
  homeScore: number;
  awayScore: number;
  over: boolean;
  winner: ShootoutSide | null;
}

/** How many kicks make up the initial, simultaneous-budget phase. */
export const INITIAL_KICKS_PER_SIDE = 5;

export function createShootout(): PenaltyShootoutState {
  return { kicks: [], homeScore: 0, awayScore: 0, over: false, winner: null };
}

export function sideKicksTaken(state: PenaltyShootoutState, side: ShootoutSide): number {
  return state.kicks.filter(k => k.side === side).length;
}

/** Whose turn is it — home always goes first in a round, then away. */
export function nextShootoutSide(state: PenaltyShootoutState): ShootoutSide {
  return state.kicks.length % 2 === 0 ? "home" : "away";
}

/** Which of that side's own takers is up — real players taken in order,
 *  wrapping back to the 1st man once everyone (up to `rosterSize`, normally
 *  11) has had a turn, exactly as it works in real football once a shootout
 *  runs past 11-a-side. */
export function nextTakerIndex(state: PenaltyShootoutState, side: ShootoutSide, rosterSize = 11): number {
  return sideKicksTaken(state, side) % Math.max(1, rosterSize);
}

/**
 * The mathematical-certainty check for the initial 5-a-side phase: once the
 * trailing side's maximum possible final score (its current score plus every
 * kick it has left in this phase) can no longer reach the leading side's
 * CURRENT score, it's over — the trailing side never has to take its
 * remaining kicks.
 *
 * Worked example this was built against: home scores 1-2-3 (3-0), away
 * misses 1-2-3 (0-0). After home's 3rd kick alone, this is NOT yet certain —
 * away could still reach 3 (2 kicks left, needs both). The instant away also
 * misses their 3rd (now 3-0, 2 kicks left each), away's ceiling is 0+2=2 <
 * home's floor of 3 — over, right there, without either side taking their
 * 4th or 5th kick.
 */
function checkInitialPhaseOver(state: PenaltyShootoutState): PenaltyShootoutState {
  const homeTaken = sideKicksTaken(state, "home");
  const awayTaken = sideKicksTaken(state, "away");
  const homeRemaining = INITIAL_KICKS_PER_SIDE - homeTaken;
  const awayRemaining = INITIAL_KICKS_PER_SIDE - awayTaken;
  const homeMax = state.homeScore + Math.max(0, homeRemaining);
  const awayMax = state.awayScore + Math.max(0, awayRemaining);
  if (state.homeScore > awayMax) return { ...state, over: true, winner: "home" };
  if (state.awayScore > homeMax) return { ...state, over: true, winner: "away" };
  if (homeTaken >= INITIAL_KICKS_PER_SIDE && awayTaken >= INITIAL_KICKS_PER_SIDE) {
    if (state.homeScore !== state.awayScore) {
      return { ...state, over: true, winner: state.homeScore > state.awayScore ? "home" : "away" };
    }
  }
  return state;
}

/**
 * Sudden death: one kick each per round, continuing until a round where one
 * side scores and the other doesn't — a round where both score or both miss
 * simply continues to the next one.
 */
function checkSuddenDeathOver(state: PenaltyShootoutState): PenaltyShootoutState {
  const last = state.kicks[state.kicks.length - 1];
  if (!last) return state;
  const roundKicks = state.kicks.filter(k => k.round === last.round);
  if (roundKicks.length < 2) return state; // away hasn't kicked yet this round
  const home = roundKicks.find(k => k.side === "home")!;
  const away = roundKicks.find(k => k.side === "away")!;
  if (home.scored !== away.scored) {
    return { ...state, over: true, winner: home.scored ? "home" : "away" };
  }
  return state;
}

/** Is this kick part of the initial 5-a-side phase, or sudden death? A kick's
 *  own `round` says it directly — sudden death only ever starts once BOTH
 *  sides have taken all 5 of their initial kicks. */
function isSuddenDeathRound(round: number): boolean {
  return round > INITIAL_KICKS_PER_SIDE;
}

/**
 * Advance the shootout by one kick. `scored` is the real outcome of that
 * kick — decided by the caller (a live penalty for the player's own turn, a
 * skill-weighted roll for every other kick — see `penaltyConversionChance`).
 * Returns the state unchanged if the shootout is already over.
 */
export function takeNextKick(
  state: PenaltyShootoutState, scored: boolean, rosterSize = 11,
): PenaltyShootoutState {
  if (state.over) return state;
  const side = nextShootoutSide(state);
  const takerIndex = nextTakerIndex(state, side, rosterSize);
  const round = Math.floor(state.kicks.length / 2) + 1;
  const kick: ShootoutKick = { side, takerIndex, scored, round };
  const kicks = [...state.kicks, kick];
  const homeScore = state.homeScore + (side === "home" && scored ? 1 : 0);
  const awayScore = state.awayScore + (side === "away" && scored ? 1 : 0);
  let next: PenaltyShootoutState = { kicks, homeScore, awayScore, over: false, winner: null };
  next = isSuddenDeathRound(round) ? checkSuddenDeathOver(next) : checkInitialPhaseOver(next);
  return next;
}

export function isShootoutOver(state: PenaltyShootoutState): boolean {
  return state.over;
}

/**
 * A real, skill-weighted penalty conversion chance. Professional penalties
 * convert roughly 75-80% of the time at an ordinary skill level; a poor
 * taker (low shooting/overall) meaningfully worse, an elite one meaningfully
 * better. `skill` is 0-100 — a player's real `shooting` (falling back to
 * `overall`), or a club's `strength` for a purely simulated AI-vs-AI tie
 * where no individual taker is modelled.
 */
export function penaltyConversionChance(skill?: number): number {
  const s = skill ?? 65;
  return Math.max(0.45, Math.min(0.95, 0.55 + (s - 30) * 0.008));
}

/**
 * Run a whole shootout to completion in one call — for a simulated AI-vs-AI
 * tie (cups.ts's non-player rounds, and any tie resolved without the player
 * actually watching it kick by kick). `homeSkill`/`awaySkill` are flat
 * per-side conversion inputs (a club's strength, or an averaged squad
 * quality) since no individual taker order matters when nobody's watching.
 */
export function simulateShootout(
  homeSkill: number, awaySkill: number, rng: () => number, rosterSize = 11,
): { home: number; away: number; state: PenaltyShootoutState } {
  let state = createShootout();
  const homeChance = penaltyConversionChance(homeSkill);
  const awayChance = penaltyConversionChance(awaySkill);
  // Bounded guard against a pathological infinite sudden death (both sides
  // converting or missing in lockstep forever) — vanishingly unlikely with a
  // real conversion chance, but a pure function must still terminate.
  for (let guard = 0; guard < 200 && !state.over; guard++) {
    const side = nextShootoutSide(state);
    const chance = side === "home" ? homeChance : awayChance;
    state = takeNextKick(state, rng() < chance, rosterSize);
  }
  return { home: state.homeScore, away: state.awayScore, state };
}

// ── Aggregate two-legged ties (Champions League / Europa League) ───────────

export interface AggregateTieResult {
  /** Home/away here mean "first leg's home side" / "first leg's away side" —
   *  aggregate score is symmetric either way. */
  firstLegHome: string;
  firstLegAway: string;
  firstLegScore: { hs: number; as: number };
  secondLegScore: { hs: number; as: number };
  /** Extra time added to the SECOND leg's score, when it was needed. */
  extraTime?: { hs: number; as: number };
  wentToPenalties: boolean;
  pens?: { home: number; away: number };
  winner: string;
}

/**
 * Settle a two-legged aggregate tie once both 90-minute legs are known.
 *
 * If either side is already ahead on aggregate after 90 minutes of the
 * second leg, they win outright — no extra time needed. Level on aggregate
 * after 90 and the competition allows it (Champions/Europa League always
 * do), extra time is played (added to the second leg's own score — this is
 * genuinely minutes 90-120 of that same match). Still level after 120 on
 * aggregate → penalties.
 *
 * `secondLegHomeStrength`/`secondLegAwayStrength` are the two clubs' own
 * strengths, used only to generate the extra-time score/shootout for a
 * SIMULATED tie — a live tie the player is actually watching in CanvasMatch
 * decides extra time/the shootout itself and should pass its own final
 * figures in as `secondLegScore`/`extraTime`/`pens` already resolved rather
 * than calling this function at all (see CanvasMatch.tsx's own extra-time/
 * shootout phase).
 */
export function settleAggregateTie(
  firstLegHome: string, firstLegAway: string,
  firstLegScore: { hs: number; as: number },
  secondLegScore90: { hs: number; as: number },
  secondLegHomeStrength: number, secondLegAwayStrength: number,
  competition: "Champions League" | "Europa League",
  rng: () => number,
): AggregateTieResult {
  // Aggregate: firstLegHome's total = their first-leg home goals + their
  // second-leg away goals (the second leg is played at the other ground).
  const homeAgg90 = firstLegScore.hs + secondLegScore90.as;
  const awayAgg90 = firstLegScore.as + secondLegScore90.hs;

  if (homeAgg90 !== awayAgg90) {
    return {
      firstLegHome, firstLegAway, firstLegScore, secondLegScore: secondLegScore90,
      wentToPenalties: false, winner: homeAgg90 > awayAgg90 ? firstLegHome : firstLegAway,
    };
  }

  if (!hasExtraTime(competition, "knockout")) {
    // Never actually reached for Champions/Europa League (both always have
    // extra time) — kept for completeness/type-safety if this is ever
    // called for a competition that doesn't.
    const pens = simulateShootout(secondLegHomeStrength, secondLegAwayStrength, rng);
    return {
      firstLegHome, firstLegAway, firstLegScore, secondLegScore: secondLegScore90,
      wentToPenalties: true, pens: { home: pens.home, away: pens.away },
      winner: pens.home > pens.away ? firstLegHome : firstLegAway,
    };
  }

  // Extra time — the second leg's own home/away sides play on.
  const et = extraTimeScore(secondLegHomeStrength, secondLegAwayStrength, rng);
  const secondLegFull = { hs: secondLegScore90.hs + et.hs, as: secondLegScore90.as + et.as };
  const homeAgg120 = firstLegScore.hs + secondLegFull.as;
  const awayAgg120 = firstLegScore.as + secondLegFull.hs;

  if (homeAgg120 !== awayAgg120) {
    return {
      firstLegHome, firstLegAway, firstLegScore, secondLegScore: secondLegFull, extraTime: et,
      wentToPenalties: false, winner: homeAgg120 > awayAgg120 ? firstLegHome : firstLegAway,
    };
  }

  const pens = simulateShootout(secondLegHomeStrength, secondLegAwayStrength, rng);
  return {
    firstLegHome, firstLegAway, firstLegScore, secondLegScore: secondLegFull, extraTime: et,
    wentToPenalties: true, pens: { home: pens.home, away: pens.away },
    winner: pens.home > pens.away ? firstLegHome : firstLegAway,
  };
}

// ── Single-match knockout ties (League Cup / FA Cup / Super Cup / Shield) ──

export interface KnockoutTieResult {
  hs: number;
  as: number;
  /** True when extra time was actually played (score already includes it). */
  wentToExtraTime: boolean;
  pens?: { home: number; away: number };
}

/**
 * Play a single-match knockout tie to a real result — 90 minutes, then extra
 * time if the competition/round allows it and it's level, then penalties if
 * it's still level. Used for a SIMULATED tie (cups.ts's other rounds); the
 * player's own live tie is resolved inside CanvasMatch and handed in with
 * `pens` already attached (see cups.ts's `playCupRound`).
 */
export function playKnockoutTie(
  homeStr: number, awayStr: number,
  competition: ExtraTimeCompetition, round: string,
  rng: () => number,
): KnockoutTieResult {
  const ninety = ninetyMinuteScore(homeStr, awayStr, rng);
  let hs = ninety.hs, as = ninety.as;
  let wentToExtraTime = false;

  if (hs === as && hasExtraTime(competition, round)) {
    wentToExtraTime = true;
    const et = extraTimeScore(homeStr, awayStr, rng);
    hs += et.hs; as += et.as;
  }

  if (hs === as) {
    const shootout = simulateShootout(homeStr, awayStr, rng);
    return { hs, as, wentToExtraTime, pens: { home: shootout.home, away: shootout.away } };
  }

  return { hs, as, wentToExtraTime };
}
