import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { HALL_MAX_ENTRIES, HALL_MAX_ROWS, hallHasRoom } from "@/lib/star/hallOfFame";

/**
 * THE HALL OF FAME, IN THE CLOUD — one row per retired career, per account.
 * See lib/star/hallOfFame.ts (the device side, and the merge) and
 * supabase/migrations/star_hall_of_fame.sql (the table).
 *
 * GET     every entry and every tombstone of the signed-in account
 * POST    { entry } — adds one; never overwrites (a finished career does not
 *         change, and a removed one stays removed)
 * DELETE  ?id= — takes one out, leaving a tombstone
 *
 * Before the migration runs, GET answers `migrationMissing: true` and the
 * Hall stays on the device; the Hall screen says so. Signed out: GET answers
 * `signedOut: true`.
 */

export const dynamic = "force-dynamic";

const TABLE = "star_hall_of_fame";
const ID_SHAPE = /^hof-[a-z0-9]{1,16}$/;
/** A slim 20-season career is about 30-60 KB; far bigger is refused. */
const MAX_ENTRY_CHARS = 900_000;
const MIGRATION_HINT = "The Hall of Fame is not set up in the database yet (run supabase/migrations/star_hall_of_fame.sql).";

/** Postgres `undefined_table` (42P01), or PostgREST's schema-cache miss
 *  (PGRST205): the table does not exist yet. */
function missingTable(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (err.code === "42P01" || err.code === "PGRST205") return true;
  return /does not exist|could not find the table/i.test(err.message ?? "");
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ entries: [], removed: [], signedOut: true });

  const { data, error } = await supabase
    .from(TABLE)
    .select("entry_id, entry, removed")
    .eq("user_id", user.id);
  if (error) {
    if (missingTable(error)) return NextResponse.json({ entries: [], removed: [], migrationMissing: true, message: MIGRATION_HINT });
    return NextResponse.json({ error: "Could not read the Hall of Fame." }, { status: 500 });
  }
  const entries: unknown[] = [];
  const removed: string[] = [];
  for (const row of (data ?? []) as { entry_id: string; entry: unknown; removed: boolean }[]) {
    if (row.removed) removed.push(row.entry_id);
    else if (row.entry) entries.push(row.entry);
  }
  return NextResponse.json({ entries, removed });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to keep the Hall of Fame in the cloud." }, { status: 401 });

  let body: { entry?: { id?: unknown; card?: unknown; career?: unknown; addedAt?: unknown } } | null = null;
  try { body = await req.json(); } catch { /* handled below */ }
  const entry = body?.entry;
  if (!entry || typeof entry.id !== "string" || !ID_SHAPE.test(entry.id)
    || !entry.card || typeof entry.card !== "object"
    || !entry.career || typeof entry.career !== "object"
    || typeof entry.addedAt !== "number") {
    return NextResponse.json({ error: "That is not a Hall of Fame entry." }, { status: 400 });
  }
  if (JSON.stringify(entry).length > MAX_ENTRY_CHARS) {
    return NextResponse.json({ error: "That career is too big to keep." }, { status: 413 });
  }

  // At most HALL_MAX_ENTRIES careers per account in the cloud.
  const room = await roomFor(supabase, user.id, entry.id);
  if (room === "missing") return NextResponse.json({ error: MIGRATION_HINT, migrationMissing: true }, { status: 503 });
  if (room === "error") return NextResponse.json({ error: "Could not save to the Hall of Fame." }, { status: 500 });
  if (room === "full") return fullResponse(user.id);

  // ignoreDuplicates: ON CONFLICT DO NOTHING. An entry already there (or a
  // tombstone) is never overwritten.
  const { error } = await supabase
    .from(TABLE)
    .upsert({ user_id: user.id, entry_id: entry.id, entry, removed: false }, { onConflict: "user_id,entry_id", ignoreDuplicates: true });
  if (error) {
    if (missingTable(error)) return NextResponse.json({ error: MIGRATION_HINT, migrationMissing: true }, { status: 503 });
    if (isFullError(error)) return fullResponse(user.id);
    return NextResponse.json({ error: "Could not save to the Hall of Fame." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

type Supa = Awaited<ReturnType<typeof createClient>>;

/** Whether this account has room for `id` (an id already there always does). */
async function roomFor(supabase: Supa, userId: string, id: string, tombstone = false): Promise<"ok" | "full" | "missing" | "error"> {
  const { data, error } = await supabase.from(TABLE).select("entry_id, removed").eq("user_id", userId).limit(HALL_MAX_ROWS + 1);
  if (error) return missingTable(error) ? "missing" : "error";
  const rows = (data ?? []) as { entry_id: string; removed: boolean }[];
  const already = rows.some(r => r.entry_id === id);
  // A tombstone takes no career place, only a row.
  const live = tombstone ? 0 : rows.filter(r => !r.removed).length;
  return hallHasRoom(live, rows.length, already) ? "ok" : "full";
}

/** The database trigger's own refusal (star_hall_of_fame.sql). */
function isFullError(err: { message?: string } | null): boolean {
  return /hall_full/i.test(err?.message ?? "");
}

function fullResponse(userId: string) {
  console.warn(`[hall-of-fame] account ${userId} is at the limit`);
  return NextResponse.json({
    error: `The Hall of Fame keeps ${HALL_MAX_ENTRIES} careers in the cloud. Remove one to add another. This one stays on this device.`,
    full: true,
  }, { status: 409 });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!ID_SHAPE.test(id)) return NextResponse.json({ error: "That is not a Hall of Fame entry." }, { status: 400 });

  const room = await roomFor(supabase, user.id, id, true);
  if (room === "missing") return NextResponse.json({ error: MIGRATION_HINT, migrationMissing: true }, { status: 503 });
  if (room === "error") return NextResponse.json({ error: "Could not remove it." }, { status: 500 });
  if (room === "full") return fullResponse(user.id);

  const { error } = await supabase
    .from(TABLE)
    .upsert({ user_id: user.id, entry_id: id, entry: null, removed: true, updated_at: new Date().toISOString() }, { onConflict: "user_id,entry_id" });
  if (error) {
    if (missingTable(error)) return NextResponse.json({ error: MIGRATION_HINT, migrationMissing: true }, { status: 503 });
    if (isFullError(error)) return fullResponse(user.id);
    return NextResponse.json({ error: "Could not remove it." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
