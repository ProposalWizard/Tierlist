import type { CareerState, LeagueSquad, LeagueResult } from "./types";
import { mulberry32 } from "./season";
import { nameGoals, creditNamedGoals, type NamedOppGoal } from "./leagueSquads";
import {
  EURO_LEAGUE_PHASE_WEEKS, EURO_KO_SLOTS_WITH_R32, EURO_KO_SLOTS_SEEDED, type CupSlot,
} from "./calendar";

/**
 * EUROPE.
 *
 * What was here before was a counter: four rounds, one invented opponent per
 * round, win and the number goes up. It never had a table, never had a second
 * leg, and the same eight clubs turned up in every career because the opponent
 * was drawn from a list of sixteen with no memory.
 *
 * This is the competition as it is actually played, and as the PL Draft has
 * modelled it all along:
 *
 *   · Thirty-six clubs in one league phase. You play eight of them, two from
 *     each of four seeding pots, one home and one away.
 *   · A single table. Finish in the top eight and you are seeded straight into
 *     the last sixteen; ninth to twenty-fourth and you play an extra two-legged
 *     round first; twenty-fifth or lower and you are out with nothing.
 *   · Every knockout tie over two legs, decided on aggregate, except the final.
 *
 * The thirty-five clubs you are not are simulated rather than played, on the
 * same expected-goals model the rest of the division uses, so the table you
 * finish ninth in is a table somebody actually finished eighth in — but,
 * requested directly after a real report of a table that filled itself in
 * seven matchdays ahead of where the season actually was: ONE MATCHDAY AT A
 * TIME, exactly the way the domestic league plays everyone else's games the
 * week yours happens (season.ts's playLeagueWeek) — never a whole
 * projected phase built in one shot, yours or anyone else's. See
 * `simulateEuroMatchday`.
 */

export type EuroId = "Champions League" | "Europa League" | "Conference League";

export interface EuroClub {
  name: string;
  strength: number;
  /** 1 is the strongest seeding pot. */
  pot: number;
}

export interface EuroMatch {
  opponent: string;
  home: boolean;
  /** Absent until played. */
  us?: number;
  them?: number;
}

export interface EuroStanding {
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  isYou: boolean;
}

export interface EuroTie {
  round: string;
  opponent: string;
  opponentStrength: number;
  /** Two legs, except the final, which has one. */
  legs: { home: boolean; us?: number; them?: number }[];
  /** Set once both legs are in. */
  result?: "W" | "L";
  onPenalties?: boolean;
}

export interface EuroState {
  competition: EuroId;
  /** The thirty-six, seeded. You are one of them. */
  clubs: EuroClub[];
  /** Your eight, in the order they are played. */
  leaguePhase: EuroMatch[];
  /**
   * The real, live table — all thirty-six clubs, updated one matchday at a
   * time by `simulateEuroMatchday` the moment your own result for that
   * matchday is known (played, or watched from the stands), never fabricated
   * ahead of where the season has actually got to. Starts all-zero at
   * `openEuro`. Reported directly: a table that "automatically filled up...
   * with the eight games" after only matchday one was played — the OLD
   * `buildEuroTable` recomputed a fully-projected, all-thirty-six-clubs-on-
   * eight-games table from scratch on every render, including simulating
   * your own remaining fixtures. This is the honest replacement — read
   * straight off it, never recomputed.
   */
  liveTable: EuroStanding[];
  /**
   * Every league-phase fixture actually played so far, across ALL thirty-six
   * clubs, one matchday's worth (18 games) appended each time
   * `simulateEuroMatchday` runs — the Euro analogue of `career.results` for
   * the domestic league, and deliberately the SAME `LeagueResult` shape
   * (`week` holds the matchday number here), so `scoutReport.ts`'s existing
   * `recentResultsFor`/`formFor` work on it completely unchanged.
   *
   * Requested directly: "it should know who they've played... know the
   * result... even know who scored the goals... called the assists" about
   * an upcoming Champions League opponent — before this, a matchday's other
   * seventeen fixtures were simulated purely to update `liveTable` and then
   * thrown away, with no scorer/assist naming even for the two clubs
   * actually in front of the player. See `simulateEuroMatchday`.
   *
   * Optional so a career saved before this field existed loads exactly as
   * it did before — an absent campaign's history, not a crash. Every reader
   * treats it as `results ?? []`.
   */
  results?: LeagueResult[];
  /** How many league-phase matchdays have actually been simulated (0-8) —
   *  guards `simulateEuroMatchday` against replaying the same one twice. */
  matchdaysPlayed: number;
  /** A snapshot of `liveTable`, sorted, taken the moment the eighth
   *  matchday completes — what the knockout draw and `position` are read
   *  off. Absent until then. */
  table?: EuroStanding[];
  position?: number;
  ties: EuroTie[];
  eliminated?: boolean;
  won?: boolean;
  /** Who lifted it, whether or not that was you. */
  winner?: string;
}

