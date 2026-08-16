import type { CareerState } from "./types";
import { mulberry32 } from "./season";
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
 * finish ninth in is a table somebody actually finished eighth in.
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
  /** Filled in once all eight are played. */
  table?: EuroStanding[];
  position?: number;
  ties: EuroTie[];
  eliminated?: boolean;
  won?: boolean;
  /** Who lifted it, whether or not that was you. */
  winner?: string;
}

// ── The field ───────────────────────────────────────────────────────────────

/**
 * Europe's clubs, by pot.
 *
 * Thirty-five names so that with you there are thirty-six, which is what the
 * league phase needs. Strengths are fixed rather than rolled, so Real Madrid is
 * Real Madrid in every career and a draw against them means the same thing
 * twice.
 */
const CHAMPIONS_POOL: EuroClub[] = [
  { name: "Real Madrid", strength: 92, pot: 1 },
  { name: "Bayern Munich", strength: 91, pot: 1 },
  { name: "Barcelona", strength: 89, pot: 1 },
  { name: "Paris SG", strength: 88, pot: 1 },
  { name: "Inter Milan", strength: 86, pot: 1 },
  { name: "Atlético Madrid", strength: 85, pot: 1 },
  { name: "Borussia Dortmund", strength: 84, pot: 1 },
  { name: "Juventus", strength: 84, pot: 1 },
  { name: "AC Milan", strength: 83, pot: 1 },

  { name: "Bayer Leverkusen", strength: 83, pot: 2 },
  { name: "Napoli", strength: 82, pot: 2 },
  { name: "Benfica", strength: 80, pot: 2 },
  { name: "Porto", strength: 79, pot: 2 },
  { name: "Sevilla", strength: 79, pot: 2 },
  { name: "RB Leipzig", strength: 80, pot: 2 },
  { name: "Roma", strength: 80, pot: 2 },
  { name: "PSV Eindhoven", strength: 77, pot: 2 },
  { name: "Ajax", strength: 76, pot: 2 },

  { name: "Sporting CP", strength: 77, pot: 3 },
  { name: "Feyenoord", strength: 75, pot: 3 },
  { name: "Marseille", strength: 76, pot: 3 },
  { name: "Lyon", strength: 75, pot: 3 },
  { name: "Real Sociedad", strength: 76, pot: 3 },
  { name: "Villarreal", strength: 76, pot: 3 },
  { name: "Eintracht Frankfurt", strength: 76, pot: 3 },
  { name: "Celtic", strength: 72, pot: 3 },
  { name: "Club Brugge", strength: 72, pot: 3 },

  { name: "Galatasaray", strength: 74, pot: 4 },
  { name: "Shakhtar Donetsk", strength: 72, pot: 4 },
  { name: "Red Bull Salzburg", strength: 73, pot: 4 },
  { name: "Dinamo Zagreb", strength: 70, pot: 4 },
  { name: "Young Boys", strength: 68, pot: 4 },
  { name: "Slavia Prague", strength: 70, pot: 4 },
  { name: "Copenhagen", strength: 70, pot: 4 },
  { name: "Bodø/Glimt", strength: 69, pot: 4 },
  { name: "Sturm Graz", strength: 68, pot: 4 },
];

/**
 * The Europa League field.
 *
 * Its own list of names rather than a relabelled Champions League, so the two
 * competitions can never put the same club in both — and the strengths are
 * flattened as well as lowered, because a Europa League field is genuinely more
 * even, and that is what makes winning it feel like a different achievement
 * rather than an easier version of the same one.
 */
