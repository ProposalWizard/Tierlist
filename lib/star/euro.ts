import type { CareerState, LeagueSquad, LeagueResult } from "./types";
import { mulberry32, sortLeague } from "./season";
import { nameGoals, creditNamedGoals, type NamedOppGoal } from "./leagueSquads";
import {
  EURO_LEAGUE_PHASE_WEEKS, EURO_KO_SLOTS_WITH_R32, EURO_KO_SLOTS_SEEDED, type CupSlot,
} from "./calendar";
import { ruleBookFor } from "./ruleBook";
import {
  CHAMPIONS_LEAGUE_CLUBS, EUROPA_LEAGUE_CLUBS, OTHER_CLUBS,
  PREMIER_LEAGUE_CLUBS, CHAMPIONSHIP_CLUBS, PROMOTION_POOL_CLUBS,
} from "./clubs";
import { seasonQualifiers } from "./qualification";

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
 * exactly how it drifted: a club moved between seed lists never had its
 * hand-typed `pot` double-checked against anything, so a stale number would
 * sit there silently. Deriving it from strength instead means there is
 * nothing left to keep in sync — move a club or change its strength and its
 * pot follows on its own.
 */
function seededPool(seeds: EuroSeed[]): EuroClub[] {
  const sorted = [...seeds].sort((a, b) => b.strength - a.strength);
  const potSize = Math.ceil(sorted.length / 4);
  return sorted.map((c, i) => ({ ...c, pot: Math.min(4, Math.floor(i / potSize) + 1) }));
}

/**
 * ═══════════════════════════════════════════════════════════════════════
 * EUROPE'S CLUBS — READ THIS BEFORE TOUCHING ANYTHING BELOW.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * THE 12 SEPTEMBER 2026 BUG, IN FULL, SO IT DOESN'T HAPPEN A THIRD TIME:
 * this file used to carry its OWN separate 33-club "CHAMPIONS_SEEDS" and
 * 37-club "EUROPA_SEEDS" lists, deliberately EXCLUDING every English club —
 * the idea being "the player's own club gets added on top as a 34th/38th
 * entry." That was already wrong against this file's OWN header (which has
 * always said "Thirty-six clubs... you play eight of them" — you are one of
 * the 36, never a 37th) — and it got WORSE than that in practice: the
 * "other English clubs added on top" step was never actually implemented
 * anywhere. `openEuro` only ever added the ONE player's club, never the
 * other 4-7 real English qualifiers that season. So a real save's Champions
 * League was actually 34 clubs (33 foreign + you), Europa was 38 (37 + you)
 * — neither the intended 36, and every other English club that had legitimately
 * qualified was simply invisible from the competition entirely.
 *
 * THE FIX: there is no more separate foreign-only seed list. The season-1
 * field for each competition is now `clubs.ts`'s own `CHAMPIONS_LEAGUE_CLUBS`/
 * `EUROPA_LEAGUE_CLUBS` — EXACTLY 36 apiece, English clubs included directly
 * (that file's own corrected list, after two entries had drifted these to
 * 38 — see its own note) — read as the literal truth, not copied into a
 * second list here that can drift from it again. `NON_ENGLISH_CLUB_STRENGTH`
 * below only needs a number for the ~31 non-English clubs in each field
 * (English clubs always read their real, LIVE strength off `career.league`
 * instead — see `strengthOf`).
 *
 * WHO ACTUALLY OCCUPIES A SLOT EACH SEASON (`seasonField`, below):
 *   · England — real Premier League qualification (`seasonQualifiers`,
 *     imported from `qualification.ts` rather than `competitions.ts` to
 *     avoid a circular import — see that file's own note), clamped to the
 *     fixed season-1 English count for each competition. This is the actual
 *     fix for the "other English clubs are invisible" bug above.
 *   · Spain/Italy/Germany/France — a FIXED total count per competition,
 *     forever (whatever season 1 had), but WHICH specific clubs fill those
 *     slots reshuffles randomly each season against that nation's own real
 *     pool (its usual clubs plus its own real "Other"-section reserves —
 *     e.g. France's Monaco/Strasbourg). Requested directly, with a full
 *     worked example (France: always 4 in the Champions League, 2 in the
 *     Europa League, drawn from its real 6-club pool of Monaco/Strasbourg
 *     plus its 4 usual entrants).
 *   · Everyone else — reshuffled each season, at least one club in EACH
 *     competition for any nation with 2+ clubs (exactly 1-1 for a two-club
 *     nation — Scotland's Celtic/Rangers/Hearts is the worked example given
 *     directly). A one-club nation can land in either competition freely.
 *   · Season 1 is ALWAYS the exact static clubs.ts roster — none of the
 *     above runs before `career.season >= 2`, given directly.
 *
 * The Saudi Pro League rule (`applySaudiSwap`, further below) is a SEPARATE
 * layer applied on top of whatever `seasonField` already produced — it was
 * built and shipped before this fix, and still works the same way.
 */
