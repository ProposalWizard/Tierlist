/**
 * lib/marketing/caller.ts — SERVER ONLY. Who is calling a Marketing route:
 * signed in, and an admin (lib/admin.ts). A local development build lets
 * everyone in as "Dev" (lib/star/devMode.ts; never the live site), same as
 * the board route.
 */
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { offlineDevPlayEnabled } from "@/lib/star/devMode";
import type { Caller } from "./mediaApi";

export async function getCaller(): Promise<Caller> {
  if (offlineDevPlayEnabled()) return { id: "dev", name: "Dev", admin: true };
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const full = typeof meta.full_name === "string" ? meta.full_name : typeof meta.name === "string" ? meta.name : "";
    return { id: user.id, name: full.trim().split(/\s+/)[0] || "Admin", admin: await isAdmin(user.id) };
  } catch {
    return null;
  }
}
