import type { CareerState } from "./types";
import { mulberry32, sortLeague } from "./season";
import { clubNameSeed } from "./squadData";

/**
 * WHAT THE GAME CALLS YOU
 *
 * Three things a footballer's standing is made of that the career had no idea
 * about: the awards he wins, whether he wears the armband, and the number on
 * his back.
 *
 * All three were absent in the same way. The Ballon d'Or was the only individual
 * honour in the game, so a season of twenty-five goals that did not win it left
 * no trace at all. Captaincy existed solely as a dilemma about the CURRENT
 * captain being annoyed with you. And you played fifteen seasons without a
 * squad number.
 *
 * None of it changes how you play. All of it changes what the career reads like
 * at the end, which is the point of §14.12's motivation layers — recognition is
 * a reason to keep going that costs the football nothing.
 */

// ── The golden boot race ────────────────────────────────────────────────────

const RIVAL_FIRST = ["Marco", "Diego", "Luka", "Kai", "Tobias", "Andre", "Rafa", "Nico", "Emre", "Bruno", "Yuki", "Sami"];
const RIVAL_LAST = ["Sorensen", "Vidal", "Okafor", "Brandt", "Ferreira", "Novak", "Halvorsen", "Costa", "Demir", "Lindqvist", "Sato", "Bakker"];

export interface Scorer {
  name: string;
  club: string;
  goals: number;
  isYou: boolean;
}

/**
 * The scoring chart, with you in it.
 *
 * It is a COUNT now. Every one of the 380 league games in a season is played,
 * and every goal in the 342 you are not in is given to a named player from that
 * club's real squad — so this reads the division's actual scorers rather than
 * describing them.
 *
 * What it replaced is worth writing down, because it looked identical on screen
 * and was not the same thing at all: one invented player per club, first name
 * and surname drawn from two lists, with a goal tally derived from a formula on
 * team strength times how far through the season it was. Nobody had scored any
 * of them. A striker could not have a bad season, a bad team could not have a
 * good striker, and the number never moved because of anything that happened.
 *
 * The fallback below is that old behaviour, kept for careers saved before the
 * division had squads. They get it until the next rollover fills them in.
 */
export function goldenBootRace(career: CareerState): Scorer[] {
  const squads = career.leagueSquads ?? [];
  if (squads.length === 0) return legacyRace(career);

  const out: Scorer[] = [];
  for (const sq of squads) {
    // Your own club's scorers are on `career.squad`, which is the real thing —
    // named men who were on the pitch. These rows for your club exist but were
    // never played, so they would all read nought.
    if (sq.club === career.player.club) continue;
    for (const p of sq.players) {
      if (p.goals > 0) out.push({ name: p.name, club: sq.club, goals: p.goals, isYou: false });
    }
  }
  for (const p of career.squad ?? []) {
    // League football only. A hat-trick in the FA Cup is on his club record and
    // not on this chart, which has only ever counted the league.
    const g = p.leagueGoals ?? p.seasonGoals;
    if (g > 0) out.push({ name: p.name, club: career.player.club, goals: g, isYou: false });
  }
  out.push({
    name: `${career.player.firstName} ${career.player.lastName}`,
    club: career.player.club,
    goals: career.leagueSeasonStats?.goals ?? career.seasonStats.goals,
    isYou: true,
  });
  return out.sort((a, b) => b.goals - a.goals || (a.isYou ? -1 : b.isYou ? 1 : 0));
}

/** The same shape for assists, which the division now also counts. */
export function assistRace(career: CareerState): Scorer[] {
  const squads = career.leagueSquads ?? [];
  const out: Scorer[] = [];
  for (const sq of squads) {
    if (sq.club === career.player.club) continue;
    for (const p of sq.players) {
      if (p.assists > 0) out.push({ name: p.name, club: sq.club, goals: p.assists, isYou: false });
    }
  }
  for (const p of career.squad ?? []) {
    const a = p.leagueAssists ?? p.seasonAssists;
    if (a > 0) out.push({ name: p.name, club: career.player.club, goals: a, isYou: false });
  }
  out.push({
    name: `${career.player.firstName} ${career.player.lastName}`,
    club: career.player.club,
    goals: career.leagueSeasonStats?.assists ?? career.seasonStats.assists,
    isYou: true,
  });
  return out.sort((a, b) => b.goals - a.goals || (a.isYou ? -1 : b.isYou ? 1 : 0));
}

/** How it worked before the division had players in it. See above. */
function legacyRace(career: CareerState): Scorer[] {
  const weeks = Math.max(1, career.league.reduce((n, t) => Math.max(n, t.played), 0));
  const totalWeeks = Math.max(weeks, (career.league.length - 1) * 2);
  const through = Math.min(1, weeks / totalWeeks);

  const rivals: Scorer[] = career.league
    .filter(t => t.name !== career.player.club)
    .map((t) => {
      const rng = mulberry32(clubNameSeed(t.name) + career.season * 9173);
      const first = RIVAL_FIRST[Math.floor(rng() * RIVAL_FIRST.length)];
      const last = RIVAL_LAST[Math.floor(rng() * RIVAL_LAST.length)];
      const season = Math.round((4 + (t.strength / 100) * 20) * (0.7 + rng() * 0.7));
      return { name: `${first} ${last}`, club: t.name, goals: Math.round(season * through), isYou: false };
    });

  rivals.push({
    name: `${career.player.firstName} ${career.player.lastName}`,
    club: career.player.club,
    goals: career.seasonStats.goals,
    isYou: true,
  });

  return rivals.sort((a, b) => b.goals - a.goals || (a.isYou ? -1 : 1));
}

