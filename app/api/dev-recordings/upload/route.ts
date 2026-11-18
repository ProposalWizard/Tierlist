/**
 * POST /api/dev-recordings/upload {who, about, seconds, ext, size} — Admin →
 * Videos asks for a 15-minute link to put one recording straight into R2
 * (recordings/<who>/…, lib/recordings/store.ts). Admins and testers. The
 * video never passes through the site. 503 = R2 is not connected here (the
 * recorder then falls back to Drive or a download).
 */
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { ukDay, uploadUrl } from "@/lib/marketing/r2";
import { RECORDINGS_PREFIX, checkRecording, recordingKey, usedOn } from "@/lib/recordings/store";
import { NOT_CONNECTED, recorderAllowed, recordingStore } from "@/lib/recordings/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!(await recorderAllowed())) return NextResponse.json({ error: "Admins and testers only." }, { status: 403 });
  const store = recordingStore();
  if (!store) return NextResponse.json({ error: NOT_CONNECTED, connected: false }, { status: 503 });
  const body = (await req.json().catch(() => null)) ?? {};
  try {
    const now = new Date();
    const first = checkRecording(body, { files: 0, bytes: 0 });
    if (!first.ok) return NextResponse.json({ error: first.error }, { status: first.status });
    const day = ukDay(now);
    const used = usedOn(await store.list(`${RECORDINGS_PREFIX}${first.who.toLowerCase()}/${day}-`), day);
    const check = checkRecording(body, used);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });
    const key = recordingKey({ ...check, now, rand: randomBytes(4).toString("hex") });
    return NextResponse.json({ key, url: uploadUrl(store.config, key, check.size, now) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Storage could not be reached." }, { status: 502 });
  }
}
