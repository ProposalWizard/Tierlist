/**
 * GET /api/admin/team — the team board's data (admins only).
 *
 * Pushes per person, pull requests, and main's live deploy, read from GitHub
 * with the site's GITHUB_TOKEN (lib/teamBoard.ts). Each push carries the
 * patch note it went out in. Cached 60 s on the server.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { fetchTeamBoard } from "@/lib/teamBoard";
import { BUILT_IN_PATCH_NOTES } from "@/lib/patchNotesData";
import { offlineDevPlayEnabled } from "@/lib/star/devMode";
import { createServiceClient } from "@/lib/supabase/service";
import { statusFromRow } from "@/lib/devStatus";

export const dynamic = "force-dynamic";

export async function GET() {
  // A local dev build lets everyone in (lib/star/devMode.ts; never the live site).
  if (!offlineDevPlayEnabled()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    if (!(await isAdmin(user.id))) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const data = await fetchTeamBoard({
    fetch: (url, init) => fetch(url, { ...init, cache: "no-store" }),
    notes: BUILT_IN_PATCH_NOTES,
    token: process.env.GITHUB_TOKEN?.trim() || null,
    repo: process.env.GITHUB_REPO?.trim() || undefined,
  });
  // Live bars (dev_status.sql). Missing table or no service key = "not switched on yet".
  let statusOn = false;
  try {
    const sb = createServiceClient();
    const { data: rows, error } = await sb.from("dev_status").select("person, body, session, created_at")
      .order("created_at", { ascending: false }).limit(60);
    if (!error) {
      statusOn = true;
      for (const p of data.people) {
        const r = (rows ?? []).find((x) => x.person === p.person);
        p.status = r ? statusFromRow(r) : null;
      }
    }
  } catch { /* not set up */ }
  return NextResponse.json({ ...data, statusOn }, { headers: { "Cache-Control": "no-store" } });
}
