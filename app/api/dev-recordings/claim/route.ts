/**
 * POST /api/dev-recordings/claim {person} — a chat's hook takes that person's
 * unread recordings (last 3 days) and marks them read, so each recording is
 * read once, by whichever of that person's chats is messaged first.
 * No password, like /api/dev-status (Harry, 18 Oct 2026: "id rather no
 * passwords"): the worst a stranger can do is see game-test video links or
 * mark them read. Harry, Mikey, Leo only; at most 5 rows a call.
 */
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { STATUS_PEOPLE } from "@/lib/devStatus";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let j: { person?: string };
  try { j = await req.json(); } catch { return NextResponse.json({ error: "Send JSON." }, { status: 400 }); }
  const person = STATUS_PEOPLE.find((p) => p.toLowerCase() === (j.person ?? "").trim().toLowerCase());
  if (!person) return NextResponse.json({ error: "person must be Harry, Mikey or Leo." }, { status: 400 });

  const sb = createServiceClient();
  const since = new Date(Date.now() - 3 * 864e5).toISOString();
  const { data, error } = await sb.from("dev_recordings").select("id, title, link, created_at")
    .eq("person", person).is("read_at", null).gte("created_at", since)
    .order("created_at", { ascending: true }).limit(5);
  if (error) return NextResponse.json({ recordings: [], error: "dev_recordings.sql not run yet?" });
  // Only rows still unread at this moment count as ours (two chats at once).
  const ids = (data ?? []).map((r) => r.id);
  const { data: taken } = ids.length
    ? await sb.from("dev_recordings").update({ read_at: new Date().toISOString() }).in("id", ids).is("read_at", null).select("id")
    : { data: [] as { id: number }[] };
  const mine = new Set((taken ?? []).map((r) => r.id));
  const recordings = (data ?? []).filter((r) => mine.has(r.id)).map(({ title, link, created_at }) => ({ title, link, created_at }));
  return NextResponse.json({ recordings });
}
