export interface AmPlayer {
  sofifa_id: string;
  name: string;
  ovr: number;
  positions: string;
  age: number;
  image_url: string | null;
  nationality: string;
  club: string;
  edition: string;
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
  created_at: string;
  expires_at: string;
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchRoundPlayers(service: any, position: string): Promise<AmPlayer[]> {
  const allowed = POS_FILTER[position] ?? [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (service as any)
    .from("sofifa_players")
    .select(
      "sofifa_id, name, overall, manual_overall, positions, manual_positions, age, image_url, nationality, manual_nationality, club, fifa_edition, attributes"
    );

  if (allowed.length > 0) {
    query = query.ilike("positions", `%${allowed[0]}%`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = (await query.limit(400)) as { data: any[] | null };
  const rows = data || [];

  // Refine in JS to ensure at least one matching position
  const filtered =
    allowed.length > 0
      ? rows.filter(r => {
          const pos = resolvePositions(r).toUpperCase();
          const parts = pos.split(",").map((x: string) => x.trim());
          return allowed.some(p => parts.includes(p));
        })
      : rows;

  const shuffled = [...filtered].sort(() => Math.random() - 0.5);

  return shuffled.slice(0, 10).map(r => ({
    sofifa_id: r.sofifa_id || "",
    name: r.name || "Unknown",
    ovr: resolveOvr(r),
    positions: resolvePositions(r),
    age: r.age || 0,
    image_url: r.image_url || null,
    nationality: (r.manual_nationality || r.nationality || ""),
    club: r.club || "",
    edition: r.fifa_edition || "",
  }));
}

export function shuffleArray<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}
