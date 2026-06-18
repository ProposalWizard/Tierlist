import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const MAX_PER_CATEGORY = 5;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const personal = url.searchParams.get("personal");

  if (personal === "true") {
    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const svc = createServiceClient();
    const { data, error } = await svc
      .from("draft_personal_records")
      .select("competition, record_type, value, player_name, player_ovr, season_number")
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const records: Record<string, { value: number; playerName: string | null; playerOvr: number | null; seasonNumber: number | null }> = {};
    for (const row of data ?? []) {
      records[`${row.competition}_${row.record_type}`] = {
        value: row.value,
        playerName: row.player_name,
        playerOvr: row.player_ovr,
        seasonNumber: row.season_number,
      };
    }

    return NextResponse.json({ personal: records });
  }

  // Global leaderboard
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("draft_records")
    .select("competition, record_type, value, player_name, player_ovr, username, season_number, created_at")
    .order("value", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Table is already capped at ~5 per (competition, record_type),
  // so just group directly — no JS filtering needed.
  const grouped: Record<string, { value: number; playerName: string | null; playerOvr: number | null; username: string; seasonNumber: number | null; createdAt: string }[]> = {};

  for (const row of data ?? []) {
    const key = `${row.competition}_${row.record_type}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push({
      value: row.value,
      playerName: row.player_name,
      playerOvr: row.player_ovr,
      username: row.username,
      seasonNumber: row.season_number,
      createdAt: row.created_at,
    });
  }

  return NextResponse.json({ records: grouped });
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

interface CandidateRow {
  user_id: string;
  username: string;
  competition: string;
  record_type: string;
  value: number;
  player_name: string | null;
  player_ovr: number | null;
  season_number: number | null;
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

  const candidates: CandidateRow[] = [];

  const pushCandidate = (competition: string, record_type: string, stat: number | TopStat, withPlayer = false) => {
    if (typeof stat === "number") {
      if (stat <= 0) return;
      candidates.push({ user_id: user.id, username, competition, record_type, value: stat, player_name: null, player_ovr: null, season_number: seasonNumber ?? null });
    } else {
      if (stat.value <= 0) return;
      candidates.push({ user_id: user.id, username, competition, record_type, value: stat.value, player_name: withPlayer ? stat.playerName : null, player_ovr: withPlayer ? stat.playerOvr : null, season_number: seasonNumber ?? null });
    }
  };

  pushCandidate("pl", "wins", pl.wins);
  pushCandidate("pl", "unbeaten", pl.unbeaten);
  pushCandidate("pl", "goals", pl.goals, true);
  pushCandidate("pl", "assists", pl.assists, true);
  pushCandidate("pl", "clean_sheets", pl.cleanSheets, true);

  pushCandidate("all", "wins", all.wins);
  pushCandidate("all", "unbeaten", all.unbeaten);
  pushCandidate("all", "goals", all.goals, true);
  pushCandidate("all", "assists", all.assists, true);
  pushCandidate("all", "clean_sheets", all.cleanSheets, true);

  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0 });
  }

  let inserted = 0;

  for (const candidate of candidates) {
    // Fetch current top 5 for this (competition, record_type), ordered by value DESC
    const { data: existing, error: fetchErr } = await serviceClient
      .from("draft_records")
      .select("id, value")
      .eq("competition", candidate.competition)
      .eq("record_type", candidate.record_type)
      .order("value", { ascending: false })
      .limit(MAX_PER_CATEGORY);

    if (fetchErr) {
      console.error(`Failed to fetch records for ${candidate.competition}/${candidate.record_type}:`, fetchErr.message);
      continue;
    }

    const count = existing?.length ?? 0;

    if (count < MAX_PER_CATEGORY) {
      // Fewer than 5 entries — insert directly
      const { error: insErr } = await serviceClient.from("draft_records").insert(candidate);
      if (insErr) {
        console.error(`Failed to insert record:`, insErr.message);
      } else {
        inserted++;
      }
    } else {
      // 5 entries exist — check if new value beats the lowest (last in the sorted list)
      const lowest = existing![count - 1];
      if (candidate.value > lowest.value) {
        // Insert the new record and delete the lowest one
        const { error: insErr } = await serviceClient.from("draft_records").insert(candidate);
        if (insErr) {
          console.error(`Failed to insert record:`, insErr.message);
          continue;
        }
        inserted++;

        const { error: delErr } = await serviceClient
          .from("draft_records")
          .delete()
          .eq("id", lowest.id);
        if (delErr) {
          console.error(`Failed to prune lowest record:`, delErr.message);
        }
      }
      // Otherwise: value doesn't beat top 5, skip silently
    }
  }

  // Upsert personal bests
  for (const candidate of candidates) {
    const { data: existing } = await serviceClient
      .from("draft_personal_records")
      .select("id, value")
      .eq("user_id", user.id)
      .eq("competition", candidate.competition)
      .eq("record_type", candidate.record_type)
      .maybeSingle();

    if (!existing) {
      await serviceClient.from("draft_personal_records").insert({
        user_id: user.id,
        competition: candidate.competition,
        record_type: candidate.record_type,
        value: candidate.value,
        player_name: candidate.player_name,
        player_ovr: candidate.player_ovr,
        season_number: candidate.season_number,
      });
    } else if (candidate.value > existing.value) {
      await serviceClient
        .from("draft_personal_records")
        .update({
          value: candidate.value,
          player_name: candidate.player_name,
          player_ovr: candidate.player_ovr,
          season_number: candidate.season_number,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    }
  }

  return NextResponse.json({ ok: true, inserted });
}
