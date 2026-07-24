// Pure career-progression reducers for the /star-dev football career mode.
// Extracted out of the React page so the season flow is one testable place with
// no UI/state coupling: each function takes a CareerState (+ inputs) and returns
// the next CareerState, never mutating the input's nested objects. The page owns
// phase routing and toasts; this owns the numbers.

import type { CareerState, StarPlayer, Skills, Boot, Fixture, MatchStats } from "./types";
import {
  buildLeague, buildFixtures, simulateOtherFixtures, updateLeagueWithUserResult, sortLeague, mulberry32,
} from "./season";
import { BOOTS_CATALOGUE } from "./shopData";
import { checkNewAchievements } from "./achievements";
import { generateSquad, clubNameSeed } from "./squadData";

export const SPONSOR_CATEGORIES = [
  "Boots", "Sports Drink", "Sports Clothing", "Casual Clothing", "Food",
  "Cosmetics", "Watch", "Electronics", "Jewelry", "Car",
];

const EMPTY_SEASON_STATS = {
  appearances: 0, goals: 0, hatTricks: 0, passes: 0, assists: 0, starMan: 0, totalRating: 0, ratingCount: 0,
};

export function makeInitialCareer(player: StarPlayer, clubs: string[]): CareerState {
  const league = buildLeague(clubs, player.club);
  const fixtures = buildFixtures(clubs, player.club);
  const starterBoot: Boot = { ...BOOTS_CATALOGUE[0] };
  return {
    version: 2,
    player,
    skills: { pace: 40, power: 40, technique: 40, vision: 40, freeKick: 30 },
    relationships: { boss: 60, team: 60, fans: 40, girlfriend: null, sponsors: 0 },
    contract: { club: player.club, wage: 1, goalBonus: 1, assistBonus: 1, seasonsRemaining: 3 },
    season: 1,
    week: 1,
    energy: 100,
    matchFitness: 80,
    happiness: 60,
    money: 3,
    starRating: 2.5,
    fame: 5,
    seasonStats: { ...EMPTY_SEASON_STATS },
    careerStats: { ...EMPTY_SEASON_STATS },
    fixtures,
    league,
    achievements: ["first-contract"],
    status: "1st Team",
    currentBoot: starterBoot,
    nrgDrinks: { basic: 2, premium: 0, elite: 0 },
    ownedItems: [],
    girlfriend: null,
    sponsors: SPONSOR_CATEGORIES.map((c) => ({ category: c, perMatch: 0, active: false })),
    trophies: [],
    form: [],
    kitPrimary: "#ff0000",
    kitSecondary: "#ffffff",
    homeCity: "London",
    seenDilemmas: [],
    ballonDorWins: 0,
    horse: null,
    squad: generateSquad(clubNameSeed(player.club)),
    contractStarMilestones: [],
    contractFormOfferSeason: -1,
  };
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

// Apply a finished match to the career: season/career stat accrual, the user's
// league result + the rest of the division's week, fixture marking, pay, energy,
// relationships, sponsor unlocks, star rating, fame, form, boot wear. Returns the
// next state plus any achievements this pushed over the line (the page toasts them).
export function creditMatchResult(
  career: CareerState,
  fixture: Fixture,
  stats: MatchStats,
): { career: CareerState; newlyUnlocked: string[] } {
  const accrue = (base: CareerState["seasonStats"]) => ({
    appearances: base.appearances + 1,
    goals: base.goals + stats.goals,
    hatTricks: base.hatTricks + (stats.goals >= 3 ? 1 : 0),
    passes: base.passes + stats.passes,
    assists: base.assists + stats.assists,
    starMan: base.starMan + (stats.starMan ? 1 : 0),
    totalRating: base.totalRating + stats.rating,
    ratingCount: base.ratingCount + 1,
  });

  let league = updateLeagueWithUserResult(career.league, career.player.club, fixture.opponent, stats.homeScore, stats.awayScore);
  const rng = mulberry32(career.season * 1000 + career.week);
  league = simulateOtherFixtures(league, career.player.club, fixture.opponent, career.week, rng);

  const fixtures = career.fixtures.map((f) =>
    f === fixture
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

  const currentBoot = { ...career.currentBoot, matches: Math.max(0, career.currentBoot.matches - 1) };

  // A rested week for the stable: the horse regains some energy between matches.
  const horse = career.horse
    ? { ...career.horse, energy: Math.min(100, career.horse.energy + 20) }
    : career.horse;

  const sponsorGain = Math.max(0, Math.floor(stats.fansChange / 3));
  const newSponsorRel = Math.min(100, career.relationships.sponsors + sponsorGain);
  const dealsUnlocked = Math.floor(newSponsorRel / 10);
  const sponsors = career.sponsors.map((s, i) =>
    i < dealsUnlocked && !s.active ? { ...s, active: true, perMatch: 1 + Math.floor(i / 2) } : s,
  );

  // Update squad player stats from this match's goal events.
  // Chain teammate goals (isUserGoal: false) → scorer gets a goal.
  // User direct goals (isUserGoal: true) → assister (if any) gets an assist.
  const goalEvents = stats.goalEvents ?? [];
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
    };
  });

  const next: CareerState = {
    ...career,
    seasonStats: accrue(career.seasonStats),
    careerStats: accrue(career.careerStats),
    league,
    fixtures,
    money: career.money + stats.totalCash,
    energy: Math.max(15, career.energy - 40),
    matchFitness: Math.min(100, career.matchFitness + 3),
    relationships: {
      ...career.relationships,
      boss: clamp01to100(career.relationships.boss + stats.bossChange),
      team: clamp01to100(career.relationships.team + stats.teamChange),
      fans: clamp01to100(career.relationships.fans + stats.fansChange),
      sponsors: newSponsorRel,
    },
    sponsors,
    starRating: Math.min(5, career.starRating + (stats.rating >= 8 ? 0.03 : stats.rating >= 7 ? 0.01 : 0)),
    fame: career.fame + Math.max(0, Math.floor(stats.fansChange / 2)),
    week: career.week + 1,
    currentBoot,
    horse,
    squad: updatedSquad,
    form: [stats.rating, ...career.form].slice(0, 5),
  };

  return applyAchievements(next);
}

