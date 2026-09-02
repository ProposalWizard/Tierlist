import type { LeaguePlayer, LeagueSquad, LeagueTeam, SquadPlayer } from "./types";
import { generateSquad, clubNameSeed } from "./squadData";
import { shortNameOf } from "./realSquad";
import { STAR_FIFA_YEAR, SQUAD_FETCH_INIT } from "./edition";

/**
 * THE OTHER NINETEEN DRESSING ROOMS.
 *
 * Your own club's squad lives on `career.squad` and is a full `SquadPlayer` —
 * it has to be, because those men appear on the pitch, get named in commentary
 * and carry career totals. Nobody else's does. The rest of the division only
 * ever needs to answer one question — "who scored?" — so it is stored as thin as
 * that question allows: an id, a name, a position, a rating, and this season's
 * two numbers.
 *
 * Measured: twenty squads stored this way are 15.6 KB. Stored as full
 * `SquadPlayer`s, with image URLs and nationalities, they are 105 KB. Neither
 * threatens a 5 MB budget, but the thin one leaves the room for the things that
 * come after — transfers, matchups, a squad you can actually look at.
 */

type Pos = SquadPlayer["position"];

/**
 * How many of a club's players the CAREER keeps, and in what order.
 *
 * A matchday squad, not a wage bill: it exists to answer "who scored?" in
 * matches you are not in, and a club's twenty-fifth choice never will. Twenty
 * is therefore a CEILING and never a quota — a club with sixteen players fit
 * to fill these slots keeps sixteen. (It used to be topped up to twenty with
 * invented names; see buildLeagueSquad for why that is gone.)
 *
 * The squad builder asks for `keepAll` and gets the lot, because there the
 * question is different — you are picking a side, and a side is picked from
 * everybody.
 */
const POSITION_ORDER: Pos[] = [
  "GK", "CB", "CB", "RB", "LB", "CDM", "CM", "CM", "RW", "LW", "CAM", "ST",
  "GK", "CB", "CDM", "CM", "RW", "LW", "CAM", "ST",
];

/** SoFIFA writes positions as a list, and inconsistently. Split on non-letters. */
function positionsOf(raw: string): string[] {
  return (raw || "").split(/[^A-Za-z]+/).map(p => p.trim().toUpperCase()).filter(Boolean);
}

const NEIGHBOURS: Record<Pos, string[]> = {
  GK: [],
  CB: ["RB", "LB", "CDM"],
  RB: ["RM", "RWB", "CB", "RW"],
  LB: ["LM", "LWB", "CB", "LW"],
  CDM: ["CM", "CB"],
  CM: ["CDM", "CAM", "LM", "RM"],
  CAM: ["CM", "LW", "RW", "ST", "LM", "RM"],
  RW: ["RM", "LW", "ST", "CAM"],
  LW: ["LM", "RW", "ST", "CAM"],
  ST: ["CF", "LW", "RW", "CAM"],
};

/** Every position he's listed for that this game actually models. See
 *  realSquad.ts's identical helper — kept local rather than shared because
 *  the two files already duplicate positionsOf/fit/NEIGHBOURS this way. */
const VALID_ROLES = new Set<Pos>(["GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LW", "RW", "ST"]);
function rolesOf(raw: string): Pos[] {
  const out: Pos[] = [];
  for (const tok of positionsOf(raw)) {
    const role = tok as Pos;
    if (VALID_ROLES.has(role) && !out.includes(role)) out.push(role);
  }
  return out;
}

function fit(slot: Pos, positions: string): number {
  const ps = positionsOf(positions);
  if (ps.length === 0) return 0;
  if (slot === "GK") return ps[0] === "GK" ? 100 : 0;
  if (ps.includes("GK")) return 0;
  if (ps[0] === slot) return 100;
  if (ps.includes(slot)) return 82;
  const near = NEIGHBOURS[slot] ?? [];
  for (let i = 0; i < near.length; i++) if (ps.includes(near[i])) return 64 - i * 6;
  return 12;
}

/** What the endpoint gives back, of the parts we use. */
export interface RosterRow {
  id: string; name: string; positions: string; overall: number;
  image?: string; nation?: string; age?: number;
}

