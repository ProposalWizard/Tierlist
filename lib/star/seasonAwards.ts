import type { CareerState } from "./types";
import { formationOf, fitness, type Role, type Slot } from "./formations";
import { divisionOf, leagueNameFor } from "./calendar";
import { mulberry32 } from "./season";

/**
 * THE SEASON'S OWN AWARDS.
 *
 * Requested directly, after a first Ballon d'Or ceremony: "I'd also like
 * some more awards and trophies" — the Golden Boot, the Assist King, a
 * Golden Glove, Player and Young Player of the Season, and a Team of the
 * Season picked the way the Draft game's own one is, a real XI in a real
 * formation rather than a list.
 *
 * ── Why this is computed BEFORE the season rolls over ──
 *
 * `advanceSeason` wipes every season-long tally the moment it runs — your
 * own `seasonStats`/`squad` goal counts, every other club's `leagueGoals`/
 * `leagueAssists` (see `resetLeagueSquads`) — because that is exactly what a
 * new season needs to start from zero. So the individual, stats-driven
 * awards here (goals, assists, clean sheets, the composite score behind
 * Player of the Season) have to be read off the career BEFORE rollover, or
 * there is nothing left to read. `computeSeasonAwardStats` is called once,
 * in `endSeason` (app/star-dev/page.tsx), and its result is stashed on
 * `CareerState.lastSeasonAwardStats` so it survives the ballon-dor/
 * relegation-move/transfer-window screens between there and the moment this
 * actually gets shown.
 *
 * Most TROPHY winners are a different story on purpose: they are not read
 * here at all. `career.lastSeasonWinners` (league/cups/Europe, resolved
 * whether or not you were involved — see crownWithoutYou/finishCupToWinner)
 * and `career.trophies` are only reliably correct for the season that JUST
 * finished once `advanceSeason` has actually run, so the awards SCREEN
 * reads those directly off the current (post-rollover) career rather than
 * this stats snapshot duplicating logic `advanceSeason` already owns.
 *
 * Community Shield and Super Cup are the one exception, and for the
 * opposite timing reason: `seedPreSeason` (competitions.ts) already only
 * ever seeds either fixture when your own club is one of the two, so
 * `career.trophies` only ever has a real result for a season you actually
 * played one. But WHO the two contestants are is never actually a mystery
 * — pointed out directly: the Community Shield is always the league
 * champion against the FA Cup holder (or the runner-up, if the same club
 * did the Double), and the Super Cup is always that season's Champions
 * League winner against that season's Europa League winner — exactly the
 * four facts `career.lastSeasonWinners` already carries. So this DOES
 * resolve a guessed winner for a season you were not in, the same
 * strength-weighted way crownWithoutYou resolves Europe — it just has to
 * happen here, before rollover, because `lastSeasonWinners` is read at
 * exactly this moment for exactly this reason: `endSeason` runs before
 * `advanceSeason` has overwritten it with the season that is only just
 * ending's own results, so it still holds the season-N-1 inputs that
 * season N's OWN Community Shield/Super Cup were actually seeded from.
 */

export interface AwardWinner {
  name: string;
  club: string;
  isYou: boolean;
  /** Goals, assists, clean sheets or the composite score — whatever this
   *  particular award is ranked on. */
  value: number;
}

export interface TeamOfSeasonMan {
  role: Role;
  x: number;
  y: number;
  label?: string;
  name: string;
  club: string;
  overall: number;
  isYou: boolean;
}

export interface SeasonAwardStats {
  season: number;
  /**
   * "Premier League" or "Championship" — whichever division THIS season was
   * actually played in. Captured here rather than read off `career.division`
   * by the screen that shows it, because that field is already the NEW
   * season's division by the time this screen renders (advanceSeason has
   * run) — which is the right value for career.division to hold, and the
   * wrong one for labelling a trophy just won in the OLD division.
   */
  leagueName: string;
  goldenBoot: AwardWinner | null;
  assistKing: AwardWinner | null;
  goldenGlove: AwardWinner | null;
  playerOfSeason: AwardWinner | null;
  youngPlayerOfSeason: AwardWinner | null;
  teamOfSeason: TeamOfSeasonMan[];
  /**
   * A guessed winner for a Community Shield/Super Cup your own club was not
   * actually in — null when there is nothing to guess FROM (season 1, or a
   * season whose predecessor is missing a needed result) rather than a
   * fabricated one. `trophyWinners` prefers a real result out of
   * `career.trophies` over this whenever one exists.
   */
  communityShieldGuess: string | null;
  superCupGuess: string | null;
}