// After the final fixture: award the league title if the user finished top.
export function awardLeagueTrophyIfWon(career: CareerState): { career: CareerState; wonLeague: boolean } {
  const sorted = sortLeague(career.league);
  const wonLeague = sorted[0]?.name === career.player.club;
  if (!wonLeague) return { career, wonLeague: false };
  const trophy = { season: career.season, competition: "Premier League", club: career.player.club };
  return { career: { ...career, trophies: [...career.trophies, trophy] }, wonLeague: true };
}

// Roll the career into the next season: fresh fixtures/league, a year older (with
// aging decline), reset season stats/energy/form, tick the contract down, bank a
// Ballon d'Or if won. Whether the contract now needs renewing is the caller's call
// via next.contract.seasonsRemaining.
export function advanceSeason(career: CareerState, userWonBallonDor: boolean): { career: CareerState; newlyUnlocked: string[] } {
  const clubs = career.league.map((t) => t.name);
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

  const next: CareerState = {
    ...career,
    player: { ...career.player, age: newAge },
    skills: agedSkills,
    season: career.season + 1,
    week: 1,
    fixtures: buildFixtures(clubs, career.player.club),
    league: buildLeague(clubs, career.player.club),
    seasonStats: { ...EMPTY_SEASON_STATS },
    energy: 100,
    matchFitness: 85,
    form: [],
    contract: { ...career.contract, seasonsRemaining: career.contract.seasonsRemaining - 1 },
    ballonDorWins: career.ballonDorWins + (userWonBallonDor ? 1 : 0),
    squad: (career.squad ?? []).map(p => ({ ...p, seasonGoals: 0, seasonAssists: 0 })),
  };

  return applyAchievements(next);
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
