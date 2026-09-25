import type { CareerState, Skills } from "./types";
import type { TransferOffer } from "./transfers";
import { reputation } from "./transfers";
import { type CareerDivision, divisionRank, divisionBelow, matchweeksFor, divisionOf } from "./calendar";
import { weeklyWageFor, offerWageFor, goalBonusFor, assistBonusFor } from "./economy";
import { selectionStanding } from "./selection";
import { simulateFixtureScore } from "./season";
import { clubsForDivision } from "./scoutOffers";
import { clubStanding } from "./clubReputation";
import { growthMultiplier } from "./rating";
import { getTuning } from "./tuningStore";

/**
 * THE YOUTH TEAM — AND EVERY OTHER WAY OF BEING AT A CLUB WITHOUT BEING IN
 * THE SIDE.
 *
 * ── What this replaces, and why it is not the free-agent life ──
 *
 * Until now a trial that fell short left you with NO CLUB AT ALL: the
 * free-agent shell (freeAgent.ts, FreeAgentShell.tsx), ★10 a week, a garden
 * gym with a ceiling of 55, and one route out — wait four weeks for another
 * trial. That is a real, deliberately bleak phase and it stays exactly as it
 * is. What was wrong was that it caught EVERYBODY who was not signed
 * outright, including a sixteen-year-old a club genuinely liked and simply
 * would not hand a professional contract to. In real football that boy goes
 * into the youth team. Now he does here.
 *
 * Asked for directly — *"yes youth team"*, as *"part of the trial and when
 * you have terrible form"*, and *"also think loans with goal based
 * achievments could be wildcard trial outcomes"*. That is three entry points,
 * and they are deliberately ONE system rather than three:
 *
 *   1. **The trial falls short of a contract.** Nobody offered terms, but
 *      somebody down the leagues will take you into their youth side.
 *   2. **Form collapses at a real club.** Not straight out of the door —
 *      back down to the kids, which is what actually happens.
 *   3. **The loan wildcard.** A bigger club than you had any right to
 *      expect signs you and immediately sends you somewhere you will
 *      actually play, with a number on it: score N by the end of the
 *      season.
 *
 * What all three share, and what makes them one `Placement`: you are AT a
 * club, you are NOT in its first team, and there is a concrete, stated way
 * out. That last part is the whole design. A youth spell with no route into
 * the side is the free-agent limbo again with a better badge on it.
 *
 * ── What a week in the youth team actually is ──
 *
 * Stated plainly, because the honest answer shapes everything below: THERE
 * IS NO YOUTH LEAGUE IN THIS GAME, and building one would mean a second
 * fixture list, a second table and a second set of squads — the league and
 * fixture model, which is explicitly not this lane's to touch.
 *
 * So a youth week is built out of two things that already exist plus one
 * small new one:
 *
 *   • **The club's own fixture happens without you.** That is
 *     `simulateMissedFixture` (careerFlow.ts) — already real, already
 *     tested: the league table moves, the cups move, the week rolls over,
 *     the wage is paid, the manager softens slightly. Being in the youth
 *     team IS being left out of the squad, so this is not an approximation
 *     of anything; it is the same thing.
 *   • **The ordinary week.** Train a skill, work on a relationship, rest —
 *     `week.ts`, untouched. A youth player's week is spent the same way
 *     anybody else's is, which is also the mechanism by which he gets good
 *     enough to leave.
 *   • **A youth fixture of your own, with a real result** — `playYouthMatch`
 *     below. That is the genuinely new part, and it is deliberately the
 *     smallest real version: a scoreline from the same `simulateFixtureScore`
 *     the other nineteen clubs' matches already use, your own goals and
 *     assists rolled against the level you are playing at, a rating, and a
 *     line from the coach. It is not a playable match. It IS a real,
 *     recorded performance that moves a real number.
 *
 * That number is `Placement.progress`, and reaching 100 gets you promoted
 * into the first team on a real contract. That is the way out, and it is the
 * only one.
 */

