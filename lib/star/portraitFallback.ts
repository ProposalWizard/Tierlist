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

  try {
    // Newest edition first, so the first usable row seen for an id is the one
    // that wins and everything after it for that id can be skipped.
    const { data, error } = await supabase
      .from("sofifa_players")
      .select("sofifa_id, fifa_year, image_url")
      .in("sofifa_id", ids)
      .neq("fifa_year", excludeYear)
      .not("image_url", "is", null)
      .order("fifa_year", { ascending: false });

    if (error || !data) return out;

    for (const row of data) {
      const id = String(row.sofifa_id);
      if (out.has(id)) continue;
      const url = (row.image_url as string | null)?.trim();
      if (isSelfHosted(url)) out.set(id, url!);
    }
  } catch {
    // Same answer as "nobody had one".
  }
  return out;
}
