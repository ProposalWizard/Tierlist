/**
 * THE FAREWELL MATCH — one last game after the final whistle of a career.
 *
 * Leo, 6 Oct 2026 (the plans page, "Farewell match"): "Your farewell match.
 * [Club] want to say goodbye." Play it or skip it.
 *   - Your XI: your best team-mates from every club — top scorers, top
 *     creators, the ones you played with longest.
 *   - Rivals XI: players from the clubs that beat you to titles, and the
 *     players who beat you to Ballon d'Ors.
 *   - The real match (CanvasMatch with `farewell`): every chance is yours, no
 *     energy, no injuries. You come off at 85' to a standing ovation.
 *   - It counts in nothing: no stats, no records. Once per career.
 *
 * Pure. The match itself is played by the real engine on a STAND-IN career
 * (farewellCareer): your two sides become a two-club world — Your XI's squad,
 * the Rivals XI as a scouted squad, both line-ups saved — so the team sheets,
 * the casting and the commentary all work exactly as they do every week,
 * without a line of match code knowing anything about farewells. The real
 * career is never touched until the result is written (farewellRecordFrom).
 *
 * Who plays comes from the season history: each season keeps its best
 * team-mates (SeasonMate, saved from 6 Oct 2026). A career from before that
 * falls back to the squads the game still holds for your old clubs.
 */
import type {
  CareerState, FarewellRecord, Fixture, LeaguePlayer, LeagueSquad, LeagueTeam,
  MatchStats, SeasonHistoryRow, SquadPlayer,
} from "./types";
import type { SavedLineup } from "./lineupStore";
import type { SetPieceDuties } from "./setPieces";
import { autoPick, bestFitness, formationOf, type Pickable, type Role } from "./formations";
import { kitsOf, type ClubKits } from "./kits";
import { generateSquad, clubNameSeed } from "./squadData";
import { shortNameOf } from "./realSquad";
import { displayOverall } from "./rating";

/** The minute you come off to the ovation. */
export const FAREWELL_OFF_AT = 85;
/** The other side. */
export const RIVALS_XI = "Rivals XI";
/** Both sides line up 4-3-3: everyone knows the shape. */
export const FAREWELL_FORMATION = "433";
/** The Rivals XI wear black and gold (and white if that clashes). */
export const RIVALS_KITS: ClubKits = {
  home: { shirt: "#111827", trim: "#FBBF24" },
  away: { shirt: "#F8FAFC", trim: "#111827" },
};

/** What a side needs to be a side: [positions, how many]. */
const GROUPS = {
  gk: ["GK"] as Role[],
  def: ["CB", "LB", "RB"] as Role[],
  mid: ["CDM", "CM", "CAM"] as Role[],
  fwd: ["ST", "LW", "RW"] as Role[],
};
const COVER_RIVALS: [Role[], number][] = [[GROUPS.gk, 2], [GROUPS.def, 6], [GROUPS.mid, 4], [GROUPS.fwd, 3]];
const COVER_OURS: [Role[], number][] = [[GROUPS.gk, 2], [GROUPS.def, 5], [GROUPS.mid, 4], [GROUPS.fwd, 2]];
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const longSeason = (startYear: number, season: number) => {
  const y = startYear + season - 1;
  return `${y}/${String(y + 1).slice(2)}`;
};

/** "Calloway XI". */
export function farewellTeamName(career: Pick<CareerState, "player">): string {
  const last = (career.player.lastName || career.player.firstName || "Your").trim();
  return `${last} XI`;
}

// ── Your XI ────────────────────────────────────────────────────────────────

/** A team-mate, over the whole career. */
export interface FarewellMate {
  key: string;
  name: string;
  position: Role;
  positions?: Role[];
  overall: number;
  face?: string;
  nation?: string;
  /** For your clubs, over every season together. */
  goals: number;
  assists: number;
  /** Seasons together (the seasons he was one of the season's best). */
  seasons: number;
  /** The clubs you played together at, first one first. */
  clubs: string[];
}

