import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET() {
  const supabase = createServiceClient();
  // Fetch all distinct nationality values from sofifa_players
  const { data, error } = await supabase
    .from("sofifa_players")
    .select("nationality")
    .not("nationality", "is", null)
    .neq("nationality", "");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const distinct = [...new Set((data ?? []).map((r: { nationality: string }) => r.nationality))].sort();
  return NextResponse.json({ nationalities: distinct, count: distinct.length });
}
