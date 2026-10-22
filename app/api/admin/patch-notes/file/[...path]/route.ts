/**
 * GET /api/admin/patch-notes/file/<path under patch-notes/> — a kept page's
 * own pictures, clips, fonts and stylesheets. Admin only; nothing outside
 * patch-notes/ and nothing but those file types (lib/patchNotePageServe.ts).
 *
 * Pictures and clips (22 Oct 2026): when Cloudflare R2 holds the file, this
 * answers with a short-lived signed R2 link instead (lib/patchNoteMedia.ts);
 * otherwise it serves the copy bundled with the site, as before. Clips from
 * the bundle answer byte ranges, because iPhone Safari won't play a video
 * that can't be fetched in pieces (R2 answers ranges itself).
 */
import path from "path";
import { NextResponse } from "next/server";
import { SERVED_TYPES, requireAdmin } from "@/lib/patchNotePageServe";
import { REDIRECT_CACHE_SECONDS, decideServe } from "@/lib/patchNoteMedia";
import { serveDeps } from "@/lib/patchNoteMediaServer";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { path: string[] } }) {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;
  const rel = (params.path ?? []).map((p) => decodeURIComponent(p)).join("/");
  const type = SERVED_TYPES[path.extname(rel).toLowerCase()];
  if (!type) return NextResponse.json({ error: "Not a served file type." }, { status: 404 });
  const got = await decideServe(rel, serveDeps());
  if (got.kind === "redirect") {
    return new NextResponse(null, { status: 302, headers: { Location: got.url, "Cache-Control": `private, max-age=${REDIRECT_CACHE_SECONDS}` } });
  }
  if (got.kind === "missing") return NextResponse.json({ error: "Not found." }, { status: 404 });
  const buf = got.body;
  const headers = { "Content-Type": type, "Cache-Control": "private, max-age=3600", "Accept-Ranges": "bytes" };
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    const size = buf.length;
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    start = Math.max(0, start); end = Math.min(size - 1, end);
    if (start > end) {
      return new NextResponse(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
    }
    return new NextResponse(new Uint8Array(buf.subarray(start, end + 1)), {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }
  return new NextResponse(new Uint8Array(buf), { headers });
}