// ── The field ───────────────────────────────────────────────────────────────

interface EuroSeed { name: string; strength: number; }

/**
 * Turn a flat, un-potted list into a real seeded field, strongest first.
 *
 * Pot membership used to be typed by hand alongside each name — which is
 * exactly how it drifted: a club moved between CHAMPIONS_SEEDS/EUROPA_SEEDS
 * below never had its hand-typed `pot` double-checked against anything,
 * so a stale number would sit there silently. Deriving it from strength
 * instead means there is nothing left to keep in sync — move a club to a
 * different seed list or change its strength and its pot follows on its
 * own.
 */
function seededPool(seeds: EuroSeed[]): EuroClub[] {
  const sorted = [...seeds].sort((a, b) => b.strength - a.strength);
  const potSize = Math.ceil(sorted.length / 4);
  return sorted.map((c, i) => ({ ...c, pot: Math.min(4, Math.floor(i / potSize) + 1) }));
}

/**
 * Europe's clubs.
 *
 * Reported directly, from a real save fourteen seasons in: Sturm Graz, Young
 * Boys and Ajax — all real clubs, all fetched into `externalSquads` under
 * their real names — turned up as the player's live CHAMPIONS League
 * opponents, with a scout report and a fetched squad that matched nobody
 * (a full XI of free agents, the last-resort fallback `teamsheet.ts` reaches
 * for when the named opponent isn't in any squad pool it actually holds).
 *
 * Root cause: this file's own `CHAMPIONS_POOL`/`EUROPA_POOL` — literally who
 * you can be drawn against — were typed independently of `clubs.ts`'s
 * `CHAMPIONS_LEAGUE_CLUBS`/`EUROPA_LEAGUE_CLUBS`, the lists that decide which
 * tab the /lineups picker shows a club under AND which competition
 * `externalClubsFor` fetches its squad for. A previous pass here
 * (see tests/star/europeSquadNames.mts) only ever checked that a pool name
 * was spelled correctly and resolvable to SOME real club — never that it was
 * resolvable to a club clubs.ts calls a member of THIS competition
 * specifically. Ten clubs clubs.ts calls Europa League (Sturm Graz, Young
 * Boys, Ajax, Juventus, AC Milan, Bayer Leverkusen, Benfica, Marseille, Real
 * Sociedad, Salzburg) had ended up in the Champions pool below; five clubs
 * clubs.ts calls Champions League (Betis, Fenerbahçe, Lens, Stuttgart,
 * Lille) had ended up in the Europa pool; two more (Sevilla, Eintracht
 * Frankfurt) weren't in either of clubs.ts's lists at all, so that file was
 * fixed to agree with what this one already did with them (see clubs.ts's
 * own OTHER_CLUBS comment). FC Red Bull Salzburg is the one club that came
 * out of this reconciliation with nowhere to go — still correctly tagged
 * Europa League in clubs.ts, just not re-added to the seed list below, kept
 * out so the pool sizes below stay the odd numbers simulateEuroMatchday's
 * matchday-pairing needs (see its own comment) without inventing a 38th
 * name.
 *
 * Every name below is still the exact spelling clubs.ts's
 * CHAMPIONS_LEAGUE_CLUBS/EUROPA_LEAGUE_CLUBS lists use — not a shorthand
 * ("Bayern Munich", "Copenhagen") that reads fine but has no real squad to
 * resolve against (the ORIGINAL version of this bug, fixed earlier — see
 * tests/star/europeSquadNames.mts). This pass adds a second, stricter test
 * there: not just "resolvable to a real club somewhere" but "resolvable to a
 * real club in clubs.ts's list for THIS competition, and no other."
 */
