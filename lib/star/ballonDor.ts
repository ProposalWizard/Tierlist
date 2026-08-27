import type { CareerState, SquadPlayer } from "./types";
import { resolveSeasonWinners } from "./careerFlow";
import { divisionOf, leagueNameFor } from "./calendar";
import { leagueMultiplierFor } from "./clubLeagues";
import { mulberry32 } from "./season";

/**
 * THE BALLON D'OR SHORTLIST.
 *
 * Requested directly, after the first ceremony: trophies should count, the
 * other candidates should be judged off real numbers wherever this game
 * actually has them, and a season in a weaker league should not weigh the
 * same as one in the Premier League, LaLiga, the Bundesliga, Ligue 1 or
 * Serie A. And the reveal itself should build the way the real ceremony
 * does — a nomination first, then a countdown, then the top two held back
 * for a real reveal — the same shape as this game's OWN separate Ballon
 * d'Or game mode (components/ballon-dor/BDCeremony.tsx) already uses,
 * scaled from a top 25 down to a top 10.
 *
 * ── Where each candidate's numbers actually come from ──
 *
 * You: real. Goals, assists, average match rating and Star Man count are
 * all read straight off `career.seasonStats` — the actual season you just
 * played.
 *
 * A rival from your OWN division (`career.leagueSquads`): also real. This
 * career already simulates every match in the division and credits real
 * goals/assists to real named players (see `playLeagueWeek` in season.ts) —
 * the same numbers the Golden Boot and Assist King already use (see
 * seasonAwards.ts). There is no real match-by-match RATING for anyone but
 * you, though, so a rival's "average rating" here is a proxy built off his
 * squad `overall` — honest about being an estimate, not a measured number.
 *
 * A rival from outside your division (`career.externalSquads` — the
 * Champions League/Europa League/Other clubs the international transfer
 * window already reads from): nobody simulates a season for these clubs at
 * all, so there is nothing real to read. Each club's own best-rated player
 * gets a SIMULATED season instead — deterministic, seeded off his own id,
 * not `Math.random()`, so the same save reveals the same shortlist twice —
 * shaped by his real overall and his position (a striker's simulated
 * season leans on goals, a centre-back's barely has any). Doesn't have to
 * be accurate; it has to be a real name in a real shirt with a plausible
 * season behind him, the same spirit the original "top player + a number"
 * version already had.
 *
 * Trophies count for everyone the same way, using `resolveSeasonWinners` —
 * the same club/country-wide resolution `advanceSeason` itself uses at
 * rollover, called here instead at Ballon d'Or time (`endSeason` in
 * app/star-dev/page.tsx), BEFORE rollover has touched any of it.
 */

// ── Trophies ─────────────────────────────────────────────────────────────

export type TrophyTier = "major" | "medium" | "minor" | "small";

/**
 * Major: the Champions League, your own league's title (Premier League or
 * Championship — whichever you actually play; the league multiplier below
 * is what makes a Championship title worth less overall, not a smaller
 * point value here), and any international tournament (World Cup, European
 * Championship — the only trophy on this list that belongs to a NATION
 * rather than a club, see playerTrophyPoints).
 * Medium: the Europa League, the FA Cup.
 * Minor: the League Cup.
 * Small: the Super Cup, the Community Shield — real, but genuinely
 * insignificant next to the rest.
 */
const TROPHY_POINTS: Record<string, number> = {
  "Champions League": 50, "Premier League": 50, "Championship": 50,
  "World Cup": 50, "European Championship": 50,
  "Europa League": 30, "FA Cup": 30,
  "League Cup": 15,
  "Super Cup": 5, "Community Shield": 5,
};

export function trophyTierOf(competition: string): TrophyTier | null {
  const pts = TROPHY_POINTS[competition];
  if (pts === undefined) return null;
  if (pts >= 50) return "major";
  if (pts >= 30) return "medium";
  if (pts >= 15) return "minor";
  return "small";
}

interface WorldTrophy { club: string; competition: string }

/** Every club trophy this season actually produced, whoever won it. Not
 *  the international one — that belongs to a nation, not a club, and is
 *  added separately, only ever to the player, in candidatePool below. */