const NON_ENGLISH_CLUB_STRENGTH: Record<string, number> = {
  "Real Madrid": 92, "FC Bayern München": 91, "FC Barcelona": 89,
  "Paris Saint-Germain": 88, "Inter": 86, "Atlético Madrid": 85,
  "Borussia Dortmund": 84, "Napoli": 82, "FC Porto": 79,
  "RB Leipzig": 80, "Roma": 80, "PSV": 77,
  "Real Betis Balompié": 77, "Sporting CP": 77, "Villarreal CF": 76,
  "Eintracht Frankfurt": 76, "Fenerbahçe SK": 76, "Feyenoord": 75,
  "Olympique Lyonnais": 75, "RC Lens": 75, "VfB Stuttgart": 75,
  "Lille OSC": 75, "Galatasaray SK": 74, "Celtic": 72,
  "Club Brugge KV": 72, "Shakhtar Donetsk": 72, "Dinamo Zagreb": 70,
  "SK Slavia Praha": 70, "FC København": 70, "FK Bodø/Glimt": 69,
  "Como": 64, "AEK Athens": 62,
  "Juventus": 84, "AC Milan": 83, "Bayer 04 Leverkusen": 83,
  "SL Benfica": 80, "Lazio": 78, "Ajax": 76,
  "Olympique de Marseille": 76, "Real Sociedad": 76,
  "Olympiacos FC": 73, "Sporting Clube de Braga": 73,
  "TSG 1899 Hoffenheim": 73, "AZ Alkmaar": 72,
  "RSC Anderlecht": 71, "KRC Genk": 71, "Union Saint-Gilloise": 70,
  "PAOK": 70, "Beşiktaş JK": 70, "Stade Rennais FC": 70,
  "Ferencvárosi Torna Club": 69, "FC Midtjylland": 69, "Trabzonspor": 69,
  "BSC Young Boys": 68, "SK Sturm Graz": 68, "Malmö FF": 68,
  "Sparta Praha": 68, "Viktoria Plzeň": 68, "FC Basel 1893": 64,
  "RC Celta": 65, "Legia Warszawa": 62, "Lech Poznań": 61,
  "Shamrock Rovers": 60, "FC Red Bull Salzburg": 76,
  // The four real "Other"-section main-nation clubs — never pool-backed at
  // all before now (OTHER_CLUBS never used to feed the simulation), needing
  // a real strength now that a season's reshuffle can genuinely field any
  // of them in place of their nation's usual entrants.
  "FC Schalke 04": 68, "AS Monaco": 78, "RC Strasbourg Alsace": 71, "Atalanta": 80,
  // The three clubs moved OUT to OTHER_CLUBS to correct clubs.ts's two
  // lists down to the real 36 (see clubs.ts's own note) — still real
  // candidates in their own nation's reshuffle pool from season 2 on.
  "Sevilla FC": 79, "Rangers FC": 74, "Hearts": 63,
  // Portugal's own fourth reserve, same reason.
  "Vitória SC": 61,
};

/**
 * The one real Europe-eligible club with no strength number above is a
 * Saudi one — see SAUDI_CLUBS below, which carries its own.
 */
