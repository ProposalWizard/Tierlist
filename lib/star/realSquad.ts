import type { SquadPlayer } from "./types";
import { generateSquad, clubNameSeed } from "./squadData";
import { STAR_FIFA_YEAR, SQUAD_FETCH_INIT } from "./edition";

/**
 * THE REAL SQUAD.
 *
 * The career already knows which club you play for, and it is not a made-up
 * one: `ProfileSetup` builds its club list from `/api/draft/clubs` filtered to
 * clubs that exist in FC 26, so "Liverpool" in a career IS the "Liverpool" in
 * `sofifa_players`. That means the squad can be the actual squad, and the goal
 * crediting that already exists — `creditMatchResult` matches goal events to
 * squad players BY NAME — starts attributing goals to Salah without a line
 * changing.
 *
 * Everything here is best-effort. A club with no rows, a failed request, a
 * career started offline: all of them fall back to the generated squad, because
 * a career that cannot be created is very much worse than a career with
 * invented team-mates.
 */

/** What the roster endpoint gives back, of the parts we use. */
interface RosterPlayer {
  sofifa_id: string;
  name: string;
  overall: number;
  positions: string;
  age: number;
  image_url: string | null;
  nationality: string;
}

type Slot = SquadPlayer["position"];

/**
 * The shape of a squad, in the order the rest of the game expects.
 *
 * The first twelve are the side that plays; the last eight are depth. Matching
 * `SQUAD_POSITIONS` in squadData.ts is not cosmetic — `pickSquadScorer` and the
 * media engine both read positions off this list to decide who is plausible as
 * a scorer.
 */
const SLOTS: Slot[] = [
  "GK", "CB", "CB", "RB", "LB",
  "CDM", "CM", "CM",
  "RW", "LW", "CAM",
  "ST",
  "GK", "CB", "CDM", "CM",
  "RW", "LW", "CAM", "ST",
];

/**
 * SoFIFA writes positions as a list, and inconsistently: "CAM, LM, CM, LW" in
 * one row and "CAM,RB,CM" in the next. Split on anything that is not a letter.
 */
function positionsOf(raw: string): string[] {
  return (raw || "").split(/[^A-Za-z]+/).map(p => p.trim().toUpperCase()).filter(Boolean);
}

/**
 * How well a player fits a slot. Exact first, then the neighbouring role a
 * footballer would actually be asked to fill — a left-back covers left
 * midfield, a striker covers the wing, nobody covers goalkeeper.
 */
