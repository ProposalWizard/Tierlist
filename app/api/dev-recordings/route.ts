/**
 * /api/dev-recordings — Admin → Videos. Signed-in admins and testers only
 * (the same people the Videos tab lets in).
 *
 * GET  — the recent recordings in team storage (R2, recordings/…): who, what,
 *        length, date, the link for Claude, Keep, days left. Newest first,
 *        at most 60. Read straight from the bucket (lib/recordings/store.ts).
 * POST — a recording that reached Drive ONLY (R2 not connected, or the R2
 *        save failed) is added to the dev_recordings table so the recorder's
 *        own chats still read it (scripts/hooks/recordings-hook.mjs; Harry,
 *        19 Oct 2026). A recording in R2 needs no row: the claim route reads
 *        the bucket. Writes with the service key; dev_recordings.sql keeps
 *        100 rows a person.
 */
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { STATUS_PEOPLE } from "@/lib/devStatus";
import { RECORDINGS_PREFIX, RETAIN_DAYS, recordingsFromList, rowsFor } from "@/lib/recordings/store";
import { recorderAllowed, recordingStore, siteOrigin } from "@/lib/recordings/server";

export const dynamic = "force-dynamic";
const LIST_MAX = 60;

export async function GET(req: Request) {
  if (!(await recorderAllowed())) return NextResponse.json({ error: "Admins and testers only." }, { status: 403 });
  const store = recordingStore();
  if (!store) return NextResponse.json({ connected: false, keptDays: RETAIN_DAYS, recordings: [] });
  try {
    const items = recordingsFromList(await store.list(RECORDINGS_PREFIX), new Date()).slice(0, LIST_MAX);
    return NextResponse.json({ connected: true, keptDays: RETAIN_DAYS, recordings: rowsFor(items, store.config, siteOrigin(req)) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Storage could not be reached." }, { status: 502 });
  }
}

export async function POST(req: Request) {
  if (!(await recorderAllowed())) return NextResponse.json({ error: "Admins and testers only." }, { status: 403 });

  let j: { person?: string; title?: string; link?: string };
  try { j = await req.json(); } catch { return NextResponse.json({ error: "Send JSON." }, { status: 400 }); }
  const person = STATUS_PEOPLE.find((p) => p.toLowerCase() === (j.person ?? "").trim().toLowerCase());
  if (!person) return NextResponse.json({ error: "person must be Harry, Mikey or Leo." }, { status: 400 });
  const link = String(j.link ?? "").trim();
  if (!link.startsWith("https://drive.google.com/") || link.length > 300) return NextResponse.json({ error: "link must be a Drive link." }, { status: 400 });
  const title = String(j.title ?? "").trim().slice(0, 200) || "screen recording";

  const { error } = await createServiceClient().from("dev_recordings").insert({ person, title, link });
  if (error) return NextResponse.json({ error: "Could not save (has dev_recordings.sql been run?)." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