const EUROPA_POOL: EuroClub[] = [
  { name: "Villarreal", strength: 78, pot: 1 },
  { name: "Real Betis", strength: 77, pot: 1 },
  { name: "Fenerbahçe", strength: 76, pot: 1 },
  { name: "Rangers", strength: 74, pot: 1 },
  { name: "Lazio", strength: 78, pot: 1 },
  { name: "Fiorentina", strength: 77, pot: 1 },
  { name: "Athletic Club", strength: 77, pot: 1 },
  { name: "Olympiacos", strength: 73, pot: 1 },
  { name: "Braga", strength: 73, pot: 1 },

  { name: "Stuttgart", strength: 75, pot: 2 },
  { name: "Nice", strength: 74, pot: 2 },
  { name: "Lille", strength: 75, pot: 2 },
  { name: "Anderlecht", strength: 71, pot: 2 },
  { name: "Twente", strength: 70, pot: 2 },
  { name: "Union SG", strength: 70, pot: 2 },
  { name: "Panathinaikos", strength: 71, pot: 2 },
  { name: "Ferencváros", strength: 69, pot: 2 },
  { name: "Hoffenheim", strength: 73, pot: 2 },

  { name: "Midtjylland", strength: 69, pot: 3 },
  { name: "Slovan Bratislava", strength: 66, pot: 3 },
  { name: "Malmö", strength: 68, pot: 3 },
  { name: "Rapid Vienna", strength: 68, pot: 3 },
  { name: "Elfsborg", strength: 66, pot: 3 },
  { name: "Ludogorets", strength: 67, pot: 3 },
  { name: "AZ Alkmaar", strength: 72, pot: 3 },
  { name: "Viktoria Plzeň", strength: 68, pot: 3 },
  { name: "Maccabi Tel Aviv", strength: 66, pot: 3 },

  { name: "FCSB", strength: 65, pot: 4 },
  { name: "Qarabağ", strength: 66, pot: 4 },
  { name: "Omonia", strength: 63, pot: 4 },
  { name: "APOEL", strength: 63, pot: 4 },
  { name: "Bačka Topola", strength: 61, pot: 4 },
  { name: "Riga FC", strength: 61, pot: 4 },
  { name: "Astana", strength: 62, pot: 4 },
  { name: "Petrocub", strength: 60, pot: 4 },
  { name: "Shamrock Rovers", strength: 60, pot: 4 },
];

/**
 * The Conference League field.
 *
 * Thirty-five clubs a step below the Europa League — lower-ranked national
 * champions, beaten play-off sides and domestic cup winners. Winning it is a
 * genuine European trophy, which is the only reason it counts: the game does
 * not offer it as a consolation prize and then make it feel like one.
 */
const CONFERENCE_POOL: EuroClub[] = [
  { name: "Fiorentina", strength: 74, pot: 1 },
  { name: "Club Brugge", strength: 72, pot: 1 },
  { name: "Hearts", strength: 66, pot: 1 },
  { name: "Gent", strength: 68, pot: 1 },
  { name: "Partizan", strength: 67, pot: 1 },
  { name: "PAOK", strength: 69, pot: 1 },
  { name: "Galatasaray B", strength: 67, pot: 1 },
  { name: "Djurgården", strength: 64, pot: 1 },
  { name: "Legia Warsaw", strength: 66, pot: 1 },

  { name: "Molde", strength: 65, pot: 2 },
  { name: "Heidenheim", strength: 66, pot: 2 },
  { name: "HJK Helsinki", strength: 62, pot: 2 },
  { name: "Sivasspor", strength: 63, pot: 2 },
  { name: "Genk", strength: 67, pot: 2 },
  { name: "Brøndby", strength: 64, pot: 2 },
  { name: "Vitória Guimarães", strength: 65, pot: 2 },
  { name: "Lech Poznań", strength: 63, pot: 2 },
  { name: "Slavia Sofia", strength: 61, pot: 2 },

  { name: "Hajduk Split", strength: 63, pot: 3 },
  { name: "Rosenborg", strength: 62, pot: 3 },
  { name: "IFK Göteborg", strength: 60, pot: 3 },
  { name: "Botev Plovdiv", strength: 59, pot: 3 },
  { name: "Universitatea Craiova", strength: 60, pot: 3 },
  { name: "Zaglebie Lubin", strength: 60, pot: 3 },
  { name: "Vikingur", strength: 58, pot: 3 },
  { name: "Noah FC", strength: 58, pot: 3 },
  { name: "FC Pyunik", strength: 57, pot: 3 },

  { name: "NSÍ Runavík", strength: 55, pot: 4 },
  { name: "Levadia Tallinn", strength: 56, pot: 4 },
  { name: "FK Riteriai", strength: 55, pot: 4 },
  { name: "Differdange 03", strength: 53, pot: 4 },
  { name: "FC Santa Coloma", strength: 52, pot: 4 },
  { name: "La Fiorita", strength: 52, pot: 4 },
  { name: "Shkupi", strength: 57, pot: 4 },
  { name: "Inter Club d'Escaldes", strength: 51, pot: 4 },
  { name: "Lincoln Red Imps", strength: 56, pot: 4 },
];

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

  // Thirty-six: you, then the strongest available from each pot until it is
  // full. Your own pot takes one fewer, because you are in it.
  const clubs: EuroClub[] = [you];
  for (let pot = 1; pot <= 4; pot++) {
    const want = pot === yourPot ? 8 : 9;
    const inPot = pool.filter(c => c.pot === pot && c.name !== clubName);
    clubs.push(...inPot.slice(0, want));
  }

  const leaguePhase: EuroMatch[] = [];
  for (let pot = 1; pot <= 4; pot++) {
    const available = shuffle(clubs.filter(c => c.pot === pot && c.name !== clubName), rng);
    const homeFirst = rng() < 0.5;
    if (available[0]) leaguePhase.push({ opponent: available[0].name, home: homeFirst });
    if (available[1]) leaguePhase.push({ opponent: available[1].name, home: !homeFirst });
  }

  return { competition, clubs, leaguePhase: shuffle(leaguePhase, rng), ties: [] };
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
 * Build the thirty-six-club table.
 *
 * Your eight results are real — you played them. Everybody else's are simulated
 * here, and every club plays eight so the table is honest: a club cannot finish
 * above you on games you did not have.
 *
 * Deterministic from the season, so the table does not reshuffle itself every
 * time the screen is opened.
 */
