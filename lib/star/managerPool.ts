import type { CareerState } from "./types";
import type { Ambition } from "./expectations";
import { clubExpectation } from "./expectations";
import { mulberry32 } from "./season";
import { clubNameSeed } from "./squadData";
import { divisionOf, PREMIER_LEAGUE_CLUBS, CHAMPIONSHIP_CLUBS, PROMOTION_POOL_CLUBS, type Division } from "./clubs";

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

/**
 * A real, one-off appointment figure for the calibre of manager each tier
 * represents — the anchor a real negotiation (see `managerInterest` below)
 * opens from, same idea as `marketValue.ts`'s player figure. Moved here
 * (out of investments.ts, where it used to be a private, unexported
 * function) so managerNegotiation-facing code can share it without a
 * circular import back into investments.ts.
 */
export function managerBaseFee(name: string): number {
  const tier = managerTier(name);
  if (tier === "dream") return 15000000;
  if (tier === 1) return 5000000;
  if (tier === 2) return 1500000;
  if (tier === 3) return 400000;
  return 100000; // an unranked name — a cheap, low-profile hire
}

/**
 * A handful of REAL clubs big enough that a Dream Appointment (Ferguson,
 * Wenger, Klopp) might plausibly leave retirement/his one true club for —
 * requested directly: "unless it was in another league, maybe at a
 * ridiculously high reputation club." Every one of these already sits at
 * investments.ts's own 3.0 prestige ceiling — the handful of clubs this
 * game treats as genuinely world-elite, not ranked against each other.
 */
export const WORLD_GIANT_CLUBS: string[] = ["Real Madrid", "FC Barcelona", "Bayern München", "Paris Saint-Germain"];

export interface ManagerInterest {
  willing: boolean;
  /** Set only when `willing` is false — shown in place of a Negotiate button. */
  reason?: string;
  /** What a negotiation should anchor around — fed straight into
   *  negotiation.ts's `startNegotiation` as `marketValue`. */
  anchorFee: number;
}

const JOB_PRESTIGE: Record<Ambition, number> = { Title: 3, Europe: 2, "Mid-table": 1, Survival: 0 };
const MANAGER_PRESTIGE: Record<PoolTier, number> = { dream: 4, 1: 3, 2: 2, 3: 1 };

/**
 * A within-division ambition (JOB_PRESTIGE above) can't tell a Championship
 * title race from a Premier League one — they'd score identically, which is
 * real, reported wrong: a mid-table CHAMPIONSHIP job read as prestigious as
 * a genuine Premier League survival fight. This is a real, separate step
 * DOWN (or up, for a genuine European giant) a whole division sits from the
 * Premier League baseline, added on top of the within-division rank.
 */
const DIVISION_OFFSET: Record<Division, number> = {
  champions: 2, europa: 1, premier: 0, championship: -2, pool: -3,
};
/** An "Other" club clubs.ts tracks no division for at all — a real, if
 *  untracked, European name (most of the world's clubs). Treated as
 *  slightly above the Premier League baseline: plausible for these, and
 *  the exact number rarely matters once willing/refused is decided. */
const UNTRACKED_DIVISION_OFFSET = 1;

/**
 * The real English-ladder division, checked FIRST — `divisionOf` (clubs.ts)
 * has a known, already-documented bug (see euro.ts's own `ENGLISH_LADDER`
 * workaround): `DIVISION_BY_CLUB` is built by spreading the ladder lists
 * first and the Champions/Europa lists on top of the SAME map, so any club
 * on both (Arsenal, Aston Villa, Liverpool, Man City, Man United, and
 * others most seasons) has its real "premier" tag silently overwritten by
 * "champions"/"europa". Caught here directly: it read Arsenal — a genuine
 * Premier League club that also happens to be IN the Champions League this
 * season — as a bigger job than it actually is for a domestic manager
 * appointment, the exact same class of bug `euro.ts` already had to work
 * around, not fixed at the source since ~19 other call sites depend on
 * today's behaviour.
 */
