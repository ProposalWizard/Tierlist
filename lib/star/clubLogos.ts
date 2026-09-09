import { createClient } from "@/lib/supabase/client";

/**
 * REAL CLUB BADGES — NOW THAT THEY ACTUALLY EXIST.
 *
 * `ClubCrest`'s own header used to say it plainly: "There are no crest
 * files, and a wrong crest is worse than none — so it is the club's own
 * shirt with its initials on it." Told directly that's no longer true —
 * every club's real badge is now uploaded into `club_logos` (the same
 * table the American draft mode has read from for a while: `club` text
 * primary key, `logo_url` text, public-read RLS — see
 * `supabase/migrations/club_league_logos.sql` and
 * `app/api/admin/football/import-logos/route.ts`). This is the star
 * career game's own read of that same table — it never had one before,
 * `lib/star/*.ts` otherwise works purely off the in-memory `CareerState`
 * with no Supabase client at all.
 *
 * `normalizeClubKey` is deliberately duplicated from `lib/americanDraft.ts`
 * rather than imported — same convention this codebase already follows at
 * several other module boundaries (see e.g. `leagueTransfers.ts`'s own
 * header): the draft mode's internals stay its own, and a one-line pure
 * function is cheaper to keep in sync by eye than to couple two unrelated
 * game modes over.
 */

/** club_logos is keyed on whatever spelling the badge was scraped under,
 *  which drifts ("Man Utd" vs "Manchester United", stray accents, "&" vs
 *  "and") from the star game's own club names. Normalise both sides. */
export function normalizeClubKey(club: string): string {
  return club
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, ""); // drop spaces, dots, hyphens
}

// club_logos is small and only changes when an admin re-imports it, so one
// fetch covers every badge shown for a good while — cached in module scope
// rather than re-querying every time a screen with a dozen badges mounts.
let cache: { map: Map<string, string>; at: number } | null = null;
const TTL_MS = 10 * 60 * 1000;

export async function getClubLogoMap(): Promise<Map<string, string>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.map;

  const supabase = createClient();
  const map = new Map<string, string>();
  const { data } = await supabase.from("club_logos").select("club, logo_url").limit(5000);
  ((data ?? []) as { club: string; logo_url: string }[]).forEach(l => {
    const key = normalizeClubKey(l.club || "");
    if (key && !map.has(key)) map.set(key, l.logo_url);
  });

  // Don't cache an empty result — that's usually a transient failure, and
  // caching it would blank every badge for the whole TTL.
  if (map.size > 0) cache = { map, at: Date.now() };
  return map;
}
