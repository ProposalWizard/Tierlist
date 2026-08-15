import type { CareerState, Fixture, LeagueSquad, SquadPlayer } from "./types";
import { mulberry32 } from "./season";
import { FORMATIONS, formationOf, autoPick, type Formation, type Pickable, type Role } from "./formations";
import { shortNameOf } from "./realSquad";

/**
 * THE TEAM SHEET.
 *
 * Who is on the pitch when the whistle goes, for both sides, before it goes.
 *
 * The career has always known this and never said it. Your own squad has been
 * on `career.squad` since squads existed; the opposition's has been on
 * `career.leagueSquads` since the division started naming its own scorers. Both
 * were only ever read AFTER a match, to answer "who scored?" — so a match began
 * with two club names and a scoreline arrived ninety minutes later with eleven
 * strangers in it.
 *
 * Nothing here invents anybody. It reads the two squads that already exist,
 * picks the side a manager would pick out of each (`autoPick`, the same greedy-
 * by-slot function the squad builder uses), and hands back two elevens.
 */

/** A man on a team sheet, with everything the screen needs to draw him. */
export interface SheetPlayer {
  id: string;
  /** Full name, for the tooltip and the subs list. */
  name: string;
  /** What goes in the chip on the pitch. */
  short: string;
  role: Role;
  /** The label the FORMATION gives this slot — LWB rather than LB. */
  slot: string;
  overall?: number;
  face?: string;
  nation?: string;
  /** True for exactly one man, and only when it is your club. */
  isYou?: boolean;
  /** Where on the pitch, 0-1 in the formation's own coordinates. */
  x: number;
  y: number;
}

export interface TeamSheet {
  club: string;
  formation: Formation;
  xi: SheetPlayer[];
  /** Seven names, best first. Nobody draws a bench in a shape. */
  bench: SheetPlayer[];
  /** Are you in this side? False for the opposition, and for a match you miss. */
  yours: boolean;
}

export interface Matchday {
  home: TeamSheet;
  away: TeamSheet;
  fixture: Fixture;
}

// ── The shape a club plays ──────────────────────────────────────────────────

/**
 * A club's formation, which is theirs and does not change every week.
 *
 * Seeded off the club's name alone, so Everton line up the same way in every
 * career and in every season of one — a side whose shape is redrawn each match
 * is not a side, it is a dice roll. Drawn from the handful of shapes a real
 * Premier League club actually uses rather than from all thirty, most of which
 * exist for the squad builder to offer rather than for anybody to play.
 */
const COMMON_SHAPES = ["433", "4231", "442", "352", "4321", "4141", "3421"];

export function formationForClub(club: string): Formation {
  let h = 2166136261;
  for (let i = 0; i < club.length; i++) {
    h ^= club.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rng = mulberry32(h >>> 0);
  rng(); rng();
  const id = COMMON_SHAPES[Math.floor(rng() * COMMON_SHAPES.length)];
  // A shape the catalogue does not have falls back to 4-3-3 rather than to
  // nothing — see formationOf.
  return formationOf(FORMATIONS.some(f => f.id === id) ? id : "433");
}

// ── Building a side ─────────────────────────────────────────────────────────

interface Candidate extends Pickable {
  name: string;
  short: string;
  face?: string;
  nation?: string;
  isYou?: boolean;
}

/** Your own dressing room, as something `autoPick` can read. */
function fromSquad(squad: SquadPlayer[], you?: { id: string }): Candidate[] {
  return squad.map(p => ({
    id: p.id,
    name: p.name,
    short: p.shortName || shortNameOf(p.name),
    position: p.position as Role,
    overall: p.overall ?? 68,
    face: p.imageUrl,
    nation: p.nationality,
    isYou: !!you && p.id === you.id,
  }));
}

/** …and one of the other nineteen. */
function fromLeagueSquad(squad: LeagueSquad | undefined): Candidate[] {
  return (squad?.players ?? []).map(p => ({
    id: p.id,
    name: p.name,
    short: shortNameOf(p.name),
    position: p.position as Role,
    overall: p.overall,
    face: p.image,
    nation: p.nation,
  }));
}

function build(club: string, pool: Candidate[], yours: boolean): TeamSheet {
  const formation = formationForClub(club);
  const picked = autoPick(pool, formation);
  const byId = new Map(pool.map(p => [p.id, p]));

  const xi: SheetPlayer[] = [];
  formation.slots.forEach((slot, i) => {
    const p = picked[i] ? byId.get(picked[i]!) : undefined;
    if (!p) return;
    xi.push({
      id: p.id,
      name: p.name,
      short: p.short,
      role: slot.role,
      slot: slot.label ?? slot.role,
      overall: p.overall,
      face: p.face,
      nation: p.nation,
      isYou: p.isYou,
      x: slot.x,
      y: slot.y,
    });
  });

  const started = new Set(xi.map(p => p.id));
  const bench = pool
    .filter(p => !started.has(p.id))
    .sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0))
    .slice(0, 7)
    .map(p => ({
      id: p.id, name: p.name, short: p.short, role: p.position, slot: p.position,
      overall: p.overall, face: p.face, nation: p.nation, isYou: p.isYou, x: 0, y: 0,
    }));

  return { club, formation, xi, bench, yours };
}

