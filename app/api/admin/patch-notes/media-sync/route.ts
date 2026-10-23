/**
 * /api/admin/patch-notes/media-sync — the "Move media to Cloudflare" button
 * on /admin/patch-notes (Harry, 22 Oct 2026). Admin only.
 *
 *   GET   how far the move is: files and MB in R2 out of those bundled here.
 *   POST  one batch: copies the next files not yet in R2 (same size = skip),
 *         for up to ~20 s, then answers with the new totals. The page calls it
 *         again until `finished`. Safe to stop and press again at any time.
 *
 * It runs here, on Vercel, because only Vercel has the R2 keys; the files
 * come from the copy of patch-notes/ bundled into this route
 * (next.config.mjs outputFileTracingIncludes). The file route picks moved
 * files up within 5 minutes (its cached listing of the bucket).
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/patchNotePageServe";
import { offlineDevPlayEnabled } from "@/lib/star/devMode";
import { planUploads, progressOf, runBatch } from "@/lib/patchNoteMedia";
import { listLocalMedia, listRemote, mediaMode, migrateDeps } from "@/lib/patchNoteMediaServer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** A local dev build lets everyone in, like the page itself (never the live site). */
const gate = async () => (offlineDevPlayEnabled() ? null : requireAdmin());

function modeBody() {
  const m = mediaMode();
  return { mode: m.mode, connected: m.mode !== "off", missing: m.missing };
}

export async function GET() {
  const forbidden = await gate();
  if (forbidden) return forbidden;
  const mode = modeBody();
  if (!mode.connected) return NextResponse.json({ ...mode, totalFiles: 0, totalBytes: 0, doneFiles: 0, doneBytes: 0, finished: false });
  try {
    const p = progressOf(planUploads(await listLocalMedia(), await listRemote()));
    return NextResponse.json({ ...mode, ...p, finished: p.totalFiles > 0 && p.doneFiles >= p.totalFiles });
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
