import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createPublicReadClient } from "@/lib/supabase/publicRead";

/**
 * THE XP BOOK — every XP amount Mikey has changed on /admin/star-xp, with
 * his checks, notes and ideas (lib/star/xpStore.ts, lib/star/xpConfig.ts).
 *
 * GET is public: every career reads it. POST is admin-only. Without the
 * table (supabase/migrations/star_xp_config.sql) GET answers
 * `{ config: null, migrationMissing: true }` and the game uses the amounts
 * built into the code.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createPublicReadClient();
  const { data, error } = await supabase.from("star_xp_config").select("config, updated_at").eq("id", "main").maybeSingle();
  if (error) return NextResponse.json({ config: null, migrationMissing: true, error: error.message });
  return NextResponse.json({ config: data?.config ?? null, updatedAt: data?.updated_at ?? null });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Only an admin can change the XP Book." }, { status: 403 });
  }
  const body = await req.json().catch(() => null) as { config?: unknown } | null;
  const config = body?.config as { match?: unknown } | undefined;
  if (!config || typeof config !== "object" || typeof config.match !== "object") {
    return NextResponse.json({ error: "config with match amounts is required" }, { status: 400 });
  }
  const service = createServiceClient();
  const { error } = await service.from("star_xp_config").upsert({ id: "main", config, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: error.message, migrationMissing: true }, { status: 500 });
  return NextResponse.json({ ok: true });
}