const SAUDI_CLUBS: EuroSeed[] = [
  { name: "Al Hilal", strength: 79 },
  { name: "Al Nassr", strength: 79 },
  { name: "Al Ahli SFC", strength: 77 },
  { name: "Al Ittihad", strength: 77 },
];

/**
 * Real nationality for every non-English, non-Saudi club this file's
 * reshuffle/Saudi-swap logic ever reasons about. English clubs are found
 * via `divisionOf` (clubs.ts's own real ladder) rather than a hardcoded
 * "England" entry per club here — the real source, not a second list that
 * can drift from it, which is the exact bug this whole rewrite exists to
 * stop happening a third time.
 */
const EURO_CLUB_NATION: Record<string, string> = {
  "Real Madrid": "Spain", "FC Barcelona": "Spain", "Atlético Madrid": "Spain",
  "Real Betis Balompié": "Spain", "Villarreal CF": "Spain", "Real Sociedad": "Spain",
  "RC Celta": "Spain", "Sevilla FC": "Spain",
  "Inter": "Italy", "Napoli": "Italy", "Roma": "Italy", "Como": "Italy",
  "Juventus": "Italy", "AC Milan": "Italy", "Lazio": "Italy", "Atalanta": "Italy",
  "FC Bayern München": "Germany", "Borussia Dortmund": "Germany", "RB Leipzig": "Germany",
  "Eintracht Frankfurt": "Germany", "VfB Stuttgart": "Germany", "Bayer 04 Leverkusen": "Germany",
  "TSG 1899 Hoffenheim": "Germany", "FC Schalke 04": "Germany",
  "Paris Saint-Germain": "France", "Olympique Lyonnais": "France", "RC Lens": "France",
  "Lille OSC": "France", "Olympique de Marseille": "France", "Stade Rennais FC": "France",
  "AS Monaco": "France", "RC Strasbourg Alsace": "France",
  "FC Porto": "Portugal", "Sporting CP": "Portugal", "SL Benfica": "Portugal",
  "Sporting Clube de Braga": "Portugal", "Vitória SC": "Portugal",
  "PSV": "Netherlands", "Feyenoord": "Netherlands", "Ajax": "Netherlands", "AZ Alkmaar": "Netherlands",
  "Fenerbahçe SK": "Turkey", "Galatasaray SK": "Turkey", "Beşiktaş JK": "Turkey", "Trabzonspor": "Turkey",
  "Celtic": "Scotland", "Rangers FC": "Scotland", "Hearts": "Scotland",
  "Club Brugge KV": "Belgium", "RSC Anderlecht": "Belgium", "KRC Genk": "Belgium", "Union Saint-Gilloise": "Belgium",
  "Shakhtar Donetsk": "Ukraine", "Dinamo Zagreb": "Croatia",
  "SK Slavia Praha": "Czech Republic", "Sparta Praha": "Czech Republic", "Viktoria Plzeň": "Czech Republic",
  "FC København": "Denmark", "FC Midtjylland": "Denmark", "FK Bodø/Glimt": "Norway",
  "AEK Athens": "Greece", "Olympiacos FC": "Greece", "PAOK": "Greece",
  "Ferencvárosi Torna Club": "Hungary",
  "BSC Young Boys": "Switzerland", "FC Basel 1893": "Switzerland",
  "SK Sturm Graz": "Austria", "FC Red Bull Salzburg": "Austria", "Malmö FF": "Sweden",
  "Legia Warszawa": "Poland", "Lech Poznań": "Poland",
  "Shamrock Rovers": "Ireland",
};

/** England, via the real ladder — or whatever `EURO_CLUB_NATION` says. */
const ENGLISH_LADDER = new Set([...PREMIER_LEAGUE_CLUBS, ...CHAMPIONSHIP_CLUBS, ...PROMOTION_POOL_CLUBS]);

