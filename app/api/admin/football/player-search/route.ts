import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q")?.trim();
  const year = searchParams.get("year");
  const club = searchParams.get("club")?.trim();
  const limitParam = searchParams.get("limit");

  if (!q) {
    return NextResponse.json(
      { error: "Missing required query param: q" },
      { status: 400 }
    );
  }

  let limit = 50;
  if (limitParam) {
    const parsed = parseInt(limitParam, 10);
    if (!isNaN(parsed) && parsed > 0) {
      limit = Math.min(parsed, 200);
    }
  }

  const service = createServiceClient();

  try {
    let query = service
      .from("sofifa_players")
      .select("*")
      .ilike("name", `%${q}%`);

    if (year) {
      const yearNum = parseInt(year, 10);
      if (!isNaN(yearNum)) {
        query = query.eq("fifa_year", yearNum);
      }
    }

    if (club) {
      query = query.ilike("club", `%${club}%`);
    }

    query = query.order("overall", { ascending: false }).limit(limit);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ players: data ?? [], count: (data ?? []).length });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
