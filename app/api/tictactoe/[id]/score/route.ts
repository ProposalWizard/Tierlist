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

  const clampInt = (v: unknown, lo: number, hi: number) => {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo;
  };
  const hintsUsed = clampInt(body.hints_used, 0, 20);
  const timeSeconds = body.time_seconds != null ? clampInt(body.time_seconds, 0, 86400) : null;
  const secondChance = body.second_chance === true;
  // Easy mode counts ANSWERS FOUND; the standard game counts POINTS. Both post
  // here, so the maximum has to be derived in the unit the game actually used.
  const scoring = body.scoring === "answers" ? "answers" : "points";

  const service = createServiceClient();

  // The puzzle must exist — don't let arbitrary ids create score rows. Its grid
  // is also what the real maximum is computed from.
  const { data: puzzle } = await service
    .from("tictactoe_puzzles")
    .select("id, grid, three_in_a_row_bonus")
    .eq("id", id)
    .maybeSingle();
  if (!puzzle) {
    return NextResponse.json({ error: "Puzzle not found" }, { status: 404 });
  }

  // The maximum comes from the PUZZLE, never from the client.
  //
  // It used to be the posted value clamped to 100 — a number far below what a
  // real puzzle is worth. Nine squares at the default 3 points per answer plus
  // the 10-point bonus already exceeds 100 with five answers a square, so most
  // puzzles were stored as 100/100: every archive percentage was wrong, a 60/145
  // showed as 60%, and anything over 100 registered as a "Perfect".
  type Square = { answers?: { points?: unknown }[] };
  const grid = (puzzle.grid ?? []) as Square[][];
  let maxScore = 0;
  for (const row of Array.isArray(grid) ? grid : []) {
    for (const square of Array.isArray(row) ? row : []) {
      const answers = Array.isArray(square?.answers) ? square.answers : [];
      if (scoring === "answers") {
        maxScore += answers.length;
      } else {
        for (const a of answers) {
          const pts = Math.floor(Number(a?.points));
          if (Number.isFinite(pts) && pts > 0) maxScore += pts;
        }
      }
    }
  }
  if (scoring === "points") {
    const bonus = Math.floor(Number(puzzle.three_in_a_row_bonus));
    if (Number.isFinite(bonus) && bonus > 0) maxScore += bonus;
  }
  // A puzzle with no answers at all can't be scored against.
  if (maxScore <= 0) {
    return NextResponse.json({ saved: false, reason: "puzzle_not_scorable" });
  }

  const score = clampInt(body.score, 0, maxScore);

  const { data: existing } = await service
    .from("tictactoe_scores")
    .select("id, is_second_chance, score, max_score")
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
    // Keep the better attempt. This used to delete unconditionally, so a player
    // who scored 92% and then gave up on their replay at 15% permanently lost
    // the 92% — and the second chance was spent, so there was no way back.
    const prevPct = existing.max_score > 0 ? existing.score / existing.max_score : 0;
    const newPct = score / maxScore;
    if (newPct <= prevPct) {
      // Still spend the second chance, so it can't be retried indefinitely.
      await service
        .from("tictactoe_scores")
        .update({ is_second_chance: true })
        .eq("user_id", user.id)
        .eq("puzzle_id", id);
      return NextResponse.json({ saved: false, reason: "kept_better_score", score: existing.score, max_score: existing.max_score });
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

  return NextResponse.json({ saved: true, score, max_score: maxScore });
}
