import { attributesFromJson } from "@/lib/playerAttributes";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { shuffle } from "@/lib/shuffle";
import { positionFitness } from "@/lib/seasonSimulator";
import type { PlayerAttributes } from "@/lib/seasonSimulator";

export interface AmPlayer {
  sofifa_id: string;
  name: string;
  ovr: number;
  positions: string;
  age: number;
  image_url: string | null;
  nationality: string;
  club: string;
  club_logo_url: string | null;
  edition: string;
  /** Season the rating is from, e.g. "2018/19". Derived from fifa_year. */
  season: string;
  /**
   * Edition year, kept so attributes can be looked up at the end of the draft.
   * Attributes are deliberately NOT stored on the player: american_state is
   * rewritten on EVERY pick and pushed to every client over Realtime, so
   * carrying ~22 numbers per player for the round pool plus every accumulated
   * pick made that payload grow all draft long — which is what made later
   * picks take seconds to register.
   */
  fifa_year: number;
}

// FIFA editions are named for the year they release in, but cover the season
// that starts the year before: FIFA 19 (fifa_year 2019) is the 2018/19 season.
export function seasonLabel(fifaYear: number | null | undefined): string {
  if (!fifaYear || fifaYear < 1990) return "";
  const start = fifaYear - 1;
  return `${start}/${String(fifaYear % 100).padStart(2, "0")}`;
}