/** The same man across seasons: a real footballer by his id, anyone else by club + name. */
function mateKey(id: string, club: string, name: string): string {
  if (id.startsWith("sf_")) return id;
  if (/^\d+$/.test(id)) return `sf_${id}`;
  return `${club}::${norm(name)}`;
}

/** Every squad the game holds, by club. */
function squadsByClub(career: CareerState): Map<string, LeaguePlayer[]> {
  const out = new Map<string, LeaguePlayer[]>();
  for (const s of [...(career.leagueSquads ?? []), ...(career.externalSquads ?? [])]) {
    if (s?.club && Array.isArray(s.players) && !out.has(s.club)) out.set(s.club, s.players);
  }
  return out;
}

const historyRows = (career: CareerState): SeasonHistoryRow[] =>
  [...(career.seasonHistory ?? [])].sort((a, b) => a.season - b.season);

/** The clubs of the career, first one first (history, then the archive, then now). */
export function careerClubs(career: CareerState): string[] {
  const seen: string[] = [];
  const add = (c?: string) => { if (c && !seen.includes(c)) seen.push(c); };
  for (const r of historyRows(career)) add(r.club);
  for (const r of [...(career.seasonArchive ?? [])].sort((a, b) => a.season - b.season)) add(r.club);
  add(career.thisSeasonClub);
  add(career.player.club);
  return seen;
}

/**
 * Everyone you played with who earned a place in a season's best, merged
 * across seasons. Thin careers (before 6 Oct 2026, or very short) are topped
 * up from the squads the game still holds for your clubs, then your last
 * club's own squad.
 */
export function yourMatesPool(career: CareerState): FarewellMate[] {
  const me = norm(`${career.player.firstName} ${career.player.lastName}`);
  const byKey = new Map<string, FarewellMate>();
  const add = (
    p: { id: string; name: string; position: Role; positions?: Role[]; overall?: number; face?: string; nation?: string },
    club: string, goals: number, assists: number, seasons: number,
  ) => {
    if (!p?.name || norm(p.name) === me) return;
    const key = mateKey(p.id, club, p.name);
    const was = byKey.get(key);
    if (was) {
      was.goals += goals;
      was.assists += assists;
      was.seasons += seasons;
      if ((p.overall ?? 0) > was.overall) was.overall = p.overall ?? was.overall;
      if (p.face) was.face = p.face;
      if (!was.clubs.includes(club)) was.clubs.push(club);
      return;
    }
    byKey.set(key, {
      key, name: p.name, position: p.position, ...(p.positions ? { positions: p.positions } : {}),
      overall: p.overall ?? 64, ...(p.face ? { face: p.face } : {}), ...(p.nation ? { nation: p.nation } : {}),
      goals, assists, seasons, clubs: [club],
    });
  };

  // 1. The seasons' best team-mates (step 0).
  for (const r of historyRows(career)) {
    for (const m of r.mates ?? []) add(m, r.club, m.goals ?? 0, m.assists ?? 0, 1);
  }

  // 2. Too few for two sides' worth: the squads still held for your clubs.
  if (byKey.size < 16) {
    const squads = squadsByClub(career);
    const seasonsAt = new Map<string, number>();
    for (const r of historyRows(career)) seasonsAt.set(r.club, (seasonsAt.get(r.club) ?? 0) + 1);
    for (const club of careerClubs(career)) {
      const players = squads.get(club);
      if (!players) continue;
      const best = [...players].sort((a, b) => b.overall - a.overall).slice(0, 6);
      for (const p of best) {
        add({ id: p.id, name: p.name, position: p.position, positions: p.positions, overall: p.overall, face: p.image, nation: p.nation },
          club, 0, 0, Math.max(1, seasonsAt.get(club) ?? 1));
      }
    }
  }

  // 3. And your last club's own dressing room.
  if (byKey.size < 16) {
    for (const p of career.squad ?? []) {
      add({ id: p.id, name: p.name, position: p.position, positions: p.positions, overall: p.overall, face: p.imageUrl, nation: p.nationality },
        career.player.club, p.seasonGoals ?? 0, p.seasonAssists ?? 0, 1);
    }
  }

  // 4. A real side's worth of each position, from your clubs' squads.
  const pool = () => Array.from(byKey.values());
  const squads = squadsByClub(career);
  for (const [roles, n] of COVER_OURS) {
    let have = pool().filter(m => roles.includes(m.position)).length;
    for (const club of [...careerClubs(career)].reverse()) {
      if (have >= n) break;
      const players = club === career.player.club && !(squads.get(club)?.length)
        ? (career.squad ?? []).map(p => ({ id: p.id, name: p.name, position: p.position, positions: p.positions, overall: p.overall ?? 64, image: p.imageUrl, nation: p.nationality }))
        : (squads.get(club) ?? []).map(p => ({ id: p.id, name: p.name, position: p.position, positions: p.positions, overall: p.overall, image: p.image, nation: p.nation }));
      for (const p of players.filter(x => roles.includes(x.position)).sort((a, b) => b.overall - a.overall)) {
        if (have >= n) break;
        const before = byKey.size;
        add({ id: p.id, name: p.name, position: p.position, positions: p.positions, overall: p.overall, face: p.image, nation: p.nation }, club, 0, 0, 1);
        if (byKey.size > before) have++;
      }
    }
  }

  // 5. Nobody at all (a career with no squads held): made-up team-mates, so
  //    the match can still be played. Never needed by a real career.
  if (byKey.size < 11) {
    for (const p of generateSquad(clubNameSeed(`${career.player.club}-farewell`))) {
      add({ id: p.id, name: p.name, position: p.position, face: p.imageUrl }, career.player.club, 0, 0, 1);
    }
  }
  return Array.from(byKey.values());
}