function ladderDivision(club: string): Division | null {
  if ((PREMIER_LEAGUE_CLUBS as readonly string[]).includes(club)) return "premier";
  if ((CHAMPIONSHIP_CLUBS as readonly string[]).includes(club)) return "championship";
  if ((PROMOTION_POOL_CLUBS as readonly string[]).includes(club)) return "pool";
  return null;
}

/**
 * Whether this real manager would even entertain a job at `club`, and what
 * a negotiation should open around if so.
 *
 * Requested directly, with the exact reasoning given: the three Dream
 * Appointments are "locked" — Ferguson, Wenger and Klopp only ever consider
 * their own club (or, per the exception above, a genuine world giant), and
 * refuse every other job outright, no fee changes that. Every other real
 * name is always willing in principle, but the fee anchor moves hard with
 * how far the job sits below his own level — cheap and eager for a job
 * above his level (a lower-tier manager thrilled at a big chance), steeply
 * priced — "a ridiculous fee" — for one well beneath it. A big enough gap
 * also carries a real, if modest, chance he simply turns the approach down
 * rather than naming any fee at all.
 */
/** `${club}::${managerName}` — the one shared key both this file and
 *  investments.ts's `recordFailedManagerNegotiation` use for a negotiation
 *  cooldown (see CareerState.managerNegotiationCooldowns). */
export function managerCooldownKey(club: string, managerName: string): string {
  return `${club}::${managerName}`;
}

export function managerInterest(career: CareerState, name: string, club: string): ManagerInterest {
  const tier = managerTier(name);
  const baseFee = managerBaseFee(name);

  // Requested directly: a failed negotiation shouldn't be free to retry
  // instantly for the best possible price — this specific man is off the
  // table for THIS specific club until next season.
  const cooldownUntil = career.managerNegotiationCooldowns?.[managerCooldownKey(club, name)];
  if (cooldownUntil !== undefined && career.season < cooldownUntil) {
    return { willing: false, reason: `Talks broke down — ${name} isn't interested again until next season.`, anchorFee: baseFee };
  }

  if (tier === "dream") {
    const willing = dreamClubFor(name) === club || WORLD_GIANT_CLUBS.includes(club);
    return willing
      ? { willing: true, anchorFee: baseFee }
      : { willing: false, reason: `${name}'s heart belongs to ${dreamClubFor(name)}. He won't manage anywhere else.`, anchorFee: baseFee };
  }

  if (tier === undefined) return { willing: true, anchorFee: baseFee };

  const division = ladderDivision(club) ?? divisionOf(club);
  const divisionOffset = division ? DIVISION_OFFSET[division] : UNTRACKED_DIVISION_OFFSET;
  const jobPrestige = JOB_PRESTIGE[clubAmbition(career, club)] + divisionOffset;
  const gap = MANAGER_PRESTIGE[tier] - jobPrestige; // positive = job beneath him

  // A real, bounded refusal chance once the gap is genuinely lopsided — a
  // real name asked to take a job well below his level. Deterministic on
  // the club/name pairing so the same approach doesn't flip-flop on every
  // re-render. Reported directly: an all-time great being merely "a bit
  // pricey" for a mid-table CHAMPIONSHIP job read as far too reasonable —
  // gap 3 used to need a full division-and-a-half of difference to reach at
  // all; with DIVISION_OFFSET now counted, a real gap this size is common
  // enough that the threshold moved down to match.
  if (gap >= 2) {
    const seed = mulberry32(clubNameSeed(club) + clubNameSeed(name));
    if (seed() < 0.25 + Math.min(0.5, (gap - 2) * 0.15)) {
      return { willing: false, reason: `${name} isn't interested in a job well below his level right now.`, anchorFee: baseFee };
    }
  }

  // Every step of gap moves the anchor by 60% — a job well beneath him gets
  // "a ridiculous fee," a job well above his level gets a real discount, on
  // the reasoning "he'd be thrilled and wouldn't ask for as much."
  const anchorFee = Math.max(50000, Math.round(baseFee * Math.pow(1.6, gap)));
  return { willing: true, anchorFee };
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
