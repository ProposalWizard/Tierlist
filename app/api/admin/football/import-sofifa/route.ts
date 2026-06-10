import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { players, year, edition } = body as {
    players: {
      sofifa_id: string;
      name: string;
      positions?: string;
      nationality?: string;
      club?: string;
      league?: string;
      overall?: number;
      potential?: number;
      age?: number;
      image_url?: string;
      attributes?: Record<string, unknown>;
    }[];
    year: number;
    edition: string;
  };

  if (!players || !Array.isArray(players) || !year || !edition) {
    return NextResponse.json(
      { error: "Missing players array, year, or edition" },
      { status: 400 }
    );
  }

  const service = createServiceClient();
  let saved = 0;
  let skipped = 0;
  let failed = 0;
  const chunkSize = 200;

  // Filter out invalid players before upserting
  const validPlayers = players.filter((p) => {
    if (!p.sofifa_id || String(p.sofifa_id).trim() === "") {
      skipped++;
      return false;
    }
    if (!p.name || String(p.name).trim() === "") {
      skipped++;
      return false;
    }
    return true;
  });

  for (let i = 0; i < validPlayers.length; i += chunkSize) {
    const chunk = validPlayers.slice(i, i + chunkSize);
    const rows = chunk.map((p) => ({
      sofifa_id: p.sofifa_id,
      fifa_year: year,
      fifa_edition: edition,
      name: p.name,
      positions: p.positions || null,
      nationality: p.nationality || null,
      club: p.club || null,
      league: p.league || null,
      overall: p.overall ?? null,
      potential: p.potential ?? null,
      age: p.age ?? null,
      image_url: p.image_url || null,
      attributes: p.attributes ?? {},
    }));

    const { error } = await service
      .from("sofifa_players")
      .upsert(rows, { onConflict: "sofifa_id,fifa_year" });

    if (!error) {
      saved += chunk.length;
    } else {
      // Chunk failed — fall back to inserting one by one
      console.error(
        `[import-sofifa] Chunk upsert failed (rows ${i}–${i + chunk.length - 1}): ${error.message}`
      );
      for (const row of rows) {
        const { error: rowError } = await service
          .from("sofifa_players")
          .upsert([row], { onConflict: "sofifa_id,fifa_year" });

        if (!rowError) {
          saved++;
        } else {
          failed++;
          console.error(
            `[import-sofifa] Row failed (sofifa_id=${row.sofifa_id}, name=${row.name}): ${rowError.message}`
          );
        }
      }
    }
  }

  return NextResponse.json({
    saved,
    total: players.length,
    skipped,
    failed,
    validCount: validPlayers.length,
  });
}
