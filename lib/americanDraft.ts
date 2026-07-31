import { attributesFromJson } from "@/lib/playerAttributes";
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
   * Detailed attributes for the season simulator. Without these it falls back
   * to a crude approximation that counts midfielders at HALF their rating, so
   * a squad of 90-rated players simulated like a mid-table side.
   */
  attrs?: PlayerAttributes;
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
      attrs: p.attrs,
    };
  });
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

const ALL_FIFA_YEARS = Array.from({ length: 20 }, (_, i) => 2007 + i);

/**
 * Build one round's pool of 10 players.
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
): Promise<AmPlayer[]> {
  const allowed = POS_FILTER[position] ?? [];
  const excluded = new Set(excludeKeys);

  const SELECT_COLS =
    "sofifa_id, name, overall, manual_overall, positions, manual_positions, age, image_url, nationality, manual_nationality, club, fifa_edition, fifa_year";

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
    const pos = resolvePositions(r).toUpperCase();
    const parts = pos.split(",").map((x: string) => x.trim());
    return allowed.some(p => parts.includes(p));
  });

  // Positions are filtered in JS, never in SQL. `positions ILIKE '%GK%'` has a
  // leading wildcard and there is no index on that column, so it forced a scan
  // of every row. Narrowing to a handful of editions instead keeps the query on
  // the (league, fifa_year) index and gives a different pool each round.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const runQuery = async (years: number[] | null) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (service as any)
      .from("sofifa_players")
      .select(SELECT_COLS)
      .in("league", leagues)
      .not("overall", "is", null);
    if (years) q = q.in("fifa_year", years);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (await q.limit(1500)) as { data: any[] | null; error: any };
  };

  const randomYears = shuffleArray(ALL_FIFA_YEARS).slice(0, 6);
  let { data, error } = await runQuery(randomYears);
  if (error) {
    throw new Error(`Could not load ${position} players: ${error.message}`);
  }
  let filtered = applyFilters(data || []);

  // Too few for this position in that slice of editions — widen to all of them.
  if (filtered.length < 10) {
    const wide = await runQuery(null);
    if (wide.error) {
      throw new Error(`Could not load ${position} players: ${wide.error.message}`);
    }
    filtered = applyFilters(wide.data || []);
  }

  if (filtered.length === 0) {
    throw new Error(
      `No Premier League players available for ${position}. ` +
      `Everyone eligible may already have been drafted.`
    );
  }

  // One entry per footballer, shuffled so which edition survives varies.
  const shuffled = [...filtered].sort(() => Math.random() - 0.5);
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
    if (chosen.length >= 10) break;
  }

  const logoMap = await getClubLogoMap(service);

  // Attributes only for the ten actually offered. The blob is large, so pulling
  // it across the candidate window was slow — but omitting it entirely broke
  // team strength, since the simulator's no-attributes fallback halves every
  // midfielder's contribution.
  const attrsById = new Map<string, PlayerAttributes>();
  const chosenIds = chosen.map(r => r.sofifa_id).filter(Boolean);
  if (chosenIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: attrRows } = (await (service as any)
      .from("sofifa_players")
      .select("sofifa_id, fifa_year, attributes")
      .in("sofifa_id", chosenIds)) as { data: any[] | null };
    for (const row of attrRows ?? []) {
      attrsById.set(`${row.sofifa_id}:${row.fifa_year}`, attributesFromJson(row.attributes));
    }
  }

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
    attrs: attrsById.get(`${r.sofifa_id}:${r.fifa_year}`),
  }));
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
