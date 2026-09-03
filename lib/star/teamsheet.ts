import type { CareerState, Fixture, LeagueSquad, SquadPlayer } from "./types";
import { mulberry32 } from "./season";
import { FORMATIONS, formationOf, autoPick, type Formation, type Pickable, type Role } from "./formations";
import { shortNameOf } from "./realSquad";
import { loadLineup } from "./lineupStore";
import { displayOverall } from "./rating";

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
 * The same real footballer, however this pool happens to spell his id.
 *
 * `career.squad` keys on `sf_<sofifaId>` (see realSquad.ts); a `LeagueSquad`
 * — the /lineups builder's own pool, and career.leagueSquads — keys on the
 * bare sofifaId. Strip the prefix either way and two candidates for the
 * same man compare equal.
 */
function bareSofifaId(id: string): string {
  return id.startsWith("sf_") ? id.slice(3) : id;
}

/**
 * Your OWN club's full real roster, folded in behind your curated squad.
 *
 * `career.squad` is not your whole roster — buildSquadFromRoster (realSquad.ts)
 * walks a fixed 20-slot template and keeps only the single best fit for each
 * slot, so a squad player who loses that competition (a depth midfielder
 * behind two better-rated ones, say) is not benched or injured, he simply
 * does not exist in `career.squad` at all. The /lineups builder has no such
 * limit — it offers your whole real roster, from the same `LeagueSquad` data
 * every other club's pool already is — so a manager could save a lineup
 * naming a player their own career had already quietly dropped, and every
 * slot he was placed in (the bench included) would silently fall back to
 * someone else with no explanation. Reported directly: a real 70-rated
 * midfielder who would not appear on the team sheet "no matter where I put
 * him," read by the player as the game refusing specific POSITIONS (a
 * centre-back placement working for one man and not another) when the actual
 * cause had nothing to do with position at all — it was which twenty men
 * happened to survive the slot competition.
 *
 * Your own club's full roster is already sitting in `career.leagueSquads`
 * (needed for the rest of the division regardless), so a saved lineup's
 * player search is widened to include it — only when there IS a saved
 * lineup to resolve, so a career with nothing saved keeps drawing its
 * ordinary auto-pick eleven from the same twenty it always has.
 */
