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
import { selectionFor, MISSED_WEEK } from "./selection";
import { startNewWeek, WEEK_ACTIONS } from "./week";
import { judgeSeason } from "./expectations";
import {
  seasonAwards, captaincyEarned, assignSquadNumber, CAPTAIN_TEAM_BONUS,
} from "./recognition";
import { makeManager, sackCheck, bossOnArrival, reputationTier } from "./manager";
import { rivalryMultiplier } from "./rivalries";
import { progressObjectives, rollSponsorSeason } from "./sponsors";
import { appearanceMoney, loyaltyMoney } from "./contracts";
import {
  seedSeasonKnockouts, seedCups, seedEurope, settleEuro, settleCupTie, resolveKnockout,
  qualificationFor, leaguePosition, seasonQualifiers,
} from "./competitions";
import { STARTING_EUROPEAN_QUALIFICATION } from "./clubs";
import { finishCupToWinner } from "./cups";
import { crownWithoutYou } from "./euro";
import { BOOTS_CATALOGUE } from "./shopData";
import { checkNewAchievements } from "./achievements";
import { updatePersonalBests } from "./records";
import { generateSquad, clubNameSeed } from "./squadData";
import { transferWindowFor, divisionOf, leagueNameFor, type CareerDivision } from "./calendar";
import { runTransferWindow, runInternationalWindow, returnLoansHome } from "./leagueTransfers";
import { resolveLadder, membershipOf } from "./promotion";
import { seedPlayOffs, settlePlayOffFixture, leagueSeasonComplete } from "./playoffs";
import { resetLeagueSquads, syncLeagueStrengthFromSquads } from "./leagueSquads";
import {
  monthOfCareer, endsMonthOn, alreadyAwarded, voteMonth, catchUpAwards, type MonthAward,
} from "./potm";
import { kitsOf } from "./kits";
import { surname } from "./media/grammar";

export const SPONSOR_CATEGORIES = [
  "Boots", "Sports Drink", "Sports Clothing", "Casual Clothing", "Food",
  "Cosmetics", "Watch", "Electronics", "Jewelry", "Car",
];

/** Fame handed out for a season's silverware, at rollover — see the
 *  `trophyFame` computation in advanceSeason. A league title (or a European
 *  Cup) means more than a Community Shield, so the trophy itself decides how
 *  much; anything not listed (Play-Offs, an unnamed cup) still counts a
 *  little rather than nothing. */
const TROPHY_FAME: Record<string, number> = {
  "Premier League": 25, "Championship": 20,
  "Champions League": 22, "Europa League": 12, "Conference League": 8,
  "FA Cup": 14, "League Cup": 9,
  "Community Shield": 4, "Super Cup": 4,
};

const EMPTY_SEASON_STATS = {
  appearances: 0, goals: 0, hatTricks: 0, passes: 0, assists: 0, starMan: 0, totalRating: 0, ratingCount: 0,
};

/** What a full ninety minutes costs — see nextEnergy in creditMatchResult. */
export const ENERGY_MATCH_COST = 32;

// ── Injury risk ──────────────────────────────────────────────────────────
//
// A real chance on every appearance — a fresh pair of legs still picks up a
// freak knock now and then — that climbs sharply once you are running on
// empty. INJURY_RISK_BASE is what a fully-rested player faces;
// INJURY_RISK_FATIGUE_EXTRA is the most fatigue alone can add on top, phased
// in as end-of-match energy falls through INJURY_FATIGUE_FLOOR.
export const INJURY_RISK_BASE = 0.015;
export const INJURY_FATIGUE_FLOOR = 20;
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