function nationOf(club: string): string {
  // Deliberately NOT `clubs.ts`'s own `divisionOf` here — that function's
  // `DIVISION_BY_CLUB` map is built PREMIER_LEAGUE_CLUBS first, then
  // CHAMPIONS_LEAGUE_CLUBS/EUROPA_LEAGUE_CLUBS layered on top of the SAME
  // map, so a club on BOTH lists (Arsenal, Aston Villa, Liverpool, Man
  // City, Man United, Bournemouth, Crystal Palace, Sunderland — exactly
  // the English clubs this function most needs to get right) has its
  // "premier" tag silently overwritten to "champions"/"europa". Caught
  // directly in testing: MAIN_NATION_ALLOCATION.England came out {0, 0},
  // and every English qualifier vanished from the season 2+ field the
  // instant `nationOf` trusted that map. `divisionOf` is used correctly in
  // many other places for its own purpose (this file leaves it untouched
  // rather than risk changing its behaviour for everything else that reads
  // it) — this checks the three real English-ladder lists directly instead.
  return ENGLISH_LADDER.has(club) ? "England" : (EURO_CLUB_NATION[club] ?? "Unknown");
}

/** An English club always reads its real, LIVE strength off `career.league`
 *  — everyone else reads the flat table above. */
function strengthOf(club: string, career: CareerState): number {
  const inLeague = career.league.find(t => t.name === club);
  if (inLeague) return inLeague.strength;
  const saudi = SAUDI_CLUBS.find(s => s.name === club);
  if (saudi) return saudi.strength;
  return NON_ENGLISH_CLUB_STRENGTH[club] ?? 72;
}

const MAIN_NATIONS = ["England", "Spain", "Italy", "Germany", "France"];
// Rangers FC dropped from this list in the 13 Sep 2026 36-club rebuild — it
// moved from EUROPA_LEAGUE_CLUBS into OTHER_CLUBS (clubs.ts) to correct that
// list's real count down to 36, so it's no longer a guaranteed fixture in
// the Europa League field every season; naming it exempt here would be
// meaningless (it can't be "replaced" out of a competition it isn't
// reliably in). It's still a real, reachable Scotland club via the
// "everyone else" reshuffle in seasonField, same as before.
const EL_NAMED_EXEMPT = new Set(["Olympiacos FC", "RSC Anderlecht", "SL Benfica", "Ajax"]);

/**
 * How many of each main nation's clubs sit in the Champions/Europa League —
 * computed ONCE from the real season-1 `clubs.ts` rosters, never hardcoded,
 * so this can't drift from clubs.ts the way the old seed lists did. This
 * count is PERMANENT (requested directly): a main nation always has exactly
 * this many clubs in each competition, every season. Which SPECIFIC clubs
 * fill those slots is what varies — see `seasonField`'s own note.
 */
function computeMainNationAllocation(): Record<string, { champions: number; europa: number }> {
  const alloc: Record<string, { champions: number; europa: number }> = {};
  for (const nation of MAIN_NATIONS) {
    alloc[nation] = {
      champions: CHAMPIONS_LEAGUE_CLUBS.filter(name => nationOf(name) === nation).length,
      europa: EUROPA_LEAGUE_CLUBS.filter(name => nationOf(name) === nation).length,
    };
  }
  return alloc;
}
const MAIN_NATION_ALLOCATION = computeMainNationAllocation();

/** Every real club (its usual Champions/Europa League entrants, plus its
 *  own "Other"-section reserves) belonging to one nation — the pool a main
 *  nation's fixed allocation is randomly drawn from each season. */
function nationPool(nation: string): string[] {
  return [...CHAMPIONS_LEAGUE_CLUBS, ...EUROPA_LEAGUE_CLUBS, ...OTHER_CLUBS]
    .filter(name => nationOf(name) === nation);
}

/**
 * THIS SEASON'S REAL FIELD FOR ONE COMPETITION — season 1 is the literal
 * static roster; season 2 on is genuinely reshuffled. See this file's own
 * big header comment above for the full account of each nation's rule.
 */
