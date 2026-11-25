import { NextResponse, type NextRequest } from "next/server";
import { createPublicReadClient } from "@/lib/supabase/publicRead";
import { STAR_FIFA_YEAR } from "@/lib/star/edition";
import { PREMIER_LEAGUE_CLUBS } from "@/lib/star/clubs";

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
 * The current twenty, spelled the way the database spells them: the game's
 * own Premier League (lib/star/clubs.ts).
 *
 * This used to be read off `CLUB_KITS`, back when that held only the twenty.
 * It now holds every club with a kit (246, Europe and the lower leagues
 * included), so the FC 27 list in PL Draft offered 177 clubs — AC Milan,
 * Accrington, Real Madrid, and junk names like "espa" (seen on the live site,
 * 20 Oct 2026). For the current edition only these twenty count.
 */
const CURRENT_PL_CLUBS: string[] = [...PREMIER_LEAGUE_CLUBS];
const CURRENT_PL_SET = new Set(CURRENT_PL_CLUBS);

function isEnglishPLClub(club: string): boolean {
  return !NON_ENGLISH_PL_CLUBS.has(club.trim().toLowerCase());
}

const PAGE_SIZE = 1000;

/*
 * ── Speed (24 Nov 2026) ──
 * The list below is built by scanning every player row in the database
 * (get_pl_club_seasons has no index to use). Measured on the live site:
 * 9.5 s for a cold first call, about 1 s after, and 14 calls since August
 * that hit the 30-second limit and failed. Almost every new player opens
 * Draft mode first, so that wait was the first thing they saw.
 *
 * Now the answer is kept for 5 minutes: in this server's memory, and on
 * Vercel's CDN, which also hands out the last answer while it fetches a new
 * one in the background (stale-while-revalidate). Players never wait on the
 * scan once it has run once. The admin pages that are editing FC 27 pass
 * ?fresh=1 and always get a new answer (the old "not cached" reason below).
 */
const KEEP_MS = 5 * 60_000;
let kept: { at: number; body: unknown } | null = null;
let building: Promise<unknown> | null = null;

export async function GET(request: NextRequest) {
  const fresh = request.nextUrl.searchParams.get("fresh") === "1";
  if (!fresh && kept && Date.now() - kept.at < KEEP_MS) return answer(kept.body, false);
  try {
    // One scan at a time: callers that arrive while it runs share it.
    building ??= buildClubList().finally(() => { building = null; });
    const body = await building;
    return answer(body, fresh);
  } catch (e) {
    // The scan failed: an older answer beats an error screen.
    if (kept) return answer(kept.body, false);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not load clubs" }, { status: 500 });
  }
}

function answer(body: unknown, fresh: boolean) {
  return NextResponse.json(body, {
    headers: fresh
      ? { "Cache-Control": "no-store" }
      : {
          "Cache-Control": "public, max-age=60, stale-while-revalidate=86400",
          // Vercel's own CDN header: kept 5 minutes, then served stale while it refreshes.
          "Vercel-CDN-Cache-Control": "max-age=300, stale-while-revalidate=86400",
        },
  });
}

async function buildClubList(): Promise<unknown> {
  const supabase = createPublicReadClient();

  const clubMap = new Map<string, Set<number>>();
  const add = (club: string | null, year: number | null) => {
    if (!club || typeof year !== "number") return;
    // A two-digit year (26 for 2026) is a row written by the old clone form
    // (fix_two_digit_fifa_years.sql); it is not an edition of its own.
    if (year < 2000) return;
    // The edition the career is played in has exactly the game's twenty.
    if (year >= STAR_FIFA_YEAR && !CURRENT_PL_SET.has(club)) return;
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

      if (error) throw new Error(error.message);
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

  const body = {
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
  };
  // A list with no clubs is never kept: it is a failed read, not an answer.
  if (clubs.length > 0) kept = { at: Date.now(), body };
  /*
   * Why the admin pages still ask for a fresh answer (?fresh=1): FC 27 is
   * built by hand, cloned in and edited while the transfer window is open.
   * A kept answer meant a club that had just gained its first FC 27 player did
   * not appear, which reads as "the import failed". Players don't need that.
   */
  return body
}
