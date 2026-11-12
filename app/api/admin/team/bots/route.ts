/**
 * /api/admin/team/bots — the bots' pages in the Team room (admins only).
 *
 * GET  → each bot's settings (on/off, reminder) and whether the timer can run
 *        (CRON_SECRET set). Read with the site's key so it is always whole.
 * POST { run: true }                         the quarter-hour run now: Patch, Bug and Today bots (the Team room
 *                                            asks once a visit, so they work without waiting for the timer)
 * POST { run: true, bot }                    Run now on one bot's page: patch-notes, bug, today or health
 * POST { bot, enabled?, nudgeHours? }        save a bot's settings (only the Patch bot can be switched)
 *
 * Writes only team_bot_posts, with the site's own key; no browser can.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { serviceOrNull } from "@/lib/backup/route";
import { isTeamPerson, type TeamPerson } from "@/lib/teamRoom/config";
import { BOTS, PATCH_BOT, botSettings, type BotSettings } from "@/lib/teamRoom/patchBot";
import { runPatchBot, saveBotSettings, settingsRows } from "@/lib/teamRoom/patchBotServer";
import { runOne, runQuarterHour } from "@/lib/teamRoom/botsServer";
import { ringRed } from "@/lib/backup/route";

export const dynamic = "force-dynamic";

async function caller(): Promise<{ id: string } | NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!(await isAdmin(user.id))) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  return { id: user.id };
}

export async function GET() {
  const c = await caller();
  if (c instanceof NextResponse) return c;
  const sb = serviceOrNull();
  if (!sb) return NextResponse.json({ ok: false, error: "The Supabase service key is not set." }, { status: 503 });
  try {
    const rows = await settingsRows(sb);
    const settings: Record<string, BotSettings> = {};
    for (const b of BOTS) settings[b.bot] = botSettings(rows, b.bot);
    return NextResponse.json({ ok: true, settings, timer: !!process.env.CRON_SECRET?.trim() }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const c = await caller();
  if (c instanceof NextResponse) return c;
  const sb = serviceOrNull();
  if (!sb) return NextResponse.json({ ok: false, error: "The Supabase service key is not set." }, { status: 503 });
  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: "Bad request." }, { status: 400 }); }

  if (body.run === true) {
    if (typeof body.bot !== "string") {
      const all = await runQuarterHour(sb);
      return NextResponse.json(all, { status: all.ok ? 200 : 500 });
    }
    const which = BOTS.find((b) => b.bot === body.bot);
    if (!which) return NextResponse.json({ error: "Which bot?" }, { status: 400 });
    if (!which.runnable) return NextResponse.json({ ok: false, error: which.noRun ?? "This bot has nothing to run." }, { status: 400 });
    const { data: who } = await sb.from("team_members").select("person").eq("user_id", c.id).maybeSingle();
    const name = (who as { person?: string } | null)?.person;
    const run = await runOne(sb, which.bot, isTeamPerson(name) ? name : null);
    if (run.red && run.title) await ringRed(sb, run.title, run.body ?? "");
    return NextResponse.json({ ok: run.ok, text: run.text, posted: run.posted, off: !!run.off, error: run.ok ? undefined : run.text }, { status: run.ok ? 200 : 500 });
  }

  const info = BOTS.find((b) => b.bot === body.bot);
  if (!info) return NextResponse.json({ error: "Which bot?" }, { status: 400 });
  if (!info.switchable) return NextResponse.json({ error: info.fixed ?? "This bot can't be changed from here." }, { status: 400 });
  try {
    const { data: who } = await sb.from("team_members").select("person").eq("user_id", c.id).maybeSingle();
    const name = (who as { person?: string } | null)?.person;
    const me: TeamPerson | null = isTeamPerson(name) ? name : null;
    if (!me) return NextResponse.json({ error: "Pick your name in the Team room first." }, { status: 403 });
    const now = botSettings(await settingsRows(sb), info.bot);
    const h = Number(body.nudgeHours);
    const next = {
      enabled: typeof body.enabled === "boolean" ? body.enabled : now.enabled,
      nudgeHours: body.nudgeHours !== undefined && PATCH_BOT.nudgeChoices.includes(h) ? h : now.nudgeHours,
    };
    const saved = await saveBotSettings(sb, info.bot, next, me);
    // Switched back on: announce anything published while it was off, at once.
    const run = info.bot === PATCH_BOT.bot && saved.enabled && !now.enabled ? await runPatchBot(sb) : null;
    return NextResponse.json({ ok: true, settings: saved, run });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
