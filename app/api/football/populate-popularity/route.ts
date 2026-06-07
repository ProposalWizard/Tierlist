import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";

export const maxDuration = 60;

const SPARQL_ENDPOINT = "https://query.wikidata.org/sparql";
const UA = "Knowitball/1.0 (knowitballcontact@gmail.com)";

const BIG_CLUBS: [string, string][] = [
  ["Q9141", "Manchester United"],
  ["Q18656", "Arsenal"],
  ["Q9616", "Liverpool"],
  ["Q9609", "Chelsea"],
  ["Q50602", "Manchester City"],
  ["Q19794", "Tottenham"],
  ["Q8682", "Real Madrid"],
  ["Q7156", "Barcelona"],
  ["Q8687", "Bayern Munich"],
  ["Q3400", "Juventus"],
  ["Q3740", "Inter Milan"],
  ["Q12460", "AC Milan"],
  ["Q483020", "PSG"],
  ["Q12303", "Borussia Dortmund"],
  ["Q19588", "Aston Villa"],
  ["Q8701", "Atletico Madrid"],
  ["Q485625", "RB Leipzig"],
  ["Q10444", "Napoli"],
];

async function runSparql(query: string): Promise<Record<string, { value: string } | undefined>[]> {
  const res = await fetch(SPARQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/sparql-results+json",
      "User-Agent": UA,
    },
    body: `query=${encodeURIComponent(query)}`,
  });
  if (!res.ok) throw new Error(`SPARQL ${res.status}`);
  const json = JSON.parse(await res.text());
  return json.results?.bindings ?? [];
}

function extractId(uri: string | undefined): string | null {
  if (!uri) return null;
  return uri.split("/").pop() ?? null;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clubIndex = 0 } = await req.json().catch(() => ({ clubIndex: 0 }));
  const service = createServiceClient();

  if (clubIndex >= BIG_CLUBS.length) {
    return NextResponse.json({ done: true, clubIndex });
  }

  const [clubId, clubName] = BIG_CLUBS[clubIndex];

  // Ask Wikidata: "who played for this club?"
  const query = `
    SELECT DISTINCT ?player WHERE {
      ?player wdt:P54 wd:${clubId} .
      ?player wdt:P106 wd:Q937857 .
    }
  `;

  const rows = await runSparql(query);
  const playerIds = rows
    .map((r) => extractId(r.player?.value))
    .filter((id): id is string => id !== null);

  if (playerIds.length === 0) {
    return NextResponse.json({
      clubIndex,
      club: clubName,
      wikidataPlayers: 0,
      matched: 0,
      updated: 0,
      hasMore: clubIndex + 1 < BIG_CLUBS.length,
      nextClubIndex: clubIndex + 1,
    });
  }

  // Match against our DB and update popularity
  let matched = 0;
  let updated = 0;

  for (let i = 0; i < playerIds.length; i += 200) {
    const chunk = playerIds.slice(i, i + 200);
    const { data: existing } = await service
      .from("football_players")
      .select("wikidata_id, name, popularity")
      .in("wikidata_id", chunk);

    if (!existing || existing.length === 0) continue;
    matched += existing.length;

    // Only update players who don't already have the big club bonus
    const toUpdate = existing
      .filter((p) => (p.popularity ?? 0) < 500)
      .map((p) => ({
        wikidata_id: p.wikidata_id,
        name: p.name,
        popularity: Math.max((p.popularity ?? 0) + 500, 500),
      }));

    if (toUpdate.length > 0) {
      const { error } = await service
        .from("football_players")
        .upsert(toUpdate, { onConflict: "wikidata_id" });
      if (!error) updated += toUpdate.length;
    }
  }

  return NextResponse.json({
    clubIndex,
    club: clubName,
    wikidataPlayers: playerIds.length,
    matched,
    updated,
    hasMore: clubIndex + 1 < BIG_CLUBS.length,
    nextClubIndex: clubIndex + 1,
  });
}
