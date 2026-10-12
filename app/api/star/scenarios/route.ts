import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createPublicReadClient } from "@/lib/supabase/publicRead";

/**
 * THE SHARED SCENARIO POOL.
 *
 * One row per hand-built MatchScenario (lib/star/scenarios.ts) — see the
 * migration (supabase/migrations/star_scenarios.sql) for why this exists:
 * the Scenario Builder's output used to live only in the browser that built
 * it, which is the exact problem star_lineups.sql was created to fix for
 * team sheets.
 *
 * GET is public — every device needs the same pool, and there is nothing
 * private in a set of pitch coordinates. POST and DELETE are admin-only:
 * one shared answer means one place it can be changed, not whoever last had
 * the builder open. Same shape as /api/star/lineups.
 *
 * ── Degrading gracefully before the migration is run ──
 *
 * Supabase fails the WHOLE query when the table doesn't exist. Rather than
 * 500 (which reads, from the builder, as "the server is broken"), a missing
 * table is reported as a real, named state: GET returns an empty list with
 * `migrationMissing: true`, and POST/DELETE return a plain-English message
 * naming the migration file. The builder banners that, so a save that only
 * landed in this browser is never mistaken for one that reached everyone.
 */

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  scenario: unknown;
}

/** Postgres `undefined_table` (42P01), plus PostgREST's own schema-cache
 *  miss (PGRST205), which is what you actually get first through the REST
 *  layer. Message-matched too, because the code field has not been
 *  populated consistently across PostgREST versions. */
function isMissingTable(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (err.code === "42P01" || err.code === "PGRST205") return true;
  const m = (err.message ?? "").toLowerCase();
  return m.includes("does not exist") || m.includes("could not find the table");
}

const MIGRATION_HINT =
  "The star_scenarios table doesn't exist yet — run " +
  "supabase/migrations/star_scenarios.sql in the Supabase SQL Editor. Until then, " +
  "scenarios stay in this browser only.";

/** Only as deep as the things a reader actually relies on, so a malformed
 *  write can never land in the table and break every other device. */
function validScenario(s: unknown): boolean {
  if (!s || typeof s !== "object" || Array.isArray(s)) return false;
  const sc = s as Record<string, unknown>;
  if (typeof sc.id !== "string" || !sc.id.trim()) return false;
  if (typeof sc.name !== "string") return false;
  if (typeof sc.kind !== "string" || !sc.kind) return false;
  const cam = sc.camera as Record<string, unknown> | undefined;
  if (!cam
    || typeof cam.centerX !== "number" || typeof cam.centerY !== "number"
    || typeof cam.viewHeight !== "number" || typeof cam.facing !== "string") return false;
  const ball = sc.ball as Record<string, unknown> | undefined;
  if (!ball || typeof ball.x !== "number" || typeof ball.y !== "number") return false;
  if (!Array.isArray(sc.players)) return false;
  return sc.players.every((p) => {
    if (!p || typeof p !== "object") return false;
    const pl = p as Record<string, unknown>;
    return typeof pl.id === "string" && typeof pl.side === "string"
      && typeof pl.x === "number" && typeof pl.y === "number";
  });
}

async function requireAdmin(): Promise<NextResponse | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden — saving a scenario for everyone needs an admin sign-in." }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const supabase = createPublicReadClient();
  const { data, error } = await supabase
    .from("star_scenarios")
    .select("id, scenario");

  if (error) {
    if (isMissingTable(error)) {
      return NextResponse.json({ scenarios: {}, migrationMissing: true, message: MIGRATION_HINT });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const scenarios: Record<string, unknown> = {};
  for (const row of (data ?? []) as Row[]) scenarios[row.id] = row.scenario;
  return NextResponse.json({ scenarios, migrationMissing: false });
}

export async function POST(req: NextRequest) {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;

  const body = await req.json().catch(() => null) as { scenario?: unknown } | null;
  if (!body || !validScenario(body.scenario)) {
    return NextResponse.json(
      { error: "scenario must be a MatchScenario (id, name, kind, camera, ball, players[])" },
      { status: 400 },
    );
  }
  const sc = body.scenario as { id: string; name: string; kind: string };

  const service = createServiceClient();
  const { error } = await service.from("star_scenarios").upsert({
    id: sc.id,
    name: sc.name,
    kind: sc.kind,
    scenario: body.scenario,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    if (isMissingTable(error)) {
      return NextResponse.json({ error: MIGRATION_HINT, migrationMissing: true }, { status: 503 });
    }
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
  const { error } = await service.from("star_scenarios").delete().eq("id", id);

  if (error) {
    if (isMissingTable(error)) {
      return NextResponse.json({ error: MIGRATION_HINT, migrationMissing: true }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