// ═══════════════════════════════════════════════════════════════════════
//  THE PLACEMENT
// ═══════════════════════════════════════════════════════════════════════

export type PlacementKind = "youth" | "loan";

/** How you ended up here. Shown to the player; nothing branches on it. */
export type PlacementReason = "trial" | "form" | "wildcard";

export interface YouthMatch {
  /** Career week this was played in. */
  week: number;
  /** Your youth side's score, then theirs. */
  scored: number;
  conceded: number;
  goals: number;
  assists: number;
  /** 0-10, the same scale every other rating in this game is on. */
  rating: number;
  /** What the youth coach said afterwards. */
  verdict: string;
  /** What this did to the promotion meter — signed, so a bad week reads. */
  progressDelta: number;
}

export interface Placement {
  kind: PlacementKind;
  reason: PlacementReason;
  /** The club you are actually at — whose youth team, or whose side you are
   *  on loan AT. `career.player.club` is always this. */
  club: string;
  division: CareerDivision;
  /** LOAN ONLY: who actually owns you and pays you. */
  parentClub?: string;
  parentDivision?: CareerDivision;
  /** LOAN ONLY: goals wanted by the end of the season. */
  target?: number;
  /** LOAN ONLY: the goals you had the day the loan started, so the target is
   *  measured over the loan rather than over a season you were part-way
   *  through. Almost always 0 (a loan starts at signing), but a loan is a
   *  season-stats comparison and a comparison needs a baseline or it lies. */
  goalsAtStart?: number;
  /** YOUTH ONLY: 0-100. At 100 the first-team manager takes you up. */
  progress: number;
  /** YOUTH ONLY: how many youth matches this spell has had, and what you did
   *  in them. Kept on the spell rather than in `seasonStats`, deliberately —
   *  a youth goal is not a first-team goal and must never reach the Golden
   *  Boot, Player of the Month, or your career record. */
  apps: number;
  goals: number;
  assists: number;
  /** The last youth match, for the screen. */
  last?: YouthMatch;
}

/**
 * What to call this on screen.
 *
 * A nineteen-year-old is in the youth team. A twenty-eight-year-old the
 * manager has frozen out is training with the kids, which every club in the
 * country calls the reserves. Same mechanic, honest label — the alternative
 * was either a second placement kind that behaves identically, or telling a
 * veteran he is in the under-18s.
 */
export const YOUTH_AGE_LIMIT = 21;

export function placementLabel(career: CareerState): string {
  const p = career.placement;
  if (!p) return "";
  if (p.kind === "loan") return `On loan at ${p.club}`;
  return career.player.age <= YOUTH_AGE_LIMIT ? "Youth team" : "Reserves";
}

// ═══════════════════════════════════════════════════════════════════════
//  THE MONEY
// ═══════════════════════════════════════════════════════════════════════

/**
 * What a youth-team player is worth on the one wage curve the whole game
 * uses — and why this is a standing rather than a number.
 *
 * `weeklyWageFor(club, division, standing)` (economy.ts) is the ONLY place a
 * wage comes from, and `standing` is 0-1: how well thought of you are. A
 * youth-team player is thought of at exactly zero — nobody is considering
 * him for the side, which is what being in the youth team means. So the
 * youth wage is not a new figure at all; it is the bottom of the club's own
 * band, `standingMultiplier(0)` = half what a bench player gets.
 *
 * The consequence is the right one and it is worth stating: a youth
 * contract at a Premier League club is real money and a youth contract in
 * the National League is ★10 a week — the same ★10 a free agent scrapes
 * (freeAgent.ts). Down there, being in a youth team instead of your own
 * garden buys you coaching and a route into a first team, not a living.
 */
export const YOUTH_STANDING = 0;

/**
 * …and what a first-team promotion is worth. Between a youth player (0) and
 * a plain starter (`STARTER_STANDING`, 0.55): a kid who has just forced his
 * way up is in the squad and around the side, not first on the team sheet.
 */