function worldClubTrophies(career: CareerState): WorldTrophy[] {
  const winners = resolveSeasonWinners(career);
  const leagueName = leagueNameFor(divisionOf(career));
  const out: WorldTrophy[] = [];
  if (winners.league) out.push({ club: winners.league, competition: leagueName });
  if (winners.faCup) out.push({ club: winners.faCup, competition: "FA Cup" });
  if (winners.leagueCup) out.push({ club: winners.leagueCup, competition: "League Cup" });
  if (winners.championsLeague) out.push({ club: winners.championsLeague, competition: "Champions League" });
  if (winners.europaLeague) out.push({ club: winners.europaLeague, competition: "Europa League" });
  // Community Shield/Super Cup only ever resolve when your own club played
  // them this season — see seasonAwards.ts's trophyWinners for the same
  // honest limit applied there.
  for (const t of career.trophies ?? []) {
    if (t.season !== career.season) continue;
    if (t.competition === "Community Shield" || t.competition === "Super Cup") out.push(t);
  }
  return out;
}

function trophyPointsFor(club: string, world: WorldTrophy[]): { points: number; names: string[] } {
  const won = world.filter(t => t.club === club);
  return { points: won.reduce((sum, t) => sum + (TROPHY_POINTS[t.competition] ?? 0), 0), names: won.map(t => t.competition) };
}

// ── Candidates ───────────────────────────────────────────────────────────

export interface BallonDorEntry {
  rank: number;
  isPlayer: boolean;
  name: string;
  club: string;
  goals: number;
  assists: number;
  rating: number;
  /** True average rating for you; an overall-based estimate for everyone
   *  else — see the file header. The UI can use this to say so. */
  ratingIsReal: boolean;
  trophies: string[];
  score: number;
}

interface Candidate {
  name: string; club: string; overall: number;
  goals: number; assists: number;
  rating: number; ratingIsReal: boolean;
  starMan: number;
  isPlayer: boolean;
}

function ratingProxy(overall: number): number {
  // ~50 overall reads as a 5.0, ~95 as an 8.6 — the same rough shape a
  // real match rating takes without ever pretending to be one.
  return 5 + Math.max(0, overall - 50) / 50 * 4;
}

const ATTACK_WEIGHT: Record<SquadPlayer["position"], number> = {
  ST: 1, LW: 0.85, RW: 0.85, CAM: 0.8,
  CM: 0.45, CDM: 0.3,
  LB: 0.2, RB: 0.2, CB: 0.12,
  GK: 0.02,
};

/** A plausible, DETERMINISTIC season for a player this career never
 *  actually simulates a match for — see the file header. Seeded off his
 *  own id and the season number, never Math.random(): the same save
 *  reveals the same shortlist every time the ceremony is shown. */
