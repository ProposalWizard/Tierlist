/**
 * EVERY NATION'S HOME AND AWAY KIT — the international section of the club
 * data (Leo, 13 Oct 2026: "home and away kits, just like in the regular club
 * games ... the styles, the patterns, the colors, the usage of the colors ...
 * for every nation available in our game").
 *
 * Source: each national team's Wikipedia page, whose kit box holds the
 * current home and away kit (in 2026, the World Cup kits): an exact colour
 * for each sleeve, the shirt, the shorts and the socks, plus a picture of the
 * shirt's design. scripts/nation-kits/ (see its README) reads those pictures and writes
 * sources/nation_kits_2026-10.json: the shirt colour, the second colour the
 * eye reads (stripes, hoops, sleeves, a graphic, or the trim), the pattern in
 * words, and the shorts and socks. Every kit was then checked by eye against
 * the real picture; a nation whose words were fixed by eye says so in `checked`.
 *
 * Same shape as a club's KitInfo (clubProfiles.ts), plus sleeves, shorts and
 * socks. Shown on /admin/clubs → International; worn in every international
 * match through international.ts's nationKits.
 *
 * Pure: no React.
 */
import DATA from "./sources/nation_kits_2026-10.json";
import type { KitInfo } from "./clubProfiles";
import { nationalityKey } from "../../nationalities";
import { clashes, type ClubKits } from "../kits";

export interface NationKitInfo extends KitInfo {
  sleeves?: string;
  shorts?: string;
  socks?: string;
  sleevesHex?: string;
  shortsHex?: string;
  socksHex?: string;
}

export interface NationKitProfile {
  /** The game's spelling of the nation. */
  nation: string;
  homeKit: NationKitInfo;
  awayKit: NationKitInfo;
  /** Where the kits came from. */
  source: string;
  /** Set when a kit was corrected by eye after the picture was read. */
  checked?: string;
}

const RAW = (DATA as { nations: Record<string, Omit<NationKitProfile, "nation">> }).nations;

export const NATION_KIT_PROFILES: Record<string, NationKitProfile> = Object.fromEntries(
  Object.entries(RAW).map(([nation, p]) => [nation, { nation, ...p }]),
);

const BY_KEY = new Map<string, NationKitProfile>();
for (const p of Object.values(NATION_KIT_PROFILES)) {
  const k = nationalityKey(p.nation);
  if (k) BY_KEY.set(k, p);
}

/** A nation's kits, under any spelling the game uses ("Türkiye", "Turkey", "TR"). */
export function nationKitProfile(nation: string | null | undefined): NationKitProfile | null {
  if (!nation) return null;
  return NATION_KIT_PROFILES[nation] ?? BY_KEY.get(nationalityKey(nation) ?? "") ?? null;
}

/**
 * The two colours a nation wears on the pitch (shirt + trim), home and away.
 * A trim the eye can't tell from its shirt is swapped for white or black (the
 * real words stay on /admin/clubs). Null when the nation isn't known.
 */
export function nationWornKits(nation: string): ClubKits | null {
  const p = nationKitProfile(nation);
  const h = p?.homeKit, a = p?.awayKit;
  if (!h?.shirtHex || !a?.shirtHex) return null;
  const contrast = (shirt: string) => (clashes(shirt, "#F2F4F7") ? "#17181A" : "#F2F4F7");
  const kit = (shirt: string, trim: string | undefined) =>
    ({ shirt, trim: trim && !clashes(shirt, trim) ? trim : contrast(shirt) });
  return { home: kit(h.shirtHex, h.trimHex), away: kit(a.shirtHex, a.trimHex) };
}
