import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";
import {
  fetchPlayersByYear,
  fetchPlayersNoDob,
  fetchPlayerDetails,
  fetchCareersForPlayers,
  fetchClubDetails,
  fetchSinglePlayer,
} from "@/lib/footballImport";

export const maxDuration = 60;

async function adminGuard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) return null;
  return user;
}

export async function GET() {
  const user = await adminGuard();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();

  const [players, clubs, careers, countries] = await Promise.all([
    service.from("football_players").select("wikidata_id", { count: "exact", head: true }),
    service.from("football_clubs").select("wikidata_id", { count: "exact", head: true }),
    service.from("football_careers").select("id", { count: "exact", head: true }),
    service.from("football_countries").select("wikidata_id", { count: "exact", head: true }),
  ]);

  return NextResponse.json({
    players: players.count ?? 0,
    clubs: clubs.count ?? 0,
    careers: careers.count ?? 0,
    countries: countries.count ?? 0,
  });
}

async function upsertChunked(
  service: ReturnType<typeof createServiceClient>,
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string,
  chunkSize = 500
) {
  for (let i = 0; i < rows.length; i += chunkSize) {
    await service.from(table).upsert(rows.slice(i, i + chunkSize), { onConflict });
  }
}

// Narrow upsert payloads to columns that still exist in the slimmed schema
// (player photos, popularity, date_of_birth, updated_at, club logos and flags
//  were dropped to save storage).
function slimPlayer(p: Record<string, unknown>) {
  return {
    wikidata_id: p.wikidata_id,
    name: p.name ?? null,
    country_id: p.country_id ?? null,
    position: p.position ?? null,
  };
}
function slimClub(c: Record<string, unknown>) {
  return {
    wikidata_id: c.wikidata_id,
    name: c.name ?? null,
    country: c.country ?? null,
    league: c.league ?? null,
  };
}