const CHAMPIONS_SEEDS: EuroSeed[] = [
  { name: "Real Madrid", strength: 92 },
  { name: "FC Bayern München", strength: 91 },
  { name: "FC Barcelona", strength: 89 },
  { name: "Paris Saint-Germain", strength: 88 },
  { name: "Inter", strength: 86 },
  { name: "Atlético Madrid", strength: 85 },
  { name: "Borussia Dortmund", strength: 84 },
  { name: "Napoli", strength: 82 },
  { name: "Sevilla FC", strength: 79 },
  { name: "FC Porto", strength: 79 },
  { name: "RB Leipzig", strength: 80 },
  { name: "Roma", strength: 80 },
  { name: "PSV", strength: 77 },
  { name: "Real Betis Balompié", strength: 77 },
  { name: "Sporting CP", strength: 77 },
  { name: "Villarreal CF", strength: 76 },
  { name: "Eintracht Frankfurt", strength: 76 },
  { name: "Fenerbahçe SK", strength: 76 },
  { name: "Feyenoord", strength: 75 },
  { name: "Olympique Lyonnais", strength: 75 },
  { name: "RC Lens", strength: 75 },
  { name: "VfB Stuttgart", strength: 75 },
  { name: "Lille OSC", strength: 75 },
  { name: "Galatasaray SK", strength: 74 },
  { name: "Celtic", strength: 72 },
  { name: "Club Brugge KV", strength: 72 },
  { name: "Shakhtar Donetsk", strength: 72 },
  { name: "Dinamo Zagreb", strength: 70 },
  { name: "SK Slavia Praha", strength: 70 },
  { name: "FC København", strength: 70 },
  { name: "FK Bodø/Glimt", strength: 69 },
  { name: "Como", strength: 64 },
  { name: "AEK Athens", strength: 62 },
];
const CHAMPIONS_POOL: EuroClub[] = seededPool(CHAMPIONS_SEEDS);

/**
 * The Europa League field.
 *
 * Its own list of names rather than a relabelled Champions League, so the two
 * competitions can never put the same club in both — and the strengths are
 * flattened as well as lowered, because a Europa League field is genuinely more
 * even, and that is what makes winning it feel like a different achievement
 * rather than an easier version of the same one. See CHAMPIONS_SEEDS above
 * for the reconciliation against clubs.ts that moved several names here.
 */
