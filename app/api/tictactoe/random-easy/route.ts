import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const revalidate = 0;

export async function GET() {
  const service = createServiceClient();
  const { data, error } = await service
    .from("tictactoe_puzzles")
    .select("id")
    .eq("is_active", true)
    .eq("difficulty", "easy");

  if (error || !data || data.length === 0)
    return NextResponse.json({ error: "No easy puzzles available" }, { status: 404 });

  const random = data[Math.floor(Math.random() * data.length)];
  return NextResponse.json({ id: random.id });
}
