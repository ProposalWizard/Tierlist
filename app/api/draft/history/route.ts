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
    .limit(50);

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

  const { error } = await supabase.from("draft_runs").insert({
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
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