/**
 * Fill a shape from a roster.
 *
 * Greedy by SLOT rather than by player, the same way `realSquad.ts` does it and
 * for the same reason: taking the twenty best players and then assigning
 * positions gives you four centre-backs and no left-back.
 */
export function buildLeagueSquad(club: string, roster: RosterRow[], keepAll = false): LeagueSquad {
  // A club with zero rows is the same problem as a club with a few, just at
  // the far end of it — see the "thin club fields a short bench" note just
  // below, which already stopped a THIN real squad being padded out with
  // invented names. This used to reach for `generatedSquad` at exactly
  // zero, which is how a whole fake player — "Bernardo Clark", by name —
  // ended up posing as a real signing once the international transfer
  // window (leagueTransfers.ts's runInternationalWindow) started actually
  // trading players in and out of `externalSquads`: one European club this
  // career has no real rows for yet still got a full invented XI, silently
  // indistinguishable from its real neighbours, and one of them then moved
  // for real money to a club that does exist. An empty squad here is
  // honest — this club has no real players on record — and every consumer
  // already has to tolerate a club with FEW real players without crashing,
  // so tolerating one with none is the same handling at its limit, not new.
  if (!roster.length) return { club, players: [] };

  const taken = new Set<string>();
  const players: LeaguePlayer[] = [];

  for (const slot of POSITION_ORDER) {
    let best: RosterRow | null = null;
    let bestScore = -1;
    for (const p of roster) {
      if (taken.has(p.id)) continue;
      const f = fit(slot, p.positions);
      if (f <= 0) continue;
      const score = f * 100 + p.overall;
      if (score > bestScore) { bestScore = score; best = p; }
    }
    if (!best) continue;
    taken.add(best.id);
    players.push({
      id: best.id, name: best.name, position: slot,
      overall: best.overall || 65, goals: 0, assists: 0,
      ...(best.image ? { image: best.image } : {}),
      ...(best.nation ? { nation: best.nation } : {}),
      ...(best.age ? { age: best.age } : {}),
      positions: rolesOf(best.positions),
    });
  }

  // ── A thin club fields a short bench, not an invented one ──
  //
  // This used to top a club up to twenty from `generatedSquad`, whose names
  // are a random first name and a random surname drawn from two lists of real
  // footballers — so West Ham lined up with "Andres Modric" and "Vinicius
  // Muller" sitting among their actual squad. Reported as exactly that.
  //
  // Nothing needs twenty. Nine substitutes is a maximum a real team sheet is
  // allowed, never a quota it has to meet, and every consumer here reads the
  // array as "whoever this club has": `autoPick` fills the eleven it can,
  // `averageStartingXIRating` averages the first eleven, the bench is
  // `slice(0, 9)` of whatever is left. A club with sixteen real players now
  // shows sixteen real players.

  // ── …and everybody else, when the whole squad is wanted ──
  //
  // The shape above is filled first on purpose, so the twenty who would start
  // and sit are in a sensible order. What is left over is the rest of the
  // register — the fourth-choice keeper, the academy right-back — appended in
  // rating order and each in his own position rather than squeezed into a slot
  // the formation happened to have going spare.
  if (keepAll) {
    for (const p of roster) {
      if (taken.has(p.id)) continue;
      taken.add(p.id);
      players.push(rowToLeaguePlayer(p));
    }
  }
  return { club, players };
}

/** A row as a `LeaguePlayer`, in his own natural position — no formation slot
 *  assumed. Shared by `buildLeagueSquad`'s `keepAll` branch and
 *  `fetchFreeAgents`, neither of which is filling XI/bench order. */
function rowToLeaguePlayer(p: RosterRow): LeaguePlayer {
  return {
    id: p.id, name: p.name, position: naturalPosition(p.positions),
    overall: p.overall || 60, goals: 0, assists: 0,
    ...(p.image ? { image: p.image } : {}),
    ...(p.nation ? { nation: p.nation } : {}),
    ...(p.age ? { age: p.age } : {}),
    positions: rolesOf(p.positions),
  };
}

