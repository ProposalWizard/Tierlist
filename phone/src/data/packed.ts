/**
 * THE PACKED DATA INSIDE THE PHONE APP: the same files the packed Android app
 * carries (mobile/packed/, made by mobile/scripts/pack.mts), copied in at
 * build time by phone/scripts/data-pack.js (metro.config.js runs it).
 *
 * - packedData(): every club's squad, each club's roster, the settings
 *   routes and the two database tables, each file read the first time it is
 *   asked for (lib/app/packedIndex.ts has the same list).
 * - packedPicture(url): a picture's bundled copy (player photos, club
 *   badges, flags, the default fake faces), as an address the phone's
 *   drawing (Skia) can open with no signal.
 *
 * Off a phone (the headless checks in phone/tools/) the data still loads;
 * pictures do not (Node cannot load a .webp as a module), and say so.
 */

export interface PackedData {
  packedAt: string;
  /** The player edition (lib/star/edition.ts STAR_FIFA_YEAR). */
  year: number;
  /** /api/star/league-squads: { club: rows[] }, "Free Agents" included. */
  squads: () => Record<string, unknown[]>;
  /** /api/draft/roster per club. */
  rosters: Record<string, () => unknown>;
  /** Settings routes (path + query, lib/app/packedIndex.ts PACK_ROUTES). */
  routes: Record<string, () => unknown>;
  /** Database tables read straight from Supabase (club_logos, custom_clubs). */
  tables: Record<string, () => unknown>;
}

let data: PackedData | null | undefined;
/** The packed data, or null when the app was built without it (scripts/data-pack.js says so). */
export function packedData(): PackedData | null {
  if (data === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      data = (require("./generated/packedData") as PackedData | null) ?? null;
    } catch { data = null; }
  }
  return data;
}

let images: Record<string, unknown> | null | undefined;
function imageModules(): Record<string, unknown> | null {
  if (images === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      images = require("./generated/packedImages") as Record<string, unknown>;
    } catch { images = null; }
  }
  return images;
}

/** Whether a picture address has a bundled copy. */
export function hasPackedPicture(url: string): boolean {
  return !!imageModules()?.[url];
}

/**
 * The bundled copy of a picture as an address Skia.Data.fromURI opens: a
 * resource name in the release app (read from the app itself, no network),
 * the bundler's address while developing. null = not packed.
 */
export function packedPicture(url: string): string | null {
  const mod = imageModules()?.[url];
  if (mod == null) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Image } = require("react-native") as typeof import("react-native");
    return Image.resolveAssetSource(mod as number)?.uri ?? null;
  } catch { return null; }
}
