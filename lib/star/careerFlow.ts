// Pure career-progression reducers for the /star-dev football career mode.
// Extracted out of the React page so the season flow is one testable place with
// no UI/state coupling: each function takes a CareerState (+ inputs) and returns
// the next CareerState, never mutating the input's nested objects. The page owns
// phase routing and toasts; this owns the numbers.

import type { CareerState, StarPlayer, Skills, Boot, Fixture, MatchStats, CupRun, Trophy } from "./types";
import {
  buildLeague, buildFixtures, playLeagueWeek, updateLeagueWithUserResult, sortLeague, mulberry32,
  simulateFixtureScore,
} from "./season";
import { recordAppearance, selectionFor, MISSED_WEEK } from "./selection";
import { startNewWeek, WEEK_ACTIONS, actionsLeft, REST_ENERGY } from "./week";
import { judgeSeason } from "./expectations";
import {
  seasonAwards, captaincyEarned, assignSquadNumber, CAPTAIN_TEAM_BONUS,
} from "./recognition";
import { makeManager, sackCheck, bossOnArrival, hireReplacementManager } from "./manager";
import { allPoolManagers } from "./managerPool";
import { rivalryMultiplier } from "./rivalries";
import { horseUpkeep } from "./horse";
import { progressObjectives, rollSponsorSeason } from "./sponsors";
import { appearanceMoney, loyaltyMoney } from "./contracts";
import {
  seedSeasonKnockouts, seedCups, seedEurope, settleEuro, settleCupTie, resolveKnockout,
  qualificationFor, leaguePosition, seasonQualifiers, advanceEliminatedCups, nextFixtureFor,
} from "./competitions";
import { STARTING_EUROPEAN_QUALIFICATION } from "./clubs";
import { finishCupToWinner } from "./cups";
import { simulateShootout } from "./shootout";
import { crownWithoutYou } from "./euro";
import { BOOTS_CATALOGUE } from "./shopData";
import { settleBets, betNewsLines } from "./competitionBetting";
import { checkNewAchievements } from "./achievements";
import { updatePersonalBests } from "./records";
import { computeStarRating, growthMultiplier } from "./rating";
import { REPUTATION_START } from "./reputation";
import { addFame, FAME_EVENTS, wearItems, isWornOut } from "./fame";
import { restDaysBetween, dailyRecovery, energyFactorFor, clampEnergy, ENERGY_FULL_MATCH_MEDIUM } from "./energy";
import { seasonStanding } from "./seasonStanding";
import { considerRecommendations, payPresidentWages } from "./clubPowers";
import { creditStadiumRevenue, facilitiesFor, progressStadiumBuilds } from "./facilities";
import { ruleBookFor } from "./ruleBook";
import { getTuning } from "./tuningStore";
import { generateSquad, clubNameSeed } from "./squadData";
import { transferWindowFor, divisionOf, leagueNameFor, fixtureTimestamp, hasClub, type CareerDivision } from "./calendar";
import { runTransferWindow, runInternationalWindow, returnLoansHome } from "./leagueTransfers";
import { wageForFixture } from "./wages";
import { signingOnFee, typicalWeeklyWage, goalBonusFor, assistBonusFor } from "./economy";
import { resolveLadder, membershipOf } from "./promotion";
import { seedPlayOffs, settlePlayOffFixture, leagueSeasonComplete } from "./playoffs";
import { resetLeagueSquads, syncLeagueStrengthFromSquads, growWonderkids } from "./leagueSquads";
import { advanceIncumbencyWeek } from "./incumbency";
import {
  monthOfCareer, endsMonthOn, alreadyAwarded, voteMonth, catchUpAwards, type MonthAward,
} from "./potm";
import { kitsOf } from "./kits";
import { surname } from "./media/grammar";

export const SPONSOR_CATEGORIES = [
  "Boots", "Sports Drink", "Sports Clothing", "Casual Clothing", "Food",
  "Cosmetics", "Watch", "Electronics", "Jewelry", "Car",
];

const EMPTY_SEASON_STATS = {
  appearances: 0, goals: 0, hatTricks: 0, passes: 0, assists: 0, starMan: 0, totalRating: 0, ratingCount: 0,
};

/** What a full ninety minutes costs — see nextEnergy in creditMatchResult.
 *  Editable at /star-tuning-dev (lib/star/tuning.ts). */
export const ENERGY_MATCH_COST = getTuning("energy.matchCost");

// ── Injury risk ──────────────────────────────────────────────────────────
//
// A real chance on every appearance — a fresh pair of legs still picks up a
// freak knock now and then — that climbs sharply once you are running on
// empty. INJURY_RISK_BASE is what a fully-rested player faces;
// INJURY_RISK_FATIGUE_EXTRA is the most fatigue alone can add on top, phased
// in as end-of-match energy falls through INJURY_FATIGUE_FLOOR.
export const INJURY_RISK_BASE = 0.015;
export const INJURY_FATIGUE_FLOOR = getTuning("energy.injuryFloor");
export const INJURY_RISK_FATIGUE_EXTRA = 0.085;

/**
 * How long it keeps you out. Weighted toward a knock rather than a
 * lay-off — most injuries in a real season are the former.
 */
function rollInjury(rng: () => number): { weeksRemaining: number; note: string } {
  const r = rng();
  if (r < 0.6) {
    const weeks = 1 + Math.floor(rng() * 2); // 1-2
    return { weeksRemaining: weeks, note: `Knock — expected back in ${weeks} week${weeks === 1 ? "" : "s"}` };
  }
  if (r < 0.9) {
    const weeks = 3 + Math.floor(rng() * 2); // 3-4
    return { weeksRemaining: weeks, note: `Injury — expected back in ${weeks} weeks` };
  }
  const weeks = 5 + Math.floor(rng() * 4); // 5-8
  return { weeksRemaining: weeks, note: `Serious injury — expected back in ${weeks} weeks` };
}

/**
 * HOW MANY MATCHES THE FREE PAIR IS GOOD FOR — its own number, not the
 * catalogue's.
 *
 * It used to be neither: a career opened with a literal copy of the
 * cheapest catalogue entry, and that entry happened to say 3 matches, so
 * the boots you are handed on day one wore out after three games without
 * anybody having decided that they should.
 *
 * Boot durability is now derived from price (economy.ts's
 * `bootMatchesFor`), and the cheapest boot in the game is deliberately the
 * longest-lasting — around seventy matches, because a non-league player
 * saving twenty weeks of income for boots cannot also be replacing them
 * every three games. Copying the catalogue entry wholesale would therefore
 * have handed every new career the better part of two free seasons of
 * boots, which quietly removes the first thing the opening of the game is
 * supposed to be about earning.
 *
 * So the free pair keeps the three matches it has always had, stated here
 * rather than inherited by accident. They are a battered pair somebody
 * found for you, not a purchase.
 */
export const STARTER_BOOT_MATCHES = 3;

/**
 * WHO YOU ARE, BEFORE ANYBODY HAS SIGNED YOU.
 *
 * `makeInitialCareer` used to do two unrelated jobs in one breath: invent a
 * person (skills, relationships, reputation, money, cans, sponsors, the
 * week's actions — roughly forty of the fifty-odd fields on `CareerState`)
 * and put that person at a club (league table, fixture list, contract, kit
 * colours, squad, squad number, manager, cups, Europe — the other dozen).
 *
 * That was fine while a career could only ever begin the same way: pick a
 * club on the setup screen, start playing for it the same second. It stops
 * being fine the moment the career OPENS without a club — a trialist, a
 * free agent training in his garden — because there is no honest club to
 * hand the second half of the work, and inventing one just to have one is
 * exactly the kind of fake state that leaks into a save.
 *
 * So the two jobs are two functions. `makeIdentity` gives you a real,
 * complete, playable-shaped `CareerState` with nobody's badge on it: every
 * club-derived field sits at a genuinely empty value (no league, no
 * fixtures, a contract at no club, neutral kit colours, an empty squad)
 * rather than a placeholder pretending to be a club. `attachClub` is the
 * signing: it fills all of them in, in exactly the order the original did.
 *
 * `makeInitialCareer` is kept, and is now literally the two of them in a
 * row, so every existing caller and every test that builds a career this
 * way is untouched and behaves identically.
 */
export function makeIdentity(player: StarPlayer, division: CareerDivision = "premier"): CareerState {
  const starterBoot: Boot = { ...BOOTS_CATALOGUE[0], matches: STARTER_BOOT_MATCHES };
  const state: CareerState = {
    version: 2,
    player,
    skills: {
      pace: getTuning("startingSkills.pace"),
      power: getTuning("startingSkills.power"),
      technique: getTuning("startingSkills.technique"),
      vision: getTuning("startingSkills.vision"),
      freeKick: getTuning("startingSkills.freeKick"),
    },
    lastTrainedWeek: { pace: 1, power: 1, technique: 1, vision: 1, freeKick: 1 },
    relationships: { boss: 60, team: 60, fans: 40, girlfriend: null, sponsors: 0 },
    // A trialist is unknown to the football world and to any governing body
    // or shareholder — low but not zero, the same "unproven, not disliked"
    // starting point `fans: 40` already sets. Club reputation starts higher,
    // matching the fresh-signing optimism `boss`/`team` already open with.
    reputation: REPUTATION_START,
    // ── Nobody has signed you, so there are no terms ──
    //
    // This used to open at ★2,000 a week on a three-year deal at the club
    // picked on the profile screen — a full professional contract handed to a
    // player nobody had offered anything, which is what `makeIdentity` exists
    // to NOT do. The rejection screen said "nothing in the bank" and the next
    // screen showed a wage. The real terms arrive in `attachClub`: either
    // `STARTER_CONTRACT` below, or — the normal path out of a trial — the
    // actual offer the player accepted, written over the top by the scout
    // offer screen.
    //
    // The club is whatever the player already has, which is empty for somebody
    // nobody has signed yet.
    contract: { club: player.club, wage: 0, goalBonus: 0, assistBonus: 0, seasonsRemaining: 0 },
    season: 1,
    division,
    week: 1,
    matchFitness: 80,
    energy: 100,
    injury: null,
    happiness: 60,
    // ── Nothing in the bank, because nothing has been paid ──
    //
    // This used to be ★5,000, on a career nobody had signed. Against the free
    // agent's ★10 a week (freeAgent.ts) that is five hundred weeks of pay
    // sitting there on day one — the whole point of the garden phase being a
    // scrape, handed over before a ball was kicked.
    //
    // It does not arrive later either. The first contract a trial gets you
    // pays NOTHING — see `FIRST_CONTRACT_SIGNING_FEE` — so this zero is the
    // number a career genuinely starts the shop on.
    money: 0,
    // Overwritten just below, once the object actually exists — see
    // computeStarRating's own note. A placeholder here only so every
    // required CareerState field is present in this one literal.
    starRating: 2.5,
    fame: 0,
    seasonStats: { ...EMPTY_SEASON_STATS },
    careerStats: { ...EMPTY_SEASON_STATS },
    // Club-derived, all four. Empty rather than invented — see attachClub.
    fixtures: [],
    league: [],
    // Empty. "first-contract" was unlocked here, on a career that had no
    // contract — `attachClub` unlocks it when there genuinely is one.
    achievements: [],
    status: "1st Team",
    currentBoot: starterBoot,
    kibCans: { basic: 2, premium: 0, elite: 0 },
    ownedItems: [],
    girlfriend: null,
    sponsors: SPONSOR_CATEGORIES.map((c) => ({ category: c, active: false })),
    trophies: [],
    form: [],
    // Your club's actual colours. These were `#ff0000` and `#ffffff` for every
    // club in the game — a Manchester City career stored red — and read by
    // nothing at all. The media graphics build their whole palette off them.
    // With no club yet, `kitsOf` hands back its own neutral pair rather than
    // anybody else's colours.
    kitPrimary: kitsOf(player.club).home.shirt,
    kitSecondary: kitsOf(player.club).home.trim,
    homeCity: "London",
    seenDilemmas: [],
    ballonDorWins: 0,
    horse: null,
    squad: [],
    contractStarMilestones: [],
    contractFormOfferSeason: -1,
    europeanQualification: null,
    weekActions: WEEK_ACTIONS,
    awards: [],
    captain: false,
    clubAppearances: 0,
    cups: [],
    caps: 0,
    internationalGoals: 0,
    knockoutMessage: null,
    // Requested directly: the season's rosters are already hand-curated in
    // the database, so the league AI transfer engine's own first pass —
    // which runs automatically the moment the season's real-world calendar
    // date first lands in a window, not on any deliberate "pre-season"
    // trigger — would immediately rebuild every club's squad on top of that
    // curation before the player has even finished their first match (the
    // season always opens in mid-August, and week 2 already reads as the
    // summer window). Seeding this as already-run for season 1's summer
    // leaves every later window untouched: season 1's January mismatches
    // this key and fires normally, and every season after this one builds
    // its own fresh "<season>-summer"/"<season>-january" key from scratch.
    lastTransferWindowKey: "1-summer",
    // Matches the seed above — a window that never ran has nothing to show
    // a round-up for.
    deadlineDayShownFor: "1-summer",
  };
  // A fresh, unproven eighteen-year-old is meant to read as exactly that —
  // computed off the starting skills (40/40/40/40/30) and an empty honours
  // list, rather than a fixed 2.5 every career opened at regardless of who
  // you actually are yet. Nothing in this computation touches a club, so it
  // is the same number before and after signing for one.
  state.starRating = computeStarRating(state);
  return state;
}

