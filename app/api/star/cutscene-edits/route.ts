import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createPublicReadClient } from "@/lib/supabase/publicRead";

/**
 * The 3D Scene Editor's shared saves (one row per cut-scene script).
 * Same shape as /api/star/scenarios: GET public, POST/DELETE admin-only, and a
 * missing table (supabase/migrations/star_cutscene_edits.sql not run yet) is a
 * named state (`migrationMissing`), never a 500. The game does not read these yet.
 */
export const dynamic = "force-dynamic";

function isMissingTable(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (err.code === "42P01" || err.code === "PGRST205") return true;
  const m = (err.message ?? "").toLowerCase();
  return m.includes("does not exist") || m.includes("could not find the table");
}
const MIGRATION_HINT =
  "The shared table isn't switched on yet — run supabase/migrations/star_cutscene_edits.sql in the Supabase SQL Editor. Until then, edits stay on this device only.";

function validEdits(e: unknown): boolean {
  if (!e || typeof e !== "object" || Array.isArray(e)) return false;
  const x = e as Record<string, unknown>;
  for (const k of ["shots", "scene"]) {
    const v = x[k];
    if (v !== undefined && (typeof v !== "object" || v === null || Array.isArray(v))) return false;
  }
  return JSON.stringify(e).length < 50_000;
}

async function requireAdmin(): Promise<NextResponse | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden — saving for everyone needs an admin sign-in." }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const { data, error } = await createPublicReadClient().from("star_cutscene_edits").select("script_id, edits");
  if (error) {
    if (isMissingTable(error)) return NextResponse.json({ edits: {}, migrationMissing: true, message: MIGRATION_HINT });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const edits: Record<string, unknown> = {};
  for (const r of (data ?? []) as { script_id: string; edits: unknown }[]) edits[r.script_id] = r.edits;
  return NextResponse.json({ edits, migrationMissing: false });
}

export async function POST(req: NextRequest) {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;
  const body = (await req.json().catch(() => null)) as { scriptId?: unknown; edits?: unknown } | null;
  if (!body || typeof body.scriptId !== "string" || !body.scriptId.trim() || !validEdits(body.edits)) {
    return NextResponse.json({ error: "Needs scriptId and edits { shots?, scene? }" }, { status: 400 });
  }
  const { error } = await createServiceClient()
    .from("star_cutscene_edits")
    .upsert({ script_id: body.scriptId, edits: body.edits, updated_at: new Date().toISOString() });
  if (error) {
    if (isMissingTable(error)) return NextResponse.json({ error: MIGRATION_HINT, migrationMissing: true }, { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;
  const id = new URL(req.url).searchParams.get("scriptId")?.trim();
  if (!id) return NextResponse.json({ error: "scriptId is required" }, { status: 400 });
  const { error } = await createServiceClient().from("star_cutscene_edits").delete().eq("script_id", id);
  if (error) {
    if (isMissingTable(error)) return NextResponse.json({ error: MIGRATION_HINT, migrationMissing: true }, { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