/**
 * Put you in the side, in your own position.
 *
 * `autoPick` picks on fitness and rating and knows nothing about the manager
 * having named you — so a career player who is not yet the best in his position
 * gets left out of his own team sheet while the game tells him he is starting.
 * The man he displaces is the one `autoPick` put in the slot closest to his,
 * who drops to the bench where he belongs.
 *
 * Does nothing when you are on the bench or dropped: then the sheet is right
 * already, and putting you on it would contradict the screen above it.
 */
function forceIntoXI(sheet: TeamSheet, me: Candidate): TeamSheet {
  if (sheet.xi.some(p => p.isYou)) return sheet;

  // The slot you actually play, or the nearest thing to it that is filled.
  const target = sheet.xi.findIndex(p => p.role === me.position);
  const at = target >= 0
    ? target
    // No slot for your position in this shape — take the weakest outfielder,
    // never the goalkeeper.
    : sheet.xi.reduce((worst, p, i, all) =>
      (p.role !== "GK" && (p.overall ?? 0) < (all[worst].overall ?? 999) ? i : worst),
    sheet.xi.findIndex(p => p.role !== "GK"));
  if (at < 0) return sheet;

  const dropped = sheet.xi[at];
  const slot = sheet.formation.slots[
    sheet.formation.slots.findIndex(s => s.role === dropped.role)
  ] ?? { x: dropped.x, y: dropped.y, role: dropped.role, label: dropped.slot };

  const xi = sheet.xi.map((p, i) => (i === at
    ? {
      id: me.id, name: me.name, short: me.short, role: dropped.role,
      slot: dropped.slot, overall: me.overall, face: me.face, nation: me.nation,
      isYou: true, x: slot.x, y: slot.y,
    }
    : p));

  return {
    ...sheet,
    xi,
    bench: [{ ...dropped, isYou: false }, ...sheet.bench.filter(p => p.id !== me.id)].slice(0, 7),
  };
}

/**
 * Both sides for the match about to be played.
 *
 * `starting` comes from the manager's selection — see lib/star/selection. When
 * it is false the sheet is simply the eleven he picked instead of you, which is
 * the honest answer and the one the screen above it is already giving.
 */
