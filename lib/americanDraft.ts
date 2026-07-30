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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveOvr(row: any): number {
  const a = row.attributes || {};
  const candidates = [row.manual_overall, row.overall, a.overall, a.attr_sort, a.attr_oa];
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchRoundPlayers(service: any, position: string): Promise<AmPlayer[]> {
  const allowed = POS_FILTER[position] ?? [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (service as any)
    .from("sofifa_players")
    .select(
      "sofifa_id, name, overall, manual_overall, positions, manual_positions, age, image_url, nationality, manual_nationality, club, fifa_edition, fifa_year, attributes"
    )
    .or(PL_OR_FILTER);

  if (allowed.length > 0) {
    query = query.ilike("positions", `%${allowed[0]}%`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = (await query.limit(600)) as { data: any[] | null };
  const rows = data || [];

  // Filter out non-English PL clubs and refine position match in JS
  const filtered = rows.filter(r => {
    const clubName = (r.club || "").toLowerCase();
    if (NON_ENGLISH_PL_CLUBS.has(clubName)) return false;
    if (allowed.length === 0) return true;
    const pos = resolvePositions(r).toUpperCase();
    const parts = pos.split(",").map((x: string) => x.trim());
    return allowed.some(p => parts.includes(p));
  });

  const shuffled = [...filtered].sort(() => Math.random() - 0.5);
  const chosen = shuffled.slice(0, 10);

  // Load the whole club_logos table (a few hundred rows at most) and index it
  // by normalised name. An .in("club", …) exact match misses whenever the logo
  // was scraped from an edition that spelled the club differently.
  const logoMap = new Map<string, string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: logos } = (await (service as any)
    .from("club_logos")
    .select("club, logo_url")
    .limit(5000)) as { data: { club: string; logo_url: string }[] | null };
  (logos ?? []).forEach(l => {
    const key = normalizeClubKey(l.club || "");
    if (key && !logoMap.has(key)) logoMap.set(key, l.logo_url);
  });

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
  }));
}

export function shuffleArray<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}
