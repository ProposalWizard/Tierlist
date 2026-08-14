import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { STAR_FIFA_YEAR } from "@/lib/star/edition";
import { CLUB_KITS } from "@/lib/star/kits";

export const maxDuration = 30;
// Force dynamic: this route reads the live DB, so it must never be frozen into
// a build-time static snapshot (which also can't reach Supabase during build).
export const dynamic = "force-dynamic";

// Match the English Premier League only. Older FIFA editions call it
// "English Premier League"; newer ones "Premier League". A plain
// %Premier League% match would also catch Scottish/Russian/Ukrainian
// Premier Leagues, so we anchor the patterns to the start of the name.
const PL_FILTER = "league.ilike.Premier League%,league.ilike.English Premier League%,league.ilike.Barclays Premier League%";

// SoFIFA gives Russia's and Ukraine's top divisions the SAME name ("Premier
// League") as England's, so the filter above also catches their clubs. None of
// these are English, and this set is closed (the Russian league left FIFA after
// 2022; Ukraine only ever has these two), so a name denylist is reliable here.
const NON_ENGLISH_PL_CLUBS = new Set(
  [
    // Ukrainian Premier League
    "Dynamo Kyiv", "Shakhtar Donetsk",
    // Russian Premier League
    "Akhmat Grozny", "Alaniya", "Arsenal Tula", "FC Amkar Perm",
    "FC Anzhi Makhachkala", "FC Dynamo Moscow", "FC Khimki", "FC Krasnodar",
    "FC Kuban Krasnodar", "FC Lokomotiv", "FC Moscow", "FC Orenburg",
    "FC Rostov", "FC Tom Tomsk", "FC Tosno", "FC Ufa", "FC Ural Yekaterinburg",
    "FC Volga Nizhny Novgorod", "Mordovia Saransk", "PFC CSKA",
    "PFC Krylia Sovetov Samara", "Rubin Kazan", "SKA Khabarovsk",
    "Saturn Ramenskoye", "Spartak Moscow", "Spartak Nalchik", "Torpedo Moscow",
    "FC Sibir Novosibirsk",
    "Zenit",
  ].map((c) => c.toLowerCase())
);

/**
 * The current twenty, spelled the way the database spells them.
 *
 * Not a second copy of the list — it IS the list, read off `CLUB_KITS`, which
 * has to be keyed on the database's spelling anyway or a club would play in the
 * wrong colours. See the second pass below for why it is here.
 */
const CURRENT_PL_CLUBS = Object.keys(CLUB_KITS);

function isEnglishPLClub(club: string): boolean {
  return !NON_ENGLISH_PL_CLUBS.has(club.trim().toLowerCase());
}

const PAGE_SIZE = 1000;

export async function GET() {
  const supabase = createServiceClient();

  const clubMap = new Map<string, Set<number>>();
  const add = (club: string | null, year: number | null) => {
    if (!club || typeof year !== "number") return;
    if (!clubMap.has(club)) clubMap.set(club, new Set());
    clubMap.get(club)!.add(year);
  };

  // ── Pass 1: every club whose league SAYS Premier League ─────────────────────
  //
  // Fast path: dedicated SQL function (see supabase/migrations/draft_club_seasons.sql).
  //
  // Paginated, and ordered so that pagination means anything. It returns one row
  // per club-and-season pair across every edition in the database — around a
  // thousand of them once twenty years of Russian, Ukrainian and English clubs
  // are counted — and PostgREST will cut a response off at its row cap without
  // saying so. Unpaginated, that silently loses whichever pairs fall past the
  // cap, and a newly-written edition is exactly the kind of thing that sits at
  // the end of an unordered result.
  let rpcWorked = true;
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .rpc("get_pl_club_seasons")
      .order("club", { ascending: true })
      .order("fifa_year", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error || !Array.isArray(data)) { rpcWorked = false; break; }
    for (const row of data as { club: string; fifa_year: number }[]) {
      if (isEnglishPLClub(row.club ?? "")) add(row.club, row.fifa_year);
    }
    if (data.length < PAGE_SIZE) break;
  }

  if (!rpcWorked) {
    // Fallback: paginate through all PL player rows.
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("sofifa_players")
        .select("club, fifa_year")
        .or(PL_FILTER)
        // Stable ordering is required — without it Postgres gives no ordering
        // guarantee across .range() pages, so rows can be skipped or duplicated.
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      for (const row of data ?? []) {
        if (isEnglishPLClub((row.club as string) ?? "")) {
          add(row.club as string, row.fifa_year as number);
        }
      }
      if (!data || data.length < PAGE_SIZE) break;
    }
  }

  // ── Pass 2: the current twenty, by name ─────────────────────────────────────
  //
  // Everything above decides what is a Premier League club by reading the
  // `league` text column, and for the archive that is the only thing there is to
  // read. FC 27 is different: it is not an EA export, it is built here — cloned
  // from FC 26 and then edited player by player in /admin/football/players
  // through a transfer window. A row typed by hand, or written by a clone form
  // that got a field wrong, can end up with a league that does not match, and
  // then the club it belongs to vanishes from this list with nothing on screen
  // to say why. That is not hypothetical; it is what happened to FC 27.
  //
  // The twenty current clubs do not need to be inferred. We know their names, so
  // for the edition the career is actually played in we ask for them directly
  // and the league column cannot cost us an entire season. Bounded to
  // STAR_FIFA_YEAR and later, so this stays one small query rather than a scan
  // of twenty years of football.
  let byName = 0;
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("sofifa_players")
      .select("club, fifa_year")
      .in("club", CURRENT_PL_CLUBS)
      .gte("fifa_year", STAR_FIFA_YEAR)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    // Best effort by design: pass 1 has already produced a usable answer, and a
    // failure here should cost the newest edition, not the whole endpoint.
    if (error) break;
    for (const row of data ?? []) {
      add(row.club as string, row.fifa_year as number);
      byName++;
    }
    if (!data || data.length < PAGE_SIZE) break;
  }

  const clubs = Array.from(clubMap.entries())
    .map(([name, seasonsSet]) => ({
      name,
      seasons: Array.from(seasonsSet).sort((a, b) => a - b),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json(
    {
      clubs,
      // Enough to tell the three failure modes apart from a browser, without
      // needing database access: whether the SQL function is installed, whether
      // the current edition was found by name, and which editions came back.
      meta: {
        rpc: rpcWorked,
        currentEdition: STAR_FIFA_YEAR,
        playersFoundByName: byName,
        editions: Array.from(new Set(clubs.flatMap((c) => c.seasons))).sort((a, b) => b - a),
      },
    },
    {
      // ── Not cached ──
      //
      // This is the list of clubs that exist in each edition, and FC 27 is being
      // built by hand right now — cloned in, edited, players moved between clubs
      // while the transfer window is open. It was cached for an hour, then for a
      // minute; both meant a club that had just gained its first FC 27 player
      // did not appear, with nothing on screen to say the answer was stale, and
      // a stale answer here reads as "the import failed" and sends you back to
      // the SQL editor. The RPC makes the query cheap enough to just ask.
      headers: { "Cache-Control": "no-store" },
    }
  );
}