/** What he actually is, for a man the formation had no slot for. */
function naturalPosition(positions: string): Pos {
  const ps = positionsOf(positions);
  const VALID: Pos[] = ["GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LW", "RW", "ST"];
  for (const p of ps) {
    if ((VALID as string[]).includes(p)) return p as Pos;
    // The ones SoFIFA uses that our ten do not.
    if (p === "LM") return "LW";
    if (p === "RM") return "RW";
    if (p === "LWB") return "LB";
    if (p === "RWB") return "RB";
    if (p === "CF") return "ST";
  }
  return "CM";
}

/** Nobody real available: the club still has a team, it is just an invented one. */
function generatedSquad(club: string): LeagueSquad {
  return {
    club,
    players: generateSquad(clubNameSeed(club)).map((p, i) => ({
      id: `gen:${club}:${i}`,
      name: p.name,
      position: p.position,
      overall: 62 + ((clubNameSeed(club) + i * 7) % 22),
      goals: 0,
      assists: 0,
    })),
  };
}

/**
 * Was this division fetched before faces and flags existed?
 *
 * `image` and `nation` were added to the query well after clubs started being
 * cached — a career already holding a full set of `leagueSquads` never re-fetches
 * (see `fetchLeagueSquads`'s caller, which only asks when the list is empty), so
 * every save made before this landed is stuck showing initials and no flag for
 * the other nineteen clubs forever, while its OWN squad — fetched by a different
 * path that always carried these fields — looks fine. That mismatch is the whole
 * bug: one side of the pitch has faces, the other does not.
 *
 * `nation` is the primary signal rather than `image`: a database can legitimately
 * have no photo for plenty of players, but a whole division with not one
 * nationality set is not a sparse import, it is a cache from before the column
 * was read.
 *
 * The second check exists for a narrower, later bug: a career loaded from a
 * STALE save can have nations but very few images — a snapshot taken before an
 * image merge finished, then written back over a more complete local copy by
 * the cloud-save load path (see loadCareerFromCloud's caller). `nation` and
 * `image` come off the same fetched row and a real fetch never returns one
 * without the other, so plenty of nations paired with almost no images is not
 * "some players legitimately have no photo" — it is exactly this. A generated
 * filler player (topping up a thin roster) has neither field, so it never
 * counts against the ratio; only rows that came from a real fetch do.
 */
export function shouldUpgradeLeagueSquads(squads: LeagueSquad[]): boolean {
  if (squads.length === 0) return false;
  const withNation = squads.flatMap(s => s.players).filter(p => p.nation);
  if (withNation.length === 0) return true;
  // Below this it takes only ONE real nationality anywhere to trust the rest
  // of the import — see that exact test. The ratio below needs an actual
  // sample to mean anything, or a division holding one genuine sparse entry
  // and nothing else would fail it on pure bad luck.
  if (withNation.length < 20) return false;
  const withImage = withNation.filter(p => p.image).length;
  return withImage / withNation.length < 0.5;
}

/**
 * Go and get the division.
 *
 * One request for every club at once — see app/api/star/league-squads. Never
 * throws: a career that cannot be created is very much worse than a career
 * whose Burnley are invented.
 */
export async function fetchLeagueSquads(
  clubs: string[],
  year = STAR_FIFA_YEAR,
  keepAll = false,
): Promise<LeagueSquad[]> {
  try {
    const res = await fetch(`/api/star/league-squads?clubs=${encodeURIComponent(clubs.join("|"))}&year=${year}`, SQUAD_FETCH_INIT);
    if (!res.ok) return clubs.map(generatedSquad);
    const data = await res.json() as { squads?: Record<string, RosterRow[]> };
    return clubs.map(c => buildLeagueSquad(c, data.squads?.[c] ?? [], keepAll));
  } catch {
    return clubs.map(generatedSquad);
  }
}

/**
 * A reserved club name, never a real one, that tells `/api/star/league-squads`
 * to answer with whoever is currently out of contract instead of an actual
 * club's roster — see that route for the `club = 'free' OR 'Free'` it reads.
 */
export const FREE_AGENTS_CLUB = "Free Agents";

/**
 * Whoever the database currently has out of contract.
 *
 * Admin marks a player this way by typing "free" or "Free" (either casing) as
 * his club — a free-text field, not a picker, so both slip through — and he
 * stays a real, signable footballer rather than falling out of the world:
 * `runTransferWindow` treats this exactly like one more dressing room, except
 * nobody has to sell FROM it and its players will drop further below their
 * own level than a contracted man ever would, to actually get taken on. See
 * the file header there for why.
 *
 * No `keepAll`/formation logic here — a free agent is not being fitted into
 * anyone's matchday squad, just listed, so every row comes back exactly as
 * `rowToLeaguePlayer` reads it.
 */