/**
 * PUT AN EXISTING CAREER AT A CLUB.
 *
 * Everything on `CareerState` that only means something once somebody has
 * signed you: the division's league table, your fixture list, the contract's
 * club, your kit colours, the squad around you, your number, the manager,
 * the job market he could be sacked into, both domestic cups and any
 * European campaign the club brings with it.
 *
 * Deliberately does the work in the same order the old single function did,
 * because several of these read the ones before them — the manager's
 * reputation is weighted by the club's ambition, which reads the league, and
 * both cup draws and the European seed read the fixture list they are adding
 * to. Reordering them would quietly change what a given career opens with.
 *
 * Returns a new state; the one passed in is not mutated.
 */
/**
 * What a club pays you the day it signs you, and the deal it opens with.
 *
 * Both used to sit in `makeIdentity`, which meant a career that nobody had
 * signed opened with ★5,000 in the bank and a ★2,000-a-week three-year
 * contract at whichever club was picked on the profile screen. None of that
 * was true: nobody had made an offer, the rejection screen said "nothing in
 * the bank", and the free agent's ★10 a week meant the balance alone was five
 * hundred weeks of pay.
 *
 * They are the SIGNING now. `attachClub` writes the deal the first time a
 * club actually puts its name to you, and pays nothing for it — a
 * signing-on fee is what a LATER move earns you, never the first one. The
 * "first-contract" achievement is what tells the two apart, which is also
 * the honest thing for that achievement to mean.
 *
 * The starter terms are a FALLBACK, not the usual path. A career that reaches
 * a club through the trial is signed on the terms of the offer it accepted —
 * the scout-offer screen writes the real wage, bonuses and length straight
 * over these. These are what `makeInitialCareer` still opens on, which is what
 * keeps every pre-split career, save and test byte-identical.
 */
/**
 * The fallback terms, for a career that arrives here without a deal of its
 * own. Derived from `economy.ts` rather than typed out, so the one curve
 * reaches even the fallback: this is what an ordinary first-teamer at a
 * middling top-flight club is worth, with the bonuses on the same 10%/7% of
 * a week they have always been.
 */
const STARTER_WAGE = Math.round(typicalWeeklyWage("premier"));
export const STARTER_CONTRACT = {
  wage: STARTER_WAGE,
  // Off the shared helpers (economy.ts) rather than re-typing 0.10/0.07 —
  // and off the ROUNDED wage, so the bonuses are the same ones anything
  // else deriving them from this contract's own wage would arrive at.
  goalBonus: goalBonusFor(STARTER_WAGE),
  assistBonus: assistBonusFor(STARTER_WAGE),
  seasonsRemaining: 3,
};

/**
 * ── THE FIRST CONTRACT PAYS NOTHING. ──
 *
 * It used to be `SIGNING_ON_FEE = 5000`, paid identically by Manchester
 * United and by Hornchurch. Reported directly: "I don't think someone
 * signing at a National League club should start at a 5,000 signing-on fee,
 * especially when we spoke about having a bunch of different things in the
 * shop from 0 to 5,000 and having it feel like a bit of a slog at the
 * start."
 *
 * The first attempt at fixing that scaled the fee by the club's reputation.
 * It was still wrong, and the owners said so: ANY windfall on the day a
 * trial gets you signed undoes the opening of the game. You would walk into
 * the National League already able to buy the things the first months are
 * supposed to be about earning. So the first, scouted-out-of-a-trial
 * contract now pays exactly zero, and a career starts on the nothing
 * `makeIdentity` already gave it.
 *
 * The MECHANISM survives, because a real transfer genuinely does come with a
 * signing-on payment: every LATER move pays `signingOnFee` (economy.ts),
 * scaled by the club's real reputation and the wage actually agreed. That is
 * a reward for having got somewhere, which is the opposite of a head start.
 */
export const FIRST_CONTRACT_SIGNING_FEE = 0;

export function attachClub(
  identity: CareerState, club: string, clubs: string[], division: CareerDivision = "premier",
  /**
   * The wage actually agreed, when the caller already knows it.
   *
   * The signing-on fee is a multiple of the wage, and the scout-offer screen
   * writes the real wage onto the contract a moment AFTER this call — so
   * without this the fee would always be computed against the fallback
   * `STARTER_CONTRACT` wage instead of the deal genuinely being signed.
   * Optional, so `makeInitialCareer` and any other caller is unchanged.
   */
  agreedWage?: number,
): CareerState {
  // ── Is this the first club that has ever signed him? ──
  //
  // Read off the achievement rather than off the money or the wage, because
  // both of those are things a career can legitimately be at zero on later
  // (a spent bank balance, an expired deal), and this must fire exactly once.
  const firstSigning = !identity.achievements.includes("first-contract");

  // ── The garden weeks ──
  //
  // `career.week` keeps counting while a free agent sits at home, but a club's
  // fixture list is built starting at week 1 — and transfer windows, Player of
  // the Month, deadline day and the competition-betting cutoff all read the
  // raw `career.week`. So a player who failed a trial, spent twelve weeks in
  // the garden and then signed got the January window while his own fixtures
  // said October, silently and permanently for that save.
  //
  // The week restarts with the fixture list it has to agree with, and the
  // weeks that really did happen are kept on their own field so they still
  // count for the CV rather than being quietly deleted.
  const gardenWeeks = (identity.gardenWeeks ?? 0) + Math.max(0, identity.week - 1);

  const state: CareerState = {
    ...identity,
    // ── Why the nested objects are copied rather than spread along ──
    //
    // `{ ...identity }` is a SHALLOW copy: every nested object it does not
    // explicitly replace is the same object, shared with the identity and with
    // any other career signed from it. That is invisible today, because
    // `makeInitialCareer` attaches exactly one club and throws the identity
    // away — and a JSON comparison can never see it, because aliased objects
    // and copied ones serialise identically.
    //
    // It stops being invisible the moment a trial ends with several clubs
    // wanting you: the offer screen builds a candidate career per club from
    // ONE identity, and the first of them to train, earn or spend would
    // silently move the others' numbers too. Found in review, before there was
    // anything to break.
    skills: { ...identity.skills },
    lastTrainedWeek: { ...identity.lastTrainedWeek },
    relationships: { ...identity.relationships },
    reputation: identity.reputation,
    seasonStats: { ...identity.seasonStats },
    careerStats: { ...identity.careerStats },
    kibCans: { ...identity.kibCans },
    currentBoot: { ...identity.currentBoot },
    sponsors: identity.sponsors.map(sp => ({ ...sp })),
    trophies: [...identity.trophies],
    form: [...identity.form],
    // `achievements` is copied below, where the first-contract unlock is
    // decided — one place, so the copy and the unlock cannot disagree.
    seenDilemmas: [...identity.seenDilemmas],
    ownedItems: [...identity.ownedItems],
    player: { ...identity.player, club },
    // The club, always. The terms only when there are none yet — a career
    // arriving here from the scout-offer screen has the offer's own wage
    // written over the top a moment later anyway, and a later transfer must
    // keep the deal it already has.
    contract: firstSigning && !identity.contract.wage
      ? { ...identity.contract, club, ...STARTER_CONTRACT }
      : { ...identity.contract, club },
    // Nothing on the first contract — see `FIRST_CONTRACT_SIGNING_FEE`. Every
    // later move to a new club pays a real, reputation-scaled fee.
    money: firstSigning
      ? identity.money + FIRST_CONTRACT_SIGNING_FEE
      : identity.money + signingOnFee(club, agreedWage ?? (identity.contract.wage || STARTER_CONTRACT.wage)),
    achievements: firstSigning
      ? [...identity.achievements, "first-contract"]
      : [...identity.achievements],
    // Your fixtures start at week 1, so you do too. See `gardenWeeks` above.
    week: 1,
    ...(gardenWeeks > 0 ? { gardenWeeks } : null),
    division,
    league: buildLeague(clubs, club),
    fixtures: buildFixtures(clubs, club),
    kitPrimary: kitsOf(club).home.shirt,
    kitSecondary: kitsOf(club).home.trim,
    squad: generateSquad(clubNameSeed(club)),
    europeanQualification: STARTING_EUROPEAN_QUALIFICATION[club] ?? null,
  };
  state.squadNumber = assignSquadNumber(state, club);
  state.manager = makeManager(state, club, state.season);
  // The starting roster for the sacking carousel below — every real name in
  // managerPool.ts, since nobody has been hired at YOUR club yet (the only
  // club this game actually tracks a job market for). If the Lineups sheet
  // for your own starting club happens to name a real pool manager (real
  // life example: the club's actual current manager), he's already "taken"
  // the moment the career opens — leaving him in this list too would let
  // the Boardroom hire him away from himself.
  state.availableManagers = allPoolManagers().filter(n => n !== state.manager!.name);
  const seeded = seedSeasonKnockouts(state);
  state.cups = seeded.runs;
  // Both domestic cups: thirty-two clubs, a first-round draw, and your tie on
  // the calendar. See lib/star/cups.
  const drawn = seedCups(state);
  state.cupState = drawn.states;
  state.fixtures = [...state.fixtures, ...seeded.fixtures, ...drawn.fixtures];
  // Real life doesn't wait for a Community Shield or a Super Cup to exist —
  // those genuinely can't happen in a season 1 with no prior trophy to seed
  // them from — but a club that has actually already qualified for Europe
  // this real season has to start playing it from week one, same as any
  // later season earned through the league table.
  const euro = seedEurope(state);
  state.euroState = euro.state ?? undefined;
  state.fixtures = [...state.fixtures, ...euro.fixtures];
  // Signing can unlock "first-contract", and `honourPoints` (rating.ts) counts
  // every achievement — so the rating the identity was carrying is stale the
  // moment that happens. Recomputed rather than nudged, the same as every
  // other reducer that can move an achievement. Nothing in the computation
  // touches a club, so this is still "the rating his own skills and honours
  // give him", not a club bonus.
  state.starRating = computeStarRating(state);
  return state;
}

/** Re-exported so the career module answers the question it is asked about
 *  its own careers — it genuinely lives in calendar.ts, which imports
 *  nothing, so `storage.ts` (and the server route that imports it) can ask
 *  it without pulling the whole career engine in behind it. */
export { hasClub };

export function makeInitialCareer(
  player: StarPlayer, clubs: string[], division: CareerDivision = "premier",
): CareerState {
  return attachClub(makeIdentity(player, division), player.club, clubs, division);
}