const VALID_ROLES = new Set<Role>(["GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LW", "RW", "ST"]);
function asRole(position: string, fallback: Role = "ST"): Role {
  return VALID_ROLES.has(position as Role) ? (position as Role) : fallback;
}

interface Candidate {
  name: string;
  club: string;
  overall: number;
  leagueGoals: number;
  leagueAssists: number;
  age: number | null;
  isYou: boolean;
  position: Role;
}

/**
 * A rough 0-100 overall for the one player in this career who does not
 * carry a real one — your own character only has `starRating` (0-5). Not
 * read anywhere else; it exists purely so a season you dominated can put
 * you in Team of the Season alongside players who DO have a real number.
 */
function starRatingToOverall(starRating: number): number {
  return Math.round(45 + starRating * 11);
}

function candidatePool(career: CareerState): Candidate[] {
  const out: Candidate[] = [];

  out.push({
    name: `${career.player.firstName} ${career.player.lastName}`,
    club: career.player.club,
    overall: starRatingToOverall(career.starRating),
    leagueGoals: career.leagueSeasonStats?.goals ?? 0,
    leagueAssists: career.leagueSeasonStats?.assists ?? 0,
    age: career.player.age,
    isYou: true,
    position: asRole(career.player.position),
  });

  for (const p of career.squad ?? []) {
    out.push({
      name: p.name,
      club: career.player.club,
      overall: p.overall ?? 65,
      leagueGoals: p.leagueGoals ?? p.seasonGoals,
      leagueAssists: p.leagueAssists ?? p.seasonAssists,
      age: p.age ?? null,
      isYou: false,
      position: p.position,
    });
  }

  for (const sq of career.leagueSquads ?? []) {
    for (const p of sq.players) {
      out.push({
        name: p.name,
        club: sq.club,
        overall: p.overall,
        leagueGoals: p.goals,
        leagueAssists: p.assists,
        age: p.age ?? null,
        isYou: false,
        position: p.position,
      });
    }
  }

  return out;
}

function toWinner(c: Candidate, value: number): AwardWinner {
  return { name: c.name, club: c.club, isYou: c.isYou, value };
}

/** Clean sheets, tallied straight off this season's results log — the only
 *  place a "did this club concede" fact actually lives, since nothing
 *  tracks it per goalkeeper as the season goes. */
function cleanSheetsByClub(career: CareerState): Map<string, number> {
  const sheets = new Map<string, number>();
  const bump = (club: string) => sheets.set(club, (sheets.get(club) ?? 0) + 1);
  for (const r of career.results ?? []) {
    if (r.as === 0) bump(r.home);
    if (r.hs === 0) bump(r.away);
  }
  return sheets;
}

function findGoalkeeper(career: CareerState, club: string): Candidate | null {
  if (club === career.player.club) {
    const gk = (career.squad ?? []).find(p => p.position === "GK");
    return gk ? { name: gk.name, club, overall: gk.overall ?? 65, leagueGoals: 0, leagueAssists: 0, age: gk.age ?? null, isYou: false, position: "GK" } : null;
  }
  const sq = (career.leagueSquads ?? []).find(s => s.club === club);
  const gk = sq?.players.find(p => p.position === "GK");
  return gk ? { name: gk.name, club, overall: gk.overall, leagueGoals: 0, leagueAssists: 0, age: gk.age ?? null, isYou: false, position: "GK" } : null;
}

const TEAM_OF_SEASON_FORMATION = "433";

