import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabase } from "@supabase/supabase-js";
import { isAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isTuningNote, type TuningNote } from "@/lib/star/tuningNotes";

/**
 * TUNING NOTES — "Say what feels off" from the Tuning panel.
 *
 * POST: anyone (the table's RLS allows inserts from anon too). GET: admins.
 * A table that doesn't exist yet is a named state (`migrationMissing`), never
 * a 500, so the panel can say "saved on this device only" honestly — the same
 * pattern as /api/star/scenarios. See supabase/migrations/star_tuning_notes.sql.
 */

export const dynamic = "force-dynamic";

const MIGRATION_HINT =
  "The star_tuning_notes table doesn't exist yet — run supabase/migrations/star_tuning_notes.sql " +
  "in the Supabase SQL Editor. Until then notes stay in the browser that wrote them.";

function isMissingTable(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (err.code === "42P01" || err.code === "PGRST205") return true;
  const m = (err.message ?? "").toLowerCase();
  return m.includes("does not exist") || m.includes("could not find the table");
}

/** The service key when the deploy has it; otherwise the public anon key,
 *  which the table's insert policy accepts. */
function writer() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return createServiceClient();
  return createSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
}

const toRow = (n: TuningNote) => ({
  id: n.id, page: n.page, chips: n.chips, text: n.text,
  kind: n.kind ?? null, league: n.league ?? null, position: n.position ?? null,
  seed: typeof n.seed === "number" ? Math.round(n.seed) : null,
  minute: typeof n.minute === "number" ? Math.round(n.minute) : null,
  seen: typeof n.seen === "number" ? Math.round(n.seen) : null,
  note_at: new Date(n.at).toISOString(),
});

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { notes?: unknown } | null;
  const notes = Array.isArray(body?.notes) ? body!.notes : [];
  if (!notes.length || notes.length > 50 || !notes.every(isTuningNote)) {
    return NextResponse.json({ error: "notes must be 1–50 tuning notes" }, { status: 400 });
  }
  const { error } = await writer()
    .from("star_tuning_notes")
    .upsert((notes as TuningNote[]).map(toRow), { onConflict: "id", ignoreDuplicates: true });
  if (error) {
    if (isMissingTable(error)) return NextResponse.json({ ok: false, migrationMissing: true, error: MIGRATION_HINT }, { status: 503 });
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, saved: notes.length });
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Reading tuning notes needs an admin sign-in." }, { status: 403 });
  }
  const { data, error } = await createServiceClient()
    .from("star_tuning_notes").select("*").order("note_at", { ascending: false }).limit(500);
  if (error) {
    if (isMissingTable(error)) return NextResponse.json({ notes: [], migrationMissing: true, message: MIGRATION_HINT });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ notes: data ?? [], migrationMissing: false });
}
