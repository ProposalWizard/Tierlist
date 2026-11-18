/**
 * /api/cron/recordings — the nightly clean-up of Admin → Videos recordings
 * (Harry, 12 Nov 2026: no breakdown videos piling up as wasted storage).
 *
 * GET from Vercel's timed job (vercel.json crons), once a night. Needs
 * CRON_SECRET, like the backup: with no secret, or the wrong one, it refuses
 * and deletes nothing (lib/backup/plan.ts cronGate; never a user-agent check).
 *
 * Deletes every recording that arrived more than 30 days ago and is not
 * marked Keep, plus marks left behind by a recording that is gone
 * (lib/recordings/store.ts cleanupPlan). Only ever inside recordings/.
 */
import { NextResponse, type NextRequest } from "next/server";
import { cronGate } from "@/lib/backup/plan";
import { RECORDINGS_PREFIX, cleanupPlan } from "@/lib/recordings/store";
import { recordingStore } from "@/lib/recordings/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
/** One night deletes at most this many files; the rest go the next night. */
const MAX_A_NIGHT = 300;

export async function GET(req: NextRequest) {
  const g = cronGate(req.headers.get("authorization"), process.env.CRON_SECRET);
  if (!g.ok) return NextResponse.json({ ok: false, error: g.message }, { status: g.status });
  const store = recordingStore();
  if (!store) return NextResponse.json({ ok: true, skipped: "R2 is not connected" });
  try {
    const plan = cleanupPlan(await store.list(RECORDINGS_PREFIX), new Date()).slice(0, MAX_A_NIGHT);
    let removed = 0;
    for (const key of plan) {
      // Belt and braces: never a key outside recordings/.
      if (!key.startsWith(RECORDINGS_PREFIX) || key.includes("..")) continue;
      await store.remove(key);
      removed++;
    }
    return NextResponse.json({ ok: true, removed });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message || "Storage could not be reached." }, { status: 502 });
  }
}
