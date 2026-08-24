import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { STAR_FIFA_YEAR } from "@/lib/star/edition";
import { portraitsFromOtherEditions, isSelfHosted } from "@/lib/star/portraitFallback";
import { FREE_AGENTS_CLUB } from "@/lib/star/leagueSquads";

/**
 * The two spellings admin actually types for an out-of-contract player — a
 * free-text `club` field, not a picker, so both the all-lowercase and the
 * capital-F version slip through in practice. Exact match, not ILIKE: a real
 * club whose name happens to contain "free" is not one of these two strings.
 */
const FREE_AGENT_VALUES = ["free", "Free"];

export const maxDuration = 30;
// Reads the live DB, so it must never be frozen into a build-time snapshot.
export const dynamic = "force-dynamic";

/**
 * THE WHOLE DIVISION, IN ONE TRIP.
 *
 * `/api/draft/roster` exists and returns the same players. It is not the wrong
 * endpoint — it is a different one, for a different job. The Draft needs every
 * attribute a footballer has, so for each player it reads the `attributes`
 * JSONB blob out of the row and unpacks about thirty numbers from it, then runs
 * a second query to patch missing nationalities.
 *
 * The star career needs six fields and twenty clubs. Asking the Draft's
 * endpoint for them would mean twenty round trips, each one reading and
 * discarding a blob — the same shape of query that froze a live draft for
 * fifteen seconds in the July audit.
 *
 * So: one request, one query, no JSONB, only the columns that get used. The
 * Draft's endpoint is untouched and goes on doing its own job.
 */

interface LeanPlayer {
  id: string;
  name: string;
  positions: string;
  overall: number;
  /** Portrait URL. One more short string, not the JSONB blob. */
  image?: string;
  /** For the flag on a team sheet. */
  nation?: string;
  /** Real age. The transfer engine (leagueTransfers.ts) weights a loan far
   *  more heavily for a young player than an old one — before this field
   *  existed here, that weighting could only ever apply to your own squad,
   *  never to the other nineteen clubs' players it actually matters most
   *  for. One more short scalar column, not the JSONB blob. */
  age?: number;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const clubsParam = searchParams.get("clubs");
  const year = parseInt(searchParams.get("year") ?? String(STAR_FIFA_YEAR), 10);

  if (!clubsParam) {
    return NextResponse.json({ error: "Missing required query param: clubs" }, { status: 400 });
  }
  if (Number.isNaN(year)) {
    return NextResponse.json({ error: "year must be a number" }, { status: 400 });
  }

  const clubs = clubsParam.split("|").map(c => c.trim()).filter(Boolean);
  if (clubs.length === 0) {
    return NextResponse.json({ error: "clubs must not be empty" }, { status: 400 });
  }
  // A league is twenty clubs. The cap is a guard against somebody asking for the
  // whole table, not a limit anybody should reach.
  if (clubs.length > 40) {
    return NextResponse.json({ error: "at most 40 clubs" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // ── Free Agents is not a club ──
  //
  // A reserved name a caller can ask for alongside (or instead of) real
  // clubs — see lib/star/leagueSquads.ts's fetchFreeAgents — that this route
  // translates into the two literal `club` values admin actually types for
  // an out-of-contract player. Still one query: the DB list swaps the
  // sentinel out for both real spellings before asking.
  const wantsFreeAgents = clubs.includes(FREE_AGENTS_CLUB);
  const dbClubs = [
    ...clubs.filter(c => c !== FREE_AGENTS_CLUB),
    ...(wantsFreeAgents ? FREE_AGENT_VALUES : []),
  ];

  // ── The one query ──
  //
  // No `attributes`, no `*`, no follow-up. `manual_*` columns are the admin
  // overrides and are cheap scalars, so they come along and win where set.
  const { data, error } = await supabase
    .from("sofifa_players")
    // `image_url` is a short text column, not the JSONB blob this route exists
    // to avoid — the shortlist graphic needs faces and twenty extra queries to
    // get them would undo the whole point of the endpoint.
    .select("sofifa_id, name, club, overall, manual_overall, positions, manual_positions, image_url, nationality, manual_nationality, age")
    .eq("fifa_year", year)
    .in("club", dbClubs)
    .order("overall", { ascending: false, nullsFirst: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const squads: Record<string, LeanPlayer[]> = {};
  for (const club of clubs) squads[club] = [];

  for (const row of data ?? []) {
    const rowClub = row.club as string;
    // Either of the two real values that landed him here maps back onto the
    // one sentinel bucket the caller actually asked for — not his literal
    // `club` cell, which is why FREE_AGENT_VALUES has two entries and
    // `squads` only ever gets the one key.
    const club = FREE_AGENT_VALUES.includes(rowClub) ? FREE_AGENTS_CLUB : rowClub;
    const list = squads[club];
    if (!list) continue;
    const overall = (row.manual_overall as number) || (row.overall as number) || 0;
    const positions = ((row.manual_positions as string) || (row.positions as string) || "").trim();
    const name = ((row.name as string) || "").trim();
    // A row with no name is not a footballer we can put on a team sheet.
    if (!name) continue;
    const image = ((row.image_url as string) || "").trim();
    const nation = (((row.manual_nationality as string) || (row.nationality as string)) || "").trim();
    const age = row.age as number | null;
    list.push({
      id: String(row.sofifa_id), name, positions, overall,
      ...(image ? { image } : {}),
      ...(nation ? { nation } : {}),
      ...(age ? { age } : {}),
    });
  }

  // ── A face from whichever edition has one ──
  //
  // Portraits are self-hosted one Premier League edition at a time, so a
  // player who is here now but was elsewhere for THIS edition has no photo on
  // his row while an older edition of him has a perfectly good one. One extra
  // query, only for the players who actually came back without a picture, and
  // only ever finding images we serve ourselves. See lib/star/portraitFallback.
  //
  // `!p.image` alone is not "no picture" — it is "no picture AT ALL", and
  // most of these rows have one: a raw `cdn.sofifa.net` link, scraped back
  // when that CDN still served anonymously. That link is exactly the kind
  // that stopped working, so a row that has one was never asked for the
  // fallback and the browser was left to fail loading it — reported as
  // Arsenal's Tzolis (a real FIFA 22 Norwich face on record) and Rashford
  // both sitting on silhouettes despite a real photo existing somewhere in
  // the archive. `isSelfHosted` is the actual question: does THIS row's link
  // still work, not merely does a link exist. See app/api/draft/roster,
  // which already asked the right question here.
  const faceless = Object.values(squads).flat().filter(p => !isSelfHosted(p.image));
  if (faceless.length > 0) {
    const rescued = await portraitsFromOtherEditions(supabase, faceless.map(p => p.id), year);
    for (const p of faceless) {
      const found = rescued.get(p.id);
      if (found) p.image = found;
    }
  }

  // Ordered by rating, best first — which is the order every consumer wants and
  // is cheaper to do once here than in each of them.
  for (const club of clubs) squads[club].sort((a, b) => b.overall - a.overall);

  return NextResponse.json({
    year,
    squads,
    // What actually came back, so the caller can fall back per club rather than
    // guessing. The FC 26 import is known to be partial.
    found: Object.fromEntries(clubs.map(c => [c, squads[c].length])),
  });
}