/** How much a team-mate deserves a shirt: how good, how long together, what he did. */
export function mateWorth(m: FarewellMate): number {
  return m.overall + m.seasons * 2.5 + Math.min(12, (m.goals + m.assists) * 0.2);
}

// ── Rivals XI ──────────────────────────────────────────────────────────────

export interface FarewellRival {
  id: string;
  name: string;
  position: Role;
  positions?: Role[];
  overall: number;
  face?: string;
  nation?: string;
  defending?: number;
  /** His club now. */
  club: string;
  /** Why he is here: "Ballon d'Or 2031/32", "Won the league 3×". */
  why: string;
  /** Beat you to a Ballon d'Or (always starts). */
  ballonDor?: boolean;
}

/** Points for a title someone else won: a league or the Champions League counts most. */
const TITLE_WEIGHT: Record<keyof SeasonHistoryRow["winners"], number> = {
  league: 3, championsLeague: 3, europaLeague: 2, faCup: 2, leagueCup: 1,
};
const TITLE_WORD: Record<keyof SeasonHistoryRow["winners"], string> = {
  league: "the league", championsLeague: "the Champions League", europaLeague: "the Europa League",
  faCup: "the FA Cup", leagueCup: "the League Cup",
};

/** The clubs that beat you to titles, most first, with what they won. */
export function titleRivals(career: CareerState): { club: string; weight: number; why: string }[] {
  const mine = new Set(careerClubs(career));
  const by = new Map<string, { weight: number; wins: Map<string, number> }>();
  for (const r of historyRows(career)) {
    for (const k of Object.keys(TITLE_WEIGHT) as (keyof SeasonHistoryRow["winners"])[]) {
      const w = r.winners?.[k];
      // Won by your own club that season: not a rival's title.
      if (!w || w === r.club) continue;
      const e = by.get(w) ?? { weight: 0, wins: new Map() };
      e.weight += TITLE_WEIGHT[k];
      e.wins.set(k, (e.wins.get(k) ?? 0) + 1);
      by.set(w, e);
    }
  }
  const word = (wins: Map<string, number>) => {
    const [k, times] = Array.from(wins.entries())
      .sort((a, b) => TITLE_WEIGHT[b[0] as keyof typeof TITLE_WEIGHT] * b[1] - TITLE_WEIGHT[a[0] as keyof typeof TITLE_WEIGHT] * a[1])[0];
    return `Won ${TITLE_WORD[k as keyof typeof TITLE_WORD]}${times > 1 ? ` ${times}×` : ""}`;
  };
  return Array.from(by.entries())
    .map(([club, e]) => ({ club, weight: e.weight, why: word(e.wins) }))
    // A club you also played for is a rival too, but your best team-mates
    // from it are already on your side: it ranks behind the others.
    .sort((a, b) => Number(mine.has(a.club)) - Number(mine.has(b.club)) || b.weight - a.weight || a.club.localeCompare(b.club));
}