/** Best available player for each slot, in turn — a real player never
 *  fills two slots, and a slot takes the highest overall who can actually
 *  play there (`fitness`, the same closeness score the team sheet itself
 *  uses) rather than the highest overall full stop. */
function pickTeamOfSeason(pool: Candidate[]): TeamOfSeasonMan[] {
  const formation = formationOf(TEAM_OF_SEASON_FORMATION);
  const used = new Set<Candidate>();
  const team: TeamOfSeasonMan[] = [];
  for (const slot of formation.slots as Slot[]) {
    let best: Candidate | null = null;
    let bestScore = -1;
    for (const c of pool) {
      if (used.has(c)) continue;
      const fit = fitness(slot.role, c.position);
      if (fit <= 0) continue;
      const score = c.overall * (fit / 100);
      if (score > bestScore) { bestScore = score; best = c; }
    }
    if (best) {
      used.add(best);
      team.push({ role: slot.role, x: slot.x, y: slot.y, label: slot.label, name: best.name, club: best.club, overall: best.overall, isYou: best.isYou });
    }
  }
  return team;
}

const YOUNG_AGE_CUTOFF = 21;

export interface TrophyWinner {
  competition: string;
  /** Null when this game genuinely has nothing to go on — season 1, or a
   *  season whose predecessor is itself missing a needed result. */
  club: string | null;
  isYou: boolean;
  /** True for a Community Shield/Super Cup winner this game GUESSED at
   *  (see communityShieldGuess/superCupGuess) rather than actually settled
   *  by a match your own club played. Always false for the other five —
   *  those are always either a real match result or a real league table. */
  isGuess: boolean;
}

/**
 * Every trophy this season handed out, whether or not it was you.
 *
 * Deliberately reads the CURRENT career (after `advanceSeason` has run)
 * rather than the `SeasonAwardStats` snapshot: `career.lastSeasonWinners`
 * only resolves to the season that just finished once rollover has actually
 * computed it (see crownWithoutYou/finishCupToWinner in advanceSeason), so
 * reading it any earlier would still show the PREVIOUS season's champions.
 * `career.trophies`, filtered to `stats.season`, is what confirms a win was
 * actually yours rather than someone else's — and, for the Community
 * Shield/Super Cup specifically, is a REAL match result that always wins
 * out over `stats`'s own guessed one whenever your own club was there to
 * produce it.
 */
export function trophyWinners(career: CareerState, stats: SeasonAwardStats): TrophyWinner[] {
  const mine = (career.trophies ?? []).filter(t => t.season === stats.season);
  const winnerOf = (competition: string, fallback?: string | null): TrophyWinner => {
    const won = mine.find(t => t.competition === competition);
    if (won) return { competition, club: won.club, isYou: won.club === career.player.club, isGuess: false };
    return { competition, club: fallback ?? null, isYou: false, isGuess: false };
  };
  const guessedWinnerOf = (competition: string, guess: string | null): TrophyWinner => {
    const won = mine.find(t => t.competition === competition);
    if (won) return { competition, club: won.club, isYou: won.club === career.player.club, isGuess: false };
    return { competition, club: guess, isYou: false, isGuess: guess !== null };
  };

  const w = career.lastSeasonWinners;
  return [
    winnerOf(stats.leagueName, w?.league),
    winnerOf("FA Cup", w?.faCup),
    winnerOf("League Cup", w?.leagueCup),
    winnerOf("Champions League", w?.championsLeague),
    winnerOf("Europa League", w?.europaLeague),
    guessedWinnerOf("Community Shield", stats.communityShieldGuess),
    guessedWinnerOf("Super Cup", stats.superCupGuess),
  ];
}

/**
 * Who WOULD have played a Community Shield/Super Cup this season, and a
 * strength-weighted guess at who won it — for a season your own club was
 * not one of the two, so there is no real match to read a result off. Same
 * weighting shape crownWithoutYou already uses for a European trophy you
 * were not there for: not a coin flip, but not a lock for the stronger side
 * either.
 */