// Star rating thresholds that trigger an early contract offer.
// The player starts at 2.5★ so offers begin when they break into 3★ territory.
const STAR_OFFER_MILESTONES = [3, 4, 5];
const FORM_OFFER_THRESHOLD = 7.5;  // average match rating over last 5 games
const FORM_OFFER_MIN_MATCHES = 5;

// Check if the club should make an unsolicited early renewal offer.
// Returns the reason if an offer is due, or null if nothing to offer.
// Only fires when at least 2 seasons remain (end-of-contract flow handles the final year).
export function checkForContractOffer(career: CareerState): "form" | "star" | null {
  if (career.contract.seasonsRemaining < 2) return null;

  // Star milestone — lowest unmet threshold the player has now cleared
  const milestones = career.contractStarMilestones ?? [];
  for (const m of STAR_OFFER_MILESTONES) {
    if (career.starRating >= m && !milestones.includes(m)) return "star";
  }

  // Sustained form — exactly once per season; needs a full window of 5 high-rated games
  const lastFormSeason = career.contractFormOfferSeason ?? -1;
  if (lastFormSeason !== career.season && career.form.length >= FORM_OFFER_MIN_MATCHES) {
    const avg = career.form.reduce((s, r) => s + r, 0) / career.form.length;
    if (avg >= FORM_OFFER_THRESHOLD) return "form";
  }

  return null;
}

/**
 * Whether the club is actually keen to talk, for a renewal the PLAYER asks
 * for (as opposed to `checkForContractOffer`'s unsolicited early offer).
 *
 * Requested directly: "it doesn't matter how long you have left on your
 * contract... the club should be more keen to discuss contract renewals
 * with you [if] you are performing really well... if you haven't improved
 * that much, they'll probably just reject the renewal approach." Reuses the
 * exact same real signals `checkForContractOffer` already judges an
 * unsolicited offer by (a real star-rating level, or genuinely hot recent
 * form) rather than inventing a second, parallel standard — the difference
 * is this one can be asked for any time, doesn't require 2+ seasons left,
 * and never consumes a milestone (asking again next week when you still
 * meet the bar should still work, unlike the one-shot proactive nudge).
 */
export function willingToRenegotiate(career: CareerState): boolean {
  if (career.starRating >= STAR_OFFER_MILESTONES[0]) return true;
  if (career.form.length >= FORM_OFFER_MIN_MATCHES) {
    const avg = career.form.reduce((s, r) => s + r, 0) / career.form.length;
    if (avg >= FORM_OFFER_THRESHOLD) return true;
  }
  return false;
}

// Mark the triggering milestone/season so the same offer doesn't fire again.
export function markContractOfferUsed(career: CareerState, reason: "form" | "star"): CareerState {
  if (reason === "star") {
    const milestones = career.contractStarMilestones ?? [];
    const triggered = STAR_OFFER_MILESTONES.find(m => career.starRating >= m && !milestones.includes(m));
    if (triggered !== undefined) {
      return { ...career, contractStarMilestones: [...milestones, triggered] };
    }
  }
  if (reason === "form") {
    return { ...career, contractFormOfferSeason: career.season };
  }
  return career;
}

/**
 * NEGLECT A SKILL LONG ENOUGH AND IT SLIPS.
 *
 * Requested directly: "if you haven't trained any of your attributes...
 * every few months... you have a chance of downgrading them by a point or
 * two every time. So then you have to go and play and earn the points back."
 * `lastTrainedWeek` (types.ts) only moves on the deliberate training
 * minigame — a passing good match already earns its own skill points
 * elsewhere in this file, which is a separate reward, not evidence the
 * skill is being MAINTAINED.
 *
 * Checked once per match played (creditMatchResult, guarded against a
 * replay the same way every other once-per-match effect there is) rather
 * than on a fixed calendar date, so a career that skips matches entirely
 * for a stretch still has its skills quietly checked in the background —
 * "every few months" is a real elapsed time, not "the next N times you
 * happen to play".
 *
 * Every skill overdue gets its OWN independent roll — training pace and
 * neglecting technique for the same stretch can decay one without the
 * other. A successful roll resets that skill's own clock (`lastTrainedWeek`
 * moves to now), so it isn't eligible to decay again next match purely
 * because nothing else has changed — the same beat as actually training it,
 * just a worse outcome.
 */
export function decaySkills(career: CareerState, rng: () => number): CareerState {
  const overdue = getTuning("attributes.decayCheckWeeks");
  const chance = getTuning("attributes.decayChance");
  const minLoss = getTuning("attributes.decayMin");
  const maxLoss = getTuning("attributes.decayMax");
  const floor = getTuning("attributes.decayFloor");
  const lastTrained = career.lastTrainedWeek ?? {};

  let skills = career.skills;
  let lastTrainedWeek = lastTrained;
  let changed = false;
  for (const key of Object.keys(career.skills) as (keyof Skills)[]) {
    const since = career.week - (lastTrained[key] ?? 1);
    if (since < overdue) continue;
    if (rng() >= chance) continue;
    const loss = minLoss + Math.floor(rng() * (maxLoss - minLoss + 1));
    if (!changed) { skills = { ...career.skills }; lastTrainedWeek = { ...lastTrained }; changed = true; }
    skills[key] = Math.max(floor, skills[key] - loss);
    // The clock resets here too — a skill that just decayed is not still
    // overdue next match purely because nothing about it has changed since.
    lastTrainedWeek[key] = career.week;
  }
  return changed ? { ...career, skills, lastTrainedWeek } : career;
}

// Apply a finished match to the career: season/career stat accrual, the user's
// league result + the rest of the division's week, fixture marking, pay, energy,
// relationships, sponsor unlocks, star rating, fame, form, boot wear. Returns the
// next state plus any achievements this pushed over the line (the page toasts them).
/**
 * ENERGY BACK FOR THE REST DAYS UNTIL THE NEXT FIXTURE.
 *
 * Owners, 22 Sep 2026: every day you don't play is a rest day. Applied the
 * moment a fixture is settled, for the days between it and the next
 * fixture, so what you see on the dashboard all week is what you'll have on
 * match day unless you spend some on training. No next fixture (season
 * over) means nothing here — a new season resets energy to 100 anyway.
 */
export function restRecoveryAfter(career: CareerState, settled: Fixture, fixtures: Fixture[]): number {
  const division = divisionOf(career);
  const next = nextFixtureFor({ ...career, fixtures });
  if (!next) return 0;
  const from = fixtureTimestamp(career.player.startYear, career.season, settled.week, settled.kind, division);
  const to = fixtureTimestamp(career.player.startYear, career.season, next.week, next.kind, division);
  const days = restDaysBetween(from, to);
  const ownsProperty = (career.ownedItems ?? []).some(i => i.category === "property" && !isWornOut(i));
  const tier = career.player.club ? facilitiesFor(career, career.player.club).trainingGroundTier : 1;
  return days * dailyRecovery(ownsProperty, tier);
}

