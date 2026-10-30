/**
 * /api/team/bug-ring — the phone/computer buzz for a new bug report in #bugs
 * (plan A2 + A6; Harry, 25 Oct 2026). The post itself is written by the
 * database (a trigger on feedback, team_room_v4.sql); this only rings.
 *
 * POST {} — called by the bug-report form right after a player sends a report
 * (no sign-in: players report bugs signed out too). It never trusts anything
 * the caller sends: it looks for Bug bot posts made in the last 2 minutes that
 * have not been rung yet, claims each one (meta.rung, so two callers never ring
 * twice), and rings Harry, Mikey and Leo by their own 🔔 for #bugs (every
 * message by default; nobody whose buzzes are paused). Nothing to ring = a
 * quiet { ok: true, sent: 0 }. No key set, or team_room_v4.sql not run: the
 * same, so a player's report is never affected.
 */
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { TEAM_ROOM } from "@/lib/teamRoom/config";
import { ringsWithBells } from "@/lib/teamRoom/bells";
import { bellsOf, pushReady, quietPeople, ring, teamAccounts } from "@/lib/teamRoom/notifyServer";
import type { PushPayload } from "@/lib/teamRoom/notify";

export const dynamic = "force-dynamic";

const FRESH_MS = 2 * 60_000;

export async function POST() {
  if (!pushReady()) return NextResponse.json({ ok: true, sent: 0, off: true });
  let sb: ReturnType<typeof createServiceClient>;
  try { sb = createServiceClient(); } catch { return NextResponse.json({ ok: true, sent: 0 }); }
  const since = new Date(Date.now() - FRESH_MS).toISOString();
  const { data, error } = await sb.from("team_bot_posts").select("id, title, meta, created_at").eq("bot", "bug").gte("created_at", since).order("id").limit(5);
  if (error || !data?.length) return NextResponse.json({ ok: true, sent: 0 });

  const fresh: { id: number; title: string }[] = [];
  for (const r of data as { id: number; title: string; meta: Record<string, unknown> | null }[]) {
    if (r.meta?.rung) continue;
    // Claim it: only the caller whose update finds it still unrung rings it.
    const { data: won } = await sb.from("team_bot_posts").update({ meta: { ...(r.meta ?? {}), rung: true } }).eq("id", r.id).is("meta->rung", null).select("id");
    if (won?.length) fresh.push({ id: r.id, title: r.title });
  }
  if (!fresh.length) return NextResponse.json({ ok: true, sent: 0 });

  let accounts;
  try { accounts = await teamAccounts(sb); } catch { return NextResponse.json({ ok: true, sent: 0 }); }
  const [prefsOf, quiet] = await Promise.all([bellsOf(sb, accounts), quietPeople(sb)]);
  const who = ringsWithBells({ sender: null, slug: "bugs", base: [], prefsOf, quiet, now: Date.now() });
  if (!who.length) return NextResponse.json({ ok: true, sent: 0 });
  const payload: PushPayload = {
    title: fresh.length === 1 ? `🐞 Bug report #${fresh[0].id}` : `🐞 ${fresh.length} new bug reports`,
    body: fresh.map((f) => f.title).join(" · ").slice(0, 160),
    tag: "kib-bug", url: `${TEAM_ROOM.home}?tab=chat&ch=bugs`, icon: TEAM_ROOM.push.icon,
  };
  const d = await ring(sb, accounts, who.map((r) => ({ person: r.person, payload })));
  return NextResponse.json({ ok: true, reports: fresh.length, ...d });
}
