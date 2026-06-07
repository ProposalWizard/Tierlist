import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";

export const maxDuration = 60;

const BIG_CLUBS = new Set([
  "Q9141",   // Manchester United
  "Q18656",  // Arsenal
  "Q9616",   // Liverpool
  "Q9609",   // Chelsea
  "Q50602",  // Manchester City
  "Q19794",  // Tottenham
  "Q8682",   // Real Madrid
  "Q7156",   // Barcelona
  "Q8687",   // Bayern Munich
  "Q3400",   // Juventus
  "Q3740",   // Inter Milan
  "Q12460",  // AC Milan
  "Q483020", // PSG
  "Q12303",  // Borussia Dortmund
  "Q19588",  // Aston Villa
  "Q8701",   // Atletico Madrid
  "Q485625", // RB Leipzig
  "Q10444",  // Napoli
]);

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();

  // Find national team club IDs
  const { data: ntClubs } = await service
    .from("football_clubs")
    .select("wikidata_id, name")
    .ilike("name", "%national%");
  const nationalTeamIds = new Set((ntClubs ?? []).map((c) => c.wikidata_id));

  // Single pass through all careers
  const bigClubPlayers = new Set<string>();
  const nationalTeamPlayers = new Set<string>();
  let offset = 0;

  while (true) {
    const { data: careers } = await service
      .from("football_careers")
      .select("player_id, club_id")
      .range(offset, offset + 4999);

    if (!careers || careers.length === 0) break;

    for (const c of careers) {
      if (BIG_CLUBS.has(c.club_id)) bigClubPlayers.add(c.player_id);
      if (nationalTeamIds.has(c.club_id)) nationalTeamPlayers.add(c.player_id);
    }

    if (careers.length < 5000) break;
    offset += 5000;
  }

  // Compute scores: big club = 500, national team = 300
  const allPlayerIds = new Set([...bigClubPlayers, ...nationalTeamPlayers]);
  const scores = new Map<string, number>();
  for (const id of allPlayerIds) {
    let score = 0;
    if (bigClubPlayers.has(id)) score += 500;
    if (nationalTeamPlayers.has(id)) score += 300;
    scores.set(id, score);
  }

  // Update in batches (need name for NOT NULL constraint)
  let updated = 0;
  const ids = Array.from(scores.keys());

  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { data: players } = await service
      .from("football_players")
      .select("wikidata_id, name")
      .in("wikidata_id", chunk);

    if (!players || players.length === 0) continue;

    const rows = players.map((p) => ({
      wikidata_id: p.wikidata_id,
      name: p.name,
      popularity: scores.get(p.wikidata_id) ?? 0,
    }));

    const { error } = await service
      .from("football_players")
      .upsert(rows, { onConflict: "wikidata_id" });

    if (!error) updated += rows.length;
  }

  return NextResponse.json({
    bigClubPlayers: bigClubPlayers.size,
    nationalTeamPlayers: nationalTeamPlayers.size,
    both: Array.from(bigClubPlayers).filter((id) => nationalTeamPlayers.has(id)).length,
    totalScored: scores.size,
    updated,
  });
}
