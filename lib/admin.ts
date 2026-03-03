/**
 * lib/admin.ts
 *
 * Server-side helper to check if a user has admin privileges.
 * Uses the service role client so it always bypasses RLS.
 */

import { createServiceClient } from "@/lib/supabase/service";

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
