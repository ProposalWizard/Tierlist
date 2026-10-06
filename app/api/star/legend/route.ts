import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { newLegendCode, LEGEND_CODE } from "@/lib/star/legendShare";

/**
 * SHARE A RETIRED CAREER (Leo, 6 Oct 2026: "Online: share a career, compare
 * with a friend"). See lib/star/legendShare.ts and
 * supabase/migrations/star_legend_shares.sql.
 *
 * POST { entry } — a Hall of Fame entry (lib/star/hallOfFame.ts). Signed in
 * only. Gives back its code: the one it already had, or a new one. Reading a
 * code is /api/star/legend/[code].
 *
 * Before the migration runs: 503 with `migrationMissing: true`.
 */

export const dynamic = "force-dynamic";

const TABLE = "star_legend_shares";
const HALL_ID = /^hof-[a-z0-9]{1,16}$/;
/** A slim 20-season career is about 30-60 KB; far bigger is refused. */
const MAX_ENTRY_CHARS = 900_000;
const MIGRATION_HINT = "Sharing is not set up in the database yet (run supabase/migrations/star_legend_shares.sql).";

function missingTable(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (err.code === "42P01" || err.code === "PGRST205" || err.code === "PGRST202") return true;
  return /does not exist|could not find the (table|function)/i.test(err.message ?? "");
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to share a link." }, { status: 401 });

  let body: { entry?: { id?: unknown; card?: unknown; career?: unknown; addedAt?: unknown } } | null = null;
  try { body = await req.json(); } catch { /* handled below */ }
  const entry = body?.entry;
  if (!entry || typeof entry.id !== "string" || !HALL_ID.test(entry.id)
    || !entry.card || typeof entry.card !== "object"
    || !entry.career || typeof entry.career !== "object"
    || typeof entry.addedAt !== "number") {
    return NextResponse.json({ error: "That is not a retired career." }, { status: 400 });
  }
  if (JSON.stringify(entry).length > MAX_ENTRY_CHARS) {
    return NextResponse.json({ error: "That career is too big to share." }, { status: 413 });
  }

  // Shared before: the same code again.
  const { data: had, error: readErr } = await supabase
    .from(TABLE)
    .select("code")
    .eq("user_id", user.id)
    .eq("hall_id", entry.id)
    .maybeSingle();
  if (readErr) {
    if (missingTable(readErr)) return NextResponse.json({ error: MIGRATION_HINT, migrationMissing: true }, { status: 503 });
    return NextResponse.json({ error: "Could not make the link." }, { status: 500 });
  }
  if (had?.code && LEGEND_CODE.test(had.code)) return NextResponse.json({ code: had.code });

  // A new code; a clash with another share (1 in a billion) just tries again.
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = newLegendCode();
    const { error } = await supabase.from(TABLE).insert({ code, user_id: user.id, hall_id: entry.id, entry });
    if (!error) return NextResponse.json({ code });
    if (missingTable(error)) return NextResponse.json({ error: MIGRATION_HINT, migrationMissing: true }, { status: 503 });
    // 23505: unique violation — the code (try another) or this career (shared a moment ago).
    if (error.code !== "23505") return NextResponse.json({ error: "Could not make the link." }, { status: 500 });
    const { data: again } = await supabase.from(TABLE).select("code").eq("user_id", user.id).eq("hall_id", entry.id).maybeSingle();
    if (again?.code) return NextResponse.json({ code: again.code });
  }
  return NextResponse.json({ error: "Could not make the link." }, { status: 500 });
}