function withFullRosterFallback(squadPool: Candidate[], fullRoster: Candidate[]): Candidate[] {
  const known = new Set(squadPool.map(p => bareSofifaId(p.id)));
  const missing = fullRoster.filter(p => !known.has(bareSofifaId(p.id)));
  return [...squadPool, ...missing];
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
 *
 * ── When your own slot is genuinely empty ──
 *
 * `sheet.xi` only holds the slots `build()` actually filled — a formation
 * slot nobody in the pool could fill (your club's only recognised man for
 * that role sold, or a squad snapshot that hadn't finished loading yet) is
 * simply absent from it, not present-but-weak. `findIndex(p => p.role ===
 * me.position)` used to search `sheet.xi` alone, so a genuinely vacant slot
 * read exactly like "no slot for this role in the shape at all" and fell
 * through to the weakest-outfielder fallback — shoving a striker or a
 * winger into an unrelated defender's shirt for no reason a manager ever
 * would. Reported directly, with screenshots: a club's real striker gone
 * from the squad, and the career player (nominally a winger) turning up at
 * centre-back instead. The formation's OWN slot list still knows the shape
 * has a hole at your role even when `sheet.xi` doesn't; checked first now,
 * and filled directly — an addition, not a swap — before ever reaching for
 * somebody else's place.
 */
function forceIntoXI(sheet: TeamSheet, me: Candidate): TeamSheet {
  if (sheet.xi.some(p => p.isYou)) return sheet;

  // Coordinates, not ids: `sheet.xi` entries came straight off
  // `formation.slots[i].x/y`, so this is a reliable way to tell "filled" from
  // "never had anyone to fill it" without the SheetPlayer shape needing to
  // carry its own slot index.
  const filled = new Set(sheet.xi.map(p => `${p.x},${p.y}`));
  const vacantSlot = sheet.formation.slots.find(
    s => s.role === me.position && !filled.has(`${s.x},${s.y}`),
  );
  if (vacantSlot) {
    return {
      ...sheet,
      xi: [...sheet.xi, {
        id: me.id, name: me.name, short: me.short, role: vacantSlot.role,
        slot: vacantSlot.label ?? vacantSlot.role, overall: me.overall,
        face: me.face, nation: me.nation, isYou: true,
        x: vacantSlot.x, y: vacantSlot.y,
      }],
    };
  }

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
 * Put you on the bench, in your own shirt.
 *
 * Named a substitute for this match and nowhere on the sheet — reported
 * directly: "I don't see my name anywhere" among the nine. `matchdayFor`
 * only ever added you to the player pool when you were STARTING, so a
 * substitute appearance had you competing for a place nowhere at all, not
 * even against the bench's own weakest name.
 *
 * Mirrors `forceIntoXI`: does nothing if you already made the bench (or the
 * XI) on your own rating, and otherwise drops the weakest man on it for you
 * — the manager named you among the substitutes, so you take a place on the
 * sheet the same way a starter does, rather than simply not being drawn.
 */
function forceOntoBench(sheet: TeamSheet, me: Candidate): TeamSheet {
  if (sheet.xi.some(p => p.isYou) || sheet.bench.some(p => p.isYou)) return sheet;

  const meSheet: SheetPlayer = {
    id: me.id, name: me.name, short: me.short, role: me.position, slot: me.position,
    overall: me.overall, face: me.face, nation: me.nation, isYou: true, x: 0, y: 0,
  };
  if (sheet.bench.length < 9) return { ...sheet, bench: [...sheet.bench, meSheet] };

  const weakest = sheet.bench.reduce((worst, p, i, all) =>
    ((p.overall ?? 0) < (all[worst].overall ?? 999) ? i : worst), 0);
  return { ...sheet, bench: sheet.bench.map((p, i) => (i === weakest ? meSheet : p)) };
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
  /**
   * Named among the substitutes for this match — see `forceOntoBench`.
   * Ignored when `starting` is true. Not the same as simply missing the
   * squad altogether (dropped, or injured): those get no place on the
   * sheet at all, which is the honest answer for them.
   */
  onBench?: boolean,
): Matchday {
  const mine = career.player.club;
  const theirs = fixture.opponent;

  const you: Candidate = {
    id: "you",
    name: `${career.player.firstName} ${career.player.lastName}`,
    short: career.player.lastName,
    position: playAs ?? (career.player.position as Role) ?? "ST",
    // Rated off your star rating so you are not permanently the worst man on
    // the sheet — the one shared overall formula every screen now reads
    // (rating.ts's displayOverall), not a formula of this screen's own.
    overall: displayOverall(career.starRating ?? 2.5),
    face: career.player.portrait,
    nation: career.player.nationality,
    isYou: true,
  };

  // Your own squad, minus any duplicate of you: a career whose squad was
  // fetched from the database can contain the real player whose shirt you took.
  let ownPool = fromSquad(career.squad ?? []).filter(p => p.short !== you.short);
  // `career.squad` is a fixed ~20-man curation, taken once and never topped
  // up when a real transfer window sells one of them out from under you —
  // the widened pool used to only apply while resolving a saved lineup (see
  // withFullRosterFallback's own note, about a SAVED SLOT naming someone the
  // curated squad had already dropped). Reported directly, with screenshots:
  // a club's real, only recognised man at a position sold away mid-season,
  // and an ordinary (no saved lineup) auto-picked eleven simply played the
  // match a body short at that slot rather than reaching for anyone else on
  // the books — the wider roster this same fallback already draws on for a
  // saved lineup was sitting right there, unused, for the everyday case.
  // Always widened now, additively — it can only ever hand `autoPick` an
  // extra name it did not already have, never remove or override one.
  const ownFullRoster = fromLeagueSquad((career.leagueSquads ?? []).find(s => s.club === mine));
  ownPool = withFullRosterFallback(ownPool, ownFullRoster);
  // `you` only joins the pool `autoPick` competes over when you are actually
  // starting — a substitute must never be able to win a starting slot on
  // rating alone, since the manager already decided this week that you're
  // not fit enough to start. Bench placement is forced on afterward instead,
  // the same way forceIntoXI forces a start afterward rather than relying on
  // autoPick to have picked you.
  let ours = build(mine, starting ? [...ownPool, you] : ownPool, true, savedBench, savedXI);
  if (starting) ours = forceIntoXI(ours, you);
  else if (onBench) ours = forceOntoBench(ours, you);

  // A cup draw can hand you a club outside your own division entirely — a
  // promotion-pool or "Other" side like Wigan Athletic — whose squad was
  // never fetched into leagueSquads at all, only into externalSquads (see
  // externalClubsFor in app/star-dev/page.tsx). Reported directly: a real
  // saved lineup for exactly this kind of opponent still read as "Unable to
  // scout opponent's team", because this lookup only ever checked the one
  // store a league-table club's squad lives in.
  const oppSquad = (career.leagueSquads ?? []).find(s => s.club === theirs)
    ?? (career.externalSquads ?? []).find(s => s.club === theirs);
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
 * The only positions ever worth asking to play instead — Striker, Attacking
 * Mid, or either wing. Given directly, replacing a per-position neighbour
 * table (a deep midfielder could be offered CDM, a full-back could be
 * offered a wing) with a single fixed menu: whatever your real position is,
 * this is the whole menu there is, not something that changes shape
 * depending on what you nominally play.
 */
const OFFERABLE_ROLES: Role[] = ["ST", "CAM", "LW", "RW"];

export function alternatePositions(realPosition: string): Role[] {
  // Nothing is offered unless your real position is itself one of the four —
  // the same "a centre-back gets nothing, that is not a request anyone
  // makes" principle the old neighbour table used, just applied uniformly
  // rather than to defenders and goalkeepers alone.
  if (!OFFERABLE_ROLES.includes(realPosition as Role)) return [];
  return OFFERABLE_ROLES.filter(r => r !== realPosition);
}

/** A role offered by the picker, with what the formation actually calls the
 *  slot it would seat you in. */
export interface OfferedPosition {
  role: Role;
  /** "LM"/"RM" for a flat wide midfielder — the same `LW`/`RW` Role
   *  underneath, see `Slot.label` in formations.ts — otherwise the role's
   *  own name. */
  label: string;
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
export function offeredPositions(realPosition: string, formation: Formation): OfferedPosition[] {
  return alternatePositions(realPosition).flatMap((role): OfferedPosition[] => {
    const slot = formation.slots.find(s => s.role === role);
    return slot ? [{ role, label: slot.label ?? POSITION_NAMES[role] }] : [];
  });
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
 * The other ten starters, for a given fixture — each mapped to the ROLE the
 * formation actually has him playing, not his own natural position.
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
 * The role (not just the id) matters just as much — reported directly,
 * repeatably: a player deliberately deployed at CDM in the lineup builder,
 * whose own SquadPlayer.position is something else entirely, kept losing
 * every CDM-shaped moment in the match itself to whoever's OWN position
 * happened to say "CDM" (a bench player), because `castScenario` (lineup.ts)
 * casts by each squad member's static position field and had no idea the
 * lineup had overridden it for this match. He was never actually dropped —
 * he simply couldn't be cast into the shape the situation was asking for,
 * every single time, which reads exactly like being benched without ever
 * being benched. `onPitchToday` below applies this map to override each
 * player's effective position before casting, so "who's playing where"
 * follows the lineup you actually set, not each man's day job.
 *
 * Null rather than an empty map when there is nothing to restrict to — an
 * international fixture (no club sheet exists for it) or a squad too thin to
 * draw eleven from — so a caller can tell "nobody is eligible" apart from
 * "everybody is", and fall back to the full squad rather than to nobody.
 */
export function startingTeammateRoles(career: CareerState, fixture: Fixture): Map<string, Role> | null {
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
    const roles = new Map<string, Role>();
    for (const p of mine.xi) {
      if (p.isYou) continue;
      roles.set(p.id, p.role);
    }
    return roles;
  } catch {
    return null;
  }
}

/**
 * The other lot, the same way — the eleven actually starting for whoever
 * you're playing, not their whole scouted roster.
 *
 * Built for naming the opponent's own goals live (see CanvasMatch.tsx):
 * "They score!" with no name attached used to be the whole of it, while a
 * goal your own side scored got a real man's name off the exact XI shown
 * before kick-off. Requested directly, once the reason for the gap was
 * traced — build the same restriction `startingTeammateRoles` already does
 * for your side, just read the other half of the same `matchdayFor` call.
 * `null` for the same reasons that function returns null: an international
 * fixture, or a side too thin to draw an XI from — "unable to scout" is the
 * honest answer there too, not an invented name.
 */
export function opponentStartingXI(career: CareerState, fixture: Fixture): SheetPlayer[] | null {
  if (fixture.kind === "international") return null;
  try {
    const saved = loadLineup(career.player.club);
    const savedXI = saved && saved.xi.some(Boolean)
      ? { formation: formationOf(saved.formation), xi: saved.xi }
      : undefined;
    const md = matchdayFor(career, fixture, true, undefined, saved?.bench, savedXI);
    const theirs = md.home.yours ? md.away : md.home;
    return theirs.xi.length >= 9 ? theirs.xi : null;
  } catch {
    return null;
  }
}

/**
 * The full squad, narrowed to whoever is actually out there and — the part
 * this exists for — with each man's `position` overridden to the ROLE he is
 * actually playing this match, per `startingTeammateRoles`. Casting a
 * situation (`castScenario`, lineup.ts) reads `position` alone; without this
 * override it would keep matching a "CDM-shaped" moment against each
 * player's own natural position instead of the lineup's own deliberate
 * choice. Returns the full squad, untouched, when there is nothing to
 * narrow by (see startingTeammateRoles) — the pre-lineup, auto-pick
 * behaviour this had before saved lineups existed at all.
 */
export function onPitchToday<T extends { id: string; position: Role }>(
  squad: T[], roles: Map<string, Role> | null,
): T[] {
  if (!roles) return squad;
  // `roles`' own keys are not consistently `sf_`-prefixed — see
  // startingTeammateRoles: a starter drawn from career.squad keeps his
  // `sf_`-id, but one only found via matchdayFor's own full-roster fallback
  // (fromLeagueSquad) carries the bare sofifaId instead. Comparing bare ids
  // on both sides means either spelling of the same real man matches.
  const byBareId = new Map<string, Role>();
  for (const [id, role] of Array.from(roles.entries())) byBareId.set(bareSofifaId(id), role);
  return squad
    .filter(p => byBareId.has(bareSofifaId(p.id)))
    .map(p => {
      const role = byBareId.get(bareSofifaId(p.id))!;
      return role === p.position ? p : { ...p, position: role };
    });
}

/**
 * Any starting-XI team-mate named in `roles` but missing from `squad`.
 *
 * `career.squad` is not your whole roster — buildSquadFromRoster (realSquad.ts)
 * walks a fixed 20-slot template and keeps only the single best fit per slot,
 * so a real player the lineup builder placed in the XI can lose that
 * competition and simply not exist in `career.squad` at all. `onPitchToday`
 * can only override the position of someone already IN the pool it is
 * handed — it cannot conjure a player nobody gave it. Reported directly: a
 * player deployed at CDM in the lineup never actually took the pitch there,
 * a bench player with CDM as his own natural position kept starting there
 * instead, and the man he should have made way for never even reappeared on
 * the bench — because he was never in `career.squad` to begin with, on the
 * pitch or off it.
 *
 * Pulled from `career.leagueSquads`'s own-club entry — the same full,
 * untrimmed roster `matchdayFor`/`withFullRosterFallback` already widen the
 * pre-match team sheet with — and appended as ordinary SquadPlayer-shaped
 * stand-ins so casting (`castScenario`) sees a real candidate for the role.
 */
export function fillMissingFromFullRoster(
  squad: SquadPlayer[], roles: Map<string, Role> | null, career: CareerState | null,
): SquadPlayer[] {
  if (!roles || !career) return squad;
  const known = new Set(squad.map(p => bareSofifaId(p.id)));
  const missingIds = Array.from(roles.keys()).filter(id => !known.has(bareSofifaId(id)));
  if (missingIds.length === 0) return squad;
  const ownRoster = (career.leagueSquads ?? []).find(s => s.club === career.player.club)?.players ?? [];
  const additions: SquadPlayer[] = [];
  for (const id of missingIds) {
    const lp = ownRoster.find(p => bareSofifaId(p.id) === bareSofifaId(id));
    if (!lp) continue;
    additions.push({
      id: `sf_${bareSofifaId(lp.id)}`,
      name: lp.name,
      shortName: shortNameOf(lp.name),
      position: lp.position,
      positions: lp.positions,
      seasonGoals: lp.goals,
      seasonAssists: lp.assists,
      careerGoals: 0,
      careerAssists: 0,
      leagueGoals: lp.goals,
      leagueAssists: lp.assists,
      sofifaId: lp.id,
      overall: lp.overall,
      imageUrl: lp.image,
      nationality: lp.nation,
      age: lp.age,
    });
  }
  return additions.length > 0 ? [...squad, ...additions] : squad;
}
