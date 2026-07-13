import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";

export const maxDuration = 60;
// Reads the live DB — must never be frozen into a build-time static snapshot.
export const dynamic = "force-dynamic";

// Distinct nationalities + clubs from the player pool. These are the EXACT
// strings the objective evaluator substring-matches against, so feeding them
// into the admin's autocomplete guarantees a picked value always matches real
// players (no typos, no accent mismatches like "Cote d'Ivoire" vs "Côte d'Ivoire").
export async function GET() {
  const authClient = await createClient();
  const { data: { user }, error: authErr } = await authClient.auth.getUser();
  if (authErr || !user || !(await isAdmin(user.id))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const supabase = createServiceClient();
  const nations = new Set<string>();
  const clubs = new Set<string>();

  const add = (nat: unknown, club: unknown, manualNat?: unknown) => {
    const n = (manualNat as string) || (nat as string);
    if (n && typeof n === "string" && n.trim()) nations.add(n.trim());
    if (club && typeof club === "string" && club.trim()) clubs.add(club.trim());
  };

  // Fast path: dedicated SQL function (see supabase/migrations/objective_vocab.sql).
  const { data: rpcData, error: rpcError } = await supabase.rpc("get_player_vocab");
  if (!rpcError && Array.isArray(rpcData)) {
    for (const row of rpcData as { nationality: string | null; club: string | null }[]) {
      add(row.nationality, row.club);
    }
  } else {
    // Fallback: paginate through the player table. Stable ordering by id is
    // required, else .range() pages can skip or duplicate rows.
    const PAGE_SIZE = 1000;
    let from = 0;
    while (true) {
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from("sofifa_players")
        .select("nationality, manual_nationality, club")
        .order("id", { ascending: true })
        .range(from, to);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      for (const row of data ?? []) {
        add(row.nationality, row.club, (row as { manual_nationality?: string }).manual_nationality);
      }
      if (!data || data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
  }

  const nationalities = Array.from(nations).sort((a, b) => a.localeCompare(b));
  const clubList = Array.from(clubs).sort((a, b) => a.localeCompare(b));

  return NextResponse.json(
    { nationalities, clubs: clubList },
    { headers: { "Cache-Control": "private, max-age=3600" } },
  );
}