export function creditMatchResult(
  career: CareerState,
  fixture: Fixture,
  stats: MatchStats,
): { career: CareerState; newlyUnlocked: string[]; potmAwarded?: MonthAward } {
  // ── Has this one already been credited? ──
  //
  // Re-crediting the same match is a real, anticipated path — the transfer
  // window's own `lastTransferWindowKey` guard exists for exactly it, and
  // says so ("no matter how many times this one match gets replayed"), and
  // `weekResults` further down de-duplicates by week for the same reason.
  // Nothing else did, so a replay counted the whole round a second time:
  // every club's played/points/goals doubled, every named scorer that week
  // had his tally doubled, and the player's own appearance, goals and
  // rating were counted twice over. Measured directly — a division of
  // twenty went from 20 games played to 40, and a 2-goal match to 4, off a
  // single re-credit.
  //
  // Matched on week/kind/opponent rather than object identity, because a
  // caller working from a stale `career` hands over a stale fixture OBJECT
  // too: the `f === fixture` comparison further down misses it, which is
  // part of what let a replay through here at all.
  const kind = fixture.kind ?? "league";
  const sameFixture = (f: Fixture) =>
    f.week === fixture.week && (f.kind ?? "league") === kind && f.opponent === fixture.opponent;
  const alreadyPlayed = career.fixtures.some(f => sameFixture(f) && f.played);

  // A replay adds nothing to a tally that already counted it. Applied here
  // rather than at each call site so every accrual — the player's season
  // and career totals, and the objective progress read off them — stays
  // consistent with the others by construction.
  const accrue = (base: CareerState["seasonStats"]) => (alreadyPlayed ? base : {
    appearances: base.appearances + 1,
    goals: base.goals + stats.goals,
    hatTricks: base.hatTricks + (stats.goals >= 3 ? 1 : 0),
    passes: base.passes + stats.passes,
    assists: base.assists + stats.assists,
    starMan: base.starMan + (stats.starMan ? 1 : 0),
    totalRating: base.totalRating + stats.rating,
    ratingCount: base.ratingCount + 1,
  });

  // Only a league fixture moves the league. A cup tie, a European night and an
  // international are none of the division's business — running the round for
  // everybody else after one of those would hand the rest of the league a free
  // week of points.
  let league = career.league;
  // This week's ten results, yours first. Kept on the career so the league
  // screen can show the round rather than only the table it produced.
  let weekResults = career.results ?? [];
  let leagueSquads = career.leagueSquads;
  let incumbents = career.incumbents;
  // …and the round itself is skipped outright on a replay — see
  // `alreadyPlayed` at the top of this function.
  if (kind === "league" && !alreadyPlayed) {
    // Phase 4 of STAR_POWER_POLITICS.md — the FA's own active Rule Book, if
    // it's ever been changed from the classic default. Every other
    // governing body's rules are real data but reach nothing this career
    // plays yet — see ruleBook.ts's own header.
    const faRules = ruleBookFor(career, "FA");
    const rng = mulberry32(career.season * 1000 + career.week);
    league = updateLeagueWithUserResult(career.league, career.player.club, fixture.opponent, stats.homeScore, stats.awayScore, faRules, rng);
    // ── homeScore is YOURS, not the home team's ──
    //
    // `finaliseMatch` writes `homeScore: userScore` whichever ground it was
    // played on — the names are a leftover, and the whole codebase reads them as
    // "yours" and "theirs" (see the fixture list two blocks down, which converts
    // them the other way for exactly this reason). Reading them as home and away
    // swapped the scoreline on every away game: a 2-1 win at Bournemouth was
    // filed as "AFC Bournemouth 2-1 Liverpool" on the results page while the
    // fixtures page, which converts properly, had it right.
    const scored = stats.homeScore;
    const conceded = stats.awayScore;
    // Your own goals are real: they were scored by named men in the match you
    // just played, so the results page carries those names rather than a
    // simulation of them.
    const yours = (stats.goalEvents ?? []).map(e => ({
      m: e.minute, s: surname(e.scorer), ...(e.assist ? { a: surname(e.assist) } : {}),
    }));
    // …and now so are theirs, when the live match named them — see
    // playLeagueWeek's own note on `oppGoals`.
    const theirs = (stats.oppGoalEvents ?? []).map(e => ({
      id: e.scorerId, m: e.minute, s: surname(e.scorer),
      ...(e.assistId ? { assistId: e.assistId } : {}),
      ...(e.assist ? { a: surname(e.assist) } : {}),
    }));
    // The squads are mutated in place as goals are named, so they come back out
    // of the call with this week's tallies already on them.
    const squads = (career.leagueSquads ?? []).map(sq => ({ ...sq, players: sq.players.map(p => ({ ...p })) }));
    const round = playLeagueWeek(league, fixture.week, {
      club: career.player.club, opponent: fixture.opponent, home: fixture.home, scored, conceded,
      goals: yours, oppGoals: theirs,
    }, rng, squads, faRules);
    league = round.league;
    leagueSquads = squads;
    // Replaying a week replaces it rather than doubling it.
    weekResults = [...weekResults.filter(r => r.week !== fixture.week), ...round.results];

    // Grace/challenge for every real rivalry across the division, this
    // week's real results/tallies just settled above — see incumbency.ts's
    // own header for the full rule.
    const withIncumbency = advanceIncumbencyWeek({ ...career, leagueSquads, incumbents }, round.results);
    leagueSquads = withIncumbency.leagueSquads;
    incumbents = withIncumbency.incumbents;
  }

  const fixtures = career.fixtures.map((f) =>
    // Identity OR the same match by week/kind/opponent — see `sameFixture`
    // above. A caller working from a stale `career` hands over a stale
    // fixture OBJECT, and identity alone then marked nothing as played,
    // leaving the match eligible to be credited over and over.
    (f === fixture || sameFixture(f))
      ? {
          ...f,
          played: true,
          homeScore: f.home ? stats.homeScore : stats.awayScore,
          awayScore: f.home ? stats.awayScore : stats.homeScore,
          userGoals: stats.goals,
          userAssists: stats.assists,
          userRating: stats.rating,
        }
      : f,
  );

  const minuteShare = Math.max(0.25, Math.min(1, (stats.minutes ?? 90) / 90));

  // ── Energy (rebuilt 22 Sep 2026 — see energy.ts) ──
  //
  // The match itself drained energy minute by minute, at whatever mode you
  // played (CanvasMatch reports where the bar ended as `endEnergy`). A caller
  // with no live reading (dev tools, the sandbox) pays a Medium match for the
  // minutes played instead. Then the rest days until the next fixture give
  // energy back. The old "+20 for every unused weekly action" is gone.
  // Guarded on `alreadyPlayed` so a replayed fixture changes nothing twice.
  const afterMatch = stats.endEnergy !== undefined
    ? stats.endEnergy
    : career.energy - ENERGY_FULL_MATCH_MEDIUM * energyFactorFor(career, fixture) * minuteShare;
  const nextEnergy = alreadyPlayed
    ? career.energy
    : Math.round(clampEnergy(clampEnergy(afterMatch) + restRecoveryAfter(career, fixture, fixtures)));

  // ── Injuries: a real risk on every single appearance, not just a tired
  //    one — real footballers pick up freak knocks on a fresh pair of legs
  //    too — but one fatigue makes considerably more likely. `endEnergy` is
  //    the live, in-match value CanvasMatch tracked as the game wore on
  //    (see tiredSkills/liveEnergyRef there); it falls back to the
  //    pre-match value for any caller that doesn't supply it (the sandbox,
  //    dev tooling) rather than skipping the roll outright. Also guarded on
  //    `alreadyPlayed` — the roll's own seed would reproduce the same
  //    outcome on a replay regardless, but the energy it is weighed against
  //    must not have silently drifted from the double-drain above.
  const fatigueAtFullTime = stats.endEnergy ?? career.energy;
  const injuryRisk = INJURY_RISK_BASE
    + Math.max(0, (INJURY_FATIGUE_FLOOR - fatigueAtFullTime) / INJURY_FATIGUE_FLOOR) * INJURY_RISK_FATIGUE_EXTRA;
  const injuryRng = mulberry32(career.season * 8191 + fixture.week * 97 + fixture.opponent.length * 3);
  const nextInjury = !alreadyPlayed && !career.injury && injuryRng() < injuryRisk
    ? rollInjury(injuryRng)
    : career.injury;

  // ── Head-to-head: a rivalry with a CLUB, not a fixture kind ──
  //
  // Every club match counts — league and cup alike, an FA Cup shock against
  // a rival still belongs in "your record against them" — but not
  // internationals, whose opponent is a nation. `stats.homeScore` is YOURS
  // regardless of ground (see the note above `scored`/`conceded`), so the
  // result reads the same way here.
  const nextHeadToHead = (() => {
    if (kind === "international" || alreadyPlayed) return career.headToHead ?? {};
    const prior = career.headToHead?.[fixture.opponent] ?? { wins: 0, draws: 0, losses: 0 };
    const result = stats.homeScore > stats.awayScore ? "wins" : stats.homeScore < stats.awayScore ? "losses" : "draws";
    return { ...(career.headToHead ?? {}), [fixture.opponent]: { ...prior, [result]: prior[result] + 1 } };
  })();

  // A rivalry changes nothing about how it was played and everything about
  // what it was worth. Applied to the relationships only — never to the
  // football. Scaled by how much the fixture actually means (see
  // rivalries.ts) rather than a flat derby/not-derby switch — a primary
  // rivalry moves the needle further than a lesser one, and a plain
  // geographical derby with no rated history still moves it some.
  const derbyScale = rivalryMultiplier(career.player.club, fixture.opponent);
  // Both guarded on `alreadyPlayed` — a replay must not wear the boots down
  // a second time, or rest the horse a second time either.
  const currentBoot = alreadyPlayed ? career.currentBoot
    : { ...career.currentBoot, matches: Math.max(0, career.currentBoot.matches - 1) };

  // A rested week for the stable: the horse regains some energy between matches.
  const horse = alreadyPlayed || !career.horse ? career.horse
    : { ...career.horse, energy: Math.min(100, career.horse.energy + 20) };

  // Guarded on `alreadyPlayed` throughout — a replay must not grow the
  // sponsor relationship or progress/complete an objective a second time off
  // the same match.
  //
  // Eligibility for a NEW deal is no longer this relationship crossing a
  // threshold — see sponsorEligible/signSponsor in sponsors.ts, each
  // category with its own themed requirement (fame plus whatever actually
  // fits the brand). This relationship now only tracks how deals you have
  // ALREADY signed are doing: good matches keep sponsors happy, which is
  // what actually being progressed/lapsed reads off.
  const sponsorGain = alreadyPlayed ? 0 : Math.max(0, Math.floor(stats.fansChange / 3));
  const newSponsorRel = Math.min(100, career.relationships.sponsors + sponsorGain);
  const progressed = alreadyPlayed
    ? { sponsors: career.sponsors, earned: 0, completed: [] as string[] }
    : progressObjectives(career.sponsors, stats, accrue(career.seasonStats), { home: fixture.home });
  const sponsors = progressed.sponsors;

  // Update squad player stats from this match's goal events.
  // Chain teammate goals (isUserGoal: false) → scorer gets a goal.
  // User direct goals (isUserGoal: true) → assister (if any) gets an assist.
  // Guarded on `alreadyPlayed` the same way `accrue` is — a replay must not
  // double a team-mate's goal/assist tally either.
  const goalEvents = alreadyPlayed ? [] : (stats.goalEvents ?? []);
  const updatedSquad = (career.squad ?? []).map(p => {
    const scored = goalEvents.filter(e => !e.isUserGoal && e.scorer === p.name).length;
    const assisted = goalEvents.filter(e => e.assist === p.name).length;
    if (scored === 0 && assisted === 0) return p;
    return {
      ...p,
      seasonGoals: p.seasonGoals + scored,
      seasonAssists: p.seasonAssists + assisted,
      careerGoals: p.careerGoals + scored,
      careerAssists: p.careerAssists + assisted,
      // …and the league-only subset. The Golden Boot and the Assist King are
      // league competitions; a hat-trick in the FA Cup does not count towards
      // either and never has. The club record above counts everything.
      leagueGoals: (p.leagueGoals ?? p.seasonGoals) + (kind === "league" ? scored : 0),
      leagueAssists: (p.leagueAssists ?? p.seasonAssists) + (kind === "league" ? assisted : 0),
    };
  });

  // A knockout tie settles the run: through, out, or a trophy — and winning it
  // puts the next round on the calendar, which is the only way a knockout can
  // be built, since who you play next depends on still being in it.
  let cups: CupRun[] = career.cups ?? [];
  let extraFixtures: Fixture[] = [];
  let cupTrophy: Trophy | null = null;
  let knockoutMessage: string | null = null;
  let cupState = career.cupState;
  let euroState = career.euroState;
  let externalSquads = career.externalSquads;
  // Guarded on `alreadyPlayed` for the same reason the league round is
  // (see the top of this function): unguarded, a replayed knockout leg
  // found the competition's state already advanced past this tie by the
  // FIRST credit, and settled the tie a second time against whatever round
  // had been drawn NEXT — auto-winning or auto-eliminating a round never
  // actually played, and potentially minting a duplicate trophy if that
  // phantom result happened to land on the final.
  if (kind !== "league" && fixture.competition && !alreadyPlayed) {
    // Real, named goals for a European match actually played — the same
    // conversion the league block above does for `yours`/`theirs`, so a
    // Champions League scout report can eventually show them the same way a
    // domestic one does. `externalSquads` is cloned so `nameGoals`/
    // `creditNamedGoals` (called inside settleEuro, for every one of the
    // matchday's eighteen games, not just this one) can mutate it in place
    // without touching `career`'s own copy until this credit is committed.
    const euroYours = (stats.goalEvents ?? []).map(e => ({
      m: e.minute, s: surname(e.scorer), ...(e.assist ? { a: surname(e.assist) } : {}),
    }));
    const euroTheirs = (stats.oppGoalEvents ?? []).map(e => ({
      id: e.scorerId, m: e.minute, s: surname(e.scorer),
      ...(e.assistId ? { assistId: e.assistId } : {}),
      ...(e.assist ? { a: surname(e.assist) } : {}),
    }));
    const euroSquads = (career.externalSquads ?? []).map(sq => ({ ...sq, players: sq.players.map(p => ({ ...p })) }));
    // Europe first: a league-phase night and a two-legged tie are neither a
    // domestic cup round nor a counter-style run, and asking the other two
    // handlers about it would have them answer for a competition they do not
    // know about.
    const livePens = stats.shootout ? { us: stats.shootout.home, them: stats.shootout.away } : undefined;
    const euro = settleEuro(
      career, fixture, stats.homeScore, stats.awayScore, euroSquads, euroYours, euroTheirs, livePens,
    );
    if (euro) externalSquads = euroSquads;
    const settled = euro ? null : settleCupTie(
      career, fixture, stats.homeScore, stats.awayScore, stats.wentToExtraTime, stats.shootout,
    );
    if (euro) {
      euroState = euro.state;
      extraFixtures = euro.nextFixture ? [euro.nextFixture] : [];
      cupTrophy = euro.trophy;
      knockoutMessage = euro.message;
    } else if (settled) {
      cupState = settled.states;
      extraFixtures = settled.nextFixture ? [settled.nextFixture] : [];
      cupTrophy = settled.trophy;
      knockoutMessage = settled.message;
    } else if (fixture.competition === "Community Shield" || fixture.competition === "Super Cup") {
      // A single pre-season match, not a bracket — neither settleEuro
      // (Super Cup is explicitly excluded from it) nor settleCupTie/the
      // knockout `cups` list (both are keyed to a whole competition state
      // that only FA Cup/League Cup/Europe ever seed) has anywhere to
      // record this. Reported indirectly, as "I should be able to see the
      // winners of all of those competitions": winning either of these
      // earned no trophy at all before this, silently — the match played
      // out, and then nothing. A draw is decided by a coin flip, the same
      // shorthand for extra time and penalties every other one-off tie in
      // this game already uses (see settlePlayOffFixture's final).
      const club = career.player.club;
      const scored = stats.homeScore, conceded = stats.awayScore; // yours, not the home team's — see above
      const rng = mulberry32(career.season * 4441 + fixture.week * 17);
      // Neither competition plays extra time (see shootout.ts's
      // `hasExtraTime`) — level after 90 goes straight to a real,
      // skill-weighted penalty shootout instead of a flat coin flip.
      let won: boolean;
      if (scored !== conceded) {
        won = scored > conceded;
      } else if (stats.shootout) {
        // A real shootout the player just took live in CanvasMatch — "yours"
        // in `stats.shootout` mirrors homeScore/awayScore's own convention,
        // so this needs the same you-not-home flip `scored`/`conceded` above
        // already applied.
        const yourPens = fixture.home ? stats.shootout.home : stats.shootout.away;
        const theirPens = fixture.home ? stats.shootout.away : stats.shootout.home;
        won = yourPens > theirPens;
      } else {
        const mine = career.league.find(t => t.name === club)?.strength ?? 70;
        const theirs = fixture.opponentStrength ?? 70;
        const pens = simulateShootout(mine, theirs, rng);
        won = pens.home > pens.away;
      }
      if (won) {
        cupTrophy = { season: career.season, competition: fixture.competition, club };
        knockoutMessage = `${club} win the ${fixture.competition}.`;
      } else {
        knockoutMessage = `Beaten in the ${fixture.competition} by ${fixture.opponent}.`;
      }
    } else {
      const idx = cups.findIndex(r => r.competition === fixture.competition && !r.eliminated);
      if (idx >= 0) {
        const out = resolveKnockout(career, cups[idx], fixture, stats.homeScore, stats.awayScore);
        cups = cups.map((r, i) => (i === idx ? out.run : r));
        if (out.nextFixture) extraFixtures = [out.nextFixture];
        cupTrophy = out.trophy;
        knockoutMessage = out.message;
      }
    }
  }

  // Every OTHER cup the player is no longer part of — the ones settleCupTie
  // above never touches, because it only ever settles the ONE competition
  // this fixture belongs to — gets a chance to move forward here too,
  // exactly as far as this fixture's own real calendar date allows. See
  // advanceEliminatedCups's own doc for why this replaced an instant
  // resolve-to-a-winner the moment the player was eliminated.
  if (!alreadyPlayed) {
    const clock = fixtureTimestamp(career.player.startYear, career.season, fixture.week, fixture.kind, divisionOf(career));
    const cupsRng = mulberry32(career.season * 60013 + fixture.week * 7 + 41);
    cupState = advanceEliminatedCups({ ...career, cupState }, clock, cupsRng);
  }

  // International football is its own record. Caps and international goals do
  // not belong in a club season's numbers, and a club season's numbers are what
  // the Ballon d'Or and the club achievements read.
  const isInternational = kind === "international";

  // Your own league-only tally, for the same reason — guarded on
  // `alreadyPlayed` too (it wasn't; a replayed league match silently
  // inflated the in-season Golden Boot/Assist King standing this drives,
  // while every other stat store for the same match stayed correct).
  const priorLeague = career.leagueSeasonStats
    ?? { goals: career.seasonStats.goals, assists: career.seasonStats.assists };
  const leagueSeasonStats = kind === "league" && !alreadyPlayed
    ? { goals: priorLeague.goals + stats.goals, assists: priorLeague.assists + stats.assists }
    : priorLeague;

  // The same tally again, but never reset at rollover — the running total the
  // career-long Records (lib/star/records.ts) are measured against. Golden
  // Boot/Assist King logic never reads this one; leagueSeasonStats above is
  // still theirs, untouched. Guarded on `alreadyPlayed` (unlike
  // leagueSeasonStats above, which predates this field) — a real record
  // comparison is exactly the place a replay silently doubling a season's
  // numbers would actually matter.
  const priorCareerLeague = career.careerLeagueStats ?? { goals: 0, assists: 0, appearances: 0 };
  const careerLeagueStats = kind === "league" && !alreadyPlayed
    ? {
      goals: priorCareerLeague.goals + stats.goals,
      assists: priorCareerLeague.assists + stats.assists,
      appearances: priorCareerLeague.appearances + 1,
    }
    : priorCareerLeague;

  // ── Player of the Month ──
  //
  // Awarded once the last league week of a month has been played. It reads
  // `results`, which by this point already has this week's ten games in it, so
  // the month it votes on is complete. See lib/star/potm.
  let potm = career.potm;
  let potmJustAwarded: MonthAward | null = null;
  if (kind === "league") {
    const month = monthOfCareer(career, fixture.week);
    const lastWeek = Math.max(...career.fixtures.map(f => f.week), fixture.week);
    if (endsMonthOn(career, fixture.week, lastWeek) && !alreadyAwarded(career, month)) {
      const forVote = { ...career, results: weekResults, fixtures } as CareerState;
      const award = voteMonth(forVote, month);
      if (award) {
        potm = [...(career.potm ?? []), award];
        potmJustAwarded = award;
      }
    }
  }

  // A good ninety minutes sharpens you a little, across the board — the
  // "played well, so you're marginally sharper" pool this used to grant as
  // a direct starRating nudge (+0.03 at an 8+ rating, +0.01 at 7+) now goes
  // into the real attributes underneath the rating instead (rating.ts's
  // computeStarRating reads them back out), scaled by how fast a player of
  // this age actually develops — see growthMultiplier.
  //
  // Switched off (Mikey, 25 Sep 2026: "matches don't give skill points").
  // Skills now come only from training stars — see lib/star/trainingLevels.ts.
  // Kept as a zero rather than deleted so turning it back on is one line.
  const MATCHES_GIVE_SKILL = false;
  const matchSkillPool = alreadyPlayed || !MATCHES_GIVE_SKILL ? 0
    : stats.rating >= 8 ? getTuning("training.matchPoolRating8")
    : stats.rating >= 7 ? getTuning("training.matchPoolRating7")
    : stats.rating >= 6 ? getTuning("training.matchPoolRating6")
    : 0;
  const perSkillGain = (matchSkillPool * growthMultiplier(career.player.age)) / getTuning("training.matchGainDivisor");
  const nextSkills: Skills = perSkillGain <= 0 ? career.skills : {
    pace: Math.min(100, Math.round(career.skills.pace + perSkillGain)),
    power: Math.min(100, Math.round(career.skills.power + perSkillGain)),
    technique: Math.min(100, Math.round(career.skills.technique + perSkillGain)),
    vision: Math.min(100, Math.round(career.skills.vision + perSkillGain)),
    freeKick: Math.min(100, Math.round(career.skills.freeKick + perSkillGain)),
  };

  const next: CareerState = {
    ...career,
    skills: nextSkills,
    potm,
    // …and on the honours list beside the Ballon d'Or, but only when it is
    // yours. A month somebody else won is a fact about the league, not an
    // individual honour of yours.
    awards: potmJustAwarded?.isYou
      ? [...(career.awards ?? []), {
        season: career.season, kind: "Player of the Month", week: fixture.week,
        detail: `${potmJustAwarded.monthName} — ${potmJustAwarded.goals} goals, ${potmJustAwarded.assists} assists`,
      }]
      : career.awards,
    seasonStats: isInternational ? career.seasonStats : accrue(career.seasonStats),
    careerStats: isInternational ? career.careerStats : accrue(career.careerStats),
    leagueSeasonStats,
    careerLeagueStats,
    // Guarded on `alreadyPlayed`, same as every other tally in this
    // function — international caps/goals are no different from a club
    // appearance in that regard.
    caps: (career.caps ?? 0) + (isInternational && !alreadyPlayed ? 1 : 0),
    internationalGoals: (career.internationalGoals ?? 0) + (isInternational && !alreadyPlayed ? stats.goals : 0),
    cups,
    trophies: cupTrophy ? [...career.trophies, cupTrophy] : career.trophies,
    knockoutMessage,
    cupState,
    euroState,
    league,
    results: weekResults,
    leagueSquads,
    externalSquads,
    incumbents,
    fixtures: [...fixtures, ...extraFixtures],
    // Match-day money: the wage and bonuses the result produced, an appearance
    // fee if the deal has one, and anything a sponsor objective just paid out
    // — minus a week's real upkeep on the horse, if you own one (feed,
    // stabling, routine vet costs — charged whether it raced or not, the
    // same "no free lunch" reasoning the rest of this game's economy already
    // uses elsewhere). Guarded on `alreadyPlayed` — none of this happens
    // twice off a replayed match, same as everything else here.
    money: alreadyPlayed ? career.money : career.money + stats.totalCash
      + (isInternational ? 0 : appearanceMoney(career.contract))
      + progressed.earned
      - (career.horse ? horseUpkeep(career.horse) : 0),
    // Twenty minutes off the bench does not sharpen you as much as ninety —
    // and a replay does not sharpen you again.
    matchFitness: alreadyPlayed ? career.matchFitness : Math.min(100, career.matchFitness + 3 * minuteShare),
    energy: nextEnergy,
    // Basic KIB cans drunk at half time come off your stock now the match is saved.
    // A can's boot ability lasts one match played — this one.
    kibAbility: alreadyPlayed ? career.kibAbility : undefined,
    kibCans: alreadyPlayed || !stats.kibCansUsed ? career.kibCans
      : { ...career.kibCans, basic: Math.max(0, (career.kibCans?.basic ?? 0) - stats.kibCansUsed) },
    injury: nextInjury,
    headToHead: nextHeadToHead,
    // Guarded on `alreadyPlayed`: a replay must not move the relationships a
    // second time either — a derby win credited twice inflated exactly the
    // numbers the manager/dressing-room/fanbase systems are built to track
    // honestly.
    relationships: alreadyPlayed ? { ...career.relationships, sponsors: newSponsorRel } : {
      ...career.relationships,
      boss: clamp01to100(career.relationships.boss + Math.round(stats.bossChange * derbyScale.boss)),
      team: clamp01to100(career.relationships.team + Math.round(stats.teamChange * derbyScale.team)),
      fans: clamp01to100(career.relationships.fans + Math.round(stats.fansChange * derbyScale.fans)),
      sponsors: newSponsorRel,
    },
    sponsors,
    // Recomputed below, once this result's achievements (which can
    // themselves move it — a fresh "trophy-cabinet" unlock, say) are final.
    starRating: career.starRating,
    // Owners, 21 Sep 2026: playing well earns NO fame on its own — only big
    // moments do (see fame.ts). Player of the Month is one of them.
    fame: !alreadyPlayed && potmJustAwarded?.isYou ? addFame(career.fame, FAME_EVENTS.playerOfMonth) : career.fame,
    // The single most important guard in this function — see `alreadyPlayed`'s
    // own doc at the top. A replay must not advance the calendar; it already
    // did that the first time this match was credited, and a second advance
    // permanently skips a real week for the rest of the career.
    week: alreadyPlayed ? career.week : career.week + 1,
    currentBoot,
    horse,
    squad: updatedSquad,
    form: alreadyPlayed ? career.form : [stats.rating, ...career.form].slice(0, 5),
  };
  // Appearances at THIS club, which is what the armband is judged on — career
  // appearances would hand it to a signing on his first day. Guarded like
  // every other appearance tally above.
  next.clubAppearances = (career.clubAppearances ?? 0) + (isInternational || alreadyPlayed ? 0 : 1);

  // The match is over, so a new week starts: three things you can do before
  // the next one — except on a replay, which already started that week the
  // first time this match was credited. Unguarded, a replay granted a free
  // set of weekly actions on top of whatever the player had already spent.
  if (!alreadyPlayed) Object.assign(next, startNewWeek());

  // The armband, once the dressing room and the manager are both behind you and
  // you have actually been here a while. Once given it is not taken away for a
  // bad month — only a transfer resets it. Both bumps guarded on
  // `alreadyPlayed` — the per-match captain's bonus is real, but only once
  // per match actually played.
  if (!next.captain && !alreadyPlayed && captaincyEarned(next)) {
    next.captain = true;
    next.relationships = { ...next.relationships, team: clamp01to100(next.relationships.team + 3) };
  }
  if (next.captain && !alreadyPlayed) {
    next.relationships = { ...next.relationships, team: clamp01to100(next.relationships.team + CAPTAIN_TEAM_BONUS) };
  }

  // ── Player of the Month: one system, not two ──
  //
  // Reported directly: a second, contradictory Player of the Month could
  // land on the SAME month the real vote (`voteMonth`/potm.ts, above —
  // division-wide, calendar-accurate, gated on `endsMonthOn`/
  // `alreadyAwarded`) had already given to someone else, or to the player
  // twice over. `recognition.ts`'s `monthlyAward` is the mechanic it
  // replaced: purely the player's own last-four-match average against a
  // fixed bar, on a `week % 4 === 0` boundary that has nothing to do with
  // the real calendar — calendar.ts's own comment documents that this
  // exact block-based month logic was replaced for being simply wrong, but
  // this call was never disconnected when the real vote was built. Left in
  // recognition.ts (and its own test) as a pure function; just no longer
  // wired into what actually gets credited to a career.
  if (progressed.completed.length > 0) {
    next.sponsorNews = [...(career.sponsorNews ?? []), ...progressed.completed].slice(-4);
  }
  // Being hooked for your form is a message from the manager as well as a
  // scoreline — it costs you a little more of him than the rating alone.
  if (stats.hooked === "form" && !alreadyPlayed) {
    next.relationships = { ...next.relationships, boss: clamp01to100(next.relationships.boss - 3) };
  }
  // One more appearance at this club, and whether that has won you your shirt
  // (selection.ts). Only for a match you actually played in.
  if (!alreadyPlayed && (stats.minutes ?? 0) > 0) {
    next.shirt = recordAppearance(next);
  }
  // The manager's view going into next week, so the dashboard's status is live
  // rather than the "1st Team" it was stamped with when the career was created.
  // Not guarded — this is a read of the CURRENT state, not an accrual, so
  // recomputing it on a replay is harmless and correct either way.
  next.status = selectionFor(next).status;

  // ── The play-offs ──
  //
  // Seeded the instant the last league round is credited, so the fixtures
  // exist before the next screen renders; settled here too when the match
  // just played was one of them. Both are no-ops outside a Championship
  // season in which you finished third to sixth. See lib/star/playoffs.
  // Guarded on `alreadyPlayed`, same reason as the cup/Europe settlement
  // above — settlePlayOffFixture has no replay protection of its own.
  // seedPlayOffs (the other branch) already guards itself on
  // `career.playOffState` being set, so it needs nothing extra here.
  if (fixture.kind === "playoff" && !alreadyPlayed) {
    const settled = settlePlayOffFixture(career, fixture, stats.homeScore, stats.awayScore);
    if (settled) {
      next.playOffState = settled.state;
      if (settled.fixtures.length) next.fixtures = [...next.fixtures, ...settled.fixtures];
      next.knockoutMessage = settled.message;
    }
  } else if (kind === "league" && leagueSeasonComplete(next, fixture.week)) {
    const seeded = seedPlayOffs(next);
    if (seeded) {
      next.playOffState = seeded.state;
      next.fixtures = [...next.fixtures, ...seeded.fixtures];
    }
  }

  // ── The rest of the division does its business ──
  //
  // Fires on the WEEK A WINDOW OPENS, not every week within one — see
  // runDueTransferWindow for why the key rather than the week comparison is
  // what makes this safe against a replay.
  Object.assign(next, runDueTransferWindow(next));

  // Neglect a skill long enough and it can slip — see decaySkills's own
  // header. Gated on `!alreadyPlayed` for the same reason every other
  // once-per-match effect above is: a replayed fixture must never roll
  // this twice.
  if (!alreadyPlayed) {
    Object.assign(next, decaySkills(next, mulberry32(next.season * 5051 + next.week * 131 + 3)));
  }

  const settled = applyAchievements(next);
  return {
    career: { ...settled.career, starRating: computeStarRating(settled.career) },
    newlyUnlocked: settled.newlyUnlocked,
    potmAwarded: potmJustAwarded ?? undefined,
  };
}

