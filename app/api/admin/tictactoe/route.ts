import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  if (!(await isAdmin(user.id))) return null;
  return user;
}

export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();
  const { data, error } = await service
    .from("tictactoe_puzzles")
    .select("id, title, difficulty, is_daily, daily_date, is_active, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!(body.title as string)?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("tictactoe_puzzles")
    .insert({
      title: (body.title as string).trim(),
      difficulty: body.difficulty ?? "medium",
      row_labels: body.row_labels ?? ["", "", ""],
      col_labels: body.col_labels ?? ["", "", ""],
      grid: body.grid ?? [[], [], []],
      three_in_a_row_bonus: body.three_in_a_row_bonus ?? 10,
      is_daily: body.is_daily ?? false,
      daily_date: body.daily_date ?? null,
      is_active: body.is_active ?? true,
      created_by: user.id,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
