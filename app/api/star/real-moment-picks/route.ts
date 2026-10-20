import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createPublicReadClient } from "@/lib/supabase/publicRead";
import { isMomentId } from "@/lib/star/realMoments/picks";

/**
 * SAVED REAL-MOMENT PICKS — one row per real moment someone marked on the Real
 * moments page ("Use in game" / "Don't use"), on top of the committed
 * data/realmoments/picks.json. The game reads them for Real moment highlights
 * (lib/star/fhr/realMomentHighlights.ts).
 *
 * GET is public (every game reads the same list). POST is admin-only, written
 * with the service key. `value: "auto"` deletes the row (back to automatic).
 * Same honest "table not made yet" answer as /api/star/training-levels: GET
 * returns an empty list with `migrationMissing: true`, POST a sentence naming
 * supabase/migrations/star_real_moments_picks.sql.
 */

export const dynamic = "force-dynamic";

function isMissingTable(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (err.code === "42P01" || err.code === "PGRST205") return true;
  const m = (err.message ?? "").toLowerCase();
  return m.includes("does not exist") || m.includes("could not find the table");
}

const MIGRATION_HINT =
  "The star_real_moments_picks table doesn't exist yet — run " +
  "supabase/migrations/star_real_moments_picks.sql in the Supabase SQL Editor. Until then, " +
  "marks stay on this device only.";

export async function GET() {
  const supabase = createPublicReadClient();
  const { data, error } = await supabase.from("star_real_moments_picks").select("id, in_game");
  if (error) {
    if (isMissingTable(error)) return NextResponse.json({ picks: {}, migrationMissing: true, message: MIGRATION_HINT });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const picks: Record<string, "use" | "dont"> = {};
  for (const row of (data ?? []) as { id: string; in_game: boolean }[]) {
    if (isMomentId(row.id)) picks[row.id] = row.in_game ? "use" : "dont";
  }
  return NextResponse.json({ picks, migrationMissing: false });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Marking a moment for everyone needs an admin sign-in." }, { status: 403 });
  }
  const body = await req.json().catch(() => null) as { id?: unknown; value?: unknown; note?: unknown } | null;
  const id = body?.id, value = body?.value;
  if (!isMomentId(id) || (value !== "use" && value !== "dont" && value !== "auto")) {
    return NextResponse.json({ error: "Send id (a moment id) and value (use, dont or auto)." }, { status: 400 });
  }
  const service = createServiceClient();
  const { error } = value === "auto"
    ? await service.from("star_real_moments_picks").delete().eq("id", id)
    : await service.from("star_real_moments_picks").upsert({
      id, in_game: value === "use", note: typeof body?.note === "string" ? body.note.slice(0, 200) : null, updated_at: new Date().toISOString(),
    });
  if (error) {
    if (isMissingTable(error)) return NextResponse.json({ error: MIGRATION_HINT, migrationMissing: true }, { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
