import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Sign in to create a puzzle" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = (body.title as string)?.trim();
  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const rowLabels = body.row_labels as string[];
  const colLabels = body.col_labels as string[];
  if (!rowLabels?.length || !colLabels?.length) {
    return NextResponse.json({ error: "Row and column labels are required" }, { status: 400 });
  }

  const grid = body.grid as unknown[][];
  if (!grid || grid.length !== 3 || grid.some((r) => !Array.isArray(r) || r.length !== 3)) {
    return NextResponse.json({ error: "Grid must be a 3x3 array" }, { status: 400 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("tictactoe_puzzles")
    .insert({
      title,
      difficulty: body.difficulty ?? "medium",
      row_labels: rowLabels,
      col_labels: colLabels,
      grid,
      three_in_a_row_bonus: body.three_in_a_row_bonus ?? 10,
      is_daily: false,
      is_active: true,
      category: "User Created",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