export async function fetchFreeAgents(year = STAR_FIFA_YEAR): Promise<LeaguePlayer[]> {
  try {
    const res = await fetch(`/api/star/league-squads?clubs=${encodeURIComponent(FREE_AGENTS_CLUB)}&year=${year}`, SQUAD_FETCH_INIT);
    if (!res.ok) return [];
    const data = await res.json() as { squads?: Record<string, RosterRow[]> };
    return (data.squads?.[FREE_AGENTS_CLUB] ?? []).map(rowToLeaguePlayer);
  } catch {
    return [];
  }
}

// ── Who scored ──────────────────────────────────────────────────────────────

/**
 * How likely a man in this position is to be the one who put it in.
 *
 * Roughly the shape of a real season's scoring: forwards get most of them,
 * midfielders a decent share, full-backs and centre-halves the odd one, and the
 * goalkeeper never. Multiplied by how good he is, so a club's best striker
 * outscores its fourth choice without either being guaranteed.
 */
const SCORE_WEIGHT: Record<Pos, number> = {
  ST: 30, CAM: 13, LW: 14, RW: 14, CM: 7, CDM: 2.5, CB: 2.5, LB: 1.2, RB: 1.2, GK: 0,
};

/** …and who tends to make them. Wide men and creators, not the centre-halves. */
const ASSIST_WEIGHT: Record<Pos, number> = {
  LW: 18, RW: 18, CAM: 16, CM: 12, ST: 10, LB: 7, RB: 7, CDM: 4, CB: 2, GK: 0.3,
};

function weightedPick(
  players: LeaguePlayer[],
  weights: Record<Pos, number>,
  rng: () => number,
  exclude?: string,
): LeaguePlayer | null {
  let total = 0;
  const w: number[] = [];
  for (const p of players) {
    // Rating tilts it, but never to the point where only the best man scores:
    // a 70 is worth about half a 90, not a twentieth.
    const q = 0.55 + (Math.max(40, Math.min(99, p.overall)) - 40) / 59 * 0.9;
    const x = p.id === exclude ? 0 : (weights[p.position] ?? 1) * q;
    w.push(x); total += x;
  }
  if (total <= 0) return null;
  let r = rng() * total;
  for (let i = 0; i < players.length; i++) {
    r -= w[i];
    if (r <= 0) return players[i];
  }
  return players[players.length - 1] ?? null;
}

export interface SimGoal { m: number; s: string; a?: string }

/**
 * Put names to the goals in a match nobody played.
 *
 * Mutates the squad's season tallies as it goes — that is the whole point:
 * scoring in these matches is what makes a Golden Boot table real rather than a
 * formula run over team strength, which is what it used to be.
 */
export function nameGoals(squad: LeagueSquad | undefined, count: number, rng: () => number): SimGoal[] {
  if (!squad || count <= 0) return [];
  const out: SimGoal[] = [];
  for (let i = 0; i < count; i++) {
    const scorer = weightedPick(squad.players, SCORE_WEIGHT, rng);
    if (!scorer) break;
    scorer.goals += 1;
    // Most goals are made by somebody. The rest are solo, deflected, or the sort
    // nobody claims.
    const assister = rng() < 0.62
      ? weightedPick(squad.players, ASSIST_WEIGHT, rng, scorer.id)
      : null;
    if (assister) assister.assists += 1;
    out.push({
      m: 2 + Math.floor(rng() * 88),
      s: shortNameOf(scorer.name),
      ...(assister ? { a: shortNameOf(assister.name) } : {}),
    });
  }
  return out.sort((a, b) => a.m - b.m);
}

/** One of the opponent's goals, already decided live — see OppGoalEvent
 *  (types.ts) and CanvasMatch.tsx's opponent-goal branch. */
export interface NamedOppGoal {
  id: string;
  assistId?: string;
  m: number;
  s: string;
  a?: string;
}