/** Everyone who beat you to a Ballon d'Or, most wins first. */
export function ballonDorRivals(career: CareerState): { name: string; club: string; seasons: number[] }[] {
  const me = norm(`${career.player.firstName} ${career.player.lastName}`);
  const by = new Map<string, { name: string; club: string; seasons: number[] }>();
  for (const r of historyRows(career)) {
    const b = r.ballonDor;
    if (!b?.winner || b.yourRank === 1 || norm(b.winner) === me) continue;
    const k = norm(b.winner);
    const e = by.get(k) ?? { name: b.winner, club: b.club, seasons: [] };
    e.seasons.push(r.season);
    e.club = b.club;
    by.set(k, e);
  }
  return Array.from(by.values()).sort((a, b) => b.seasons.length - a.seasons.length || a.seasons[0] - b.seasons[0]);
}

/** The Rivals XI's pool: Ballon d'Or winners, then the title clubs' best, then the strongest clubs. */
export function rivalsPool(career: CareerState, notThese: Set<string>): FarewellRival[] {
  const squads = squadsByClub(career);
  const startYear = career.player.startYear ?? 2025;
  const out: FarewellRival[] = [];
  const used = new Set<string>(notThese);
  const take = (p: LeaguePlayer | null, club: string, why: string, ballonDor = false, fallbackName?: string) => {
    const name = p?.name ?? fallbackName;
    if (!name) return;
    const k = norm(name);
    if (used.has(k)) return;
    used.add(k);
    out.push({
      id: `rv_${out.length}`,
      name,
      position: p?.position ?? "ST",
      ...(p?.positions ? { positions: p.positions } : {}),
      overall: p?.overall ?? 88,
      ...(p?.image ? { face: p.image } : {}),
      ...(p?.nation ? { nation: p.nation } : {}),
      ...(typeof p?.defending === "number" ? { defending: p.defending } : {}),
      club,
      why,
      ...(ballonDor ? { ballonDor: true } : {}),
    });
  };
  const findByName = (name: string, club: string): { p: LeaguePlayer; club: string } | null => {
    const k = norm(name);
    const at = squads.get(club)?.find(p => norm(p.name) === k);
    if (at) return { p: at, club };
    for (const [c, players] of Array.from(squads.entries())) {
      const hit = players.find(p => norm(p.name) === k);
      if (hit) return { p: hit, club: c };
    }
    return null;
  };

  // 1. The men who beat you to a Ballon d'Or.
  for (const b of ballonDorRivals(career)) {
    const hit = findByName(b.name, b.club);
    const when = b.seasons.length > 1 ? `Ballon d'Or ×${b.seasons.length}` : `Ballon d'Or ${longSeason(startYear, b.seasons[0])}`;
    take(hit?.p ?? null, hit?.club ?? b.club, when, true, b.name);
  }
  // 2. The clubs that beat you to titles: their best men.
  for (const r of titleRivals(career)) {
    if (out.length >= 22) break;
    const players = squads.get(r.club);
    if (!players) continue;
    for (const p of [...players].sort((a, b) => b.overall - a.overall).slice(0, 6)) take(p, r.club, r.why);
  }
  // 3. Too few (a short career, or one before the history): the strongest clubs around.
  if (out.length < 16) {
    const mine = new Set(careerClubs(career));
    const strongest = [...(career.league ?? [])]
      .filter(t => !mine.has(t.name))
      .sort((a, b) => b.strength - a.strength)
      .map(t => t.name);
    const others = Array.from(squads.keys()).filter(c => !mine.has(c) && !strongest.includes(c));
    for (const club of [...strongest, ...others]) {
      if (out.length >= 18) break;
      const players = squads.get(club);
      if (!players) continue;
      for (const p of [...players].sort((a, b) => b.overall - a.overall).slice(0, 4)) take(p, club, "One of the best around");
    }
  }
  // 4. A real side: keepers, defenders, midfielders and forwards — from the
  //    clubs already in it first, then from anyone's.
  const clubOrder = Array.from(new Set([...out.map(r => r.club), ...Array.from(squads.keys())]));
  for (const [roles, n] of COVER_RIVALS) {
    let have = out.filter(r => roles.includes(r.position)).length;
    for (const club of clubOrder) {
      if (have >= n) break;
      const players = squads.get(club);
      if (!players) continue;
      const why = out.find(r => r.club === club && !r.ballonDor)?.why ?? "One of the best around";
      for (const p of players.filter(x => roles.includes(x.position)).sort((a, b) => b.overall - a.overall)) {
        if (have >= n) break;
        const before = out.length;
        take(p, club, why);
        if (out.length > before) have++;
      }
    }
  }
  // 5. Still too few: made-up rivals, so there is a match to play.
  if (out.length < 11) {
    for (const p of generateSquad(clubNameSeed(`${career.player.club}-rivals`))) {
      take({ id: p.id, name: p.name, position: p.position, overall: 74, goals: 0, assists: 0, image: p.imageUrl }, RIVALS_XI, "A rival");
    }
  }
  return out;
}