const EUROPA_SEEDS: EuroSeed[] = [
  { name: "Juventus", strength: 84 },
  { name: "AC Milan", strength: 83 },
  { name: "Bayer 04 Leverkusen", strength: 83 },
  { name: "SL Benfica", strength: 80 },
  { name: "Lazio", strength: 78 },
  { name: "Ajax", strength: 76 },
  { name: "Olympique de Marseille", strength: 76 },
  { name: "Real Sociedad", strength: 76 },
  { name: "Crystal Palace", strength: 76 },
  { name: "Rangers FC", strength: 74 },
  { name: "Olympiacos FC", strength: 73 },
  { name: "Sporting Clube de Braga", strength: 73 },
  { name: "AFC Bournemouth", strength: 73 },
  { name: "TSG 1899 Hoffenheim", strength: 73 },
  { name: "AZ Alkmaar", strength: 72 },
  { name: "RSC Anderlecht", strength: 71 },
  { name: "KRC Genk", strength: 71 },
  { name: "Union Saint-Gilloise", strength: 70 },
  { name: "PAOK", strength: 70 },
  { name: "Beşiktaş JK", strength: 70 },
  { name: "Stade Rennais FC", strength: 70 },
  { name: "Ferencvárosi Torna Club", strength: 69 },
  { name: "FC Midtjylland", strength: 69 },
  { name: "Sunderland", strength: 69 },
  { name: "Trabzonspor", strength: 69 },
  { name: "BSC Young Boys", strength: 68 },
  { name: "SK Sturm Graz", strength: 68 },
  { name: "Malmö FF", strength: 68 },
  { name: "Sparta Praha", strength: 68 },
  { name: "Viktoria Plzeň", strength: 68 },
  { name: "FC Basel 1893", strength: 64 },
  { name: "RC Celta", strength: 65 },
  { name: "Legia Warszawa", strength: 62 },
  { name: "Hearts", strength: 63 },
  { name: "Lech Poznań", strength: 61 },
  { name: "Vitória SC", strength: 61 },
  { name: "Shamrock Rovers", strength: 60 },
];
const EUROPA_POOL: EuroClub[] = seededPool(EUROPA_SEEDS);

/**
 * The Conference League field.
 *
 * A step below the Europa League — lower-ranked national champions, beaten
 * play-off sides and domestic cup winners. Winning it is a genuine European
 * trophy, which is the only reason it counts: the game does not offer it as
 * a consolation prize and then make it feel like one.
 *
 * None of these are clubs.ts-backed (no real squad to fetch) — a genuinely
 * separate, pre-existing gap from the CHAMPIONS/EUROPA reconciliation above,
 * not something this pass fixes. Trimmed by one (La Fiorita) purely to keep
 * this list's length the same odd-parity shape as the other two seed lists.
 */
const CONFERENCE_SEEDS: EuroSeed[] = [
  { name: "Fiorentina", strength: 74 },
  { name: "Club Brugge", strength: 72 },
  { name: "Hearts", strength: 66 },
  { name: "Gent", strength: 68 },
  { name: "Partizan", strength: 67 },
  { name: "PAOK", strength: 69 },
  { name: "Galatasaray B", strength: 67 },
  { name: "Djurgården", strength: 64 },
  { name: "Legia Warsaw", strength: 66 },

  { name: "Molde", strength: 65 },
  { name: "Heidenheim", strength: 66 },
  { name: "HJK Helsinki", strength: 62 },
  { name: "Sivasspor", strength: 63 },
  { name: "Genk", strength: 67 },
  { name: "Brøndby", strength: 64 },
  { name: "Vitória Guimarães", strength: 65 },
  { name: "Lech Poznań", strength: 63 },
  { name: "Slavia Sofia", strength: 61 },

  { name: "Hajduk Split", strength: 63 },
  { name: "Rosenborg", strength: 62 },
  { name: "IFK Göteborg", strength: 60 },
  { name: "Botev Plovdiv", strength: 59 },
  { name: "Universitatea Craiova", strength: 60 },
  { name: "Zaglebie Lubin", strength: 60 },
  { name: "Vikingur", strength: 58 },
  { name: "Noah FC", strength: 58 },
  { name: "FC Pyunik", strength: 57 },

  { name: "NSÍ Runavík", strength: 55 },
  { name: "Levadia Tallinn", strength: 56 },
  { name: "FK Riteriai", strength: 55 },
  { name: "Differdange 03", strength: 53 },
  { name: "FC Santa Coloma", strength: 52 },
  { name: "Shkupi", strength: 57 },
  { name: "Inter Club d'Escaldes", strength: 51 },
  { name: "Lincoln Red Imps", strength: 56 },
];
const CONFERENCE_POOL: EuroClub[] = seededPool(CONFERENCE_SEEDS);

export function poolFor(competition: EuroId): EuroClub[] {
  if (competition === "Champions League") return CHAMPIONS_POOL;
  if (competition === "Europa League") return EUROPA_POOL;
  return CONFERENCE_POOL;
}

// ── Opening the campaign ────────────────────────────────────────────────────

