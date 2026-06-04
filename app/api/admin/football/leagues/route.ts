import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json({ error: "q param required" }, { status: 400 });
  }

  try {
    const service = createServiceClient();
    const { data } = await service
      .from("football_clubs")
      .select("wikidata_id, name, country, league, image_url")
      .ilike("name", `%${query}%`)
      .limit(20);

    const clubs = (data ?? []).map((c: Record<string, unknown>) => ({
      id: c.wikidata_id as string,
      name: c.name as string,
      country: (c.country as string) ?? "",
      league: (c.league as string) ?? null,
      image: (c.image_url as string) ?? null,
    }));

    return NextResponse.json({ clubs });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
