/**
 * THE INTERNATIONAL CAREER — first slice (STAR_ROADMAP #8).
 *
 * Before this, the national team was one thing: a summer tournament every
 * other season, entered off a flat star-rating bar (competitions.ts's
 * `internationalCallUp`). Caps and international goals were credited, but
 * nothing ever happened in the season itself.
 *
 * Now each season has four international breaks, on real FIFA-window
 * weekends: early September, mid October, mid November and late March. At
 * each one the national manager picks his squad, and you are in it or not:
 *
 *   chance = logistic( (your overall − the nation's bar) / 3.5
 *                    + (recent form − 6.8) × 0.9
 *                    + 0.8 if you were in the last squad )
 *
 * clamped to 2%–97%, and 0 while injured. The bar is the nation's own depth:
 * England's is 78 (about 3.4 stars), Brazil's and France's 82, a small
 * nation's 52. Called up, you play one match — a qualifier for the next
 * tournament, or a friendly in March — in the real match engine, with a
 * national squad of real players of your nationality from the game's own
 * player data, filled with made-up men (fake faces) where there are not
 * enough.
 *
 * Pure: no React, no storage. The page asks `windowDue`, shows the decision,
 * and calls `applyCallUp`.
 */
import type { CareerState, Competition, Fixture, LeaguePlayer, MatchStats, SquadPlayer } from "./types";
import { mulberry32 } from "./season";
import { generateSquad, clubNameSeed } from "./squadData";
import { fakeFaceFor } from "./fakeFaces";
import { displayOverall } from "./rating";
import { divisionOf, fixtureTimestamp, weekOnWeekend, type CareerDivision } from "./calendar";
import { nationOf, nextFixtureFor, tournamentFor } from "./competitions";
import type { ClubKits } from "./kits";

// ── The windows ─────────────────────────────────────────────────────────────

/**
 * The four breaks, as weekends of the season (1 = the opening Saturday, mid
 * August). Premier League: 4 ≈ early Sep, 10 ≈ mid Oct, 14 ≈ mid Nov, 33 ≈
 * late Mar — all four clear of every Tuesday (Europe) and Wednesday (cups)
 * fixture. A 46-round division plays a Tuesday league round on weekends 10,
 * 14 and 33, so its breaks move a week earlier to stay clear of them.
 */
export const INTL_WINDOWS_PREMIER = [4, 10, 14, 33];
export const INTL_WINDOWS_OTHER = [4, 9, 13, 32];
/** Months, for the screen. */
export const INTL_WINDOW_NAMES = ["September", "October", "November", "March"];

export function windowWeekends(division: CareerDivision): number[] {
  return division === "premier" ? INTL_WINDOWS_PREMIER : INTL_WINDOWS_OTHER;
}

/** The fixture week number of window `i` for this division. */
export function windowWeek(division: CareerDivision, i: number): number {
  return weekOnWeekend(division, windowWeekends(division)[i]);
}

// ── Nations ─────────────────────────────────────────────────────────────────

/** Team strength. The call-up bar is this minus 8. Unknown nations: 60. */
export const NATION_STRENGTH: Record<string, number> = {
  "Brazil": 90, "France": 90, "Argentina": 89, "Spain": 88, "England": 86,
  "Germany": 86, "Portugal": 86, "Netherlands": 84, "Italy": 84, "Belgium": 82,
  "Croatia": 81, "Uruguay": 80, "Colombia": 79, "Denmark": 78, "Morocco": 78,
  "Switzerland": 77, "Senegal": 76, "Japan": 76, "Mexico": 75, "USA": 74,
  "United States": 74, "Norway": 77, "Austria": 76, "Türkiye": 75, "Turkey": 75,
  "Sweden": 74, "Poland": 74, "Serbia": 74, "Ukraine": 74, "Ecuador": 75,
  "Korea Republic": 73, "Nigeria": 74, "Cote d'Ivoire": 74, "Ivory Coast": 74,
  "Scotland": 72, "Wales": 70, "Republic of Ireland": 70, "Ireland": 70,
  "Northern Ireland": 66, "Czechia": 73, "Czech Republic": 73, "Hungary": 72,
  "Ghana": 72, "Cameroon": 72, "Egypt": 72, "Algeria": 73, "Australia": 70,
  "Canada": 72, "Chile": 72, "Peru": 70, "Paraguay": 71, "Greece": 71,
  "Slovakia": 70, "Slovenia": 70, "Romania": 70, "Iceland": 66, "Finland": 66,
  "Jamaica": 65, "New Zealand": 62, "San Marino": 45, "Gibraltar": 48,
};

