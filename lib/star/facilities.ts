import type { CareerState } from "./types";
import { PREMIER_LEAGUE_CLUBS, CHAMPIONSHIP_CLUBS } from "./clubs";
import { isMajorityOwner, ownedClubState, type BoardActionResult } from "./investments";

/**
 * CLUB FACILITIES — PHASE 7 OF STAR_POWER_POLITICS.MD, §6.
 *
 * Requested directly as content that should simply exist, independent of
 * the whole politics system above it: every club has its own stadium, a
 * training ground, and a youth academy (kit designs already exist — see
 * Phase 3's `clubPowers.ts`, the facility this file adds nothing new for).
 *
 * ── Real from the start, not just for clubs you own ──
 *
 * Every one of the ~50+ clubs this game knows about gets real, DISTINCT
 * facilities the moment anything asks for them — a deterministic hash of
 * the club's own name (the same `nameNoise`-style trick promotion.ts's
 * strength estimate already uses for every un-simulated club), seeded
 * along three independent axes so a big stadium doesn't automatically mean
 * a big academy too. Nothing is hand-authored per club, and nothing is
 * generated until it's actually read.
 *
 * ── The one real, modest gameplay hook ──
 *
 * A bigger stadium earns its owner's club real money every season
 * (`creditStadiumRevenue`, wired into `advanceSeason`) — the honest,
 * safely-scoped hook this phase ships with. Deliberately NOT touching
 * `leagueSquads.ts`'s `growWonderkids` (a youth-academy-tier bonus to
 * wonderkid growth would be a very natural second hook, but that function
 * and its two `advanceSeason` call sites are already tested against a
 * fixed signature, and this phase's own brief explicitly allows shipping
 * real facility DATA with "no gameplay hook yet" — see the rollout plan's
 * own Phase 7 note).
 */

export interface ClubFacilities {
  stadiumName: string;
  stadiumCapacity: number;
  trainingGroundTier: 1 | 2 | 3;
  youthAcademyTier: 1 | 2 | 3;
  /** A commissioned expansion under construction — real research behind
   *  this (see `upgradeStadiumCapacity`'s own note): it doesn't just apply
   *  the moment it's paid for. `targetCapacity` is what the stadium becomes
   *  once `seasonsRemaining` counts down to zero via `progressStadiumBuilds`
   *  (wired into `advanceSeason`, same as `creditStadiumRevenue`). */
  stadiumBuild?: { targetCapacity: number; seasonsRemaining: number };
}

function hash(seed: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295; // 0..1
}

function baseCapacityFor(club: string): number {
  if (PREMIER_LEAGUE_CLUBS.includes(club)) return 42000;
  if (CHAMPIONSHIP_CLUBS.includes(club)) return 24000;
  return 16000;
}

function defaultFacilities(club: string): ClubFacilities {
  const capacityNoise = hash(club, 1);
  const trainingNoise = hash(club, 2);
  const youthNoise = hash(club, 3);
  return {
    stadiumName: `${club} Stadium`,
    stadiumCapacity: Math.round(baseCapacityFor(club) * (0.75 + capacityNoise * 0.6)),
    trainingGroundTier: (1 + Math.floor(trainingNoise * 3)) as 1 | 2 | 3,
    youthAcademyTier: (1 + Math.floor(youthNoise * 3)) as 1 | 2 | 3,
  };
}

export function facilitiesFor(career: CareerState, club: string): ClubFacilities {
  return career.facilities?.[club] ?? defaultFacilities(club);
}

function withFacilities(career: CareerState, club: string, patch: Partial<ClubFacilities>): CareerState {
  const current = facilitiesFor(career, club);
  return { ...career, facilities: { ...(career.facilities ?? {}), [club]: { ...current, ...patch } } };
}

// ── Upgrades — majority ownership only, paid from the club's own budget,
// same tier of action as every other Boardroom power ──────────────────────

