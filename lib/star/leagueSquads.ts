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

/**
 * How many of a club's players the CAREER keeps. A matchday squad, not a wage
 * bill: it exists to answer "who scored?" in matches you are not in, and a
 * club's twenty-fifth choice never will.
 *
 * The squad builder asks for `keepAll` and gets the lot, because there the
 * question is different — you are picking a side, and a side is picked from
 * everybody. See buildLeagueSquad.
 */
const SQUAD_SIZE = 20;

type Pos = SquadPlayer["position"];

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
  image?: string; nation?: string;
}

/**
 * Fill a shape from a roster.
 *
 * Greedy by SLOT rather than by player, the same way `realSquad.ts` does it and
 * for the same reason: taking the twenty best players and then assigning
 * positions gives you four centre-backs and no left-back.
 */
export function buildLeagueSquad(club: string, roster: RosterRow[], keepAll = false): LeagueSquad {
  if (!roster.length) return generatedSquad(club);

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
    });
  }

  // A thin club gets topped up rather than fielding fifteen men.
  if (players.length < SQUAD_SIZE) {
    const filler = generatedSquad(club).players;
    for (let i = players.length; i < SQUAD_SIZE; i++) {
      players.push({ ...filler[i], id: `gen:${club}:${i}` });
    }
  }

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
      players.push({
        id: p.id, name: p.name, position: naturalPosition(p.positions),
        overall: p.overall || 60, goals: 0, assists: 0,
        ...(p.image ? { image: p.image } : {}),
        ...(p.nation ? { nation: p.nation } : {}),
      });
    }
  }
  return { club, players };
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


/** The same, for the other nineteen clubs. See mergeSquadStats. */
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
