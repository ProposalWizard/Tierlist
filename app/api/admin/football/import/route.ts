import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";
import {
  fetchPlayersByYear,
  fetchPlayersNoDob,
  fetchPlayerDetails,
  fetchCareersForPlayers,
  fetchCountryFlags,
  fetchClubDetails,
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
        const { players, rawRows } = await fetchPlayersByYear(year);

        if (players.length > 0) {
          await upsertChunked(
            service,
            "football_players",
            players.map((p) => ({ ...p, updated_at: new Date().toISOString() })),
            "wikidata_id"
          );
        }

        return NextResponse.json({ step: "players", year, imported: players.length, rawRows });
      }

      case "players-no-dob": {
        const { players, rawRows } = await fetchPlayersNoDob();

        if (players.length > 0) {
          await upsertChunked(
            service,
            "football_players",
            players.map((p) => ({ ...p, updated_at: new Date().toISOString() })),
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
            details.map((d) => ({ ...d, updated_at: new Date().toISOString() })),
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

      case "careers": {
        const offset = (body.offset as number) ?? 0;
        const batchSize = 100;

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
          await upsertChunked(service, "football_clubs", clubs, "wikidata_id");
        }
        if (careers.length > 0) {
          await upsertChunked(service, "football_careers", careers, "player_id,club_id,start_date");
        }

        const hasMore = playerRows.length === batchSize;

        return NextResponse.json({
          step: "careers",
          imported: careers.length,
          clubsFound: clubs.length,
          hasMore,
          nextOffset: hasMore ? offset + batchSize : null,
        });
      }

      case "flags": {
        const { data: countryRows } = await service
          .from("football_countries")
          .select("wikidata_id");

        const ids = (countryRows ?? []).map((c: { wikidata_id: string }) => c.wikidata_id);

        let totalFlags = 0;
        for (let i = 0; i < ids.length; i += 200) {
          const batch = ids.slice(i, i + 200);
          const flags = await fetchCountryFlags(batch);
          const updates = flags
            .filter((f) => f.flag_url)
            .map((f) => ({ wikidata_id: f.wikidata_id, flag_url: f.flag_url }));

          if (updates.length > 0) {
            await upsertChunked(service, "football_countries", updates, "wikidata_id");
            totalFlags += updates.length;
          }
        }

        return NextResponse.json({ step: "flags", imported: totalFlags });
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
            details.map((d) => ({ ...d, updated_at: new Date().toISOString() })),
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