/**
 * Which pot you go into.
 *
 * Off last season's league finish, the way the real seeding works off a
 * coefficient nobody can explain. Winning the league puts you in pot one and
 * scraping in puts you in pot four, which is the difference between drawing
 * Bayern once and drawing them twice.
 */
function potForFinish(position: number): number {
  if (position <= 2) return 1;
  if (position === 3) return 2;
  if (position === 4) return 3;
  return 4;
}

/**
 * Open a European campaign: seed the field, draw your eight.
 *
 * Two opponents from each pot, one at home and one away — which is the real
 * format and also the reason a pot-one club always plays two of the best sides
 * in Europe however well it is seeded itself.
 */
export function openEuro(
  competition: EuroId,
  clubName: string,
  clubStrength: number,
  leagueFinish: number,
  rng: () => number,
): EuroState {
  const yourPot = potForFinish(leagueFinish);
  const pool = poolFor(competition);
  const you: EuroClub = { name: clubName, strength: clubStrength, pot: yourPot };

  // You, plus everyone in the pool — no per-pot cap. The pool's real size
  // now varies by competition (however many clubs CHAMPIONS_SEEDS/
  // EUROPA_SEEDS/CONFERENCE_SEEDS actually name), so a fixed "9 per pot,
  // minus 1 for your own pot" assumption would silently break the moment
  // that stopped being exactly 36 either way, which is exactly what
  // reconciling the seed lists against clubs.ts did. simulateEuroMatchday's
  // own comment explains why the total needs to come out even; the three
  // seed lists are each sized with that in mind instead.
  const clubs: EuroClub[] = [you];
  for (let pot = 1; pot <= 4; pot++) {
    clubs.push(...pool.filter(c => c.pot === pot && c.name !== clubName));
  }

  const leaguePhase: EuroMatch[] = [];
  for (let pot = 1; pot <= 4; pot++) {
    const available = shuffle(clubs.filter(c => c.pot === pot && c.name !== clubName), rng);
    const homeFirst = rng() < 0.5;
    if (available[0]) leaguePhase.push({ opponent: available[0].name, home: homeFirst });
    if (available[1]) leaguePhase.push({ opponent: available[1].name, home: !homeFirst });
  }

  const liveTable: EuroStanding[] = clubs.map(c => ({
    name: c.name, played: 0, won: 0, drawn: 0, lost: 0,
    goalsFor: 0, goalsAgainst: 0, points: 0, isYou: c.name === clubName,
  }));

  return {
    competition, clubs, leaguePhase: shuffle(leaguePhase, rng), ties: [],
    liveTable, results: [], matchdaysPlayed: 0,
  };
}

/** Fisher–Yates. `sort(() => rng() - 0.5)` is not a uniform permutation. */
function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ── The league phase table ──────────────────────────────────────────────────

/**
 * A scoreline between two clubs who are not you.
 *
 * The same shape the league simulation uses: a strength difference turned into
 * expected goals, then a Poisson draw around it. Home advantage is a third of a
 * goal, which is roughly what it is worth in the real thing.
 */
function simulate(a: number, b: number, rng: () => number): [number, number] {
  const edge = (a - b) / 22;
  const forA = Math.max(0.25, 1.35 + edge * 0.55 + 0.18);
  const forB = Math.max(0.25, 1.35 - edge * 0.55 - 0.18);
  return [poisson(forA, rng), poisson(forB, rng)];
}

function poisson(mean: number, rng: () => number): number {
  const limit = Math.exp(-mean);
  let k = 0;
  let p = 1;
  do { k++; p *= rng(); } while (p > limit && k < 12);
  return k - 1;
}