/** Opponents for a window, when your own nation is not among them. */
const OPPONENTS = [
  "Brazil", "France", "Argentina", "Spain", "Germany", "Portugal", "Netherlands",
  "Italy", "Belgium", "Croatia", "Uruguay", "Denmark", "Switzerland", "Mexico",
  "Japan", "Senegal", "Morocco", "USA", "Norway", "Austria", "Poland", "Sweden",
  "Scotland", "Wales", "Serbia", "Hungary", "Greece", "Iceland", "Finland",
];

const EUROPEAN = new Set([
  "England", "Scotland", "Wales", "Northern Ireland", "Republic of Ireland", "Ireland",
  "France", "Spain", "Germany", "Portugal", "Netherlands", "Italy", "Belgium", "Croatia",
  "Denmark", "Switzerland", "Norway", "Austria", "Türkiye", "Turkey", "Sweden", "Poland",
  "Serbia", "Ukraine", "Czechia", "Czech Republic", "Hungary", "Greece", "Slovakia",
  "Slovenia", "Romania", "Iceland", "Finland", "San Marino", "Gibraltar", "Albania",
  "Bosnia and Herzegovina", "Bulgaria", "Georgia", "Israel", "Kosovo", "Montenegro",
  "North Macedonia", "Russia", "Belarus", "Estonia", "Latvia", "Lithuania", "Luxembourg",
  "Malta", "Moldova", "Cyprus", "Faroe Islands", "Armenia", "Azerbaijan", "Kazakhstan",
  "Andorra", "Liechtenstein",
]);

export function nationStrength(nation: string): number {
  return NATION_STRENGTH[nation] ?? 60;
}

/** The overall you need to be about a coin flip for the squad. */
export function callUpBar(nation: string): number {
  return nationStrength(nation) - 8;
}

/** A few national colours; everyone else wears the neutral kit pair. */
const NATION_KITS: Record<string, ClubKits> = {
  England: { home: { shirt: "#f8fafc", trim: "#1e3a8a" }, away: { shirt: "#b91c1c", trim: "#f8fafc" } },
  Scotland: { home: { shirt: "#1e3a8a", trim: "#f8fafc" }, away: { shirt: "#f8fafc", trim: "#1e3a8a" } },
  Wales: { home: { shirt: "#dc2626", trim: "#16a34a" }, away: { shirt: "#f8fafc", trim: "#dc2626" } },
  France: { home: { shirt: "#1e3a8a", trim: "#f8fafc" }, away: { shirt: "#f8fafc", trim: "#1e3a8a" } },
  Brazil: { home: { shirt: "#facc15", trim: "#15803d" }, away: { shirt: "#1d4ed8", trim: "#f8fafc" } },
  Argentina: { home: { shirt: "#7dd3fc", trim: "#f8fafc" }, away: { shirt: "#1e293b", trim: "#7dd3fc" } },
  Spain: { home: { shirt: "#b91c1c", trim: "#facc15" }, away: { shirt: "#f8fafc", trim: "#b91c1c" } },
  Germany: { home: { shirt: "#f8fafc", trim: "#111827" }, away: { shirt: "#111827", trim: "#f8fafc" } },
  Portugal: { home: { shirt: "#991b1b", trim: "#15803d" }, away: { shirt: "#f8fafc", trim: "#991b1b" } },
  Netherlands: { home: { shirt: "#f97316", trim: "#f8fafc" }, away: { shirt: "#1e3a8a", trim: "#f97316" } },
  Italy: { home: { shirt: "#1d4ed8", trim: "#f8fafc" }, away: { shirt: "#f8fafc", trim: "#1d4ed8" } },
  Belgium: { home: { shirt: "#b91c1c", trim: "#111827" }, away: { shirt: "#f8fafc", trim: "#b91c1c" } },
  Croatia: { home: { shirt: "#f8fafc", trim: "#dc2626" }, away: { shirt: "#1e3a8a", trim: "#f8fafc" } },
  "Republic of Ireland": { home: { shirt: "#15803d", trim: "#f8fafc" }, away: { shirt: "#f8fafc", trim: "#15803d" } },
  USA: { home: { shirt: "#f8fafc", trim: "#1e3a8a" }, away: { shirt: "#1e3a8a", trim: "#dc2626" } },
};

export function nationKits(nation: string): ClubKits {
  return NATION_KITS[nation] ?? {
    home: { shirt: "#e5e7eb", trim: "#374151" }, away: { shirt: "#374151", trim: "#e5e7eb" },
  };
}

// ── The record ──────────────────────────────────────────────────────────────

export interface IntlMatch {
  season: number;
  competition: string;
  opponent: string;
  /** Your nation's score, theirs. */
  us: number;
  them: number;
  goals: number;
  assists: number;
  rating: number;
}

export interface InternationalRecord {
  /** Windows already decided, as "season:index". */
  decided: string[];
  callUps: number;
  snubs: number;
  /** The last window's answer, whichever way it went. */
  last?: { season: number; window: number; called: boolean; opponent: string; competition: string };
  /** Newest first, the last 12. */
  matches: IntlMatch[];
}

