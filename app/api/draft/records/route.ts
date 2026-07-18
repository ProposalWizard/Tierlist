import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const MAX_PER_CATEGORY = 5;
const ASCENDING_RECORD_TYPES = new Set(["goals_conceded"]);

function isDevPlayer(name: string | null): boolean {
  if (!name) return false;
  return /^Dev\s/i.test(name);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const personal = url.searchParams.get("personal");
  const mode = url.searchParams.get("mode") === "prime" ? "prime" : "normal";

  if (personal === "true") {
    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const svc = createServiceClient();
    const personalSelect = () => svc
      .from("draft_personal_records")
      .select("competition, record_type, value, player_name, player_ovr, season_number")
      .eq("user_id", user.id);

    let { data, error } = await personalSelect().eq("mode", mode);

    // mode column doesn't exist yet (migration not run) — retry without the filter
    if (error && (error.code === "42703" || error.code === "PGRST204")) {
      ({ data, error } = await personalSelect());
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const records: Record<string, { value: number; playerName: string | null; playerOvr: number | null; seasonNumber: number | null }> = {};
    for (const row of data ?? []) {
      if (isDevPlayer(row.player_name)) continue;
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

  const globalSelect = () => supabase
    .from("draft_records")
    .select("competition, record_type, value, player_name, player_ovr, username, season_number, created_at")
    .order("value", { ascending: false });

  let { data, error } = await globalSelect().eq("mode", mode);

  // mode column doesn't exist yet (migration not run) — retry without the filter
  if (error && (error.code === "42703" || error.code === "PGRST204")) {
    ({ data, error } = await globalSelect());
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const grouped: Record<string, { value: number; playerName: string | null; playerOvr: number | null; username: string; seasonNumber: number | null; createdAt: string }[]> = {};

  for (const row of data ?? []) {
    if (isDevPlayer(row.player_name)) continue;
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

  // Re-sort ascending record types so index 0 = best (lowest)
  for (const key of Object.keys(grouped)) {
    const recordType = key.split("_").slice(1).join("_");
    if (ASCENDING_RECORD_TYPES.has(recordType)) {
      grouped[key].sort((a, b) => a.value - b.value);
    }
  }

  return NextResponse.json({ records: grouped });
}

interface RecordEntry {
  value: number;
  playerName: string | null;
  playerOvr: number | null;
}

interface TeamStat {
  value: number;
  teamOvr?: number | null;
  score?: string;
}

interface RecordPayload {
  pl: {
    wins: TeamStat;
    unbeaten: TeamStat;
    goals: RecordEntry;
    assists: RecordEntry;
    cleanSheets: RecordEntry;
    goalsConceded: TeamStat;
    biggestWin?: TeamStat;
    avgRating?: RecordEntry;
    mostPoints?: TeamStat;
  };
  all: {
    wins: TeamStat;
    unbeaten: TeamStat;
    goals: RecordEntry;
    assists: RecordEntry;
    cleanSheets: RecordEntry;
    goalsConceded?: TeamStat;
    biggestWin?: TeamStat;
    avgRating?: RecordEntry;
    squadOvr?: TeamStat;
  };
  career?: {
    goals: RecordEntry;
    assists?: RecordEntry;
    trophies: number;
    avgRating?: RecordEntry;
  };
  seasonNumber?: number;
  hasDevPlayers?: boolean;
  mode?: "normal" | "prime";
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
  mode: string;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const serviceClient = createServiceClient();
  const { data: profile } = await serviceClient
    .from("user_profiles")
    .select("username")
    .eq("user_id", user.id)
    .single();

  const username = profile?.username || user.email?.split("@")[0] || "Player";

  let body: RecordPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { pl, all, career, seasonNumber, hasDevPlayers, mode: bodyMode } = body ?? {};
  const mode = bodyMode === "prime" ? "prime" : "normal";

  if (hasDevPlayers) {
    return NextResponse.json({ ok: true, inserted: 0, skipped: "dev_team" });
  }

  // A malformed body missing pl/all would crash on the dereferences below.
  if (!pl || !all) {
    return NextResponse.json({ error: "Missing pl/all record data" }, { status: 400 });
  }

  // Plausible upper bounds per record type. The values are entirely
  // client-supplied, and because this route prunes the "worst" of the top-5
  // when a new value beats it, an absurd value (e.g. 999999) would evict
  // legitimate records. Capping to realistic maxima blocks that while leaving
  // real records untouched. A season is 38 PL games; "all" includes cups.
  const VALUE_CAPS: Record<string, number> = {
    wins: 70, unbeaten: 70, goals: 150, assists: 150, clean_sheets: 70,
    goals_conceded: 300, biggest_win: 30, avg_rating: 100, most_points: 114,
    career_goals: 10000, career_assists: 10000, career_avg_rating: 100,
    career_trophies: 2000, squad_ovr: 99,
  };
  const validValue = (record_type: string, value: unknown): number | null => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return null;
    const cap = VALUE_CAPS[record_type] ?? 100000;
    return n > cap ? null : n;
  };

  const candidates: CandidateRow[] = [];

  const pushEntry = (competition: string, record_type: string, stat: RecordEntry | undefined) => {
    if (!stat) return;
    const value = validValue(record_type, stat.value);
    if (value == null) return;
    if (isDevPlayer(stat.playerName)) return;
    candidates.push({
      user_id: user.id, username, competition, record_type,
      value,
      player_name: stat.playerName,
      player_ovr: stat.playerOvr,
      season_number: seasonNumber ?? null,
      mode,
    });
  };

  const pushTeam = (competition: string, record_type: string, stat: TeamStat | undefined) => {
    if (!stat) return;
    const value = validValue(record_type, stat.value);
    if (value == null) return;
    candidates.push({
      user_id: user.id, username, competition, record_type,
      value,
      player_name: stat.score ?? null,
      player_ovr: stat.teamOvr ?? null,
      season_number: seasonNumber ?? null,
      mode,
    });
  };

  pushTeam("pl", "wins", pl.wins);
  pushTeam("pl", "unbeaten", pl.unbeaten);
  pushEntry("pl", "goals", pl.goals);
  pushEntry("pl", "assists", pl.assists);
  pushEntry("pl", "clean_sheets", pl.cleanSheets);
  pushTeam("pl", "goals_conceded", pl.goalsConceded);
  if (pl.biggestWin) pushTeam("pl", "biggest_win", pl.biggestWin);
  if (pl.avgRating) pushEntry("pl", "avg_rating", pl.avgRating);
  if (pl.mostPoints) pushTeam("pl", "most_points", pl.mostPoints);

  pushTeam("all", "wins", all.wins);
  pushTeam("all", "unbeaten", all.unbeaten);
  pushEntry("all", "goals", all.goals);
  pushEntry("all", "assists", all.assists);
  pushEntry("all", "clean_sheets", all.cleanSheets);
  if (all.goalsConceded) pushTeam("all", "goals_conceded", all.goalsConceded);
  if (all.biggestWin) pushTeam("all", "biggest_win", all.biggestWin);
  if (all.avgRating) pushEntry("all", "avg_rating", all.avgRating);
  if (all.squadOvr) pushTeam("all", "squad_ovr", all.squadOvr);

  if (career) {
    if (career.goals) pushEntry("career", "career_goals", career.goals);
    if (career.assists) pushEntry("career", "career_assists", career.assists);
    const trophies = validValue("career_trophies", career.trophies);
    if (trophies != null) {
      candidates.push({
        user_id: user.id, username, competition: "career", record_type: "career_trophies",
        value: trophies, player_name: null, player_ovr: null,
        season_number: seasonNumber ?? null,
        mode,
      });
    }
    if (career.avgRating) pushEntry("career", "career_avg_rating", career.avgRating);
  }

  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0 });
  }

  // Whether the mode column exists — discovered lazily on first error, then
  // remembered for the rest of this request so we don't hit the DB 20× times.
  let modeColExists: boolean | null = null;
  const NO_COL = (code: string | undefined) => code === "42703" || code === "PGRST204";

  let inserted = 0;

  for (const candidate of candidates) {
    const ascending = ASCENDING_RECORD_TYPES.has(candidate.record_type);

    let baseQuery = serviceClient
      .from("draft_records")
      .select("id, value")
      .eq("competition", candidate.competition)
      .eq("record_type", candidate.record_type);
    if (modeColExists !== false) baseQuery = baseQuery.eq("mode", candidate.mode);
    let { data: existing, error: fetchErr } = await baseQuery.order("value", { ascending }).limit(MAX_PER_CATEGORY);

    // mode column doesn't exist — retry without the filter
    if (fetchErr && NO_COL(fetchErr.code)) {
      modeColExists = false;
      const fallback = serviceClient
        .from("draft_records")
        .select("id, value")
        .eq("competition", candidate.competition)
        .eq("record_type", candidate.record_type);
      ({ data: existing, error: fetchErr } = await fallback.order("value", { ascending }).limit(MAX_PER_CATEGORY));
    } else if (fetchErr == null && modeColExists == null) {
      modeColExists = true;
    }

    if (fetchErr) {
      console.error(`Failed to fetch records for ${candidate.competition}/${candidate.record_type}:`, fetchErr.message);
      continue;
    }

    const count = existing?.length ?? 0;

    // Build insert payload — omit mode when the column is absent
    const insertPayload = modeColExists === false
      ? (({ mode: _m, ...rest }) => rest)(candidate)
      : candidate;

    if (count < MAX_PER_CATEGORY) {
      const { error: insErr } = await serviceClient.from("draft_records").insert(insertPayload);
      if (insErr && NO_COL(insErr.code) && modeColExists !== false) {
        // Column appeared absent on insert but not on fetch — flip flag and retry
        modeColExists = false;
        const { mode: _m, ...withoutMode } = candidate;
        const { error: retryErr } = await serviceClient.from("draft_records").insert(withoutMode);
        if (retryErr) { console.error(`Failed to insert record (retry):`, retryErr.message); } else { inserted++; }
      } else if (insErr) {
        console.error(`Failed to insert record:`, insErr.message);
      } else {
        inserted++;
      }
    } else {
      const worst = existing![count - 1];
      const beatsWorst = ascending ? candidate.value < worst.value : candidate.value > worst.value;
      if (beatsWorst) {
        const { error: insErr } = await serviceClient.from("draft_records").insert(insertPayload);
        if (insErr) {
          console.error(`Failed to insert record:`, insErr.message);
          continue;
        }
        inserted++;

        const { error: delErr } = await serviceClient
          .from("draft_records")
          .delete()
          .eq("id", worst.id);
        if (delErr) {
          console.error(`Failed to prune worst record:`, delErr.message);
        }
      }
    }
  }

  // Upsert personal bests
  let modeColExistsPersonal: boolean | null = null;

  for (const candidate of candidates) {
    const ascending = ASCENDING_RECORD_TYPES.has(candidate.record_type);

    let personalQuery = serviceClient
      .from("draft_personal_records")
      .select("id, value")
      .eq("user_id", user.id)
      .eq("competition", candidate.competition)
      .eq("record_type", candidate.record_type);
    if (modeColExistsPersonal !== false) personalQuery = personalQuery.eq("mode", candidate.mode);
    let { data: existing, error: personalFetchErr } = await personalQuery.maybeSingle();

    if (personalFetchErr && NO_COL(personalFetchErr.code)) {
      modeColExistsPersonal = false;
      const fallback = serviceClient
        .from("draft_personal_records")
        .select("id, value")
        .eq("user_id", user.id)
        .eq("competition", candidate.competition)
        .eq("record_type", candidate.record_type);
      ({ data: existing, error: personalFetchErr } = await fallback.maybeSingle());
    } else if (personalFetchErr == null && modeColExistsPersonal == null) {
      modeColExistsPersonal = true;
    }

    if (personalFetchErr) continue;

    const personalInsertPayload: Record<string, unknown> = {
      user_id: user.id,
      competition: candidate.competition,
      record_type: candidate.record_type,
      value: candidate.value,
      player_name: candidate.player_name,
      player_ovr: candidate.player_ovr,
      season_number: candidate.season_number,
    };
    if (modeColExistsPersonal !== false) personalInsertPayload.mode = candidate.mode;

    if (!existing) {
      const { error: insErr } = await serviceClient.from("draft_personal_records").insert(personalInsertPayload);
      if (insErr && NO_COL(insErr.code)) {
        modeColExistsPersonal = false;
        delete personalInsertPayload.mode;
        await serviceClient.from("draft_personal_records").insert(personalInsertPayload);
      } else if (insErr && insErr.code === "23505") {
        // Unique conflict — a record exists for this (user, competition, type) from
        // a different mode (unique constraint doesn't include mode yet). Fetch
        // without mode filter and update if this value is better.
        const { data: any } = await serviceClient
          .from("draft_personal_records")
          .select("id, value")
          .eq("user_id", user.id)
          .eq("competition", candidate.competition)
          .eq("record_type", candidate.record_type)
          .maybeSingle();
        if (any) {
          const isBetter = ascending ? candidate.value < any.value : candidate.value > any.value;
          if (isBetter) {
            await serviceClient
              .from("draft_personal_records")
              .update({ value: candidate.value, player_name: candidate.player_name, player_ovr: candidate.player_ovr, season_number: candidate.season_number, updated_at: new Date().toISOString() })
              .eq("id", any.id);
          }
        }
      } else if (insErr) {
        console.error(`Failed to insert personal record:`, insErr.message);
      }
    } else {
      const isNewBest = ascending ? candidate.value < existing.value : candidate.value > existing.value;
      if (isNewBest) {
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
  }

  return NextResponse.json({ ok: true, inserted });
}
