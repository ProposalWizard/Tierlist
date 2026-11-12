/**
 * /api/cron/patch-bot — the Patch bot's timer (Harry, 12 Nov 2026).
 *
 * GET from Vercel's timed job (vercel.json crons) every 15 minutes. Needs
 * CRON_SECRET, the same as the backup (lib/backup/plan.ts cronGate): with no
 * secret set it refuses, so nobody outside can make the bot run.
 *
 * Each run: announce any patch note not announced yet in #general (naming the
 * two who did not write it), send a due reminder, tidy a double. Asking twice
 * posts once (lib/teamRoom/patchBotServer.ts). Writes only team_bot_posts.
 *
 * The same run also does the two other quarter-hour bots (12 Nov 2026,
 * lib/teamRoom/botsServer.ts): the Bug bot's safety net (a card for any
 * player report of the last 3 days that has none; it only READS feedback) and
 * the Today bot's 09:00 ask. One failing never stops the others.
 */
import { NextResponse, type NextRequest } from "next/server";
import { cronGate } from "@/lib/backup/plan";
import { serviceOrNull } from "@/lib/backup/route";
import { runQuarterHour } from "@/lib/teamRoom/botsServer";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const g = cronGate(req.headers.get("authorization"), process.env.CRON_SECRET);
  if (!g.ok) return NextResponse.json({ ok: false, refused: g.reason === "no-secret", error: g.message }, { status: g.status });
  const sb = serviceOrNull();
  if (!sb) return NextResponse.json({ ok: false, error: "The Supabase service key is not set." }, { status: 503 });
  // The quarter-hour run: the Patch bot, then the Bug bot's check, then the Today bot's morning ask.
  const run = await runQuarterHour(sb);
  return NextResponse.json(run, { status: run.ok ? 200 : 500 });
}
