import type { CareerState } from "./types";
import type { Ambition } from "./expectations";
import { clubExpectation } from "./expectations";
import { mulberry32 } from "./season";
import { clubNameSeed } from "./squadData";

/**
 * THE UNEMPLOYED MANAGERS' LIST
 *
 * User-supplied, real-world list of managers without a club, ranked into four
 * tiers by how big a deal landing them would be. `manager.ts`'s sacking flow
 * used to replace a fired manager with either a fully fictional name or —
 * incorrectly — whichever real name happens to be typed into that club's own
 * Lineups sheet, which would have had the just-sacked man "replace himself."
 * This is the actual pool a replacement should be drawn from instead.
 *
 * ── The pool, and why it needs no separate roster ──
 *
 * Only the PLAYER's own club ever fires a manager — no other club in the
 * league is simulated well enough to hold a job, let alone lose one — so
 * "unemployed" only has to mean one thing here: not currently in the job at
 * YOUR club. `CareerState.availableManagers` starts as every name below and
 * shrinks by exactly one name (whoever you just hired) for as long as he
 * holds the job; sacking him returns his name to the list, exactly as
 * requested — "the manager that got sacked no longer has a job so they
 * should be added into this list."
 *
 * ── Dream Appointments ──
 *
 * Locked to one specific club each and reachable only for that club, at very
 * low odds even then — see TIER_ODDS. Nothing stops the man himself being
 * sacked and later re-appointed at the same club in a long enough save;
 * that's a feature, not an oversight, for the same reason any other real
 * name returns to the pool.
 */

export type PoolTier = "dream" | 1 | 2 | 3;

export interface DreamAppointment {
  name: string;
  /** Canonical club name, matching CLUB_NAMES / clubs.ts exactly. */
  club: string;
}

export const DREAM_APPOINTMENTS: DreamAppointment[] = [
  { name: "Sir Alex Ferguson", club: "Manchester United" },
  { name: "Arsène Wenger", club: "Arsenal" },
  { name: "Jürgen Klopp", club: "Liverpool" },
];

/** Level 1 — the biggest realistic names, a genuine coup for any club that lands one. */
export const ELITE_MANAGERS: string[] = [
  "Pep Guardiola", "Antonio Conte", "Arne Slot", "Eddie Howe", "Didier Deschamps",
  "Julian Nagelsmann", "Gareth Southgate", "Zinedine Zidane", "Xavi Hernández",
  "Ernesto Valverde", "Joachim Löw", "Maurizio Sarri", "Thomas Tuchel",
];

/** Level 2 — established, recognisable, a good fit for mid-to-upper clubs. */
export const STRONG_MANAGERS: string[] = [
  "Sean Dyche", "Igor Tudor", "Marcelino", "Erik Ten Hag", "Rafael Benítez",
  "Gennaro Gattuso", "Vincenzo Italiano", "Kasper Hjulmand", "Ole Gunnar Solskjær",
  "Marcelo Bielsa", "Thiago Motta", "Louis van Gaal", "Kieran McKenna",
  "Ronald Koeman", "Claudio Ranieri", "Liam Rosenior", "Roberto Martínez",
  "Ralph Rangnick", "Stefano Pioli",
];

/**
 * Level 3 — still recognisable names, a considerably less prestigious
 * appointment. "Adi Hütter" here, not the "Adolf Hütter" in the list as
 * given — same person (Adolf is the name on his passport; every club,
 * broadcast, and transfer database has only ever called him Adi).
 */
export const RECOGNISABLE_MANAGERS: string[] = [
  "Mick McCarthy", "Steve Bruce", "Imanol Alguacil", "Sam Allardyce", "Laurent Blanc",
  "Bruno Lage", "Steven Gerrard", "Patrick Vieira", "Robin van Persie", "Scott Parker",
  "Adi Hütter", "Ralph Hasenhüttl",
];

const TIER_BY_NAME: Map<string, PoolTier> = new Map([
  ...DREAM_APPOINTMENTS.map((d): [string, PoolTier] => [d.name, "dream"]),
  ...ELITE_MANAGERS.map((n): [string, PoolTier] => [n, 1]),
  ...STRONG_MANAGERS.map((n): [string, PoolTier] => [n, 2]),
  ...RECOGNISABLE_MANAGERS.map((n): [string, PoolTier] => [n, 3]),
]);

const DREAM_CLUB_BY_NAME: Map<string, string> = new Map(
  DREAM_APPOINTMENTS.map(d => [d.name, d.club]),
);

