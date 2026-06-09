import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const club = searchParams.get("club");
  const yearParam = searchParams.get("year");

  if (!club || !yearParam) {
    return NextResponse.json(
      { error: "Missing required query params: club, year" },
      { status: 400 }
    );
  }

  const year = parseInt(yearParam, 10);
  if (isNaN(year)) {
    return NextResponse.json(
      { error: "year must be a number" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("sofifa_players")
    .select(
      "sofifa_id, name, overall, potential, positions, age, image_url, nationality"
    )
    .eq("club", club)
    .eq("fifa_year", year)
    .order("overall", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { club, year, roster: data ?? [] },
    {
      headers: { "Cache-Control": "public, max-age=3600" },
    }
  );
}
