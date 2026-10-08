import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { newLegendCode, LEGEND_CODE, LEGEND_MAX_SHARES, shareRequestHallId } from "@/lib/star/legendShare";

/**
 * SHARE A RETIRED CAREER (Leo, 6 Oct 2026: "Online: share a career, compare
 * with a friend"). See lib/star/legendShare.ts and
 * supabase/migrations/star_legend_shares.sql.
 *
 * POST { hallId } — the id of a career in this account's own Hall of Fame
 * (star_hall_of_fame). Signed in only. The server copies that career from
 * the Hall itself: the phone no longer sends the career (8 Oct 2026, a cheat
 * hole: a public link used to show whatever JSON the phone posted). Gives
 * back its code: the one it already had, or a new one. At most
 * LEGEND_MAX_SHARES shares per account. Reading a code is
 * /api/star/legend/[code].
 *
 * Before the migrations run: 503 with `migrationMissing: true`.
 */

export const dynamic = "force-dynamic";

const TABLE = "star_legend_shares";
const HALL = "star_hall_of_fame";
/** A slim 20-season career is about 30-60 KB; far bigger is refused. */
const MAX_ENTRY_CHARS = 900_000;
const MIGRATION_HINT = "Sharing is not set up in the database yet (run supabase/migrations/star_hall_of_fame.sql, then star_legend_shares.sql).";

function missingTable(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (err.code === "42P01" || err.code === "PGRST205" || err.code === "PGRST202") return true;
  return /does not exist|could not find the (table|function)/i.test(err.message ?? "");
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to share a link." }, { status: 401 });

  let body: unknown = null;
  try { body = await req.json(); } catch { /* handled below */ }
  const hallId = shareRequestHallId(body);
  if (!hallId) return NextResponse.json({ error: "That is not a retired career." }, { status: 400 });

  // Shared before: the same code again.
  const { data: had, error: readErr } = await supabase
    .from(TABLE)
    .select("code")
    .eq("user_id", user.id)
    .eq("hall_id", hallId)
    .maybeSingle();
  if (readErr) {
    if (missingTable(readErr)) return NextResponse.json({ error: MIGRATION_HINT, migrationMissing: true }, { status: 503 });
    return NextResponse.json({ error: "Could not make the link." }, { status: 500 });
  }
  if (had?.code && LEGEND_CODE.test(had.code)) return NextResponse.json({ code: had.code });

  // At most LEGEND_MAX_SHARES per account.
  const { count, error: countErr } = await supabase
    .from(TABLE)
    .select("code", { count: "exact", head: true })
    .eq("user_id", user.id);
  if (countErr) return NextResponse.json({ error: "Could not make the link." }, { status: 500 });
  if ((count ?? 0) >= LEGEND_MAX_SHARES) {
    console.warn(`[legend] account ${user.id} is at the share limit`);
    return NextResponse.json({ error: `You can share up to ${LEGEND_MAX_SHARES} careers. Stop sharing one to share another.`, full: true }, { status: 409 });
  }

  // The career itself, from this account's own Hall (never from the phone).
  const { data: hallRow, error: hallErr } = await supabase
    .from(HALL)
    .select("entry, removed")
    .eq("user_id", user.id)
    .eq("entry_id", hallId)
    .maybeSingle();
  if (hallErr) {
    if (missingTable(hallErr)) return NextResponse.json({ error: MIGRATION_HINT, migrationMissing: true }, { status: 503 });
    return NextResponse.json({ error: "Could not make the link." }, { status: 500 });
  }
  const entry = hallRow && !hallRow.removed ? hallRow.entry as { id?: unknown; card?: unknown; career?: unknown } | null : null;
  if (!entry || entry.id !== hallId || !entry.card || typeof entry.card !== "object" || !entry.career || typeof entry.career !== "object") {
    return NextResponse.json({ error: "That career isn't in your Hall of Fame online yet. Open the Hall of Fame while signed in, then try again." }, { status: 404 });
  }
  if (JSON.stringify(entry).length > MAX_ENTRY_CHARS) {
    return NextResponse.json({ error: "That career is too big to share." }, { status: 413 });
  }

  // A new code; a clash with another share (1 in a billion) just tries again.
  // (The database also copies the career from the Hall itself and checks the
  // limit: star_legend_shares.sql's trigger. This copy is for before then.)
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = newLegendCode();
    const { error } = await supabase.from(TABLE).insert({ code, user_id: user.id, hall_id: hallId, entry });
    if (!error) return NextResponse.json({ code });
    if (missingTable(error)) return NextResponse.json({ error: MIGRATION_HINT, migrationMissing: true }, { status: 503 });
    if (/legend_full/i.test(error.message ?? "")) {
      return NextResponse.json({ error: `You can share up to ${LEGEND_MAX_SHARES} careers. Stop sharing one to share another.`, full: true }, { status: 409 });
    }
    if (/legend_not_in_hall/i.test(error.message ?? "")) {
      return NextResponse.json({ error: "That career isn't in your Hall of Fame online yet." }, { status: 404 });
    }
    // 23505: unique violation — the code (try another) or this career (shared a moment ago).
    if (error.code !== "23505") return NextResponse.json({ error: "Could not make the link." }, { status: 500 });
    const { data: again } = await supabase.from(TABLE).select("code").eq("user_id", user.id).eq("hall_id", hallId).maybeSingle();
    if (again?.code) return NextResponse.json({ code: again.code });
  }
  return NextResponse.json({ error: "Could not make the link." }, { status: 500 });
}
