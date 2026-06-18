import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET() {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("draft_records")
    .select("competition, record_type, value, player_name, player_ovr, username, season_number, created_at")
    .order("value", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Group into top-5 per (competition, record_type)
  const grouped: Record<string, { value: number; playerName: string | null; playerOvr: number | null; username: string; seasonNumber: number | null; createdAt: string }[]> = {};
  const counts: Record<string, number> = {};

  for (const row of (data ?? [])) {
    const key = `${row.competition}_${row.record_type}`;
    if (!grouped[key]) { grouped[key] = []; counts[key] = 0; }
    if (counts[key] < 5) {
      grouped[key].push({
        value: row.value,
        playerName: row.player_name,
        playerOvr: row.player_ovr,
        username: row.username,
        seasonNumber: row.season_number,
        createdAt: row.created_at,
      });
      counts[key]++;
    }
  }

  return NextResponse.json({ records: grouped });
}

interface PlayerStat {
  name: string;
  goals: number;
  assists: number;
  cleanSheets: number;
}

interface RecordEntry {
  value: number;
  playerName: string | null;
  playerOvr: number | null;
}

interface RecordPayload {
  pl: {
    wins: number;
    unbeaten: number;
    goals: RecordEntry;
    assists: RecordEntry;
    cleanSheets: RecordEntry;
  };
  all: {
    wins: number;
    unbeaten: number;
    goals: RecordEntry;
    assists: RecordEntry;
    cleanSheets: RecordEntry;
  };
  seasonNumber?: number;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Get username from profile
  const serviceClient = createServiceClient();
  const { data: profile } = await serviceClient
    .from("user_profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  const username = profile?.username || user.email?.split("@")[0] || "Player";

  const body: RecordPayload = await req.json();
  const { pl, all, seasonNumber } = body;

  type TopStat = { value: number; playerName: string | null; playerOvr: number | null };
  const rows: {
    user_id: string;
    username: string;
    competition: string;
    record_type: string;
    value: number;
    player_name: string | null;
    player_ovr: number | null;
    season_number: number | null;
  }[] = [];

  const pushRow = (competition: string, record_type: string, stat: number | TopStat, withPlayer = false) => {
    if (typeof stat === "number") {
      if (stat <= 0) return;
      rows.push({ user_id: user.id, username, competition, record_type, value: stat, player_name: null, player_ovr: null, season_number: seasonNumber ?? null });
    } else {
      if (stat.value <= 0) return;
      rows.push({ user_id: user.id, username, competition, record_type, value: stat.value, player_name: withPlayer ? stat.playerName : null, player_ovr: withPlayer ? stat.playerOvr : null, season_number: seasonNumber ?? null });
    }
  };

  pushRow("pl", "wins", pl.wins);
  pushRow("pl", "unbeaten", pl.unbeaten);
  pushRow("pl", "goals", pl.goals, true);
  pushRow("pl", "assists", pl.assists, true);
  pushRow("pl", "clean_sheets", pl.cleanSheets, true);

  pushRow("all", "wins", all.wins);
  pushRow("all", "unbeaten", all.unbeaten);
  pushRow("all", "goals", all.goals, true);
  pushRow("all", "assists", all.assists, true);
  pushRow("all", "clean_sheets", all.cleanSheets, true);

  if (rows.length === 0) {
    return NextResponse.json({ ok: true });
  }

  const { error } = await serviceClient.from("draft_records").insert(rows);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, inserted: rows.length });
}
