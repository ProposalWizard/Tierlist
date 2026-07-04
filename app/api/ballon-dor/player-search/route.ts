import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const year = req.nextUrl.searchParams.get("year") ?? "26";
  if (q.length < 2) return NextResponse.json({ players: [] });

  const service = createServiceClient();
  const { data, error } = await service
    .from("sofifa_players")
    .select("sofifa_id, name, overall, potential, positions, age, nationality, image_url, club")
    .ilike("name", `%${q}%`)
    .eq("fifa_year", Number(year))
    .order("overall", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ players: data ?? [] });
}