export function makeInitialCareer(
  player: StarPlayer, clubs: string[], division: CareerDivision = "premier",
): CareerState {
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
    division,
    week: 1,
    matchFitness: 80,
    energy: 100,
    injury: null,
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
    kibCans: { basic: 2, premium: 0, elite: 0 },
    ownedItems: [],
    girlfriend: null,
    sponsors: SPONSOR_CATEGORIES.map((c) => ({ category: c, active: false })),
    trophies: [],
    form: [],
    // Your club's actual colours. These were `#ff0000` and `#ffffff` for every
    // club in the game — a Manchester City career stored red — and read by
    // nothing at all. The media graphics build their whole palette off them.
    kitPrimary: kitsOf(player.club).home.shirt,
    kitSecondary: kitsOf(player.club).home.trim,
    homeCity: "London",
    seenDilemmas: [],
    ballonDorWins: 0,
    horse: null,
    squad: generateSquad(clubNameSeed(player.club)),
    contractStarMilestones: [],
    contractFormOfferSeason: -1,
    europeanQualification: STARTING_EUROPEAN_QUALIFICATION[player.club] ?? null,
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
  state.squadNumber = assignSquadNumber(state, player.club);
  state.manager = makeManager(state, player.club, 1);
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
  // …and the round itself is skipped outright on a replay — see
  // `alreadyPlayed` at the top of this function.
  if (kind === "league" && !alreadyPlayed) {
    league = updateLeagueWithUserResult(career.league, career.player.club, fixture.opponent, stats.homeScore, stats.awayScore);
    const rng = mulberry32(career.season * 1000 + career.week);
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
    // The squads are mutated in place as goals are named, so they come back out
    // of the call with this week's tallies already on them.
    const squads = (career.leagueSquads ?? []).map(sq => ({ ...sq, players: sq.players.map(p => ({ ...p })) }));
    const round = playLeagueWeek(league, fixture.week, {
      club: career.player.club, opponent: fixture.opponent, home: fixture.home, scored, conceded, goals: yours,
    }, rng, squads);
    league = round.league;
    leagueSquads = squads;
    // Replaying a week replaces it rather than doubling it.
    weekResults = [...weekResults.filter(r => r.week !== fixture.week), ...round.results];
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

  // ── Energy: spent by playing, never given back by the week just turning
  //    over — see the field's own doc comment on CareerState. A full ninety
  //    costs ENERGY_MATCH_COST; twenty minutes off the bench costs a
  //    quarter of that, same minuteShare a cameo already uses for
  //    matchFitness above it. Guarded on `alreadyPlayed` the same way
  //    `accrue` above is — a replayed fixture must not spend the budget
  //    twice.
  const nextEnergy = alreadyPlayed
    ? career.energy
    : Math.max(0, career.energy - Math.round(ENERGY_MATCH_COST * minuteShare));

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
    : progressObjectives(career.sponsors, stats, accrue(career.seasonStats));
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
  // Guarded on `alreadyPlayed` for the same reason the league round is
  // (see the top of this function): unguarded, a replayed knockout leg
  // found the competition's state already advanced past this tie by the
  // FIRST credit, and settled the tie a second time against whatever round
  // had been drawn NEXT — auto-winning or auto-eliminating a round never
  // actually played, and potentially minting a duplicate trophy if that
  // phantom result happened to land on the final.
  if (kind !== "league" && fixture.competition && !alreadyPlayed) {
    // Europe first: a league-phase night and a two-legged tie are neither a
    // domestic cup round nor a counter-style run, and asking the other two
    // handlers about it would have them answer for a competition they do not
    // know about.
    const euro = settleEuro(career, fixture, stats.homeScore, stats.awayScore);
    const settled = euro ? null : settleCupTie(career, fixture, stats.homeScore, stats.awayScore);
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
      const won = scored !== conceded ? scored > conceded : rng() < 0.5;
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

  const next: CareerState = {
    ...career,
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
    fixtures: [...fixtures, ...extraFixtures],
    // Match-day money: the wage and bonuses the result produced, an appearance
    // fee if the deal has one, and anything a sponsor objective just paid out.
    // Guarded on `alreadyPlayed` — none of this was earned twice.
    money: alreadyPlayed ? career.money : career.money + stats.totalCash
      + (isInternational ? 0 : appearanceMoney(career.contract))
      + progressed.earned,
    // Twenty minutes off the bench does not sharpen you as much as ninety —
    // and a replay does not sharpen you again.
    matchFitness: alreadyPlayed ? career.matchFitness : Math.min(100, career.matchFitness + 3 * minuteShare),
    energy: nextEnergy,
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
    starRating: alreadyPlayed ? career.starRating
      : Math.min(5, career.starRating + (stats.rating >= 8 ? 0.03 : stats.rating >= 7 ? 0.01 : 0)),
    fame: alreadyPlayed ? career.fame : career.fame + Math.max(0, Math.floor(stats.fansChange / 2)),
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

  return { ...applyAchievements(next), potmAwarded: potmJustAwarded ?? undefined };
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
 */
export function runDueTransferWindow(next: CareerState): CareerState {
  if (!next.leagueSquads?.length) return next;
  const openedWindow = transferWindowFor(next.player.startYear, next.season, next.week, divisionOf(next));
  if (!openedWindow) return next;
  const key = `${next.season}-${openedWindow}`;
  if (next.lastTransferWindowKey === key) return next;

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

  const qualifiers = seasonQualifiers(career.league, faCupWinner, leagueCupWinner);
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
  const trophyFame = thisSeason.reduce((sum, t) => sum + (TROPHY_FAME[t.competition] ?? 6), 0);
  const honourFame = honours.length * 4;
  const wonFaCup = thisSeason.some(t => t.competition === "FA Cup");
  const wonLeagueCup = thisSeason.some(t => t.competition === "League Cup");
  const wonEuroComp = thisSeason.some(t => t.competition === "Champions League" || t.competition === "Europa League");
  // Europe is a Premier League reward. Finishing fourth in the Championship
  // qualifies you for promotion, not for the Champions League — and
  // `qualificationFor` only knows about positions and club counts, so it
  // would happily hand out a European place for one if it were asked.
  const qualification = divisionOf(career) === "championship" ? null : qualificationFor(
    leaguePosition(career), career.league.length, wonFaCup, wonLeagueCup, wonEuroComp,
  );

  const lastSeasonWinners = resolveSeasonWinners(career);

  const next: CareerState = {
    ...career,
    player: { ...career.player, age: newAge },
    skills: agedSkills,
    season: career.season + 1,
    division: nextDivision,
    divisions: ladder.divisions,
    ladderNews: {
      yourMove: ladder.yourMove,
      promotedToPremier: ladder.promotedToPremier,
      relegatedFromPremier: ladder.relegatedFromPremier,
      promotedToChampionship: ladder.promotedToChampionship,
      relegatedFromChampionship: ladder.relegatedFromChampionship,
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
    leagueSquads: resetLeagueSquads(
      (career.leagueSquads ?? []).filter(s => clubs.includes(s.club)),
    ),
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
    fame: career.fame + trophyFame + honourFame,
    money: career.money + loyalty + seasonFeeTotal,
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
    const incoming = makeManager(next, next.player.club, next.season);
    next.manager = incoming;
    next.managerNews = `${sack.reason} ${incoming.name} (${reputationTier(incoming.reputation)}) takes over. "${incoming.arrival}"`;
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
  const theirs = strength(fixture.opponent);

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
    league = updateLeagueWithUserResult(career.league, career.player.club, fixture.opponent, userScore, oppScore);
    const squads = (career.leagueSquads ?? []).map(sq => ({ ...sq, players: sq.players.map(p => ({ ...p })) }));
    const round = playLeagueWeek(league, fixture.week, {
      club: career.player.club, opponent: fixture.opponent, home: fixture.home,
      scored: userScore, conceded: oppScore,
    }, rng, squads);
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
    fixtures: [...fixtures, ...extraFixtures],
    cups,
    cupState,
    trophies: cupTrophy ? [...career.trophies, cupTrophy] : career.trophies,
    knockoutMessage,
    money: career.money + career.contract.wage,
    weekActions: WEEK_ACTIONS,
    matchFitness: Math.max(20, career.matchFitness + MISSED_WEEK.matchFitness),
    // Not playing does not cost you energy — it is the one thing every week
    // off is actually good for.
    energy: Math.min(100, career.energy + MISSED_WEEK.energy),
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
  return { career: withAchievements, newlyUnlocked, homeScore: userScore, awayScore: oppScore };
}
