import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * THE SHARED TEAM SHEETS.
 *
 * One lineup per club, read by every career on the site — see the migration
 * (supabase/migrations/star_lineups.sql) for why this exists: it used to be
 * a browser's own localStorage, invisible to every other device and every
 * other player.
 *
 * GET is public — a career reads every club's lineup, not just its own, and
 * there is nothing private in a football formation. POST is admin-only: one
 * shared answer means one place it can be changed, not whoever last had the
 * page open.
 */

export const dynamic = "force-dynamic";

interface Row {
  club: string;
  formation: string;
  xi: unknown;
  bench: unknown;
  manager: string | null;
}

export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("star_lineups")
    .select("club, formation, xi, bench, manager");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const lineups: Record<string, { formation: string; xi: unknown; bench?: unknown; manager: string }> = {};
  for (const row of (data ?? []) as Row[]) {
    lineups[row.club] = {
      formation: row.formation,
      xi: row.xi,
      ...(row.bench ? { bench: row.bench } : {}),
      manager: row.manager ?? "",
    };
  }
  return NextResponse.json({ lineups });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as {
    club?: string; formation?: string; xi?: unknown; bench?: unknown; manager?: string;
  } | null;

  if (!body || typeof body.club !== "string" || !body.club.trim()
    || typeof body.formation !== "string" || !body.formation.trim()
    || !Array.isArray(body.xi)) {
    return NextResponse.json({ error: "club, formation and xi (an array) are required" }, { status: 400 });
  }

  const service = createServiceClient();
  const { error } = await service.from("star_lineups").upsert({
    club: body.club,
    formation: body.formation,
    xi: body.xi,
    bench: Array.isArray(body.bench) ? body.bench : null,
    manager: typeof body.manager === "string" ? body.manager : null,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
