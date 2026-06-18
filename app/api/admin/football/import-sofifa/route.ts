import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const maxDuration = 300;

const REMOVE_POSITIONS = new Set(['RAM', 'LAM', 'RF', 'LF', 'SW']);

function cleanPositions(raw: string | undefined): string | null {
  if (!raw) return null;
  const parts = raw.split(',').map(p => p.trim()).filter(Boolean);
  const cleaned: string[] = [];
  let hasST = parts.some(p => p.toUpperCase() === 'ST');
  for (const p of parts) {
    const upper = p.toUpperCase();
    if (REMOVE_POSITIONS.has(upper)) continue;
    if (upper === 'CF') {
      if (!hasST) { cleaned.push('ST'); hasST = true; }
      continue;
    }
    cleaned.push(p);
  }
  return cleaned.join(',') || null;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { players, year, edition, replaceAll } = body as {
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
    replaceAll?: boolean;
  };

  if (!players || !Array.isArray(players) || !year || !edition) {
    return NextResponse.json(
      { error: "Missing players array, year, or edition" },
      { status: 400 }
    );
  }

  const service = createServiceClient();

  let deleted = 0;
  if (replaceAll) {
    const { count, error: delError } = await service
      .from("sofifa_players")
      .delete({ count: "exact" })
      .eq("fifa_year", year);
    if (delError) {
      return NextResponse.json(
        { error: `Failed to clear year ${year}: ${delError.message}` },
        { status: 500 }
      );
    }
    deleted = count ?? 0;
  }

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
      name: String(p.name).replace(/^\d+\s+/, "").trim(),
      positions: cleanPositions(p.positions),
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
    deleted,
    validCount: validPlayers.length,
  });
}
