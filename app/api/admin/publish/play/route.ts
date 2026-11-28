/**
 * GET /api/admin/publish/play?space=&key= — plays one video from a space's storage: a redirect to a one-hour signed
 * link (the video streams from Cloudflare, never through the site). The key is the one the posting queue uses
 * ("own:" in front for Mikey's bucket). Admins (football and content: only the Publish owner), or a chat.
 */
import { NextResponse } from "next/server";
import { NOT_YOURS, mayUse, whoIs } from "@/lib/publish/auth";
import { isPublishVideo, locate, storeOf } from "@/lib/publish/storage";
import { isSpace } from "@/lib/publish/types";
import { playUrl } from "@/lib/marketing/r2";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const who = await whoIs(req, ["admin", "agent"]);
  const q = new URL(req.url).searchParams;
  const sp = q.get("space");
  const space = isSpace(sp) ? sp : "kib";
  if (!mayUse(who, space)) return NextResponse.json({ error: NOT_YOURS }, { status: 403 });
  const key = q.get("key") ?? "";
  if (!isPublishVideo(key)) return NextResponse.json({ error: "That is not a video." }, { status: 400 });
  const { source, key: plain } = locate(key);
  const store = storeOf(source);
  if (!store?.config) return NextResponse.json({ error: "That storage is not connected here." }, { status: 503 });
  return NextResponse.redirect(playUrl(store.config, plain, new Date()), { status: 302, headers: { "Cache-Control": "private, max-age=600" } });
}