/** Where a window sits within its season's own order — summer, then January.
 *  See `runDueTransferWindow`'s overshoot guard for why this exists. */
const WINDOW_ORDER: Record<"summer" | "january", number> = { summer: 0, january: 1 };

/** Parses a `lastTransferWindowKey` ("1-summer") into a single comparable
 *  number, so a later key can never be judged "already passed" by an
 *  earlier one. Absent or unrecognised keys sort before everything. */
function windowOrdinal(key: string | undefined): number {
  const [seasonPart, windowPart] = (key ?? "").split("-");
  const season = Number(seasonPart);
  const order = WINDOW_ORDER[windowPart as "summer" | "january"];
  if (!Number.isFinite(season) || order === undefined) return -Infinity;
  return season * 2 + order;
}

/**
 * Run whichever transfer window is due, if it hasn't already run.
 *
 * Extracted out of creditMatchResult so the dev "skip ahead" tool
 * (devSkip.ts) can advance a career through real weeks without ever showing
 * a match, while still opening every window along the way exactly the way a
 * played-through career would — same domestic engine, same international
 * pass, same `lastTransferWindowKey` de-dupe. A no-op if nothing is due, or
 * if this window already ran (comparing `next.lastTransferWindowKey`, which
 * at the call site in creditMatchResult is still the pre-match career's key —
 * nothing between there and here touches it).
 *
 * `next.week` is a count of matches played, not a true calendar week — it
 * runs ahead of real time by one for every cup or European fixture folded in
 * alongside the 38 league Saturdays, and a season deep in all three
 * knockouts can rack up enough of those to push the counter past what
 * `fixtureDate` reads as the FOLLOWING season's August, re-computing
 * "summer" a second time before this season has actually rolled over.
 * Reported directly, once cupRoundWeek started spacing cup rounds further
 * from a Tuesday European night to fix a real-rest-gap bug: extending the
 * calendar just enough for exactly this overshoot to fire, silently
 * overwriting an already-run January's key and re-running a summer window
 * mid-season. Guarded by ordinal rather than loosening the key check itself:
 * a window is only ever allowed to advance, never regress, within — or
 * across — a season.
 */
