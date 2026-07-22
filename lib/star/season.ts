import type { LeagueTeam, Fixture } from "./types";

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

// Round-robin fixture generator (circle method) — 38 fixtures per team over 2 halves
export function buildFixtures(clubs: string[], userClub: string): Fixture[] {
  const n = clubs.length;
  const teams = [...clubs];
  if (n % 2 === 1) teams.push("__BYE__");
  const rounds = teams.length - 1;
  const half = teams.length / 2;

  const firstHalf: Fixture[] = [];
  for (let round = 0; round < rounds; round++) {
    for (let i = 0; i < half; i++) {
      const home = teams[i];
      const away = teams[teams.length - 1 - i];
      if (home === "__BYE__" || away === "__BYE__") continue;
      if (home === userClub) {
        firstHalf.push({ week: round + 1, opponent: away, home: true, played: false });
      } else if (away === userClub) {
        firstHalf.push({ week: round + 1, opponent: home, home: false, played: false });
      }
    }
    const last = teams.pop()!;
    teams.splice(1, 0, last);
  }

  const secondHalf: Fixture[] = firstHalf.map((f) => ({
    week: f.week + rounds,
    opponent: f.opponent,
    home: !f.home,
    played: false,
  }));

  return [...firstHalf, ...secondHalf];
}

export function simulateOtherFixtures(
  league: LeagueTeam[],
  userClub: string,
  week: number,
  rng: () => number,
): LeagueTeam[] {
  const strengthMap = new Map(league.map((t) => [t.name, t.strength]));
  const teams = league.map((t) => t.name).filter((n) => n !== userClub);
  const shuffled = [...teams].sort(() => rng() - 0.5);
  const updated = league.map((t) => ({ ...t }));

  for (let i = 0; i < shuffled.length - 1; i += 2) {
    const home = shuffled[i];
    const away = shuffled[i + 1];
    const homeStr = (strengthMap.get(home) ?? 65) + 3;
    const awayStr = strengthMap.get(away) ?? 65;
    const lambdaHome = Math.max(0.3, (homeStr / awayStr) * 1.4);
    const lambdaAway = Math.max(0.2, (awayStr / homeStr) * 1.1);
    const hg = poisson(lambdaHome, rng);
    const ag = poisson(lambdaAway, rng);

    const H = updated.find((t) => t.name === home)!;
    const A = updated.find((t) => t.name === away)!;
    H.played++; A.played++;
    H.goalsFor += hg; H.goalsAgainst += ag;
    A.goalsFor += ag; A.goalsAgainst += hg;
    if (hg > ag) { H.won++; A.lost++; H.points += 3; }
    else if (hg < ag) { A.won++; H.lost++; A.points += 3; }
    else { H.drawn++; A.drawn++; H.points += 1; A.points += 1; }
  }
  return updated;
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