export function buildEuroTable(state: EuroState, yourClub: string, seed: number): EuroStanding[] {
  const rng = mulberry32(seed);
  const rows = new Map<string, EuroStanding>();
  for (const c of state.clubs) {
    rows.set(c.name, {
      name: c.name, played: 0, won: 0, drawn: 0, lost: 0,
      goalsFor: 0, goalsAgainst: 0, points: 0, isYou: c.name === yourClub,
    });
  }
  const strength = new Map(state.clubs.map(c => [c.name, c.strength]));

  const credit = (name: string, gf: number, ga: number) => {
    const r = rows.get(name);
    if (!r) return;
    r.played += 1;
    r.goalsFor += gf;
    r.goalsAgainst += ga;
    if (gf > ga) { r.won += 1; r.points += 3; }
    else if (gf === ga) { r.drawn += 1; r.points += 1; }
    else r.lost += 1;
  };

  // Yours first, so the simulated clubs are topped up around results that
  // already happened rather than the other way round.
  for (const m of state.leaguePhase) {
    if (m.us === undefined || m.them === undefined) continue;
    credit(yourClub, m.us, m.them);
    credit(m.opponent, m.them, m.us);
  }

  // Then everybody else, until all thirty-six have played eight. Pairing the
  // two clubs furthest from a full card keeps it from ending with one club
  // needing three games and nobody left to play them.
  for (let guard = 0; guard < 400; guard++) {
    const short = state.clubs
      .map(c => rows.get(c.name)!)
      .filter(r => r.played < 8 && !r.isYou)
      .sort((a, b) => a.played - b.played);
    if (short.length < 2) break;
    const home = short[0];
    const away = short[1];
    const [hs, as] = simulate(
      (strength.get(home.name) ?? 75), (strength.get(away.name) ?? 75), rng,
    );
    credit(home.name, hs, as);
    credit(away.name, as, hs);
  }

  return sortEuro(Array.from(rows.values()));
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

/** Where the league-phase finish leaves you, in words. */
export function phaseVerdict(position: number): string {
  if (position <= 8) return "Seeded straight through to the Round of 16.";
  if (position <= 24) return "Into the Round of 32 play-off.";
  return "Eliminated in the league phase.";
}

export const EURO_LEAGUE_PHASE_SLOTS = EURO_LEAGUE_PHASE_WEEKS;