export function runDueTransferWindow(next: CareerState): CareerState {
  if (!next.leagueSquads?.length) return next;
  const openedWindow = transferWindowFor(next.player.startYear, next.season, next.week, divisionOf(next));
  if (!openedWindow) return next;
  const key = `${next.season}-${openedWindow}`;
  if (next.lastTransferWindowKey === key) return next;
  if (windowOrdinal(key) <= windowOrdinal(next.lastTransferWindowKey)) return next;

  const rng = mulberry32(next.season * 100003 + next.week * 37);
  const { career: afterWindow, moves, loans } = runTransferWindow(next, openedWindow, rng);
  // A handful of clubs this career has real data for but does not play in
  // its own division — Champions League, Europa League, the rest — get
  // their own small, separate shot at the same window: see the file header
  // in leagueTransfers.ts for why this runs apart from the closed-system
  // engine above rather than folding into it. A different seed from the
  // domestic window's own, so the two draws are not correlated with each
  // other.
  const worldRng = mulberry32(next.season * 100003 + next.week * 37 + 7);
  const { career: afterWorld, moves: worldMoves } = runInternationalWindow(afterWindow, openedWindow, worldRng);
  return {
    ...afterWorld,
    leagueTransferNews: worldMoves.length ? [...moves, ...worldMoves] : moves,
    leagueLoanNews: loans,
    lastTransferWindowKey: key,
  };
}

// After the final fixture: award the league title if the user finished top.
export function awardLeagueTrophyIfWon(career: CareerState): { career: CareerState; wonLeague: boolean } {
  const sorted = sortLeague(career.league);
  const wonLeague = sorted[0]?.name === career.player.club;
  if (!wonLeague) return { career, wonLeague: false };
  // Idempotent: the end of a season can now be reached twice — once through the
  // post-match screen and once through the dashboard's end-of-season prompt after
  // a refresh — and a title must not be awarded twice for it.
  // Whichever division you actually won — winning the Championship is a real
  // trophy and is not the Premier League, which the achievements that check
  // for a league title by name depend on staying true.
  const competition = leagueNameFor(divisionOf(career));
  const already = career.trophies.some(t => t.season === career.season && t.competition === competition);
  if (already) return { career, wonLeague: true };
  const trophy = { season: career.season, competition, club: career.player.club };
  return { career: { ...career, trophies: [...career.trophies, trophy] }, wonLeague: true };
}

export type SeasonWinners = NonNullable<CareerState["lastSeasonWinners"]>;

/**
 * Who actually won everything this season, whether or not it was you.
 *
 * Pure and non-mutating on purpose: `advanceSeason` calls this at rollover
 * (see below), but so does the Ballon d'Or shortlist (lib/star/ballonDor.ts)
 * — called earlier, in `endSeason` (app/star-dev/page.tsx), BEFORE rollover
 * has reset any of the state this reads. Extracted so both read the exact
 * same resolution rather than a second copy of it silently drifting.
 *
 * Community Shield and Super Cup need real opponents even in a season you
 * won nothing — and finding out who requires the country's cups to have an
 * answer at all, which they now do (see finishCupToWinner). Safety net here
 * for a competition that somehow reached this unresolved (the semi-final
 * calendar slot moved, a save loaded mid-cup) rather than trusting every
 * earlier code path got it right.
 */
export function resolveSeasonWinners(career: CareerState): SeasonWinners {
  const rngWinners = mulberry32(career.season * 7247 + career.league.length * 11);
  const finishedCups = (career.cupState ?? []).map(st =>
    st.winner ? st : finishCupToWinner(st, career.league, career.player.club, rngWinners));
  const faCupWinner = finishedCups.find(st => st.competition === "FA Cup")?.winner ?? null;
  const leagueCupWinner = finishedCups.find(st => st.competition === "League Cup")?.winner ?? null;
  const finalTable = sortLeague(career.league);
  const leagueWinner = finalTable[0]?.name;
  const leagueRunnerUp = finalTable[1]?.name;

  // Phase 6 of STAR_POWER_POLITICS.md, rule §4.4 #11 — any extra European
  // places UEFA has granted this country, read off UEFA's own rule book.
  const uefaRules = ruleBookFor(career, "UEFA");
  // No european-trophy-winner argument here: this is computing THIS season's
  // own qualifying field, before anyone has actually played it out to know
  // who (if anyone) wins Europe this season — that's exactly what
  // crownWithoutYou below uses this very field to determine.
  const qualifiers = seasonQualifiers(career.league, faCupWinner, leagueCupWinner, null, uefaRules.extraChampionsLeagueSlots, uefaRules.extraEuropaLeagueSlots);
  const strengthOf = (name: string) => career.league.find(t => t.name === name)?.strength ?? 75;
  const inYourCompetition = (id: "Champions League" | "Europa League") =>
    career.euroState?.competition === id ? career.euroState : null;

  const yourChampions = inYourCompetition("Champions League");
  const championsLeagueWinner = yourChampions?.winner ?? crownWithoutYou(
    "Champions League",
    qualifiers.champions.map(name => ({ name, strength: strengthOf(name) })),
    career.season * 5209 + 3,
  );
  const yourEuropa = inYourCompetition("Europa League");
  const europaLeagueWinner = yourEuropa?.winner ?? crownWithoutYou(
    "Europa League",
    qualifiers.europa.map(name => ({ name, strength: strengthOf(name) })),
    career.season * 5209 + 7,
  );

  return {
    league: leagueWinner,
    leagueRunnerUp,
    faCup: faCupWinner ?? undefined,
    leagueCup: leagueCupWinner ?? undefined,
    championsLeague: championsLeagueWinner,
    europaLeague: europaLeagueWinner,
  };
}