const NEIGHBOURS: Record<Slot, string[]> = {
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

/**
 * Every position he's listed for that this game actually models, primary
 * first. SoFIFA lists things we have no slot for at all — LM, RWB, CF — and
 * those are dropped rather than guessed at; `NEIGHBOURS` above already
 * covers "a CM can reasonably deputise for a CDM" for team-sheet purposes,
 * so a fabricated one-to-one mapping would only duplicate that.
 */
const VALID_ROLES = new Set<Slot>(["GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LW", "RW", "ST"]);
function rolesOf(raw: string): Slot[] {
  const out: Slot[] = [];
  for (const tok of positionsOf(raw)) {
    const role = tok as Slot;
    if (VALID_ROLES.has(role) && !out.includes(role)) out.push(role);
  }
  return out;
}

function fit(slot: Slot, player: RosterPlayer): number {
  const ps = positionsOf(player.positions);
  if (ps.length === 0) return 0;
  // A goalkeeper is never anything else, and nobody else is ever a goalkeeper.
  if (slot === "GK") return ps[0] === "GK" ? 100 : 0;
  if (ps.includes("GK")) return 0;

  if (ps[0] === slot) return 100;              // his actual position
  if (ps.includes(slot)) return 82;            // one he is listed for
  const near = NEIGHBOURS[slot] ?? [];
  for (let i = 0; i < near.length; i++) {
    if (ps.includes(near[i])) return 64 - i * 6;
  }
  return 12;                                    // out of position, but a body
}

/**
 * A surname that reads like a surname.
 *
 * SoFIFA abbreviates: "M. Salah", "V. van Dijk", "A. Mac Allister". Taking the
 * last word gives "Dijk", which is not what anyone calls him. Dropping the
 * initial and keeping the rest gives "van Dijk" and "Mac Allister", and leaves
 * single-name players ("Alisson") alone.
 */
export function shortNameOf(full: string): string {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  // "M." / "V." — an initial, so everything after it is the name.
  if (/^[A-Z]\.?$/.test(parts[0])) return parts.slice(1).join(" ");
  return parts[parts.length - 1];
}

/**
 * Fill the formation from the roster.
 *
 * Greedy by slot rather than by player: walk the slots in order and give each
 * one the best available fit, weighted by rating. Picking the twenty best
 * players and then assigning positions produces a squad with four centre-backs
 * and no left-back, which is how squads look when nobody thinks about shape.
 */
export function buildSquadFromRoster(roster: RosterPlayer[], club: string): SquadPlayer[] {
  if (!roster.length) return generateSquad(clubNameSeed(club));

  const pool = [...roster].sort((a, b) => (b.overall || 0) - (a.overall || 0));
  const taken = new Set<string>();
  const out: SquadPlayer[] = [];

  for (const slot of SLOTS) {
    let best: RosterPlayer | null = null;
    let bestScore = -1;
    for (const p of pool) {
      if (taken.has(p.sofifa_id)) continue;
      const f = fit(slot, p);
      if (f <= 0) continue;
      // Fit dominates, rating breaks ties. A 79 right-back beats an 86 striker
      // for the right-back slot, which is the whole point of doing it this way.
      const score = f * 100 + (p.overall || 0);
      if (score > bestScore) { bestScore = score; best = p; }
    }
    if (!best) continue;
    taken.add(best.sofifa_id);
    out.push({
      id: `sf_${best.sofifa_id}`,
      name: best.name,
      shortName: shortNameOf(best.name),
      position: slot,
      seasonGoals: 0, seasonAssists: 0, careerGoals: 0, careerAssists: 0,
      sofifaId: best.sofifa_id,
      overall: best.overall || undefined,
      imageUrl: best.image_url || undefined,
      nationality: best.nationality || undefined,
      age: best.age || undefined,
      positions: rolesOf(best.positions),
    });
  }

  // A thin roster leaves a short squad, and a short squad is the truth. See
  // buildLeagueSquad for the same removal and why: the top-up put invented
  // names ("Andres Modric") in among a club's real players, and nothing
  // downstream ever needed the count to reach twenty.
  return out;
}

/**
 * Should this squad be replaced with the real one?
 *
 * Only if it is not already real. That is the whole rule now, and it used to
 * have a second half: "…and only if nothing has been earned on it", so a squad
 * whose invented team-mates had scored was left alone rather than have those
 * goals deleted along with the men who scored them.
 *
 * Deliberately dropped. It meant a career started before real squads existed
 * could never get them — play two matches with the invented eleven and you were
 * locked out for the rest of the save. Reported as exactly that: Liverpool and
 * Man United on real players, Chelsea permanently on made-up ones.
 *
 * What is lost is only the invented team-mates' tallies. YOUR goals and assists
 * live on `career.seasonStats` and `career.careerStats`, not on the squad, so
 * nothing you did is touched.
 */
export function shouldUpgradeSquad(squad: SquadPlayer[]): boolean {
  return !squad.some(p => p.sofifaId);
}

/**
 * Go and get it.
 *
 * Never throws and never rejects: a career is created from whatever comes back,
 * and what comes back on a bad day is the generated squad.
 */
export async function fetchRealSquad(club: string, year = STAR_FIFA_YEAR): Promise<SquadPlayer[]> {
  try {
    const res = await fetch(`/api/draft/roster?club=${encodeURIComponent(club)}&year=${year}`, SQUAD_FETCH_INIT);
    if (!res.ok) return generateSquad(clubNameSeed(club));
    const data = await res.json() as { roster?: RosterPlayer[] };
    return buildSquadFromRoster(data.roster ?? [], club);
  } catch {
    return generateSquad(clubNameSeed(club));
  }
}


/**
 * Bring a squad up to date without losing what happened in it.
 *
 * The FC 27 database is being edited while careers are being played — a rating
 * corrected, a signing moved to his new club — and a career holds a SNAPSHOT
 * taken when it was created. Refetching is easy; refetching without wiping the
 * eleven goals your centre-forward has scored is the part worth writing down.
 *
 * So the fresh rows carry the new name, club, rating and image, and the old
 * rows carry the tallies, matched on the player himself. Anybody who has left
 * takes his numbers with him, which is correct: he is not in your squad.
 *
 * NOTE: this necessarily also drops anyone the in-career transfer engine
 * signed for a club, since the static database has no notion of an
 * AI-simulated transfer — a real signing looks identical, from this
 * function's own inputs, to a player a database edit correctly removed.
 * Tried making this keep any `previous`-only player and it broke exactly
 * that: a real database correction ("he's moved to his new club") would
 * never take effect for a career already in progress, since the player it
 * removed would just get carried forward here forever. Left as the
 * original, tested design — pressing "update from database" is a real,
 * separate way to lose an in-career transfer's own squad membership, not
 * yet fixed, and worth flagging rather than silently accepting a different
 * broken behaviour in its place.
 */
export function mergeSquadStats(fresh: SquadPlayer[], previous: SquadPlayer[]): SquadPlayer[] {
  const before = new Map(previous.map(p => [p.sofifaId ?? p.id, p]));
  return fresh.map((p) => {
    const was = before.get(p.sofifaId ?? p.id);
    if (!was) return p;
    return {
      ...p,
      seasonGoals: was.seasonGoals,
      seasonAssists: was.seasonAssists,
      careerGoals: was.careerGoals,
      careerAssists: was.careerAssists,
      leagueGoals: was.leagueGoals,
      leagueAssists: was.leagueAssists,
    };
  });
}