function simulatedSeasonFor(p: { id: string; overall: number; position: SquadPlayer["position"] }, season: number): { goals: number; assists: number } {
  const rng = mulberry32(clubNameHash(p.id) + season * 7919);
  const quality = clamp((p.overall - 58) / 37, 0, 1);
  const weight = ATTACK_WEIGHT[p.position] ?? 0.3;
  const goals = Math.round(quality * weight * (16 + rng() * 16));
  const assists = Math.round(quality * (weight * 0.7 + 0.15) * (8 + rng() * 12));
  return { goals, assists };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function clubNameHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function you(career: CareerState): Candidate {
  const stats = career.seasonStats;
  const avgRating = stats.ratingCount > 0 ? stats.totalRating / stats.ratingCount : 0;
  return {
    name: `${career.player.firstName} ${career.player.lastName}`,
    club: career.player.club,
    overall: 0, // unused — you always get your real rating, never the proxy
    goals: stats.goals, assists: stats.assists,
    rating: avgRating, ratingIsReal: stats.ratingCount > 0,
    starMan: stats.starMan,
    isPlayer: true,
  };
}

function domesticRivals(career: CareerState): Candidate[] {
  const out: Candidate[] = [];
  for (const sq of career.leagueSquads ?? []) {
    if (sq.club === career.player.club) continue; // that is you, above
    for (const p of sq.players) {
      out.push({
        name: p.name, club: sq.club, overall: p.overall,
        goals: p.goals, assists: p.assists,
        rating: ratingProxy(p.overall), ratingIsReal: false,
        starMan: 0, isPlayer: false,
      });
    }
  }
  return out;
}

/** The other nineteen's OWN best XI is real too — a teammate on your bench
 *  is not a Ballon d'Or contender, but the real names on the other clubs'
 *  team sheets are exactly the rivals the shortlist should be full of. */
function internationalRivals(career: CareerState, season: number): Candidate[] {
  const out: Candidate[] = [];
  for (const sq of career.externalSquads ?? []) {
    const best = [...sq.players].sort((a, b) => b.overall - a.overall)[0];
    if (!best) continue;
    const sim = simulatedSeasonFor({ id: `${sq.club}:${best.id}`, overall: best.overall, position: best.position }, season);
    out.push({
      name: best.name, club: sq.club, overall: best.overall,
      goals: sim.goals, assists: sim.assists,
      rating: ratingProxy(best.overall), ratingIsReal: false,
      starMan: 0, isPlayer: false,
    });
  }
  return out;
}

// ── Scoring ──────────────────────────────────────────────────────────────

/**
 * goals × 4  +  assists × 2  +  average rating × 10  +  Star Man × 3
 * + trophy points, all multiplied by the club's league strength.
 *
 * The international trophy — a World Cup or a European Championship — is
 * the one exception folded in separately here rather than in
 * worldClubTrophies: it belongs to the PLAYER, not to a club, so a
 * team-mate on your domestic bench does not get credit for a tournament he
 * was never part of, and neither does anyone else on this shortlist.
 */
function scoreOf(c: Candidate, world: WorldTrophy[], internationalPoints: number): { score: number; trophyNames: string[] } {
  const club = trophyPointsFor(c.club, world);
  const trophyPoints = club.points + (c.isPlayer ? internationalPoints : 0);
  const base = c.goals * 4 + c.assists * 2 + c.rating * 10 + c.starMan * 3 + trophyPoints;
  return { score: base * leagueMultiplierFor(c.club), trophyNames: club.names };
}

export interface BallonDorResult {
  entries: BallonDorEntry[];
  playerRank: number; // 0 when not nominated
  playerNominated: boolean;
}

const SHORTLIST_SIZE = 10;

export function computeBallonDorShortlist(career: CareerState): BallonDorResult {
  const world = worldClubTrophies(career);
  const yourInternationalTrophies = (career.trophies ?? [])
    .filter(t => t.season === career.season && (t.competition === "World Cup" || t.competition === "European Championship"));
  const internationalTrophyPoints = yourInternationalTrophies
    .reduce((sum, t) => sum + (TROPHY_POINTS[t.competition] ?? 0), 0);

  const pool: Candidate[] = [
    you(career),
    ...domesticRivals(career),
    ...internationalRivals(career, career.season),
  ];

  const scored = pool.map(c => {
    const { score, trophyNames } = scoreOf(c, world, internationalTrophyPoints);
    return { c, score, trophyNames };
  });
  scored.sort((a, b) => b.score - a.score);

  const top = scored.slice(0, SHORTLIST_SIZE);
  const entries: BallonDorEntry[] = top.map((t, i) => ({
    rank: i + 1,
    isPlayer: t.c.isPlayer,
    name: t.c.name,
    club: t.c.club,
    goals: t.c.goals,
    assists: t.c.assists,
    rating: t.c.rating,
    ratingIsReal: t.c.ratingIsReal,
    trophies: t.c.isPlayer
      ? [...t.trophyNames, ...yourInternationalTrophies.map(tr => tr.competition)]
      : t.trophyNames,
    score: Math.round(t.score),
  }));

  const playerIdx = entries.findIndex(e => e.isPlayer);
  return {
    entries,
    playerRank: playerIdx + 1,
    playerNominated: playerIdx >= 0,
  };
}
