/**
 * lib/recordings/server.ts — SERVER ONLY. Who may use the recordings routes,
 * the storage they use, and the site's own address for a link.
 */
import { createClient } from "@/lib/supabase/server";
import { roleOf } from "@/lib/admin";
import { offlineDevPlayEnabled } from "@/lib/star/devMode";
import { getStorage } from "@/lib/marketing/storage";
import type { Storage } from "@/lib/marketing/mediaApi";
import type { R2Config } from "@/lib/marketing/r2";

export const NOT_CONNECTED = "Team storage is not connected here.";

/** Signed-in admins and testers (the people the Videos tab lets in). */
export async function recorderAllowed(): Promise<boolean> {
  // A local development build lets everyone in, like the Videos page itself (never the live site).
  if (offlineDevPlayEnabled()) return true;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return !!user && (await roleOf(user.id)) !== "player";
  } catch { return false; }
}

/** The bucket, or null when the R2 settings are not on this site. */
export function recordingStore(): (Storage & { config: R2Config }) | null {
  const s = getStorage();
  return s.mode === "r2" && s.config ? (s as Storage & { config: R2Config }) : null;
}

/** The address links are made with: the live site's, else this request's. */
export function siteOrigin(req: Request): string {
  const set = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  return set && /^https:\/\//.test(set) ? set : new URL(req.url).origin;
}