const RENAME_STADIUM_COST = 2000;
const CAPACITY_UPGRADE_STEP = 5000;

/**
 * Reported directly: expanding a stadium was "click +5,000 seats, take a
 * flat amount off the budget" — no real relationship to how expansion
 * actually works. Real research (Charlotte 49ers' 2023 ~6,000-seat expansion,
 * ~$56M — roughly $9,300/seat; English top-flight new-builds like Tottenham's
 * and Everton's run far higher, £15,000-19,000/seat) grounds two real facts
 * this now reflects: cost per seat is substantial, and it climbs the bigger
 * the stadium already is — going from 20,000 to 25,000 is a fundamentally
 * different, cheaper project than 60,000 to 65,000. `perSeatCost` below is a
 * real curve on existing capacity, not a flat constant, scaled down from
 * literal £ into this game's own economy the same deliberate way
 * `REAL_CLUB_PRESTIGE` (investments.ts) preserves real RELATIVE order rather
 * than real absolute money.
 */
function perSeatCost(existingCapacity: number): number {
  return 0.6 * Math.pow(1 + existingCapacity / 20_000, 1.6);
}

/**
 * Real research on timelines (the same sources as `perSeatCost`'s own
 * note): a stadium expansion of this scale takes roughly two to three real
 * years once work actually starts, not an instant. Given directly, with a
 * worked example — 10,000 extra seats on a 60,000-capacity stadium should
 * take two full seasons — which this matches almost exactly: one season per
 * 5,000 seats added, floored at one season for even a small expansion.
 */
function buildSeasonsFor(seatsAdded: number): number {
  return Math.max(1, Math.round(seatsAdded / 5000));
}

/**
 * Reported directly: it's easy to go from bad facilities to mediocre, hard
 * and expensive to go from great to world-class — a flat cost per tier
 * doesn't capture that at all. The top tier now costs several times the
 * first upgrade, not the same again.
 */
const TRAINING_UPGRADE_COST: Record<1 | 2, number> = { 1: 8000, 2: 60000 };
const YOUTH_UPGRADE_COST: Record<1 | 2, number> = { 1: 8000, 2: 60000 };

function spendFromClubBudget(career: CareerState, club: string, cost: number): CareerState | { ok: false; reason: string } {
  if (!isMajorityOwner(career, club)) return { ok: false, reason: "Not the majority shareholder" };
  const state = ownedClubState(career, club);
  if (state.budget < cost) return { ok: false, reason: "Not enough in the club's own budget" };
  return { ...career, ownedClubs: { ...(career.ownedClubs ?? {}), [club]: { ...state, budget: state.budget - cost } } };
}

export function renameStadium(career: CareerState, club: string, name: string): BoardActionResult {
  const spent = spendFromClubBudget(career, club, RENAME_STADIUM_COST);
  if ("ok" in spent) return { career, ok: false, reason: spent.reason };
  return { career: withFacilities(spent, club, { stadiumName: name }), ok: true };
}

export function upgradeStadiumCapacity(career: CareerState, club: string): BoardActionResult {
  const current = facilitiesFor(career, club);
  if (current.stadiumBuild) return { career, ok: false, reason: "Already expanding — one project at a time" };
  const cost = Math.round(CAPACITY_UPGRADE_STEP * perSeatCost(current.stadiumCapacity));
  const spent = spendFromClubBudget(career, club, cost);
  if ("ok" in spent) return { career, ok: false, reason: spent.reason };
  // Paying for it commissions the work — it doesn't seat a single extra fan
  // until `progressStadiumBuilds` (wired into advanceSeason) finishes
  // counting the real build time down. See perSeatCost/buildSeasonsFor's
  // own notes for the research behind both numbers.
  const seasons = buildSeasonsFor(CAPACITY_UPGRADE_STEP);
  return {
    career: withFacilities(spent, club, {
      stadiumBuild: { targetCapacity: current.stadiumCapacity + CAPACITY_UPGRADE_STEP, seasonsRemaining: seasons },
    }),
    ok: true,
  };
}

