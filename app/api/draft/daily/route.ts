/**
 * GET /api/draft/daily?date=YYYY-MM-DD&points=N — today's Daily Draft ranking
 * (Leo, 27 Nov 2026). Counts the signed-in players' saved first seasons whose
 * event_key starts "daily:<date>:" (lib/draft/daily.ts), each player's first only. Answers numbers only:
 * how many played, the best score, and your top-%. No names, no accounts.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { DAILY_PREFIX, topPercent } from "@/lib/draft/daily";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date") ?? "";
  const points = Number(req.nextUrl.searchParams.get("points"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  try {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from("draft_runs")
      .select("user_id, points, created_at")
      .like("event_key", `${DAILY_PREFIX}${date}:%`)
      .eq("season_number", 1)
      .order("created_at", { ascending: true })
      .limit(10000);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // One score per player: their FIRST of the day (replaying a season for more points doesn't count).
    const firstByUser = new Map<string, number>();
    for (const r of (data ?? []) as { user_id: string; points: number }[]) if (!firstByUser.has(r.user_id)) firstByUser.set(r.user_id, Number(r.points));
    const all = Array.from(firstByUser.values()).filter((n) => Number.isFinite(n));
    return NextResponse.json(
      { date, count: all.length, best: all.length ? Math.max(...all) : null, topPct: Number.isFinite(points) ? topPercent(points, all) : null },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