// Roll the career into the next season: fresh fixtures/league, a year older (with
// aging decline), reset season stats/energy/form, tick the contract down, bank a
// Ballon d'Or if won. Whether the contract now needs renewing is the caller's call
// via next.contract.seasonsRemaining.
export function advanceSeason(
  career: CareerState,
  userWonBallonDor: boolean,
  /**
   * True when `career` already reflects a transfer accepted THIS rollover —
   * a forced relegation move, or the transfer window screen. Reported
   * directly, and confirmed in the code: `career.contract` is overwritten
   * with the NEW club's deal the instant a transfer is accepted (see
   * acceptOffer in transfers.ts), and both real call sites of this function
   * hand that already-swapped contract straight to `advanceSeason` — so
   * `loyaltyMoney`, "the one thing in the career that pays you for NOT
   * moving" per its own doc comment, was reading the very deal the player
   * just signed and paying the stayed-all-season bonus for leaving.
   * Loyalty simply does not apply this rollover when this is true.
   */
  justTransferred = false,
): { career: CareerState; newlyUnlocked: string[] } {
  // A loan spell is exactly the season it was made in — home before
  // anything else this rollover touches a squad, so every squad-carrying
  // computation below (promotion/relegation's strength reads, the fresh
  // league/fixtures build) already sees him back where he actually belongs.
  career = returnLoansHome(career);

  // ── Up and down, before anything is rebuilt ──
  //
  // Next season's division and club list, which used to be simply "the same
  // twenty as last season, forever". Your own division's three are decided by
  // its real table (and, in the Championship, by real play-offs); the other
  // division's are drawn weighted by strength, because nobody played it. See
  // lib/star/promotion.
  const ladder = resolveLadder(career, mulberry32(career.season * 90247 + career.league.length * 13));
  const clubs = ladder.clubs;
  const nextDivision = ladder.division;
  const newAge = career.player.age + 1;
  const ageEffect = (v: number): number => {
    if (newAge >= 34) return Math.max(20, v - 3);
    if (newAge >= 30) return Math.max(30, v - 1);
    return v;
  };
  const agedSkills: Skills = {
    pace: ageEffect(career.skills.pace),
    power: ageEffect(career.skills.power),
    technique: career.skills.technique, // technique decays slower
    vision: career.skills.vision,       // vision holds with experience
    freeKick: career.skills.freeKick,
  };

  // Sponsor terms run down. A deal that was not delivered lapses, which costs
  // next season's fee and some standing with everybody else — the only thing
  // that makes an objective worth chasing rather than ignoring. Everything
  // still standing is paid again here too — the "start of every season" half
  // of the fee (see sponsors.ts's own file note).
  const sponsorRoll = rollSponsorSeason(career);
  const seasonFeeTotal = sponsorRoll.seasonFees.reduce((sum, f) => sum + f.fee, 0);
  // Loyalty is the one thing in the career that pays you for NOT moving. Taken
  // here, before the transfer window, because you were here for the season —
  // unless `career.contract` is only here because a transfer was JUST
  // accepted this rollover (see `justTransferred`'s own doc), in which case
  // there is no loyalty to pay: the player didn't stay, they just arrived.
  const loyalty = justTransferred ? 0 : loyaltyMoney(career.contract, true);

  // The board's view of the manager, taken on the season the CLUB had rather
  // than the one you had — nobody is sacked because a forward was quiet.
  const sack = sackCheck(career, judgeSeason(career).score);

  // Individual honours for the season that has just finished, taken BEFORE the
  // stats are reset — they are a verdict on those numbers.
  const honours = seasonAwards(career);

  // How the season went by the club's own standards, not by whether you won the
  // league. The same finish is a triumph at one club and a sacking offence at
  // another, which is the only thing that makes moving up cost you anything.
  const judgement = judgeSeason(career);

  // Europe is earned by where you finished — and by what you won. A cup winner
  // earns their European slot regardless of table position, and a team already
  // in a higher competition keeps the better one (so an FA Cup win for a top-
  // four side stays Champions League, not Europa League).
  const thisSeason = career.trophies.filter(t => t.season === career.season);
  // Fame from silverware and individual recognition — requested directly:
  // trophies and records should feed the same reputation sponsors actually
  // look at (see sponsorEligible in sponsors.ts), not sit next to it doing
  // nothing. `honours` (above) is already filtered to awards that are
  // YOURS — seasonAwards only ever returns your own Player/Young Player of
  // the Season, Golden Boot etc., never a team-mate's or a rival's.
  const wonFaCup = thisSeason.some(t => t.competition === "FA Cup");
  const wonLeagueCup = thisSeason.some(t => t.competition === "League Cup");
  const wonEuroComp = thisSeason.some(t => t.competition === "Champions League" || t.competition === "Europa League");
  // Europe is a Premier League reward. Finishing fourth in the Championship
  // (or League One, League Two, the National League) qualifies you for
  // promotion, not for the Champions League — and `qualificationFor` only
  // knows about positions and club counts, so it would happily hand out a
  // European place for one if it were asked.
  const qualification = divisionOf(career) !== "premier" ? null : qualificationFor(
    leaguePosition(career), career.league.length, wonFaCup, wonLeagueCup, wonEuroComp,
    ruleBookFor(career, "UEFA").extraChampionsLeagueSlots, ruleBookFor(career, "UEFA").extraEuropaLeagueSlots,
  );

  const lastSeasonWinners = resolveSeasonWinners(career);

  // The casino's book, settled against the exact same result the trophy
  // cabinet just agreed on above — never re-decided here. Only THIS
  // season's bets settle (see settleBets' own comment); anything else is
  // carried forward untouched.
  const betResult = settleBets(career.competitionBets ?? [], lastSeasonWinners, career.season);

  // Fame and reputation for the season just finished — big moments only.
  // See seasonStanding.ts for every line of it.
  const standing = seasonStanding(
    // Europe is a moment the FIRST time you get there, not every season you
    // stay: `career.europeanQualification` is the place you already hold.
    career, ladder, nextDivision, userWonBallonDor, !!qualification && !career.europeanQualification, lastSeasonWinners,
  );

  const next: CareerState = {
    ...career,
    player: { ...career.player, age: newAge },
    skills: agedSkills,
    season: career.season + 1,
    division: nextDivision,
    divisions: ladder.divisions,
    limboClubs: ladder.limbo,
    ladderNews: {
      yourMove: ladder.yourMove,
      promotedToPremier: ladder.promotedToPremier,
      relegatedFromPremier: ladder.relegatedFromPremier,
      promotedToChampionship: ladder.promotedToChampionship,
      relegatedFromChampionship: ladder.relegatedFromChampionship,
      promotedToLeagueOne: ladder.promotedToLeagueOne,
      relegatedFromLeagueOne: ladder.relegatedFromLeagueOne,
      promotedToLeagueTwo: ladder.promotedToLeagueTwo,
      relegatedFromLeagueTwo: ladder.relegatedFromLeagueTwo,
      promotedToNationalLeague: ladder.promotedToNationalLeague,
      relegatedFromNationalLeague: ladder.relegatedFromNationalLeague,
      ...(ladder.playOffs ? { playOffFinal: ladder.playOffs.final } : {}),
    },
    week: 1,
    fixtures: buildFixtures(clubs, career.player.club),
    league: buildLeague(clubs, career.player.club),
    // Last season's results belong to last season.
    results: [],
    leagueSeasonStats: { goals: 0, assists: 0 },
    // Read off `career` (this season's numbers, not yet wiped) before the
    // reset above takes them away — see updatePersonalBests.
    personalBests: updatePersonalBests(career),
    // Only the clubs you are actually playing next season. Going up or down
    // replaces most of the division, and a squad for a club that is no longer
    // in it is dead weight the team sheet would never read; the ones now
    // missing are refetched by the page (see the division-change effect in
    // app/star-dev/page.tsx).
    // Wonderkids get their real shot at growing here, once a season — see
    // growWonderkids's own header. Applied to both the division you're
    // actually in (leagueSquads) and the wider world (externalSquads,
    // otherwise just carried forward unchanged by the `...career` spread
    // above) — a High Potential player at a Champions League club is no
    // less real for being outside your own twenty.
    // Requested directly: a club's own real training-ground level (already
    // data — facilities.ts) should make its wonderkids grow genuinely
    // faster there, not just be a number a majority owner can cosmetically
    // upgrade.
    leagueSquads: growWonderkids(
      resetLeagueSquads((career.leagueSquads ?? []).filter(s => clubs.includes(s.club))),
      mulberry32(career.season * 71923 + 5),
      club => facilitiesFor(career, club).trainingGroundTier,
    ),
    externalSquads: growWonderkids(
      career.externalSquads ?? [], mulberry32(career.season * 71923 + 7),
      club => facilitiesFor(career, club).trainingGroundTier,
    ),
    // A fresh season — a rivalry's grace tracking is keyed off cumulative
    // SEASON goals+assists (incumbency.ts's own `lastGoalsPlusAssists`),
    // which `resetLeagueSquads` above just zeroed for everyone. Carrying an
    // old record forward would read every real goal next season as "no
    // improvement since a much bigger old total," never registering a real
    // pass again. Genuine rivalries just re-establish themselves fresh from
    // week one, the same as a brand-new signing would.
    incumbents: undefined,
    seasonStats: { ...EMPTY_SEASON_STATS },
    matchFitness: 85,
    // A summer off resets both — nobody carries a knock or a tired pair of
    // legs into a new season untreated.
    energy: 100,
    injury: null,
    form: [],
    contract: { ...career.contract, seasonsRemaining: career.contract.seasonsRemaining - 1 },
    ballonDorWins: career.ballonDorWins + (userWonBallonDor ? 1 : 0),
    squad: (career.squad ?? []).map(p => ({ ...p, seasonGoals: 0, seasonAssists: 0, leagueGoals: 0, leagueAssists: 0 })),
    europeanQualification: qualification,
    // Kept because the European draw seeds you into a pot off it, and by the
    // time that draw happens the table below has already been wiped.
    lastSeasonPosition: leaguePosition(career),
    lastSeasonWinners,
    knockoutMessage: null,
    weekActions: WEEK_ACTIONS,
    relationships: {
      ...career.relationships,
      boss: clamp01to100(career.relationships.boss + judgement.bossChange),
    },
    // Reputation's two Phase 1 hooks (see reputation.ts's own file note):
    // silverware nudges world standing, and the board's own verdict on the
    // season — the same judgement that just moved `boss` above — nudges
    // club standing, at its own smaller scale.
    reputation: standing.reputation,
    fameNews: standing.news,
    // Everything you own wears down a season (fame.ts).
    ownedItems: wearItems(career.ownedItems),
    lastSeasonJudgement: judgement,
    awards: honours.length > 0 ? [...(career.awards ?? []), ...honours] : career.awards,
    sponsors: sponsorRoll.sponsors,
    // Both halves of what a sponsor did to you this rollover — a deal that
    // lapsed, and a deal that just paid its "start of the season" fee — on
    // the same feed the dashboard already reads (DashboardStats.tsx).
    sponsorNews: [
      ...sponsorRoll.lapsed,
      ...sponsorRoll.seasonFees.map(f => `${f.category}: Season fee — ★${f.fee}`),
    ],
    // Silverware and individual recognition feed the same reputation
    // sponsors actually check — see trophyFame/honourFame above.
    fame: standing.fame,
    money: career.money + loyalty + seasonFeeTotal + betResult.totalPayout,
    competitionBets: betResult.stillPending,
    betNews: betNewsLines(betResult.settled),
  };
  if (sponsorRoll.standingHit > 0) {
    next.relationships = {
      ...next.relationships,
      sponsors: clamp01to100(next.relationships.sponsors - sponsorRoll.standingHit),
    };
  }

  // buildLeague above stamped a fresh random baseline onto every club's
  // strength, same as it always has — but the squads carried over into
  // leagueSquads a few lines up are real data this career already has. Read
  // the strengths back off them before anything downstream (the cup draw,
  // Europe, the fixture list itself) uses a number that direct playtesting
  // has already been compared against a real one.
  next.league = syncLeagueStrengthFromSquads(next.league, next.leagueSquads ?? []);

  // A new manager has never picked you. Everything you built with the last one
  // goes with him, which is how a settled player becomes a squad player without
  // kicking a ball differently.
  if (sack.sacked) {
    // The man who just left is out of a job too — but he must not be a
    // candidate for his OWN replacement in this same rollover (found as a
    // real, reproducible bug: adding him back into the pool before rolling
    // from it let him occasionally roll straight back into the job, so the
    // sack narrative fired — "Iraola leaves…" — while `career.manager`
    // never actually changed). Roll the replacement from the pool WITHOUT
    // him, then add him back in afterward so a long enough save can still
    // eventually bring him back for a LATER vacancy. A career saved before
    // this pool existed has no list on file yet; treat it as the full
    // roster rather than losing this hire (backfill in storage.ts covers
    // every other load path).
    const pool = career.availableManagers ?? allPoolManagers();
    const hire = hireReplacementManager(next, next.player.club, next.season, pool);
    next.manager = hire.manager;
    next.availableManagers = career.manager?.poolTier !== undefined
      ? [...hire.availableManagers, career.manager.name]
      : hire.availableManagers;
    // No reputation tag ("Elite"/"Proven"/...) in this specific line —
    // reported directly as unnecessary noise in the message itself. The
    // tier still exists on the manager (reputationTier(next.manager.reputation)
    // is read elsewhere, e.g. the Settings/manager screen) — this only drops
    // it from this one announcement.
    next.managerNews = `${sack.reason} ${hire.manager.name} takes over. "${hire.manager.arrival}"`;
    next.relationships = { ...next.relationships, boss: bossOnArrival(next) };
    next.captain = false;
  } else {
    next.managerNews = null;
  }

  // Seeded after the rest of the state is in place, because what you are in
  // depends on the season number, the qualification just computed and whether
  // the national side is picking you.
  const seeded = seedSeasonKnockouts(next);
  next.cups = seeded.runs;
  const drawn = seedCups(next);
  next.cupState = drawn.states;
  // Europe: the field, and all eight league-phase games at once. A league phase
  // can be drawn up in advance because nothing you do changes who is in it.
  const euro = seedEurope(next);
  next.euroState = euro.state ?? undefined;
  next.fixtures = [...next.fixtures, ...seeded.fixtures, ...drawn.fixtures, ...euro.fixtures];

  // Phase 3 of STAR_POWER_POLITICS.md's own two season-boundary hooks: the
  // board considers whatever minority-shareholder recommendations are
  // still pending, and every club you're president of pays out its wage.
  Object.assign(next, considerRecommendations(next, mulberry32(next.season * 54617 + 13)));
  Object.assign(next, payPresidentWages(next));
  // Phase 7 of STAR_POWER_POLITICS.md — every owned club's own stadium
  // pays its own real gate-receipt revenue, into its own budget.
  Object.assign(next, creditStadiumRevenue(next));
  // A commissioned stadium expansion ticks one real season closer to done —
  // see facilities.ts's own research note on why this isn't instant.
  Object.assign(next, progressStadiumBuilds(next));

  // Aged skills, a season's trophies, fresh personal bests and any
  // achievement this rollover itself unlocked are all final at this point —
  // exactly the moment computeStarRating should read them from.
  const settled = applyAchievements(next);
  return {
    career: { ...settled.career, starRating: computeStarRating(settled.career) },
    newlyUnlocked: settled.newlyUnlocked,
  };
}