/** Called from advanceSeason, alongside creditStadiumRevenue — every club
 *  with a stadium expansion under way ticks one real season closer to it,
 *  and finishing applies the real new capacity. Not majority-ownership
 *  gated here on purpose: a build already commissioned keeps progressing
 *  even if you later sell down your stake, the same way a real construction
 *  project doesn't stop because the shares changed hands. */
export function progressStadiumBuilds(career: CareerState): CareerState {
  const clubs = Object.keys(career.facilities ?? {});
  if (clubs.length === 0) return career;
  let changed = false;
  const next = { ...(career.facilities ?? {}) };
  for (const club of clubs) {
    const f = next[club];
    if (!f?.stadiumBuild) continue;
    const seasonsRemaining = f.stadiumBuild.seasonsRemaining - 1;
    changed = true;
    next[club] = seasonsRemaining <= 0
      ? { ...f, stadiumCapacity: f.stadiumBuild.targetCapacity, stadiumBuild: undefined }
      : { ...f, stadiumBuild: { ...f.stadiumBuild, seasonsRemaining } };
  }
  return changed ? { ...career, facilities: next } : career;
}

export function upgradeTrainingGround(career: CareerState, club: string): BoardActionResult {
  const current = facilitiesFor(career, club);
  if (current.trainingGroundTier >= 3) return { career, ok: false, reason: "Already at the top tier" };
  const cost = TRAINING_UPGRADE_COST[current.trainingGroundTier];
  const spent = spendFromClubBudget(career, club, cost);
  if ("ok" in spent) return { career, ok: false, reason: spent.reason };
  return { career: withFacilities(spent, club, { trainingGroundTier: (current.trainingGroundTier + 1) as 1 | 2 | 3 }), ok: true };
}

export function upgradeYouthAcademy(career: CareerState, club: string): BoardActionResult {
  const current = facilitiesFor(career, club);
  if (current.youthAcademyTier >= 3) return { career, ok: false, reason: "Already at the top tier" };
  const cost = YOUTH_UPGRADE_COST[current.youthAcademyTier];
  const spent = spendFromClubBudget(career, club, cost);
  if ("ok" in spent) return { career, ok: false, reason: spent.reason };
  return { career: withFacilities(spent, club, { youthAcademyTier: (current.youthAcademyTier + 1) as 1 | 2 | 3 }), ok: true };
}

// ── The one real hook: a bigger stadium earns real money, every season ────

const REVENUE_PER_SEAT = 2;

/** Called from advanceSeason — every majority-owned club's stadium pays its
 *  own real gate-receipt revenue into that club's own budget, sized to its
 *  own real capacity. Never touches the player's personal money: a
 *  stadium is a club asset, same as the transfer budget it sits beside. */
export function creditStadiumRevenue(career: CareerState): CareerState {
  // Majority ownership is a fact about `career.investments` (the real
  // stake), not about whether `ownedClubs` already has an entry — that
  // record only gets created the first time some OTHER Boardroom action
  // (funding the budget, signing a player) touches it, so a club bought
  // into but never otherwise acted on would be silently skipped if this
  // only iterated `Object.keys(career.ownedClubs)`.
  const clubs = (career.investments ?? []).map(i => i.club).filter(club => isMajorityOwner(career, club));
  if (clubs.length === 0) return career;
  let changed = false;
  const nextOwned = { ...(career.ownedClubs ?? {}) };
  for (const club of clubs) {
    const revenue = Math.round(facilitiesFor(career, club).stadiumCapacity * REVENUE_PER_SEAT);
    if (revenue <= 0) continue;
    const current = ownedClubState(career, club);
    nextOwned[club] = { ...current, budget: current.budget + revenue };
    changed = true;
  }
  return changed ? { ...career, ownedClubs: nextOwned } : career;
}
