import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  getVersionsAndColumns,
  scrapePage,
  getVersionCodeForYear,
  type SofifaPlayer,
} from "@/lib/sofifaScraper";

export const maxDuration = 300;

async function checkAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) return false;
  return true;
}

export async function GET() {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const meta = await getVersionsAndColumns();
  if (!meta) {
    return NextResponse.json(
      { error: "Could not reach SoFIFA — may be blocked by Cloudflare" },
      { status: 502 }
    );
  }

  return NextResponse.json({
    versions: meta.versions,
    columnCount: meta.columns.length,
    columns: meta.columns.map((c) => c.name),
  });
}

export async function POST(req: NextRequest) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { year, maxPages } = body as { year: number; maxPages?: number };

  if (!year || year < 2007 || year > 2030) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }

  const meta = await getVersionsAndColumns();
  if (!meta) {
    return NextResponse.json(
      { error: "Could not reach SoFIFA" },
      { status: 502 }
    );
  }

  const versionCode = getVersionCodeForYear(meta.versions, year);
  if (!versionCode) {
    return NextResponse.json(
      { error: `No SoFIFA version found for year ${year}` },
      { status: 404 }
    );
  }

  const yy = String(year % 100).padStart(2, "0");
  const edition = year >= 2024 ? `FC ${yy}` : `FIFA ${yy}`;

  const supabase = createServiceClient();
  const allPlayers: SofifaPlayer[] = [];
  let offset = 0;
  let page = 1;
  const limit = maxPages ?? 999;

  while (page <= limit) {
    const { players, nextOffset } = await scrapePage(
      versionCode,
      meta.columns,
      offset
    );

    allPlayers.push(...players);

    if (!nextOffset || players.length === 0) break;
    offset = nextOffset;
    page++;

    await new Promise((r) => setTimeout(r, 1500));
  }

  if (allPlayers.length === 0) {
    return NextResponse.json({
      edition,
      scraped: 0,
      saved: 0,
      message: "No players found — SoFIFA may be blocking requests",
    });
  }

  let saved = 0;
  const chunkSize = 200;
  for (let i = 0; i < allPlayers.length; i += chunkSize) {
    const chunk = allPlayers.slice(i, i + chunkSize);
    const rows = chunk.map((p) => ({
      sofifa_id: p.sofifa_id,
      fifa_year: year,
      fifa_edition: edition,
      name: p.name,
      positions: p.positions || null,
      nationality: p.nationality || null,
      club: p.club || null,
      league: p.league || null,
      overall: p.overall,
      potential: p.potential,
      age: p.age,
      image_url: p.image_url,
      attributes: p.attributes,
    }));

    const { error } = await supabase
      .from("sofifa_players")
      .upsert(rows, { onConflict: "sofifa_id,fifa_year" });

    if (!error) saved += chunk.length;
  }

  return NextResponse.json({
    edition,
    scraped: allPlayers.length,
    saved,
    pages: page,
  });
}
