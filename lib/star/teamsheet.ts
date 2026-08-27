import type { CareerState, Fixture, LeagueSquad, SquadPlayer } from "./types";
import { mulberry32 } from "./season";
import { FORMATIONS, formationOf, autoPick, type Formation, type Pickable, type Role } from "./formations";
import { shortNameOf } from "./realSquad";
import { loadLineup } from "./lineupStore";

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
    positions: p.positions as Role[] | undefined,
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
    positions: p.positions as Role[] | undefined,
    overall: p.overall,
    face: p.image,
    nation: p.nation,
  }));
}

// ── Opponent squad rotation ─────────────────────────────────────────────────
//
// Reported directly: an opponent's eleven never varies — the same club always
// hands you the exact same autoPick side, every single time you play them,
// because autoPick is a pure function of an unchanging pool. Real squads
// rotate a little, more so in the early rounds of a cup nobody is treating as
// the priority. This is not meant to be noticeable most weeks — "rare... not
// every game" was said explicitly — so the odds below stay low outside a cup,
// and even inside one this changes at most a couple of shirts, never the
// team.

export interface RotationPlan {
  rng: () => number;
  /** 0-1 chance THIS match sees any rotation at all. */
  chance: number;
}

/** How likely a given fixture is to see the opponent rotate at all. */
function rotationChanceFor(fixture: Fixture): number {
  const isDomesticCup = fixture.competition === "FA Cup" || fixture.competition === "League Cup";
  const isEarlyRound = fixture.round === "Round of 32" || fixture.round === "Round of 16";
  if (isDomesticCup && isEarlyRound) return 0.28;
  if (isDomesticCup) return 0.14; // still a cup, but the rounds a club actually wants to win
  if (!fixture.kind || fixture.kind === "league") return 0.06;
  return 0.03; // Europe, the play-offs, internationals — full strength assumed
}

/** A seed stable for this exact fixture, so the same match always rotates
 *  (or doesn't) the same way — asked twice, it should not answer twice. */
function rotationSeedFor(club: string, fixture: Fixture, season: number): number {
  const key = `${club}|${fixture.opponent}|${fixture.week}|${fixture.kind ?? "league"}|${fixture.round ?? ""}|${season}`;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/**
 * Swap in, at most, a couple of shirts — never the team. Draws the chance to
 * rotate at all first, so most matches leave `picked` untouched exactly as
 * `autoPick` returned it; only on the rarer matches that do rotate does it
 * pick 1 (usually) or 2 (occasionally) filled slots and hand each to a
 * same-position squad player instead of the incumbent, for this match only —
 * nothing here is written back to the squad or the pool.
 */
function applyRotation(
  picked: (string | null)[],
  pool: Candidate[],
  formation: Formation,
  plan: RotationPlan,
): (string | null)[] {
  if (plan.rng() >= plan.chance) return picked;

  const swapCount = plan.rng() < 0.8 ? 1 : 2;
  const result = [...picked];
  const rotatedSlots = new Set<number>();

  for (let s = 0; s < swapCount; s++) {
    const slotOptions = formation.slots
      .map((_, i) => i)
      .filter(i => result[i] && !rotatedSlots.has(i));
    if (slotOptions.length === 0) break;
    const slotIdx = slotOptions[Math.floor(plan.rng() * slotOptions.length)];
    const role = formation.slots[slotIdx].role;
    const inXI = new Set(result.filter((id): id is string => !!id));

    const alternates = pool
      .filter(p => p.position === role && !inXI.has(p.id))
      .sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0));
    if (alternates.length === 0) continue;

    // The next best for the role, not always THE best — a rotation is a
    // squad player getting a game, not a guaranteed upgrade.
    const shortlist = alternates.slice(0, Math.min(3, alternates.length));
    const chosen = shortlist[Math.floor(plan.rng() * shortlist.length)];
    result[slotIdx] = chosen.id;
    rotatedSlots.add(slotIdx);
  }

  return result;
}

/**
 * A side you picked yourself, if you picked one.
 *
 * Everything below used to run `autoPick` unconditionally, so the lineup
 * builder's saved eleven was read for its BENCH and nothing else — you could
 * rearrange your side all afternoon and the team sheet would still show the
 * highest-rated eleven in the shape the club's name hashes to. Reported as
 * exactly that: "I have changed the Bournemouth team multiple times and it's
 * not registering, it seems to just be choosing the same best 11 each time
 * with the 4-3-2-1 formation."
 *
 * A saved slot naming somebody who is no longer in the squad (sold, or a
 * re-fetch changed his id) is left empty rather than dropping the whole
 * lineup — `fillGaps` then auto-picks only the slots that are actually
 * vacant, so one departed player costs you one place and not your shape.
 */
