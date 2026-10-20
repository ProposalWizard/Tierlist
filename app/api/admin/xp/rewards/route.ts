/**
 * /api/admin/xp/rewards — the Site XP Rewards list (admin page /admin/xp).
 *
 * B13 (20 Oct 2026): every answer that is not the list now says, in plain
 * words, what is missing. The page used to show a bare "Failed to fetch" for
 * all of them. What can be missing:
 *   - you are not signed in as an admin (live site): 401 / 403;
 *   - the database key SUPABASE_SERVICE_ROLE_KEY (a local test build): the
 *     list still loads, because `rewards` is public-read
 *     (progression_system.sql), but saving answers 503;
 *   - the `rewards` table itself (progression_system.sql not run): 503.
 * A local test build lets anyone read (lib/star/devMode.ts, never the live
 * site), the same as /api/admin/team.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createPublicReadClient, hasServiceRole } from "@/lib/supabase/publicRead";
import { isAdmin } from "@/lib/admin";
import { offlineDevPlayEnabled } from "@/lib/star/devMode";

const NO_KEY = "Saving needs the site's database key (SUPABASE_SERVICE_ROLE_KEY). The live site has it; this local test build does not, so the list is read-only here.";
const NO_TABLE = "The rewards table is not in the database yet. Run supabase/migrations/progression_system.sql in the Supabase SQL Editor.";

/** Null when allowed, else the plain answer to send back. */
async function gate(write: boolean): Promise<NextResponse | null> {
  if (write && !hasServiceRole()) return NextResponse.json({ error: NO_KEY, reason: "no-key" }, { status: 503 });
  if (!write && offlineDevPlayEnabled()) return null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in with an admin account to see this list.", reason: "signed-out" }, { status: 401 });
    if (!hasServiceRole()) {
      return NextResponse.json({ error: "The site can't check who is an admin: its database key (SUPABASE_SERVICE_ROLE_KEY) is missing.", reason: "no-key" }, { status: 503 });
    }
    if (!(await isAdmin(user.id))) return NextResponse.json({ error: "This list is for admins only.", reason: "not-admin" }, { status: 403 });
    return null;
  } catch {
    return NextResponse.json({ error: "Could not check who you are. Try signing in again.", reason: "auth" }, { status: 401 });
  }
}

function dbError(message: string): NextResponse {
  const missing = /relation .*rewards.* does not exist|Could not find the table/i.test(message);
  return NextResponse.json(
    missing ? { error: NO_TABLE, reason: "no-table" } : { error: `The database said: ${message}`, reason: "db" },
    { status: missing ? 503 : 500 },
  );
}

export async function GET() {
  const denied = await gate(false);
  if (denied) return denied;

  // `rewards` is public-read, so the anon key can read it when the site's
  // database key is missing (lib/supabase/publicRead.ts).
  const { data, error } = await createPublicReadClient()
    .from("rewards")
    .select("*")
    .order("sort_order");

  if (error) return dbError(error.message);
  return NextResponse.json({ rewards: data ?? [], canSave: hasServiceRole() });
}

export async function PATCH(req: NextRequest) {
  const denied = await gate(true);
  if (denied) return denied;

  const body = await req.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const allowed = ["name", "description", "category", "rarity", "icon_name", "unlock_type", "unlock_stat", "unlock_value", "sort_order"];
  const cleaned: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in updates) cleaned[k] = updates[k];
  }

  const svc = createServiceClient();
  const { error } = await svc.from("rewards").update(cleaned).eq("id", id);
  if (error) return dbError(error.message);

  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  const denied = await gate(true);
  if (denied) return denied;

  const body = await req.json();
  const { id, name, description, category, rarity, icon_name, unlock_type, unlock_stat, unlock_value, sort_order } = body;

  if (!id || !name || !category || !unlock_type) {
    return NextResponse.json({ error: "Missing required fields (id, name, category, unlock_type)" }, { status: 400 });
  }

  const svc = createServiceClient();
  const { error } = await svc.from("rewards").insert({
    id,
    name,
    description: description || null,
    category,
    rarity: rarity || "bronze",
    icon_name: icon_name || null,
    unlock_type,
    unlock_stat: unlock_stat || null,
    unlock_value: unlock_value ?? null,
    sort_order: sort_order ?? 0,
  });

  if (error) return dbError(error.message);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const denied = await gate(true);
  if (denied) return denied;

  const body = await req.json();
  const { id } = body;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const svc = createServiceClient();
  const { error } = await svc.from("rewards").delete().eq("id", id);
  if (error) return dbError(error.message);

  return NextResponse.json({ ok: true });
}
