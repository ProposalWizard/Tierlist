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
 */
import { NextResponse, type NextRequest } from "next/server";
import { LIMITS_UK_HOUR, isUkHour, limitsPost, sizesByTopFolder, ukClock, type Manifest } from "@/lib/backup/plan";
import { postHealth, r2Config, r2ListAll, readManifest, supabaseSizes } from "@/lib/backup/server";
import { gateOrRefuse, ringRed, serviceOrNull } from "@/lib/backup/route";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const refused = await gateOrRefuse(req.headers.get("authorization"), "limits");
  if (refused) return refused;

  const now = new Date();
  if (!isUkHour(now, LIMITS_UK_HOUR)) return NextResponse.json({ ok: true, skipped: `not ${LIMITS_UK_HOUR}:00 UK time` });
  const day = ukClock(now).day;

  const sb = serviceOrNull();
  if (!sb) return NextResponse.json({ ok: false, error: "The Supabase service key is not set." }, { status: 503 });

  const notes: string[] = [];
  const sizes = await supabaseSizes(sb).catch(() => ({ dbBytes: null, storageBytes: null, note: "could not read database sizes" }));
  if (sizes.note) notes.push(sizes.note);

  const { config, missing } = r2Config();
  let r2: ReturnType<typeof sizesByTopFolder> | null = null;
  let backup: Manifest | null = null;
  if (!config) notes.push(`R2 is not connected here (${missing.join(", ")})`);
  else {
    try { r2 = sizesByTopFolder(await r2ListAll(config)); } catch { notes.push("could not list the R2 bucket"); }
    try { backup = await readManifest(config, day); } catch { notes.push("could not read last night's backup manifest"); }
  }

  const post = limitsPost({ day, dbBytes: sizes.dbBytes, storageBytes: sizes.storageBytes, r2, backup, notes });
  try {
    await postHealth(sb, { title: post.title, body: post.body, meta: { kind: "limits", red: post.red, level: post.level, day, lines: post.lines } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Could not post." }, { status: 502 });
  }
  const rang = post.red ? await ringRed(sb, post.title, post.body) : 0;
  return NextResponse.json({ ok: true, day, level: post.level, rang });
}
