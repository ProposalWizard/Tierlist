/**
 * POST /api/dev-recordings/upload/done {key} — the recording arrived in R2.
 * Answers with the link for Claude (lib/recordings/store.ts watchLink).
 * Anything over the size cap is deleted at once. Admins and testers.
 */
import { NextResponse } from "next/server";
import { RECORDING_CAPS, isRecordingKey, parseRecordingKey, recordingTitle, watchLink } from "@/lib/recordings/store";
import { NOT_CONNECTED, recorderAllowed, recordingStore, siteOrigin } from "@/lib/recordings/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!(await recorderAllowed())) return NextResponse.json({ error: "Admins and testers only." }, { status: 403 });
  const store = recordingStore();
  if (!store) return NextResponse.json({ error: NOT_CONNECTED }, { status: 503 });
  const key = ((await req.json().catch(() => null)) as { key?: unknown } | null)?.key;
  if (!isRecordingKey(key)) return NextResponse.json({ error: "That is not a recording." }, { status: 400 });
  try {
    const h = await store.head(key);
    if (!h) return NextResponse.json({ error: "The recording did not arrive. Try again." }, { status: 404 });
    if (h.size > RECORDING_CAPS.maxFileBytes) { await store.remove(key); return NextResponse.json({ error: "Too big: removed." }, { status: 413 }); }
    return NextResponse.json({ key, size: h.size, title: recordingTitle(parseRecordingKey(key)!), link: watchLink(siteOrigin(req), store.config, key) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Storage could not be reached." }, { status: 502 });
  }
}