export interface SavedXI {
  formation: Formation;
  /** One entry per slot, in the formation's own order. */
  xi: (string | null)[];
}

/** Auto-pick only the slots the saved eleven left empty. */
function fillGaps(pool: Candidate[], formation: Formation, chosen: (string | null)[]): (string | null)[] {
  const taken = new Set(chosen.filter((id): id is string => !!id));
  const spare = pool.filter(p => !taken.has(p.id));
  const auto = autoPick(spare, formation);
  return formation.slots.map((_, i) => chosen[i] ?? auto[i] ?? null);
}

/**
 * A saved id, translated into whatever namespace this pool actually uses.
 *
 * The lineup builder (`/lineups`) reads a club's squad through `LeagueSquad`
 * — the thin, whole-division shape, keyed on the bare `sofifa_id` — because
 * that page opens for any of the twenty clubs, not just yours. But the pool a
 * saved lineup is applied AGAINST here, for your own club, is `career.squad`:
 * a full `SquadPlayer[]` keyed `sf_<sofifa_id>` (see realSquad.ts). Every
 * saved slot was therefore in a namespace `byId` never contained, so
 * `byId.has(id)` failed for every single one and the sheet silently fell
 * back to a full auto-pick regardless of what was saved — reported as
 * exactly that: a lineup edited "multiple times" that never once changed
 * the team sheet shown before a match. Try the id as saved, then with the
 * real-squad prefix, before giving up on the slot.
 */
function resolveSavedId(byId: Map<string, Candidate>, id: string | null): string | null {
  if (!id) return null;
  if (byId.has(id)) return id;
  const prefixed = `sf_${id}`;
  return byId.has(prefixed) ? prefixed : null;
}

function build(
  club: string,
  pool: Candidate[],
  yours: boolean,
  savedBenchIds?: string[],
  saved?: SavedXI,
  rotation?: RotationPlan,
): TeamSheet {
  const byId = new Map(pool.map(p => [p.id, p]));
  const formation = saved?.formation ?? formationForClub(club);
  // A saved id that is no longer in the squad is dropped to null here, not
  // carried through as a name the sheet cannot resolve.
  const picked = saved
    ? fillGaps(pool, formation, formation.slots.map((_, i) => resolveSavedId(byId, saved.xi[i])))
    : rotation
    ? applyRotation(autoPick(pool, formation), pool, formation, rotation)
    : autoPick(pool, formation);

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

  let bench: SheetPlayer[];
  if (savedBenchIds && savedBenchIds.length > 0) {
    const savedPicks = savedBenchIds
      .map(id => resolveSavedId(byId, id))
      .filter((id): id is string => !!id && !started.has(id))
      .map(id => byId.get(id))
      .filter((p): p is Candidate => !!p)
      .slice(0, 9);
    // A saved bench used to be taken exactly as-is, with no top-up — so a
    // squad member who joined AFTER the bench was last saved (a transfer-
    // window signing, above all) could sit in `career.squad`, resolve fine,
    // and still never appear anywhere in the matchday sheet: not starting
    // (a full saved XI never re-competes for its own slots — see fillGaps),
    // and not on the bench either, because the saved list simply predates
    // him and nothing ever added him to it. Reported directly: a new
    // signing "not even on the bench... even when they are players good
    // enough to start." Topping up to 9 from whoever else is available,
    // best-rated first, is what actually gets him into the matchday squad
    // at all — the human still has to choose to start him.
    const onBench = new Set(savedPicks.map(p => p.id));
    const topUp = savedPicks.length < 9
      ? pool
          .filter(p => !started.has(p.id) && !onBench.has(p.id))
          .sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0))
          .slice(0, 9 - savedPicks.length)
      : [];
    bench = [...savedPicks, ...topUp]
      .map(p => ({
        id: p.id, name: p.name, short: p.short, role: p.position, slot: p.position,
        overall: p.overall, face: p.face, nation: p.nation, isYou: p.isYou, x: 0, y: 0,
      }));
  } else {
    bench = pool
      .filter(p => !started.has(p.id))
      .sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0))
      .slice(0, 9)
      .map(p => ({
        id: p.id, name: p.name, short: p.short, role: p.position, slot: p.position,
        overall: p.overall, face: p.face, nation: p.nation, isYou: p.isYou, x: 0, y: 0,
      }));
  }

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
    bench: [{ ...dropped, isYou: false }, ...sheet.bench.filter(p => p.id !== me.id)].slice(0, 9),
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
  /** Saved bench from the lineup builder — overrides the auto-rated sort. */
  savedBench?: string[],
  /** Saved starting XI + shape from the lineup builder — overrides autoPick. */
  savedXI?: SavedXI,
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
  let ours = build(mine, starting ? [...ownPool, you] : ownPool, true, savedBench, savedXI);
  if (starting) ours = forceIntoXI(ours, you);

  const oppSquad = (career.leagueSquads ?? []).find(s => s.club === theirs);
  // A lineup saved for the OPPONENT in the /lineups builder — the same
  // per-club store your own side reads a few lines up. Reported directly,
  // with a real example (a Chelsea eleven set by hand, a completely
  // different one shown kicking off against it): the store and the builder
  // both work for any club, not just your own, but nothing here ever
  // actually read it back for anyone else — an opponent was always
  // auto-picked and rotated regardless of what had been saved for them.
  // Skips rotation entirely when a lineup was actually saved, the same way
  // your own club's does — a side you set out by hand is not something the
  // game should be quietly shuffling.
  const oppSaved = loadLineup(theirs);
  const oppSavedXI: SavedXI | undefined = oppSaved && oppSaved.xi.some(Boolean)
    ? { formation: formationOf(oppSaved.formation), xi: oppSaved.xi }
    : undefined;
  // Only an opponent with nothing saved for them rotates — your own side is
  // either what you saved or your club's honest best XI, never something
  // the game changes on you.
  const rotation: RotationPlan = {
    rng: mulberry32(rotationSeedFor(theirs, fixture, career.season)),
    chance: rotationChanceFor(fixture),
  };
  const them = build(theirs, fromLeagueSquad(oppSquad), false, oppSaved?.bench, oppSavedXI, rotation);

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

