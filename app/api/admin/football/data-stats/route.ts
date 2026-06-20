import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const service = createServiceClient();
  const { searchParams } = req.nextUrl;
  const year = searchParams.get("year");
  const wantClubs = searchParams.get("clubs") === "1";

  if (wantClubs && year) {
    const yearNum = parseInt(year, 10);
    if (isNaN(yearNum)) {
      return NextResponse.json({ error: "Invalid year" }, { status: 400 });
    }

    const { data, error } = await service
      .from("sofifa_players")
      .select("club")
      .eq("fifa_year", yearNum)
      .not("club", "is", null);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const clubSet = new Set<string>();
    for (const row of data ?? []) {
      if (row.club) clubSet.add(row.club);
    }
    const clubs = Array.from(clubSet).sort((a, b) => a.localeCompare(b));

    return NextResponse.json({ clubs }, {
      headers: { "Cache-Control": "private, max-age=300" },
    });
  }

  // Default: return player count per year
  const stats: Record<number, number> = {};
  for (let y = 7; y <= 26; y++) {
    const { count, error } = await service
      .from("sofifa_players")
      .select("sofifa_id", { count: "exact", head: true })
      .eq("fifa_year", y);
    if (!error) stats[y] = count ?? 0;
  }

  return NextResponse.json({ stats }, {
    headers: { "Cache-Control": "private, max-age=60" },
  });
}
