import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const service = createServiceClient();

  const { data } = await service
    .from("tictactoe_difficulty_ratings")
    .select("rating")
    .eq("puzzle_id", id);

  if (!data || data.length === 0) {
    return NextResponse.json({ average: null, count: 0 });
  }

  const sum = (data as { rating: number }[]).reduce((acc, r) => acc + r.rating, 0);
  const avg = sum / data.length;
  const rounded = Math.round(avg * 2) / 2;

  return NextResponse.json({ average: Math.min(5, Math.max(0.5, rounded)), count: data.length });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Sign in to rate puzzles" }, { status: 401 });
  }

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rating = Number(body.rating);
  if (!Number.isFinite(rating) || rating < 0.5 || rating > 5.0 || Math.round(rating * 2) !== rating * 2) {
    return NextResponse.json({ error: "Rating must be 0.5–5.0 in 0.5 steps" }, { status: 400 });
  }

  const service = createServiceClient();

  const { error } = await service
    .from("tictactoe_difficulty_ratings")
    .upsert(
      { puzzle_id: id, user_id: user.id, rating },
      { onConflict: "puzzle_id,user_id" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ saved: true });
}
