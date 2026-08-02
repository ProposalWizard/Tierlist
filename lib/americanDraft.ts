import { attributesFromJson } from "@/lib/playerAttributes";
import { fetchAllRows } from "@/lib/fetchAllRows";
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
}

/** 11 starters in 4-3-3 order, then 3 substitutes. */
export const AM_POSITION_SEQUENCE = [
  "GK", "RB", "CB", "CB", "LB", "CM", "CM", "CM", "RW", "ST", "LW",
  "ANY", "ANY", "ANY",
];

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
export function americanPicksToSquad(picks: SquadPick[]) {
  return picks.map(pick => {
    const p = pick.player;
    const isSubPick = pick.position === "ANY";
    return {
      name: p.name,
      overall: p.ovr,
      positions: p.positions,
      club: p.club,
      clubYear: p.season ? `${p.club} ${p.season}` : p.club,
      assignedPosition: isSubPick ? (p.positions.split(",")[0]?.trim() || "CM") : pick.position,
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

const POS_FILTER: Record<string, string[]> = {
  GK:  ["GK"],
  RB:  ["RB", "RWB"],
  CB:  ["CB"],
  LB:  ["LB", "LWB"],
  CM:  ["CM", "CDM", "CAM"],
  RW:  ["RW", "RM"],
  LW:  ["LW", "LM"],
  ST:  ["ST", "CF"],
  ANY: [],
};

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

// Every eligible Premier League row for an era, loaded once and cached.
//
// The previous approach asked for 1500 rows from six random editions with no
// ORDER BY. A PL edition is only ~560 rows, so the limit was exhausted after
// two or three of them — and since scan order follows the (league, fifa_year)
// index, it was always the EARLIEST ones. That is why a round came back
// entirely 2009/10 rather than spread across the era. Holding the whole era in
// memory and sampling in JS removes the truncation completely, and makes every
// round after the first cost no query at all.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const eraPoolCache = new Map<string, { rows: any[]; at: number }>();
const ERA_POOL_TTL_MS = 10 * 60 * 1000;

const POOL_COLS =
  "sofifa_id, name, overall, manual_overall, positions, manual_positions, age, image_url, nationality, manual_nationality, club, fifa_edition, fifa_year";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getEraPool(service: any, eraStart: number, eraEnd: number): Promise<any[]> {
  const key = `${eraStart}-${eraEnd}`;
  const cached = eraPoolCache.get(key);
  if (cached && Date.now() - cached.at < ERA_POOL_TTL_MS) return cached.rows;

  const leagues = await getPLLeagueNames(service);
  if (leagues.length === 0) {
    throw new Error("No Premier League rows found — is the player data imported?");
  }

  // Paged, because PostgREST caps a single select at 1000 rows regardless of
  // limit — the exact trap that truncated this before.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = await fetchAllRows<any>((from, to) =>
    (service as any)
      .from("sofifa_players")
      .select(POOL_COLS)
      .in("league", leagues)
      .not("overall", "is", null)
      .gte("fifa_year", eraStart)
      .lte("fifa_year", eraEnd)
      .order("sofifa_id", { ascending: true })
      .order("fifa_year", { ascending: true })
      .range(from, to),
    40000,
  );

  if (rows.length > 0) eraPoolCache.set(key, { rows, at: Date.now() });
  return rows;
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

  const all = await getEraPool(service, eraStart, eraEnd);

  const filtered = all.filter(r => {
    const clubName = (r.club || "").toLowerCase();
    if (NON_ENGLISH_PL_CLUBS.has(clubName)) return false;
    if (excluded.has(`id:${r.sofifa_id}`)) return false;
    if (excluded.has(`name:${playerNameKey(r.name)}`)) return false;
    if (allowed.length === 0) return true;
    const pos = resolvePositions(r).toUpperCase();
    const parts = pos.split(",").map((x: string) => x.trim());
    return allowed.some(p => parts.includes(p));
  });

  if (filtered.length === 0) {
    throw new Error(
      `No Premier League players available for ${position}. ` +
      `Everyone eligible may already have been drafted.`
    );
  }

  // Shuffled across the WHOLE era, so every edition is equally likely.
  const shuffled = shuffleArray(filtered);
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

  // Prime mode shows each player at their best-ever edition. The era pool is
  // already in memory, so this is a lookup rather than another query.
  if (opts.prime && chosen.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bestById = new Map<string, any>();
    for (const row of all) {
      const cur = bestById.get(row.sofifa_id);
      if (!cur || resolveOvr(row) > resolveOvr(cur)) bestById.set(row.sofifa_id, row);
    }
    for (let i = 0; i < chosen.length; i++) {
      const best = bestById.get(chosen[i].sofifa_id);
      if (best && resolveOvr(best) > resolveOvr(chosen[i])) chosen[i] = best;
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

export function shuffleArray<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}