/**
 * Put names to goals that were already scored, live, in front of the player.
 *
 * The other half of `nameGoals`: that function is for the nine matches
 * nobody watched, rolling a fresh weighted pick because there is no real
 * event to name. A match the player just played through is a real event —
 * the commentary already showed a name the moment the ball crossed the
 * line — so re-rolling here would show a SECOND, different scorer on the
 * results page from the one the player just watched score. Mutates the
 * same season tallies `nameGoals` does, by id rather than by a fresh
 * weighted draw, so the Golden Boot table still credits the right man; an
 * id with no match in `squad` (the "Team-mate" fallback CanvasMatch uses
 * when nobody could be picked, or a squad this function was never handed)
 * simply isn't credited — the name still shows on the scoresheet either way.
 */
export function creditNamedGoals(squad: LeagueSquad | undefined, goals: NamedOppGoal[]): SimGoal[] {
  const byId = new Map((squad?.players ?? []).map(p => [p.id, p]));
  for (const g of goals) {
    const scorer = byId.get(g.id);
    if (scorer) scorer.goals += 1;
    if (g.assistId) {
      const assister = byId.get(g.assistId);
      if (assister) assister.assists += 1;
    }
  }
  return goals
    .map(g => ({ m: g.m, s: g.s, ...(g.a ? { a: g.a } : {}) }))
    .sort((a, b) => a.m - b.m);
}

/** A new season: the table resets, and so does everybody's tally. */
export function resetLeagueSquads(squads: LeagueSquad[]): LeagueSquad[] {
  return squads.map(s => ({ ...s, players: s.players.map(p => ({ ...p, goals: 0, assists: 0 })) }));
}

/**
 * A CLUB'S STRENGTH, READ OFF THE MEN WHO'D ACTUALLY START.
 *
 * `LeagueTeam.strength` used to be a number rolled once when the division was
 * built (buildLeague, 55 + up to 35) and never touched again for the rest of
 * the club's existence — the same number whether its actual eleven were
 * genuine internationals or academy fill-ins, and unmoved by a transfer
 * window or two seasons of a striker developing.
 *
 * `buildLeagueSquad` already fills a club's twenty in a fixed priority order
 * — the shape's first slots first — so the players who would start are
 * already sitting at the front of the array; nothing has to be inferred
 * about who plays where a second time. The 20 filler entries a thin/generated
 * roster gets (see buildLeagueSquad/generatedSquad) carry a real `overall`
 * too, so every club has an answer, not just the ones with a real roster
 * behind them.
 */
export function averageStartingXIRating(squad: LeagueSquad | undefined): number | null {
  if (!squad || squad.players.length === 0) return null;
  const xi = squad.players.slice(0, 11);
  return Math.round(xi.reduce((sum, p) => sum + p.overall, 0) / xi.length);
}

/**
 * Refresh every club's strength from its current squad.
 *
 * Call this any time `leagueSquads` changes — a fresh fetch, a merge, a
 * season rollover — so `LeagueTeam.strength` stays a live reading of the
 * squad rather than a number that only agreed with it on the day it was
 * cached. A club with no squad entry yet (fetch still in flight, or failed)
 * keeps whatever strength it already had rather than losing it.
 */
export function syncLeagueStrengthFromSquads(league: LeagueTeam[], squads: LeagueSquad[]): LeagueTeam[] {
  const byClub = new Map(squads.map(s => [s.club, s]));
  return league.map((t) => {
    const rating = averageStartingXIRating(byClub.get(t.name));
    return rating === null ? t : { ...t, strength: rating };
  });
}


/**
 * The same, for the other nineteen clubs. See mergeSquadStats — including
 * the note there on why this deliberately does NOT keep a `previous`-only
 * player: it can't tell "the in-career transfer engine moved him" apart
 * from "a real database correction removed him", and the latter has to
 * keep working for a career already in progress.
 */
export function mergeLeagueSquadStats(fresh: LeagueSquad[], previous: LeagueSquad[]): LeagueSquad[] {
  const before = new Map(previous.map(sq => [sq.club, new Map(sq.players.map(p => [p.id, p]))]));
  return fresh.map(sq => ({
    ...sq,
    players: sq.players.map((p) => {
      const was = before.get(sq.club)?.get(p.id);
      return was ? { ...p, goals: was.goals, assists: was.assists } : p;
    }),
  }));
}