/**
 * Play everybody else's game for ONE matchday — the Champions/Europa League
 * analogue of season.ts's `playLeagueWeek`. Called exactly once per matchday,
 * the moment your own result for it is known (played for real, or watched
 * from the stands — see settleEuro/simulateMissedFixture), so `liveTable`
 * only ever reflects matchdays that have genuinely happened. Reported
 * directly: a table that "automatically filled up... with the eight games"
 * after only matchday one — the previous design (buildEuroTable) recomputed
 * a fully-projected table from scratch on every render, simulating your own
 * unplayed fixtures along with everyone else's. This replaces that outright.
 *
 * You and your opponent are credited with the real result handed in. The
 * other thirty-four are paired off at random for this one matchday and
 * simulated the same expected-goals way the rest of the division is —
 * always exactly seventeen pairs, since thirty-six minus the two of you
 * leaves an even thirty-four, so every club plays exactly once this
 * matchday and (after all eight run) exactly eight across the whole phase,
 * by construction, with no leftover-club bookkeeping needed. Their own
 * eight opponents are not preserved pot-for-pot the way yours are — nobody
 * ever audits Villarreal's own fixture list — only that the volume (one
 * game a matchday, eight across the phase) matches yours exactly.
 *
 * ── Named goals, for every one of the eighteen games ──
 *
 * `nameGoals`/`creditNamedGoals` (leagueSquads.ts) are exactly the same
 * functions `playLeagueWeek` already uses for the domestic division — a
 * goal in Europe belongs to somebody the same way a goal in the league
 * does. `squads` is `career.externalSquads` (Champions/Europa/Conference
 * League rosters are fetched into there, never `leagueSquads`) — a club
 * whose squad hasn't been fetched yet simply gets no named scorers for that
 * game (same graceful fallback `nameGoals`/the domestic league already have
 * for an unfetched squad), so the table is never blocked on a fetch, only
 * the scorer detail is.
 *
 * `yourGoals`/`yourOppGoals` let the CALLER hand in the real, live-match
 * goal events for your own fixture specifically (mirroring
 * `playLeagueWeek`'s own `user.goals`/`user.oppGoals`) — a match you
 * actually played has real named goals, not a fresh weighted roll. Absent
 * (e.g. a matchday you watched from the stands), your own game is named the
 * same weighted-roll way as the other seventeen.
 */
export function simulateEuroMatchday(
  state: EuroState,
  mdIndex: number,
  yourClub: string,
  yourOpponent: string,
  yourHome: boolean,
  yourScore: number,
  yourOppScore: number,
  rng: () => number,
  squads?: LeagueSquad[],
  yourGoals?: { m: number; s: string; a?: string }[],
  yourOppGoals?: NamedOppGoal[],
): EuroState {
  if (mdIndex < state.matchdaysPlayed) return state; // already simulated — never replay it
  const strength = new Map(state.clubs.map(c => [c.name, c.strength]));
  const liveTable = state.liveTable.map(r => ({ ...r }));
  const byName = new Map(liveTable.map(r => [r.name, r]));
  const squadOf = new Map((squads ?? []).map(s => [s.club, s]));
  const matchday = mdIndex + 1;
  const results: LeagueResult[] = [];

  const credit = (name: string, gf: number, ga: number) => {
    const r = byName.get(name);
    if (!r) return;
    r.played += 1;
    r.goalsFor += gf;
    r.goalsAgainst += ga;
    if (gf > ga) { r.won += 1; r.points += 3; }
    else if (gf === ga) { r.drawn += 1; r.points += 1; }
    else r.lost += 1;
  };

  credit(yourClub, yourScore, yourOppScore);
  credit(yourOpponent, yourOppScore, yourScore);

  const yourNamed = yourGoals ?? nameGoals(squadOf.get(yourClub), yourScore, rng);
  const oppNamed = yourOppGoals
    ? creditNamedGoals(squadOf.get(yourOpponent), yourOppGoals)
    : nameGoals(squadOf.get(yourOpponent), yourOppScore, rng);
  results.push({
    week: matchday,
    home: yourHome ? yourClub : yourOpponent,
    away: yourHome ? yourOpponent : yourClub,
    hs: yourHome ? yourScore : yourOppScore,
    as: yourHome ? yourOppScore : yourScore,
    ...(yourNamed.length ? (yourHome ? { hg: yourNamed } : { ag: yourNamed }) : {}),
    ...(oppNamed.length ? (yourHome ? { ag: oppNamed } : { hg: oppNamed }) : {}),
  });

  const others = shuffle(
    state.clubs.map(c => c.name).filter(n => n !== yourClub && n !== yourOpponent),
    rng,
  );
  for (let i = 0; i + 1 < others.length; i += 2) {
    const home = others[i], away = others[i + 1];
    const [hs, as] = simulate(strength.get(home) ?? 75, strength.get(away) ?? 75, rng);
    credit(home, hs, as);
    credit(away, as, hs);
    const hg = nameGoals(squadOf.get(home), hs, rng);
    const ag = nameGoals(squadOf.get(away), as, rng);
    results.push({
      week: matchday, home, away, hs, as,
      ...(hg.length ? { hg } : {}), ...(ag.length ? { ag } : {}),
    });
  }

  return { ...state, liveTable, matchdaysPlayed: matchday, results: [...(state.results ?? []), ...results] };
}