export const PROMOTION_STANDING = 0.35;

/**
 * A loan player is paid by his PARENT club — that is what a loan is. The
 * standing is a fringe man at a club that rates him enough to develop him
 * but not enough to play him, which is exactly what got him loaned out.
 */
export const LOAN_STANDING = 0.2;

/** …and what he comes back to if he hits the number. A step up from the
 *  fringe, short of a guaranteed starter — he has earned a look, not a
 *  shirt. */
export const LOAN_RETURN_STANDING = 0.45;

export function youthWage(club: string, division: CareerDivision): number {
  return weeklyWageFor(club, division, YOUTH_STANDING);
}

// ═══════════════════════════════════════════════════════════════════════
//  THE FOOTBALL
// ═══════════════════════════════════════════════════════════════════════

/**
 * How good the football is in this club's youth team, 0-100, on the same
 * scale `LeagueTeam.strength` uses.
 *
 * A step per rung of the ladder, exactly like the wage curve — a Premier
 * League youth side is a far harder place to stand out than a National
 * League one, which is the single most important property of this whole
 * feature: WHERE you end up decides how long it takes to get out, and a
 * big club's youth team is a genuine test rather than a formality.
 */
export const YOUTH_LEVEL_BOTTOM = 32;
export const YOUTH_LEVEL_STEP = 6;

export function youthLevelFor(division: CareerDivision): number {
  const rungsAboveBottom = 4 - divisionRank(division);
  return YOUTH_LEVEL_BOTTOM + rungsAboveBottom * YOUTH_LEVEL_STEP;
}

/**
 * How good YOU are, on that same 0-100 scale.
 *
 * The flat mean of the five trained skills, deliberately — every one of them
 * is trainable and every one of them is what a youth coach is looking at.
 * A career opens on 40/40/40/40/30, so a new trialist reads 38: comfortably
 * above National League youth football (32) and a long way below a Premier
 * League youth team (56). That gap is the game.
 */
export function youthAbility(skills: Skills): number {
  const { pace, power, technique, vision, freeKick } = skills;
  return (pace + power + technique + vision + freeKick) / 5;
}

/** A small Poisson draw. `season.ts` has one but does not export it, and
 *  reaching into another module's internals for four lines is worse than
 *  four lines. */