function seasonField(competition: "Champions League" | "Europa League", career: CareerState): EuroClub[] {
  const withStrength = (names: string[]) => names.map(name => ({ name, strength: strengthOf(name, career) }));

  if (career.season < 2) {
    const names = competition === "Champions League" ? CHAMPIONS_LEAGUE_CLUBS : EUROPA_LEAGUE_CLUBS;
    return seededPool(withStrength([...names]));
  }

  const rng = mulberry32(career.season * 30011 + 3);
  const championsParts: string[] = [];
  const europaParts: string[] = [];

  // England — real Premier League qualification, never randomised.
  const uefaRules = ruleBookFor(career, "UEFA");
  const englishQualifiers = seasonQualifiers(
    career.league, career.lastSeasonWinners?.faCup ?? null, career.lastSeasonWinners?.leagueCup ?? null,
    uefaRules.extraChampionsLeagueSlots, uefaRules.extraEuropaLeagueSlots,
  );
  // `seasonQualifiers`'s own Europa list is only ever the base 2 table
  // slots PLUS a cup-winner cascade — real, but not guaranteed to reach
  // England's fixed count on a season with no cup winner to cascade in.
  // Requested directly, though: England "will always have that amount" —
  // so a real shortfall here is topped up from the next-best-placed
  // English club in the real table that hasn't already claimed a Champions
  // or Europa slot, rather than leaving a place genuinely empty.
  const englishChampions = englishQualifiers.champions.slice(0, MAIN_NATION_ALLOCATION.England.champions);
  const englishEuropa = englishQualifiers.europa.slice(0, MAIN_NATION_ALLOCATION.England.europa);
  if (englishEuropa.length < MAIN_NATION_ALLOCATION.England.europa) {
    const claimed = new Set([...englishChampions, ...englishEuropa]);
    for (const team of sortLeague(career.league)) {
      if (englishEuropa.length >= MAIN_NATION_ALLOCATION.England.europa) break;
      if (!claimed.has(team.name)) { englishEuropa.push(team.name); claimed.add(team.name); }
    }
  }
  championsParts.push(...englishChampions);
  europaParts.push(...englishEuropa);

  // Spain/Italy/Germany/France — a fixed count, random specific clubs drawn
  // from that nation's own real pool (worked example given directly: France
  // always has exactly 4 in the Champions League and 2 in the Europa
  // League, from its real 6-club pool of PSG/Lyon/Lens/Lille plus its own
  // reserves Monaco/Strasbourg).
  for (const nation of ["Spain", "Italy", "Germany", "France"]) {
    const pool = shuffle(nationPool(nation), rng);
    const alloc = MAIN_NATION_ALLOCATION[nation];
    championsParts.push(...pool.slice(0, alloc.champions));
    europaParts.push(...pool.slice(alloc.champions, alloc.champions + alloc.europa));
  }

  // Everyone else — reshuffled, at least one club per multi-club nation in
  // EACH competition (exactly 1-1 for a two-club nation — Scotland's
  // Celtic/Rangers/Hearts is the worked example given directly). Pulled
  // from the real Champions/Europa lists AND the real non-main-nation
  // "Other" reserves (Scotland's/Portugal's own — given directly: "add in
  // every single team from the Other section that is not English or
  // Saudi"), never from a main nation's or Saudi's own clubs, which are
  // handled entirely separately above/below.
  const isMainOrSaudi = (name: string) => MAIN_NATIONS.includes(nationOf(name)) || SAUDI_CLUBS.some(s => s.name === name);
  const everyoneElse = [...CHAMPIONS_LEAGUE_CLUBS, ...EUROPA_LEAGUE_CLUBS, ...OTHER_CLUBS]
    .filter(name => !isMainOrSaudi(name) && nationOf(name) !== "Unknown");

  const byNation = new Map<string, string[]>();
  for (const name of everyoneElse) {
    const nation = nationOf(name);
    (byNation.get(nation) ?? byNation.set(nation, []).get(nation)!).push(name);
  }
  const mandatoryChampions: string[] = [];
  const mandatoryEuropa: string[] = [];
  const flexible: string[] = [];
  for (const clubs of Array.from(byNation.values())) {
    if (clubs.length >= 2) {
      const [first, second, ...rest] = shuffle(clubs, rng);
      mandatoryChampions.push(first);
      mandatoryEuropa.push(second);
      flexible.push(...rest);
    } else {
      flexible.push(...clubs);
    }
  }
  const shuffledFlex = shuffle(flexible, rng);
  const mainTotalChampions = MAIN_NATIONS.reduce((s, n) => s + MAIN_NATION_ALLOCATION[n].champions, 0);
  const mainTotalEuropa = MAIN_NATIONS.reduce((s, n) => s + MAIN_NATION_ALLOCATION[n].europa, 0);
  const clCapacity = CHAMPIONS_LEAGUE_CLUBS.length - mainTotalChampions;
  const elCapacity = EUROPA_LEAGUE_CLUBS.length - mainTotalEuropa;
  // Both sides are clamped to their OWN real capacity — the flexible pool
  // (every multi-club nation's clubs beyond its mandatory 1, plus every
  // single-club nation) is routinely BIGGER than the two capacities
  // combined (a nation can have more real depth than there are slots for
  // it, the same way Spain's own 8-club pool fills only 7 fixed slots) —
  // real clubs genuinely sit out some seasons rather than being forced in
  // somewhere. The first version of this dumped every leftover flexible
  // club into the Europa League regardless of its own capacity, silently
  // overfilling it — caught in testing (36/28 instead of 36/36).
  const clNeeded = Math.max(0, Math.min(shuffledFlex.length, clCapacity - mandatoryChampions.length));
  const afterChampions = shuffledFlex.slice(clNeeded);
  const elNeeded = Math.max(0, Math.min(afterChampions.length, elCapacity - mandatoryEuropa.length));
  championsParts.push(...mandatoryChampions, ...shuffledFlex.slice(0, clNeeded));
  europaParts.push(...mandatoryEuropa, ...afterChampions.slice(0, elNeeded));

  return seededPool(withStrength(competition === "Champions League" ? championsParts : europaParts));
}

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