function weightedWinner(a: string, aStrength: number, b: string, bStrength: number, seed: number): string {
  const rng = mulberry32(seed);
  const wa = Math.pow(Math.max(1, aStrength - 60), 2.2);
  const wb = Math.pow(Math.max(1, bStrength - 60), 2.2);
  return rng() * (wa + wb) < wa ? a : b;
}

/** A club's strength, wherever it plays — this season's own division table
 *  first (the common case), the STATIC club lists as a rough estimate
 *  otherwise, the same fallback cupStrength already uses for a club a
 *  season's own `league` does not currently cover. */
function strengthEstimate(career: CareerState, club: string): number {
  const inLeague = career.league.find(t => t.name === club);
  if (inLeague) return inLeague.strength;
  return 76; // a league champion or a European winner is a strong side regardless
}

function resolveCommunityShieldGuess(career: CareerState, seed: number): string | null {
  const w = career.lastSeasonWinners;
  if (!w?.league || !w?.faCup) return null;
  const champion = w.league === w.faCup ? (w.leagueRunnerUp ?? null) : w.league;
  const cupHolder = w.faCup;
  if (!champion || champion === cupHolder) return null;
  return weightedWinner(
    champion, strengthEstimate(career, champion),
    cupHolder, strengthEstimate(career, cupHolder),
    seed,
  );
}

function resolveSuperCupGuess(career: CareerState, seed: number): string | null {
  const w = career.lastSeasonWinners;
  if (!w?.championsLeague || !w?.europaLeague || w.championsLeague === w.europaLeague) return null;
  return weightedWinner(
    w.championsLeague, strengthEstimate(career, w.championsLeague),
    w.europaLeague, strengthEstimate(career, w.europaLeague),
    seed,
  );
}

export function computeSeasonAwardStats(career: CareerState): SeasonAwardStats {
  const pool = candidatePool(career);

  const byGoals = [...pool].sort((a, b) => b.leagueGoals - a.leagueGoals);
  const goldenBoot = byGoals[0] && byGoals[0].leagueGoals > 0 ? toWinner(byGoals[0], byGoals[0].leagueGoals) : null;

  const byAssists = [...pool].sort((a, b) => b.leagueAssists - a.leagueAssists);
  const assistKing = byAssists[0] && byAssists[0].leagueAssists > 0 ? toWinner(byAssists[0], byAssists[0].leagueAssists) : null;

  const sheets = cleanSheetsByClub(career);
  let goldenGlove: AwardWinner | null = null;
  let bestSheets = 0;
  for (const [club, count] of Array.from(sheets.entries())) {
    if (count <= bestSheets) continue;
    const gk = findGoalkeeper(career, club);
    if (!gk) continue;
    bestSheets = count;
    goldenGlove = toWinner(gk, count);
  }

  // Weighted toward end product on purpose — a real Player of the Season
  // ballot leans the same way, and unlike a match rating this is the one
  // number every candidate genuinely has (a squad rating plus a real
  // season's goals and assists), rather than something only your own
  // matches ever produced.
  const score = (c: Candidate) => c.overall + c.leagueGoals * 1.5 + c.leagueAssists;
  const byScore = [...pool].sort((a, b) => score(b) - score(a));
  const playerOfSeason = byScore[0] ? toWinner(byScore[0], Math.round(score(byScore[0]))) : null;

  const youngPool = byScore.filter(c => c.age !== null && c.age <= YOUNG_AGE_CUTOFF);
  const youngPlayerOfSeason = youngPool[0] ? toWinner(youngPool[0], Math.round(score(youngPool[0]))) : null;

  return {
    season: career.season,
    leagueName: leagueNameFor(divisionOf(career)),
    goldenBoot,
    assistKing,
    goldenGlove,
    playerOfSeason,
    youngPlayerOfSeason,
    teamOfSeason: pickTeamOfSeason(pool),
    communityShieldGuess: resolveCommunityShieldGuess(career, career.season * 4441 + 1),
    superCupGuess: resolveSuperCupGuess(career, career.season * 4441 + 2),
  };
}