export function sortEuro(rows: EuroStanding[]): EuroStanding[] {
  return [...rows].sort((a, b) =>
    b.points - a.points
    || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst)
    || b.goalsFor - a.goalsFor
    || a.name.localeCompare(b.name));
}

/** Have all eight been played? */
export function leaguePhaseComplete(state: EuroState): boolean {
  return state.leaguePhase.length > 0 && state.leaguePhase.every(m => m.us !== undefined);
}

// ── The knockout ────────────────────────────────────────────────────────────

/** Which slots this campaign uses, decided by where you finished. */
export function knockoutSlots(position: number): CupSlot[] {
  return position <= 8 ? EURO_KO_SLOTS_SEEDED : EURO_KO_SLOTS_WITH_R32;
}

/**
 * Draw the opponent for a knockout round.
 *
 * From the clubs that finished in the half of the table the round takes from,
 * which is a rough seeding rather than the real bracket — you cannot draw a club
 * that went out, and a side that topped the league phase is not waiting for you
 * in the round of thirty-two.
 */
export function drawTie(
  state: EuroState,
  round: string,
  yourClub: string,
  rng: () => number,
): EuroTie {
  const table = state.table ?? [];
  const alreadyPlayed = new Set(state.ties.map(t => t.opponent));
  const band = round === "Round of 32"
    ? table.slice(8, 24)
    : round === "Round of 16"
      ? table.slice(0, 24)
      : table.slice(0, 16);
  const candidates = band
    .filter(r => !r.isYou && r.name !== yourClub && !alreadyPlayed.has(r.name));
  const pick = candidates.length
    ? candidates[Math.floor(rng() * candidates.length)]
    : { name: "Ajax" };
  const strength = state.clubs.find(c => c.name === pick.name)?.strength ?? 78;

  const single = round === "Final";
  const homeFirst = rng() < 0.5;
  return {
    round,
    opponent: pick.name,
    opponentStrength: strength,
    legs: single ? [{ home: false }] : [{ home: homeFirst }, { home: !homeFirst }],
  };
}

/** The tie being played, if there is one. */
export function currentTie(state: EuroState): EuroTie | null {
  const last = state.ties[state.ties.length - 1];
  return last && last.result === undefined ? last : null;
}

/** Which leg of the current tie is next, 0-based. Null when there is none. */
export function currentLeg(state: EuroState): number | null {
  const tie = currentTie(state);
  if (!tie) return null;
  const i = tie.legs.findIndex(l => l.us === undefined);
  return i === -1 ? null : i;
}

/**
 * Settle a tie once both legs are in.
 *
 * On aggregate, and then penalties — no away goals, which the competition itself
 * abolished. The shootout is a coin weighted by quality and bounded well inside
 * a toss, because the better side really is a little likelier and a tie decided
 * on a pure fifty-fifty reads as the game shrugging.
 */
