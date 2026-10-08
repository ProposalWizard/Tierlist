import { NextRequest, NextResponse } from "next/server";
import { createPublicReadClient } from "@/lib/supabase/publicRead";
import { STAR_FIFA_YEAR } from "@/lib/star/edition";
import { portraitsFromOtherEditions, isSelfHosted } from "@/lib/star/portraitFallback";
import { attributesFromJson } from "@/lib/playerAttributes";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

/**
 * PLAYER SEARCH BY NAME — for Settings → Dev — Squad ("add any player").
 *
 * Read-only, public-read table (sofifa_players), same client as the other
 * star data routes. Returns one row per real player: the current edition
 * (STAR_FIFA_YEAR) when he is in it, otherwise his newest older edition —
 * so Mbappé / Haaland / Kane turn up even if the hand-built FC 27 edition
 * only covers some clubs.
 */

const ACCENTS: Record<string, string[]> = {
  a: ["á", "à", "ä", "â", "ã"], c: ["ç", "č", "ć"], e: ["é", "è", "ë", "ê", "ě"],
  i: ["í", "ì", "ï", "î"], n: ["ñ", "ń"], o: ["ó", "ò", "ö", "ô", "ø"],
  s: ["š", "ş", "ś"], u: ["ú", "ù", "ü", "û"], z: ["ž", "ź"], d: ["đ"], l: ["ł"],
};

/** The query itself, plus a version with each accent-able letter accented. */
function variants(q: string): string[] {
  const out = new Set<string>([q]);
  const lower = q.toLowerCase();
  for (let i = 0; i < lower.length && out.size < 24; i++) {
    for (const acc of ACCENTS[lower[i]] ?? []) out.add(q.slice(0, i) + acc + q.slice(i + 1));
  }
  return Array.from(out);
}

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().replace(/[%,()*]/g, " ").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const supabase = createPublicReadClient();
  const filter = variants(q).map(v => `name.ilike.%${v}%`).join(",");

  const { data, error } = await supabase
    .from("sofifa_players")
    .select("sofifa_id, fifa_year, name, club, overall, manual_overall, positions, manual_positions, age, image_url, nationality, manual_nationality, attributes")
    .or(filter)
    .order("fifa_year", { ascending: false })
    .order("overall", { ascending: false, nullsFirst: false })
    .limit(150);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Newest edition first, so the first row seen for an id is the one kept.
  const seen = new Set<string>();
  const results: Record<string, unknown>[] = [];
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const id = String(row.sofifa_id);
    if (seen.has(id)) continue;
    seen.add(id);
    const overall = (row.manual_overall as number) || (row.overall as number) || 0;
    const attrs = attributesFromJson(row.attributes);
    results.push({
      sofifaId: id,
      year: row.fifa_year,
      name: ((row.name as string) || "").trim(),
      club: ((row.club as string) || "").trim(),
      overall,
      positions: (((row.manual_positions as string) || (row.positions as string)) || "").trim(),
      age: (row.age as number) || undefined,
      image: ((row.image_url as string) || "").trim() || undefined,
      nation: (((row.manual_nationality as string) || (row.nationality as string)) || "").trim() || undefined,
      pace: attrs.pace || undefined, shooting: attrs.shooting || undefined,
      passing: attrs.passing || undefined, dribbling: attrs.dribbling || undefined,
      defending: attrs.defending || undefined, physical: attrs.physical || undefined,
    });
  }
  results.sort((a, b) => (b.overall as number) - (a.overall as number));
  const top = results.slice(0, 20);

  const faceless = top.filter(p => !isSelfHosted(p.image as string | undefined));
  if (faceless.length > 0) {
    const rescued = await portraitsFromOtherEditions(supabase, faceless.map(p => p.sofifaId as string), STAR_FIFA_YEAR);
    for (const p of faceless) {
      const found = rescued.get(p.sofifaId as string);
      if (found) p.image = found;
    }
  }
  return NextResponse.json({ results: top });
}