// club_logos is keyed on the club name as SoFIFA spelled it, which drifts
// between editions ("Man Utd" vs "Manchester United", stray accents, "&" vs
// "and"). Normalise both sides so a logo scraped from one edition still
// matches a player row from another.
// Two rows can describe the same footballer under different sofifa_ids — the
// SoFIFA data has genuine duplicates, which is how three Diogo Dalots (two of
// them the same season) reached one pool. Matching on a normalised name as well
// as the id catches those. The cost is that two genuinely different players who
// share a name collapse to one entry, which is the right trade here: the draft
// only ever needs 10 of several hundred candidates.
export function playerNameKey(name: string): string {
  return (name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function normalizeClubKey(club: string): string {
  return club
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")   // strip accents
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");        // drop spaces, dots, hyphens
}

export interface SquadPick {
  round: number;
  position: string;
  player: AmPlayer;
}

export interface AmParticipant {
  id: string;
  user_id: string;
  display_name: string;
  squad: SquadPick[];
  last_pick: AmPlayer | null;
  joined_at: string;
}

export interface AmRoom {
  id: string;
  code: string;
  host_id: string | null;
  status: "lobby" | "drafting" | "complete";
  position_sequence: string[];
  current_round: number;
  pick_order: string[];
  current_pick_idx: number;
  round_players: AmPlayer[];
  linked_room_code: string | null;
  created_at: string;
  expires_at: string;
}

// ── American draft run inside a normal multiplayer room ──────────────────────
// Lives on draft_rooms.american_state so it rides the room's existing Realtime
// subscription and needs no second room to hand off to.

export interface AmericanState {
  position_sequence: string[];
  current_round: number;
  pick_order: string[];
  current_pick_idx: number;
  round_players: AmPlayer[];
  picks: Record<string, SquadPick[]>;
  last_pick: Record<string, AmPlayer>;
  complete: boolean;

  // ── Between-season replacement draft ──────────────────────────────────────
  /**
   * "initial" fills a whole squad position by position. "replacement" refills
   * the gaps left by departures and sales from ONE mixed pool, because a
   * position-by-position draft makes no sense when each manager has lost a
   * different set of positions.
   */
  mode?: "initial" | "replacement";
  /** userId → replacements still owed. A manager drops out once theirs hits 0. */
  vacancies?: Record<string, number>;
  /** userId → lost their keeper, so the pool must contain one for them. */
  needs_gk?: Record<string, boolean>;
  /** Reverse league standings, worst first — the pick order every round. */
  standings_order?: string[];
  /** userId → their post-departure squad, collected before the draft starts. */
  pending_vacancies?: Record<string, { count: number; needsGk: boolean }>;
  /**
   * Set once a pool has been built. The seeding write is conditional on this
   * being absent, so two managers submitting simultaneously cannot each seed a
   * different pool.
   */
  seeded?: boolean;

  /**
   * Epoch ms by which the current picker must choose. Past it, ANY member of
   * the room can ask the server to auto-pick for them.
   *
   * Without this a single player closing their laptop mid-draft froze the room
   * for everyone, permanently: picks require it to be your turn, and there was
   * no clock, no auto-pick and no host override. If they then left, their id
   * stayed in pick_order while rejoining a started room was refused, so the
   * room became unrecoverable by anyone.
   */
  pick_deadline?: number;
}

/** Seconds a manager gets to make a pick before anyone can auto-pick for them. */
export const AM_PICK_SECONDS = 60;

/** Deadline for a turn starting now. */
export function nextPickDeadline(): number {
  return Date.now() + AM_PICK_SECONDS * 1000;
}

/**
 * 11 starters in 4-3-3 order, back to front, then 3 substitutes.
 *
 * These slots must be exactly the 4-3-3 entry in components/draft/formations.ts,
 * which is the formation the arrange screen lays the squad out in. They drifted
 * once: this drafted three centre-mids while the formation asks for a CDM and
 * two CMs, so the arrange screen had to put a CM in the CDM slot — showing an
 * out-of-position marker, and costing that player a fitness penalty in the
 * simulation, on every single American squad. tests/americanDraft/formations.mts
 * fails if they ever diverge again.
 */
export const AM_POSITION_SEQUENCE = [
  "GK", "RB", "CB", "CB", "LB", "CDM", "CM", "CM", "RW", "ST", "LW",
  "ANY", "ANY", "ANY",
];

/** Substitute rounds appended after the starting eleven. */
export const AM_BENCH_ROUNDS = 3;

/**
 * The round sequence for a formation: one round per starting slot, back to
 * front, then the bench rounds.
 *
 * Back to front matters. Drafting keeper-first means the scarcest, most
 * position-locked slots are filled while the pool is deepest — by the time the
 * forward rounds come round, a manager short of options can still fall back on
 * a winger, whereas nobody can improvise a goalkeeper.
 *
 * Returns null for any formation carrying a slot the draft has no filter for,
 * because a round with no filter would offer the entire database. Callers
 * should fall back to AM_POSITION_SEQUENCE.
 */
export function positionSequenceForFormation(
  slots: Array<{ label: string; y: number }>,
): string[] | null {
  if (slots.length !== 11) return null;
  const labels = slots.map(s => s.label.toUpperCase());
  if (!labels.every(isDraftableSlot)) return null;

  // y is the share of the pitch from the top, so the biggest y is the keeper.
  const ordered = [...slots]
    .sort((a, b) => b.y - a.y)
    .map(s => s.label.toUpperCase());

  return [...ordered, ...Array.from({ length: AM_BENCH_ROUNDS }, () => "ANY")];
}

export function makeAmericanState(userIds: string[], firstRoundPlayers: AmPlayer[]): AmericanState {
  return {
    position_sequence: [...AM_POSITION_SEQUENCE],
    current_round: 0,
    pick_order: shuffleArray(userIds),
    current_pick_idx: 0,
    round_players: firstRoundPlayers,
    picks: {},
    last_pick: {},
    complete: false,
    pick_deadline: nextPickDeadline(),
  };
}

/**
 * Seed a between-season replacement draft.
 *
 * Rounds run until nobody is owed a player, so the number of rounds is the
 * largest number of vacancies any single manager has. A manager only appears in
 * the rounds they still need, which is why the pick order is rebuilt each round
 * rather than fixed. Order is straight reverse standings — worst finisher first,
 * as in a real draft — not snaked.
 */
export function makeReplacementState(
  vacancies: Record<string, number>,
  needsGk: Record<string, boolean>,
  standingsOrder: string[],
  firstRoundPlayers: AmPlayer[],
): AmericanState {
  const maxRounds = Math.max(0, ...Object.values(vacancies));
  return {
    // Mixed pool, so the sequence is only there to give the board a round count.
    position_sequence: Array.from({ length: maxRounds }, () => "ANY"),
    current_round: 0,
    pick_order: participantsForRound(vacancies, standingsOrder),
    current_pick_idx: 0,
    round_players: firstRoundPlayers,
    picks: {},
    last_pick: {},
    complete: false,
    mode: "replacement",
    vacancies,
    needs_gk: needsGk,
    standings_order: standingsOrder,
    pick_deadline: nextPickDeadline(),
  };
}

/** Everyone still owed a player, in reverse-standings order. */
export function participantsForRound(
  vacancies: Record<string, number>,
  standingsOrder: string[],
): string[] {
  return standingsOrder.filter(uid => (vacancies[uid] ?? 0) > 0);
}

/** How many keepers the next pool must contain for the managers in it. */
export function goalkeepersNeeded(
  participants: string[],
  needsGk: Record<string, boolean>,
): number {
  return participants.filter(uid => needsGk[uid]).length;
}

/**
 * Convert a finished American squad into the DraftPlayer shape the season
 * simulator consumes. "ANY" rounds become substitutes assigned to the player's
 * own primary position; every other round keeps its slot position so the
 * formation lines up.
 */
export function americanPicksToSquad(picks: SquadPick[], anyMeansSub = true) {
  return picks.map(pick => {
    const p = pick.player;
    // In the initial draft "ANY" is a bench slot. In the replacement draft the
    // whole pool is mixed, so every round's slot is "ANY" — treating those as
    // substitutes marked EVERY replacement as a bench player, leaving a manager
    // who lost three starters with an eight-man starting XI and a team strength
    // computed from only those eight.
    const isSubPick = anyMeansSub && pick.position === "ANY";
    return {
      name: p.name,
      overall: p.ovr,
      positions: p.positions,
      club: p.club,
      clubYear: p.season ? `${p.club} ${p.season}` : p.club,
      assignedPosition: pick.position === "ANY"
        ? (p.positions.split(",")[0]?.trim() || "CM")
        : pick.position,
      sofifa_id: p.sofifa_id,
      image_url: p.image_url,
      nationality: p.nationality,
      age: p.age,
      isSub: isSubPick,
    };
  });
}

/**
 * Attach attributes to finished squads, in ONE query for the whole draft.
 *
 * The season simulator branches on whether a player has attributes: without
 * them it counts midfielders at HALF their rating and gives full backs no
 * attacking contribution, so an 83-average squad simulated at 67 strength.
 * Doing this once at the end keeps the attributes out of the live draft state.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function attachSquadAttributes(
  service: any,
  squads: Array<{ squad: DraftPlayerLike[]; fifaYears: number[] }>,
): Promise<void> {
  const ids = Array.from(new Set(squads.flatMap(s => s.squad.map(p => p.sofifa_id)).filter((x): x is string => !!x)));
  const years = Array.from(new Set(squads.flatMap(s => s.fifaYears).filter(Boolean)));
  if (ids.length === 0) return;

  // Bounded by both id and edition — an id-only lookup returns every edition of
  // every player, which is a lot of large JSONB for nothing.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (service as any)
    .from("sofifa_players")
    .select("sofifa_id, fifa_year, attributes")
    .in("sofifa_id", ids);
  if (years.length > 0) q = q.in("fifa_year", years);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = (await q) as { data: any[] | null };

  const byKey = new Map<string, PlayerAttributes>();
  for (const row of data ?? []) {
    byKey.set(`${row.sofifa_id}:${row.fifa_year}`, attributesFromJson(row.attributes));
  }

  for (const entry of squads) {
    entry.squad.forEach((p, i) => {
      const year = entry.fifaYears[i];
      const attrs = byKey.get(`${p.sofifa_id}:${year}`);
      if (attrs) p.attrs = attrs;
    });
  }
}

/** Minimal shape attachSquadAttributes mutates. sofifa_id is optional because
 *  the simulator's DraftPlayer does not declare it. */
interface DraftPlayerLike {
  sofifa_id?: string;
  attrs?: PlayerAttributes;
}

export const POSITION_LABELS: Record<string, string> = {
  GK:  "Goalkeeper",
  RB:  "Right Back",
  CB:  "Centre Back",
  LB:  "Left Back",
  CM:  "Central Midfielder",
  RW:  "Right Winger",
  LW:  "Left Winger",
  ST:  "Striker",
  ANY: "Substitute",
};

// The attributes JSONB is deliberately NOT selected — it's a large blob and this
// runs once per round (14 per game), so pulling it for hundreds of rows burned
// egress for two fallback fields.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveOvr(row: any): number {
  const candidates = [row.manual_overall, row.overall];
  for (const v of candidates) {
    if (typeof v === "number") return Math.round(v);
  }
  return 70;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolvePositions(row: any): string {
  return (row.manual_positions || row.positions || "").toString();
}

/**
 * A player is offered for a slot only if the SIMULATOR considers him a real fit
 * for it. Two separate ideas of "can play here" had drifted apart: the draft
 * offered CF for striker, which the simulator scores 0.68 — properly out of
 * position — and offered any right-mid at right wing, including one who is also
 * a right-back, which scores 0.85. Asking the simulator directly means the two
 * can never disagree again.
 *
 * The bar is 0.98, not a perfect 1.0. A defensive or attacking mid at centre
 * mid scores 0.98 — near enough to play there, and excluding them would leave
 * those players undraftable entirely while the only formation is 4-3-3.
 */
const MIN_SLOT_FITNESS = 0.98;

// Candidate positions per slot. Kept as a cheap pre-filter; the fitness check
// above is what actually decides.
//
// Covers every slot label used by ANY formation in components/draft/formations.ts,
// not just the 4-3-3 the draft currently runs. A slot with no entry here would
// fall through to "no filter" and offer the whole database for that round, so
// the set must stay in step with the formations list.
const POS_FILTER: Record<string, string[]> = {
  GK:  ["GK"],
  RB:  ["RB", "RWB"],
  CB:  ["CB"],
  LB:  ["LB", "LWB"],
  CM:  ["CM", "CDM", "CAM"],
  RW:  ["RW", "RM"],
  LW:  ["LW", "LM"],
  ST:  ["ST", "CF"],
  // Slots only other formations use. Deliberately as tight as the ones above —
  // each is the mirror of its counterpart, and positionFitness still has the
  // final say on everything these let through.
  CDM: ["CDM", "CM"],
  CAM: ["CAM", "CM"],
  RM:  ["RM", "RW"],
  LM:  ["LM", "LW"],
  RWB: ["RWB", "RB"],
  LWB: ["LWB", "LB"],
  ANY: [],
};

/** Slot labels the draft can build a round for. */
export function isDraftableSlot(label: string): boolean {
  return Object.prototype.hasOwnProperty.call(POS_FILTER, label.toUpperCase());
}

// Matches English Premier League across all FIFA edition naming conventions.
// Anchored to avoid catching Scottish/Russian/Ukrainian Premier Leagues.
const PL_OR_FILTER =
  "league.ilike.Premier League%,league.ilike.English Premier League%,league.ilike.Barclays Premier League%";

// Clubs that share the same league name string but are NOT English PL clubs.
const NON_ENGLISH_PL_CLUBS = new Set(
  [
    "Dynamo Kyiv", "Shakhtar Donetsk",
    "Akhmat Grozny", "Alaniya", "Arsenal Tula", "FC Amkar Perm",
    "FC Anzhi Makhachkala", "FC Dynamo Moscow", "FC Khimki", "FC Krasnodar",
    "FC Kuban Krasnodar", "FC Lokomotiv", "FC Moscow", "FC Orenburg",
    "FC Rostov", "FC Tom Tomsk", "FC Tosno", "FC Ufa", "FC Ural Yekaterinburg",
    "FC Volga Nizhny Novgorod", "Mordovia Saransk", "PFC CSKA",
    "PFC Krylia Sovetov Samara", "Rubin Kazan", "SKA Khabarovsk",
    "Saturn Ramenskoye", "Spartak Moscow", "Spartak Nalchik", "Torpedo Moscow",
    "FC Sibir Novosibirsk", "Zenit",
  ].map(c => c.toLowerCase())
);

// club_logos is small and changes only when an admin re-imports it, but
// fetchRoundPlayers runs once per round (14 per game), so cache it in module
// scope rather than refetching the whole table every time.
let clubLogoCache: { map: Map<string, string>; at: number } | null = null;
const CLUB_LOGO_TTL_MS = 10 * 60 * 1000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getClubLogoMap(service: any): Promise<Map<string, string>> {
  if (clubLogoCache && Date.now() - clubLogoCache.at < CLUB_LOGO_TTL_MS) {
    return clubLogoCache.map;
  }

  // Index by normalised name: an .in("club", …) exact match misses whenever the
  // badge was scraped from an edition that spelled the club differently.
  const map = new Map<string, string>();
  const { data: logos } = (await service
    .from("club_logos")
    .select("club, logo_url")
    .limit(5000)) as { data: { club: string; logo_url: string }[] | null };

  (logos ?? []).forEach(l => {
    const key = normalizeClubKey(l.club || "");
    if (key && !map.has(key)) map.set(key, l.logo_url);
  });

  // Don't cache an empty result — that's usually a transient failure, and
  // caching it would blank every badge for the whole TTL.
  if (map.size > 0) clubLogoCache = { map, at: Date.now() };
  return map;
}

/**
 * Build one round's pool of 10 players.
 *
 * `excludeSofifaIds` are players already taken by ANYONE earlier in this draft.
 * A player is one person, not one row: the same sofifa_id appears once per FIFA
 * edition, so without both the exclusion and the per-id dedup below you get the
 * same footballer three times in one pool (and again at another position later).
 * Picking one of those duplicates then removed every row sharing that id, which
 * is what made the board disagree between players.
 */
// The exact league names vary by edition ("Premier League", "Barclays Premier
// League", …). Discovered once per process with a small LIMITed probe, then
// reused as an equality list so the (league, fifa_year) btree index can serve
// the round queries. An ILIKE on league cannot use that index under the default
// collation, so filtering that way scanned the entire table every round —
// which is what produced "canceling statement due to statement timeout".
let plLeagueNames: string[] | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getPLLeagueNames(service: any): Promise<string[]> {
  if (plLeagueNames && plLeagueNames.length > 0) return plLeagueNames;

  // Postgres can stop as soon as the limit is met, so this probe is cheap even
  // though the pattern itself is not indexable.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = (await (service as any)
    .from("sofifa_players")
    .select("league")
    .or(PL_OR_FILTER)
    .limit(400)) as { data: { league: string | null }[] | null };

  const names = Array.from(
    new Set((data ?? []).map(r => r.league).filter((l): l is string => !!l))
  );
  if (names.length > 0) plLeagueNames = names;
  return names;
}

/** Slices fired at once. Twenty-four together is what triggered the timeouts. */
const SLICE_BATCH = 6;

/**
 * Run a Supabase query, retrying the transient failures.
 *
 * A statement timeout is not a real error — it means the database was busy for
 * a moment. Surfacing it to the player was wrong: they saw "canceling statement
 * due to statement timeout", pressed Start again, and it worked. Backing off and
 * retrying turns that into a slightly slower success. Only genuine failures
 * (a missing column, bad SQL) survive all the attempts and get reported.
 */
async function withQueryRetry<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  run: () => PromiseLike<{ data: T[] | null; error?: { message: string } | null }>,
  label: string,
  attempts = 3,
): Promise<T[]> {
  let lastMessage = "unknown error";
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, 250 * Math.pow(3, attempt - 1)));
    }
    const { data, error } = await run();
    if (!error) return data ?? [];
    lastMessage = error.message;
    // A timeout or a dropped connection is worth another go; anything else is
    // a real fault and retrying only delays the report.
    if (!/timeout|timed out|canceling statement|connection|fetch failed|network/i.test(error.message)) {
      break;
    }
  }
  throw new Error(`${label}: ${lastMessage}`);
}