/** Are you top of it? Ties go to you — you were there for all of them. */
export function leadingScorer(career: CareerState): boolean {
  const race = goldenBootRace(career);
  return race.length > 0 && race[0].isYou;
}

// ── Awards ──────────────────────────────────────────────────────────────────

export type AwardKind = "Golden Boot" | "Player of the Season" | "Player of the Month";

export interface Award {
  season: number;
  kind: AwardKind;
  /** Set for monthly awards. */
  week?: number;
  detail: string;
}

/** How many weeks between one monthly award and the next. */
export const MONTH_WEEKS = 4;

/**
 * Player of the Month, judged on the last four matches.
 *
 * The bar rises with the division so it stays an achievement at a strong club,
 * and it needs BOTH a run of ratings and something to show for them — a month
 * of steady sevens without a goal is a good month, not the best one in the
 * league.
 */
export function monthlyAward(career: CareerState): Award | null {
  if (career.week < MONTH_WEEKS || career.week % MONTH_WEEKS !== 0) return null;
  if (career.form.length < 3) return null;

  const recent = career.form.slice(0, MONTH_WEEKS);
  const avg = recent.reduce((s, r) => s + r, 0) / recent.length;
  const strongest = Math.max(...career.league.map(t => t.strength));
  const bar = 7.4 + (strongest / 100) * 0.7;

  if (avg < bar) return null;
  return {
    season: career.season,
    kind: "Player of the Month",
    week: career.week,
    detail: `${avg.toFixed(2)} average over four matches`,
  };
}

/**
 * End-of-season individual honours.
 *
 * The Golden Boot is simply the chart. Player of the Season needs the goals AND
 * the ratings AND, unlike the boot, a team that actually did something — an
 * individual award for a season nobody watched is not what it is for.
 */
export function seasonAwards(career: CareerState): Award[] {
  const out: Award[] = [];
  const s = career.seasonStats;

  if (s.appearances > 0 && leadingScorer(career)) {
    out.push({ season: career.season, kind: "Golden Boot", detail: `${s.goals} goals` });
  }

  const avg = s.ratingCount > 0 ? s.totalRating / s.ratingCount : 0;
  const pos = sortLeague(career.league).findIndex(t => t.name === career.player.club) + 1;
  const topHalf = pos > 0 && pos <= Math.ceil(career.league.length / 2);
  if (s.appearances >= Math.max(6, career.league.length) && avg >= 7.6 && s.goals >= 12 && topHalf) {
    out.push({
      season: career.season,
      kind: "Player of the Season",
      detail: `${s.goals} goals, ${avg.toFixed(2)} average rating`,
    });
  }

  return out;
}

// ── The armband ─────────────────────────────────────────────────────────────

/**
 * Whether the club would make you captain.
 *
 * The dressing room first, because that is who follows you, then the manager,
 * then a real body of appearances at THIS club — an armband handed to a player
 * who signed in the summer is not an honour, it is a plot device.
 */
export function captaincyEarned(career: CareerState): boolean {
  // Appearances at THIS club, tracked separately and reset on a move — career
  // appearances would hand the armband to a signing on his first day.
  const appearancesHere = career.clubAppearances ?? career.careerStats.appearances;
  return career.relationships.team >= 78
    && career.relationships.boss >= 70
    && career.starRating >= 3.2
    && appearancesHere >= 15;
}

/** What wearing it is worth. Small, and to the dressing room — it is not a stat. */
export const CAPTAIN_TEAM_BONUS = 1;

// ── The number on your back ─────────────────────────────────────────────────

const BY_POSITION: Record<string, number[]> = {
  GK: [1, 13, 25],
  CB: [4, 5, 6, 15, 3],
  LB: [3, 33, 12],
  RB: [2, 22, 12],
  CDM: [6, 16, 4],
  CM: [8, 14, 16, 18],
  CAM: [10, 20, 21],
  LW: [11, 7, 17],
  RW: [7, 11, 17],
  ST: [9, 19, 29, 20],
};

/**
 * The number you are given when you sign.
 *
 * By position, and by standing: a player the club has just paid for gets the
 * shirt, and a teenager gets whatever is left. Seeded off the club and the
 * season so it does not change under a re-render, and so re-signing for the
 * same club at the same point gives the same number.
 */
export function assignSquadNumber(career: CareerState, club: string): number {
  const rng = mulberry32(clubNameSeed(club) + career.season * 31 + Math.round(career.starRating * 10));
  const pool = BY_POSITION[career.player.position] ?? [7, 8, 11, 17, 20];
  // A star gets the first choice; anyone else takes what is going.
  const idx = career.starRating >= 4
    ? 0
    : career.starRating >= 3
      ? Math.floor(rng() * Math.min(2, pool.length))
      : Math.floor(rng() * pool.length);
  const first = pool[Math.min(idx, pool.length - 1)];
  // Squad players sometimes end up in the twenties and thirties regardless.
  if (career.starRating < 2.5 && rng() < 0.45) return 20 + Math.floor(rng() * 20);
  return first;
}
