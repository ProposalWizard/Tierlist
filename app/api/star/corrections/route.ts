import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createPublicReadClient } from "@/lib/supabase/publicRead";

/**
 * THE TEAM'S TUNE CORRECTIONS — one shared list instead of one per browser.
 *
 * See supabase/migrations/star_scenario_corrections.sql for why this exists.
 * Same shape as /api/star/scenarios, deliberately: GET is public (the
 * terminal's proposals script reads it too), POST and DELETE are admin-only,
 * and a table that doesn't exist yet is a named state rather than a 500.
 */

export const dynamic = "force-dynamic";

interface Row { id: string; correction: unknown }

function isMissingTable(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (err.code === "42P01" || err.code === "PGRST205") return true;
  const m = (err.message ?? "").toLowerCase();
  return m.includes("does not exist") || m.includes("could not find the table");
}

const MIGRATION_HINT =
  "The star_scenario_corrections table doesn't exist yet — run " +
  "supabase/migrations/star_scenario_corrections.sql in the Supabase SQL Editor. " +
  "Until then, Tune corrections stay in this browser only.";

/** As deep as the tuner relies on, so a malformed write never lands. */
function validCorrection(c: unknown): boolean {
  if (!c || typeof c !== "object" || Array.isArray(c)) return false;
  const r = c as Record<string, unknown>;
  if (typeof r.id !== "string" || !r.id.trim()) return false;
  if (typeof r.kind !== "string" || !r.kind) return false;
  if (!Array.isArray(r.faults) || !r.faults.every((f) => typeof f === "string")) return false;
  if (!Array.isArray(r.moves)) return false;
  if (typeof r.at !== "number") return false;
  if (r.values !== undefined && (typeof r.values !== "object" || r.values === null || Array.isArray(r.values))) return false;
  return true;
}

async function requireAdmin(): Promise<NextResponse | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden — recording a correction for the team needs an admin sign-in." }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const supabase = createPublicReadClient();
  const { data, error } = await supabase.from("star_scenario_corrections").select("id, correction");
  if (error) {
    if (isMissingTable(error)) {
      return NextResponse.json({ corrections: [], migrationMissing: true, message: MIGRATION_HINT });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const corrections = ((data ?? []) as Row[]).map((r) => r.correction);
  return NextResponse.json({ corrections, migrationMissing: false });
}

export async function POST(req: NextRequest) {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;
  const body = await req.json().catch(() => null) as { correction?: unknown } | null;
  if (!body || !validCorrection(body.correction)) {
    return NextResponse.json({ error: "correction must be a Correction (id, kind, faults[], moves[], at)" }, { status: 400 });
  }
  const c = body.correction as { id: string; kind: string };
  const service = createServiceClient();
  const { error } = await service.from("star_scenario_corrections").upsert({
    id: c.id, kind: c.kind, correction: body.correction, updated_at: new Date().toISOString(),
  });
  if (error) {
    if (isMissingTable(error)) return NextResponse.json({ error: MIGRATION_HINT, migrationMissing: true }, { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;
  const id = new URL(req.url).searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const service = createServiceClient();
  const { error } = await service.from("star_scenario_corrections").delete().eq("id", id);
  if (error) {
    if (isMissingTable(error)) return NextResponse.json({ error: MIGRATION_HINT, migrationMissing: true }, { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
