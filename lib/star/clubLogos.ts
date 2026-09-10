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

/**
 * Short forms a real logo dataset is just as likely to use as the star
 * game's own full club name — "Man Utd" for Manchester United, "Brighton"
 * for Brighton & Hove Albion. `normalizeClubKey` alone only survives
 * cosmetic drift (accents, "&"), not an actual SHORTER name: "Man United"
 * and "Manchester United" normalise to two different strings. Mirrors the
 * alias table `kits.ts`'s own `BY_LOOSE` already carries for exactly this
 * reason (kit colours have the identical problem) — duplicated rather than
 * imported, per this file's own header on why club-name tables are kept
 * local to whichever module needs them. Keyed by ALIAS here (several
 * aliases can share one canonical club), values are the star game's own
 * canonical name, i.e. what `CareerState`/`LeagueTeam.name` actually spell
 * it as.
 */
const CLUB_LOGO_ALIASES: Record<string, string> = {
  "man utd": "Manchester United", "man u": "Manchester United", "manu": "Manchester United",
  "man united": "Manchester United",
  "man city": "Manchester City", "city": "Manchester City",
  "spurs": "Tottenham Hotspur", "tottenham": "Tottenham Hotspur",
  "wolves": "Wolverhampton Wanderers", "wolverhampton": "Wolverhampton Wanderers",
  "brighton": "Brighton & Hove Albion", "brighton and hove albion": "Brighton & Hove Albion",
  "palace": "Crystal Palace",
  "newcastle": "Newcastle United",
  "forest": "Nottingham Forest", "nottm forest": "Nottingham Forest", "nottingham": "Nottingham Forest",
  "leeds": "Leeds United",
  "west ham": "West Ham United",
  "villa": "Aston Villa",
  "bournemouth": "AFC Bournemouth",
  "fulham": "Fulham FC",
  "boro": "Middlesbrough",
  "qpr": "Queens Park Rangers",
  "pne": "Preston North End",
};

/** Every key `l.club` could reasonably have been saved under for the given
 *  CANONICAL club name — itself, plus any alias whose value matches it.
 *  Tried in order against the fetched map, so a dataset that used either
 *  spelling still resolves to the same badge. */
function candidateKeysFor(club: string): string[] {
  const keys = [normalizeClubKey(club)];
  for (const [alias, canonical] of Object.entries(CLUB_LOGO_ALIASES)) {
    if (canonical === club) keys.push(normalizeClubKey(alias));
  }
  return keys;
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
  const { data, error } = await supabase.from("club_logos").select("club, logo_url").limit(5000);
  // Reported directly: every badge on the team-sheet screen still falls back
  // to the plain kit-and-initials circle even after `candidateKeysFor` was
  // added to survive a short-name dataset. That fix can only ever help if
  // `data` actually came back with rows in it — this used to discard
  // `error` entirely, so an RLS reject, a missing table, or any other read
  // failure looked EXACTLY like "the table is just empty", with nothing in
  // the browser console to tell the two apart. Logged, not thrown: a badge
  // screen with one console warning is still fully usable; one that throws
  // on every render is not.
  if (error) console.error("club_logos read failed — every badge will fall back to initials:", error.message);
  ((data ?? []) as { club: string; logo_url: string }[]).forEach(l => {
    const key = normalizeClubKey(l.club || "");
    if (key && !map.has(key)) map.set(key, l.logo_url);
  });

  // Don't cache an empty result — that's usually a transient failure, and
  // caching it would blank every badge for the whole TTL.
  if (map.size > 0) cache = { map, at: Date.now() };
  return map;
}

/**
 * The badge for a club, trying every spelling it could plausibly have been
 * saved under (see `candidateKeysFor`) rather than the one exact key the
 * star game itself uses. `ClubBadge` calls this instead of
 * `map.get(normalizeClubKey(club))` directly — every real badge is
 * imported by hand, from a file an admin put together outside this
 * codebase, and there was never any guarantee it used the star game's own
 * full club names rather than the same short forms `kits.ts` already has
 * to survive for kit colours.
 */
export function lookupClubLogo(map: Map<string, string>, club: string): string | undefined {
  for (const key of candidateKeysFor(club)) {
    const hit = map.get(key);
    if (hit) return hit;
  }
  return undefined;
}