// ── Saudi Pro League clubs in Europe — a real, votable Rule Book change ──
//
// Requested directly, in full mechanical detail. The four Saudi clubs
// (clubs.ts's OTHER_CLUBS — Al Hilal, Al Nassr, Al Ahli SFC, Al Ittihad)
// already have real squads fetched every season (`externalClubsFor` already
// includes OTHER_CLUBS) — this only changes which competition's field lists
// them. Two of the four join the Champions League each season, two join the
// Europa League, randomly — but not by replacing just anyone: every main
// nation's clubs are exempt from being bumped out of EITHER competition
// (given directly), and the Europa League additionally exempts five named
// clubs (Olympiacos, Anderlecht, Benfica, Rangers, Ajax — also given
// directly). The two Champions League clubs that get replaced aren't
// dropped outright — they demote INTO the Europa League that same season,
// which is why the Europa League needs to make room for four incomers (two
// Saudi, two demoted) by removing four of its own eligible clubs, not two.
// Applies on TOP of whatever `seasonField` above already produced for this
// season — SAUDI_CLUBS/EURO_CLUB_NATION are defined earlier in this file,
// shared with `seasonField`'s own nation logic.
function saudiExempt(club: EuroClub, competition: "Champions League" | "Europa League"): boolean {
  if (MAIN_NATIONS.includes(nationOf(club.name))) return true;
  return competition === "Europa League" && EL_NAMED_EXEMPT.has(club.name);
}

/** Applies the swap for ONE competition's pool, given the already-decided
 *  incoming clubs (Saudi entrants, plus — for Europa League only — the two
 *  Champions League clubs bumped down) and a seeded rng. Removes exactly as
 *  many eligible (non-exempt) clubs as are coming in, re-seeds the whole
 *  field by strength (`seededPool`'s own logic, inlined here since a mixed
 *  field of untouched clubs + new arrivals needs the same treatment). */
function swapIn(pool: EuroClub[], incoming: EuroSeed[], competition: "Champions League" | "Europa League", rng: () => number): EuroClub[] {
  const eligible = shuffle(pool.filter(c => !saudiExempt(c, competition)), rng);
  const removed = new Set(eligible.slice(0, incoming.length).map(c => c.name));
  const survivors = pool.filter(c => !removed.has(c.name));
  return seededPool([...survivors.map(c => ({ name: c.name, strength: c.strength })), ...incoming]);
}

