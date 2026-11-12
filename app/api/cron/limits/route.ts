/**
 * /api/cron/limits — the morning limits post in #health (Harry, 12 Nov 2026).
 *
 * GET from Vercel's timed job (vercel.json crons) at 07:00 and 08:00 UTC;
 * only the call that lands on 08:00 UK time posts. Needs CRON_SECRET, the
 * same as the backup (lib/backup/plan.ts cronGate).
 *
 * Reads, never writes (except the one post):
 *   database size vs 500 MB, Supabase Storage vs 1 GB  ops_limits() (supabase/migrations/ops_limits.sql)
 *   Cloudflare R2 vs 10 GB free                        a listing of the whole bucket, summed by top folder
 *   last night's backup                                backups/db/<UK date>/manifest.json
 * Amber at 75 %, red at 90 %. A red post buzzes phones (🔔 for #health:
 * Only when red, by default).
 *
 * The work itself is the Health bot (lib/teamRoom/botsServer.ts runHealthBot),
 * the same code its page's Run now button calls. Switched off on that page:
 * no morning post.
 */
import { NextResponse, type NextRequest } from "next/server";
import { LIMITS_UK_HOUR, isUkHour, ukClock } from "@/lib/backup/plan";
import { gateOrRefuse, ringRed, serviceOrNull } from "@/lib/backup/route";
import { runHealthBot } from "@/lib/teamRoom/botsServer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const refused = await gateOrRefuse(req.headers.get("authorization"), "limits");
  if (refused) return refused;

  const now = new Date();
  if (!isUkHour(now, LIMITS_UK_HOUR)) return NextResponse.json({ ok: true, skipped: `not ${LIMITS_UK_HOUR}:00 UK time` });

  const sb = serviceOrNull();
  if (!sb) return NextResponse.json({ ok: false, error: "The Supabase service key is not set." }, { status: 503 });

  const run = await runHealthBot(sb, now);
  if (!run.ok) return NextResponse.json({ ok: false, error: run.text }, { status: 502 });
  const rang = run.red && run.title ? await ringRed(sb, run.title, run.body ?? "") : 0;
  return NextResponse.json({ ok: true, day: ukClock(now).day, off: !!run.off, posted: run.posted, text: run.text, rang });
}
