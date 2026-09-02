import type { LeagueTeam, Fixture, LeagueFixture, LeagueResult, LeagueSquad } from "./types";
import { nameGoals, creditNamedGoals, type NamedOppGoal } from "./leagueSquads";
import { primaryRivalOf } from "./rivalries";

// Deterministic PRNG so a career's season sim is reproducible
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildLeague(clubNames: string[], userClub: string): LeagueTeam[] {
  const rng = mulberry32(clubNames.join("").length + userClub.length);
  return clubNames.map((name) => ({
    name,
    strength: 55 + Math.floor(rng() * 35),
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
  }));
}

/**
 * THE FIXTURE LIST.
 *
 * One schedule, and the whole division is in it. Every club plays every other
 * club twice — once at home, once away — over 2(n−1) weeks, which for a
 * twenty-team league is the thirty-eight everybody expects.
 *
 * It replaced a season that only ever existed for you. Your own fixtures were a
 * proper round-robin; the other nine games each week were the remaining
 * eighteen clubs shuffled and paired off at random, freshly, every week. The
 * table stayed level — everyone played once a week and finished on 38 — but
 * behind it there was no schedule at all. Two clubs could meet three times and
 * another pair never; there was no answer to "who is my rival playing this
 * week", and no results to show but your own.
 *
 * Built by the circle method: fix the first club, rotate the rest. The
 * second half is the first half with every venue reversed — which is what
 * makes "once each way" true by construction rather than by luck.
 *
 * Venue WITHIN the first half is decided by a running home-games count per
 * club, not a fixed `(round + pairing) % 2` — that formula only alternates
 * cleanly for the one club that never moves in the rotation (paired at
 * `i === 0` every single round, so its own parity is just `round % 2`).
 * Every other club drifts through the rotation's other slots at a rate that
 * keeps `(round + i)` the same parity for many consecutive rounds, so it
 * used to get a real season of "home for the first half, away for the
 * second" instead of a realistic mix — reported directly, and confirmed by
 * tracing a full 20-club season by hand. Whichever of the two clubs has had
 * fewer home fixtures so far gets this one; a genuine tie (both still equal)
 * falls back to the same parity rule so the choice stays deterministic
 * rather than depending on iteration order.
 */
export function buildSeasonFixtures(clubs: string[]): LeagueFixture[] {
  const teams = [...clubs];
  if (teams.length % 2 === 1) teams.push(BYE);
  const rounds = teams.length - 1;
  const half = teams.length / 2;

  const homeCount = new Map<string, number>(teams.map(t => [t, 0]));
  const first: LeagueFixture[] = [];
  for (let round = 0; round < rounds; round++) {
    for (let i = 0; i < half; i++) {
      const a = teams[i];
      const b = teams[teams.length - 1 - i];
      if (a === BYE || b === BYE) continue;
      const ha = homeCount.get(a)!, hb = homeCount.get(b)!;
      const aHome = ha < hb || (ha === hb && (round + i) % 2 === 0);
      const home = aHome ? a : b, away = aHome ? b : a;
      homeCount.set(home, homeCount.get(home)! + 1);
      first.push({ week: round + 1, home, away });
    }
    const last = teams.pop()!;
    teams.splice(1, 0, last);
  }

  // The return fixtures: same pairings, opposite venues.
  const second = first.map(f => ({ week: f.week + rounds, home: f.away, away: f.home }));
  return [...first, ...second];
}

const BYE = "__BYE__";

/** Your own thirty-eight, read out of the division's schedule so they agree. */
export function buildFixtures(clubs: string[], userClub: string): Fixture[] {
  const rival = primaryRivalOf(userClub);
  return buildSeasonFixtures(clubs)
    .filter(f => f.home === userClub || f.away === userClub)
    .map(f => {
      const home = f.home === userClub;
      const opponent = home ? f.away : f.home;
      return {
        week: f.week, opponent, home, played: false,
        ...(rival && opponent === rival ? { derby: true } : {}),
      } as Fixture;
    })
    .sort((a, b) => a.week - b.week);
}

/**
 * Play everybody else's games for one week, off the schedule.
 *
 * The user's own result is NOT applied to the table here — `creditMatchResult`
 * has already done that — but it IS returned with the rest, because a results
 * page showing nine of the ten games would be a strange results page.
 *
 * ── Why it repairs rather than trusts ──
 *
 * A career saved before this existed has its own fixture list, built by the old
 * generator, and it does not agree with the schedule this derives. So the user's
 * actual fixture is taken as the truth and the scheduled games are fitted around
 * it: any whose clubs are both still free is played as written, and whoever is
 * left over at the end is paired off in order. A new career never reaches that
 * last step; an old one gets a week that is slightly invented rather than a week
 * where Everton play twice.
 */