function poisson(lambda: number, rng: () => number): number {
  const L = Math.exp(-Math.max(0, lambda));
  let k = 0, p = 1;
  do { k++; p *= rng(); } while (p > L && k < 12);
  return k - 1;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Where a rating of exactly this leaves the promotion meter untouched.
 *
 * MEASURED, not chosen. At 6.8 a player playing at exactly the level of the
 * youth football around him averaged 6.87 and crept up the meter at 0.07 a
 * week — a hundred and sixty seasons. Half the spells run in testing never
 * reached the top at all, and a fresh trialist in a League Two youth team
 * (whose level his skills exactly match) never got out once in forty tries.
 * That is the inescapable grind this whole feature exists to NOT be.
 *
 * At 6.5 the same at-the-level player climbs out in roughly thirty weeks,
 * somebody comfortably better than the level does it in ten to fifteen, and
 * somebody genuinely below it still goes backwards. See
 * `tests/star/youth.mts`, which asserts the measured spread rather than the
 * shape.
 */
export const PROMOTION_PAR = 6.5;
/** How far one rating point moves it. A 7.5 is +9, about eleven good weeks
 *  from nothing to promoted; a 5.5 is -9 and you go backwards. */
export const PROGRESS_PER_RATING = 9;
/** The meter a promotion happens at. */
export const PROMOTION_AT = 100;

/**
 * ONE YOUTH MATCH.
 *
 * Pure: everything it needs is the placement, your skills and an rng. No
 * career mutation happens here — see `applyYouthWeek`.
 */
export function playYouthMatch(career: CareerState, rng: () => number): YouthMatch {
  const p = career.placement;
  const level = youthLevelFor(p?.division ?? divisionOf(career));
  const ability = youthAbility(career.skills);
  const edge = ability - level;

  // You lift the side you are in, a bit. A good kid in a bad youth team
  // wins more games than that team has any right to, which is also how he
  // gets noticed.
  const ours = clamp(level + edge * 0.25, 10, 95);
  const theirs = clamp(level, 10, 95);
  // Home and away really do alternate, because `simulateFixtureScore` gives
  // the home side a real advantage and handing it to your team every single
  // week would quietly inflate every youth record in the game.
  const home = career.week % 2 === 1;
  const raw = home
    ? simulateFixtureScore(ours, theirs, rng)
    : simulateFixtureScore(theirs, ours, rng);
  const score = home ? raw : { home: raw.away, away: raw.home };

  // How much of it goes through you. An expected goal involvement of about
  // 0.9 at your own level, climbing or falling with the gap.
  const involvement = clamp(0.9 + edge * 0.03, 0.15, 3);
  const goals = Math.min(score.home, poisson(involvement * 0.62, rng));
  const assists = Math.min(Math.max(0, score.home - goals), poisson(involvement * 0.38, rng));

  const result = score.home > score.away ? 1 : score.home < score.away ? -1 : 0;
  const rating = clamp(
    6.2
    + goals * 0.9
    + assists * 0.5
    + edge * 0.02
    + result * 0.3
    + (rng() - 0.5) * 0.8,
    3, 10,
  );

  const verdict = goals >= 2 ? "Unplayable this afternoon. They could not get near you."
    : goals === 1 ? "Took your goal well. More of that."
    : assists > 0 ? "Quiet, but you made the one that mattered."
    : rating >= 7 ? "Worked hard, did the right things. Keep going."
    : rating >= 6 ? "Nothing wrong with it. Nothing to write home about either."
    : rating >= 5 ? "You drifted out of that. They will have noticed upstairs."
    : "That was not good enough. You know it was not.";

  const progressDelta = Math.round((rating - PROMOTION_PAR) * PROGRESS_PER_RATING * 10) / 10;

  return {
    week: career.week,
    scored: score.home,
    conceded: score.away,
    goals, assists,
    rating: Math.round(rating * 10) / 10,
    verdict,
    progressDelta,
  };
}

/**
 * What playing that match does to the career.
 *
 * Takes the career AFTER the club's own fixture has been settled (see this
 * file's header — a youth week is `simulateMissedFixture` plus this), so it
 * deliberately does not touch the week number, the wage, the table or the
 * cups. It owns exactly three things: the placement's own record, the
 * promotion meter, and the two costs of having actually played.
 *
 * `matchFitness` is the important one. `simulateMissedFixture` takes 7 off
 * it, correctly — a man who sat in the stands loses sharpness. A youth
 * player did not sit in the stands, he played ninety minutes, so this gives
 * that back and a little more. It is the concrete reason the youth team
 * beats the garden: you stay a footballer.
 */
export const YOUTH_MATCH_FITNESS = 10;
export const YOUTH_MATCH_ENERGY = 12;

/**
 * …and the third thing, which is what stops the youth team being a waiting
 * room: a good ninety minutes makes you better.
 *
 * This is not a new mechanic. `creditMatchResult` (careerFlow.ts) already
 * grants a small across-the-board skill pool off the match rating, scaled by
 * how fast a player of this age actually develops — the same three tuning
 * values and the same `growthMultiplier` are read here, so a youth match
 * develops you exactly as much as a first-team match played to the same
 * standard would. It is the one honest answer to "why is being in a youth
 * team better than sitting in your garden": you are being coached, and you
 * are playing.
 */
const YOUTH_MATCHES_GIVE_SKILL = false;

function matchSkillGain(rating: number, age: number): number {
  // Matches no longer give skill points, youth or first team (Mikey, 25 Sep
  // 2026) — skills come only from training stars (trainingLevels.ts).
  if (!YOUTH_MATCHES_GIVE_SKILL) return 0;
  const pool = rating >= 8 ? getTuning("training.matchPoolRating8")
    : rating >= 7 ? getTuning("training.matchPoolRating7")
    : rating >= 6 ? getTuning("training.matchPoolRating6")
    : 0;
  return (pool * growthMultiplier(age)) / getTuning("training.matchGainDivisor");
}

export function applyYouthWeek(career: CareerState, match: YouthMatch): CareerState {
  const p = career.placement;
  if (!p || p.kind !== "youth") return career;
  const progress = clamp(p.progress + match.progressDelta, 0, PROMOTION_AT);
  const gain = matchSkillGain(match.rating, career.player.age);
  const skills = gain <= 0 ? career.skills : {
    pace: Math.min(100, Math.round(career.skills.pace + gain)),
    power: Math.min(100, Math.round(career.skills.power + gain)),
    technique: Math.min(100, Math.round(career.skills.technique + gain)),
    vision: Math.min(100, Math.round(career.skills.vision + gain)),
    freeKick: Math.min(100, Math.round(career.skills.freeKick + gain)),
  };
  return {
    ...career,
    skills,
    matchFitness: clamp(career.matchFitness + YOUTH_MATCH_FITNESS, 0, 100),
    energy: clamp(career.energy - YOUTH_MATCH_ENERGY, 0, 100),
    placement: {
      ...p,
      progress,
      apps: p.apps + 1,
      goals: p.goals + match.goals,
      assists: p.assists + match.assists,
      last: match,
    },
  };
}

export function readyForPromotion(career: CareerState): boolean {
  const p = career.placement;
  return !!p && p.kind === "youth" && p.progress >= PROMOTION_AT;
}

// ═══════════════════════════════════════════════════════════════════════
//  GETTING IN, AND GETTING OUT
// ═══════════════════════════════════════════════════════════════════════

export function startYouthSpell(
  club: string, division: CareerDivision, reason: PlacementReason,
): Placement {
  return { kind: "youth", reason, club, division, progress: 0, apps: 0, goals: 0, assists: 0 };
}

/**
 * ENTRY POINT 1 — WHO TAKES YOU INTO THEIR YOUTH TEAM WHEN NOBODY OFFERS
 * TERMS.
 *
 * `NO_INTEREST_BELOW` (scoutOffers.ts) is 30: under that, no club in the
 * country will put a professional contract in front of you, and that number
 * stays exactly as it is. A youth team is not a professional contract. It
 * costs a club almost nothing to take a sixteen-year-old in and have a look
 * at him for a season, which is precisely why real football does it.
 *
 * So the bar here is much lower — and it still exists. Below
 * `YOUTH_INTEREST_BELOW` nobody wants you on any terms at all, and that is
 * the free-agent life (freeAgent.ts), which stays real and stays reachable
 * as the genuine bottom of the game rather than being quietly deleted by
 * this feature.
 *
 * Which club, and how far down: the better the afternoon, the higher up the
 * ladder somebody is willing to house you.
 *
 * ── Why this stops at League Two, which is lower than it first was ──
 *
 * MEASURED, and the first cut was wrong. It ran to League One, whose youth
 * football is a level of 44 against the 38 a career actually starts on —
 * and a fresh trialist dropped in there got promoted 4 times out of 40 over
 * eighty simulated weeks. That is the inescapable grind, arrived at by a
 * GOOD trial, because the trial score decides which academy takes you while
 * your actual skills are the same 40/40/40/40/30 whatever you scored.
 *
 * At League Two (level 38, exactly where a career starts) the same player
 * got out 35 times in 40, median 51 weeks; in the National League (32) all
 * forty, median 27. Both are a real stretch and neither is a wall, which is
 * the whole requirement. Bigger academies are still reachable — through a
 * form collapse at a club that already signed you, by which point your
 * skills are a real number rather than a starting one.
 */
export const YOUTH_INTEREST_BELOW = 12;
export const YOUTH_LEAGUE_TWO_ABOVE = 20;

export interface YouthTaker {
  club: string;
  division: CareerDivision;
  clubs: string[];
  /** What they said when they offered it. */
  pitch: string;
}

export function youthTakerFor(trialScoreOutOf100: number, rng: () => number): YouthTaker | null {
  const score = Math.max(0, Math.min(100, Number.isFinite(trialScoreOutOf100) ? trialScoreOutOf100 : 0));
  if (score < YOUTH_INTEREST_BELOW) return null;
  const division: CareerDivision = score >= YOUTH_LEAGUE_TWO_ABOVE
    ? "league_two" : "national_league";
  const clubs = clubsForDivision(division);
  if (!clubs.length) return null;
  const club = clubs[Math.floor(rng() * clubs.length)] ?? clubs[0];
  return {
    club, division, clubs,
    pitch: score >= YOUTH_LEAGUE_TWO_ABOVE
      ? "Nobody is handing you a professional contract on that. We will take you into the youth team and see what you do with it."
      : "It was not good enough for terms. It was good enough for us to want another look at you.",
  };
}

/**
 * THE WAY OUT — the first team, on a real contract.
 *
 * Three things happen and all three are deliberate:
 *
 *  • A professional wage, off the same curve as every other wage in the
 *    game (`PROMOTION_STANDING`). Nothing here invents a figure.
 *  • The manager's opinion of you is restored to what a manager who has
 *    just decided to promote somebody must think of him. Without this the
 *    promotion is a trap: `selectionFor` reads `relationships.boss` for
 *    45% of your standing, so a player promoted out of a form collapse
 *    would be dropped again the same week by the very number that sent him
 *    down.
 *  • `form` is cleared. Same reason, and it is honest rather than
 *    generous: `recentForm` pads an empty history with a neutral 6.5, so
 *    this is "you start again from level", not "you start again from
 *    brilliant".
 */
export const PROMOTION_BOSS = 66;
export const PROMOTION_SEASONS = 2;

export function promoteFromYouth(career: CareerState): CareerState {
  const p = career.placement;
  if (!p || p.kind !== "youth") return career;
  const wage = weeklyWageFor(p.club, p.division, PROMOTION_STANDING);
  return {
    ...career,
    placement: undefined,
    contract: {
      club: p.club,
      wage,
      goalBonus: goalBonusFor(wage),
      assistBonus: assistBonusFor(wage),
      seasonsRemaining: Math.max(career.contract.seasonsRemaining, PROMOTION_SEASONS),
    },
    relationships: {
      ...career.relationships,
      boss: Math.max(career.relationships.boss, PROMOTION_BOSS),
    },
    form: [],
  };
}

/**
 * ENTRY POINT 2 — FORM COLLAPSING.
 *
 * Two conditions, and both are needed, because either one alone is wrong.
 *
 *  • A real run of bad games: the last three ratings you actually recorded,
 *    all under `COLLAPSE_RATING`. This is the "form" half, read literally
 *    off `career.form` — a player who has not played cannot collapse, and
 *    one bad afternoon is not a collapse.
 *  • The manager has genuinely run out of use for you:
 *    `selectionStanding` under `YOUTH_DROP_AT`, which is below
 *    `selection.ts`'s own BENCH_AT of 34. You are not merely dropped, you
 *    are not in the squad and nowhere near it.
 *
 * Deliberately NOT gated on age. The label changes for an older player
 * (`placementLabel`) but the football does not: a senior professional the
 * manager has frozen out is training with the kids, which is exactly this.
 */
export const COLLAPSE_RATING = 5.5;
export const COLLAPSE_GAMES = 3;
export const YOUTH_DROP_AT = 30;

export function formHasCollapsed(career: CareerState): boolean {
  if (career.placement) return false;           // already somewhere
  if (!career.player.club) return false;        // nobody to be dropped by
  if (career.injury) return false;              // out injured is not out of favour
  const recent = career.form.slice(0, COLLAPSE_GAMES);
  if (recent.length < COLLAPSE_GAMES) return false;
  if (!recent.every(r => r < COLLAPSE_RATING)) return false;
  return selectionStanding(career) < YOUTH_DROP_AT;
}

/**
 * Sent down. The contract is NOT rewritten — you are still under the deal
 * you signed, and being dropped does not let a club retype your wage. What
 * changes is where you play.
 */
export function dropToYouth(career: CareerState): CareerState {
  if (career.placement) return career;
  return {
    ...career,
    placement: startYouthSpell(career.player.club, divisionOf(career), "form"),
  };
}

// ═══════════════════════════════════════════════════════════════════════
//  ENTRY POINT 3 — THE LOAN WILDCARD
// ═══════════════════════════════════════════════════════════════════════

/**
 * How often a big club's interest turns into a loan instead of a contract.
 *
 * A WILDCARD, explicitly: *"think loans with goal based achievments could be
 * wildcard trial outcomes"*. Not the normal result of a good trial — an
 * occasional one, and rarer still because it can only happen at all when
 * the club that came in is a big one AND there is a real division below it
 * to be sent to.
 */
export const LOAN_WILDCARD_CHANCE = 0.18;

/** How many goals they want, by the end of the season. */
export const LOAN_TARGET_MIN = 6;
export const LOAN_TARGET_SPREAD = 5;

/** How far down the ladder they send you. Two rungs: far enough that you
 *  will genuinely play every week, close enough that the goals mean
 *  something when you get back. */
export const LOAN_DROP_RUNGS = 2;

export interface LoanSetup {
  /** Who signed you and pays you. */
  parentClub: string;
  parentDivision: CareerDivision;
  /** Where you will actually play. */
  hostClub: string;
  hostDivision: CareerDivision;
  /** Every club in the host's division — what `attachClub` needs. */
  hostClubs: string[];
  target: number;
  wage: number;
  seasons: number;
}

function divisionDown(division: CareerDivision, rungs: number): CareerDivision | null {
  let d: CareerDivision | null = division;
  for (let i = 0; i < rungs; i++) {
    d = d ? divisionBelow(d) : null;
    if (!d) return null;
  }
  return d;
}

/**
 * Does this offer become a loan instead?
 *
 * Only from a club in the top two divisions — the whole story is "they rate
 * you, they cannot play you", and a National League club that rates you
 * simply plays you. Returns `null` for every other case, which is the
 * ordinary signing and by far the common one.
 */
export function rollLoanWildcard(
  offerClub: string, offerDivision: CareerDivision, seasons: number, rng: () => number,
): LoanSetup | null {
  if (offerDivision !== "premier" && offerDivision !== "championship") return null;
  if (rng() >= LOAN_WILDCARD_CHANCE) return null;
  const hostDivision = divisionDown(offerDivision, LOAN_DROP_RUNGS);
  if (!hostDivision) return null;

  const hostClubs = clubsForDivision(hostDivision);
  if (!hostClubs.length) return null;
  // Not the biggest club in the division they are sending you to — a club
  // with a settled first team is not where you go to play every week.
  const modest = hostClubs.filter(c => clubStanding(c, hostDivision) < 0.7);
  const pool = modest.length ? modest : hostClubs;
  const hostClub = pool[Math.floor(rng() * pool.length)] ?? hostClubs[0];

  return {
    parentClub: offerClub,
    parentDivision: offerDivision,
    hostClub,
    hostDivision,
    hostClubs,
    target: LOAN_TARGET_MIN + Math.floor(rng() * LOAN_TARGET_SPREAD),
    // Paid by the parent club, because that is what a loan is.
    wage: weeklyWageFor(offerClub, offerDivision, LOAN_STANDING),
    seasons,
  };
}

export function startLoanSpell(setup: LoanSetup, goalsAtStart = 0): Placement {
  return {
    kind: "loan",
    reason: "wildcard",
    club: setup.hostClub,
    division: setup.hostDivision,
    parentClub: setup.parentClub,
    parentDivision: setup.parentDivision,
    target: setup.target,
    goalsAtStart,
    progress: 0, apps: 0, goals: 0, assists: 0,
  };
}

export interface LoanProgress {
  scored: number;
  target: number;
  met: boolean;
  /** Roughly how many games of the season are left — the honest "can I
   *  still do it" number a target is useless without. */
  weeksLeft: number;
}

export function loanProgress(career: CareerState): LoanProgress | null {
  const p = career.placement;
  if (!p || p.kind !== "loan" || p.target === undefined) return null;
  const scored = Math.max(0, career.seasonStats.goals - (p.goalsAtStart ?? 0));
  return {
    scored,
    target: p.target,
    met: scored >= p.target,
    weeksLeft: Math.max(0, matchweeksFor(divisionOf(career)) - career.week + 1),
  };
}

/**
 * THE END OF THE LOAN — what the parent club does about it.
 *
 * Returns the offer they make, or `null` when they do not make one. Hitting
 * the number is not a scripted teleport back: it is an offer, on the same
 * `TransferOffer` shape the summer window already deals in, which the
 * existing transfer screen and `acceptOffer` handle without a single change.
 * You can still turn it down and stay where you are playing every week,
 * which is a real decision and a real one to get wrong.
 *
 * Miss the number and nothing arrives. The loan simply ends and you are a
 * player of the club you were loaned to — which is also what happens in
 * football.
 */
export function loanRecallOffer(career: CareerState): TransferOffer | null {
  const progress = loanProgress(career);
  const p = career.placement;
  if (!progress || !progress.met || !p?.parentClub || !p.parentDivision) return null;

  const strength = youthLevelFor(p.parentDivision) + 20;
  const wage = offerWageFor(
    p.parentClub, p.parentDivision, reputation(career),
    // A step UP, which is what going back to the club that owns you is.
    strength - (youthLevelFor(p.division) + 20),
    career.contract.wage,
  );
  const floor = weeklyWageFor(p.parentClub, p.parentDivision, LOAN_RETURN_STANDING);
  const finalWage = Math.max(wage, floor);
  return {
    club: p.parentClub,
    division: p.parentDivision,
    strength,
    position: 0,
    wage: finalWage,
    goalBonus: goalBonusFor(finalWage),
    assistBonus: assistBonusFor(finalWage),
    seasons: 3,
    signingFee: 0,
    clauses: {},
    pitch: `You got the ${p.target} they asked for. ${p.parentClub} want you back.`,
  };
}

/**
 * THE LOAN IS OVER, either way, once the season ends.
 *
 * Two cases, and the difference between them is the whole consequence of
 * the target:
 *
 *  • **You went back.** The recall offer was accepted, `acceptOffer` has
 *    already moved you and written the parent club's contract, and
 *    `career.player.club` is no longer the club you were loaned to. Nothing
 *    to do here but clear the spell — rewriting the contract would undo the
 *    move you just made.
 *  • **You did not.** You are still at the club you were loaned to, and you
 *    are no longer on a big club's payroll: the deal becomes theirs, priced
 *    on the same curve at the same fringe-squad standing a promoted youth
 *    player gets. That is a real pay cut and it is the point — keeping a
 *    Premier League wage while playing in League One would break the wage
 *    ladder harder than anything else in this feature could.
 */
export function endLoan(career: CareerState): CareerState {
  const p = career.placement;
  if (p?.kind !== "loan") return career;
  if (career.player.club !== p.club) return { ...career, placement: undefined };
  const wage = weeklyWageFor(p.club, p.division, PROMOTION_STANDING);
  return {
    ...career,
    placement: undefined,
    contract: {
      ...career.contract,
      club: p.club,
      wage,
      goalBonus: goalBonusFor(wage),
      assistBonus: assistBonusFor(wage),
      seasonsRemaining: Math.max(1, career.contract.seasonsRemaining),
    },
  };
}
