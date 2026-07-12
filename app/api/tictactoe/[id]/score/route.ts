import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ score: null });

  const { id } = await params;
  const service = createServiceClient();
  const { data } = await service
    .from("tictactoe_scores")
    .select("*")
    .eq("user_id", user.id)
    .eq("puzzle_id", id)
    .maybeSingle();

  return NextResponse.json({ score: data ?? null });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Sign in to save scores" }, { status: 401 });
  }

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Sanitize: integers only, clamped to sane ranges — otherwise a crafted
  // POST (score: 999999 / 1e308) permanently corrupts personal stats and
  // anything later built on this table.
  const clampInt = (v: unknown, lo: number, hi: number) => {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo;
  };
  const maxScore = clampInt(body.max_score, 0, 100);
  const score = clampInt(body.score, 0, maxScore);
  const hintsUsed = clampInt(body.hints_used, 0, 20);
  const timeSeconds = body.time_seconds != null ? clampInt(body.time_seconds, 0, 86400) : null;
  const secondChance = body.second_chance === true;

  const service = createServiceClient();

  // The puzzle must exist — don't let arbitrary ids create score rows.
  const { data: puzzle } = await service
    .from("tictactoe_puzzles")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (!puzzle) {
    return NextResponse.json({ error: "Puzzle not found" }, { status: 404 });
  }

  const { data: existing } = await service
    .from("tictactoe_scores")
    .select("id, is_second_chance")
    .eq("user_id", user.id)
    .eq("puzzle_id", id)
    .maybeSingle();

  if (existing && !secondChance) {
    return NextResponse.json({ saved: false, reason: "already_completed" });
  }

  if (existing && secondChance) {
    if (existing.is_second_chance) {
      return NextResponse.json({ saved: false, reason: "second_chance_used" });
    }
    await service.from("tictactoe_scores").delete().eq("user_id", user.id).eq("puzzle_id", id);
  }

  const insertData: Record<string, unknown> = {
    user_id: user.id,
    puzzle_id: id,
    score,
    max_score: maxScore,
    hints_used: hintsUsed,
    is_second_chance: secondChance,
  };
  if (timeSeconds != null) insertData.time_seconds = timeSeconds;

  const { error } = await service
    .from("tictactoe_scores")
    .insert(insertData);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ saved: true });
}
