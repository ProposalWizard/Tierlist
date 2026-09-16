import { createClient } from "@/lib/supabase/client";
import type { ClubKits } from "./kits";
import type { CustomClubEntry } from "./ruleBook";
import { fetchLeagueSquads } from "./leagueSquads";

/**
 * CUSTOM CLUBS — invented by an admin (name, kit, stadium, and a real
 * roster built from scratch), later votable into a real competition via
 * the Rule Book. See app/api/admin/custom-clubs for the write side and
 * app/admin/custom-clubs for the editor.
 */
export interface CustomClub {
  name: string;
  stadium_name: string;
  home_shirt: string;
  home_trim: string;
  away_shirt: string;
  away_trim: string;
  created_at: string;
  updated_at: string;
}

/** A custom club's own real kit, in kits.ts's own shape — used the moment
 *  it's admitted into a career (see ruleBook.ts's customClubEntries). */
export function customClubKit(club: CustomClub): ClubKits {
  return {
    home: { shirt: club.home_shirt, trim: club.home_trim },
    away: { shirt: club.away_shirt, trim: club.away_trim },
  };
}

/** Every custom club on file — public read, no admin check needed (same
 *  posture as club_logos/nationality_flags). Used by the Rule Book screen
 *  to list what's available to propose, and by the admin editor. */
export async function fetchCustomClubs(): Promise<CustomClub[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("custom_clubs").select("*").order("name");
  if (error || !data) return [];
  return data as CustomClub[];
}

/**
 * Everything a Rule Book proposal to admit a custom club needs decided
 * ONCE, before the vote — its real strength (its own squad's average
 * overall, read fresh right now) and which real club it would replace
 * (picked by the caller — see RuleBookScreen.tsx, which offers
 * `replaceableClubsIn` for Champions/Europa, or the real static ladder
 * list for Premier/Championship, where this stays honest, votable data
 * with no real swap wired yet — see ruleBook.ts's own note on why).
 */
export async function buildCustomClubEntry(
  customClub: string,
  competition: CustomClubEntry["competition"],
  replaces: string,
): Promise<CustomClubEntry> {
  const [squad] = await fetchLeagueSquads([customClub]);
  const overalls = (squad?.players ?? []).map(p => p.overall).filter(n => Number.isFinite(n));
  const strength = overalls.length > 0 ? Math.round(overalls.reduce((s, o) => s + o, 0) / overalls.length) : 65;
  return { customClub, competition, replaces, strength };
}

/** A real, generated-fallback-proof player never has this prefix — see
 *  leagueSquads.ts's own `gen:` convention for the same idea the other
 *  direction (a real fetch never produces THAT prefix either). */
export function isCustomPlayerId(sofifaId: string): boolean {
  return sofifaId.startsWith("custom:");
}
