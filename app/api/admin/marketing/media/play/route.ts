/**
 * GET /api/admin/marketing/media/play?key=… — admins only. Plays one upload:
 * a redirect to a one-hour signed link into the private bucket (the video
 * streams from R2, never through the site). Development only, with no R2
 * settings: streams the file from docs/marketing/videos, with seeking.
 */
import fs from "node:fs";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { gate } from "@/lib/marketing/mediaApi";
import { isVideoKey, mediaOf, playUrl } from "@/lib/marketing/r2";
import { getStorage, localFile } from "@/lib/marketing/storage";
import { getCaller } from "@/lib/marketing/caller";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = gate(await getCaller());
  if (denied) return NextResponse.json(denied.body, { status: denied.status });
  const key = new URL(req.url).searchParams.get("key") ?? "";
  const store = getStorage();
  if (store.mode === "r2" && store.config && isVideoKey(key)) {
    return NextResponse.redirect(playUrl(store.config, key, new Date()), { status: 302, headers: { "Cache-Control": "private, max-age=600" } });
  }
  const file = store.mode === "local" ? localFile(key) : null;
  if (!file) return NextResponse.json({ error: store.mode === "off" ? "Storage not connected here." : "No such video." }, { status: 404 });

  const size = fs.statSync(file).size;
  const type = mediaOf(file)?.mime ?? "application/octet-stream";
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (m) {
    const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
    const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    if (start >= size || start > end) return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    const body = Readable.toWeb(fs.createReadStream(file, { start, end })) as unknown as ReadableStream;
    return new NextResponse(body, { status: 206, headers: { "Content-Type": type, "Accept-Ranges": "bytes", "Content-Length": String(end - start + 1), "Content-Range": `bytes ${start}-${end}/${size}` } });
  }
  const body = Readable.toWeb(fs.createReadStream(file)) as unknown as ReadableStream;
  return new NextResponse(body, { status: 200, headers: { "Content-Type": type, "Accept-Ranges": "bytes", "Content-Length": String(size) } });
}
