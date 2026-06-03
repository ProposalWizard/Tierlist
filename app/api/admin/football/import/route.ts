import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";
import {
  fetchPlayerBatch,
  fetchCareerBatch,
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

export async function POST(req: NextRequest) {
  const user = await adminGuard();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { step, offset = 0 } = await req.json();
  const service = createServiceClient();

  try {
    switch (step) {
      case "players": {
        const { players, countries, rawRows, hasMore } = await fetchPlayerBatch(offset);

        if (countries.length > 0) {
          for (let i = 0; i < countries.length; i += 500) {
            await service.from("football_countries").upsert(
              countries.slice(i, i + 500),
              { onConflict: "wikidata_id" }
            );
          }
        }

        if (players.length > 0) {
          for (let i = 0; i < players.length; i += 500) {
            await service.from("football_players").upsert(
              players.slice(i, i + 500).map((p) => ({
                ...p,
                updated_at: new Date().toISOString(),
              })),
              { onConflict: "wikidata_id" }
            );
          }
        }

        return NextResponse.json({
          step: "players",
          imported: players.length,
          rawRows,
          hasMore,
          nextOffset: hasMore ? offset + 2000 : null,
        });
      }

      case "careers": {
        const { careers, clubs, rawRows, hasMore } = await fetchCareerBatch(offset);

        if (clubs.length > 0) {
          for (let i = 0; i < clubs.length; i += 500) {
            await service.from("football_clubs").upsert(
              clubs.slice(i, i + 500),
              { onConflict: "wikidata_id" }
            );
          }
        }

        let careerCount = 0;
        if (careers.length > 0) {
          for (let i = 0; i < careers.length; i += 500) {
            const { error } = await service.from("football_careers").upsert(
              careers.slice(i, i + 500),
              { onConflict: "player_id,club_id,start_date" }
            );
            if (!error) careerCount += Math.min(500, careers.length - i);
          }
        }

        return NextResponse.json({
          step: "careers",
          imported: careerCount,
          clubsFound: clubs.length,
          rawRows,
          hasMore,
          nextOffset: hasMore ? offset + 3000 : null,
        });
      }

      case "flags": {
        const { data: countryRows } = await service
          .from("football_countries")
          .select("wikidata_id");

        const ids = (countryRows ?? []).map((c: { wikidata_id: string }) => c.wikidata_id);

        // Batch flag queries in groups of 200 to avoid SPARQL timeout
        let totalFlags = 0;
        for (let i = 0; i < ids.length; i += 200) {
          const batch = ids.slice(i, i + 200);
          const flags = await fetchCountryFlags(batch);
          const updates = flags
            .filter((f) => f.flag_url)
            .map((f) => ({ wikidata_id: f.wikidata_id, flag_url: f.flag_url }));

          if (updates.length > 0) {
            for (let j = 0; j < updates.length; j += 500) {
              await service.from("football_countries").upsert(
                updates.slice(j, j + 500),
                { onConflict: "wikidata_id" }
              );
            }
            totalFlags += updates.length;
          }
        }

        return NextResponse.json({ step: "flags", imported: totalFlags });
      }

      case "club-details": {
        const { data: clubRows } = await service
          .from("football_clubs")
          .select("wikidata_id")
          .range(offset, offset + 199);

        if (!clubRows || clubRows.length === 0) {
          return NextResponse.json({ step: "club-details", imported: 0, hasMore: false });
        }

        const ids = clubRows.map((c: { wikidata_id: string }) => c.wikidata_id);
        const details = await fetchClubDetails(ids);

        if (details.length > 0) {
          for (let i = 0; i < details.length; i += 500) {
            await service.from("football_clubs").upsert(
              details.slice(i, i + 500).map((d) => ({
                ...d,
                updated_at: new Date().toISOString(),
              })),
              { onConflict: "wikidata_id" }
            );
          }
        }

        return NextResponse.json({
          step: "club-details",
          imported: details.length,
          hasMore: clubRows.length === 200,
          nextOffset: clubRows.length === 200 ? offset + 200 : null,
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
