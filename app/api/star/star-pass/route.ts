import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createPublicReadClient } from "@/lib/supabase/publicRead";

/**
 * THE STAR PASS LAYOUT — which reward sits at which level, plus the admin
 * page's idea cards and status changes (lib/star/starPassStore.ts).
 *
 * GET is public: every career reads it. POST is admin-only. Without the
 * table (supabase/migrations/star_pass_config.sql) GET answers
 * `{ layout: null, migrationMissing: true }` and the game uses the layout
 * built into the code.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createPublicReadClient();
  const { data, error } = await supabase.from("star_pass_config").select("layout, updated_at").eq("id", "main").maybeSingle();
  if (error) return NextResponse.json({ layout: null, migrationMissing: true, error: error.message });
  return NextResponse.json({ layout: data?.layout ?? null, updatedAt: data?.updated_at ?? null });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Only an admin can change the Star Pass." }, { status: 403 });
  }
  const body = await req.json().catch(() => null) as { layout?: unknown } | null;
  const layout = body?.layout as { levels?: unknown } | undefined;
  if (!layout || typeof layout !== "object" || typeof layout.levels !== "object") {
    return NextResponse.json({ error: "layout with levels is required" }, { status: 400 });
  }
  const service = createServiceClient();
  const { error } = await service.from("star_pass_config").upsert({ id: "main", layout, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: error.message, migrationMissing: true }, { status: 500 });
  return NextResponse.json({ ok: true });
}