// ── Both sides ─────────────────────────────────────────────────────────────

export interface FarewellSide {
  name: string;
  /** The saved line-up (formation, eleven ids, bench ids). */
  lineup: SavedLineup;
  /** Average rating of the eleven. */
  strength: number;
}

export interface FarewellSides {
  /** The club that puts it on: your last club. */
  host: string;
  ours: FarewellSide & { players: SquadPlayer[]; mates: FarewellMate[] };
  rivals: FarewellSide & { players: LeaguePlayer[]; who: FarewellRival[] };
}

/** "you" in a saved line-up is YOU (matchdayFor's own id for you). */
export const YOU_ID = "you";

/** The formation your farewell is played in: one with a slot that is yours. */
export function farewellFormationFor(position: Role): string {
  if (position === "CAM") return "433(5)";
  if (position === "CDM") return "433(2)";
  return FAREWELL_FORMATION;
}

/**
 * Eleven from a pool, best first by `pickScore` (autoPick: the right man in
 * the right slot). `you`, when given, takes your own slot first — never a
 * team-mate's. `must` (the men who beat you to a Ballon d'Or) are placed
 * next, each in the free slot that fits him best, so two strikers or three
 * attacking midfielders still all start.
 */
function pickXI(
  pool: (Pickable & { pickScore: number })[], formationId: string,
  you?: { id: string; role: Role; positions?: Role[] }, must: string[] = [], bench = 7,
): { xi: (string | null)[]; bench: string[] } {
  const formation = formationOf(formationId);
  const fixed = new Map<number, string>();
  if (you) {
    let youAt = formation.slots.findIndex(sl => sl.role === you.role);
    if (youAt < 0) {
      let best = -1;
      formation.slots.forEach((sl, i) => {
        const f = bestFitness(sl.role, { id: you.id, name: "you", position: you.role, positions: you.positions });
        if (sl.role !== "GK" && f > best) { best = f; youAt = i; }
      });
    }
    if (youAt >= 0) fixed.set(youAt, you.id);
  }
  for (const id of must) {
    const p = pool.find(x => x.id === id);
    if (!p || fixed.size >= formation.slots.length) continue;
    let at = -1, best = 0;
    formation.slots.forEach((sl, i) => {
      if (fixed.has(i)) return;
      const f = bestFitness(sl.role, p);
      if (f > best) { best = f; at = i; }
    });
    if (at >= 0) fixed.set(at, id);
  }
  const placed = new Set(fixed.values());
  const others = pool.filter(p => p.id !== you?.id && !placed.has(p.id));
  const restIdx = formation.slots.map((_, i) => i).filter(i => !fixed.has(i));
  const rest = { ...formation, slots: restIdx.map(i => formation.slots[i]) };
  const picks = autoPick(others.map(p => ({ ...p, overall: p.pickScore })), rest);
  const xi: (string | null)[] = formation.slots.map(() => null);
  fixed.forEach((id, i) => { xi[i] = id; });
  restIdx.forEach((i, k) => { xi[i] = picks[k] ?? null; });
  const inXI = new Set(xi.filter((id): id is string => !!id));
  const left = pool.filter(p => p.id !== you?.id && !inXI.has(p.id)).sort((a, b) => b.pickScore - a.pickScore);
  // A keeper on the bench when there is one.
  const gk = left.find(p => p.position === "GK");
  const benchIds = [...(gk ? [gk.id] : []), ...left.filter(p => p !== gk).map(p => p.id)].slice(0, bench);
  return { xi, bench: benchIds };
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 70);