export function emptyRecord(): InternationalRecord {
  return { decided: [], callUps: 0, snubs: 0, matches: [] };
}

// ── The decision ────────────────────────────────────────────────────────────

/** Average of the last five match ratings; 6.5 for a career with none yet. */
function recentForm(career: Pick<CareerState, "form">): number {
  const f = career.form ?? [];
  return f.length ? f.reduce((s, r) => s + r, 0) / f.length : 6.5;
}

/**
 * The chance of being picked, 0-1. Pure arithmetic on the three things a
 * national manager looks at: how good you are, how you're playing, and
 * whether he picked you last time.
 */
export function callUpChance(
  career: Pick<CareerState, "starRating" | "form" | "injury" | "international"> & { player: { nationality: string } },
): number {
  if (career.injury) return 0;
  const nation = career.player.nationality || "England";
  const overall = displayOverall(career.starRating ?? 2.5);
  const wasIn = career.international?.last?.called ? 0.8 : 0;
  const logit = (overall - callUpBar(nation)) / 3.5 + (recentForm(career) - 6.8) * 0.9 + wasIn;
  return Math.max(0.02, Math.min(0.97, 1 / (1 + Math.exp(-logit))));
}

export interface CallUpDecision {
  season: number;
  window: number;
  monthName: string;
  called: boolean;
  chance: number;
  nation: string;
  /** The window's one match, whether or not you are in it. */
  fixture: Fixture;
  /** One plain line for the screen. */
  reason: string;
}

function competitionFor(season: number, window: number, nation: string): Competition {
  if (window === 3) return "International Friendly";
  const next = tournamentFor(season) ?? tournamentFor(season + 1);
  if (next === "European Championship" && EUROPEAN.has(nation)) return "Euro Qualifier";
  return "World Cup Qualifier";
}

/** Window `i`'s decision. Seeded: the same save always gets the same answer. */
export function decideCallUp(career: CareerState, i: number): CallUpDecision {
  const nation = nationOf(career);
  const seed = clubNameSeed(`intl|${career.player.firstName} ${career.player.lastName}|${career.season}|${i}`);
  const rng = mulberry32(seed);
  const chance = callUpChance(career);
  const called = rng() < chance;
  const pool = OPPONENTS.filter(n => n !== nation);
  const opponent = pool[Math.floor(rng() * pool.length)];
  const competition = competitionFor(career.season, i, nation);
  const fixture: Fixture = {
    week: windowWeek(divisionOf(career), i),
    opponent,
    home: rng() < 0.5,
    played: false,
    competition,
    kind: "international",
    opponentStrength: nationStrength(opponent),
  };
  const overall = displayOverall(career.starRating ?? 2.5);
  const bar = callUpBar(nation);
  const reason = career.injury ? "You're injured, so the manager leaves you out."
    : called ? (overall >= bar ? "Your level earned it." : "Your form forced his hand.")
    : overall < bar - 6 ? `${nation} have better players in your position for now.`
    : "Close, but not this time. Keep playing well.";
  return { season: career.season, window: i, monthName: INTL_WINDOW_NAMES[i], called, chance, nation, fixture, reason };
}

/**
 * The window that has come round and not been decided yet: its Wednesday is
 * before the next match on your calendar. If a Dev Skip jumped past several,
 * the latest is the one shown; `applyCallUp` marks the older ones passed.
 */
export function windowDue(career: CareerState): number | null {
  if (!career.player?.club || !career.fixtures?.length) return null;
  if (career.fixtures.some(f => !f.played && f.kind === "international" && !f.round)) return null;
  const next = nextFixtureFor(career);
  if (!next) return null;
  const division = divisionOf(career);
  const nextT = fixtureTimestamp(career.player.startYear, career.season, next.week, next.kind, division);
  const decided = new Set(career.international?.decided ?? []);
  let due: number | null = null;
  for (let i = 0; i < windowWeekends(division).length; i++) {
    if (decided.has(`${career.season}:${i}`)) continue;
    const t = fixtureTimestamp(career.player.startYear, career.season, windowWeek(division, i), "international", division);
    if (t < nextT) due = i;
  }
  return due;
}

/** Write the decision into the career: mark the window, and if picked, put the match on the calendar. */
export function applyCallUp(career: CareerState, d: CallUpDecision): CareerState {
  const rec = career.international ?? emptyRecord();
  const decided = new Set(rec.decided);
  for (let i = 0; i <= d.window; i++) decided.add(`${d.season}:${i}`);
  const next: InternationalRecord = {
    ...rec,
    decided: Array.from(decided).filter(k => Number(k.split(":")[0]) >= d.season - 1),
    callUps: rec.callUps + (d.called ? 1 : 0),
    snubs: rec.snubs + (d.called ? 0 : 1),
    last: { season: d.season, window: d.window, called: d.called, opponent: d.fixture.opponent, competition: d.fixture.competition ?? "" },
  };
  return {
    ...career,
    international: next,
    fixtures: d.called ? [...career.fixtures, d.fixture] : career.fixtures,
  };
}

