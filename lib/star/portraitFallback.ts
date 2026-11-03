import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A FACE FROM WHICHEVER EDITION HAS ONE.
 *
 * Our self-hosted portraits were uploaded one Premier League edition at a
 * time (see scripts/upload_player_images.py and upload_pl_draft_images.py),
 * because that is who the scrape can reach. So a player who is in the game
 * now but was NOT in the Premier League for the edition being read has no
 * photo on his row — and shows a silhouette, even though we are holding a
 * perfectly good picture of him taken from a season when he did play here.
 *
 * Reported with Marcus Rashford: years at Manchester United, last season at
 * Barcelona, so nothing in the current edition — while FC 25 has his face
 * sitting in storage.
 *
 * The rule: a player is one person. If any edition of him has a photo we
 * host, that is his photo, and the newest one wins.
 *
 * ── Only OUR copies count ──
 *
 * A row from an older edition is far more likely to carry a raw
 * cdn.sofifa.net link than one of ours, and those are exactly what stopped
 * working — SoFIFA now requires a signed-in session to serve an image at all.
 * Falling back to one would swap a silhouette for a broken image, which is
 * worse. So the search is restricted to URLs we actually serve.
 */

/** Ours, not SoFIFA's — the only kind worth falling back to. */
export function isSelfHosted(url: string | null | undefined): boolean {
  return !!url && url.includes("/storage/v1/object/public/");
}

/**
 * For each id given, the newest self-hosted portrait from any OTHER edition.
 *
 * One query for the whole set, not one per player. Ids with nothing usable
 * anywhere are simply absent from the map, which the caller reads as "still
 * no photo" and falls through to the silhouette exactly as before.
 *
 * Never throws: a face is a nicety and a squad that fails to load is not.
 */
export async function portraitsFromOtherEditions(
  supabase: SupabaseClient,
  sofifaIds: string[],
  excludeYear: number,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const ids = Array.from(new Set(sofifaIds.filter(Boolean)));
  if (ids.length === 0) return out;

  // In pieces (27 Oct 2026): one request with every id failed silently on a
  // big call — /api/star/league-squads' 172 outside clubs sent 1,535 ids and
  // got 0 back (the address is too long, and every edition of every player
  // ran past the 1,000-row cap). 150 ids a piece, in parallel, and only the
  // pictures we host (the only ones this ever keeps) come back: the same
  // call now finds 98. Newest edition first within each piece, so the first
  // usable row for an id wins.
  const CHUNK = 150;
  const pieces: string[][] = [];
  for (let i = 0; i < ids.length; i += CHUNK) pieces.push(ids.slice(i, i + CHUNK));
  await Promise.all(pieces.map(async (piece) => {
    try {
      const { data, error } = await supabase
        .from("sofifa_players")
        .select("sofifa_id, fifa_year, image_url")
        .in("sofifa_id", piece)
        .neq("fifa_year", excludeYear)
        .like("image_url", "%/storage/v1/object/public/%")
        .order("fifa_year", { ascending: false })
        .limit(1000);
      if (error || !data) return;
      for (const row of data) {
        const id = String(row.sofifa_id);
        if (out.has(id)) continue;
        const url = (row.image_url as string | null)?.trim();
        if (isSelfHosted(url)) out.set(id, url!);
      }
    } catch {
      // Same answer as "nobody had one", for this piece only.
    }
  }));
  return out;
}