/** The two sides, from the career as it ends. Deterministic: the same career gives the same sides. */
export function farewellSides(career: CareerState): FarewellSides {
  const host = career.player.club;
  const ourName = farewellTeamName(career);
  const youPos = ((career.player.position as Role) || "ST");
  const youOverall = displayOverall(career.starRating ?? 2.5);

  // Your XI: you, then the team-mates who deserve it most.
  const mates = yourMatesPool(career).sort((a, b) => mateWorth(b) - mateWorth(a));
  const ourPlayers: SquadPlayer[] = mates.map((m, i) => ({
    id: `fw_${i}`,
    name: m.name,
    shortName: shortNameOf(m.name),
    position: m.position,
    ...(m.positions ? { positions: m.positions } : {}),
    seasonGoals: 0, seasonAssists: 0, careerGoals: m.goals, careerAssists: m.assists,
    overall: m.overall,
    ...(m.face ? { imageUrl: m.face } : {}),
    ...(m.nation ? { nationality: m.nation } : {}),
  }));
  const ourFormation = farewellFormationFor(youPos);
  const ourPick = pickXI(
    ourPlayers.map((p, i) => ({ id: p.id, name: p.name, position: p.position, positions: p.positions, overall: p.overall, pickScore: mateWorth(mates[i]) })),
    ourFormation,
    // You take your own slot first.
    { id: YOU_ID, role: youPos },
  );
  const ourXIRatings = ourPick.xi.map(id => (id === YOU_ID ? youOverall : ourPlayers.find(p => p.id === id)?.overall)).filter((v): v is number => typeof v === "number");
  // The squad is the eleven and the bench: nobody else could come on.
  const ourIds = new Set([...ourPick.xi, ...ourPick.bench].filter((id): id is string => !!id));
  const ourSquad = ourPlayers.filter(p => ourIds.has(p.id));

  // Rivals XI: nobody already on your side.
  const ours = new Set(mates.map(m => norm(m.name)));
  ours.add(norm(`${career.player.firstName} ${career.player.lastName}`));
  const who = rivalsPool(career, ours);
  const rivalPlayers: LeaguePlayer[] = who.map(r => ({
    id: r.id, name: r.name, position: r.position, overall: r.overall, goals: 0, assists: 0,
    ...(r.positions ? { positions: r.positions } : {}),
    ...(r.face ? { image: r.face } : {}),
    ...(r.nation ? { nation: r.nation } : {}),
    ...(typeof r.defending === "number" ? { defending: r.defending } : {}),
  }));
  const rivalPick = pickXI(who.map(r => ({
    id: r.id, name: r.name, position: r.position, positions: r.positions, overall: r.overall,
    pickScore: r.overall + (r.ballonDor ? 40 : 0),
  })), FAREWELL_FORMATION, undefined,
  // Every man who beat you to a Ballon d'Or starts (most wins first; ten at most, a keeper stays).
  who.filter(r => r.ballonDor).slice(0, 10).map(r => r.id));
  const rivalIds = new Set([...rivalPick.xi, ...rivalPick.bench].filter((id): id is string => !!id));

  const ourStrength = Math.round(avg(ourXIRatings));
  const rawRivals = avg(rivalPick.xi.map(id => who.find(r => r.id === id)?.overall).filter((v): v is number => typeof v === "number"));
  // Close enough to be a game: the rivals within six of your side either way.
  const rivalStrength = Math.round(Math.max(ourStrength - 6, Math.min(ourStrength + 6, rawRivals)));

  return {
    host,
    ours: {
      name: ourName,
      lineup: { formation: ourFormation, xi: ourPick.xi, bench: ourPick.bench },
      strength: ourStrength,
      players: ourSquad,
      mates: mates.filter((_, i) => ourIds.has(`fw_${i}`)),
    },
    rivals: {
      name: RIVALS_XI,
      lineup: { formation: FAREWELL_FORMATION, xi: rivalPick.xi, bench: rivalPick.bench },
      strength: rivalStrength,
      players: rivalPlayers.filter(p => rivalIds.has(p.id)),
      who: who.filter(r => rivalIds.has(r.id)),
    },
  };
}

