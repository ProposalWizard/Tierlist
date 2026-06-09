import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET() {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const service = createServiceClient();

  const years = Array.from({ length: 20 }, (_, i) => 2007 + i);
  const stats: { fifa_year: number; count: number }[] = [];

  for (const y of years) {
    const { count } = await service
      .from("sofifa_players")
      .select("*", { count: "exact", head: true })
      .eq("fifa_year", y);
    if (count && count > 0) stats.push({ fifa_year: y, count });
  }

  return NextResponse.json({ stats });
}
