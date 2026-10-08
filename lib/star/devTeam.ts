import type { CareerState, SquadPlayer } from "./types";
import type { CareerDivision } from "./calendar";
import { attachClub } from "./careerFlow";
import { membershipOf, type DivisionMembership } from "./promotion";
import { moveSquadsWithLadder } from "./leagueSquads";
import { shortNameOf } from "./realSquad";

/**
 * DEV CHEATS — move to any English club, add/remove/pin squad players.
 *
 * Settings → Dev — Squad / Dev — Career. Pure functions: the page just
 * feeds the result to `setCareer`, then lets its existing background
 * fetches fill in whatever squads are now missing.
 */

/** The seven divisions a career can actually play a season in. */
export const DEV_DIVISIONS: { id: CareerDivision; label: string; key: keyof DivisionMembership }[] = [
  { id: "premier", label: "Premier League", key: "premier" },
  { id: "championship", label: "Championship", key: "championship" },
  { id: "league_one", label: "League One", key: "leagueOne" },
  { id: "league_two", label: "League Two", key: "leagueTwo" },
  { id: "national_league", label: "National League", key: "nationalLeague" },
  { id: "national_league_north", label: "National League North", key: "nationalLeagueNorth" },
  { id: "national_league_south", label: "National League South", key: "nationalLeagueSouth" },
];

/**
 * Who is in each division RIGHT NOW in this save (not the season-1 lists —
 * promotion and relegation have moved clubs about). The division you are in
 * is read from the live table so it always matches what is on screen.
 */
export function devClubsByDivision(career: CareerState): { id: CareerDivision; label: string; clubs: string[] }[] {
  const m = membershipOf(career);
  const here = career.division ?? "premier";
  return DEV_DIVISIONS.map(d => ({
    id: d.id,
    label: d.label,
    clubs: d.id === here && career.league?.length ? career.league.map(t => t.name) : [...m[d.key]],
  }));
}

/**
 * Move the player to `club` in `division`, immediately.
 *
 * Rebuilds what a real move rebuilds, by reusing `attachClub`: that
 * division's league table, fixture list (and cups / Europe seeds), contract,
 * kit, number, manager and a generated stand-in squad. On top of it:
 * `career.divisions` is written so the ladder knows where everyone is, the
 * old division's squads move out to `externalSquads` (and the new division's
 * come back in), results and the play-off from the old division are cleared,
 * and money is left alone (a cheat should not charge a signing-on fee).
 * The page then fetches whichever squads are still missing (its existing
 * division-change effect) and the real squad (`fetchRealSquad`).
 *
 * Returns null when the club is not in that division in this save.
 */
export function moveToClub(career: CareerState, division: CareerDivision, club: string): CareerState | null {
  const entry = devClubsByDivision(career).find(d => d.id === division);
  if (!entry || !entry.clubs.includes(club)) return null;
  const clubs = [...entry.clubs];

  const members = membershipOf(career);
  const key = DEV_DIVISIONS.find(d => d.id === division)!.key;
  // Make the membership say the same thing as the table the player is about
  // to play in (matters for the division being left, whose live table was
  // the membership list a moment ago).
  const here = career.division ?? "premier";
  const hereKey = DEV_DIVISIONS.find(d => d.id === here)?.key;
  const divisions = { ...members, [key]: clubs, ...(hereKey && hereKey !== key && career.league?.length
    ? { [hereKey]: career.league.map(t => t.name) } : {}) };

  const moved = attachClub(career, club, clubs, division);
  const squads = moveSquadsWithLadder(career.leagueSquads ?? [], career.externalSquads ?? [], clubs);
  return {
    ...moved,
    money: career.money,
    divisions,
    results: [],
    playOffState: undefined,
    leagueSquads: squads.leagueSquads,
    externalSquads: squads.externalSquads,
  };
}

// ── Squad: add / remove / pin ───────────────────────────────────────────────

/** One row of `/api/star/player-search`. */
export interface PlayerSearchHit {
  sofifaId: string;
  year?: number;
  name: string;
  club: string;
  overall: number;
  positions: string;
  age?: number;
  image?: string;
  nation?: string;
  pace?: number; shooting?: number; passing?: number;
  dribbling?: number; defending?: number; physical?: number;
}

const ROLES: SquadPlayer["position"][] = ["GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LW", "RW", "ST"];

/** The roles this game models, in the order SoFIFA lists them ("RM", "CF" are dropped). */
function rolesOfHit(raw: string): SquadPlayer["position"][] {
  const out: SquadPlayer["position"][] = [];
  for (const tok of (raw || "").split(/[^A-Za-z]+/)) {
    const r = tok.toUpperCase() as SquadPlayer["position"];
    if (ROLES.includes(r) && !out.includes(r)) out.push(r);
  }
  return out;
}

/** A search hit as the squad member `realSquad.ts` would have built. */
export function squadPlayerFromHit(h: PlayerSearchHit): SquadPlayer {
  const roles = rolesOfHit(h.positions);
  const first = (h.positions || "").split(/[^A-Za-z]+/).find(Boolean)?.toUpperCase();
  // A striker listed "CF, ST" or a "RM" winger: fall back to the closest slot.
  const fallback: SquadPlayer["position"] = first === "CF" ? "ST" : first === "RM" || first === "RWB" ? "RW"
    : first === "LM" || first === "LWB" ? "LW" : "CM";
  const position = roles[0] ?? fallback;
  return {
    id: `sf_${h.sofifaId}`,
    name: h.name,
    shortName: shortNameOf(h.name),
    position,
    seasonGoals: 0, seasonAssists: 0, careerGoals: 0, careerAssists: 0,
    sofifaId: h.sofifaId,
    overall: h.overall || undefined,
    imageUrl: h.image || undefined,
    nationality: h.nation || undefined,
    age: h.age || undefined,
    positions: roles.length ? roles : [position],
    ...(h.pace ? { pace: h.pace } : {}),
    ...(h.shooting ? { shooting: h.shooting } : {}),
    ...(h.passing ? { passing: h.passing } : {}),
    ...(h.dribbling ? { dribbling: h.dribbling } : {}),
    ...(h.defending ? { defending: h.defending } : {}),
    ...(h.physical ? { physical: h.physical } : {}),
  };
}

const bare = (id: string) => (id.startsWith("sf_") ? id.slice(3) : id);

/**
 * Add a player to the squad (replacing any copy of him already there) and
 * take him out of the other clubs' squads, as a real transfer would. With
 * `start`, he is pinned into the XI.
 */
export function addToSquad(career: CareerState, player: SquadPlayer, start = true): CareerState {
  const id = bare(player.id);
  const without = (career.squad ?? []).filter(p => bare(p.id) !== id);
  const strip = (squads: CareerState["leagueSquads"]) =>
    squads?.map(s => (s.players.some(p => bare(p.id) === id)
      ? { ...s, players: s.players.filter(p => bare(p.id) !== id) } : s));
  return {
    ...career,
    squad: [...without, { ...player, ...(start ? { devStart: true } : {}) }],
    leagueSquads: strip(career.leagueSquads),
    externalSquads: strip(career.externalSquads),
  };
}

export function removeFromSquad(career: CareerState, playerId: string): CareerState {
  return { ...career, squad: (career.squad ?? []).filter(p => p.id !== playerId) };
}

export function setDevStart(career: CareerState, playerId: string, start: boolean): CareerState {
  return {
    ...career,
    squad: (career.squad ?? []).map(p => {
      if (p.id !== playerId) return p;
      if (start) return { ...p, devStart: true };
      const { devStart: _drop, ...rest } = p;
      void _drop;
      return rest;
    }),
  };
}