// ── The stand-in career the real match is played on ────────────────────────

const table = (name: string, strength: number): LeagueTeam => ({
  name, strength, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0,
});

/** The match: at your last club's ground, a draw stays a draw (no extra time). */
export function farewellFixture(career: CareerState, sides: FarewellSides): Fixture {
  return {
    week: career.week ?? 1,
    opponent: sides.rivals.name,
    home: true,
    played: false,
    kind: "league",
    opponentStrength: sides.rivals.strength,
  };
}

/**
 * The career the real match is played on: your two sides as a two-club world.
 * A copy — nothing here is ever saved.
 */
export function farewellCareer(career: CareerState, sides: FarewellSides): CareerState {
  const ours = sides.ours.name;
  const fixture = farewellFixture(career, sides);
  const rivalsSquad: LeagueSquad = { club: sides.rivals.name, players: sides.rivals.players };
  return {
    ...career,
    player: { ...career.player, club: ours },
    thisSeasonClub: ours,
    squad: sides.ours.players,
    league: [table(ours, sides.ours.strength), table(sides.rivals.name, sides.rivals.strength)],
    leagueSquads: [],
    externalSquads: [rivalsSquad],
    freeAgents: [],
    ownedLineups: { [ours]: sides.ours.lineup, [sides.rivals.name]: sides.rivals.lineup },
    ownedClubs: {},
    // Your club's colours; the rivals in black and gold.
    clubKits: { [ours]: career.clubKits?.[sides.host] ?? kitsOf(sides.host), [sides.rivals.name]: RIVALS_KITS },
    // No energy and no injuries: fresh legs, and a whole ground on your side.
    energy: 100,
    injury: null,
    relationships: { ...career.relationships, team: 100, fans: 100 },
    fixtures: [fixture],
    playAs: null,
  };
}

/** Every set piece is yours. */
export function farewellDuties(): SetPieceDuties {
  return { freeKicks: true, penalties: true, freeKickNeeded: 0, penaltyNeeded: 0, penaltyStanding: 0, penaltyStarWeight: 0 };
}

/** What the career keeps of it: one line on the overview and the card. */
export function farewellRecordFrom(stats: MatchStats, sides: FarewellSides): FarewellRecord {
  return {
    played: true,
    club: sides.host,
    team: sides.ours.name,
    opponent: sides.rivals.name,
    // homeScore/awayScore are YOUR side's and the other side's (matchStats.ts).
    yourScore: stats.homeScore,
    theirScore: stats.awayScore,
    goals: stats.goals,
    assists: stats.assists,
    ...(typeof stats.rating === "number" ? { rating: Math.round(stats.rating * 10) / 10 } : {}),
    offAt: FAREWELL_OFF_AT,
  };
}

/** Turned down: kept, so the game knows it was offered once. */
export function farewellSkipped(career: CareerState): FarewellRecord {
  return { played: false, club: career.player.club, team: farewellTeamName(career), opponent: RIVALS_XI };
}
