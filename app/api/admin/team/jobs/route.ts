/**
 * GET /api/admin/team/jobs — the team's pushed jobs (admins only).
 *
 * Reads team/jobs.json from GitHub on main and on each person's branch with
 * the site's GITHUB_TOKEN, merged by id (lib/teamRoom/jobs.ts). Cached 60 s
 * on the server. If GitHub can't be reached, the copy built into the site.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { offlineDevPlayEnabled } from "@/lib/star/devMode";
import { BUNDLED_JOBS } from "@/lib/teamRoom/config";
import { fetchTeamJobs } from "@/lib/teamRoom/jobs";

export const dynamic = "force-dynamic";

export async function GET() {
  // A local dev build lets everyone in (lib/star/devMode.ts; never the live site).
  if (!offlineDevPlayEnabled()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    if (!(await isAdmin(user.id))) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }
  const data = await fetchTeamJobs({
    fetch: (url, init) => fetch(url, { ...init, cache: "no-store" }),
    bundled: BUNDLED_JOBS,
    token: process.env.GITHUB_TOKEN?.trim() || null,
    repo: process.env.GITHUB_REPO?.trim() || undefined,
  });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
