/**
 * POST /api/dev-recordings/keep {key, keep} — the Keep switch on Admin →
 * Videos. On = an empty mark beside the recording (<key>.keep) and the
 * nightly clean-up leaves it alone; off = the mark goes and the 30 days
 * count from when the recording arrived. Admins and testers.
 */
import { NextResponse } from "next/server";
import { isRecordingKey, keepKeyFor } from "@/lib/recordings/store";
import { NOT_CONNECTED, recorderAllowed, recordingStore } from "@/lib/recordings/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!(await recorderAllowed())) return NextResponse.json({ error: "Admins and testers only." }, { status: 403 });
  const store = recordingStore();
  if (!store) return NextResponse.json({ error: NOT_CONNECTED }, { status: 503 });
  const j = (await req.json().catch(() => null)) as { key?: unknown; keep?: unknown } | null;
  const key = j?.key;
  if (!isRecordingKey(key) || typeof j?.keep !== "boolean") return NextResponse.json({ error: "Send a recording and keep: true or false." }, { status: 400 });
  try {
    if (!(await store.head(key))) return NextResponse.json({ error: "That recording is gone." }, { status: 404 });
    if (j.keep) await store.putText(keepKeyFor(key), ""); else await store.remove(keepKeyFor(key));
    return NextResponse.json({ ok: true, key, keep: j.keep });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Storage could not be reached." }, { status: 502 });
  }
}
