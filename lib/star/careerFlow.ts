// Pure career-progression reducers for the /star-dev football career mode.
// Extracted out of the React page so the season flow is one testable place with
// no UI/state coupling: each function takes a CareerState (+ inputs) and returns
// the next CareerState, never mutating the input's nested objects. The page owns
// phase routing and toasts; this owns the numbers.

import type { CareerState, StarPlayer, Skills, Boot, Fixture, MatchStats, CupRun, Trophy } from "./types";
import {
  buildLeague, buildFixtures, simulateOtherFixtures, updateLeagueWithUserResult, sortLeague, mulberry32,
  simulateFixtureScore,
} from "./season";
import { selectionFor, MISSED_WEEK } from "./selection";
import { startNewWeek, WEEK_ACTIONS } from "./week";
import { judgeSeason } from "./expectations";
import {
  monthlyAward, seasonAwards, captaincyEarned, assignSquadNumber, CAPTAIN_TEAM_BONUS,
} from "./recognition";
import { makeManager, sackCheck, bossOnArrival } from "./manager";
import { isDerby, DERBY_MULTIPLIER } from "./rivals";
import { attachObjective, progressObjectives, rollSponsorSeason } from "./sponsors";
import { appearanceMoney, loyaltyMoney } from "./contracts";
import {
  seedSeasonKnockouts, resolveKnockout, qualificationFor, leaguePosition,
} from "./competitions";
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
  const state: CareerState = {
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
    europeanQualification: null,
    weekActions: WEEK_ACTIONS,
    awards: [],
    captain: false,
    clubAppearances: 0,
    cups: [],
    caps: 0,
    internationalGoals: 0,
    knockoutMessage: null,
  };
  state.squadNumber = assignSquadNumber(state, player.club);
  state.manager = makeManager(state, player.club, 1);
  const seeded = seedSeasonKnockouts(state);
  state.cups = seeded.runs;
  state.fixtures = [...state.fixtures, ...seeded.fixtures];
  return state;
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

  // Only a league fixture moves the league. A cup tie, a European night and an
  // international are none of the division's business — running the round for
  // everybody else after one of those would hand the rest of the league a free
  // week of points.
  const kind = fixture.kind ?? "league";
  let league = career.league;
  if (kind === "league") {
    league = updateLeagueWithUserResult(career.league, career.player.club, fixture.opponent, stats.homeScore, stats.awayScore);
    const rng = mulberry32(career.season * 1000 + career.week);
    league = simulateOtherFixtures(league, career.player.club, fixture.opponent, career.week, rng);
  }

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

  const minuteShare = Math.max(0.25, Math.min(1, (stats.minutes ?? 90) / 90));
  // A derby changes nothing about how it was played and everything about what it
  // was worth. Applied to the relationships only — never to the football.
  const derby = fixture.derby
    ?? isDerby(career.player.club, fixture.opponent, career.league.map(t => t.name));
  const derbyScale = derby ? DERBY_MULTIPLIER : { boss: 1, team: 1, fans: 1 };
  const currentBoot = { ...career.currentBoot, matches: Math.max(0, career.currentBoot.matches - 1) };

  // A rested week for the stable: the horse regains some energy between matches.
  const horse = career.horse
    ? { ...career.horse, energy: Math.min(100, career.horse.energy + 20) }
    : career.horse;

  const sponsorGain = Math.max(0, Math.floor(stats.fansChange / 3));
  const newSponsorRel = Math.min(100, career.relationships.sponsors + sponsorGain);
  const dealsUnlocked = Math.floor(newSponsorRel / 10);
  const activated = career.sponsors.map((s, i) =>
    i < dealsUnlocked && !s.active ? { ...s, active: true, perMatch: 1 + Math.floor(i / 2) } : s,
  );
  // A new deal comes with something to ask for — a sponsor who wants nothing is
  // just a number going up on its own.
  const withObjectives = attachObjective(career, activated);
  const progressed = progressObjectives(withObjectives, stats, accrue(career.seasonStats));
  const sponsors = progressed.sponsors;

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

  // A knockout tie settles the run: through, out, or a trophy — and winning it
  // puts the next round on the calendar, which is the only way a knockout can
  // be built, since who you play next depends on still being in it.
  let cups: CupRun[] = career.cups ?? [];
  let extraFixtures: Fixture[] = [];
  let cupTrophy: Trophy | null = null;
  let knockoutMessage: string | null = null;
  if (kind !== "league" && fixture.competition) {
    const idx = cups.findIndex(r => r.competition === fixture.competition && !r.eliminated);
    if (idx >= 0) {
      const out = resolveKnockout(career, cups[idx], fixture, stats.homeScore, stats.awayScore);
      cups = cups.map((r, i) => (i === idx ? out.run : r));
      if (out.nextFixture) extraFixtures = [out.nextFixture];
      cupTrophy = out.trophy;
      knockoutMessage = out.message;
    }
  }

  // International football is its own record. Caps and international goals do
  // not belong in a club season's numbers, and a club season's numbers are what
  // the Ballon d'Or and the club achievements read.
  const isInternational = kind === "international";

  const next: CareerState = {
    ...career,
    seasonStats: isInternational ? career.seasonStats : accrue(career.seasonStats),
    careerStats: isInternational ? career.careerStats : accrue(career.careerStats),
    caps: (career.caps ?? 0) + (isInternational ? 1 : 0),
    internationalGoals: (career.internationalGoals ?? 0) + (isInternational ? stats.goals : 0),
    cups,
    trophies: cupTrophy ? [...career.trophies, cupTrophy] : career.trophies,
    knockoutMessage,
    league,
    fixtures: [...fixtures, ...extraFixtures],
    // Match-day money: the wage and bonuses the result produced, an appearance
    // fee if the deal has one, and anything a sponsor objective just paid out.
    money: career.money + stats.totalCash
      + (isInternational ? 0 : appearanceMoney(career.contract))
      + progressed.earned,
    // Twenty minutes off the bench does not take as much out of you as ninety,
    // and does not sharpen you as much either. The week that follows gives some
    // of it back — see startNewWeek, applied below.
    energy: Math.max(15, career.energy - 40 * minuteShare),
    matchFitness: Math.min(100, career.matchFitness + 3 * minuteShare),
    relationships: {
      ...career.relationships,
      boss: clamp01to100(career.relationships.boss + Math.round(stats.bossChange * derbyScale.boss)),
      team: clamp01to100(career.relationships.team + Math.round(stats.teamChange * derbyScale.team)),
      fans: clamp01to100(career.relationships.fans + Math.round(stats.fansChange * derbyScale.fans)),
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
  // Appearances at THIS club, which is what the armband is judged on — career
  // appearances would hand it to a signing on his first day.
  next.clubAppearances = (career.clubAppearances ?? 0) + (isInternational ? 0 : 1);

  // The match is over, so a new week starts: some energy back, and three things
  // you can do with it before the next one.
  Object.assign(next, startNewWeek(next.energy));

  // The armband, once the dressing room and the manager are both behind you and
  // you have actually been here a while. Once given it is not taken away for a
  // bad month — only a transfer resets it.
  if (!next.captain && captaincyEarned(next)) {
    next.captain = true;
    next.relationships = { ...next.relationships, team: clamp01to100(next.relationships.team + 3) };
  }
  if (next.captain) {
    next.relationships = { ...next.relationships, team: clamp01to100(next.relationships.team + CAPTAIN_TEAM_BONUS) };
  }

  // Player of the Month, checked on the four-week boundary.
  const monthly = monthlyAward(next);
  if (monthly) next.awards = [...(next.awards ?? []), monthly];
  if (progressed.completed.length > 0) {
    next.sponsorNews = [...(career.sponsorNews ?? []), ...progressed.completed].slice(-4);
  }
  // Being hooked for your form is a message from the manager as well as a
  // scoreline — it costs you a little more of him than the rating alone.
  if (stats.hooked === "form") {
    next.relationships = { ...next.relationships, boss: clamp01to100(next.relationships.boss - 3) };
  }
  // The manager's view going into next week, so the dashboard's status is live
  // rather than the "1st Team" it was stamped with when the career was created.
  next.status = selectionFor(next).status;

  return applyAchievements(next);
}

// After the final fixture: award the league title if the user finished top.
export function awardLeagueTrophyIfWon(career: CareerState): { career: CareerState; wonLeague: boolean } {
  const sorted = sortLeague(career.league);
  const wonLeague = sorted[0]?.name === career.player.club;
  if (!wonLeague) return { career, wonLeague: false };
  // Idempotent: the end of a season can now be reached twice — once through the
  // post-match screen and once through the dashboard's end-of-season prompt after
  // a refresh — and a title must not be awarded twice for it.
  const already = career.trophies.some(t => t.season === career.season && t.competition === "Premier League");
  if (already) return { career, wonLeague: true };
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

  // Sponsor terms run down. A deal that was not delivered lapses, which costs
  // the retainer and some standing with everybody else — the only thing that
  // makes an objective worth chasing rather than ignoring.
  const sponsorRoll = rollSponsorSeason(career);
  // Loyalty is the one thing in the career that pays you for NOT moving. Taken
  // here, before the transfer window, because you were here for the season.
  const loyalty = loyaltyMoney(career.contract, true);

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

  // Europe is earned by where you finished, and played the FOLLOWING season —
  // so a good year is felt the year after it, which is what makes the table
  // matter beyond the title.
  const qualification = qualificationFor(leaguePosition(career), career.league.length);

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
    europeanQualification: qualification,
    knockoutMessage: null,
    weekActions: WEEK_ACTIONS,
    relationships: {
      ...career.relationships,
      boss: clamp01to100(career.relationships.boss + judgement.bossChange),
    },
    lastSeasonJudgement: judgement,
    awards: honours.length > 0 ? [...(career.awards ?? []), ...honours] : career.awards,
    sponsors: sponsorRoll.sponsors,
    sponsorNews: sponsorRoll.lapsed.length > 0 ? sponsorRoll.lapsed : [],
    money: career.money + loyalty,
  };
  if (sponsorRoll.standingHit > 0) {
    next.relationships = {
      ...next.relationships,
      sponsors: clamp01to100(next.relationships.sponsors - sponsorRoll.standingHit),
    };
  }

  // A new manager has never picked you. Everything you built with the last one
  // goes with him, which is how a settled player becomes a squad player without
  // kicking a ball differently.
  if (sack.sacked) {
    const incoming = makeManager(next, next.player.club, next.season);
    next.manager = incoming;
    next.managerNews = `${sack.reason} ${incoming.name} takes over. "${incoming.arrival}"`;
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
  next.fixtures = [...next.fixtures, ...seeded.fixtures];

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
  const rng = mulberry32(career.season * 1000 + career.week + 7717);
  const strength = (name: string) => career.league.find((t) => t.name === name)?.strength ?? 65;
  const mine = strength(career.player.club);
  const theirs = strength(fixture.opponent);

  // Reported from the player's point of view, the same way stats.homeScore is.
  const score = fixture.home
    ? simulateFixtureScore(mine, theirs, rng)
    : simulateFixtureScore(theirs, mine, rng);
  const userScore = fixture.home ? score.home : score.away;
  const oppScore = fixture.home ? score.away : score.home;

  const kind = fixture.kind ?? "league";
  let league = career.league;
  if (kind === "league") {
    league = updateLeagueWithUserResult(career.league, career.player.club, fixture.opponent, userScore, oppScore);
    league = simulateOtherFixtures(league, career.player.club, fixture.opponent, career.week, rng);
  }

  // A cup tie you were left out of still happens, and your club still goes
  // through or out of it. Being dropped does not freeze the season.
  let cups: CupRun[] = career.cups ?? [];
  let extraFixtures: Fixture[] = [];
  let cupTrophy: Trophy | null = null;
  let knockoutMessage: string | null = null;
  if (kind !== "league" && fixture.competition) {
    const idx = cups.findIndex(r => r.competition === fixture.competition && !r.eliminated);
    if (idx >= 0) {
      const out = resolveKnockout(career, cups[idx], fixture, userScore, oppScore);
      cups = cups.map((r, i) => (i === idx ? out.run : r));
      if (out.nextFixture) extraFixtures = [out.nextFixture];
      cupTrophy = out.trophy;
      knockoutMessage = out.message;
    }
  }

  const fixtures = career.fixtures.map((f) =>
    f === fixture
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
    fixtures: [...fixtures, ...extraFixtures],
    cups,
    trophies: cupTrophy ? [...career.trophies, cupTrophy] : career.trophies,
    knockoutMessage,
    money: career.money + career.contract.wage,
    energy: Math.min(100, career.energy + MISSED_WEEK.energy),
    weekActions: WEEK_ACTIONS,
    matchFitness: Math.max(20, career.matchFitness + MISSED_WEEK.matchFitness),
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

  const { career: withAchievements, newlyUnlocked } = applyAchievements(next);
  return { career: withAchievements, newlyUnlocked, homeScore: userScore, awayScore: oppScore };
}
