/**
 * GET /api/dev-recordings/watch?k=<who>/<file>&t=<token> — the link for
 * Claude, and the Play button on Admin → Videos. No sign-in: the token is
 * made from the recording's own name and the storage secret, so only someone
 * handed the link can use it, and it works for as long as the recording
 * exists (30 days, or longer when kept).
 *
 * Answers with a redirect to a fresh one-hour signed R2 link: the video
 * streams from R2, never through the site. `&stream=1` sends it through the
 * site instead, for a Claude session whose network may reach the site but
 * not R2 (scripts/screen-video/fetch.py tries that second).
 */
import { NextResponse } from "next/server";
import { RECORDING_TYPES, keyFromWatch, parseRecordingKey, recordingGetUrl, tokenOk } from "@/lib/recordings/store";
import { NOT_CONNECTED, recordingStore } from "@/lib/recordings/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const store = recordingStore();
  if (!store) return NextResponse.json({ error: NOT_CONNECTED }, { status: 503 });
  const key = keyFromWatch(q.get("k"));
  // One answer for a wrong link and a wrong token: nothing to learn from guessing.
  if (!key || !tokenOk(store.config.secret, key, q.get("t"))) return NextResponse.json({ error: "No such recording." }, { status: 404 });
  const url = recordingGetUrl(store.config, key, new Date());
  if (q.get("stream") !== "1") return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, no-store" } });

  const range = req.headers.get("range");
  const res = await fetch(url, { cache: "no-store", headers: range ? { range } : undefined });
  if (!res.ok || !res.body) {
    const gone = res.status === 404;
    return NextResponse.json({ error: gone ? "That recording is gone (they are kept 30 days)." : "Storage could not be reached." }, { status: gone ? 404 : 502 });
  }
  const headers: Record<string, string> = { "Content-Type": RECORDING_TYPES[parseRecordingKey(key)!.ext], "Accept-Ranges": "bytes", "Cache-Control": "private, no-store" };
  for (const h of ["content-length", "content-range"]) { const v = res.headers.get(h); if (v) headers[h] = v; }
  return new NextResponse(res.body, { status: res.status, headers });
}