/** One international into the record (creditMatchResult calls this once per match). */
export function recordIntlMatch(
  rec: InternationalRecord | undefined, season: number, fixture: Fixture, stats: MatchStats,
): InternationalRecord {
  const base = rec ?? emptyRecord();
  const m: IntlMatch = {
    season, competition: fixture.round ? `${fixture.competition} · ${fixture.round}` : fixture.competition ?? "International",
    opponent: fixture.opponent, us: stats.homeScore, them: stats.awayScore,
    goals: stats.goals, assists: stats.assists, rating: stats.rating,
  };
  return { ...base, matches: [m, ...base.matches].slice(0, 12) };
}

// ── The national squad ──────────────────────────────────────────────────────

const SLOTS: SquadPlayer["position"][] = [
  "GK", "GK", "CB", "CB", "CB", "LB", "RB", "CDM", "CM", "CM", "CM",
  "CAM", "LW", "RW", "ST", "ST", "LB", "RB", "LW", "RW",
];

function fromLeague(p: LeaguePlayer, nation: string): SquadPlayer {
  return {
    id: `intl_${p.id}`, name: p.name, shortName: p.name.split(" ").slice(-1)[0],
    position: p.position, seasonGoals: 0, seasonAssists: 0, careerGoals: 0, careerAssists: 0,
    overall: p.overall, imageUrl: p.image, nationality: nation, age: p.age, positions: p.positions,
  } as SquadPlayer;
}

/**
 * Your nation's squad: the best real players of your nationality the save
 * knows about (your own club, your division, the wider world), one per slot
 * by position, then made-up players for any slot left empty. You are not in
 * it — the match puts you on the pitch itself.
 */
export function nationalSquad(career: CareerState): { players: SquadPlayer[]; real: number } {
  const nation = nationOf(career);
  const youName = `${career.player.firstName} ${career.player.lastName}`;
  const pool = new Map<string, SquadPlayer>();
  for (const p of career.squad ?? []) {
    if (p.nationality !== nation || p.name === youName) continue;
    pool.set(p.name, { ...p, id: `intl_${p.id}`, seasonGoals: 0, seasonAssists: 0, careerGoals: 0, careerAssists: 0 });
  }
  for (const sq of [...(career.leagueSquads ?? []), ...(career.externalSquads ?? [])]) {
    for (const p of sq.players) {
      if (p.nation !== nation || p.name === youName || pool.has(p.name)) continue;
      pool.set(p.name, fromLeague(p, nation));
    }
  }
  const sorted = Array.from(pool.values()).sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0));
  const used = new Set<string>();
  const filler = generateSquad(clubNameSeed(`nation|${nation}`));
  const strength = nationStrength(nation);
  const out: SquadPlayer[] = [];
  let real = 0;
  SLOTS.forEach((pos, i) => {
    const pick = sorted.find(p => !used.has(p.name) && (p.position === pos || p.positions?.includes(pos)));
    if (pick) { used.add(pick.name); out.push(pick); real++; return; }
    const g = filler[i % filler.length];
    const id = `intl_gen_${i}`;
    out.push({
      ...g, id, position: pos, nationality: nation,
      overall: Math.max(40, Math.min(92, strength - 6 + ((i * 7) % 9) - 4)),
      imageUrl: fakeFaceFor(`${nation}:${id}`),
    });
  });
  return { players: out, real };
}

/**
 * The career the match engine is handed for an international: the same
 * career, but your side is the nation — its name, its squad, its strength and
 * colours. Like the farewell match's stand-in (farewell.ts), it is only what
 * the pitch shows; the result is credited against the real career.
 */
export function internationalCareer(career: CareerState, fixture: Fixture): CareerState {
  const nation = nationOf(career);
  const { players } = nationalSquad(career);
  const table = (name: string, strength: number) => ({
    name, strength, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0,
  });
  return {
    ...career,
    player: { ...career.player, club: nation },
    thisSeasonClub: nation,
    squad: players,
    league: [table(nation, nationStrength(nation)), table(fixture.opponent, fixture.opponentStrength ?? nationStrength(fixture.opponent))],
    leagueSquads: [],
    externalSquads: [],
    ownedClubs: {},
    clubKits: { ...(career.clubKits ?? {}), [nation]: nationKits(nation), [fixture.opponent]: nationKits(fixture.opponent) },
    playAs: null,
  };
}
