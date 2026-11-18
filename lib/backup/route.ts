/**
 * lib/backup/route.ts — SERVER ONLY. The gate both timed jobs share
 * (/api/cron/backup, /api/cron/limits): CRON_SECRET or nothing.
 */
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { TEAM_ROOM } from "@/lib/teamRoom/config";
import { ringsWithBells } from "@/lib/teamRoom/bells";
import { bellsOf, pushReady, quietPeople, ring, teamAccounts } from "@/lib/teamRoom/notifyServer";
import type { PushPayload } from "@/lib/teamRoom/notify";
import { NO_SECRET_POST_EVERY_MS, cronGate } from "./plan";
import { reportNoSecret } from "./server";

export function serviceOrNull() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  try { return createServiceClient(); } catch { return null; }
}

/** A red #health post buzzes whoever's 🔔 for #health allows it (default: Only when red). Never throws. */
export async function ringRed(sb: SupabaseClient, title: string, body: string): Promise<number> {
  if (!pushReady()) return 0;
  try {
    const accounts = await teamAccounts(sb);
    const [prefsOf, quiet] = await Promise.all([bellsOf(sb, accounts), quietPeople(sb)]);
    const who = ringsWithBells({ sender: null, slug: "health", base: [], prefsOf, quiet, now: Date.now(), red: true });
    if (!who.length) return 0;
    const payload: PushPayload = { title: `🔴 ${title}`.slice(0, 120), body: body.slice(0, 160), tag: "kib-health", url: `${TEAM_ROOM.home}?tab=chat&ch=health`, icon: TEAM_ROOM.push.icon };
    await ring(sb, accounts, who.map((r) => ({ person: r.person, payload })));
    return who.length;
  } catch { return 0; }
}

/** null = allowed. Otherwise the answer to send (and, with no secret set, a #health post). */
export async function gateOrRefuse(authorization: string | null, job: "backup" | "limits"): Promise<NextResponse | null> {
  const g = cronGate(authorization, process.env.CRON_SECRET);
  if (g.ok) return null;
  if (g.reason === "no-secret") {
    const posted = await reportNoSecret(serviceOrNull(), job, g.message, new Date(), NO_SECRET_POST_EVERY_MS);
    return NextResponse.json({ ok: false, refused: true, error: g.message, posted }, { status: g.status });
  }
  return NextResponse.json({ ok: false, error: g.message }, { status: g.status });
}
