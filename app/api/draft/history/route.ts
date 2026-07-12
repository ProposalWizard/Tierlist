import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("draft_runs")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const runs = (data || []).map((row: Record<string, unknown>) => ({
    id: row.id,
    date: row.created_at,
    formation: row.formation,
    seasonNumber: row.season_number,
    finish: row.finish,
    points: row.points,
    record: { wins: row.wins, draws: row.draws, losses: row.losses },
    goalsFor: row.goals_for,
    goalsAgainst: row.goals_against,
    goalsScored: row.goals_for,
    avgOvr: row.avg_ovr,
    players: row.players,
    // Extended stats (null until the draft_runs_stats.sql migration is run
    // and for rows saved before it)
    topScorerGoals: row.top_scorer_goals ?? undefined,
    topAssists: row.top_assists ?? undefined,
    cleanSheets: row.clean_sheets ?? undefined,
    goalDifference: row.goal_difference ?? undefined,
    longestWinStreak: row.longest_win_streak ?? undefined,
    longestUnbeatenRun: row.longest_unbeaten_run ?? undefined,
    faCupWinner: row.fa_cup_winner ?? undefined,
    eflCupWinner: row.efl_cup_winner ?? undefined,
    uclWinner: row.ucl_winner ?? undefined,
    uelWinner: row.uel_winner ?? undefined,
    superCupWinner: row.super_cup_winner ?? undefined,
    charityShieldWinner: row.charity_shield_winner ?? undefined,
  }));

  return NextResponse.json({ runs });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();

  const legacyColumns = {
    user_id: user.id,
    formation: body.formation || "",
    season_number: body.seasonNumber || 1,
    finish: body.finish,
    points: body.points,
    wins: body.record?.wins || 0,
    draws: body.record?.draws || 0,
    losses: body.record?.losses || 0,
    goals_for: body.goalsFor || 0,
    goals_against: body.goalsAgainst || 0,
    avg_ovr: body.avgOvr || 0,
    players: body.players || [],
  };

  const extendedColumns = {
    ...legacyColumns,
    top_scorer_goals: body.topScorerGoals ?? 0,
    top_assists: body.topAssists ?? 0,
    clean_sheets: body.cleanSheets ?? 0,
    goal_difference: body.goalDifference ?? (body.goalsFor || 0) - (body.goalsAgainst || 0),
    longest_win_streak: body.longestWinStreak ?? 0,
    longest_unbeaten_run: body.longestUnbeatenRun ?? 0,
    fa_cup_winner: !!body.faCupWinner,
    efl_cup_winner: !!body.eflCupWinner,
    ucl_winner: !!body.uclWinner,
    uel_winner: !!body.uelWinner,
    super_cup_winner: !!body.superCupWinner,
    charity_shield_winner: !!body.charityShieldWinner,
    // Deterministic season fingerprint from the client — the unique index on
    // (user_id, event_key) makes replays of the same season a no-op instead
    // of a duplicate run.
    event_key: typeof body.id === "string" ? body.id.slice(0, 120) : null,
  };

  let { error } = await supabase.from("draft_runs").insert(extendedColumns);

  if (error && error.code === "23505") {
    // Same season already saved (refresh / re-entered results) — success.
    return NextResponse.json({ success: true, duplicate: true });
  }

  if (error && (error.code === "42703" || error.code === "PGRST204")) {
    // Extended columns don't exist yet (draft_runs_stats.sql migration not
    // run) — fall back to the legacy shape so history keeps working.
    // 42703 = Postgres undefined column; PGRST204 = PostgREST schema cache miss.
    ({ error } = await supabase.from("draft_runs").insert(legacyColumns));
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