export function playLeagueWeek(
  league: LeagueTeam[],
  week: number,
  user: {
    club: string; opponent: string; home: boolean; scored: number; conceded: number;
    goals?: LeagueResult["hg"];
    /**
     * The opponent's goals, already named live — see CanvasMatch.tsx's
     * opponent-goal branch and NamedOppGoal's own note. When given (and
     * covers every conceded goal — a partial list, from a career saved
     * before this existed, is treated the same as none), these are
     * credited directly instead of `nameGoals` rolling a fresh, different
     * scorer for a goal the player already watched named.
     */
    oppGoals?: NamedOppGoal[];
  },
  rng: () => number,
  squads?: LeagueSquad[],
): { league: LeagueTeam[]; results: LeagueResult[] } {
  const clubs = league.map(t => t.name);
  const strength = new Map(league.map(t => [t.name, t.strength]));
  const squadOf = new Map((squads ?? []).map(s => [s.club, s]));
  const updated = league.map(t => ({ ...t }));

  // The goals scored against you belong to somebody too. We hold a squad for
  // every club in the division, including the one you just played, so the
  // opponent's goal is named off their own roster the exact same way a goal
  // in a match nobody played is — weighted by position and rating, tallied
  // onto that player's season the same as it would be if you weren't there.
  // Reported directly: a live match tracked your own goals and every other
  // fixture's, but a goal scored against your own team vanished into a bare
  // scoreline with nobody credited. Now split in two: a goal the player
  // actually watched named live is CREDITED, not re-rolled (see oppGoals'
  // own note above); anything short of the full count still falls back to
  // the original random naming, same as it always has.
  const theirGoals = user.oppGoals && user.oppGoals.length === user.conceded
    ? creditNamedGoals(squadOf.get(user.opponent), user.oppGoals)
    : nameGoals(squadOf.get(user.opponent), user.conceded, rng);

  const results: LeagueResult[] = [{
    week,
    home: user.home ? user.club : user.opponent,
    away: user.home ? user.opponent : user.club,
    hs: user.home ? user.scored : user.conceded,
    as: user.home ? user.conceded : user.scored,
    // Your own scorers are the real ones off the match; theirs are named above.
    ...(user.goals?.length ? (user.home ? { hg: user.goals } : { ag: user.goals }) : {}),
    ...(theirGoals.length ? (user.home ? { ag: theirGoals } : { hg: theirGoals }) : {}),
  }];

  const used = new Set([user.club, user.opponent]);
  const play = (home: string, away: string) => {
    const hs = strength.get(home) ?? 65;
    const as = strength.get(away) ?? 65;
    const sc = simulateFixtureScore(hs, as, rng);
    // Every goal in the division belongs to somebody. This is what turns the
    // Golden Boot from a formula run over team strength into a count.
    const hg = nameGoals(squadOf.get(home), sc.home, rng);
    const ag = nameGoals(squadOf.get(away), sc.away, rng);
    results.push({
      week, home, away, hs: sc.home, as: sc.away,
      ...(hg.length ? { hg } : {}), ...(ag.length ? { ag } : {}),
    });
    const H = updated.find(t => t.name === home);
    const A = updated.find(t => t.name === away);
    if (!H || !A) return;
    H.played++; A.played++;
    H.goalsFor += sc.home; H.goalsAgainst += sc.away;
    A.goalsFor += sc.away; A.goalsAgainst += sc.home;
    if (sc.home > sc.away) { H.won++; A.lost++; H.points += 3; }
    else if (sc.home < sc.away) { A.won++; H.lost++; A.points += 3; }
    else { H.drawn++; A.drawn++; H.points += 1; A.points += 1; }
    used.add(home); used.add(away);
  };

  for (const f of buildSeasonFixtures(clubs)) {
    if (f.week !== week) continue;
    if (used.has(f.home) || used.has(f.away)) continue;
    play(f.home, f.away);
  }

  // Anyone the schedule could not place — only reachable on a career whose own
  // fixtures predate this schedule.
  const spare = clubs.filter(c => !used.has(c));
  for (let i = 0; i + 1 < spare.length; i += 2) play(spare[i], spare[i + 1]);

  return { league: updated, results };
}

export function simulateFixtureScore(
  homeStrength: number,
  awayStrength: number,
  rng: () => number,
): { home: number; away: number } {
  const h = homeStrength + 3;   // the same home advantage the rest of the league gets
  const a = awayStrength;
  return {
    home: poisson(Math.max(0.3, (h / a) * 1.4), rng),
    away: poisson(Math.max(0.2, (a / h) * 1.1), rng),
  };
}

function poisson(lambda: number, rng: () => number): number {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= rng(); } while (p > L);
  return k - 1;
}

export function updateLeagueWithUserResult(
  league: LeagueTeam[],
  userClub: string,
  opponent: string,
  userScore: number,
  oppScore: number,
): LeagueTeam[] {
  return league.map((t) => {
    if (t.name === userClub) {
      const updated = { ...t, played: t.played + 1, goalsFor: t.goalsFor + userScore, goalsAgainst: t.goalsAgainst + oppScore };
      if (userScore > oppScore) { updated.won++; updated.points += 3; }
      else if (userScore < oppScore) updated.lost++;
      else { updated.drawn++; updated.points += 1; }
      return updated;
    }
    if (t.name === opponent) {
      const updated = { ...t, played: t.played + 1, goalsFor: t.goalsFor + oppScore, goalsAgainst: t.goalsAgainst + userScore };
      if (oppScore > userScore) { updated.won++; updated.points += 3; }
      else if (oppScore < userScore) updated.lost++;
      else { updated.drawn++; updated.points += 1; }
      return updated;
    }
    return t;
  });
}

export function sortLeague(league: LeagueTeam[]): LeagueTeam[] {
  return [...league].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.goalsFor - a.goalsAgainst;
    const gdB = b.goalsFor - b.goalsAgainst;
    if (gdB !== gdA) return gdB - gdA;
    return b.goalsFor - a.goalsFor;
  });
}