// Bounds of the eligible id range, cached. Two tiny indexed queries.
let idBoundsCache: { key: string; min: number; max: number; at: number } | null = null;
const BOUNDS_TTL_MS = 10 * 60 * 1000;

const POOL_COLS =
  "id, sofifa_id, name, overall, manual_overall, positions, manual_positions, age, image_url, nationality, manual_nationality, club, fifa_edition, fifa_year";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function eligible(service: any, leagues: string[], eraStart: number, eraEnd: number) {
  return (service as any)
    .from("sofifa_players")
    .select(POOL_COLS)
    .in("league", leagues)
    .not("overall", "is", null)
    .gte("fifa_year", eraStart)
    .lte("fifa_year", eraEnd);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getIdBounds(service: any, leagues: string[], eraStart: number, eraEnd: number) {
  const key = `${eraStart}-${eraEnd}`;
  if (idBoundsCache && idBoundsCache.key === key && Date.now() - idBoundsCache.at < BOUNDS_TTL_MS) {
    return idBoundsCache;
  }
  const [lo, hi] = await Promise.all([
    withQueryRetry<{ id: number }>(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => eligible(service, leagues, eraStart, eraEnd).order("id", { ascending: true }).limit(1) as any,
      "pool bounds (min)",
    ),
    withQueryRetry<{ id: number }>(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => eligible(service, leagues, eraStart, eraEnd).order("id", { ascending: false }).limit(1) as any,
      "pool bounds (max)",
    ),
  ]);
  const min = lo?.[0]?.id ?? 0;
  const max = hi?.[0]?.id ?? 0;
  if (!max) throw new Error("No Premier League players found — is the player data imported?");
  const bounds = { key, min, max, at: Date.now() };
  idBoundsCache = bounds;
  return bounds;
}

// The complete eligible set for an era, cached in memory along with the
// weighting data derived from it.
interface EraPool {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows: any[];
  at: number;
  /** fifa_year → the rating that counts as "weak" in THAT season. */
  weakBelow: Map<number, number>;
  /** sofifa_id → their best rating and the season it came from. */
  best: Map<string, { ovr: number; year: number }>;
}
const eraPoolCache = new Map<string, EraPool>();
const ERA_POOL_TTL_MS = 10 * 60 * 1000;

// ── Persistent cache in Supabase Storage ─────────────────────────────────────
// The module-scope caches above die with the serverless instance, so any pick
// or seed that landed on a cold instance rebuilt the whole era pool from the
// database — the multi-second stall players felt "after a few minutes idle".
// The same pool serialised into the storage bucket survives instances: a cold
// start becomes one storage GET instead of ~28 table queries. Storage is only
// ever an optimisation here — every read and write is guarded, and any failure
// falls back to the database path that already works.
const CACHE_BUCKET = "tierlist-images";
const CACHE_PREFIX = "draft-cache";
const ERA_POOL_STORAGE_TTL_MS = 30 * 60 * 1000;
/** How often a warm instance re-persists its pool so the file stays fresh. */
const ERA_POOL_REPERSIST_MS = 15 * 60 * 1000;
const lastPersist = new Map<string, number>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function readCacheJson(service: any, path: string): Promise<any | null> {
  try {
    const { data, error } = await service?.storage
      ?.from(CACHE_BUCKET)
      .download(`${CACHE_PREFIX}/${path}`) ?? { data: null, error: true };
    if (error || !data) return null;
    return JSON.parse(await data.text());
  } catch {
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function writeCacheJson(service: any, path: string, obj: unknown): Promise<void> {
  try {
    await service?.storage
      ?.from(CACHE_BUCKET)
      .upload(`${CACHE_PREFIX}/${path}`, JSON.stringify(obj), {
        upsert: true,
        contentType: "application/json",
        cacheControl: "no-cache",
      });
  } catch {
    // best effort only
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function removeCacheJson(service: any, path: string): void {
  try {
    void service?.storage?.from(CACHE_BUCKET).remove([`${CACHE_PREFIX}/${path}`]);
  } catch {
    // best effort only
  }
}

// Derived maps are rebuilt from rows rather than stored: they are pure
// functions of the rows and Maps don't survive JSON anyway.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function poolFromRows(rows: any[]): EraPool {
  const best = new Map<string, { ovr: number; year: number }>();
  for (const r of rows) {
    const o = resolveOvr(r);
    const cur = best.get(r.sofifa_id);
    if (!cur || o > cur.ovr) best.set(r.sofifa_id, { ovr: o, year: r.fifa_year });
  }
  return { rows, at: Date.now(), weakBelow: computeWeakThresholds(rows), best };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function persistEraPool(service: any, key: string, rows: any[]): void {
  lastPersist.set(key, Date.now());
  void writeCacheJson(service, `era-pool-${key}.json`, { builtAt: Date.now(), rows });
}

/**
 * Squad players are far more numerous than starters — roughly a third of every
 * club's roster is academy and reserve — so an even draw fills the board with
 * players who never actually played. Weak players get a fraction of a ticket
 * rather than being removed, so a scrappy squad player is a rare curiosity
 * instead of a third of every round.
 */
const WEAK_PLAYER_WEIGHT = 0.03;

/**
 * "Weak" is judged against the player's OWN season, never a fixed number.
 *
 * FIFA ratings have drifted upward: a 67 in 2007 was a solid squad player, a 67
 * in 2026 is a teenager. A fixed cutoff therefore penalises old seasons far
 * more than new ones and quietly makes modern players commoner — measured at
 * 21% — which is the era bias this draft has already been fixed for once.
 * Taking the same RANK within each season removes that entirely.
 */
function computeWeakThresholds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows: any[],
): Map<number, number> {
  const bySeason = new Map<number, number[]>();
  const allOvr: number[] = [];
  for (const r of rows) {
    const o = resolveOvr(r);
    allOvr.push(o);
    const list = bySeason.get(r.fifa_year);
    if (list) list.push(o); else bySeason.set(r.fifa_year, [o]);
  }
  allOvr.sort((a, b) => a - b);
  // Where "70" sits across the whole era, expressed as a rank.
  const rank = allOvr.length
    ? allOvr.filter(v => v < 70).length / allOvr.length
    : 0.4;

  const out = new Map<number, number>();
  for (const [year, list] of Array.from(bySeason.entries())) {
    list.sort((a, b) => a - b);
    const idx = Math.max(0, Math.min(list.length - 1, Math.floor(rank * list.length)));
    // +3 on top of the season's own mark. The rank alone still let through more
    // fringe players than felt right in play, and lifting the bar per season
    // keeps it era-neutral in a way a flat number would not.
    out.set(year, list[idx] + 3);
  }
  return out;
}

/**
 * Load every eligible player for the era, as PARALLEL slices of the id range.
 *
 * Sequential paging took roughly twelve round trips — 20-30 seconds on a cold
 * serverless instance, which is exactly what pressing Start Game, or picking
 * after a few minutes idle, was paying. (Rapid picking felt instant only
 * because the instance was still warm and the cache still populated.)
 *
 * Splitting the id range into slices and fetching them at once costs about one
 * round trip instead of twelve, and still returns the WHOLE pool — which
 * matters, because sampling scattered runs instead was measurably less random:
 * ids follow import order, so any contiguous run is a single season.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getEraPool(service: any, leagues: string[], eraStart: number, eraEnd: number): Promise<EraPool> {
  const key = `${eraStart}-${eraEnd}`;
  const cached = eraPoolCache.get(key);
  if (cached && Date.now() - cached.at < ERA_POOL_TTL_MS) {
    // Keep the storage copy fresh from warm instances, so whichever cold
    // instance handles the next request finds a recent file waiting.
    if (Date.now() - (lastPersist.get(key) ?? 0) > ERA_POOL_REPERSIST_MS) {
      persistEraPool(service, key, cached.rows);
    }
    return cached;
  }

  // Cold instance: one storage GET replaces the whole multi-query build below.
  const stored = await readCacheJson(service, `era-pool-${key}.json`) as
    | { builtAt?: number; rows?: unknown[] }
    | null;
  if (
    stored &&
    Array.isArray(stored.rows) &&
    stored.rows.length > 0 &&
    Date.now() - (stored.builtAt ?? 0) < ERA_POOL_STORAGE_TTL_MS
  ) {
    const pool = poolFromRows(stored.rows);
    eraPoolCache.set(key, pool);
    lastPersist.set(key, stored.builtAt ?? Date.now());
    return pool;
  }

  const { min, max } = await getIdBounds(service, leagues, eraStart, eraEnd);
  const SLICES = 24;
  const PAGE = 1000;
  const step = Math.max(1, Math.ceil((max - min + 1) / SLICES));

  // Fired in BATCHES, not all at once, and every slice retries on its own.
  //
  // Twenty-four simultaneous scans over the biggest table in the database is
  // enough load to make Postgres cancel one of them for exceeding the statement
  // timeout — and because a single failed slice aborted the whole build, that
  // surfaced as "canceling statement due to statement timeout" on Start. The
  // very next attempt then worked, since by then the pool was cached, which is
  // the worst kind of error: intermittent and invisible in testing.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byId = new Map<number, any>();
  const saturated: number[] = [];

  const fetchSlice = (i: number) => {
    const lo = min + i * step;
    return eligible(service, leagues, eraStart, eraEnd)
      .gte("id", lo)
      .lt("id", lo + step)
      .order("id", { ascending: true })
      .limit(PAGE);
  };

  for (let start = 0; start < SLICES; start += SLICE_BATCH) {
    const batch = Array.from(
      { length: Math.min(SLICE_BATCH, SLICES - start) },
      (_, k) => start + k,
    );
    const results = await Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      batch.map(i => withQueryRetry<any>(() => fetchSlice(i) as any, `pool slice ${i}`)),
    );
    results.forEach((rows, k) => {
      for (const row of rows) byId.set(row.id, row);
      if (rows.length >= PAGE) saturated.push(batch[k]);
    });
  }

  // A slice that comes back exactly full may have been truncated by the
  // server's row cap, so walk the rest of that slice by keyset. Silently
  // keeping a short slice would drop players from the pool entirely.
  for (const i of saturated) {
    const lo = min + i * step;
    const hi = lo + step;
    // reduce, not Math.max(...spread) — spreading a large array overflows the
    // call stack.
    let cursor = lo - 1;
    for (const row of Array.from(byId.values())) {
      if (row.id >= lo && row.id < hi && row.id > cursor) cursor = row.id;
    }
    for (let guard = 0; guard < 20; guard++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await withQueryRetry<any>(
        () => eligible(service, leagues, eraStart, eraEnd)
          .gt("id", cursor)
          .lt("id", hi)
          .order("id", { ascending: true })
          .limit(PAGE) as any,
        `pool top-up ${i}`,
      );
      if (data.length === 0) break;
      for (const row of data) byId.set(row.id, row);
      cursor = data[data.length - 1].id;
      if (data.length < PAGE) break;
    }
  }

  const rows = Array.from(byId.values());
  const pool = poolFromRows(rows);
  if (rows.length > 0) {
    eraPoolCache.set(key, pool);
    persistEraPool(service, key, rows);
  }
  return pool;
}

export interface RoundOptions {
  /** Inclusive fifa_year range from the room's era setting. */
  eraStart?: number;
  eraEnd?: number;
  /** Prime mode: show each player at their best-ever edition. */
  prime?: boolean;
}

/** Read the pool-shaping settings off a room's settings JSON. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function roundOptionsFromSettings(settings: any): RoundOptions {
  const s = (settings ?? {}) as Record<string, unknown>;
  const start = Number(s.eraStart);
  const end = Number(s.eraEnd);
  return {
    eraStart: Number.isFinite(start) ? start : undefined,
    eraEnd: Number.isFinite(end) ? end : undefined,
    prime: s.mode === "prime",
  };
}

/**
 * Build one round's pool.
 *
 * `excludeKeys` identify everyone already taken by anyone in this draft, by id
 * and by normalised name, so a footballer can be drafted once per draft — not
 * once per position, and not once per FIFA edition.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchRoundPlayers(
  service: any,
  position: string,
  excludeKeys: Iterable<string> = [],
  opts: RoundOptions = {},
  size = 10,
): Promise<AmPlayer[]> {
  const allowed = POS_FILTER[position] ?? [];
  const excluded = new Set(excludeKeys);
  const eraStart = opts.eraStart ?? 2007;
  const eraEnd = opts.eraEnd ?? 2026;
  const leagues = await getPLLeagueNames(service);
  if (leagues.length === 0) {
    throw new Error("No Premier League rows found — is the player data imported?");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyFilters = (input: any[]) => input.filter(r => {
    const clubName = (r.club || "").toLowerCase();
    if (NON_ENGLISH_PL_CLUBS.has(clubName)) return false;
    if (excluded.has(`id:${r.sofifa_id}`)) return false;
    if (excluded.has(`name:${playerNameKey(r.name)}`)) return false;
    if (allowed.length === 0) return true;
    const positions = resolvePositions(r);
    const parts = positions.toUpperCase().split(",").map((x: string) => x.trim());
    if (!allowed.some(p => parts.includes(p))) return false;
    // The simulator has the final say — it knows the conditional cases a list
    // cannot express, such as right-mid being a perfect right winger UNLESS he
    // is also a right-back.
    return positionFitness({
      assignedPosition: position,
      positions,
    } as Parameters<typeof positionFitness>[0]) >= MIN_SLOT_FITNESS;
  });

  const era = await getEraPool(service, leagues, eraStart, eraEnd);
  const filtered = applyFilters(era.rows);
  if (filtered.length === 0) {
    throw new Error(
      `No Premier League players available for ${position}. ` +
      `Everyone eligible may already have been drafted.`
    );
  }

  // Weighted draw, not a flat shuffle. Each row gets a key of
  // random^(1/weight) and the largest keys win — a standard weighted sample
  // without replacement, so a heavier player is likelier to appear but nothing
  // is ever guaranteed or excluded.
  //
  // In PRIME mode the weight uses the player's PEAK rating, because that is
  // what the card will show. A teenager rated 58 who later became an 88 is not
  // a weak card in prime mode, and weighting him down by the season that
  // happened to be drawn would have made exactly those careers rare.
  const weightOf = (r: { sofifa_id: string; fifa_year: number }) => {
    const judged = opts.prime ? era.best.get(r.sofifa_id) : null;
    const ovr = judged ? judged.ovr : resolveOvr(r);
    const year = judged ? judged.year : r.fifa_year;
    const weakBelow = era.weakBelow.get(year);
    if (weakBelow === undefined) return 1;
    return ovr >= weakBelow ? 1 : WEAK_PLAYER_WEIGHT;
  };

  const shuffled = [...filtered]
    .map(r => ({ r, key: Math.pow(Math.random(), 1 / weightOf(r)) }))
    .sort((a, b) => b.key - a.key)
    .map(x => x.r);

  const seen = new Set<string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chosen: any[] = [];
  for (const r of shuffled) {
    const idKey = `id:${r.sofifa_id}`;
    const nameKey = `name:${playerNameKey(r.name)}`;
    if (seen.has(idKey) || seen.has(nameKey)) continue;
    seen.add(idKey);
    seen.add(nameKey);
    chosen.push(r);
    if (chosen.length >= size) break;
  }

  // Prime: swap each player onto their best-rated edition. Searched across ALL
  // leagues, matching what the normal draft's prime mode does, so "prime" means
  // the same thing in both. Crucially the ORIGINAL positions are kept: a player
  // is offered in a round because those positions qualified them for the slot,
  // and adopting the prime season's positions instead is what left drafted
  // players sitting out of position in their own slot.
  if (opts.prime && chosen.length > 0) {
    const ids = chosen.map(r => r.sofifa_id).filter(Boolean);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: editions } = (await (service as any)
      .from("sofifa_players")
      .select(POOL_COLS)
      .in("sofifa_id", ids)) as { data: any[] | null };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bestById = new Map<string, any>();
    for (const row of editions ?? []) {
      const cur = bestById.get(row.sofifa_id);
      if (!cur || resolveOvr(row) > resolveOvr(cur)) bestById.set(row.sofifa_id, row);
    }
    for (let i = 0; i < chosen.length; i++) {
      const best = bestById.get(chosen[i].sofifa_id);
      if (best && resolveOvr(best) > resolveOvr(chosen[i])) {
        chosen[i] = {
          ...best,
          positions: chosen[i].positions,
          manual_positions: chosen[i].manual_positions,
        };
      }
    }
  }

  const logoMap = await getClubLogoMap(service);

  return chosen.map(r => ({
    sofifa_id: r.sofifa_id || "",
    name: r.name || "Unknown",
    ovr: resolveOvr(r),
    positions: resolvePositions(r),
    age: r.age || 0,
    image_url: r.image_url || null,
    nationality: (r.manual_nationality || r.nationality || ""),
    club: r.club || "",
    club_logo_url: logoMap.get(normalizeClubKey(r.club || "")) ?? null,
    edition: r.fifa_edition || "",
    season: seasonLabel(r.fifa_year),
    fifa_year: r.fifa_year,
  }));
}

/** What a custom pool filter gets to see about a candidate. */
export interface PoolCandidate {
  sofifa_id: string;
  name: string;
  ovr: number;
  positions: string;
  nationality: string;
  club: string;
  age: number;
  fifa_year: number;
}

/**
 * Build a pool from an arbitrary rule instead of a formation slot.
 *
 * The Challenge draft (app/draft-challenge-dev) picks each round by a random
 * "brief" — a rating band, a nationality, a minimum stat, a club, an era —
 * rather than by position, so it needs the same machinery fetchRoundPlayers
 * uses without POS_FILTER. Everything that matters is shared with it: the
 * cached era pool, the non-English-PL club exclusions, the weighted draw that
 * keeps fringe squad players rare, per-footballer dedup by id AND normalised
 * name, prime-mode edition swapping, and club badge resolution.
 *
 * Returns fewer than `size` players when the rule simply does not match enough
 * people; callers decide whether that is usable. It never throws for an empty
 * result, because a brief that comes up short is a normal thing to discard.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchCustomRoundPlayers(
  service: any,
  match: (c: PoolCandidate) => boolean,
  excludeKeys: Iterable<string> = [],
  opts: RoundOptions = {},
  size = 10,
): Promise<AmPlayer[]> {
  const excluded = new Set(excludeKeys);
  const eraStart = opts.eraStart ?? 2007;
  const eraEnd = opts.eraEnd ?? 2026;
  const leagues = await getPLLeagueNames(service);
  if (leagues.length === 0) {
    throw new Error("No Premier League rows found — is the player data imported?");
  }

  const era = await getEraPool(service, leagues, eraStart, eraEnd);

  const filtered = era.rows.filter(r => {
    if (NON_ENGLISH_PL_CLUBS.has((r.club || "").toLowerCase())) return false;
    if (excluded.has(`id:${r.sofifa_id}`)) return false;
    if (excluded.has(`name:${playerNameKey(r.name)}`)) return false;
    return match(toCandidate(r));
  });
  if (filtered.length === 0) return [];

  const weightOf = (r: { sofifa_id: string; fifa_year: number }) => {
    const judged = opts.prime ? era.best.get(r.sofifa_id) : null;
    const ovr = judged ? judged.ovr : resolveOvr(r);
    const year = judged ? judged.year : r.fifa_year;
    const weakBelow = era.weakBelow.get(year);
    if (weakBelow === undefined) return 1;
    return ovr >= weakBelow ? 1 : WEAK_PLAYER_WEIGHT;
  };

  const shuffled = [...filtered]
    .map(r => ({ r, key: Math.pow(Math.random(), 1 / weightOf(r)) }))
    .sort((a, b) => b.key - a.key)
    .map(x => x.r);

  const seen = new Set<string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chosen: any[] = [];
  for (const r of shuffled) {
    const idKey = `id:${r.sofifa_id}`;
    const nameKey = `name:${playerNameKey(r.name)}`;
    if (seen.has(idKey) || seen.has(nameKey)) continue;
    seen.add(idKey);
    seen.add(nameKey);
    chosen.push(r);
    if (chosen.length >= size) break;
  }

  // Prime mode deliberately does NOT swap editions here. A brief selects on the
  // drawn season's own numbers — "88-92 rated", "92+ pace", "2008/09" — so
  // replacing that row with a different season's would hand back cards that
  // openly contradict the brief they were drawn for.
  const logoMap = await getClubLogoMap(service);
  return chosen.map(r => ({
    sofifa_id: r.sofifa_id || "",
    name: r.name || "Unknown",
    ovr: resolveOvr(r),
    positions: resolvePositions(r),
    age: r.age || 0,
    image_url: r.image_url || null,
    nationality: (r.manual_nationality || r.nationality || ""),
    club: r.club || "",
    club_logo_url: logoMap.get(normalizeClubKey(r.club || "")) ?? null,
    edition: r.fifa_edition || "",
    season: seasonLabel(r.fifa_year),
    fifa_year: r.fifa_year,
  }));
}

/** How many eligible players a rule matches — used to reject unusable briefs. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function countMatching(
  service: any,
  match: (c: PoolCandidate) => boolean,
  opts: RoundOptions = {},
): Promise<number> {
  const leagues = await getPLLeagueNames(service);
  if (leagues.length === 0) return 0;
  const era = await getEraPool(service, leagues, opts.eraStart ?? 2007, opts.eraEnd ?? 2026);
  // Counts distinct footballers, not rows — twenty editions of one player is
  // one card, so a naive row count badly overstates how deep a brief is.
  const people = new Set<string>();
  for (const r of era.rows) {
    if (NON_ENGLISH_PL_CLUBS.has((r.club || "").toLowerCase())) continue;
    if (!match(toCandidate(r))) continue;
    people.add(playerNameKey(r.name) || r.sofifa_id);
  }
  return people.size;
}

/** Every eligible player's id/year, so attributes can be indexed for stat briefs. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function eligibleIdentities(
  service: any,
  opts: RoundOptions = {},
  minOverall = 0,
): Promise<{ sofifa_id: string; fifa_year: number }[]> {
  const leagues = await getPLLeagueNames(service);
  if (leagues.length === 0) return [];
  const era = await getEraPool(service, leagues, opts.eraStart ?? 2007, opts.eraEnd ?? 2026);
  const out: { sofifa_id: string; fifa_year: number }[] = [];
  for (const r of era.rows) {
    if (NON_ENGLISH_PL_CLUBS.has((r.club || "").toLowerCase())) continue;
    if (resolveOvr(r) < minOverall) continue;
    if (r.sofifa_id) out.push({ sofifa_id: r.sofifa_id, fifa_year: r.fifa_year });
  }
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toCandidate(r: any): PoolCandidate {
  return {
    sofifa_id: r.sofifa_id || "",
    name: r.name || "",
    ovr: resolveOvr(r),
    positions: resolvePositions(r),
    nationality: (r.manual_nationality || r.nationality || ""),
    club: r.club || "",
    age: r.age || 0,
    fifa_year: r.fifa_year,
  };
}

/**
 * A mixed-position pool for the replacement draft.
 *
 * `minGoalkeepers` is the number of managers in this round who lost their
 * keeper. A purely random mix could contain none, which would force someone to
 * play an outfielder in goal through no choice of their own, so that many
 * keepers are seated first and the rest of the board filled around them. The
 * final list is shuffled so the guaranteed keepers are not all at the front.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchMixedRoundPlayers(
  service: any,
  excludeKeys: Iterable<string> = [],
  opts: RoundOptions = {},
  minGoalkeepers = 0,
): Promise<AmPlayer[]> {
  const SIZE = 10;
  const gkTarget = Math.min(minGoalkeepers, SIZE);

  // "ANY" applies no position filter, so this is the whole eligible pool.
  const outfieldPool = await fetchRoundPlayers(service, "ANY", excludeKeys, opts, SIZE * 3);
  const keeperPool = gkTarget > 0
    ? await fetchRoundPlayers(service, "GK", excludeKeys, opts, SIZE)
    : [];

  const chosen: AmPlayer[] = [];
  const used = new Set<string>();
  const take = (p: AmPlayer) => {
    const idKey = `id:${p.sofifa_id}`;
    const nameKey = `name:${playerNameKey(p.name)}`;
    if (used.has(idKey) || used.has(nameKey)) return false;
    used.add(idKey);
    used.add(nameKey);
    chosen.push(p);
    return true;
  };

  for (const gk of keeperPool) {
    if (chosen.length >= gkTarget) break;
    take(gk);
  }
  for (const p of outfieldPool) {
    if (chosen.length >= SIZE) break;
    take(p);
  }

  return shuffleArray(chosen);
}

// ── Next-round staging ───────────────────────────────────────────────────────
// The pool for round N+1 used to be built inside the LAST pick of round N, so
// every round transition made the whole room wait on that one request — the
// only moment the draft ever felt slow once picking itself was optimistic.
// Instead, clients call the stage endpoint as soon as a round begins; the pool
// for the NEXT round is built during the round (dead time — people are
// picking) and parked in storage. The round-advance request then just reads it.
//
// Correctness: the staged pool excludes everyone taken so far AND the entire
// current 10-card pool, and every pick during the round comes from that pool —
// so nothing staged can be taken in the meantime. The consumer still verifies
// this against the final taken set and falls back to a live build on any
// mismatch, so a stale or foreign file can never put a taken player back on
// the board. Files are deleted on use.

export interface StagedRound {
  mode: "initial" | "replacement";
  round: number;
  players: AmPlayer[];
}

function stagedRoundPath(roomId: string, season: number, mode: string, round: number): string {
  return `room-${roomId}-s${season}-${mode}-r${round}.json`;
}

type StageRoom = {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  settings: any;
  season_number?: number | null;
};

/** Exclusion keys for the current pool itself — staged rounds must not repeat it. */
function currentPoolKeys(state: AmericanState, into: Set<string>): Set<string> {
  for (const p of state.round_players ?? []) {
    if (p.sofifa_id) into.add(`id:${p.sofifa_id}`);
    const nk = playerNameKey(p.name);
    if (nk) into.add(`name:${nk}`);
  }
  return into;
}

/**
 * Build and park the pool for the round after the one being played.
 * Returns the staged players (also when a previous call already staged them),
 * or null when there is no next round. Never throws — staging is an
 * optimisation, so any failure just means the advance falls back to a live build.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function stageNextRound(service: any, room: StageRoom, state: AmericanState): Promise<AmPlayer[] | null> {
  try {
    if (!state || state.complete) return null;
    const mode = state.mode === "replacement" ? "replacement" : "initial";
    const nextRound = state.current_round + 1;
    const season = Number(room.season_number) || 1;
    const path = stagedRoundPath(room.id, season, mode, nextRound);

    const existing = await readCacheJson(service, path) as StagedRound | null;
    if (existing && existing.mode === mode && existing.round === nextRound && existing.players?.length) {
      return existing.players;
    }

    const opts = roundOptionsFromSettings(room.settings);
    const excl = currentPoolKeys(state, pickedPlayerKeys(state.picks));
    let players: AmPlayer[];

    if (mode === "initial") {
      if (nextRound >= state.position_sequence.length) return null;
      players = await fetchRoundPlayers(service, state.position_sequence[nextRound], excl, opts);
    } else {
      // Predict who is still owed a player once this round's remaining picks
      // are made: everyone from the current picker onward picks exactly once.
      const vac = state.vacancies ?? {};
      const remaining = new Set(state.pick_order.slice(state.current_pick_idx));
      const predicted: Record<string, number> = {};
      for (const uid of Object.keys(vac)) {
        predicted[uid] = (vac[uid] ?? 0) - (remaining.has(uid) ? 1 : 0);
      }
      const nextParticipants = participantsForRound(predicted, state.standings_order ?? state.pick_order);
      if (nextParticipants.length === 0) return null;

      // Squads persist between seasons, so exclude every roster in the room.
      const { data: rosters } = await service
        .from("draft_room_players")
        .select("squad")
        .eq("room_id", room.id);
      for (const r of rosters ?? []) {
        for (const sp of ((r?.squad as Array<{ sofifa_id?: string; name?: string }>) ?? [])) {
          if (sp?.sofifa_id) excl.add(`id:${sp.sofifa_id}`);
          const nk = playerNameKey(sp?.name ?? "");
          if (nk) excl.add(`name:${nk}`);
        }
      }

      // A keeper picked later this round can only DECREASE the need, so this
      // guess never under-provides goalkeepers — at worst the pool has a spare.
      const gkNeed = goalkeepersNeeded(nextParticipants, state.needs_gk ?? {});
      players = await fetchMixedRoundPlayers(service, excl, opts, gkNeed);
    }

    if (!players || players.length === 0) return null;
    await writeCacheJson(service, path, { mode, round: nextRound, players } satisfies StagedRound);
    return players;
  } catch {
    return null;
  }
}

/**
 * Consume a staged pool for a round advance. Validates that the file is for
 * exactly this round, that nothing in it has since been taken, and that it
 * carries enough goalkeepers — on any doubt it returns null and the caller
 * builds the pool live. The file is removed either way: it is either used now
 * or wrong forever.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function takeStagedRound(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: any,
  room: StageRoom,
  mode: "initial" | "replacement",
  round: number,
  takenKeys: Set<string>,
  minGoalkeepers = 0,
): Promise<AmPlayer[] | null> {
  try {
    const season = Number(room.season_number) || 1;
    const path = stagedRoundPath(room.id, season, mode, round);
    const staged = await readCacheJson(service, path) as StagedRound | null;
    removeCacheJson(service, path);

    if (!staged || staged.mode !== mode || staged.round !== round) return null;
    const players = staged.players ?? [];
    if (players.length === 0) return null;

    const clean = players.every(p =>
      !takenKeys.has(`id:${p.sofifa_id}`) && !takenKeys.has(`name:${playerNameKey(p.name)}`)
    );
    if (!clean) return null;

    const gks = players.filter(p =>
      (p.positions || "").toUpperCase().split(",").map(x => x.trim()).includes("GK")
    ).length;
    if (gks < minGoalkeepers) return null;

    return players;
  } catch {
    return null;
  }
}

/** Best-effort cleanup once a draft finishes — a staged pool for a round that
 * will never be played must not survive into a later draft. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function discardStagedRound(service: any, room: StageRoom, mode: "initial" | "replacement", round: number): void {
  const season = Number(room.season_number) || 1;
  removeCacheJson(service, stagedRoundPath(room.id, season, mode, round));
}

/**
 * Identity keys for every player already taken in this draft — by sofifa_id and
 * by normalised name, so neither a second FIFA edition of the same footballer
 * nor a duplicate row under a different id can come back around.
 */
export function pickedPlayerKeys(picks: Record<string, SquadPick[]>): Set<string> {
  const keys = new Set<string>();
  for (const list of Object.values(picks ?? {})) {
    for (const p of list ?? []) {
      const player = p?.player;
      if (!player) continue;
      if (player.sofifa_id) keys.add(`id:${player.sofifa_id}`);
      const nk = playerNameKey(player.name);
      if (nk) keys.add(`name:${nk}`);
    }
  }
  return keys;
}

/** Re-exported so existing call sites keep working. See lib/shuffle.ts. */
export const shuffleArray = shuffle;
