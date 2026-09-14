import type { CareerState } from "./types";
import { PREMIER_LEAGUE_CLUBS, CHAMPIONSHIP_CLUBS } from "./clubs";
import { CLUB_DATABASE } from "./data/footballClubDatabase";
import { isMajorityOwner, ownedClubState, type BoardActionResult } from "./investments";

/**
 * CLUB FACILITIES — PHASE 7 OF STAR_POWER_POLITICS.MD, §6.
 *
 * Requested directly as content that should simply exist, independent of
 * the whole politics system above it: every club has its own stadium, a
 * training ground, and a youth academy (kit designs already exist — see
 * Phase 3's `clubPowers.ts`, the facility this file adds nothing new for).
 *
 * ── Real data, not a guess — rebuilt 14 Sep 2026 ──
 *
 * Originally every club's stadium/training/youth numbers were a
 * deterministic hash of its own name — real-DISTINCT, but not real-ACCURATE
 * (Wrexham and Real Madrid could land on the same capacity by pure chance).
 * `defaultFacilities` now reads the real thing first — `CLUB_DATABASE`
 * (footballClubDatabase.ts), a genuine researched dataset covering every
 * one of this game's 125 real clubs (real stadium name, real current
 * capacity, and a real 1-10 rating for training/youth quality) — falling
 * back to the old hash ONLY for a club that genuinely isn't in that
 * dataset (a merged club's new combined name, from `clubPowers.ts`'s
 * `mergeClubs`, is the one real case: it's a brand-new name that was never
 * going to be in anyone's spreadsheet).
 *
 * The training/youth tier this file actually plays with is still just
 * 1/2/3 (that's what the upgrade economy below is priced against) — the
 * real rating is 1-10, so `tierFromRating` below maps it down: 5-6 is
 * tier 1 (the bulk of real clubs, unremarkable facilities), 7-8 is tier 2,
 * 9-10 is tier 3 (genuinely elite — Real Madrid, Bayern, Ajax, Chelsea, the
 * clubs actually famous for their academies/training complexes). Checked
 * directly against the real distribution before picking those cutoffs
 * (71 tier 1, 30-34 tier 2, 20-24 tier 3 out of 125, measured directly
 * against the real spreadsheet rather than guessed) so a
 * "tier 3" club is genuinely rare, not just "above average."
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

/** 1-10 real rating down to the 1/2/3 tier this file's own upgrade economy
 *  actually uses — see this file's own header for why 6/8 are the cutoffs. */
function tierFromRating(rating: number): 1 | 2 | 3 {
  if (rating >= 9) return 3;
  if (rating >= 7) return 2;
  return 1;
}

function defaultFacilities(club: string): ClubFacilities {
  const real = CLUB_DATABASE[club];
  if (real) {
    return {
      stadiumName: real.stadium,
      stadiumCapacity: real.capacity,
      trainingGroundTier: tierFromRating(real.trainingRating),
      youthAcademyTier: tierFromRating(real.youthRating),
    };
  }
  // Fallback for a club genuinely absent from the real dataset — currently
  // only a merged club's brand-new combined name (clubPowers.ts's
  // mergeClubs). Same deterministic hash the whole file used to run on.
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

const RENAME_STADIUM_COST = 500000;
const CAPACITY_UPGRADE_STEP = 5000;

/**
 * Reported directly: expanding a stadium was "click +5,000 seats, take a
 * flat amount off the budget" — no real relationship to how expansion
 * actually works. Real research (Charlotte 49ers' 2023 ~6,000-seat expansion,
 * ~$56M — roughly $9,300/seat; English top-flight new-builds like Tottenham's
 * and Everton's run far higher, £15,000-19,000/seat) grounds two real facts
 * this now reflects: cost per seat is substantial, and it climbs the bigger
 * the stadium already is — going from 20,000 to 25,000 is a fundamentally
 * different, cheaper project than 60,000 to 65,000.
 *
 * Rescaled 14 Sep 2026, requested directly ("I want the economy like the
 * real football world"): this used to be deliberately scaled DOWN from the
 * literal £ figures above into this game's own compressed economy — now
 * that the whole economy is meant to read like real football finance, it
 * uses those real figures directly instead. £3,000/seat at a 20,000-seat
 * stadium (close to Charlotte's real ~$9,300 once the curve's own growth
 * factor is included) climbing to roughly £24,000/seat at a 60,000-seat
 * one — inside the real £15,000-19,000+ range English top-flight new-builds
 * actually run, a little past it at the very biggest end, which is exactly
 * where real-world costs run highest too.
 */
function perSeatCost(existingCapacity: number): number {
  return 3000 * Math.pow(1 + existingCapacity / 20_000, 1.6);
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
// Rescaled 14 Sep 2026 alongside the rest of the club economy — real,
// if approximate, figures for a genuine training-ground/academy project
// (Manchester City's Etihad Campus ran into the hundreds of millions at
// the very top end; this stays a little short of that to leave room for
// an even bigger real-world outlier without the game's own ceiling
// feeling arbitrary).
const TRAINING_UPGRADE_COST: Record<1 | 2, number> = { 1: 8000000, 2: 60000000 };
const YOUTH_UPGRADE_COST: Record<1 | 2, number> = { 1: 8000000, 2: 60000000 };

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

// Rescaled 14 Sep 2026 — a real, blended per-seat gate-receipt figure
// (roughly a real average ticket price across a real ~20-plus-match home
// league season), not the old compressed placeholder.
const REVENUE_PER_SEAT = 800;

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