export async function POST(req: NextRequest) {
  const user = await adminGuard();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { step } = body;
  const service = createServiceClient();

  try {
    switch (step) {
      case "players": {
        const year = body.year as number;
        const half = (body.half as 1 | 2) ?? 1;
        const { players, rawRows } = await fetchPlayersByYear(year, half);

        if (players.length > 0) {
          await upsertChunked(
            service,
            "football_players",
            players.map(slimPlayer),
            "wikidata_id"
          );
        }

        return NextResponse.json({ step: "players", year, half, imported: players.length, rawRows });
      }

      case "players-no-dob": {
        const { players, rawRows } = await fetchPlayersNoDob();

        if (players.length > 0) {
          await upsertChunked(
            service,
            "football_players",
            players.map(slimPlayer),
            "wikidata_id"
          );
        }

        return NextResponse.json({ step: "players-no-dob", imported: players.length, rawRows });
      }

      case "player-details": {
        const offset = (body.offset as number) ?? 0;
        const batchSize = 200;

        const { data: playerRows } = await service
          .from("football_players")
          .select("wikidata_id")
          .order("wikidata_id")
          .range(offset, offset + batchSize - 1);

        if (!playerRows || playerRows.length === 0) {
          return NextResponse.json({ step: "player-details", imported: 0, hasMore: false });
        }

        const ids = playerRows.map((r: { wikidata_id: string }) => r.wikidata_id);
        const { details, countries } = await fetchPlayerDetails(ids);

        if (countries.length > 0) {
          await upsertChunked(service, "football_countries", countries, "wikidata_id");
        }

        if (details.length > 0) {
          await upsertChunked(
            service,
            "football_players",
            details.map(slimPlayer),
            "wikidata_id"
          );
        }

        const hasMore = playerRows.length === batchSize;

        return NextResponse.json({
          step: "player-details",
          imported: details.length,
          countriesFound: countries.length,
          hasMore,
          nextOffset: hasMore ? offset + batchSize : null,
        });
      }

      case "single-player": {
        const wikidataId = body.wikidataId as string;
        if (!wikidataId) return NextResponse.json({ error: "Missing wikidataId" }, { status: 400 });

        const { player, country, clubs, careers } = await fetchSinglePlayer(wikidataId);

        if (country) {
          await upsertChunked(service, "football_countries", [country], "wikidata_id");
        }

        await upsertChunked(service, "football_players", [slimPlayer(player as Record<string, unknown>)], "wikidata_id");

        if (clubs.length > 0) {
          await upsertChunked(service, "football_clubs", clubs.map(slimClub), "wikidata_id");
        }
        if (careers.length > 0) {
          await upsertChunked(service, "football_careers", careers, "player_id,club_id,start_date");
        }

        return NextResponse.json({
          step: "single-player",
          wikidataId,
          name: player.name,
          careersImported: careers.length,
          clubsImported: clubs.length,
        });
      }

      case "fill-missing-careers": {
        const offset = (body.offset as number) ?? 0;
        const batchSize = 25;

        // Find players who have no career entries at all
        const { data: allPlayers } = await service
          .from("football_players")
          .select("wikidata_id")
          .order("wikidata_id")
          .range(offset, offset + batchSize - 1);

        if (!allPlayers || allPlayers.length === 0) {
          return NextResponse.json({ step: "fill-missing-careers", imported: 0, hasMore: false });
        }

        const ids = allPlayers.map((r: { wikidata_id: string }) => r.wikidata_id);

        // Check which of these already have careers
        const { data: existingCareers } = await service
          .from("football_careers")
          .select("player_id")
          .in("player_id", ids);

        const withCareers = new Set((existingCareers ?? []).map((r: { player_id: string }) => r.player_id));
        const missing = ids.filter((id) => !withCareers.has(id));

        let imported = 0;
        if (missing.length > 0) {
          const { careers, clubs } = await fetchCareersForPlayers(missing);
          if (clubs.length > 0) {
            await upsertChunked(service, "football_clubs", clubs.map(slimClub), "wikidata_id");
          }
          if (careers.length > 0) {
            await upsertChunked(service, "football_careers", careers, "player_id,club_id,start_date");
          }
          imported = careers.length;
        }

        const hasMore = allPlayers.length === batchSize;
        return NextResponse.json({
          step: "fill-missing-careers",
          checked: ids.length,
          missingCount: missing.length,
          imported,
          hasMore,
          nextOffset: hasMore ? offset + batchSize : null,
        });
      }

      case "careers": {
        const offset = (body.offset as number) ?? 0;
        const batchSize = 25;

        const { data: playerRows } = await service
          .from("football_players")
          .select("wikidata_id")
          .order("wikidata_id")
          .range(offset, offset + batchSize - 1);

        if (!playerRows || playerRows.length === 0) {
          return NextResponse.json({ step: "careers", imported: 0, hasMore: false });
        }

        const ids = playerRows.map((r: { wikidata_id: string }) => r.wikidata_id);
        const { careers, clubs } = await fetchCareersForPlayers(ids);

        if (clubs.length > 0) {
          await upsertChunked(service, "football_clubs", clubs.map(slimClub), "wikidata_id");
        }
        if (careers.length > 0) {
          await upsertChunked(service, "football_careers", careers, "player_id,club_id,start_date");
        }

        const careersHasMore = playerRows.length === batchSize;

        return NextResponse.json({
          step: "careers",
          imported: careers.length,
          clubsFound: clubs.length,
          hasMore: careersHasMore,
          nextOffset: careersHasMore ? offset + batchSize : null,
        });
      }

      case "flags": {
        // Country flags were dropped to save storage — step retired.
        return NextResponse.json({ step: "flags", imported: 0, removed: true });
      }

      case "club-details": {
        const offset = (body.offset as number) ?? 0;

        const { data: clubRows } = await service
          .from("football_clubs")
          .select("wikidata_id")
          .order("wikidata_id")
          .range(offset, offset + 199);

        if (!clubRows || clubRows.length === 0) {
          return NextResponse.json({ step: "club-details", imported: 0, hasMore: false });
        }

        const ids = clubRows.map((c: { wikidata_id: string }) => c.wikidata_id);
        const details = await fetchClubDetails(ids);

        if (details.length > 0) {
          await upsertChunked(
            service,
            "football_clubs",
            details.map(slimClub),
            "wikidata_id"
          );
        }

        const hasMore = clubRows.length === 200;

        return NextResponse.json({
          step: "club-details",
          imported: details.length,
          hasMore,
          nextOffset: hasMore ? offset + 200 : null,
        });
      }

      case "enrich-images": {
        // Player photos were dropped to save storage — step retired.
        return NextResponse.json({ step: "enrich-images", enriched: 0, hasMore: false, removed: true });
      }

      case "clear": {
        await service.from("football_careers").delete().neq("id", 0);
        await service.from("football_players").delete().neq("wikidata_id", "");
        await service.from("football_clubs").delete().neq("wikidata_id", "");
        await service.from("football_countries").delete().neq("wikidata_id", "");
        return NextResponse.json({ step: "clear", done: true });
      }

      default:
        return NextResponse.json({ error: "Invalid step" }, { status: 400 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