function clamp01to100(v: number): number {
  return Math.max(0, Math.min(100, v));
}

// Append any freshly-earned achievements to the state and report which they were.
function applyAchievements(next: CareerState): { career: CareerState; newlyUnlocked: string[] } {
  const newlyUnlocked = checkNewAchievements(next);
  if (newlyUnlocked.length === 0) return { career: next, newlyUnlocked };
  return { career: { ...next, achievements: [...next.achievements, ...newlyUnlocked] }, newlyUnlocked };
}

/**
 * A week the player was not in the squad for.
 *
 * The match still happens: the club plays it, the division plays its round, and
 * the table moves. What the player gets is the wage, a week of rest, a drop in
 * sharpness — and a manager who has softened slightly, which is the only thing
 * that stops being dropped from being permanent, since the fastest way to raise
 * the boss relationship is to play well and you cannot.
 */
export function simulateMissedFixture(
  career: CareerState,
  fixture: Fixture,
): { career: CareerState; newlyUnlocked: string[]; homeScore: number; awayScore: number } {
  // ── Has this one already been simulated? ──
  //
  // The same class of bug creditMatchResult's own `alreadyPlayed` guard
  // exists for — this function had none of it. Matched on week/kind/
  // opponent, not object identity, for the same reason: a caller working
  // off a stale `career` hands over a stale fixture OBJECT too, and
  // `f === fixture` alone (further down) missed it.
  const kind = fixture.kind ?? "league";
  const sameFixture = (f: Fixture) =>
    f.week === fixture.week && (f.kind ?? "league") === kind && f.opponent === fixture.opponent;
  const alreadyPlayed = career.fixtures.some(f => sameFixture(f) && f.played);
  if (alreadyPlayed) {
    const existing = career.fixtures.find(sameFixture)!;
    return {
      career, newlyUnlocked: [],
      homeScore: existing.homeScore ?? 0, awayScore: existing.awayScore ?? 0,
    };
  }

  const rng = mulberry32(career.season * 1000 + career.week + 7717);
  const strength = (name: string) => career.league.find((t) => t.name === name)?.strength ?? 65;
  const mine = strength(career.player.club);
  // A European opponent is not in career.league at all — the domestic lookup
  // above would silently fall back to a flat 65 for every single one of
  // them. `fixture.opponentStrength` is the real number (set by euro.ts's
  // own club pool) and takes priority whenever it's there.
  const theirs = fixture.opponentStrength ?? strength(fixture.opponent);

  // Reported from the player's point of view, the same way stats.homeScore is.
  const score = fixture.home
    ? simulateFixtureScore(mine, theirs, rng)
    : simulateFixtureScore(theirs, mine, rng);
  const userScore = fixture.home ? score.home : score.away;
  const oppScore = fixture.home ? score.away : score.home;

  let league = career.league;
  let weekResults = career.results ?? [];
  let leagueSquads = career.leagueSquads;
  if (kind === "league") {
    const faRules = ruleBookFor(career, "FA");
    league = updateLeagueWithUserResult(career.league, career.player.club, fixture.opponent, userScore, oppScore, faRules, rng);
    const squads = (career.leagueSquads ?? []).map(sq => ({ ...sq, players: sq.players.map(p => ({ ...p })) }));
    const round = playLeagueWeek(league, fixture.week, {
      club: career.player.club, opponent: fixture.opponent, home: fixture.home,
      scored: userScore, conceded: oppScore,
    }, rng, squads, faRules);
    league = round.league;
    leagueSquads = squads;
    weekResults = [...weekResults.filter(r => r.week !== fixture.week), ...round.results];
  }

  // A cup tie you were left out of still happens, and your club still goes
  // through or out of it. Being dropped does not freeze the season.
  let cups: CupRun[] = career.cups ?? [];
  let extraFixtures: Fixture[] = [];
  let cupTrophy: Trophy | null = null;
  let knockoutMessage: string | null = null;
  let cupState = career.cupState;
  if (kind !== "league" && fixture.competition) {
    const settled = settleCupTie(career, fixture, userScore, oppScore);
    if (settled) {
      cupState = settled.states;
      extraFixtures = settled.nextFixture ? [settled.nextFixture] : [];
      cupTrophy = settled.trophy;
      knockoutMessage = settled.message;
    }
    const idx = settled ? -1 : cups.findIndex(r => r.competition === fixture.competition && !r.eliminated);
    if (idx >= 0) {
      const out = resolveKnockout(career, cups[idx], fixture, userScore, oppScore);
      cups = cups.map((r, i) => (i === idx ? out.run : r));
      if (out.nextFixture) extraFixtures = [out.nextFixture];
      cupTrophy = out.trophy;
      knockoutMessage = out.message;
    }
  }

  // A Champions/Europa League fixture you were left out of still happens —
  // settleEuro itself returns null for anything that is not one, so this is
  // safe to call unconditionally whenever there IS a euroState. Missing this
  // used to leave that matchday's leaguePhase entry permanently unplayed
  // (career.euroState was never touched here at all), which could stop
  // leaguePhaseComplete ever becoming true for a save that watched even one
  // European game from the stands.
  let euroState = career.euroState;
  let externalSquads = career.externalSquads;
  if (euroState) {
    // Nobody watched this one live, so there are no real goal events to hand
    // in — every one of the matchday's eighteen games, yours included, gets
    // named the same weighted-roll way (see simulateEuroMatchday).
    const euroSquads = (career.externalSquads ?? []).map(sq => ({ ...sq, players: sq.players.map(p => ({ ...p })) }));
    const settled = settleEuro(career, fixture, userScore, oppScore, euroSquads);
    if (settled) {
      euroState = settled.state;
      externalSquads = euroSquads;
      if (settled.nextFixture) extraFixtures = [...extraFixtures, settled.nextFixture];
      if (settled.trophy) cupTrophy = settled.trophy;
      if (settled.message) knockoutMessage = settled.message;
    }
  }

  // Same real-time cup advancement as creditMatchResult's own — a fixture
  // watched from the stands (or fast-forwarded through by a dev-skip; see
  // devSkip.ts's skipTo, which calls this function for every fixture in
  // between) is exactly as much a tick of the career's clock as one you
  // actually played, so every cup you are no longer part of gets the same
  // chance to move forward here too.
  {
    const clock = fixtureTimestamp(career.player.startYear, career.season, fixture.week, fixture.kind, divisionOf(career));
    const cupsRng = mulberry32(career.season * 60013 + fixture.week * 7 + 41);
    cupState = advanceEliminatedCups({ ...career, cupState }, clock, cupsRng);
  }

  const fixtures = career.fixtures.map((f) =>
    (f === fixture || sameFixture(f))
      ? {
          ...f,
          played: true,
          homeScore: f.home ? userScore : oppScore,
          awayScore: f.home ? oppScore : userScore,
          // No goals, no assists and no rating: deliberately left undefined so
          // nothing averages a match the player did not play into their form.
        }
      : f,
  );

  const next: CareerState = {
    ...career,
    league,
    results: weekResults,
    leagueSquads,
    externalSquads,
    fixtures: [...fixtures, ...extraFixtures],
    cups,
    cupState,
    euroState,
    trophies: cupTrophy ? [...career.trophies, cupTrophy] : career.trophies,
    knockoutMessage,
    // A week you didn't play still costs the horse its keep, exactly like a
    // played week does (see the other call site's own note above).
    // A week's wage, not a fixture's — see wages.ts.
    //
    // This is the other half of the same overpayment the played-match path
    // had: both sites paid a full wage PER FIXTURE, so a week holding a
    // midweek tie and a Saturday game paid twice over whether you played
    // them, sat them out, or did one of each. Sharing the week here as well
    // as there is what makes a week total exactly one week's wage in every
    // combination.
    //
    // You are paid for the week, not for turning up, so the share is the
    // same as it would have been had you played this one.
    money: career.money + wageForFixture(career, fixture) - (career.horse ? horseUpkeep(career.horse) : 0),
    weekActions: WEEK_ACTIONS,
    matchFitness: Math.max(20, career.matchFitness + MISSED_WEEK.matchFitness),
    // Not playing costs nothing, and the rest days until the next fixture
    // give energy back like any other gap (energy.ts).
    energy: Math.round(clampEnergy(career.energy + restRecoveryAfter(career, fixture, fixtures))),
    injury: career.injury
      ? (career.injury.weeksRemaining - 1 <= 0 ? null : { ...career.injury, weeksRemaining: career.injury.weeksRemaining - 1 })
      : null,
    relationships: {
      ...career.relationships,
      boss: clamp01to100(career.relationships.boss + MISSED_WEEK.boss),
    },
    week: career.week + 1,
    horse: career.horse
      ? { ...career.horse, energy: Math.min(100, career.horse.energy + 20) }
      : career.horse,
  };
  next.status = selectionFor(next).status;

  // ── The play-offs ──
  //
  // The same seed/settle pair creditMatchResult runs — a Championship run
  // does not pause just because you were left out of a leg or the deciding
  // round of the league itself.
  if (fixture.kind === "playoff") {
    const settled = settlePlayOffFixture(career, fixture, userScore, oppScore);
    if (settled) {
      next.playOffState = settled.state;
      if (settled.fixtures.length) next.fixtures = [...next.fixtures, ...settled.fixtures];
      next.knockoutMessage = settled.message;
    }
  } else if (kind === "league" && leagueSeasonComplete(next, fixture.week)) {
    const seeded = seedPlayOffs(next);
    if (seeded) {
      next.playOffState = seeded.state;
      next.fixtures = [...next.fixtures, ...seeded.fixtures];
    }
  }

  const { career: withAchievements, newlyUnlocked } = applyAchievements(next);
  // A cup won from the stands (`cupTrophy`, above) still moves the rating —
  // trophies count toward it whether or not you were the one who lifted it
  // in person.
  return {
    career: { ...withAchievements, starRating: computeStarRating(withAchievements) },
    newlyUnlocked, homeScore: userScore, awayScore: oppScore,
  };
}