/**
 * The whole season's swap, computed once and reused for both pools so the
 * Champions League's two demotions land as real incomers in the Europa
 * League field, not a second independent random draw. Takes the base
 * Champions/Europa fields as arguments (rather than reading module-level
 * constants) so it composes correctly on top of whatever `seasonField`
 * already produced this season — the Saudi swap applies to the REAL current
 * field, not always the original static one.
 */
function applySaudiSwap(
  championsBase: EuroClub[], europaBase: EuroClub[],
  competition: "Champions League" | "Europa League", seasonSeed: number,
): EuroClub[] {
  const rng = mulberry32(seasonSeed);
  const shuffledSaudis = shuffle(SAUDI_CLUBS, rng);
  const [clA, clB, elA, elB] = shuffledSaudis;

  const newChampions = swapIn(championsBase, [clA, clB], "Champions League", rng);
  const demoted = championsBase.filter(c => !newChampions.some(n => n.name === c.name))
    .map(c => ({ name: c.name, strength: c.strength }));
  const newEuropa = swapIn(europaBase, [elA, elB, ...demoted], "Europa League", rng);

  return competition === "Champions League" ? newChampions : newEuropa;
}

export function poolFor(competition: EuroId, career?: CareerState): EuroClub[] {
  if (competition === "Conference League") return CONFERENCE_POOL;

  // No live career to compute real qualification/strengths from — the
  // static season-1 roster is the only meaningful fallback (used by e.g.
  // crownWithoutYou, which supplies real English entrants separately).
  if (!career) {
    const names = competition === "Champions League" ? CHAMPIONS_LEAGUE_CLUBS : EUROPA_LEAGUE_CLUBS;
    return seededPool(names.map(name => ({ name, strength: NON_ENGLISH_CLUB_STRENGTH[name] ?? 75 })));
  }

  const championsBase = seasonField("Champions League", career);
  const europaBase = seasonField("Europa League", career);

  if (ruleBookFor(career, "UEFA").saudiClubsInEurope) {
    return applySaudiSwap(championsBase, europaBase, competition, career.season * 60013 + 17);
  }
  return competition === "Champions League" ? championsBase : europaBase;
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
  career?: CareerState,
): EuroState {
  const yourPot = potForFinish(leagueFinish);
  const pool = poolFor(competition, career);
  const you: EuroClub = { name: clubName, strength: clubStrength, pot: yourPot };

  // You, plus everyone ELSE in the pool. Since `seasonField` now builds the
  // real 36-club field with English clubs (including yours, once you've
  // genuinely qualified) already IN it — the fix for the bug this file's
  // own big header comment above documents at length — the pool USUALLY
  // already contains your own name; filtering it out here before re-adding
  // you (with your own live strength/pot, which should already match, but
  // this is the one place that GUARANTEES it) keeps the total at the real
  // 36 rather than 37 in that case.
  //
  // But a career-less call (the dev sandbox, a generic test club, `/star
  // -match-dev`) or an invented player club that never appears in any real
  // qualification list hits the OTHER branch: filtering removes nothing,
  // so simply prepending "you" would leave 37 clubs — an ODD total, which
  // breaks `simulateEuroMatchday`'s everyone-else pairing (it relies on an
  // EVEN number remaining once you and your opponent are set aside — see
  // that function's own comment). Caught in testing: real seeded runs came
  // back with several clubs stuck on 7 played instead of 8, a genuine bye
  // creeping in every matchday. Fixed by dropping the single weakest
  // (lowest-pot, last-in-pot) pool club in that case, so the total field
  // size is always exactly `pool.length` regardless of which branch fires.
  const withoutYou = pool.filter(c => c.name !== clubName);
  const trimmed = withoutYou.length === pool.length
    ? withoutYou.slice(0, -1)
    : withoutYou;
  const clubs: EuroClub[] = [you];
  for (let pot = 1; pot <= 4; pot++) {
    clubs.push(...trimmed.filter(c => c.pot === pot));
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