export function matchdayFor(
  career: CareerState,
  fixture: Fixture,
  starting: boolean,
  /**
   * Play somewhere other than your named position, for this match only.
   *
   * Nothing downstream needs to know this is a departure from normal — `you`
   * simply claims a different `position`, and `autoPick`/`forceIntoXI` do
   * exactly what they always do: put you in the slot for that role and let your
   * actual position's best man take the shirt you just vacated. See
   * `alternatePositions` for which roles are worth offering.
   */
  playAs?: Role,
): Matchday {
  const mine = career.player.club;
  const theirs = fixture.opponent;

  const you: Candidate = {
    id: "you",
    name: `${career.player.firstName} ${career.player.lastName}`,
    short: career.player.lastName,
    position: playAs ?? (career.player.position as Role) ?? "ST",
    // Rated off your star rating so you are not permanently the worst man on
    // the sheet — 2.5 stars is a squad player and 5 is the best in the league.
    overall: Math.round(58 + (career.starRating ?? 2.5) * 6.5),
    face: career.player.portrait,
    nation: career.player.nationality,
    isYou: true,
  };

  // Your own squad, minus any duplicate of you: a career whose squad was
  // fetched from the database can contain the real player whose shirt you took.
  const ownPool = fromSquad(career.squad ?? []).filter(p => p.short !== you.short);
  let ours = build(mine, starting ? [...ownPool, you] : ownPool, true);
  if (starting) ours = forceIntoXI(ours, you);

  const oppSquad = (career.leagueSquads ?? []).find(s => s.club === theirs);
  const them = build(theirs, fromLeagueSquad(oppSquad), false);

  return fixture.home
    ? { home: ours, away: them, fixture }
    : { home: them, away: ours, fixture };
}

/** Is there enough on both sheets to be worth showing? */
export function sheetReady(m: Matchday): boolean {
  return m.home.xi.length >= 9 && m.away.xi.length >= 9;
}

// ── Asking to play somewhere else ───────────────────────────────────────────

/**
 * Where a man in this position could plausibly be asked to play instead.
 *
 * Not the fitness graph in formations.ts — that one is tuned for "who is an
 * acceptable emergency fill-in for an empty slot", which is a different
 * question and a more forgiving one. This is "what a manager would actually ask
 * a specialist to do": a striker drops into the hole or goes wide, a winger
 * cuts inside or swaps flanks, a deep midfielder pushes on. A centre-back or a
 * goalkeeper gets nothing — that is not a request anyone makes.
 *
 * `LM`/`RM` are not separate values here because they are not a separate `Role`
 * — every formation that plays a flat midfield four labels the `LW`/`RW` slot
 * that way already (see formations.ts), so asking for `LW` is asking for
 * "the left of midfield" in whichever shape actually has one.
 */
const ALTERNATE_POSITIONS: Partial<Record<Role, Role[]>> = {
  ST: ["CAM", "LW", "RW", "CM"],
  CAM: ["ST", "LW", "RW", "CM"],
  LW: ["ST", "RW", "CAM", "CM"],
  RW: ["ST", "LW", "CAM", "CM"],
  CM: ["CAM", "CDM", "LW", "RW"],
  CDM: ["CM", "CB"],
  LB: ["LW", "CM"],
  RB: ["RW", "CM"],
  CB: ["CDM"],
};

export function alternatePositions(realPosition: string): Role[] {
  return ALTERNATE_POSITIONS[realPosition as Role] ?? [];
}

/**
 * The alternates worth OFFERING, for the shape your club actually plays.
 *
 * Not every formation has a slot for every role — 4-3-2-1 has no wide men at
 * all, three centre-mids and two number tens and nothing out wide — and asking
 * `forceIntoXI` for a role with no matching slot does not refuse, it falls back
 * to "the weakest outfielder", which is however a full-back ends up standing in
 * for a winger. That is not what asking to play wide should do, so the picker
 * never offers a role the shape cannot seat you in to begin with.
 */
export function offeredPositions(realPosition: string, formation: Formation): Role[] {
  const has = new Set(formation.slots.map(s => s.role));
  return alternatePositions(realPosition).filter(r => has.has(r));
}

/** What to call a role in a picker — not what the pitch calls the SLOT, which
 *  depends on the formation and is decided at render time. */
export const POSITION_NAMES: Record<Role, string> = {
  GK: "Goalkeeper", CB: "Centre Back", LB: "Left Back", RB: "Right Back",
  CDM: "Defensive Mid", CM: "Central Mid", CAM: "Attacking Mid",
  LW: "Left Wing", RW: "Right Wing", ST: "Striker",
};
