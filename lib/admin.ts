/**
 * lib/admin.ts
 *
 * Server-side helper to check if a user has admin privileges.
 * Uses the service role client so it always bypasses RLS.
 */

import { createServiceClient } from "@/lib/supabase/service";
import { canTest, readRole, type Role, type RoleClient } from "@/lib/roles";

/** Returns true if the given user ID has is_admin = true in user_roles. */
export async function isAdmin(userId: string): Promise<boolean> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("user_roles")
    .select("is_admin")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.is_admin === true;
}

/**
 * "admin" | "tester" | "player" (lib/roles.ts). Never throws, and before
 * tester_access.sql is run it simply never answers "tester".
 */
export async function roleOf(userId: string): Promise<Role> {
  try {
    return await readRole(createServiceClient() as unknown as RoleClient, userId);
  } catch {
    return "player";
  }
}

/** Testers and admins: the god-mode tools and the play-only test pages. */
export async function isTester(userId: string): Promise<boolean> {
  return canTest(await roleOf(userId));
}