export function settleTie(tie: EuroTie, yourStrength: number, rng: () => number): EuroTie {
  const done = tie.legs.every(l => l.us !== undefined);
  if (!done) return tie;
  const us = tie.legs.reduce((s, l) => s + (l.us ?? 0), 0);
  const them = tie.legs.reduce((s, l) => s + (l.them ?? 0), 0);
  if (us !== them) return { ...tie, result: us > them ? "W" : "L" };
  const edge = Math.max(0.3, Math.min(0.7, 0.5 + (yourStrength - tie.opponentStrength) / 200));
  return { ...tie, result: rng() < edge ? "W" : "L", onPenalties: true };
}

/** The round after this one, or null when that was the final. */
export function nextRound(position: number, round: string): string | null {
  const slots = knockoutSlots(position);
  const names = slots.map(s => s.round).filter((r, i, a) => a.indexOf(r) === i);
  const i = names.indexOf(round);
  return i === -1 || i === names.length - 1 ? null : names[i + 1];
}

/** The first knockout round for a club that finished here. */
export function firstRound(position: number): string | null {
  if (position > 24) return null;
  return knockoutSlots(position)[0].round;
}

/**
 * Who won it, when it was not you.
 *
 * A competition that only reports a winner when the player is in the final is a
 * competition that does not exist unless you are watching. Weighted by strength
 * so it is usually one of the good ones and occasionally is not.
 */
export function crownEurope(state: EuroState, seed: number): string {
  const rng = mulberry32(seed);
  const contenders = (state.table ?? []).slice(0, 16);
  if (!contenders.length) return state.clubs[0]?.name ?? "Real Madrid";
  const strength = new Map(state.clubs.map(c => [c.name, c.strength]));
  let total = 0;
  const weights = contenders.map((r) => {
    const w = Math.pow(Math.max(1, (strength.get(r.name) ?? 75) - 60), 2.2);
    total += w;
    return w;
  });
  let x = rng() * total;
  for (let i = 0; i < contenders.length; i++) {
    x -= weights[i];
    if (x <= 0) return contenders[i].name;
  }
  return contenders[0].name;
}

/**
 * Who won it, in a season the player was never entered at all.
 *
 * crownEurope() already answers "who won it when you were in it and went
 * out" — it reads state.table, which only exists once openEuro() has built
 * your 36-club field. Most seasons you are not qualified for a given
 * competition, or you are qualified for the OTHER one, and there was
 * previously no answer for "who won the Champions League" at all in that
 * case — the competition simply did not happen if you were not watching it.
 *
 * `entrants` is whichever other Premier League clubs qualified this season
 * (see seasonQualifiers in competitions.ts) — real clubs, real strengths, so
 * "Arsenal win the Champions League" is a genuine possible headline in a
 * season you were in the Europa League instead, not just always one of the
 * thirty-five fixed European names.
 */
export function crownWithoutYou(
  competition: EuroId,
  entrants: { name: string; strength: number }[],
  seed: number,
): string {
  const rng = mulberry32(seed);
  const pool = [...poolFor(competition)].sort((a, b) => b.strength - a.strength).slice(0, 16);
  const contenders: { name: string; strength: number }[] = [
    ...pool.map(c => ({ name: c.name, strength: c.strength })),
    ...entrants,
  ];
  if (!contenders.length) return pool[0]?.name ?? "Real Madrid";
  let total = 0;
  const weights = contenders.map((c) => {
    const w = Math.pow(Math.max(1, c.strength - 60), 2.2);
    total += w;
    return w;
  });
  let x = rng() * total;
  for (let i = 0; i < contenders.length; i++) {
    x -= weights[i];
    if (x <= 0) return contenders[i].name;
  }
  return contenders[0].name;
}

/** Where the league-phase finish leaves you, in words. */
export function phaseVerdict(position: number): string {
  if (position <= 8) return "Seeded straight through to the Round of 16.";
  if (position <= 24) return "Into the Round of 32 play-off.";
  return "Eliminated in the league phase.";
}

export const EURO_LEAGUE_PHASE_SLOTS = EURO_LEAGUE_PHASE_WEEKS;