// ── Who is actually out there ───────────────────────────────────────────────

/**
 * The ids of your own club's OTHER ten starters, for a given fixture.
 *
 * Every place that puts a name to a team-mate's goal — a goal scored while you
 * were off the ball, an assist credited on one you scored yourself, the man a
 * scenario casts into a shirt beside you — used to draw from the whole squad,
 * twenty-odd names deep. A reserve who had never made the eighteen, or a
 * winger rested for this exact match, could still be credited with the goal
 * that won it. Reported as exactly that: two different careers, two different
 * players scoring in matches the team sheet said they were not part of.
 *
 * Computed the same way the pre-match team sheet is (`matchdayFor`, forcing
 * yourself into it so the other ten are whoever is left once your slot is
 * taken), so the eleven a goal can be credited to is the same eleven you were
 * shown before kick-off.
 *
 * Null rather than an empty set when there is nothing to restrict to — an
 * international fixture (no club sheet exists for it) or a squad too thin to
 * draw eleven from — so a caller can tell "nobody is eligible" apart from
 * "everybody is", and fall back to the full squad rather than to nobody.
 */
export function startingTeammateIds(career: CareerState, fixture: Fixture): Set<string> | null {
  if (fixture.kind === "international") return null;
  try {
    // Read the same saved eleven the pre-match sheet does, or the two disagree
    // about who is playing: a man you dropped to the bench could still be
    // credited with the winner. `loadLineup` is localStorage-backed and
    // returns null anywhere there is no localStorage (the tests, SSR), which
    // is the same "nothing saved" answer as a career that never picked a side.
    const saved = loadLineup(career.player.club);
    const savedXI = saved && saved.xi.some(Boolean)
      ? { formation: formationOf(saved.formation), xi: saved.xi }
      : undefined;
    const md = matchdayFor(career, fixture, true, undefined, saved?.bench, savedXI);
    const mine = md.home.yours ? md.home : md.away;
    if (!sheetReady(md) && mine.xi.length < 9) return null;
    return new Set(mine.xi.filter(p => !p.isYou).map(p => p.id));
  } catch {
    return null;
  }
}

/** The full squad, narrowed to whoever is actually out there — or the full
 *  squad, when there is nothing to narrow by. See startingTeammateIds. */
export function onPitchToday<T extends { id: string }>(squad: T[], ids: Set<string> | null): T[] {
  return ids ? squad.filter(p => ids.has(p.id)) : squad;
}
