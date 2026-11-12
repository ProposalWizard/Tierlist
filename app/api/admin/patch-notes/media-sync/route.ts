/**
 * /api/admin/patch-notes/media-sync — copies patch-note pictures into R2
 * (Harry, 22 Oct 2026). Admin only, except the timed job below.
 *
 *   GET   from Vercel's timed job (vercel.json crons, every 5 minutes; who
 *         counts: cronAllowed in lib/patchNoteMedia.ts): one batch, so the
 *         move finishes by itself (Harry, 12 Nov 2026). Idle once done.
 *   GET   from an admin: how far the move is: files and MB in R2 out of those bundled here.
 *   POST  one batch: copies the next files not yet in R2 (same size = skip),
 *         for up to ~20 s, then answers with the new totals. The page calls it
 *         again until `finished`. Safe to stop and press again at any time.
 *
 * It runs here, on Vercel, because only Vercel has the R2 keys; the files
 * come from the copy of patch-notes/ bundled into this route
 * (next.config.mjs outputFileTracingIncludes). The file route picks moved
 * files up within 5 minutes (its cached listing of the bucket).
 */
import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/patchNotePageServe";
import { offlineDevPlayEnabled } from "@/lib/star/devMode";
import { CRON_DEFAULTS, CRON_IDLE_MS, cronAllowed, planUploads, progressOf, runBatch } from "@/lib/patchNoteMedia";
import { listLocalMedia, listRemote, mediaMode, migrateDeps } from "@/lib/patchNoteMediaServer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** A local dev build lets everyone in, like the page itself (never the live site). */
const gate = async () => (offlineDevPlayEnabled() ? null : requireAdmin());

function modeBody() {
  const m = mediaMode();
  return { mode: m.mode, connected: m.mode !== "off", missing: m.missing };
}

/** When this server last saw the move finished (the timed job then idles; see CRON_IDLE_MS). */
let finishedAt = 0;

/** The timed job's call (vercel.json crons, every 5 minutes): one batch, or nothing once all is in R2. */
async function cronRun() {
  const mode = modeBody();
  if (!mode.connected) return NextResponse.json({ cron: true, mode: mode.mode, skipped: "storage not connected" });
  if (finishedAt && Date.now() - finishedAt < CRON_IDLE_MS) return NextResponse.json({ cron: true, finished: true, skipped: "all files already in R2" });
  try {
    const r = await runBatch(migrateDeps(), CRON_DEFAULTS);
    if (r.finished && r.failed.length === 0) finishedAt = Date.now();
    // Totals only: no file names, links or keys go back to a timed caller.
    return NextResponse.json({ cron: true, totalFiles: r.totalFiles, doneFiles: r.doneFiles, totalBytes: r.totalBytes, doneBytes: r.doneBytes, uploaded: r.uploaded, failed: r.failed.length, finished: r.finished });
  } catch (e) {
    return NextResponse.json({ cron: true, error: e instanceof Error ? e.message : "The batch failed." }, { status: 502 });
  }
}

export async function GET(req: NextRequest) {
  if (cronAllowed({ authorization: req.headers.get("authorization"), userAgent: req.headers.get("user-agent") }, process.env.CRON_SECRET)) return cronRun();
  const forbidden = await gate();
  if (forbidden) return forbidden;
  const mode = modeBody();
  if (!mode.connected) return NextResponse.json({ ...mode, totalFiles: 0, totalBytes: 0, doneFiles: 0, doneBytes: 0, finished: false });
  try {
    const p = progressOf(planUploads(await listLocalMedia(), await listRemote()));
    // After the cleanup the site holds only new pictures (often none): nothing waiting = done.
    return NextResponse.json({ ...mode, ...p, finished: p.doneFiles >= p.totalFiles });
  } catch (e) {
    return NextResponse.json({ ...mode, error: e instanceof Error ? e.message : "Could not read the bucket." }, { status: 502 });
  }
}

export async function POST() {
  const forbidden = await gate();
  if (forbidden) return forbidden;
  const mode = modeBody();
  if (!mode.connected) return NextResponse.json({ ...mode, error: "Storage not connected here. This works on the live site, where the R2 keys are." }, { status: 503 });
  try {
    return NextResponse.json({ ...mode, ...(await runBatch(migrateDeps())) });
  } catch (e) {
    return NextResponse.json({ ...mode, error: e instanceof Error ? e.message : "The batch failed." }, { status: 502 });
  }
}
