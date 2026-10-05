/**
 * lib/roles.ts — who someone is on Knowitball: a player, a tester or an admin.
 *
 * Harry, 5 Oct 2026: "a 'tester access' link and accounts that we will use for
 * our testers to be able to have god mode too".
 *
 *  - admin  — `user_roles.is_admin`. Everything, as before.
 *  - tester — `user_roles.is_tester`. The Star Career developer tools and the
 *             test pages that only play the game. Never anything that changes
 *             data other people see.
 *  - player — everyone else.
 *
 * An admin counts as a tester too (`canTest`).
 *
 * No imports on purpose: the server helper (lib/admin.ts) hands in its own
 * Supabase client, and the tests hand in a fake one.
 *
 * SAFE BEFORE THE MIGRATION. `is_tester` only exists once
 * supabase/migrations/tester_access.sql has been run. Until then asking for it
 * fails the whole query (Supabase errors on a missing column), so `readRole`
 * asks again for `is_admin` alone: admins stay admins and nobody is a tester.
 * Any other failure reads as "player" — never an error page.
 */

export type Role = "admin" | "tester" | "player";

export interface RoleRow {
  is_admin?: boolean | null;
  is_tester?: boolean | null;
}

/** One row of user_roles (or none) → a role. */
export function roleFromRow(row: RoleRow | null | undefined): Role {
  if (row?.is_admin === true) return "admin";
  if (row?.is_tester === true) return "tester";
  return "player";
}

/** Admins and testers may use the tester tools. */
export function canTest(role: Role): boolean {
  return role === "admin" || role === "tester";
}

interface RoleResult {
  data: RoleRow | null;
  error: unknown;
}

/** The little bit of a Supabase client `readRole` uses. */
export interface RoleClient {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        maybeSingle(): PromiseLike<RoleResult>;
      };
    };
  };
}

async function ask(client: RoleClient, userId: string, columns: string): Promise<RoleResult> {
  return client.from("user_roles").select(columns).eq("user_id", userId).maybeSingle();
}

/** The role of one user. Never throws. */
export async function readRole(client: RoleClient, userId: string): Promise<Role> {
  try {
    let res = await ask(client, userId, "is_admin, is_tester");
    // is_tester missing (migration not run yet): admins only, nobody is a tester.
    if (res.error) res = await ask(client, userId, "is_admin");
    if (res.error) return "player";
    return roleFromRow(res.data);
  } catch {
    return "player";
  }
}
