/**
 * /api/cron/face-cache — ONE-OFF job (Mikey, 25 Nov 2026). Delete once done.
 *
 * Every player face in Storage (tierlist-images/player-portraits, 13,387
 * files) was uploaded with "no-cache", so browsers asked for every face again
 * on every screen. Storage keeps that setting inside each file, so it can only
 * change by uploading the file again: this job re-uploads each face, same
 * bytes, same name, with a week's cache ("max-age=604800").
 *
 * Needs CRON_SECRET (lib/backup/plan.ts cronGate). Started from Supabase
 * (pg_net with the vault's cron_secret), one batch per call. A face already
 * carrying the new setting is skipped, so calling it again just carries on,
 * and it is safe to stop at any time.
 */
import { NextResponse, type NextRequest } from "next/server";
import { cronGate } from "@/lib/backup/plan";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BUCKET = "tierlist-images";
const FOLDER = "player-portraits";
const KEEP = "604800"; // supabase-js sends this as "max-age=604800"
const AT_ONCE = 12;
const STOP_AFTER_MS = 240_000;

type Obj = { name: string; metadata?: { cacheControl?: string; mimetype?: string } | null };

export async function GET(req: NextRequest) {
  const g = cronGate(req.headers.get("authorization"), process.env.CRON_SECRET);
  if (!g.ok) return NextResponse.json({ ok: false, error: g.message }, { status: g.status });
  const t0 = Date.now();
  const sb = createServiceClient();
  const storage = sb.storage.from(BUCKET);

  // Every face, by name (1,000 a page).
  const todo: Obj[] = [];
  let total = 0;
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await storage.list(FOLDER, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
    if (error) return NextResponse.json({ ok: false, error: `list: ${error.message}` }, { status: 502 });
    for (const o of (data ?? []) as Obj[]) {
      if (!o.name || !o.metadata) continue; // folders have no metadata
      total++;
      if (o.metadata.cacheControl !== `max-age=${KEEP}`) todo.push(o);
    }
    if (!data || data.length < 1000) break;
  }

  let uploaded = 0;
  const failed: string[] = [];
  let i = 0;
  const worker = async () => {
    while (i < todo.length && Date.now() - t0 < STOP_AFTER_MS) {
      const o = todo[i++];
      const path = `${FOLDER}/${o.name}`;
      try {
        const { data: file, error: dErr } = await storage.download(path);
        if (dErr || !file) throw new Error(dErr?.message ?? "no file");
        const { error: uErr } = await storage.upload(path, file, {
          upsert: true,
          cacheControl: KEEP,
          contentType: o.metadata?.mimetype || "image/png",
        });
        if (uErr) throw new Error(uErr.message);
        uploaded++;
      } catch (e) {
        if (failed.length < 20) failed.push(`${o.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  };
  await Promise.all(Array.from({ length: AT_ONCE }, worker));

  const left = todo.length - uploaded;
  return NextResponse.json({
    ok: true,
    total,
    alreadyDone: total - todo.length,
    uploaded,
    left,
    finished: left === 0,
    seconds: Math.round((Date.now() - t0) / 1000),
    failed,
  });
}
