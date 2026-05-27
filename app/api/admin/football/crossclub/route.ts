import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { findPlayersForBothClubs } from "@/lib/wikidata";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id)))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const club1 = req.nextUrl.searchParams.get("club1");
  const club2 = req.nextUrl.searchParams.get("club2");
  if (!club1 || !club2)
    return NextResponse.json({ error: "club1 and club2 params required" }, { status: 400 });

  try {
    const result = await findPlayersForBothClubs(club1, club2);
    return NextResponse.json(result);
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Query failed" },
      { status: 500 },
    );
  }
}