/** Every named manager, dream tier included — the pool's starting roster. */
export function allPoolManagers(): string[] {
  return [
    ...DREAM_APPOINTMENTS.map(d => d.name),
    ...ELITE_MANAGERS,
    ...STRONG_MANAGERS,
    ...RECOGNISABLE_MANAGERS,
  ];
}

/** Which tier a pool name belongs to, or undefined for a fictional/unlisted name. */
export function managerTier(name: string): PoolTier | undefined {
  return TIER_BY_NAME.get(name);
}

/** The one club a Dream Appointment can join, or undefined for every other name. */
export function dreamClubFor(name: string): string | undefined {
  return DREAM_CLUB_BY_NAME.get(name);
}

/** Reputation (see manager.ts) a hire from each tier should land in. */
export const TIER_REPUTATION_RANGE: Record<PoolTier, { min: number; max: number }> = {
  dream: { min: 95, max: 100 },
  1: { min: 80, max: 98 },
  2: { min: 50, max: 77 },
  3: { min: 20, max: 48 },
};

/**
 * Odds of a REAL name from each tier landing the job, keyed by the hiring
 * club's own ambition (clubExpectation) — a title-chasing job can plausibly
 * turn a big name's head, a relegation fight mostly can't. Whatever's left
 * after these four goes to a fictional, freshly generated name (unchanged
 * from how every appointment worked before this pool existed). Dream odds
 * only ever pay off for a club with an actual Dream Appointment on file —
 * elsewhere that slice of probability falls through to Level 1 instead of
 * being wasted on a roll nothing can satisfy.
 */
const TIER_ODDS: Record<Ambition, { dream: number; 1: number; 2: number; 3: number }> = {
  Title: { dream: 0.015, 1: 0.25, 2: 0.35, 3: 0.20 },
  Europe: { dream: 0, 1: 0.08, 2: 0.32, 3: 0.30 },
  "Mid-table": { dream: 0, 1: 0.02, 2: 0.16, 3: 0.32 },
  Survival: { dream: 0, 1: 0, 2: 0.05, 3: 0.25 },
};

export interface PoolPick {
  name: string;
  tier: PoolTier;
}

/**
 * Rolls for a replacement manager from the pool of currently-unemployed real
 * names. Returns null when the roll lands on "fictional" or when the rolled
 * tier (after the dream-club fallback below) has nobody actually available —
 * either way the caller generates a fictional name exactly as before.
 *
 * Pure and deterministic given `rng` — mirrors manager.ts's own mulberry32
 * seeding so a replay of the same season/club produces the same appointment.
 */
export function rollReplacementManager(
  available: string[],
  club: string,
  ambition: Ambition,
  rng: () => number,
): PoolPick | null {
  const odds = TIER_ODDS[ambition];
  const availableSet = new Set(available);
  const roll = rng();

  // Cumulative thresholds in prestige order: dream, then 1, 2, 3, then
  // whatever's left is fictional. A dream roll with no eligible candidate
  // (wrong club, or he's already in the job) falls through to Level 1
  // instead of being thrown away.
  let cursor = 0;
  const tryTier = (tier: PoolTier, pool: string[]): PoolPick | null => {
    const candidates = pool.filter(n => availableSet.has(n));
    if (candidates.length === 0) return null;
    return { name: candidates[Math.floor(rng() * candidates.length)], tier };
  };

  cursor += odds.dream;
  if (roll < cursor) {
    const dreamName = DREAM_APPOINTMENTS.find(d => d.club === club)?.name;
    const dreamPick = dreamName ? tryTier("dream", [dreamName]) : null;
    if (dreamPick) return dreamPick;
    // Falls through to Level 1 below rather than being wasted.
  }

  cursor += odds[1];
  if (roll < cursor) {
    const pick = tryTier(1, ELITE_MANAGERS);
    if (pick) return pick;
  }

  cursor += odds[2];
  if (roll < cursor) {
    const pick = tryTier(2, STRONG_MANAGERS);
    if (pick) return pick;
  }

  cursor += odds[3];
  if (roll < cursor) {
    const pick = tryTier(3, RECOGNISABLE_MANAGERS);
    if (pick) return pick;
  }

  return null;
}

/** A fresh rng seeded the same way manager.ts's own appointments already are. */
export function managerRng(career: CareerState, club: string, season: number): () => number {
  return mulberry32(clubNameSeed(club) + season * 7717 + Math.round(career.starRating * 7) + 3);
}

export function clubAmbition(career: CareerState, club: string): Ambition {
  return clubExpectation({ ...career, player: { ...career.player, club } }).ambition;
}
