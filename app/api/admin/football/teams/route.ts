import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { getClubSquad, getClubHistory } from "@/lib/wikidata";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const clubId = searchParams.get("club");
  const history = searchParams.get("history") === "true";

  if (!clubId) {
    return NextResponse.json({ error: "club param required" }, { status: 400 });
  }

  try {
    if (history) {
      const data = await getClubHistory(clubId);
      return NextResponse.json(data);
    }
    const data = await getClubSquad(clubId);
    return NextResponse.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
